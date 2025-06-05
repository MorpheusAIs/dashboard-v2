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

    // For testnet, only prefetch on Arbitrum Sepolia
    if (isTestnet) {
      const projectId = builder.id;
      if (!projectId) {
        console.warn(`[useBuilderPrefetch] No project ID available for ${builder.name} on testnet`);
        return;
      }

      const network = 'Arbitrum Sepolia';
      const endpoint = getEndpointForNetwork(network);

      try {
        // Prefetch individual builder data
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
            console.log(`[useBuilderPrefetch] Fetching individual builder data for ${builder.name} on ${network}`);
            const response = await fetchGraphQL(
              endpoint,
              "getBuilderSubnetByName",
              GET_BUILDER_SUBNET_BY_NAME,
              { name: builder.name }
            ) as { data: unknown };
            return response.data;
          },
          staleTime: 10 * 60 * 1000,
        });

        // Prefetch staking data
        const stakingQueryKey = [
          'builder-staking-data',
          {
            projectId,
            isTestnet,
            network,
            builderName: builder.name
          }
        ];

        const existingStakingData = queryClient.getQueryData(stakingQueryKey);
        if (!existingStakingData) {
          await queryClient.prefetchQuery({
            queryKey: stakingQueryKey,
            queryFn: async () => {
              console.log(`[useBuilderPrefetch] Fetching staking data for ${builder.name} on ${network}`);
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
            },
            staleTime: 5 * 60 * 1000,
          });
        }

        console.log(`[useBuilderPrefetch] Successfully prefetched data for ${builder.name} on ${network}`);
      } catch (error) {
        console.error(`[useBuilderPrefetch] Error prefetching data for ${builder.name} on ${network}:`, error);
      }
      return;
    }

    // For mainnet, prefetch for all networks the builder is deployed on
    const networks = builder.networks?.filter(net => net === 'Arbitrum' || net === 'Base') || ['Base'];
    const projectId = builder.mainnetProjectId;
    
    if (!projectId) {
      console.warn(`[useBuilderPrefetch] No mainnet project ID available for ${builder.name}`);
      return;
    }

    console.log(`[useBuilderPrefetch] Prefetching for ${builder.name} on networks: ${networks.join(', ')}`);

    const prefetchPromises = networks.map(async (network) => {
      const endpoint = getEndpointForNetwork(network);

      try {
        // Prefetch individual builder data for this network
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
            console.log(`[useBuilderPrefetch] Fetching individual builder data for ${builder.name} on ${network}`);
            const response = await fetchGraphQL(
              endpoint,
              "getBuildersProjectsByName", 
              GET_BUILDERS_PROJECT_BY_NAME,
              { name: builder.name }
            ) as { data: unknown };
            return response.data;
          },
          staleTime: 10 * 60 * 1000,
        });

        // Prefetch staking data for this network
        const stakingQueryKey = [
          'builder-staking-data',
          {
            projectId,
            isTestnet,
            network,
            builderName: builder.name
          }
        ];

        const existingStakingData = queryClient.getQueryData(stakingQueryKey);
        if (!existingStakingData) {
          await queryClient.prefetchQuery({
            queryKey: stakingQueryKey,
            queryFn: async () => {
              console.log(`[useBuilderPrefetch] Fetching staking data for ${builder.name} on ${network}`);
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
            },
            staleTime: 5 * 60 * 1000,
          });
        }

        console.log(`[useBuilderPrefetch] Successfully prefetched data for ${builder.name} on ${network}`);
      } catch (error) {
        console.error(`[useBuilderPrefetch] Error prefetching data for ${builder.name} on ${network}:`, error);
      }
    });

    await Promise.allSettled(prefetchPromises);
  }, [queryClient, isTestnet]);

  // Prefetch multiple builders (useful for prefetching visible builders)
  const prefetchBuilders = useCallback(async (builders: Builder[]) => {
    const promises = builders.map(builder => prefetchBuilderData(builder));
    await Promise.allSettled(promises);
  }, [prefetchBuilderData]);

  // Get cached individual builder data
  const getCachedBuilderData = useCallback((builderName: string, builderNetwork?: string) => {
    const network = isTestnet ? 'Arbitrum Sepolia' : (builderNetwork || 'Base');
    
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

  // Get cached staking data for a builder on a specific network
  const getCachedStakingData = useCallback((builder: Builder, specificNetwork?: string) => {
    const projectId = isTestnet ? builder.id : builder.mainnetProjectId;
    if (!projectId) return null;

    // Use the specified network, or default appropriately
    const network = specificNetwork || 
                   (isTestnet ? 'Arbitrum Sepolia' : 
                   (builder.networks?.[0] || 'Base'));
    
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