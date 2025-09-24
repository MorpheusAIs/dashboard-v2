// GraphQL API client utilities

// GraphQL API endpoints
export const GRAPHQL_ENDPOINTS = {
  'Base': 'https://subgraph.satsuma-prod.com/8675f21b07ed/9iqb9f4qcmhosiruyg763--465704/morpheus-mainnet-base/api',
  'Arbitrum': 'https://api.studio.thegraph.com/query/73688/morpheus-mainnet-arbitrum/version/latest',
  'Arbitrum_Sepolia': 'https://subgraph.satsuma-prod.com/8675f21b07ed/9iqb9f4qcmhosiruyg763--465704/morpheus-arbitrum-sepolia/api',
  "Ethereum": "https://api.studio.thegraph.com/query/73688/morpheus-mainnet-v-2/version/latest",
};

// Define the request cache entry type
interface RequestCacheEntry<T> {
  timestamp: number;
  promise: Promise<T>;
}

// Keep track of recent requests to implement debouncing
const recentRequests = new Map<string, RequestCacheEntry<unknown>>();
const DEBOUNCE_TIME = 2000; // 2 seconds debounce time

// Utility function to get the current endpoint for a network
export const getEndpointForNetwork = (network: string) => {
  // Check if we're on Arbitrum Sepolia
  if (network.toLowerCase() === 'arbitrum_sepolia' || 
      network.toLowerCase() === 'arbitrum sepolia' || 
      network.toLowerCase() === 'arbitrumsepolia') {
    return GRAPHQL_ENDPOINTS.Arbitrum_Sepolia;
  }
  
  // Otherwise, use the standard network endpoint if it exists
  return GRAPHQL_ENDPOINTS[network as keyof typeof GRAPHQL_ENDPOINTS] || GRAPHQL_ENDPOINTS.Base;
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
  variables: Record<string, unknown> = {},
  maxRetries = 3,
  initialBackoff = 1000
): Promise<T> => {
  let retries = 0;
  let backoff = initialBackoff;

  // Create a request key based on endpoint, operation and variables
  const requestKey = `${endpoint}_${operationName}_${JSON.stringify(variables)}`;
  
  // Check if we have a recent request for this exact query
  const now = Date.now();
  const recentRequest = recentRequests.get(requestKey) as RequestCacheEntry<T> | undefined;
  
  if (recentRequest && (now - recentRequest.timestamp < DEBOUNCE_TIME)) {
    console.log(`Debouncing duplicate request: ${operationName} - Using cached response`);
    return recentRequest.promise;
  }

  // Debug logging
  console.log(`GraphQL Request: ${operationName}`, {
    endpoint,
    variables
  });

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

      const result = await response.json();
      
      // Log GraphQL errors if present
      if (result.errors && result.errors.length > 0) {
        console.error('GraphQL Errors:', result.errors);
      }
      
      // Ensure the data property exists to prevent null references
      if (!result.data) {
        result.data = {};
        console.warn('GraphQL response missing data property');
      }
      
      return result;
    } catch (error) {
      console.error('Error fetching GraphQL data:', error);
      throw error;
    }
  };

  // Store the request promise in the cache
  const requestPromise = executeRequest();
  recentRequests.set(requestKey, { 
    timestamp: now, 
    promise: requestPromise 
  });
  
  // Clean up old cache entries after debounce time
  setTimeout(() => {
    if (recentRequests.has(requestKey)) {
      recentRequests.delete(requestKey);
    }
  }, DEBOUNCE_TIME);

  return requestPromise;
}; 