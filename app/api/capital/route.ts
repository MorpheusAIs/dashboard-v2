import { NextRequest, NextResponse } from 'next/server';
import { getGraphQLApiUrl, NetworkEnvironment, getGraphQLEndpointInfo } from '@/config/networks';

// GraphQL Error type for better type safety
interface GraphQLError {
  message: string;
  path?: (string | number)[];
  extensions?: Record<string, unknown>;
  locations?: { line: number; column: number }[];
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== CAPITAL API ROUTE - REQUEST START ===');
    
    const body = await request.json();
    console.log('📦 Raw request body:', JSON.stringify(body, null, 2));
    
    const { query, variables, networkEnv } = body;
    
    console.log('=== CAPITAL API ROUTE - PARSED ===');
    console.log('📊 Network Environment:', networkEnv);
    console.log('🔗 Variables received:', JSON.stringify(variables, null, 2));
    console.log('📝 Query type:', typeof query);
    console.log('📝 Query length:', query?.length || 0);
    
    // Validate network environment
    if (!networkEnv || (networkEnv !== 'mainnet' && networkEnv !== 'testnet')) {
      console.log('❌ Invalid network environment:', networkEnv);
      return NextResponse.json(
        { error: 'Invalid or missing network environment' },
        { status: 400 }
      );
    }

    // Get the appropriate GraphQL API URL
    const graphqlUrl = getGraphQLApiUrl(networkEnv as NetworkEnvironment);
    const endpointInfo = getGraphQLEndpointInfo(networkEnv as NetworkEnvironment);
    
    console.log('🌐 GraphQL Endpoint Info:', {
      environment: networkEnv,
      url: graphqlUrl,
      endpointDetails: endpointInfo
    });
    
    if (!graphqlUrl) {
      console.log('❌ No GraphQL URL configured for network:', networkEnv);
      return NextResponse.json(
        { error: 'GraphQL URL not configured for this network' },
        { status: 400 }
      );
    }

    // Log the GraphQL query details
    console.log('📋 GraphQL Query Length:', query.length);
    console.log('🔍 GraphQL Query Preview (first 500 chars):', query.substring(0, 500) + (query.length > 500 ? '...' : ''));
    console.log('📜 FULL GraphQL Query:', query);
    
    // Count the number of day aliases in the query to understand data scope
    const dayAliasMatches = query.match(/d\d+:/g);
    const numDays = dayAliasMatches ? dayAliasMatches.length : 0;
    console.log('📅 Number of days being queried:', numDays);
    
    // Extract pool addresses being queried
    const poolMatches = query.match(/pool:\s*"([^"]+)"/g);
    const pools = poolMatches ? poolMatches.map((m: string) => m.match(/"([^"]+)"/)![1]) : [];
    console.log('💰 Pool addresses in query:', pools);

    // Make the request to The Graph API
    console.log('🚀 Making GraphQL request to:', graphqlUrl);
    const startTime = Date.now();
    
    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });
    
    const duration = Date.now() - startTime;
    console.log(`⏱️  GraphQL request completed in ${duration}ms`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ GraphQL API Error response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const data = await response.json();
    
    // Log response details
    console.log('✅ GraphQL Response received:');
    console.log('📊 Response has errors:', !!data.errors);
    if (data.errors) {
      console.log('❌ GraphQL Errors:', JSON.stringify(data.errors, null, 2));
      // Log individual error details for better debugging
      data.errors.forEach((error: GraphQLError, index: number) => {
        console.log(`🔍 Error ${index + 1}:`, {
          message: error.message,
          path: error.path,
          extensions: error.extensions,
          locations: error.locations
        });
      });
    }
    
    if (data.data) {
      const dataKeys = Object.keys(data.data);
      console.log('📈 Response data keys:', dataKeys);
      
      // Count how many day entries actually have data
      const dayKeys = dataKeys.filter(key => key.startsWith('d'));
      const daysWithData = dayKeys.filter(key => {
        const dayData = data.data[key];
        return Array.isArray(dayData) && dayData.length > 0 && dayData[0].totalStaked;
      });
      
      console.log(`📅 Days with actual data: ${daysWithData.length} out of ${dayKeys.length} requested`);
      
      // Sample a few data points to understand data structure
      if (daysWithData.length > 0) {
        const firstDayWithData = daysWithData[0];
        const sampleData = data.data[firstDayWithData][0];
        console.log('🔍 Sample data point structure:', {
          key: firstDayWithData,
          totalStaked: sampleData?.totalStaked,
          timestamp: sampleData?.timestamp,
          hasMoreFields: Object.keys(sampleData || {}).length > 2
        });
      }
    } else {
      console.log('⚠️  No data field in GraphQL response');
    }
    
    console.log('=== END CAPITAL API ROUTE ===\n');
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ FATAL ERROR in capital API route:', error);
    console.error('❌ Error type:', typeof error);
    console.error('❌ Error name:', error instanceof Error ? error.name : 'Unknown');
    console.error('❌ Error message:', error instanceof Error ? error.message : String(error));
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    return NextResponse.json(
      { error: `Failed to fetch data from GraphQL API: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
} 