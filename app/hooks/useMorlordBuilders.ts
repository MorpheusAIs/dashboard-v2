import { useQuery } from '@tanstack/react-query';
import { getClientForNetwork } from '@/lib/apollo-client';
import { GET_BUILDERS_PROJECT_NAMES_BASE, GET_BUILDERS_PROJECT_NAMES_ARBITRUM } from '@/lib/graphql/builders-queries';
// import { useEffect } from 'react';

interface UseMorlordBuildersOptions {
  network?: 'base' | 'arbitrum' | 'all';
}

/**
 * Hook to fetch builder names from Morlord API or Base subgraph depending on network
 * For Base network, it uses the subgraph directly instead of morlord API
 */
export const useMorlordBuilders = (options: UseMorlordBuildersOptions = {}) => {
  const { network = 'all' } = options;

  // console.log('[useMorlordBuilders] Hook initialized for network:', network);

  const query = useQuery<string[]>({
    queryKey: ['morlordBuilders', network],
    queryFn: async () => {
      // console.log('[useMorlordBuilders] Query function executing for network:', network);

      // For Base network, use subgraph directly
      if (network === 'base') {
        try {
          const client = getClientForNetwork('Base');
          if (!client) {
            throw new Error('Could not get Apollo client for Base network');
          }

          const response = await client.query<{ buildersProjects: { name: string }[] }>({
            query: GET_BUILDERS_PROJECT_NAMES_BASE,
            fetchPolicy: 'no-cache',
          });

          // Extract just the names from the response
          const builderNames = response.data.buildersProjects.map(project => project.name);

          // console.log(`[useMorlordBuilders] Fetched ${builderNames.length} builder names from Base subgraph:`, builderNames);
          return builderNames;
        } catch (error) {
          console.error('[useMorlordBuilders] Error fetching builders from Base subgraph:', error);
          // Fall back to morlord API if subgraph fails
          console.log('[useMorlordBuilders] Falling back to morlord API for Base network');
        }
      }

      // For Arbitrum network, use subgraph directly
      if (network === 'arbitrum') {
        try {
          const client = getClientForNetwork('Arbitrum');
          if (!client) {
            throw new Error('Could not get Apollo client for Arbitrum network');
          }

          const response = await client.query<{ buildersProjects: { name: string }[] }>({
            query: GET_BUILDERS_PROJECT_NAMES_ARBITRUM,
            fetchPolicy: 'no-cache',
          });

          // Extract just the names from the response
          const builderNames = response.data.buildersProjects.map(project => project.name);

          // console.log(`[useMorlordBuilders] Fetched ${builderNames.length} builder names from Arbitrum subgraph:`, builderNames);
          return builderNames;
        } catch (error) {
          console.error('[useMorlordBuilders] Error fetching builders from Arbitrum subgraph:', error);
          // Fall back to morlord API if subgraph fails
          console.log('[useMorlordBuilders] Falling back to morlord API for Arbitrum network');
        }
      }

      // For 'all' network or fallback, use morlord API
      try {
        // console.log('[useMorlordBuilders] Fetching data from /api/builders for network:', network);
        const apiUrl = '/api/builders';
        const response = await fetch(apiUrl);

        if (!response.ok) {
          // console.error(`[useMorlordBuilders] API responded with status: ${response.status} ${response.statusText}`);
          throw new Error('Failed to fetch builders from API route');
        }

        const builderNames: string[] = await response.json();

        // console.log(`[useMorlordBuilders] Fetched ${builderNames.length} builder names from morlord API:`, builderNames);
        return builderNames;
      } catch (error) {
        console.error('[useMorlordBuilders] Error fetching builders from morlord API:', error);
        // Return an empty array to avoid breaking the app
        console.log('[useMorlordBuilders] Returning empty array due to error');
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 3 // Retry 3 times if the request fails
  });

  // Use useEffect for the callbacks instead
  // useEffect(() => {
  //   if (query.data) {
  //     console.log(`[useMorlordBuilders] Query successful with ${query.data.length} names`);
  //   }
  // }, [query.data]);

  // useEffect(() => {
  //   if (query.error) {
  //     console.error('[useMorlordBuilders] Query failed:', query.error);
  //   }
  // }, [query.error]);

  return query;
}; 