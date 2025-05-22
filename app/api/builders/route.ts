import { NextResponse } from 'next/server';

export async function GET() {
  console.log('[API ROUTE] /api/builders route called');
  
  try {
    // Fetch data from the external API
    console.log('[API ROUTE] Attempting to fetch data from https://morlord.com/data/builders.json');
    const response = await fetch('https://morlord.com/data/builders.json', {
      // Adding a short timeout to fail fast if the service is down
      signal: AbortSignal.timeout(5000)
    });
    
    if (!response.ok) {
      console.error(`[API ROUTE] API responded with status: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`[API ROUTE] Successfully fetched data with ${Object.keys(data).length} entries`);
    
    // Extract just the names from the data
    const builderNames = Object.values(data).map((builder: any) => builder.name);
    console.log(`[API ROUTE] Extracted ${builderNames.length} builder names:`, builderNames);
    
    // Return the data with proper CORS headers
    console.log('[API ROUTE] Returning builder names with success status');
    return NextResponse.json(builderNames, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('[API ROUTE] Error in builders API route:', error);
    
    // Return a fallback set of builder names if available, or an empty array
    console.log('[API ROUTE] Returning empty array with error status');
    return NextResponse.json([], {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
} 