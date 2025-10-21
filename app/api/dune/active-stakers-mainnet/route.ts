import { NextRequest, NextResponse } from 'next/server';

// ISR configuration - revalidate every 3 hours (10800 seconds)
export const revalidate = 10800; // 3 hours * 60 minutes * 60 seconds

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  console.log('🎯 [DUNE API MAINNET] Starting active stakers fetch...');
  
  try {
    // Check if API key exists
    if (!process.env.DUNE_API_KEY) {
      console.error('❌ [DUNE API MAINNET] DUNE_API_KEY not found in environment variables');
      throw new Error('Missing DUNE_API_KEY environment variable');
    }
    
    console.log('🔑 [DUNE API MAINNET] API key found, length:', process.env.DUNE_API_KEY.length);
    
    // Mainnet query ID for active depositors
    const queryId = 5697884; // Mainnet query ID provided by user
    console.log('📊 [DUNE API MAINNET] Fetching query ID:', queryId);
    
    // Get latest results from mainnet query using direct API call
    console.log('⏳ [DUNE API MAINNET] Calling Dune API directly...');
    const apiUrl = `https://api.dune.com/api/v1/query/${queryId}/results?limit=10000`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-Dune-API-Key': process.env.DUNE_API_KEY,
        'Content-Type': 'application/json',
      },
      cache: 'force-cache',
    });
    
    if (!response.ok) {
      throw new Error(`Dune API request failed: ${response.status} ${response.statusText}`);
    }
    
    const query_result = await response.json();
    
    console.log('📥 [DUNE API MAINNET] Raw query result:', JSON.stringify(query_result, null, 2));
    console.log('📊 [DUNE API MAINNET] Result structure:');
    console.log('  - query_result type:', typeof query_result);
    console.log('  - has result property:', 'result' in (query_result || {}));
    console.log('  - result type:', typeof query_result?.result);
    console.log('  - has rows property:', 'rows' in (query_result?.result || {}));
    console.log('  - rows length:', query_result?.result?.rows?.length);
    console.log('  - first few rows:', JSON.stringify(query_result?.result?.rows?.slice(0, 3), null, 2));
    
    // Extract the active stakers count from the table format
    // For mainnet, we need the length of the wallet_address column (number of unique wallets)
    const activeStakersCount = query_result?.result?.rows?.length || 0;
    console.log('🔢 [DUNE API MAINNET] Extracted active stakers count (table length):', activeStakersCount);
    
    const apiResponse = {
      success: true,
      active_stakers: activeStakersCount,
      network: 'mainnet',
      timestamp: new Date().toISOString(),
      debug: {
        queryId,
        hasResult: !!query_result?.result,
        rowsCount: query_result?.result?.rows?.length || 0,
        sampleRows: query_result?.result?.rows?.slice(0, 3) || null
      }
    };
    
    console.log('✅ [DUNE API MAINNET] Sending response:', JSON.stringify(apiResponse, null, 2));
    return NextResponse.json(apiResponse);
    
  } catch (error) {
    console.error('❌ [DUNE API MAINNET] Error details:');
    console.error('  - Error type:', typeof error);
    console.error('  - Error message:', error instanceof Error ? error.message : String(error));
    console.error('  - Error stack:', error instanceof Error ? error.stack : 'No stack available');
    console.error('  - Full error object:', JSON.stringify(error, null, 2));
    
    const errorResponse = {
      success: false,
      active_stakers: 0,
      error: error instanceof Error ? error.message : 'Failed to fetch active stakers data',
      network: 'mainnet',
      timestamp: new Date().toISOString(),
      debug: {
        errorType: typeof error,
        errorMessage: error instanceof Error ? error.message : String(error)
      }
    };
    
    console.log('💥 [DUNE API MAINNET] Sending error response:', JSON.stringify(errorResponse, null, 2));
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
