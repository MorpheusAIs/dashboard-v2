import { NextResponse } from 'next/server';
import { SUBGRAPH_ENDPOINTS } from '@/app/config/subgraph-endpoints';
import { CHAIN_IDS } from '@/lib/utils/goldsky-v4-adapter';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * API route to fetch subnets where a user is the admin from Goldsky V4
 * Used for the "Your Subnets" table
 */
export async function GET(request: Request, props: { params: Promise<{ network: string }> }) {
  const params = await props.params;
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
    
    // Get the appropriate Goldsky V4 endpoint
    const endpoint = networkLower === 'arbitrum' 
      ? SUBGRAPH_ENDPOINTS.GoldskyArbitrumV4
      : SUBGRAPH_ENDPOINTS.GoldskyBaseV4;
    
    const chainId = networkLower === 'arbitrum' 
      ? CHAIN_IDS.Arbitrum
      : CHAIN_IDS.Base;

    // Format address for Goldsky Bytes type - ensure it has 0x prefix and is lowercase
    const formattedAddress = adminAddress.startsWith('0x') 
      ? adminAddress.toLowerCase() 
      : `0x${adminAddress.toLowerCase()}`;

    console.log(`[Goldsky V4 API User Admin Subnets] Fetching for network: ${networkLower}, address: ${formattedAddress}`);

    // V4 query - uses buildersProjects filtered by admin
    // V4 uses standard mainnet schema (buildersProjects, not builderSubnets)
    const query = `
      query GetUserAdminSubnets($adminAddress: Bytes!) {
        buildersProjects(
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
          startsAt
          claimLockEnd
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

    console.log(`[Goldsky V4 API User Admin Subnets] Raw response data:`, JSON.stringify(result.data, null, 2));
    console.log(`[Goldsky V4 API User Admin Subnets] Found ${result.data?.buildersProjects?.length || 0} buildersProjects`);

    // V4 response is already in the correct format - just add network metadata
    const buildersProjects = result.data?.buildersProjects || [];
    const networkName = networkLower === 'arbitrum' ? 'Arbitrum' : 'Base';
    
    // Add network and chainId to each project
    const enrichedProjects = buildersProjects.map((project: { id: string; name: string; admin: string; minimalDeposit: string; totalStaked: string; totalUsers: string; totalClaimed: string; withdrawLockPeriodAfterDeposit: string; startsAt: string; claimLockEnd: string; }) => ({
      ...project,
      network: networkName,
      chainId: chainId,
    }));
    
    console.log(`[Goldsky V4 API User Admin Subnets] Returning ${enrichedProjects.length} items`);

    return NextResponse.json(
      {
        buildersProjects: enrichedProjects,
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
    console.error('[Goldsky V4 API User Admin Subnets] Error fetching user admin subnets:', error);
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

