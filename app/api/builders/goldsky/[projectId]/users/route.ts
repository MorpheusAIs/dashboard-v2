import { NextResponse } from 'next/server';
import { SUBGRAPH_ENDPOINTS } from '@/app/config/subgraph-endpoints';

/**
 * API route to fetch users for a specific builder project from Goldsky
 * Queries Goldsky directly for user data (since user data changes frequently)
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
    
    // Get the appropriate Goldsky endpoint
    const endpoint = networkLower === 'arbitrum' 
      ? SUBGRAPH_ENDPOINTS.GoldskyArbitrum
      : SUBGRAPH_ENDPOINTS.GoldskyBase;

    // Goldsky query - uses builderSubnet instead of buildersProject
    // Note: Goldsky uses "deposited" instead of "staked"
    const query = `
      query GetBuilderUsers($subnetId: Bytes!, $first: Int!, $skip: Int!) {
        builderUsers(
          first: $first
          skip: $skip
          where: { builderSubnet_: { id: $subnetId } }
          orderBy: deposited
          orderDirection: desc
        ) {
          id
          address
          deposited
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
          subnetId: projectId,
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
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors, null, 2)}`);
    }

    // Transform Goldsky response to V4 format
    // Goldsky uses "deposited" instead of "staked", and doesn't have "lastStake"
    const users = (result.data?.builderUsers || []).map((user: {
      id: string;
      address: string;
      deposited: string;
    }) => ({
      id: user.id,
      address: user.address,
      staked: user.deposited, // Map deposited -> staked
      lastStake: '0', // Goldsky doesn't have this field
    }));

    // Get total count - we need to query separately since Goldsky doesn't return totalCount
    const countQuery = `
      query GetBuilderUsersCount($subnetId: Bytes!) {
        builderUsers(
          first: 1000
          where: { builderSubnet_: { id: $subnetId } }
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
          subnetId: projectId,
        },
      }),
    });

    const countResult = await countResponse.json();
    const totalCount = countResult.data?.builderUsers?.length || 0;

    return NextResponse.json(
      {
        buildersUsers: {
          items: users,
          totalCount,
        },
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
    console.error('[Goldsky API Users] Error fetching users:', error);
    return NextResponse.json(
      {
        buildersUsers: {
          items: [],
          totalCount: 0,
        },
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
