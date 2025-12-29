import { NextResponse } from 'next/server';
import { SUBGRAPH_ENDPOINTS } from '@/app/config/subgraph-endpoints';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * API route to fetch individual builder project data from Goldsky V4
 * Queries Goldsky V4 endpoint directly for real-time data
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
    
    // Get the appropriate Goldsky V4 endpoint
    const endpoint = networkLower === 'arbitrum' 
      ? SUBGRAPH_ENDPOINTS.GoldskyArbitrumV4
      : SUBGRAPH_ENDPOINTS.GoldskyBaseV4;

    console.log(`[Goldsky V4 API Project] Fetching project ${projectId} from ${networkLower}`);

    // V4 query - fetch single project by ID
    const query = `
      query GetProjectDetails($projectId: Bytes!) {
        buildersProjects(
          where: { id: $projectId }
          first: 1
        ) {
          id
          name
          admin
          totalStaked
          totalUsers
          totalClaimed
          minimalDeposit
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
          projectId: projectId,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Goldsky V4 API Project] HTTP error: ${response.status} ${response.statusText}`, errorText);
      console.error(`[Goldsky V4 API Project] Endpoint: ${endpoint}`);
      console.error(`[Goldsky V4 API Project] Query: ${query}`);
      console.error(`[Goldsky V4 API Project] Variables:`, { projectId });
      throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}. Response: ${errorText}`);
    }

    const result = await response.json();

    if (result.errors) {
      console.error('[Goldsky V4 API Project] GraphQL errors:', JSON.stringify(result.errors, null, 2));
      console.error(`[Goldsky V4 API Project] Endpoint: ${endpoint}`);
      console.error(`[Goldsky V4 API Project] Query: ${query}`);
      console.error(`[Goldsky V4 API Project] Variables:`, { projectId });
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors, null, 2)}`);
    }

    // Check if data is missing or malformed
    if (!result.data) {
      console.error('[Goldsky V4 API Project] No data field in response:', JSON.stringify(result, null, 2));
      throw new Error('GraphQL response missing data field');
    }

    // V4 returns buildersProjects as array
    const projects = result.data?.buildersProjects || [];
    const project = projects.length > 0 ? projects[0] : null;

    if (!project) {
      console.log(`[Goldsky V4 API Project] Project not found: ${projectId}`);
      return NextResponse.json(
        {
          buildersProject: null,
        },
        {
          status: 404,
          headers: {
            'Cache-Control': 'private, no-cache, no-store, must-revalidate',
          },
        }
      );
    }

    console.log(`[Goldsky V4 API Project] Found project: ${project.name}`);

    // Return project in V4 format (matching expected structure)
    // Note: Users are fetched separately via the /users endpoint
    return NextResponse.json(
      {
        buildersProject: {
          ...project,
          users: {
            items: [],
            totalCount: parseInt(project.totalUsers || '0', 10),
          },
        },
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
    console.error('[Goldsky V4 API Project] Error fetching project:', error);
    return NextResponse.json(
      {
        buildersProject: null,
        error: 'Failed to load project data',
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
