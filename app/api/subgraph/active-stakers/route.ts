import { NextResponse } from 'next/server';
import { getGraphQLApiUrl } from '@/config/networks';
import { fetchGraphQL } from '@/app/graphql/client';

// ISR configuration - revalidate every hour (3600 seconds)
export const revalidate = 3600; // 1 hour = 60 minutes * 60 seconds

const GET_ACTIVE_STAKERS_QUERY = `
  query GetActiveStakersCount($first: Int!, $skip: Int!) {
    users(where: { staked_gt: "0" }, first: $first, skip: $skip) {
      address
      staked
      depositPool
    }
  }
`;

interface User {
  address: string;
  staked: string;
  depositPool: string;
}

interface SubgraphResponse {
  data?: {
    users: User[];
  };
  errors?: Array<{ message: string }>;
}

interface SourceAttempt {
  source: string;
  endpoint?: string;
  error?: string;
}

interface ActiveStakersResult {
  count: number;
  totalEntries: number;
  source: string;
  endpoint?: string;
}

interface DuneResultsResponse {
  result?: {
    rows?: unknown[];
  };
  error?: string;
  message?: string;
}

const PAGE_SIZE = 1000;
const MAINNET_FALLBACK_GRAPHQL_URL = 'https://api.studio.thegraph.com/query/67225/morpheus-dashboard/version/latest';
const MAINNET_DUNE_ACTIVE_STAKERS_QUERY_ID = 5697884;

async function fetchActiveStakersFromSubgraph(endpoint: string, source: string): Promise<ActiveStakersResult> {
  const uniqueAddresses = new Set<string>();
  let totalEntries = 0;
  let skip = 0;

  while (true) {
    const result = await fetchGraphQL<SubgraphResponse>(
      endpoint,
      'GetActiveStakersCount',
      GET_ACTIVE_STAKERS_QUERY,
      { first: PAGE_SIZE, skip }
    );

    if (result.errors && result.errors.length > 0) {
      throw new Error(result.errors[0].message);
    }

    if (!result.data?.users) {
      throw new Error('No data returned from subgraph');
    }

    result.data.users.forEach((user: User) => {
      uniqueAddresses.add(user.address.toLowerCase());
    });

    totalEntries += result.data.users.length;

    if (result.data.users.length < PAGE_SIZE) {
      break;
    }

    skip += PAGE_SIZE;
  }

  return {
    count: uniqueAddresses.size,
    totalEntries,
    source,
    endpoint,
  };
}

async function fetchActiveStakersFromDune(): Promise<ActiveStakersResult> {
  if (!process.env.DUNE_API_KEY) {
    throw new Error('DUNE_API_KEY is not configured');
  }

  const endpoint = `https://api.dune.com/api/v1/query/${MAINNET_DUNE_ACTIVE_STAKERS_QUERY_ID}/results?limit=10000`;
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'X-Dune-API-Key': process.env.DUNE_API_KEY,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json() as DuneResultsResponse;

  if (!response.ok) {
    throw new Error(data.error || data.message || `Dune API request failed: ${response.status} ${response.statusText}`);
  }

  if (!Array.isArray(data.result?.rows)) {
    throw new Error(data.error || data.message || 'Dune query returned no result rows');
  }

  return {
    count: data.result.rows.length,
    totalEntries: data.result.rows.length,
    source: 'dune-query-results',
    endpoint,
  };
}

async function fetchActiveStakersWithFallback(primaryGraphqlUrl: string): Promise<ActiveStakersResult & { attempts: SourceAttempt[] }> {
  const attempts: SourceAttempt[] = [];

  try {
    const result = await fetchActiveStakersFromDune();
    attempts.push({ source: result.source, endpoint: result.endpoint });
    return { ...result, attempts };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    attempts.push({ source: 'dune-query-results', error: message });
    console.warn('⚠️ [ACTIVE STAKERS API] Dune primary source failed:', message);
  }

  const sources = [
    { source: 'thegraph-primary', endpoint: primaryGraphqlUrl },
    { source: 'thegraph-legacy-fallback', endpoint: MAINNET_FALLBACK_GRAPHQL_URL },
  ];

  for (const { source, endpoint } of sources) {
    try {
      const result = await fetchActiveStakersFromSubgraph(endpoint, source);
      attempts.push({ source, endpoint });
      return { ...result, attempts };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      attempts.push({ source, endpoint, error: message });
      console.warn(`⚠️ [ACTIVE STAKERS API] ${source} failed:`, message);
    }
  }

  throw new Error(`All active stakers sources failed: ${attempts.map((attempt) => `${attempt.source}: ${attempt.error || 'success'}`).join(' | ')}`);
}

export async function GET() {
  // Active stakers count should always use mainnet data since it represents Ethereum deposits
  const networkEnv = 'mainnet';

  console.log(`🎯 [SUBGRAPH API] Starting active stakers fetch for ${networkEnv}...`);

  try {
    const graphqlUrl = getGraphQLApiUrl(networkEnv);

    if (!graphqlUrl) {
      throw new Error(`GraphQL URL not configured for ${networkEnv}`);
    }

    console.log(`🔗 [SUBGRAPH API] Using primary GraphQL URL: ${graphqlUrl}`);

    const result = await fetchActiveStakersWithFallback(graphqlUrl);

    console.log(`📊 [SUBGRAPH API] Active depositors: ${result.count} unique addresses from ${result.totalEntries} total entries via ${result.source}`);

    const apiResponse = {
      success: true,
      active_stakers: result.count,
      network: 'mainnet', // Always mainnet since this represents Ethereum deposit pools
      timestamp: new Date().toISOString(),
      debug: {
        totalEntries: result.totalEntries,
        uniqueAddresses: result.count,
        source: result.source,
        endpoint: result.endpoint,
        attempts: result.attempts,
        graphqlUrl,
        revalidatedAt: new Date().toISOString(),
        note: 'Active stakers count always represents Ethereum mainnet deposits'
      }
    };

    console.log(`✅ [SUBGRAPH API] Sending response for ${networkEnv}:`, JSON.stringify(apiResponse, null, 2));
    return NextResponse.json(apiResponse);

  } catch (error) {
    console.error(`❌ [SUBGRAPH API ${networkEnv}] Error details:`);
    console.error('  - Error type:', typeof error);
    console.error('  - Error message:', error instanceof Error ? error.message : String(error));
    console.error('  - Error stack:', error instanceof Error ? error.stack : 'No stack available');

    const errorResponse = {
      success: false,
      active_stakers: 0,
      error: error instanceof Error ? error.message : 'Failed to fetch active stakers data',
      network: 'mainnet', // Always mainnet since this represents Ethereum deposit pools
      timestamp: new Date().toISOString(),
      debug: {
        errorType: typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        revalidatedAt: new Date().toISOString(),
        note: 'Active stakers count always represents Ethereum mainnet deposits'
      }
    };

    console.log(`💥 [SUBGRAPH API ${networkEnv}] Sending error response:`, JSON.stringify(errorResponse, null, 2));
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
