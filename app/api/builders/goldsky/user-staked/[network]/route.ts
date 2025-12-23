import { NextResponse } from 'next/server';
import { SUBGRAPH_ENDPOINTS } from '@/app/config/subgraph-endpoints';
import { CHAIN_IDS } from '@/lib/utils/goldsky-v4-adapter';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * API route to fetch builders where a user has staked from Goldsky V4
 * Used for the "Staking in" table
 */
export async function GET(
  request: Request,
  { params }: { params: { network: string } }
) {
  try {
    const { network } = params;
    
    if (!network) {
      return NextResponse.json(
        { error: 'Network is required' },
        { status: 400 }
      );
    }

    // Get user address from query params
    const url = new URL(request.url);
    const userAddress = url.searchParams.get('userAddress');
    
    if (!userAddress) {
      return NextResponse.json(
        { error: 'userAddress query parameter is required' },
        { status: 400 }
      );
    }

    const networkLower = network.toLowerCase();
    
    // Get the appropriate Goldsky V4 endpoint
    const endpoint = networkLower === 'arbitrum' 
      ? SUBGRAPH_ENDPOINTS.GoldskyArbitrumV4
      : SUBGRAPH_ENDPOINTS.GoldskyBaseV4;
    
    const chainId = networkLower === 'arbitrum' 
      ? CHAIN_IDS.Arbitrum
      : CHAIN_IDS.Base;

    // Format address for Goldsky Bytes type - ensure it has 0x prefix and is lowercase
    const formattedAddress = userAddress.startsWith('0x') 
      ? userAddress.toLowerCase() 
      : `0x${userAddress.toLowerCase()}`;

    console.log(`[Goldsky V4 API User Staked Builders] Fetching for network: ${networkLower}, address: ${formattedAddress}`);

    // V4 query - uses buildersUsers with buildersProject relation
    // V4 uses standard mainnet schema:
    // - "buildersUsers" (mainnet style)
    // - "buildersProject" (mainnet style)
    // - "staked" (not "deposited")
    // - NO "claimed" or "claimLockEnd" on BuildersUser
    const query = `
      query GetUserStakedBuilders($userAddress: Bytes!) {
        buildersUsers(
          first: 1000
          where: { address: $userAddress, staked_gt: "0" }
          orderBy: staked
          orderDirection: desc
        ) {
          id
          address
          staked
          lastStake
          buildersProject {
            id
            name
            admin
            minimalDeposit
            totalStaked
            totalUsers
            totalClaimed
            withdrawLockPeriodAfterDeposit
            startsAt
            claimLockEnd
          }
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
          userAddress: formattedAddress,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Goldsky API User Staked Builders] HTTP error: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (result.errors) {
      console.error('[Goldsky API User Staked Builders] GraphQL errors:', JSON.stringify(result.errors, null, 2));
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors, null, 2)}`);
    }

    console.log(`[Goldsky V4 API User Staked Builders] Raw response data:`, JSON.stringify(result.data, null, 2));
    console.log(`[Goldsky V4 API User Staked Builders] Found ${result.data?.buildersUsers?.length || 0} buildersUsers`);

    // V4 response is already in the correct format - just add network metadata
    const buildersUsers = result.data?.buildersUsers || [];
    const networkName = networkLower === 'arbitrum' ? 'Arbitrum' : 'Base';
    
    // Add network and chainId to each user's project
    const enrichedUsers = buildersUsers.map((user: { buildersProject: { id: string; name: string; admin: string; minimalDeposit: string; totalStaked: string; totalUsers: string; totalClaimed: string; withdrawLockPeriodAfterDeposit: string; startsAt: string; claimLockEnd: string; }; id: string; address: string; staked: string; lastStake: string; }) => ({
      ...user,
      buildersProject: user.buildersProject ? {
        ...user.buildersProject,
        network: networkName,
        chainId: chainId,
      } : undefined,
    }));
    
    console.log(`[Goldsky V4 API User Staked Builders] Returning ${enrichedUsers.length} items`);

    return NextResponse.json(
      {
        buildersUsers: enrichedUsers,
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
    console.error('[Goldsky V4 API User Staked Builders] Error fetching user staked builders:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        buildersUsers: [],
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

