import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Builder } from '@/app/builders/builders-data';
import { fetchGraphQL, getEndpointForNetwork } from '@/app/graphql/client';
import { 
  GET_BUILDERS_PROJECT_USERS, 
  GET_BUILDER_SUBNET_USERS,
  GET_USER_ACCOUNT_BUILDERS_PROJECT,
  GET_BUILDERS_PROJECT_BY_ID,
  GET_BUILDER_SUBNET_BY_ID
} from '@/app/graphql/queries/builders';
import { useChainId, useAccount } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';

export function useBuilderPrefetch() {
  const queryClient = useQueryClient();
  const chainId = useChainId();
  const isTestnet = chainId === arbitrumSepolia.id;
  const { address: userAddress } = useAccount();

  const prefetchBuilderData = useCallback(async (builder: Builder) => {
    if (!builder) return;

    console.log(`[useBuilderPrefetch] Prefetching individual builder data for: ${builder.name}`);

    // Determine the project ID to use for queries
    const projectId = isTestnet ? builder.id : builder.mainnetProjectId;
    
    if (!projectId) {
      console.warn(`[useBuilderPrefetch] No project ID available for ${builder.name} on ${isTestnet ? 'testnet' : 'mainnet'}`);
      return;
    }

    // Determine the network and endpoint
    const network = builder.networks?.[0] || (isTestnet ? 'ArbitrumSepolia' : 'Base');
    const endpoint = getEndpointForNetwork(network);

    try {
      // Create query key for individual builder data
      const builderQueryKey = [
        'individual-builder-data',
        {
          projectId,
          isTestnet,
          network,
          builderName: builder.name,
          userAddress: userAddress || null
        }
      ];

      // Check if we already have this data cached
      const existingData = queryClient.getQueryData(builderQueryKey);
      if (existingData) {
        console.log(`[useBuilderPrefetch] Individual builder data already cached for ${builder.name}`);
        return;
      }

      // Prefetch individual builder data
      await queryClient.prefetchQuery({
        queryKey: builderQueryKey,
        queryFn: async () => {
          console.log(`[useBuilderPrefetch] Fetching individual builder data for ${builder.name} (${isTestnet ? 'testnet' : 'mainnet'})`);

          if (isTestnet) {
            // Testnet - fetch builder subnet by ID
            const response = await fetchGraphQL(
              endpoint,
              "getBuilderSubnetById",
              GET_BUILDER_SUBNET_BY_ID,
              {
                id: projectId
              }
            ) as { data: { builderSubnet: unknown } };
            return response.data;
          } else {
            // Mainnet - fetch builder project data and user's staking info if available
            if (userAddress) {
              // Fetch with user data
              const response = await fetchGraphQL(
                endpoint,
                "getUserAccountBuildersProject",
                GET_USER_ACCOUNT_BUILDERS_PROJECT,
                {
                  address: userAddress,
                  project_id: projectId
                }
              ) as { data: { buildersUsers: unknown[] } };
              
              // If user has staking data, return it, otherwise fetch just project data
              if (response.data.buildersUsers && response.data.buildersUsers.length > 0) {
                return response.data;
              }
            }
            
            // Fetch just the project data (no user data)
            const response = await fetchGraphQL(
              endpoint,
              "getBuildersProjectById",
              GET_BUILDERS_PROJECT_BY_ID,
              {
                id: projectId
              }
            ) as { data: { buildersProject: unknown } };
            return response.data;
          }
        },
        staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
      });

      // Also prefetch first page of staking table data
      const stakingQueryKey = [
        'builder-staking-table',
        {
          projectId,
          isTestnet,
          network,
          page: 1
        }
      ];

      await queryClient.prefetchQuery({
        queryKey: stakingQueryKey,
        queryFn: async () => {
          console.log(`[useBuilderPrefetch] Prefetching staking table for ${builder.name}`);

          if (isTestnet) {
            const response = await fetchGraphQL(
              endpoint,
              "getBuilderSubnetUsers",
              GET_BUILDER_SUBNET_USERS,
              {
                first: 10,
                skip: 0,
                builderSubnetId: projectId,
                orderBy: 'staked',
                orderDirection: 'desc'
              }
            ) as { data: unknown };
            return response.data;
          } else {
            const response = await fetchGraphQL(
              endpoint,
              "getBuildersProjectUsers",
              GET_BUILDERS_PROJECT_USERS,
              {
                first: 10,
                skip: 0,
                buildersProjectId: projectId,
                orderBy: 'staked',
                orderDirection: 'desc'
              }
            ) as { data: unknown };
            return response.data;
          }
        },
        staleTime: 5 * 60 * 1000,
      });

      console.log(`[useBuilderPrefetch] Successfully prefetched individual data for ${builder.name}`);

    } catch (error) {
      console.error(`[useBuilderPrefetch] Error prefetching individual data for ${builder.name}:`, error);
    }
  }, [queryClient, isTestnet, userAddress]);

  // Prefetch multiple builders (useful for prefetching visible builders)
  const prefetchBuilders = useCallback(async (builders: Builder[]) => {
    const promises = builders.map(builder => prefetchBuilderData(builder));
    await Promise.allSettled(promises);
  }, [prefetchBuilderData]);

  // Get cached individual builder data
  const getCachedBuilderData = useCallback((builder: Builder) => {
    const projectId = isTestnet ? builder.id : builder.mainnetProjectId;
    if (!projectId) return null;

    const network = builder.networks?.[0] || (isTestnet ? 'ArbitrumSepolia' : 'Base');
    
    const builderQueryKey = [
      'individual-builder-data',
      {
        projectId,
        isTestnet,
        network,
        builderName: builder.name,
        userAddress: userAddress || null
      }
    ];

    return queryClient.getQueryData(builderQueryKey);
  }, [queryClient, isTestnet, userAddress]);

  // Get cached individual builder data by slug and project ID
  const getCachedBuilderByProjectId = useCallback((projectId: string, isTestnetOverride?: boolean) => {
    const effectiveIsTestnet = isTestnetOverride !== undefined ? isTestnetOverride : isTestnet;
    const network = effectiveIsTestnet ? 'ArbitrumSepolia' : 'Base';
    
    const builderQueryKey = [
      'individual-builder-data',
      {
        projectId,
        isTestnet: effectiveIsTestnet,
        network,
        builderName: undefined, // We don't know the name when searching by ID
        userAddress: userAddress || null
      }
    ];

    const cachedData = queryClient.getQueryData(builderQueryKey);
    if (cachedData) {
      console.log(`[useBuilderPrefetch] Found cached data for project ID: ${projectId}`);
      return cachedData;
    }

    // Also try to find it in any cached data with matching projectId
    const allCachedData = queryClient.getQueryCache().getAll();
    for (const query of allCachedData) {
      if (query.queryKey[0] === 'individual-builder-data') {
        const keyData = query.queryKey[1] as { projectId?: string; isTestnet?: boolean; network?: string; builderName?: string; userAddress?: string | null };
        if (keyData?.projectId === projectId && keyData?.isTestnet === effectiveIsTestnet) {
          console.log(`[useBuilderPrefetch] Found cached data via search for project ID: ${projectId}`);
          return query.state.data;
        }
      }
    }

    return null;
  }, [queryClient, isTestnet, userAddress]);

  return {
    prefetchBuilderData,
    prefetchBuilders,
    getCachedBuilderData,
    getCachedBuilderByProjectId
  };
} 