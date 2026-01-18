import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

/**
 * On-demand revalidation endpoint for cumulative deposits data.
 *
 * Usage:
 * - POST /api/dune/cumulative-deposits/revalidate
 * - Requires CRON_SECRET header for authentication (or use as public endpoint)
 *
 * This will:
 * 1. Clear the ISR cache for the cumulative-deposits endpoint
 * 2. Trigger a fresh fetch from Dune Analytics on next request
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Verify secret for protected revalidation
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // If CRON_SECRET is set, require it for authentication
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('🔒 [REVALIDATE] Unauthorized revalidation attempt');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🔄 [REVALIDATE] Revalidating cumulative deposits cache...');

    // Revalidate the cumulative-deposits API route
    revalidatePath('/api/dune/cumulative-deposits');

    console.log('✅ [REVALIDATE] Cache invalidated successfully');

    return NextResponse.json({
      success: true,
      message: 'Cumulative deposits cache revalidated',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ [REVALIDATE] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Revalidation failed'
      },
      { status: 500 }
    );
  }
}

// Also support GET for easy browser testing (protected by CRON_SECRET)
export async function GET(request: NextRequest) {
  return POST(request);
}
