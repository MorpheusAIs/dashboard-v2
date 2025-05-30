import { useQuery, QueryKey } from '@tanstack/react-query';
import { useAuth } from '@/context/auth-context';
import { useNetworkInfo } from './useNetworkInfo';
import { Builder } from '@/app/builders/builders-data';
import { getClientForNetwork } from '@/lib/apollo-client';
import { GET_ACCOUNT_USER_BUILDERS_PROJECTS } from '@/lib/graphql/builders-queries';
import { formatTimePeriod } from "@/app/utils/time-utils";
import { formatUnits } from 'ethers/lib/utils';
import { useSupabaseBuilders } from './useSupabaseBuilders';
import { useBuilders } from '@/context/builders-context';

interface BuilderUser {
  id: string;
  address: string;
  staked: string;
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
    totalClaimed?: string;
    [key: string]: string | undefined;
  };
}

/**
 * Hook to fetch ALL builders where the user has staked tokens
 * Handles both testnet and mainnet with different GraphQL queries and data structures
 * - Mainnet: Uses GET_ACCOUNT_USER_BUILDERS_PROJECTS query (new approach from documentation)
 * - Testnet: Uses the existing builder subnet logic from the main builders context
 */
export const useUserStakedBuilders = () => {
  const { userAddress, isAuthenticated } = useAuth();
  const { isTestnet } = useNetworkInfo();
  const { supabaseBuilders } = useSupabaseBuilders();
  const { builders } = useBuilders();

  // Create a unique query key
  const queryKey: QueryKey = ['userStakedBuilders', { userAddress, isTestnet, buildersCount: builders?.length || 0 }];

  // The query is enabled only if the user is authenticated and has an address
  // For testnet, also wait for builders to be loaded
  const isEnabled = isAuthenticated && !!userAddress && (isTestnet ? !!builders && builders.length > 0 : true);

  return useQuery<Builder[], Error>({
    queryKey,
    queryFn: async () => {
      if (!userAddress) {
        return [];
      }

      if (isTestnet) {
        // For testnet, use builders from the context and filter by user stakes
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

      // Mainnet logic (unchanged)
      console.log('[useUserStakedBuilders] Fetching user staked builders for:', userAddress);

      const baseClient = getClientForNetwork('Base');
      const arbitrumClient = getClientForNetwork('Arbitrum');

      if (!baseClient || !arbitrumClient) {
        throw new Error('Could not get Apollo clients for Base or Arbitrum');
      }

      // Fetch from both Base and Arbitrum networks
      const [baseResponse, arbitrumResponse] = await Promise.all([
        baseClient.query<{ buildersUsers: BuilderUser[] }>({
          query: GET_ACCOUNT_USER_BUILDERS_PROJECTS,
          variables: { address: userAddress },
          fetchPolicy: 'no-cache',
        }),
        arbitrumClient.query<{ buildersUsers: BuilderUser[] }>({
          query: GET_ACCOUNT_USER_BUILDERS_PROJECTS,
          variables: { address: userAddress },
          fetchPolicy: 'no-cache',
        })
      ]);

      const baseBuilderUsers = baseResponse.data?.buildersUsers || [];
      const arbitrumBuilderUsers = arbitrumResponse.data?.buildersUsers || [];

      console.log(`[useUserStakedBuilders] Found ${baseBuilderUsers.length} Base builders and ${arbitrumBuilderUsers.length} Arbitrum builders`);

      const stakedBuilders: Builder[] = [];

      // Process Base builders
      baseBuilderUsers.forEach((user: BuilderUser) => {
        if (!user.buildersProject) return;
        
        const userStakedAmount = parseFloat(formatUnits(user.staked, 18));
        
        // Skip if staked amount is zero
        if (userStakedAmount <= 0) return;

        // Find corresponding Supabase builder data for metadata
        const supabaseBuilder = supabaseBuilders?.find(b => 
          b.name.toLowerCase() === user.buildersProject.name.toLowerCase()
        );

        const totalStakedInMor = Number(user.buildersProject.totalStaked || '0') / 1e18;
        const minDepositInMor = Number(user.buildersProject.minimalDeposit || '0') / 1e18;
        const lockPeriodSeconds = parseInt(user.buildersProject.withdrawLockPeriodAfterDeposit || '0', 10);
        const lockPeriodFormatted = formatTimePeriod(lockPeriodSeconds);

        const builder: Builder = {
          id: user.buildersProject.id,
          mainnetProjectId: user.buildersProject.id,
          name: user.buildersProject.name,
          description: supabaseBuilder?.description || `${user.buildersProject.name} (on Base)`,
          long_description: supabaseBuilder?.long_description || '',
          admin: user.buildersProject.admin,
          networks: ['Base'],
          network: 'Base',
          totalStaked: totalStakedInMor,
          minDeposit: minDepositInMor,
          lockPeriod: lockPeriodFormatted,
          withdrawLockPeriodRaw: lockPeriodSeconds,
          stakingCount: parseInt(user.buildersProject.totalUsers || '0', 10),
          userStake: userStakedAmount,
          website: supabaseBuilder?.website || '',
          image_src: supabaseBuilder?.image_src || '',
          image: supabaseBuilder?.image_src || '',
          tags: supabaseBuilder?.tags || [],
          github_url: supabaseBuilder?.github_url || '',
          twitter_url: supabaseBuilder?.twitter_url || '',
          discord_url: supabaseBuilder?.discord_url || '',
          contributors: supabaseBuilder?.contributors || 0,
          github_stars: supabaseBuilder?.github_stars || 0,
          reward_types: supabaseBuilder?.reward_types || ['TBA'],
          reward_types_detail: supabaseBuilder?.reward_types_detail || [],
          created_at: supabaseBuilder?.created_at || new Date().toISOString(),
          updated_at: supabaseBuilder?.updated_at || new Date().toISOString(),
          startsAt: user.buildersProject.startsAt,
          builderUsers: [{
            id: user.id,
            address: user.address,
            staked: user.staked,
            claimed: "0",
            claimLockEnd: user.buildersProject.claimLockEnd || "0",
            lastStake: user.lastStake,
          }]
        };

        stakedBuilders.push(builder);
      });

      // Process Arbitrum builders
      arbitrumBuilderUsers.forEach((user: BuilderUser) => {
        if (!user.buildersProject) return;
        
        const userStakedAmount = parseFloat(formatUnits(user.staked, 18));
        
        // Skip if staked amount is zero
        if (userStakedAmount <= 0) return;

        // Find corresponding Supabase builder data for metadata
        const supabaseBuilder = supabaseBuilders?.find(b => 
          b.name.toLowerCase() === user.buildersProject.name.toLowerCase()
        );

        const totalStakedInMor = Number(user.buildersProject.totalStaked || '0') / 1e18;
        const minDepositInMor = Number(user.buildersProject.minimalDeposit || '0') / 1e18;
        const lockPeriodSeconds = parseInt(user.buildersProject.withdrawLockPeriodAfterDeposit || '0', 10);
        const lockPeriodFormatted = formatTimePeriod(lockPeriodSeconds);

        const builder: Builder = {
          id: user.buildersProject.id,
          mainnetProjectId: user.buildersProject.id,
          name: user.buildersProject.name,
          description: supabaseBuilder?.description || `${user.buildersProject.name} (on Arbitrum)`,
          long_description: supabaseBuilder?.long_description || '',
          admin: user.buildersProject.admin,
          networks: ['Arbitrum'],
          network: 'Arbitrum',
          totalStaked: totalStakedInMor,
          minDeposit: minDepositInMor,
          lockPeriod: lockPeriodFormatted,
          withdrawLockPeriodRaw: lockPeriodSeconds,
          stakingCount: parseInt(user.buildersProject.totalUsers || '0', 10),
          userStake: userStakedAmount,
          website: supabaseBuilder?.website || '',
          image_src: supabaseBuilder?.image_src || '',
          image: supabaseBuilder?.image_src || '',
          tags: supabaseBuilder?.tags || [],
          github_url: supabaseBuilder?.github_url || '',
          twitter_url: supabaseBuilder?.twitter_url || '',
          discord_url: supabaseBuilder?.discord_url || '',
          contributors: supabaseBuilder?.contributors || 0,
          github_stars: supabaseBuilder?.github_stars || 0,
          reward_types: supabaseBuilder?.reward_types || ['TBA'],
          reward_types_detail: supabaseBuilder?.reward_types_detail || [],
          created_at: supabaseBuilder?.created_at || new Date().toISOString(),
          updated_at: supabaseBuilder?.updated_at || new Date().toISOString(),
          startsAt: user.buildersProject.startsAt,
          builderUsers: [{
            id: user.id,
            address: user.address,
            staked: user.staked,
            claimed: "0",
            claimLockEnd: user.buildersProject.claimLockEnd || "0",
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