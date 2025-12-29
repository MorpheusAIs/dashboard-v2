import { NextResponse } from 'next/server';
import { SUBGRAPH_ENDPOINTS } from '@/app/config/subgraph-endpoints';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * API route to fetch builders projects from Goldsky V4 for Base network
 * Queries Goldsky V4 directly for real-time data
 */
export async function GET() {
  try {
    const endpoint = SUBGRAPH_ENDPOINTS.GoldskyBaseV4;
    
    console.log(`[Goldsky V4 API Base] Fetching builders projects from ${endpoint}`);

    // V4 query - fetch all builders projects
    const query = `
      query combinedBuildersProjectsBaseMainnet {
        buildersProjects(
          first: 1000
          orderBy: totalStaked
          orderDirection: desc
        ) {
          id
          name
          admin
          totalStaked
          totalClaimed
          totalUsers
          minimalDeposit
          withdrawLockPeriodAfterDeposit
          startsAt
          claimLockEnd
          __typename
        }
      }
    `;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
      }),
      cache: 'no-store', // Disable Next.js fetch caching to always get fresh data
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Goldsky V4 API Base] HTTP error: ${response.status} ${response.statusText}`, errorText);
      console.error(`[Goldsky V4 API Base] Endpoint: ${endpoint}`);
      console.error(`[Goldsky V4 API Base] Query: ${query}`);
      throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}. Response: ${errorText}`);
    }

    const result = await response.json();

    if (result.errors) {
      console.error('[Goldsky V4 API Base] GraphQL errors:', JSON.stringify(result.errors, null, 2));
      console.error(`[Goldsky V4 API Base] Endpoint: ${endpoint}`);
      console.error(`[Goldsky V4 API Base] Query: ${query}`);
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors, null, 2)}`);
    }

    // Check if data is missing or malformed
    if (!result.data) {
      console.error('[Goldsky V4 API Base] No data field in response:', JSON.stringify(result, null, 2));
      throw new Error('GraphQL response missing data field');
    }

    // V4 returns buildersProjects as direct array
    const buildersProjects = result.data?.buildersProjects || [];
    console.log(`[Goldsky V4 API Base] Found ${buildersProjects.length} builders projects`);

    return NextResponse.json(
      {
        buildersProjects,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('[Goldsky V4 API Base] Error fetching builders projects:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        buildersProjects: [],
      },
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}
