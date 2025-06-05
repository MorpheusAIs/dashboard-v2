import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useChainId, useAccount } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';
import { Builder } from '@/app/builders/builders-data';
import { useBuilders } from '@/context/builders-context';
import { fetchGraphQL, getEndpointForNetwork } from '@/app/graphql/client';
import { 
  GET_USER_ACCOUNT_BUILDERS_PROJECT,
  GET_BUILDERS_PROJECT_BY_ID,
  GET_BUILDER_SUBNET_BY_ID
} from '@/app/graphql/queries/builders';
import { slugToBuilderName } from '@/app/utils/supabase-utils';

interface UseIndividualBuilderResult {
  builder: Builder | null;
  isLoading: boolean;
  error: Error | null;
  isResolved: boolean;
}

export function useIndividualBuilder(slug: string): UseIndividualBuilderResult {
  const queryClient = useQueryClient();
  const chainId = useChainId();
  const { address: userAddress } = useAccount();
  const isTestnet = chainId === arbitrumSepolia.id;
  
  // Fallback to builders context
  const { builders, isLoading: isLoadingContext, error: contextError } = useBuilders();
  
  const [builder, setBuilder] = useState<Builder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isResolved, setIsResolved] = useState(false);

  // Helper function to safely get string value
  const getStringValue = (obj: Record<string, unknown>, key: string, defaultValue = ''): string => {
    const value = obj[key];
    return typeof value === 'string' ? value : defaultValue;
  };

  // Function to convert cached data to Builder object
  const convertCachedDataToBuilder = useCallback((cachedData: unknown): Builder | null => {
    try {
      if (!cachedData) return null;

      if (isTestnet) {
        // Handle testnet cached data structure
        const data = cachedData as { builderSubnet?: Record<string, unknown> };
        const subnet = data.builderSubnet;
        
        if (!subnet || typeof subnet !== 'object') return null;

        const lockPeriodSeconds = parseInt(getStringValue(subnet, 'withdrawLockPeriodAfterStake', '0'), 10);
        const totalStakedInMor = Number(getStringValue(subnet, 'totalStaked', '0')) / 1e18;
        const totalClaimedInMor = Number(getStringValue(subnet, 'totalClaimed', '0')) / 1e18;
        const minStakeInMor = Number(getStringValue(subnet, 'minStake', '0')) / 1e18;
        
        return {
          id: getStringValue(subnet, 'id'),
          mainnetProjectId: getStringValue(subnet, 'id'),
          name: getStringValue(subnet, 'name'),
          description: getStringValue(subnet, 'description'),
          long_description: getStringValue(subnet, 'description'),
          admin: getStringValue(subnet, 'owner'),
          networks: ['Arbitrum Sepolia'],
          network: 'Arbitrum Sepolia',
          totalStaked: totalStakedInMor,
          totalClaimed: totalClaimedInMor,
          minDeposit: minStakeInMor,
          lockPeriod: `${Math.floor(lockPeriodSeconds / 86400)} days`,
          withdrawLockPeriodRaw: lockPeriodSeconds,
          stakingCount: parseInt(getStringValue(subnet, 'totalUsers', '0'), 10),
          website: getStringValue(subnet, 'website'),
          image_src: getStringValue(subnet, 'image'),
          image: getStringValue(subnet, 'image'),
          tags: [],
          github_url: '',
          twitter_url: '',
          discord_url: '',
          contributors: 0,
          github_stars: 0,
          reward_types: [],
          reward_types_detail: [],
          created_at: '',
          updated_at: '',
          startsAt: getStringValue(subnet, 'startsAt'),
          builderUsers: undefined, // Type safety - we'll handle this separately if needed
        };
      } else {
        // Handle mainnet cached data structure
        const data = cachedData as { buildersUsers?: unknown[]; buildersProject?: Record<string, unknown> };
        
        let project = data.buildersProject;
        
        // If we have buildersUsers data, extract project from there
        if (data.buildersUsers && Array.isArray(data.buildersUsers) && data.buildersUsers.length > 0) {
          const firstUser = data.buildersUsers[0] as Record<string, unknown>;
          if (firstUser && typeof firstUser === 'object' && firstUser.buildersProject) {
            project = firstUser.buildersProject as Record<string, unknown>;
          }
        }
        
        if (!project || typeof project !== 'object') return null;

        const totalStakedInMor = Number(getStringValue(project, 'totalStaked', '0')) / 1e18;
        const totalClaimedInMor = Number(getStringValue(project, 'totalClaimed', '0')) / 1e18;
        const minDepositInMor = Number(getStringValue(project, 'minimalDeposit', '0')) / 1e18;
        const lockPeriodSeconds = parseInt(getStringValue(project, 'withdrawLockPeriodAfterDeposit', '0'), 10);
        
        return {
          id: getStringValue(project, 'id'),
          mainnetProjectId: getStringValue(project, 'id'),
          name: getStringValue(project, 'name'),
          description: `${getStringValue(project, 'name')} on mainnet`,
          long_description: '',
          admin: getStringValue(project, 'admin'),
          networks: ['Base'], // Default to Base, but could be Arbitrum
          network: 'Base',
          totalStaked: totalStakedInMor,
          totalClaimed: totalClaimedInMor,
          minDeposit: minDepositInMor,
          lockPeriod: `${Math.floor(lockPeriodSeconds / 86400)} days`,
          withdrawLockPeriodRaw: lockPeriodSeconds,
          stakingCount: parseInt(getStringValue(project, 'totalUsers', '0'), 10),
          website: '',
          image_src: '',
          image: '',
          tags: [],
          github_url: '',
          twitter_url: '',
          discord_url: '',
          contributors: 0,
          github_stars: 0,
          reward_types: [],
          reward_types_detail: [],
          created_at: '',
          updated_at: '',
          startsAt: getStringValue(project, 'startsAt'),
        };
      }
    } catch (error) {
      console.error('[useIndividualBuilder] Error converting cached data:', error);
      return null;
    }
  }, [isTestnet]);

  // Function to fetch individual builder data directly
  const fetchIndividualBuilder = useCallback(async (projectId: string): Promise<Builder | null> => {
    try {
      const network = isTestnet ? 'ArbitrumSepolia' : 'Base';
      const endpoint = getEndpointForNetwork(network);

      console.log(`[useIndividualBuilder] Fetching individual builder data for project ID: ${projectId}`);

      if (isTestnet) {
        const response = await fetchGraphQL(
          endpoint,
          "getBuilderSubnetById",
          GET_BUILDER_SUBNET_BY_ID,
          { id: projectId }
        ) as { data: { builderSubnet: unknown } };
                 
         return convertCachedDataToBuilder(response.data);
       } else {
         // Try fetching with user data first if user is connected
         if (userAddress) {
           try {
             const response = await fetchGraphQL(
               endpoint,
               "getUserAccountBuildersProject",
               GET_USER_ACCOUNT_BUILDERS_PROJECT,
               {
                 address: userAddress,
                 project_id: projectId
               }
             ) as { data: { buildersUsers: unknown[] } };
             
             if (response.data.buildersUsers && response.data.buildersUsers.length > 0) {
               return convertCachedDataToBuilder(response.data);
             }
           } catch (userError) {
             console.warn('[useIndividualBuilder] Error fetching with user data, falling back to project only:', userError);
           }
         }
         
         // Fetch just project data
         const response = await fetchGraphQL(
           endpoint,
           "getBuildersProjectById",
           GET_BUILDERS_PROJECT_BY_ID,
           { id: projectId }
         ) as { data: { buildersProject: unknown } };
         
         return convertCachedDataToBuilder(response.data);
      }
    } catch (error) {
      console.error('[useIndividualBuilder] Error fetching individual builder:', error);
      throw error;
    }
  }, [isTestnet, userAddress, convertCachedDataToBuilder]);

  // Main effect to resolve builder data
  useEffect(() => {
    if (!slug || typeof slug !== 'string') {
      setIsResolved(true);
      setIsLoading(false);
      return;
    }

    let isCancelled = false;
    
    const resolveBuilder = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Extract network from slug if present
        const hasNetworkSuffix = slug.includes('-base') || slug.includes('-arbitrum');
        const network = slug.includes('-base') ? 'Base' : 
                      slug.includes('-arbitrum') ? 'Arbitrum' : undefined;
        
        // Extract base name without network suffix
        const slugWithoutNetwork = hasNetworkSuffix 
          ? slug.substring(0, slug.lastIndexOf('-'))
          : slug;
        
        const builderNameFromSlug = slugToBuilderName(slugWithoutNetwork);

        // Step 1: Check cached individual builder data
        console.log(`[useIndividualBuilder] Looking for cached data for: ${builderNameFromSlug}`);
        
        // Try to find in all cached individual builder data
        const allCachedData = queryClient.getQueryCache().getAll();
        for (const query of allCachedData) {
          if (query.queryKey[0] === 'individual-builder-data') {
            const cachedBuilder = convertCachedDataToBuilder(query.state.data);
            if (cachedBuilder && cachedBuilder.name.toLowerCase() === builderNameFromSlug.toLowerCase()) {
              console.log(`[useIndividualBuilder] Found cached individual builder data for: ${builderNameFromSlug}`);
              if (!isCancelled) {
                setBuilder(cachedBuilder);
                setIsLoading(false);
                setIsResolved(true);
              }
              return;
            }
          }
        }

        // Step 2: Check builders context for project ID
        if (builders && builders.length > 0) {
          const contextBuilder = builders.find(b => {
            const nameMatches = b.name.toLowerCase() === builderNameFromSlug.toLowerCase();
            if (network) {
              return nameMatches && b.network === network;
            }
            return nameMatches;
          });

          if (contextBuilder) {
            const projectId = isTestnet ? contextBuilder.id : contextBuilder.mainnetProjectId;
            
            if (projectId) {
              console.log(`[useIndividualBuilder] Found builder in context, fetching individual data for: ${contextBuilder.name}`);
              
              try {
                const individualBuilder = await fetchIndividualBuilder(projectId);
                if (individualBuilder && !isCancelled) {
                  setBuilder(individualBuilder);
                  setIsLoading(false);
                  setIsResolved(true);
                  return;
                }
              } catch (fetchError) {
                console.warn('[useIndividualBuilder] Error fetching individual data, using context builder:', fetchError);
                // Fall back to context builder
                if (!isCancelled) {
                  setBuilder(contextBuilder);
                  setIsLoading(false);
                  setIsResolved(true);
                }
                return;
              }
            } else {
              // Use context builder if no project ID
              console.log(`[useIndividualBuilder] Using context builder (no project ID): ${contextBuilder.name}`);
              if (!isCancelled) {
                setBuilder(contextBuilder);
                setIsLoading(false);
                setIsResolved(true);
              }
              return;
            }
          }
        }

        // Step 3: Builder not found
        console.log(`[useIndividualBuilder] Builder not found: ${builderNameFromSlug}`);
        if (!isCancelled) {
          setBuilder(null);
          setIsLoading(false);
          setIsResolved(true);
        }

      } catch (error) {
        console.error('[useIndividualBuilder] Error resolving builder:', error);
        if (!isCancelled) {
          setError(error instanceof Error ? error : new Error('Unknown error'));
          setIsLoading(false);
          setIsResolved(true);
        }
      }
    };

    resolveBuilder();

    return () => {
      isCancelled = true;
    };
  }, [slug, builders, isTestnet, queryClient, convertCachedDataToBuilder, fetchIndividualBuilder]);

  return {
    builder,
    isLoading: isLoading || (isLoadingContext && !isResolved),
    error: error || contextError,
    isResolved
  };
} 