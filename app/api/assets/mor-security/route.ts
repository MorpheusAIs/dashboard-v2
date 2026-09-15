import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-static';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cross-Origin-Resource-Policy': 'cross-origin',
  'Timing-Allow-Origin': '*',
};

/**
 * GET /api/assets/mor-security
 * Serves public/mor-security.jpg with CORS + cross-origin headers
 * so it can be fetched/embedded from any other URL/origin.
 */
export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'mor-security.jpg');
    const buffer = await fs.readFile(filePath);

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': buffer.length.toString(),
        // Long cache - immutable asset
        'Cache-Control': 'public, max-age=31536000, immutable',
        ...CORS_HEADERS,
      },
    });
  } catch (error) {
    console.error('Error serving mor-security.jpg:', error);
    return Response.json(
      { error: 'Asset not found' },
      { status: 404, headers: CORS_HEADERS }
    );
  }
}

/** Preflight for cross-origin fetch() / canvas / WebGL use */
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
