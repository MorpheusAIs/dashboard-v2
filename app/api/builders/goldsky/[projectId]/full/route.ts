import { NextRequest, NextResponse } from 'next/server';
import { SUBGRAPH_ENDPOINTS } from '@/app/config/subgraph-endpoints';
import { createClient } from '@supabase/supabase-js';
import { BuilderDB } from '@/app/lib/supabase';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Create service client for server-side operations
const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * Comprehensive GET endpoint for individual subnet data
 * Returns:
 * - Subnet metadata (title, description, links, metrics)
 * - Full list of active stakers with all data (amounts, dates, etc.)
 *
 * GET /api/builders/goldsky/[projectId]/full?network=base&limit=50&skip=0
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Determine network and pagination from query params
    const url = new URL(request.url);
    const network = url.searchParams.get('network') || 'base';
    const networkLower = network.toLowerCase();
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const skip = parseInt(url.searchParams.get('skip') || '0', 10);

    // Get the appropriate Goldsky V4 endpoint
    const endpoint = networkLower === 'arbitrum'
      ? SUBGRAPH_ENDPOINTS.GoldskyArbitrumV4
      : SUBGRAPH_ENDPOINTS.GoldskyBaseV4;

    console.log(`[Subnet Full Data] Fetching full data for project ${projectId} on ${networkLower}`);

    // ============================================================================
    // STEP 1: Fetch project on-chain data from Goldsky V4
    // ============================================================================
    const projectQuery = `
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

    const projectResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: projectQuery,
        variables: { projectId },
      }),
    });

    if (!projectResponse.ok) {
      const errorText = await projectResponse.text();
      console.error(`[Subnet Full Data] HTTP error fetching project: ${projectResponse.status}`, errorText);
      throw new Error(`GraphQL request failed: ${projectResponse.status}`);
    }

    const projectResult = await projectResponse.json();

    if (projectResult.errors) {
      console.error('[Subnet Full Data] GraphQL errors:', JSON.stringify(projectResult.errors, null, 2));
      throw new Error(`GraphQL errors: ${JSON.stringify(projectResult.errors)}`);
    }

    if (!projectResult.data) {
      throw new Error('GraphQL response missing data field');
    }

    const projects = projectResult.data?.buildersProjects || [];
    const project = projects.length > 0 ? projects[0] : null;

    if (!project) {
      console.log(`[Subnet Full Data] Project not found: ${projectId}`);
      return NextResponse.json(
        {
          success: false,
          error: 'Project not found',
          data: null,
        },
        {
          status: 404,
          headers: {
            'Cache-Control': 'private, no-cache, no-store, must-revalidate',
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // ============================================================================
    // STEP 2: Fetch project metadata from Supabase (enrichment data)
    // ============================================================================
    let metadata = null;
    try {
      const { data: supabaseProject, error: supabaseError } = await supabaseService
        .from('builders')
        .select('*')
        .eq('id', project.id)
        .single();

      if (supabaseError) {
        console.warn('[Subnet Full Data] Supabase error:', supabaseError.message);
        // Continue without metadata - not a fatal error
      } else if (supabaseProject) {
        console.log('[Subnet Full Data] Found Supabase metadata for:', supabaseProject.name);
        metadata = {
          id: supabaseProject.id,
          name: supabaseProject.name,
          description: supabaseProject.description,
          longDescription: supabaseProject.long_description,
          imageSrc: supabaseProject.image_src,
          website: supabaseProject.website,
          tags: supabaseProject.tags,
          githubUrl: supabaseProject.github_url,
          twitterUrl: supabaseProject.twitter_url,
          discordUrl: supabaseProject.discord_url,
          contributors: supabaseProject.contributors,
          githubStars: supabaseProject.github_stars,
          rewardTypes: supabaseProject.reward_types,
          rewardTypesDetail: supabaseProject.reward_types_detail,
          networks: supabaseProject.networks,
          createdAt: supabaseProject.created_at,
          updatedAt: supabaseProject.updated_at,
        };
      }
    } catch (error) {
      console.warn('[Subnet Full Data] Error fetching Supabase metadata:', error);
      // Continue without metadata - not a fatal error
    }

    // ============================================================================
    // STEP 3: Fetch stakers data with pagination
    // ============================================================================
    const stakersQuery = `
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
          buildersProject {
            id
            name
          }
          __typename
        }
      }
    `;

    const stakersResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: stakersQuery,
        variables: { projectId, first: limit, skip },
      }),
    });

    if (!stakersResponse.ok) {
      const errorText = await stakersResponse.text();
      console.error(`[Subnet Full Data] HTTP error fetching stakers: ${stakersResponse.status}`, errorText);
      throw new Error(`GraphQL request failed: ${stakersResponse.status}`);
    }

    const stakersResult = await stakersResponse.json();

    if (stakersResult.errors) {
      console.error('[Subnet Full Data] GraphQL errors fetching stakers:', JSON.stringify(stakersResult.errors, null, 2));
      throw new Error(`GraphQL errors: ${JSON.stringify(stakersResult.errors)}`);
    }

    if (!stakersResult.data) {
      throw new Error('GraphQL response missing data field');
    }

    const stakers = stakersResult.data?.buildersUsers || [];

    // ============================================================================
    // STEP 4: Get total stakers count for pagination
    // ============================================================================
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
        variables: { projectId },
      }),
    });

    let totalStakers = 0;
    if (countResponse.ok) {
      const countResult = await countResponse.json();
      if (!countResult.errors) {
        totalStakers = countResult.data?.buildersUsers?.length || 0;
      }
    }

    // ============================================================================
    // STEP 5: Build comprehensive response
    // ============================================================================
    const responseData = {
      // On-chain data from Goldsky
      project: {
        id: project.id,
        name: project.name,
        admin: project.admin,
        totalStaked: project.totalStaked,
        totalUsers: project.totalUsers,
        totalClaimed: project.totalClaimed,
        minimalDeposit: project.minimalDeposit,
        withdrawLockPeriodAfterDeposit: project.withdrawLockPeriodAfterDeposit,
        startsAt: project.startsAt,
        claimLockEnd: project.claimLockEnd,
      },

      // Enrichment data from Supabase
      metadata: metadata,

      // Stakers data with pagination
      stakers: stakers.map((staker) => ({
        id: staker.id,
        address: staker.address,
        staked: staker.staked,
        lastStake: staker.lastStake,
        projectName: staker.buildersProject?.name || null,
      })),

      // Pagination info
      pagination: {
        totalCount: totalStakers,
        limit,
        skip,
        hasMore: (skip + limit) < totalStakers,
      },

      // Query parameters used
      queryParams: {
        network,
        limit,
        skip,
      },
    };

    console.log(`[Subnet Full Data] Returning ${stakers.length} stakers for project ${project.name}`);
    console.log(`[Subnet Full Data] Total stakers: ${totalStakers}`);
    console.log(`[Subnet Full Data] Has metadata: ${!!metadata}`);

    return NextResponse.json(
      {
        success: true,
        data: responseData,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );

  } catch (error) {
    console.error('[Subnet Full Data] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load subnet data',
        data: null,
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-cache',
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  }
}
