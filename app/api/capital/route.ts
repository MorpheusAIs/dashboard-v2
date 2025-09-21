import { NextRequest, NextResponse } from 'next/server';
import { getGraphQLApiUrl, NetworkEnvironment } from '@/config/networks';

// GraphQL Error type for better type safety
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { query, variables, networkEnv } = body;
    
    // Validate network environment
    if (!networkEnv || (networkEnv !== 'mainnet' && networkEnv !== 'testnet')) {
      return NextResponse.json(
        { error: 'Invalid or missing network environment' },
        { status: 400 }
      );
    }

    // Get the appropriate GraphQL API URL
    const graphqlUrl = getGraphQLApiUrl(networkEnv as NetworkEnvironment);

    if (!graphqlUrl) {
      return NextResponse.json(
        { error: 'GraphQL URL not configured for this network' },
        { status: 400 }
      );
    }


    // Make the request to The Graph API
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
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const data = await response.json();
    
    
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to fetch data from GraphQL API: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
} 