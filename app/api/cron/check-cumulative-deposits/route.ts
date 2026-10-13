import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getCumulativeDeposits } from '@/lib/dune/cumulative-deposits';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

/**
 * Daily cron: re-run the Dune cumulative deposits query and refresh the
 * cached API response served to the capital page.
 *
 * Vercel Cron Config (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/check-cumulative-deposits",
 *     "schedule": "0 8 * * *"
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('🔒 [CRON CHECK] Unauthorized cron attempt');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🔄 [CRON CHECK] Executing Dune cumulative deposits query...');

    const result = await getCumulativeDeposits({ forceRefresh: true });
    revalidatePath('/api/dune/cumulative-deposits');

    const duration = Date.now() - startTime;
    console.log(
      `✅ [CRON CHECK] Refreshed ${result.data.length} rows in ${duration}ms (${result.source})`
    );

    return NextResponse.json({
      success: true,
      action: 'refreshed',
      state: {
        success: true,
        dataCount: result.data.length,
        source: result.source,
        executionId: result.executionId,
      },
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ [CRON CHECK] Error:', error);
    const duration = Date.now() - startTime;

    return NextResponse.json(
      {
        success: false,
        action: 'error',
        error: error instanceof Error ? error.message : 'Health check failed',
        durationMs: duration,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
