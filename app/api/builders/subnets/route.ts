import { NextResponse } from 'next/server';
import { SUBGRAPH_ENDPOINTS } from '@/app/config/subgraph-endpoints';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Helper function to convert wei to MOR (18 decimals)
 */
function weiToMor(weiAmount: string): number {
  try {
    const wei = BigInt(weiAmount || '0');
    // Convert to number with 2 decimal places precision
    return Number(wei) / 1e18;
  } catch {
    return 0;
  }
}

/**
 * Public API endpoint to fetch all subnets on BASE network with staked amounts
 *
 * GET /api/builders/subnets
 *
 * Returns:
 * - List of all subnets with their staked amounts
 * - Total staked across all subnets
 * - Total number of stakers across all subnets
 *
 * Example usage:
 *   curl https://dashboard.mor.org/api/builders/subnets
 */
export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    const endpoint = SUBGRAPH_ENDPOINTS.GoldskyBaseV4;

    console.log(`[Subnets API] Fetching all subnets from BASE mainnet`);

    // Query all builders projects (subnets) from Goldsky V4
    const query = `
      query GetAllSubnets {
        buildersProjects(
          first: 1000
          orderBy: totalStaked
          orderDirection: desc
        ) {
          id
          name
          admin
          totalStaked
          totalUsers
          minimalDeposit
          startsAt
        }
      }
    `;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Subnets API] HTTP error: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (result.errors) {
      console.error('[Subnets API] GraphQL errors:', JSON.stringify(result.errors, null, 2));
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    if (!result.data) {
      console.error('[Subnets API] No data field in response:', JSON.stringify(result, null, 2));
      throw new Error('GraphQL response missing data field');
    }

    const buildersProjects = result.data?.buildersProjects || [];
    console.log(`[Subnets API] Found ${buildersProjects.length} subnets`);

    // Transform and calculate totals
    let totalStakedWei = BigInt(0);
    let totalStakers = 0;

    const subnets = buildersProjects.map((project: {
      id: string;
      name: string;
      admin: string;
      totalStaked: string;
      totalUsers: string;
      minimalDeposit: string;
      startsAt: string;
    }) => {
      const stakedWei = BigInt(project.totalStaked || '0');
      const users = parseInt(project.totalUsers || '0', 10);

      totalStakedWei += stakedWei;
      totalStakers += users;

      return {
        id: project.id,
        name: project.name,
        admin: project.admin,
        totalStaked: project.totalStaked,
        totalStakedFormatted: weiToMor(project.totalStaked),
        totalUsers: users,
        minimalDeposit: project.minimalDeposit,
        minimalDepositFormatted: weiToMor(project.minimalDeposit),
        startsAt: project.startsAt,
      };
    });

    const responseData = {
      success: true,
      network: 'base',
      timestamp,
      data: {
        subnets,
        totals: {
          totalSubnets: subnets.length,
          totalStaked: totalStakedWei.toString(),
          totalStakedFormatted: Number(totalStakedWei) / 1e18,
          totalStakers,
        },
      },
    };

    console.log(`[Subnets API] Returning ${subnets.length} subnets, total staked: ${responseData.data.totals.totalStakedFormatted.toFixed(2)} MOR`);

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
    console.error('[Subnets API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        network: 'base',
        timestamp,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        data: {
          subnets: [],
          totals: {
            totalSubnets: 0,
            totalStaked: '0',
            totalStakedFormatted: 0,
            totalStakers: 0,
          },
        },
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
