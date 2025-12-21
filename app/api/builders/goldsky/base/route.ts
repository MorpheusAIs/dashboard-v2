import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { V4BuildersResponse } from '@/lib/utils/goldsky-v1-to-v4-adapter';

/**
 * API route to serve transformed Goldsky V1 data for Base network
 * Reads from static JSON file generated at build time
 */
export async function GET() {
  try {
    const filePath = path.join(
      process.cwd(),
      'public',
      'data',
      'goldsky-builders-base.json'
    );

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.warn(
        `[Goldsky API Base] File not found: ${filePath}. Returning empty response.`
      );
      return NextResponse.json(
        {
          buildersProjects: {
            items: [],
          },
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

    // Remove metadata before returning (metadata is only used for build-time tracking)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _metadata, ...responseData } = data;

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('[Goldsky API Base] Error reading builders data:', error);
    return NextResponse.json(
      {
        buildersProjects: {
          items: [],
        },
        error: 'Failed to load builders data',
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
