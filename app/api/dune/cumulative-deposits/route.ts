import { NextRequest, NextResponse } from 'next/server';

// ISR configuration - revalidate every 3 hours (10800 seconds)
export const revalidate = 10800; // 3 hours * 60 minutes * 60 seconds

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
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

    console.log('📥 [DUNE API CUMULATIVE DEPOSITS] Raw query result:', JSON.stringify(query_result, null, 2));
    console.log('📊 [DUNE API CUMULATIVE DEPOSITS] Result structure:');
    console.log('  - query_result type:', typeof query_result);
    console.log('  - has result property:', 'result' in (query_result || {}));
    console.log('  - result type:', typeof query_result?.result);
    console.log('  - has rows property:', 'rows' in (query_result?.result || {}));
    console.log('  - rows length:', query_result?.result?.rows?.length);
    console.log('  - first few rows:', JSON.stringify(query_result?.result?.rows?.slice(0, 3), null, 2));

    // Extract cumulative deposits data from the table format
    // We need date and cumulativeDeposit columns only
    const cumulativeDepositsData = query_result?.result?.rows?.map((row: { date: string; cumulativeDeposit: string | number }) => ({
      date: row.date,
      cumulativeDeposit: parseFloat(String(row.cumulativeDeposit)) || 0,
    })) || [];

    console.log('🔢 [DUNE API CUMULATIVE DEPOSITS] Extracted cumulative deposits data:', cumulativeDepositsData.length, 'rows');
    console.log('📊 [DUNE API CUMULATIVE DEPOSITS] Sample data:', cumulativeDepositsData.slice(0, 3));

    const apiResponse = {
      success: true,
      data: cumulativeDepositsData,
      timestamp: new Date().toISOString(),
      debug: {
        queryId,
        hasResult: !!query_result?.result,
        rowsCount: query_result?.result?.rows?.length || 0,
        sampleRows: query_result?.result?.rows?.slice(0, 3) || null
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

    console.log('💥 [DUNE API CUMULATIVE DEPOSITS] Sending error response:', JSON.stringify(errorResponse, null, 2));
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
