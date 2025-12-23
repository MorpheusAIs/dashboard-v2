import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { V4BuildersResponse } from '@/lib/utils/goldsky-v1-to-v4-adapter';

/**
 * API route to serve individual builder project data from Goldsky
 * Filters the static JSON data by project ID
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
    
    // Normalize projectId (remove 0x prefix if present for comparison)
    const normalizedProjectId = projectId.toLowerCase();
    
    const filePath = path.join(
      process.cwd(),
      'public',
      'data',
      `goldsky-builders-${networkLower === 'arbitrum' ? 'arbitrum' : 'base'}.json`
    );

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.warn(
        `[Goldsky API] File not found: ${filePath}. Returning empty response.`
      );
      return NextResponse.json(
        {
          buildersProject: null,
        },
        {
          status: 200,
          headers: {
            'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
          },
        }
      );
    }

    // Read and parse JSON file
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent) as V4BuildersResponse & {
      _metadata?: {
        generatedAt: string;
        sourceEndpoint: string;
        network: string;
        chainId: number;
        version: string;
        projectCount: number;
      };
    };

    // Find project by ID (case-insensitive comparison)
    const project = data.buildersProjects.items.find(
      (p) => p.id.toLowerCase() === normalizedProjectId
    );

    if (!project) {
      return NextResponse.json(
        {
          buildersProject: null,
        },
        {
          status: 200,
          headers: {
            'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
          },
        }
      );
    }

    // Return project in V4 format (matching GET_PROJECT_WITH_DETAILS queries)
    // Note: Goldsky doesn't have user data, so users will be empty
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
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('[Goldsky API] Error reading builders data:', error);
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
