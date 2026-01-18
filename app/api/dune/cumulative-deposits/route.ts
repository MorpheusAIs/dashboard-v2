import { NextResponse } from 'next/server';

// ISR configuration - revalidate every 3 hours (10800 seconds)
export const revalidate = 10800; // 3 hours * 60 minutes * 60 seconds

// Use default dynamic behavior - Next.js will cache based on revalidate setting
// Don't use force-static as it may fail at build time without env vars

export async function GET() {
  console.log('🎯 [DUNE API CUMULATIVE DEPOSITS] Starting cumulative deposits fetch...');

  try {
    // Check if API key exists
    if (!process.env.DUNE_API_KEY) {
      console.error('❌ [DUNE API CUMULATIVE DEPOSITS] DUNE_API_KEY not found in environment variables');
      throw new Error('Missing DUNE_API_KEY environment variable');
    }

    console.log('🔑 [DUNE API CUMULATIVE DEPOSITS] API key found, length:', process.env.DUNE_API_KEY.length);

    // Query ID 3447596 for cumulative deposits
    const queryId = 3447596;
    console.log('📊 [DUNE API CUMULATIVE DEPOSITS] Fetching query ID:', queryId);

    // Get latest results from query using direct API call
    console.log('⏳ [DUNE API CUMULATIVE DEPOSITS] Calling Dune API directly...');
    const apiUrl = `https://api.dune.com/api/v1/query/${queryId}/results?limit=10000`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-Dune-API-Key': process.env.DUNE_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Dune API request failed: ${response.status} ${response.statusText}`);
    }

    const query_result = await response.json();

    console.log('📥 [DUNE API CUMULATIVE DEPOSITS] Raw query result keys:', Object.keys(query_result || {}));
    console.log('📊 [DUNE API CUMULATIVE DEPOSITS] Result structure:');
    console.log('  - has result property:', 'result' in (query_result || {}));
    console.log('  - has rows property (direct):', 'rows' in (query_result || {}));
    console.log('  - result.rows length:', query_result?.result?.rows?.length);
    console.log('  - direct rows length:', query_result?.rows?.length);

    // Handle different Dune API response structures
    // Structure 1: query_result.result.rows (standard API response)
    // Structure 2: query_result.rows (some SDK responses)
    const rows = query_result?.result?.rows || query_result?.rows || [];

    console.log('  - resolved rows length:', rows.length);
    if (rows.length > 0) {
      console.log('  - first row keys:', Object.keys(rows[0]));
      console.log('  - first row:', JSON.stringify(rows[0], null, 2));
    }

    // Extract cumulative deposits data from the table format
    // We need date and cumulativeDeposit columns only
    const cumulativeDepositsData = rows.map((row: Record<string, unknown>) => ({
      date: String(row.date || ''),
      cumulativeDeposit: parseFloat(String(row.cumulativeDeposit || row.cumulative_deposit || 0)) || 0,
    })).filter((item: { date: string; cumulativeDeposit: number }) => item.date !== '');

    console.log('🔢 [DUNE API CUMULATIVE DEPOSITS] Extracted cumulative deposits data:', cumulativeDepositsData.length, 'rows');
    console.log('📊 [DUNE API CUMULATIVE DEPOSITS] Sample data:', cumulativeDepositsData.slice(0, 3));

    // Validate we have data
    if (cumulativeDepositsData.length === 0) {
      console.warn('⚠️ [DUNE API CUMULATIVE DEPOSITS] No data extracted from Dune response');
      throw new Error('Dune query returned no valid data rows');
    }

    const apiResponse = {
      success: true,
      data: cumulativeDepositsData,
      timestamp: new Date().toISOString(),
      debug: {
        queryId,
        hasResult: !!query_result?.result,
        rowsCount: rows.length,
        extractedCount: cumulativeDepositsData.length,
        sampleRows: rows.slice(0, 3) || null
      }
    };

    console.log('✅ [DUNE API CUMULATIVE DEPOSITS] Sending response:', JSON.stringify(apiResponse, null, 2));
    return NextResponse.json(apiResponse);

  } catch (error) {
    console.error('❌ [DUNE API CUMULATIVE DEPOSITS] Error details:');
    console.error('  - Error type:', typeof error);
    console.error('  - Error message:', error instanceof Error ? error.message : String(error));
    console.error('  - Error stack:', error instanceof Error ? error.stack : 'No stack available');
    console.error('  - Full error object:', JSON.stringify(error, null, 2));

    // Return 200 with empty data for graceful degradation
    // This allows the capital page to load without cumulative deposits chart
    const errorResponse = {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'Failed to fetch cumulative deposits data',
      timestamp: new Date().toISOString(),
      debug: {
        errorType: typeof error,
        errorMessage: error instanceof Error ? error.message : String(error)
      }
    };

    console.log('⚠️  [DUNE API CUMULATIVE DEPOSITS] Returning graceful error response (200) to allow page to load');
    // Don't cache error responses - use no-store so ISR doesn't cache failures
    return NextResponse.json(errorResponse, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
      }
    });
  }
}
