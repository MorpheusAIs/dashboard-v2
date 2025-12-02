import { useQuery } from '@tanstack/react-query';
import { getClientForNetwork } from '@/lib/apollo-client';
import { GET_BUILDERS_PROJECT_NAMES_BASE } from '@/lib/graphql/builders-queries';

/**
 * Hook to fetch builder names directly from Base subgraph
 * This replaces the morlord API for Base network
 */
export const useBaseSubgraphBuilders = () => {
  return useQuery<string[]>({
    queryKey: ['baseSubgraphBuilders'],
    queryFn: async () => {
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

        return builderNames;
      } catch (error) {
        console.error('[useBaseSubgraphBuilders] Error fetching builders from Base subgraph:', error);
        // Return empty array to avoid breaking the app
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 3, // Retry 3 times if the request fails
  });
};