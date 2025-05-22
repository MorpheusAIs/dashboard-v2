import { useQuery, QueryKey } from '@tanstack/react-query';
import { useAuth } from '@/context/auth-context';
import { useNetworkInfo } from './useNetworkInfo';
import { Builder } from '@/app/builders/builders-data';
import { getClientForNetwork } from '@/lib/apollo-client';
import { GET_USER_STAKED_BUILDERS } from '@/lib/graphql/builders-queries';
import { formatTimePeriod } from "@/app/utils/time-utils";
import { formatUnits } from 'ethers/lib/utils';
import { useSupabaseBuilders } from './useSupabaseBuilders';
import { useMorlordBuilders } from './useMorlordBuilders';

interface BuilderUser {
  id: string;
  address: string;
  staked: string;
  claimed: string;
  lastStake: string;
  buildersProject: {
    id: string;
    name: string;
    admin: string;
    minimalDeposit: string;
    totalStaked: string;
    totalUsers: string;
    withdrawLockPeriodAfterDeposit: string;
    startsAt: string;
    claimLockEnd?: string;
    [key: string]: string | undefined;
  };
}

/**
 * Hook to fetch all builders where the user has staked tokens
 * Fetches from both Arbitrum and Base networks and combines the results
 * Now filters by builder names from the Morlord API
 */
export const useUserStakedBuilders = () => {
  const { userAddress, isAuthenticated } = useAuth();
  const { isTestnet } = useNetworkInfo();
  const { supabaseBuilders } = useSupabaseBuilders();
  const { data: morlordBuilderNames, isLoading: isLoadingMorlordBuilders } = useMorlordBuilders();

  // Create a unique query key
  const queryKey: QueryKey = ['userStakedBuilders', { userAddress, isTestnet }];

  // The query is enabled only if the user is authenticated and has an address and Morlord data is loaded
  const isEnabled = isAuthenticated && !!userAddress && !isLoadingMorlordBuilders;

  return useQuery<Builder[], Error>({
    queryKey,
    queryFn: async () => {
      // If not on mainnet or user not authenticated, return empty array
      if (isTestnet || !isAuthenticated || !userAddress) {
        console.log('[useUserStakedBuilders] Not on mainnet or user not authenticated. Returning empty array.');
        return [];
      }

      console.log('[useUserStakedBuilders] Fetching user staked builders for address:', userAddress);

      // Get clients for both networks
      const baseClient = getClientForNetwork('Base');
      const arbitrumClient = getClientForNetwork('Arbitrum');

      if (!baseClient || !arbitrumClient) {
        throw new Error('[useUserStakedBuilders] Could not get Apollo clients for Base or Arbitrum');
      }

      // Execute queries on both networks
      const [baseResponse, arbitrumResponse] = await Promise.all([
        baseClient.query({
          query: GET_USER_STAKED_BUILDERS,
          variables: { address: userAddress },
          fetchPolicy: 'no-cache',
        }),
        arbitrumClient.query({
          query: GET_USER_STAKED_BUILDERS,
          variables: { address: userAddress },
          fetchPolicy: 'no-cache',
        }),
      ]);

      // Extract builder users from responses
      const baseBuilderUsers = baseResponse.data?.buildersUsers || [];
      const arbitrumBuilderUsers = arbitrumResponse.data?.buildersUsers || [];

      console.log(`[useUserStakedBuilders] Found ${baseBuilderUsers.length} staked builders on Base and ${arbitrumBuilderUsers.length} on Arbitrum`);

      // Combine and map to Builder format
      const mappedBuilders: Builder[] = [];

      // Process Base builders
      baseBuilderUsers.forEach((user: BuilderUser) => {
        if (!user.buildersProject) return;
        
        const userStakedAmount = parseFloat(formatUnits(user.staked, 18));
        
        // Skip if staked amount is zero
        if (userStakedAmount <= 0) return;

        // Check if the builder name is in our Morlord list
        const isMorlordBuilder = morlordBuilderNames?.includes(user.buildersProject.name);
        
        // Skip if not in Morlord builders list
        if (!isMorlordBuilder) {
          console.log(`[useUserStakedBuilders] Skipping Base builder ${user.buildersProject.name} - not found in Morlord builders list`);
          return;
        }

        // Find corresponding Supabase builder data
        const supabaseBuilder = supabaseBuilders?.find(b => 
          b.name.toLowerCase() === user.buildersProject.name.toLowerCase()
        );

        const totalStakedInMor = Number(user.buildersProject.totalStaked || '0') / 1e18;
        const minDepositInMor = Number(user.buildersProject.minimalDeposit || '0') / 1e18;
        const lockPeriodSeconds = parseInt(user.buildersProject.withdrawLockPeriodAfterDeposit || '0', 10);
        const lockPeriodFormatted = formatTimePeriod(lockPeriodSeconds);

        // Create builder object
        mappedBuilders.push({
          id: user.buildersProject.id,
          mainnetProjectId: user.buildersProject.id,
          name: user.buildersProject.name,
          description: supabaseBuilder?.description || '',
          long_description: supabaseBuilder?.long_description || '',
          admin: user.buildersProject.admin,
          networks: ['Base'],
          network: 'Base',
          totalStaked: totalStakedInMor,
          minDeposit: minDepositInMor,
          lockPeriod: lockPeriodFormatted,
          stakingCount: parseInt(user.buildersProject.totalUsers || '0', 10),
          website: supabaseBuilder?.website || '',
          image_src: supabaseBuilder?.image_src || '',
          image: supabaseBuilder?.image_src || '',
          tags: supabaseBuilder?.tags || [],
          github_url: supabaseBuilder?.github_url || '',
          twitter_url: supabaseBuilder?.twitter_url || '',
          discord_url: supabaseBuilder?.discord_url || '',
          contributors: supabaseBuilder?.contributors || 0,
          github_stars: supabaseBuilder?.github_stars || 0,
          reward_types: supabaseBuilder?.reward_types || [],
          reward_types_detail: supabaseBuilder?.reward_types_detail || [],
          created_at: supabaseBuilder?.created_at || '',
          updated_at: supabaseBuilder?.updated_at || '',
          startsAt: user.buildersProject.startsAt,
          userStake: userStakedAmount, // Add the user's stake amount
        });
      });

      // Process Arbitrum builders
      arbitrumBuilderUsers.forEach((user: BuilderUser) => {
        if (!user.buildersProject) return;
        
        const userStakedAmount = parseFloat(formatUnits(user.staked, 18));
        
        // Skip if staked amount is zero
        if (userStakedAmount <= 0) return;

        // Check if the builder name is in our Morlord list
        const isMorlordBuilder = morlordBuilderNames?.includes(user.buildersProject.name);
        
        // Skip if not in Morlord builders list
        if (!isMorlordBuilder) {
          console.log(`[useUserStakedBuilders] Skipping Arbitrum builder ${user.buildersProject.name} - not found in Morlord builders list`);
          return;
        }

        // Find corresponding Supabase builder data
        const supabaseBuilder = supabaseBuilders?.find(b => 
          b.name.toLowerCase() === user.buildersProject.name.toLowerCase()
        );

        const totalStakedInMor = Number(user.buildersProject.totalStaked || '0') / 1e18;
        const minDepositInMor = Number(user.buildersProject.minimalDeposit || '0') / 1e18;
        const lockPeriodSeconds = parseInt(user.buildersProject.withdrawLockPeriodAfterDeposit || '0', 10);
        const lockPeriodFormatted = formatTimePeriod(lockPeriodSeconds);

        // Create builder object
        mappedBuilders.push({
          id: user.buildersProject.id,
          mainnetProjectId: user.buildersProject.id,
          name: user.buildersProject.name,
          description: supabaseBuilder?.description || '',
          long_description: supabaseBuilder?.long_description || '',
          admin: user.buildersProject.admin,
          networks: ['Arbitrum'],
          network: 'Arbitrum',
          totalStaked: totalStakedInMor,
          minDeposit: minDepositInMor,
          lockPeriod: lockPeriodFormatted,
          stakingCount: parseInt(user.buildersProject.totalUsers || '0', 10),
          website: supabaseBuilder?.website || '',
          image_src: supabaseBuilder?.image_src || '',
          image: supabaseBuilder?.image_src || '',
          tags: supabaseBuilder?.tags || [],
          github_url: supabaseBuilder?.github_url || '',
          twitter_url: supabaseBuilder?.twitter_url || '',
          discord_url: supabaseBuilder?.discord_url || '',
          contributors: supabaseBuilder?.contributors || 0,
          github_stars: supabaseBuilder?.github_stars || 0,
          reward_types: supabaseBuilder?.reward_types || [],
          reward_types_detail: supabaseBuilder?.reward_types_detail || [],
          created_at: supabaseBuilder?.created_at || '',
          updated_at: supabaseBuilder?.updated_at || '',
          startsAt: user.buildersProject.startsAt,
          userStake: userStakedAmount, // Add the user's stake amount
        });
      });

      console.log(`[useUserStakedBuilders] Returning ${mappedBuilders.length} staked builders for user ${userAddress}`);
      
      // Log detailed information about each builder for debugging
      if (mappedBuilders.length > 0) {
        console.log('[useUserStakedBuilders] Details of user staked builders:');
        mappedBuilders.forEach((builder, index) => {
          console.log(`Builder ${index + 1}: ${builder.name}, Network: ${builder.network}, User Stake: ${builder.userStake}`);
        });
      }
      
      return mappedBuilders;
    },
    enabled: isEnabled,
  });
}; 