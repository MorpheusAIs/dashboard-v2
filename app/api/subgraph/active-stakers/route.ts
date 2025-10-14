import { NextRequest, NextResponse } from 'next/server';
import { getGraphQLApiUrl } from '@/config/networks';
import { fetchGraphQL } from '@/app/graphql/client';

// ISR configuration - revalidate every hour (3600 seconds)
export const revalidate = 3600; // 1 hour = 60 minutes * 60 seconds

const GET_ACTIVE_STAKERS_QUERY = `
  query GetActiveStakersCount {
    users(where: { staked_gt: "0" }, first: 1000) {
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(request: NextRequest) {
  // Active stakers count should always use mainnet data since it represents Ethereum deposits
  const networkEnv = 'mainnet';

  console.log(`🎯 [SUBGRAPH API] Starting active stakers fetch for ${networkEnv}...`);

  try {
    const graphqlUrl = getGraphQLApiUrl(networkEnv);

    if (!graphqlUrl) {
      throw new Error(`GraphQL URL not configured for ${networkEnv}`);
    }

    console.log(`🔗 [SUBGRAPH API] Using GraphQL URL: ${graphqlUrl}`);

    // Fetch data from subgraph
    console.log('⏳ [SUBGRAPH API] Calling subgraph...');
    const result = await fetchGraphQL<SubgraphResponse>(
      graphqlUrl,
      'GetActiveStakersCount',
      GET_ACTIVE_STAKERS_QUERY
    );

    if (result.errors && result.errors.length > 0) {
      throw new Error(result.errors[0].message);
    }

    if (!result.data?.users) {
      throw new Error('No data returned from subgraph');
    }

    // Deduplicate addresses and count unique users
    const uniqueAddresses = new Set<string>();

    result.data.users.forEach((user: User) => {
      // Add each address to the Set (automatically handles duplicates)
      uniqueAddresses.add(user.address.toLowerCase());
    });

    // Count the unique addresses
    const activeStakersCount = uniqueAddresses.size;

    console.log(`📊 [SUBGRAPH API] Active depositors: ${activeStakersCount} unique addresses from ${result.data.users.length} total entries`);

    const apiResponse = {
      success: true,
      active_stakers: activeStakersCount,
      network: 'mainnet', // Always mainnet since this represents Ethereum deposit pools
      timestamp: new Date().toISOString(),
      debug: {
        totalEntries: result.data.users.length,
        uniqueAddresses: activeStakersCount,
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
