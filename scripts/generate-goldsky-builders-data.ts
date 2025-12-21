import * as fs from 'fs';
import * as path from 'path';
import { SUBGRAPH_ENDPOINTS } from '../app/config/subgraph-endpoints';
import {
  transformV1ToV4Response,
  CHAIN_IDS,
  V1BuildersResponse,
} from '../lib/utils/goldsky-v1-to-v4-adapter';

/**
 * GraphQL query to fetch all builders projects from Goldsky V1 subgraph
 * Based on main branch query structure but adapted for Goldsky's schema
 * Goldsky uses "builderSubnets" (not "buildersProjects") and returns flat array (not items wrapper)
 * Uses "first" parameter (not "limit") matching standard GraphQL pagination
 */
const BUILDERS_PROJECTS_QUERY = `
  query getAllBuilderSubnets(
    $first: Int = 1000
    $orderBy: String
    $orderDirection: String
  ) {
    builderSubnets(
      first: $first
      orderBy: $orderBy
      orderDirection: $orderDirection
    ) {
      id
      name
      admin
      minimalDeposit
      totalStaked
      totalUsers
      totalClaimed
      withdrawLockPeriodAfterDeposit
      slug
      description
      website
      image
    }
  }
`;

/**
 * Fetch data from a GraphQL endpoint
 */
async function fetchGraphQL<T>(
  endpoint: string,
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `GraphQL request failed: ${response.status} ${response.statusText}`
    );
  }

  const result = await response.json();

  if (result.errors) {
    throw new Error(
      `GraphQL errors: ${JSON.stringify(result.errors, null, 2)}`
    );
  }

  return result.data as T;
}

/**
 * Generate builders data for a specific network
 */
async function generateBuildersData(
  network: 'Base' | 'Arbitrum'
): Promise<void> {
  const endpoint =
    network === 'Base'
      ? SUBGRAPH_ENDPOINTS.GoldskyBase
      : SUBGRAPH_ENDPOINTS.GoldskyArbitrum;
  const chainId = CHAIN_IDS[network];

  console.log(`[${network}] Fetching data from Goldsky endpoint: ${endpoint}`);

  try {
    // Fetch V1 data
    const v1Response = await fetchGraphQL<V1BuildersResponse>(
      endpoint,
      BUILDERS_PROJECTS_QUERY
    );

    console.log(
      `[${network}] Fetched ${v1Response.builderSubnets.length} projects`
    );

    // Transform to V4 format
    const v4Response = transformV1ToV4Response(v1Response, chainId);

    // Add metadata
    const outputData = {
      ...v4Response,
      _metadata: {
        generatedAt: new Date().toISOString(),
        sourceEndpoint: endpoint,
        network,
        chainId,
        version: '1.0.0',
        projectCount: v4Response.buildersProjects.items.length,
      },
    };

    // Ensure public/data directory exists
    const outputDir = path.join(process.cwd(), 'public', 'data');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`Created directory: ${outputDir}`);
    }

    // Write to file
    const outputPath = path.join(
      outputDir,
      `goldsky-builders-${network.toLowerCase()}.json`
    );
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));

    console.log(
      `[${network}] Successfully wrote ${v4Response.buildersProjects.items.length} projects to ${outputPath}`
    );
  } catch (error) {
    console.error(`[${network}] Error generating builders data:`, error);
    throw error;
  }
}

/**
 * Main function to generate all builders data
 */
async function main(): Promise<void> {
  console.log('Starting Goldsky builders data generation...');
  console.log('This script fetches V1 data and transforms it to V4 format.\n');

  try {
    // Generate data for both networks in parallel
    await Promise.all([
      generateBuildersData('Base'),
      generateBuildersData('Arbitrum'),
    ]);

    console.log('\n✅ Successfully generated all builders data files!');
  } catch (error) {
    console.error('\n❌ Error generating builders data:', error);
    process.exit(1);
  }
}

// Run the script
main();
