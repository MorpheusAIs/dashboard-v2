import { NextResponse } from 'next/server';
import { SUBGRAPH_ENDPOINTS } from '@/app/config/subgraph-endpoints';
import {
  transformV1UserAdminSubnetsToV4,
  V1UserAdminSubnetsResponse,
  CHAIN_IDS,
} from '@/lib/utils/goldsky-v1-to-v4-adapter';

/**
 * API route to fetch subnets where a user is the admin from Goldsky
 * Used for the "Your Subnets" table
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

    // Get admin address from query params
    const url = new URL(request.url);
    const adminAddress = url.searchParams.get('adminAddress');
    
    if (!adminAddress) {
      return NextResponse.json(
        { error: 'adminAddress query parameter is required' },
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
    const formattedAddress = adminAddress.startsWith('0x') 
      ? adminAddress.toLowerCase() 
      : `0x${adminAddress.toLowerCase()}`;

    console.log(`[Goldsky API User Admin Subnets] Fetching for network: ${networkLower}, address: ${formattedAddress}`);

    // Goldsky query - uses builderSubnets filtered by admin
    // NOTE: Goldsky uses testnet-style schema names for mainnet:
    // - "builderSubnets" (not "buildersProjects")
    // - "builderUsers" (not "buildersUsers")
    // - "deposited" (not "staked")
    const query = `
      query GetUserAdminSubnets($adminAddress: Bytes!) {
        builderSubnets(
          first: 1000
          where: { admin: $adminAddress }
          orderBy: totalStaked
          orderDirection: desc
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

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: {
          adminAddress: formattedAddress,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Goldsky API User Admin Subnets] HTTP error: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (result.errors) {
      console.error('[Goldsky API User Admin Subnets] GraphQL errors:', JSON.stringify(result.errors, null, 2));
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors, null, 2)}`);
    }

    console.log(`[Goldsky API User Admin Subnets] Raw response data:`, JSON.stringify(result.data, null, 2));
    console.log(`[Goldsky API User Admin Subnets] Found ${result.data?.builderSubnets?.length || 0} builderSubnets`);

    // Transform Goldsky V1 response to V4 format
    const v1Response = result.data as V1UserAdminSubnetsResponse;
    const v4Response = transformV1UserAdminSubnetsToV4(v1Response, chainId);
    
    console.log(`[Goldsky API User Admin Subnets] Transformed to ${v4Response.buildersProjects.items.length} items`);

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
    console.error('[Goldsky API User Admin Subnets] Error fetching user admin subnets:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        buildersProjects: {
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
