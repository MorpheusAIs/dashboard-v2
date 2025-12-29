import { NextResponse, type NextRequest } from 'next/server';
import { SUBGRAPH_ENDPOINTS } from '@/app/config/subgraph-endpoints';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Maximum allowed limit per request
const MAX_LIMIT = 1000;
const DEFAULT_LIMIT = 100;

/**
 * Helper function to convert wei to MOR (18 decimals)
 */
function weiToMor(weiAmount: string): number {
  try {
    const wei = BigInt(weiAmount || '0');
    return Number(wei) / 1e18;
  } catch {
    return 0;
  }
}

/**
 * Helper function to convert Unix timestamp to ISO date string
 */
function timestampToIso(timestamp: string): string | null {
  try {
    const ts = parseInt(timestamp, 10);
    if (isNaN(ts) || ts === 0) return null;
    return new Date(ts * 1000).toISOString();
  } catch {
    return null;
  }
}

/**
 * Public API endpoint to fetch all stakers for a specific subnet on BASE network
 *
 * GET /api/builders/stakers?subnet_id=<subnet_id>&limit=<limit>&offset=<offset>
 *
 * Query Parameters:
 * - subnet_id (required): The subnet/project ID (address)
 * - limit (optional): Number of results per page (default: 100, max: 1000)
 * - offset (optional): Pagination offset (default: 0)
 *
 * Returns:
 * - List of active stakers (staked > 0) for the subnet
 * - Total staked amount for the subnet
 * - Pagination information
 *
 * Example usage:
 *   curl "https://dashboard.mor.org/api/builders/stakers?subnet_id=0x..."
 *   curl "https://dashboard.mor.org/api/builders/stakers?subnet_id=0x...&limit=50&offset=100"
 */
export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();

  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const subnetId = searchParams.get('subnet_id');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    // Validate required subnet_id parameter
    if (!subnetId) {
      return NextResponse.json(
        {
          success: false,
          network: 'base',
          timestamp,
          error: 'Missing required parameter: subnet_id',
          data: null,
        },
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        }
      );
    }

    // Parse and validate pagination parameters
    let limit = limitParam ? parseInt(limitParam, 10) : DEFAULT_LIMIT;
    let offset = offsetParam ? parseInt(offsetParam, 10) : 0;

    // Enforce limits
    if (isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;
    if (isNaN(offset) || offset < 0) offset = 0;

    const endpoint = SUBGRAPH_ENDPOINTS.GoldskyBaseV4;

    console.log(`[Stakers API] Fetching stakers for subnet ${subnetId}, limit=${limit}, offset=${offset}`);

    // Query stakers with pagination - only active stakers (staked > 0)
    const stakersQuery = `
      query GetSubnetStakers($subnetId: Bytes!, $first: Int!, $skip: Int!) {
        buildersUsers(
          first: $first
          skip: $skip
          where: { buildersProject_: { id: $subnetId }, staked_gt: "0" }
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

    // Query total count of active stakers for pagination
    const countQuery = `
      query GetSubnetStakersCount($subnetId: Bytes!) {
        buildersUsers(
          first: 1000
          where: { buildersProject_: { id: $subnetId }, staked_gt: "0" }
        ) {
          id
          staked
        }
      }
    `;

    // Execute both queries in parallel
    const [stakersResponse, countResponse] = await Promise.all([
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: stakersQuery,
          variables: { subnetId, first: limit, skip: offset },
        }),
      }),
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: countQuery,
          variables: { subnetId },
        }),
      }),
    ]);

    if (!stakersResponse.ok) {
      const errorText = await stakersResponse.text();
      console.error(`[Stakers API] HTTP error: ${stakersResponse.status}`, errorText);
      throw new Error(`GraphQL request failed: ${stakersResponse.status}`);
    }

    const stakersResult = await stakersResponse.json();

    if (stakersResult.errors) {
      console.error('[Stakers API] GraphQL errors:', JSON.stringify(stakersResult.errors, null, 2));
      throw new Error(`GraphQL errors: ${JSON.stringify(stakersResult.errors)}`);
    }

    if (!stakersResult.data) {
      console.error('[Stakers API] No data in response');
      throw new Error('GraphQL response missing data field');
    }

    const buildersUsers = stakersResult.data?.buildersUsers || [];

    // Process count response for pagination and totals
    let totalCount = buildersUsers.length;
    let totalStakedWei = BigInt(0);

    if (countResponse.ok) {
      const countResult = await countResponse.json();
      if (countResult.data?.buildersUsers) {
        totalCount = countResult.data.buildersUsers.length;
        // Calculate total staked from all users
        for (const user of countResult.data.buildersUsers) {
          totalStakedWei += BigInt(user.staked || '0');
        }
      }
    }

    console.log(`[Stakers API] Found ${buildersUsers.length} stakers (page), ${totalCount} total for subnet ${subnetId}`);

    // Transform staker data
    const stakers = buildersUsers.map((user: {
      id: string;
      address: string;
      staked: string;
      lastStake: string;
    }) => ({
      address: user.address,
      staked: user.staked,
      stakedFormatted: weiToMor(user.staked),
      lastStake: user.lastStake,
      lastStakeDate: timestampToIso(user.lastStake),
    }));

    const responseData = {
      success: true,
      network: 'base',
      timestamp,
      subnetId,
      pagination: {
        limit,
        offset,
        total: totalCount,
        hasMore: offset + stakers.length < totalCount,
      },
      data: {
        stakers,
        totals: {
          totalStakers: totalCount,
          totalStaked: totalStakedWei.toString(),
          totalStakedFormatted: Number(totalStakedWei) / 1e18,
        },
      },
    };

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('[Stakers API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        network: 'base',
        timestamp,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        data: null,
      },
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  }
}
