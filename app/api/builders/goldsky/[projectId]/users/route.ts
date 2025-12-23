import { NextResponse } from 'next/server';
import { SUBGRAPH_ENDPOINTS } from '@/app/config/subgraph-endpoints';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * API route to fetch users for a specific builder project from Goldsky V4
 * Queries Goldsky V4 directly for user data with pagination support
 */
export async function GET(
  request: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params;
    
    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Determine network from query param
    const url = new URL(request.url);
    const network = url.searchParams.get('network') || 'base';
    const networkLower = network.toLowerCase();
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    
    // Get the appropriate Goldsky V4 endpoint
    const endpoint = networkLower === 'arbitrum' 
      ? SUBGRAPH_ENDPOINTS.GoldskyArbitrumV4
      : SUBGRAPH_ENDPOINTS.GoldskyBaseV4;

    console.log(`[Goldsky V4 API Users] Fetching users for project ${projectId} on ${networkLower}, limit=${limit}, skip=${offset}`);

    // V4 query - uses buildersProject (mainnet schema)
    // V4 uses "staked" not "deposited", and has "lastStake"
    const query = `
      query GetBuilderUsers($projectId: Bytes!, $first: Int!, $skip: Int!) {
        buildersUsers(
          first: $first
          skip: $skip
          where: { buildersProject_: { id: $projectId } }
          orderBy: staked
          orderDirection: desc
        ) {
          id
          address
          staked
          lastStake
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
        variables: {
          projectId: projectId,
          first: limit,
          skip: offset,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (result.errors) {
      console.error('[Goldsky V4 API Users] GraphQL errors:', result.errors);
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors, null, 2)}`);
    }

    // V4 response already has correct field names (staked, lastStake)
    const users = result.data?.buildersUsers || [];

    console.log(`[Goldsky V4 API Users] Found ${users.length} users`);

    // Get total count for pagination - query first 1000 to get count
    const countQuery = `
      query GetBuilderUsersCount($projectId: Bytes!) {
        buildersUsers(
          first: 1000
          where: { buildersProject_: { id: $projectId } }
        ) {
          id
        }
      }
    `;

    const countResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: countQuery,
        variables: {
          projectId: projectId,
        },
      }),
    });

    const countResult = await countResponse.json();
    const totalCount = countResult.data?.buildersUsers?.length || 0;
    
    console.log(`[Goldsky V4 API Users] Total count: ${totalCount}`);

    return NextResponse.json(
      {
        buildersUsers: users,
        totalCount: totalCount,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('[Goldsky V4 API Users] Error fetching users:', error);
    return NextResponse.json(
      {
        buildersUsers: [],
        totalCount: 0,
        error: 'Failed to load users data',
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-cache',
        },
      }
    );
  }
}
