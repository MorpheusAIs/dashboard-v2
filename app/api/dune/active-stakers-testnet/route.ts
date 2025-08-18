import { NextRequest, NextResponse } from 'next/server';
import { DuneClient } from '@duneanalytics/client-sdk';

export async function GET(request: NextRequest) {
  console.log('🎯 [DUNE API] Starting active stakers fetch...');
  
  try {
    // Check if API key exists
    if (!process.env.DUNE_API_KEY) {
      console.error('❌ [DUNE API] DUNE_API_KEY not found in environment variables');
      throw new Error('Missing DUNE_API_KEY environment variable');
    }
    
    console.log('🔑 [DUNE API] API key found, length:', process.env.DUNE_API_KEY.length);
    
    // Initialize Dune client
    const dune = new DuneClient(process.env.DUNE_API_KEY!);
    console.log('✅ [DUNE API] DuneClient initialized successfully');
    
    // Replace with your actual query ID from Dune
    // You'll get this when you save your production-active-stakers.sql query
    const queryId = 5650752; // Replace with your actual query ID
    console.log('📊 [DUNE API] Fetching query ID:', queryId);
    
    // Get latest results from your saved query
    console.log('⏳ [DUNE API] Calling dune.getLatestResult...');
    const query_result = await dune.getLatestResult({ queryId });
    
    console.log('📥 [DUNE API] Raw query result:', JSON.stringify(query_result, null, 2));
    console.log('📊 [DUNE API] Result structure:');
    console.log('  - query_result type:', typeof query_result);
    console.log('  - has result property:', 'result' in (query_result || {}));
    console.log('  - result type:', typeof query_result?.result);
    console.log('  - has rows property:', 'rows' in (query_result?.result || {}));
    console.log('  - rows length:', query_result?.result?.rows?.length);
    console.log('  - first row:', JSON.stringify(query_result?.result?.rows?.[0], null, 2));
    
    // Extract the active stakers count from the result
    const activeStakersCount = query_result?.result?.rows?.[0]?.total_active_stakers || 0;
    console.log('🔢 [DUNE API] Extracted active stakers count:', activeStakersCount);
    
    const response = {
      success: true,
      active_stakers: activeStakersCount,
      network: 'testnet',
      timestamp: new Date().toISOString(),
      debug: {
        queryId,
        hasResult: !!query_result?.result,
        rowsCount: query_result?.result?.rows?.length || 0,
        firstRow: query_result?.result?.rows?.[0] || null
      }
    };
    
    console.log('✅ [DUNE API] Sending response:', JSON.stringify(response, null, 2));
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('❌ [DUNE API] Error details:');
    console.error('  - Error type:', typeof error);
    console.error('  - Error message:', error instanceof Error ? error.message : String(error));
    console.error('  - Error stack:', error instanceof Error ? error.stack : 'No stack available');
    console.error('  - Full error object:', JSON.stringify(error, null, 2));
    
    const errorResponse = {
      success: false,
      active_stakers: 0,
      error: error instanceof Error ? error.message : 'Failed to fetch active stakers data',
      network: 'testnet',
      timestamp: new Date().toISOString(),
      debug: {
        errorType: typeof error,
        errorMessage: error instanceof Error ? error.message : String(error)
      }
    };
    
    console.log('💥 [DUNE API] Sending error response:', JSON.stringify(errorResponse, null, 2));
    return NextResponse.json(errorResponse, { status: 500 });
  }
}