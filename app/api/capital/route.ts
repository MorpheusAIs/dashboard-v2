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
    const endpointInfo = getGraphQLEndpointInfo(networkEnv as NetworkEnvironment);

    if (!graphqlUrl) {
      return NextResponse.json(
        { error: 'GraphQL URL not configured for this network' },
        { status: 400 }
      );
    }

    // Count the number of day aliases in the query to understand data scope
    const dayAliasMatches = query.match(/d\d+:/g);
    const numDays = dayAliasMatches ? dayAliasMatches.length : 0;

    // Extract pool addresses being queried
    const poolMatches = query.match(/pool:\s*"([^"]+)"/g);
    const pools = poolMatches ? poolMatches.map((m: string) => m.match(/"([^"]+)"/)![1]) : [];

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
    
    if (data.data) {
      // Count how many day entries actually have data
      const dataKeys = Object.keys(data.data);
      const dayKeys = dataKeys.filter(key => key.startsWith('d'));
      const daysWithData = dayKeys.filter(key => {
        const dayData = data.data[key];
        return Array.isArray(dayData) && dayData.length > 0 && dayData[0].totalStaked;
      });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to fetch data from GraphQL API: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
} 