import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getCumulativeDeposits } from '@/lib/dune/cumulative-deposits';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * On-demand refresh for cumulative deposits data.
 *
 * Usage:
 * - POST /api/dune/cumulative-deposits/revalidate
 * - Requires CRON_SECRET header for authentication
 *
 * This will:
 * 1. Re-run the Dune query
 * 2. Clear the ISR cache for the cumulative-deposits endpoint
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('🔒 [REVALIDATE] Unauthorized revalidation attempt');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🔄 [REVALIDATE] Executing Dune query and revalidating cache...');

    const result = await getCumulativeDeposits({ forceRefresh: true });
    revalidatePath('/api/dune/cumulative-deposits');

    console.log('✅ [REVALIDATE] Query executed and cache invalidated');

    return NextResponse.json({
      success: true,
      message: 'Cumulative deposits query refreshed',
      dataCount: result.data.length,
      executionId: result.executionId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ [REVALIDATE] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Revalidation failed',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
