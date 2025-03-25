// GraphQL API client utilities

// GraphQL API endpoints
export const GRAPHQL_ENDPOINTS = {
  'Base': 'https://subgraph.satsuma-prod.com/8675f21b07ed/9iqb9f4qcmhosiruyg763--465704/morpheus-mainnet-base/api',
  'Arbitrum': 'https://api.studio.thegraph.com/query/73688/lumerin-node/version/latest'
};

/**
 * Function to make GraphQL API calls with retry logic for rate limiting
 * @param endpoint The GraphQL endpoint URL
 * @param operationName The name of the operation
 * @param query The GraphQL query string
 * @param variables The variables for the query
 * @param maxRetries Maximum number of retries for rate limiting (default: 3)
 * @param initialBackoff Initial backoff time in milliseconds (default: 1000)
 * @returns The GraphQL response
 */
export const fetchGraphQL = async <T>(
  endpoint: string, 
  operationName: string,
  query: string, 
  variables: Record<string, any> = {},
  maxRetries = 3,
  initialBackoff = 1000
): Promise<T> => {
  let retries = 0;
  let backoff = initialBackoff;

  const executeRequest = async (): Promise<T> => {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operationName,
          query,
          variables,
        }),
      });

      // Check for rate limiting (HTTP 429)
      if (response.status === 429) {
        if (retries < maxRetries) {
          retries++;
          console.log(`Rate limited. Retrying in ${backoff}ms... (${retries}/${maxRetries})`);
          
          // Wait for backoff period
          await new Promise(resolve => setTimeout(resolve, backoff));
          
          // Exponential backoff
          backoff *= 2;
          
          // Try again
          return executeRequest();
        } else {
          throw new Error(`HTTP error! Status: 429 (Rate limit exceeded after ${maxRetries} retries)`);
        }
      }

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching GraphQL data:', error);
      throw error;
    }
  };

  return executeRequest();
}; 