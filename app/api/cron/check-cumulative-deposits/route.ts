import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

/**
 * Cron job to check cumulative deposits data health and revalidate if needed.
 *
 * This endpoint:
 * 1. Fetches the current cumulative-deposits API response
 * 2. Checks if it's returning an error (success: false)
 * 3. If error, triggers revalidation to clear the cache
 * 4. Optionally re-fetches to warm the cache with fresh data
 *
 * Vercel Cron Config (add to vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/check-cumulative-deposits",
 *     "schedule": "0 * * * *"  // Every hour
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('🔒 [CRON CHECK] Unauthorized cron attempt');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🔍 [CRON CHECK] Checking cumulative deposits data health...');

    // Get the base URL for internal API calls
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    // Fetch current cumulative deposits data
    const response = await fetch(`${baseUrl}/api/dune/cumulative-deposits`, {
      cache: 'no-store', // Bypass cache to see real state
      headers: {
        'Cache-Control': 'no-cache',
      }
    });

    const data = await response.json();

    console.log('📊 [CRON CHECK] Current data status:', {
      success: data.success,
      dataCount: data.data?.length || 0,
      hasError: !!data.error,
      error: data.error,
    });

    // Check if data is in error state
    if (!data.success || !data.data || data.data.length === 0) {
      console.log('⚠️ [CRON CHECK] Data is in error state, triggering revalidation...');

      // Revalidate the cache
      revalidatePath('/api/dune/cumulative-deposits');

      // Wait a moment for revalidation to take effect
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Warm the cache by fetching again
      console.log('🔄 [CRON CHECK] Warming cache with fresh fetch...');
      const warmResponse = await fetch(`${baseUrl}/api/dune/cumulative-deposits`, {
        cache: 'no-store',
      });
      const warmData = await warmResponse.json();

      const duration = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        action: 'revalidated',
        previousState: {
          success: data.success,
          dataCount: data.data?.length || 0,
          error: data.error,
        },
        newState: {
          success: warmData.success,
          dataCount: warmData.data?.length || 0,
          error: warmData.error,
        },
        durationMs: duration,
        timestamp: new Date().toISOString(),
      });
    }

    // Data is healthy, no action needed
    const duration = Date.now() - startTime;
    console.log('✅ [CRON CHECK] Data is healthy, no action needed');

    return NextResponse.json({
      success: true,
      action: 'none',
      state: {
        success: data.success,
        dataCount: data.data?.length || 0,
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
