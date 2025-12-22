import { useQuery, QueryKey } from '@tanstack/react-query';
import { useAuth } from '@/context/auth-context';
import { useNetworkInfo } from './useNetworkInfo';
import { Builder } from '@/app/builders/builders-data';
import { getClientForNetwork } from '@/lib/apollo-client';
import { GET_PROJECTS_FOR_USER_BASE_SEPOLIA, GET_PROJECTS_FOR_USER_BASE_MAINNET, GET_PROJECTS_FOR_USER_ARBITRUM_MAINNET } from '@/lib/graphql/builders-queries';
import { formatTimePeriod } from "@/app/utils/time-utils";
import { formatUnits } from 'ethers/lib/utils';
import { useSupabaseBuilders } from './useSupabaseBuilders';
import { useBuilders } from '@/context/builders-context';
import { useChainId } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { USE_GOLDSKY_V1_DATA } from '@/app/config/subgraph-endpoints';

/**
 * Hook to fetch ALL builders where the user has staked tokens
 * Handles both testnet and mainnet with different GraphQL queries and data structures
 * - Mainnet: Uses GET_ACCOUNT_USER_BUILDERS_PROJECTS query (new approach from documentation)
 * - Testnet: Uses the existing builder subnet logic from the main builders context
 */
export const useUserStakedBuilders = () => {
  const { userAddress, isAuthenticated } = useAuth();
  const { isTestnet } = useNetworkInfo();
  const chainId = useChainId();
  const { supabaseBuilders } = useSupabaseBuilders();
  const { builders } = useBuilders();

  const isBaseSepolia = chainId === baseSepolia.id;

  // Create a unique query key
  const queryKey: QueryKey = ['userStakedBuilders', { userAddress, isTestnet, isBaseSepolia, buildersCount: builders?.length || 0 }];

  // The query is enabled only if the user is authenticated and has an address
  // For testnet, also wait for builders to be loaded (except Base Sepolia which uses direct query)
  const isEnabled = isAuthenticated && !!userAddress && (isTestnet && !isBaseSepolia ? !!builders && builders.length > 0 : true);
  
  console.log('[useUserStakedBuilders] Query enabled:', {
    isAuthenticated,
    userAddress,
    isTestnet,
    isBaseSepolia,
    hasBuilders: !!builders,
    buildersCount: builders?.length || 0,
    isEnabled
  });

  return useQuery<Builder[], Error>({
    queryKey,
    queryFn: async () => {
      if (!userAddress) {
        return [];
      }

      if (isTestnet && isBaseSepolia) {
        // Base Sepolia: Use dedicated GraphQL query
        console.log('[useUserStakedBuilders] Fetching Base Sepolia staked builders for:', userAddress);
        
        const baseSepoliaClient = getClientForNetwork('BaseSepolia');
        if (!baseSepoliaClient) {
          throw new Error('Could not get Apollo client for Base Sepolia');
        }

        const response = await baseSepoliaClient.query<{ buildersUsers?: { items?: Array<{
          project: {
            id: string;
            name: string;
            slug: string;
            description: string;
            website: string;
            image: string;
            admin: string;
            totalStaked: string;
            totalUsers: string;
            minimalDeposit: string;
            withdrawLockPeriodAfterDeposit: string;
            startsAt: string;
            chainId: string;
            contractAddress: string;
          };
          staked: string;
          lastStake: string;
          claimLockEnd: string;
        }> } }>({
          query: GET_PROJECTS_FOR_USER_BASE_SEPOLIA,
          variables: { userAddress },
          fetchPolicy: 'no-cache',
        });

        console.log('[useUserStakedBuilders] Raw GraphQL response:', response);
        console.log('[useUserStakedBuilders] Response data:', response.data);
        
        // Handle both items wrapper and direct array formats
        const buildersUsers = response.data?.buildersUsers?.items || [];
        console.log(`[useUserStakedBuilders] Found ${buildersUsers.length} Base Sepolia builders where user has staked`);

        const stakedBuilders: Builder[] = buildersUsers
          .filter((user) => user.project && parseFloat(user.staked) > 0)
          .map((user) => {
            const userStakedAmount = parseFloat(formatUnits(user.staked, 18));
            const totalStakedInMor = Number(user.project.totalStaked || '0') / 1e18;
            const minDepositInMor = Number(user.project.minimalDeposit || '0') / 1e18;
            const lockPeriodSeconds = parseInt(user.project.withdrawLockPeriodAfterDeposit || '0', 10);
            const lockPeriodFormatted = formatTimePeriod(lockPeriodSeconds);
            const stakingCount = parseInt(user.project.totalUsers || '0', 10);

            const builder: Builder = {
              id: user.project.id,
              mainnetProjectId: user.project.id,
              name: user.project.name,
              description: user.project.description || '',
              long_description: user.project.description || '',
              admin: user.project.admin,
              networks: ['Base Sepolia'],
              network: 'Base Sepolia',
              totalStaked: totalStakedInMor,
              totalClaimed: 0,
              minDeposit: minDepositInMor,
              lockPeriod: lockPeriodFormatted,
              withdrawLockPeriodRaw: lockPeriodSeconds,
              stakingCount: stakingCount,
              userStake: userStakedAmount,
              website: user.project.website || '',
              image_src: user.project.image || '',
              image: user.project.image || '',
              tags: [],
              github_url: '',
              twitter_url: '',
              discord_url: '',
              contributors: 0,
              github_stars: 0,
              reward_types: [],
              reward_types_detail: [],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              startsAt: user.project.startsAt || '',
              builderUsers: [{
                id: `${user.project.id}-${userAddress}`,
                address: userAddress,
                staked: user.staked,
                claimed: '0',
                claimLockEnd: user.claimLockEnd,
                lastStake: user.lastStake,
              }],
            };

            return builder;
          });

        return stakedBuilders;
      } else if (isTestnet) {
        // For other testnets (Arbitrum Sepolia), use builders from the context and filter by user stakes
        console.log('[useUserStakedBuilders] Fetching testnet staked builders for:', userAddress);
        
        if (!builders || builders.length === 0) {
          console.log('[useUserStakedBuilders] No builders available from context');
          return [];
        }

        // Filter builders where the user has staked tokens
        const userStakedBuilders = builders.filter((builder: Builder) => {
          // Check if the builder has builderUsers data and if the user has staked
          if (builder.builderUsers && Array.isArray(builder.builderUsers)) {
            const userStake = builder.builderUsers.find(user => 
              user.address.toLowerCase() === userAddress.toLowerCase()
            );
            
            if (userStake && userStake.staked && parseFloat(userStake.staked) > 0) {
              // Add userStake property to the builder for display
              const userStakedAmount = parseFloat(formatUnits(userStake.staked, 18));
              const builderWithStake = builder;
              builderWithStake.userStake = userStakedAmount;
              return true;
            }
          }
          return false;
        });

        console.log(`[useUserStakedBuilders] Found ${userStakedBuilders.length} testnet builders where user has staked`);
        return userStakedBuilders;
      }

      // Mainnet logic: Fetch from both Base and Arbitrum networks
      console.log('[useUserStakedBuilders] Fetching user staked builders for:', userAddress);

      let baseBuilderUsers: Array<{
        project: {
          id: string;
          name: string;
          slug: string;
          description: string;
          website: string;
          image: string;
          admin: string;
          totalStaked: string;
          totalUsers: string;
          minimalDeposit: string;
          withdrawLockPeriodAfterDeposit: string;
          startsAt: string;
          chainId: string;
          contractAddress: string;
        };
        staked: string;
        lastStake: string;
        claimLockEnd: string;
      }> = [];
      
      let arbitrumBuilderUsers: Array<{
        project: {
          id: string;
          name: string;
          slug: string;
          description: string;
          website: string;
          image: string;
          admin: string;
          totalStaked: string;
          totalUsers: string;
          minimalDeposit: string;
          withdrawLockPeriodAfterDeposit: string;
          startsAt: string;
          chainId: string;
          contractAddress: string;
        };
        staked: string;
        lastStake: string;
        claimLockEnd: string;
      }> = [];

      if (USE_GOLDSKY_V1_DATA) {
        // Use Goldsky API routes (server-side extracted and transformed data)
        console.log('[useUserStakedBuilders] Mainnet: Using Goldsky V1 data via API routes');
        
        const [baseApiResponse, arbitrumApiResponse] = await Promise.all([
          fetch(`/api/builders/goldsky/user-staked/base?userAddress=${encodeURIComponent(userAddress)}`),
          fetch(`/api/builders/goldsky/user-staked/arbitrum?userAddress=${encodeURIComponent(userAddress)}`)
        ]);

        if (!baseApiResponse.ok || !arbitrumApiResponse.ok) {
          throw new Error(`Failed to fetch Goldsky user staked builders data: Base=${baseApiResponse.status}, Arbitrum=${arbitrumApiResponse.status}`);
        }

        const baseData = await baseApiResponse.json();
        const arbitrumData = await arbitrumApiResponse.json();

        baseBuilderUsers = baseData.buildersUsers?.items || [];
        arbitrumBuilderUsers = arbitrumData.buildersUsers?.items || [];
      } else {
        // Use direct Ponder V4 GraphQL queries
        const baseClient = getClientForNetwork('Base');
        const arbitrumClient = getClientForNetwork('Arbitrum');

        if (!baseClient || !arbitrumClient) {
          throw new Error('Could not get Apollo clients for Base or Arbitrum');
        }

        // Fetch from both Base and Arbitrum networks using new queries
        const [baseResponse, arbitrumResponse] = await Promise.all([
          baseClient.query<{ buildersUsers?: { items?: Array<{
            project: {
              id: string;
              name: string;
              slug: string;
              description: string;
              website: string;
              image: string;
              admin: string;
              totalStaked: string;
              totalUsers: string;
              minimalDeposit: string;
              withdrawLockPeriodAfterDeposit: string;
              startsAt: string;
              chainId: string;
              contractAddress: string;
            };
            staked: string;
            lastStake: string;
            claimLockEnd: string;
          }> } }>({
            query: GET_PROJECTS_FOR_USER_BASE_MAINNET,
            variables: { userAddress },
            fetchPolicy: 'no-cache',
          }),
          arbitrumClient.query<{ buildersUsers?: { items?: Array<{
            project: {
              id: string;
              name: string;
              slug: string;
              description: string;
              website: string;
              image: string;
              admin: string;
              totalStaked: string;
              totalUsers: string;
              minimalDeposit: string;
              withdrawLockPeriodAfterDeposit: string;
              startsAt: string;
              chainId: string;
              contractAddress: string;
            };
            staked: string;
            lastStake: string;
            claimLockEnd: string;
          }> } }>({
            query: GET_PROJECTS_FOR_USER_ARBITRUM_MAINNET,
            variables: { userAddress },
            fetchPolicy: 'no-cache',
          })
        ]);

        // Handle both items wrapper and direct array formats
        baseBuilderUsers = baseResponse.data?.buildersUsers?.items || [];
        arbitrumBuilderUsers = arbitrumResponse.data?.buildersUsers?.items || [];
      }

      console.log(`[useUserStakedBuilders] Found ${baseBuilderUsers.length} Base builders and ${arbitrumBuilderUsers.length} Arbitrum builders`);

      const stakedBuilders: Builder[] = [];

      // Process Base builders
      baseBuilderUsers
        .filter((user) => user.project && parseFloat(user.staked) > 0)
        .forEach((user) => {
          const userStakedAmount = parseFloat(formatUnits(user.staked, 18));

          // Find corresponding Supabase builder data for metadata
          const supabaseBuilder = supabaseBuilders?.find(b => 
            b.name.toLowerCase() === user.project.name.toLowerCase()
          );

          const totalStakedInMor = Number(user.project.totalStaked || '0') / 1e18;
          const minDepositInMor = Number(user.project.minimalDeposit || '0') / 1e18;
          const lockPeriodSeconds = parseInt(user.project.withdrawLockPeriodAfterDeposit || '0', 10);
          const lockPeriodFormatted = formatTimePeriod(lockPeriodSeconds);
          const stakingCount = parseInt(user.project.totalUsers || '0', 10);

          const builder: Builder = {
            id: user.project.id,
            mainnetProjectId: user.project.id,
            name: user.project.name,
            description: supabaseBuilder?.description || user.project.description || `${user.project.name} (on Base)`,
            long_description: supabaseBuilder?.long_description || user.project.description || '',
            admin: user.project.admin,
            networks: ['Base'],
            network: 'Base',
            totalStaked: totalStakedInMor,
            minDeposit: minDepositInMor,
            lockPeriod: lockPeriodFormatted,
            withdrawLockPeriodRaw: lockPeriodSeconds,
            stakingCount: stakingCount,
            userStake: userStakedAmount,
            website: supabaseBuilder?.website || user.project.website || '',
            image_src: supabaseBuilder?.image_src || user.project.image || '',
            image: supabaseBuilder?.image_src || user.project.image || '',
            tags: supabaseBuilder?.tags || [],
            github_url: supabaseBuilder?.github_url || '',
            twitter_url: supabaseBuilder?.twitter_url || '',
            discord_url: supabaseBuilder?.discord_url || '',
            contributors: supabaseBuilder?.contributors || 0,
            github_stars: supabaseBuilder?.github_stars || 0,
            reward_types: [],
            reward_types_detail: [],
            created_at: supabaseBuilder?.created_at || new Date().toISOString(),
            updated_at: supabaseBuilder?.updated_at || new Date().toISOString(),
            startsAt: user.project.startsAt || '',
            builderUsers: [{
              id: `${user.project.id}-${userAddress}`,
              address: userAddress,
              staked: user.staked,
              claimed: "0",
              claimLockEnd: user.claimLockEnd,
              lastStake: user.lastStake,
            }]
          };

          stakedBuilders.push(builder);
        });

      // Process Arbitrum builders
      arbitrumBuilderUsers
        .filter((user) => user.project && parseFloat(user.staked) > 0)
        .forEach((user) => {
          const userStakedAmount = parseFloat(formatUnits(user.staked, 18));

          // Find corresponding Supabase builder data for metadata
          const supabaseBuilder = supabaseBuilders?.find(b => 
            b.name.toLowerCase() === user.project.name.toLowerCase()
          );

          const totalStakedInMor = Number(user.project.totalStaked || '0') / 1e18;
          const minDepositInMor = Number(user.project.minimalDeposit || '0') / 1e18;
          const lockPeriodSeconds = parseInt(user.project.withdrawLockPeriodAfterDeposit || '0', 10);
          const lockPeriodFormatted = formatTimePeriod(lockPeriodSeconds);
          const stakingCount = parseInt(user.project.totalUsers || '0', 10);

          const builder: Builder = {
            id: user.project.id,
            mainnetProjectId: user.project.id,
            name: user.project.name,
            description: supabaseBuilder?.description || user.project.description || `${user.project.name} (on Arbitrum)`,
            long_description: supabaseBuilder?.long_description || user.project.description || '',
            admin: user.project.admin,
            networks: ['Arbitrum'],
            network: 'Arbitrum',
            totalStaked: totalStakedInMor,
            minDeposit: minDepositInMor,
            lockPeriod: lockPeriodFormatted,
            withdrawLockPeriodRaw: lockPeriodSeconds,
            stakingCount: stakingCount,
            userStake: userStakedAmount,
            website: supabaseBuilder?.website || user.project.website || '',
            image_src: supabaseBuilder?.image_src || user.project.image || '',
            image: supabaseBuilder?.image_src || user.project.image || '',
            tags: supabaseBuilder?.tags || [],
            github_url: supabaseBuilder?.github_url || '',
            twitter_url: supabaseBuilder?.twitter_url || '',
            discord_url: supabaseBuilder?.discord_url || '',
            contributors: supabaseBuilder?.contributors || 0,
            github_stars: supabaseBuilder?.github_stars || 0,
            reward_types: [],
            reward_types_detail: [],
            created_at: supabaseBuilder?.created_at || new Date().toISOString(),
            updated_at: supabaseBuilder?.updated_at || new Date().toISOString(),
            startsAt: user.project.startsAt || '',
            builderUsers: [{
              id: `${user.project.id}-${userAddress}`,
              address: userAddress,
              staked: user.staked,
              claimed: "0",
              claimLockEnd: user.claimLockEnd,
              lastStake: user.lastStake,
            }]
          };

          stakedBuilders.push(builder);
        });

      console.log(`[useUserStakedBuilders] Processed ${stakedBuilders.length} total staked builders`);
      return stakedBuilders;
    },
    enabled: isEnabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2
  });
}; 