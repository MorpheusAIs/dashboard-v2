import { NextResponse } from 'next/server';
import { SUBGRAPH_ENDPOINTS } from '@/app/config/subgraph-endpoints';
import {
  transformV1UserStakedBuildersToV4,
  V1UserStakedBuildersResponse,
  CHAIN_IDS,
} from '@/lib/utils/goldsky-v1-to-v4-adapter';

/**
 * API route to fetch builders where a user has staked from Goldsky
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
    
    // Get the appropriate Goldsky endpoint
    const endpoint = networkLower === 'arbitrum' 
      ? SUBGRAPH_ENDPOINTS.GoldskyArbitrum
      : SUBGRAPH_ENDPOINTS.GoldskyBase;
    
    const chainId = networkLower === 'arbitrum' 
      ? CHAIN_IDS.Arbitrum
      : CHAIN_IDS.Base;

    // Format address for Goldsky Bytes type - ensure it has 0x prefix and is lowercase
    const formattedAddress = userAddress.startsWith('0x') 
      ? userAddress.toLowerCase() 
      : `0x${userAddress.toLowerCase()}`;

    console.log(`[Goldsky API User Staked Builders] Fetching for network: ${networkLower}, address: ${formattedAddress}`);

    // Goldsky query - uses builderUsers with builderSubnet relation
    // NOTE: Goldsky uses testnet-style schema names for mainnet:
    // - "builderUsers" (not "buildersUsers")
    // - "builderSubnet" (not "buildersProject")
    // - "deposited" (not "staked")
    const query = `
      query GetUserStakedBuilders($userAddress: Bytes!) {
        builderUsers(
          first: 1000
          where: { address: $userAddress, deposited_gt: "0" }
          orderBy: deposited
          orderDirection: desc
        ) {
          id
          address
          deposited
          builderSubnet {
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

    console.log(`[Goldsky API User Staked Builders] Raw response data:`, JSON.stringify(result.data, null, 2));
    console.log(`[Goldsky API User Staked Builders] Found ${result.data?.builderUsers?.length || 0} builderUsers`);

    // Transform Goldsky V1 response to V4 format
    const v1Response = result.data as V1UserStakedBuildersResponse;
    const v4Response = transformV1UserStakedBuildersToV4(v1Response, chainId);
    
    console.log(`[Goldsky API User Staked Builders] Transformed to ${v4Response.buildersUsers.items.length} items`);

    return NextResponse.json(
      v4Response,
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('[Goldsky API User Staked Builders] Error fetching user staked builders:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        buildersUsers: {
          items: [],
          totalCount: 0,
        },
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
