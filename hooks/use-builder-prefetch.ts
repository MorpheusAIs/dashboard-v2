import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Builder } from '@/app/builders/builders-data';
import { fetchGraphQL, getEndpointForNetwork } from '@/app/graphql/client';
import { GET_BUILDERS_PROJECT_USERS, GET_BUILDER_SUBNET_USERS, GET_BUILDERS_PROJECT_BY_NAME, GET_BUILDER_SUBNET_BY_NAME } from '@/app/graphql/queries/builders';
import { useChainId } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';

export function useBuilderPrefetch() {
  const queryClient = useQueryClient();
  const chainId = useChainId();
  const isTestnet = chainId === arbitrumSepolia.id;

  const prefetchBuilderData = useCallback(async (builder: Builder) => {
    if (!builder) return;

    console.log(`[useBuilderPrefetch] Prefetching data for builder: ${builder.name}`);

    // Determine the project ID to use for queries
    const projectId = isTestnet ? builder.id : builder.mainnetProjectId;
    
    if (!projectId) {
      console.warn(`[useBuilderPrefetch] No project ID available for ${builder.name} on ${isTestnet ? 'testnet' : 'mainnet'}`);
      return;
    }

    // Determine the network for the query
    const network = builder.networks?.[0] || (isTestnet ? 'Arbitrum Sepolia' : 'Base');
    const endpoint = getEndpointForNetwork(network);

    try {
      // 1. Prefetch individual builder data (this is the key addition!)
      const builderQueryKey = [
        'individual-builder-data',
        {
          builderName: builder.name,
          isTestnet,
          network
        }
      ];

      await queryClient.prefetchQuery({
        queryKey: builderQueryKey,
        queryFn: async () => {
          console.log(`[useBuilderPrefetch] Fetching individual builder data for ${builder.name}`);

          if (isTestnet) {
            // Testnet: Get builder subnet by name
            const response = await fetchGraphQL(
              endpoint,
              "getBuilderSubnetByName",
              GET_BUILDER_SUBNET_BY_NAME,
              { name: builder.name }
            ) as { data: unknown };
            return response.data;
          } else {
            // Mainnet: Get builder project by name
            const response = await fetchGraphQL(
              endpoint,
              "getBuildersProjectsByName", 
              GET_BUILDERS_PROJECT_BY_NAME,
              { name: builder.name }
            ) as { data: unknown };
            return response.data;
          }
        },
        staleTime: 10 * 60 * 1000, // Consider builder data fresh for 10 minutes
      });

      // 2. Prefetch staking data
      const stakingQueryKey = [
        'builder-staking-data',
        {
          projectId,
          isTestnet,
          network,
          builderName: builder.name
        }
      ];

      // Check if we already have this data cached
      const existingStakingData = queryClient.getQueryData(stakingQueryKey);
      if (!existingStakingData) {
        await queryClient.prefetchQuery({
          queryKey: stakingQueryKey,
          queryFn: async () => {
            console.log(`[useBuilderPrefetch] Fetching staking data for ${builder.name} (${isTestnet ? 'testnet' : 'mainnet'})`);

            if (isTestnet) {
              // Testnet query
              const response = await fetchGraphQL(
                endpoint,
                "getBuilderSubnetUsers",
                GET_BUILDER_SUBNET_USERS,
                {
                  first: 10, // Prefetch first 10 entries
                  skip: 0,
                  builderSubnetId: projectId,
                  orderBy: 'staked',
                  orderDirection: 'desc'
                }
              ) as { data: unknown };
              return response.data;
            } else {
              // Mainnet query
              const response = await fetchGraphQL(
                endpoint,
                "getBuildersProjectUsers",
                GET_BUILDERS_PROJECT_USERS,
                {
                  first: 10, // Prefetch first 10 entries
                  skip: 0,
                  buildersProjectId: projectId,
                  orderBy: 'staked',
                  orderDirection: 'desc'
                }
              ) as { data: unknown };
              return response.data;
            }
          },
          staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
        });
      }

      console.log(`[useBuilderPrefetch] Successfully prefetched data for ${builder.name}`);

    } catch (error) {
      console.error(`[useBuilderPrefetch] Error prefetching data for ${builder.name}:`, error);
    }
  }, [queryClient, isTestnet]);

  // Prefetch multiple builders (useful for prefetching visible builders)
  const prefetchBuilders = useCallback(async (builders: Builder[]) => {
    const promises = builders.map(builder => prefetchBuilderData(builder));
    await Promise.allSettled(promises);
  }, [prefetchBuilderData]);

  // Get cached individual builder data
  const getCachedBuilderData = useCallback((builderName: string) => {
    const network = isTestnet ? 'Arbitrum Sepolia' : 'Base';
    
    const builderQueryKey = [
      'individual-builder-data',
      {
        builderName,
        isTestnet,
        network
      }
    ];

    return queryClient.getQueryData(builderQueryKey);
  }, [queryClient, isTestnet]);

  // Get cached staking data for a builder
  const getCachedStakingData = useCallback((builder: Builder) => {
    const projectId = isTestnet ? builder.id : builder.mainnetProjectId;
    if (!projectId) return null;

    const network = builder.networks?.[0] || (isTestnet ? 'Arbitrum Sepolia' : 'Base');
    
    const stakingQueryKey = [
      'builder-staking-data',
      {
        projectId,
        isTestnet,
        network,
        builderName: builder.name
      }
    ];

    return queryClient.getQueryData(stakingQueryKey);
  }, [queryClient, isTestnet]);

  return {
    prefetchBuilderData,
    prefetchBuilders,
    getCachedBuilderData,
    getCachedStakingData
  };
} 