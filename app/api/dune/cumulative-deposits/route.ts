import { NextResponse } from 'next/server';
import { getCumulativeDeposits } from '@/lib/dune/cumulative-deposits';

// Serve this JSON as a cached/static asset. The daily cron refreshes Dune
// and invalidates this cache so browsers do not hit Dune directly.
export const revalidate = 86400;
export const maxDuration = 60;

export async function GET() {
  console.log('🎯 [DUNE API CUMULATIVE DEPOSITS] Starting cumulative deposits fetch...');

  try {
    const { data, queryId, executionId, source } = await getCumulativeDeposits();

    console.log(
      `✅ [DUNE API CUMULATIVE DEPOSITS] Serving ${data.length} rows from ${source} execution`
    );

    return NextResponse.json(
      {
        success: true,
        data,
        timestamp: new Date().toISOString(),
        debug: {
          queryId,
          executionId,
          source,
          extractedCount: data.length,
          sampleRows: data.slice(0, 3),
        },
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600',
        },
      }
    );
  } catch (error) {
    console.error('❌ [DUNE API CUMULATIVE DEPOSITS] Error details:');
    console.error('  - Error message:', error instanceof Error ? error.message : String(error));
    console.error('  - Error stack:', error instanceof Error ? error.stack : 'No stack available');

    return NextResponse.json(
      {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Failed to fetch cumulative deposits data',
        timestamp: new Date().toISOString(),
        debug: {
          errorType: typeof error,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
        },
      }
    );
  }
}
