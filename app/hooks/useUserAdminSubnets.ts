import { useQuery, QueryKey } from '@tanstack/react-query';
import { useAuth } from '@/context/auth-context';
import { useNetworkInfo } from './useNetworkInfo';
import { Builder } from '@/app/builders/builders-data';
import { getClientForNetwork } from '@/lib/apollo-client';
import { GET_SUBNETS_BY_ADMIN_BASE_SEPOLIA } from '@/lib/graphql/builders-queries';
import { formatTimePeriod } from "@/app/utils/time-utils";
import { useChainId } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { useBuilders } from '@/context/builders-context';

/**
 * Hook to fetch subnets where the user is the admin
 * Handles both testnet and mainnet with different data sources
 * - Base Sepolia: Uses dedicated GraphQL query
 * - Other testnets: Filters builders from context
 * - Mainnet: Filters builders from context
 */
export const useUserAdminSubnets = () => {
  const { userAddress, isAuthenticated } = useAuth();
  const { isTestnet } = useNetworkInfo();
  const chainId = useChainId();
  const { builders, isLoading } = useBuilders();

  const isBaseSepolia = chainId === baseSepolia.id;

  // Create a unique query key
  const queryKey: QueryKey = ['userAdminSubnets', { userAddress, isTestnet, isBaseSepolia }];

  // The query is enabled only if the user is authenticated and has an address
  // For Base Sepolia, we don't need to wait for builders to load since we query directly
  const isEnabled = isAuthenticated && !!userAddress && (isBaseSepolia || !!builders);
  
  console.log('[useUserAdminSubnets] Query enabled:', {
    isAuthenticated,
    userAddress,
    isBaseSepolia,
    hasBuilders: !!builders,
    isEnabled
  });

  return useQuery<Builder[] | null, Error>({
    queryKey,
    queryFn: async () => {
      if (!userAddress) {
        return null;
      }

      if (isBaseSepolia) {
        // Base Sepolia: Use dedicated GraphQL query
        console.log('[useUserAdminSubnets] Fetching Base Sepolia admin subnets for:', userAddress);
        
        const baseSepoliaClient = getClientForNetwork('BaseSepolia');
        if (!baseSepoliaClient) {
          throw new Error('Could not get Apollo client for Base Sepolia');
        }

        const response = await baseSepoliaClient.query<{ buildersProjects?: Array<{
          id: string;
          name: string;
          slug: string;
          description: string;
          website: string;
          image: string;
          totalStaked: string;
          totalUsers: string;
          minimalDeposit: string;
          withdrawLockPeriodAfterDeposit: string;
          chainId: string;
        }> }>({
          query: GET_SUBNETS_BY_ADMIN_BASE_SEPOLIA,
          variables: { adminAddress: userAddress },
          fetchPolicy: 'no-cache',
        });

        console.log('[useUserAdminSubnets] Raw GraphQL response:', response);
        console.log('[useUserAdminSubnets] Response data:', response.data);
        console.log('[useUserAdminSubnets] buildersProjects:', response.data?.buildersProjects);
        
        const projects = response.data?.buildersProjects || [];
        console.log(`[useUserAdminSubnets] Found ${projects.length} Base Sepolia admin subnets`);

        const adminSubnets: Builder[] = projects.map((project) => {
          const totalStakedInMor = Number(project.totalStaked || '0') / 1e18;
          const minDepositInMor = Number(project.minimalDeposit || '0') / 1e18;
          const lockPeriodSeconds = parseInt(project.withdrawLockPeriodAfterDeposit || '0', 10);
          const lockPeriodFormatted = formatTimePeriod(lockPeriodSeconds);

          const builder: Builder = {
            id: project.id,
            mainnetProjectId: project.id,
            name: project.name,
            description: project.description || '',
            long_description: project.description || '',
            admin: userAddress,
            networks: ['Base Sepolia'],
            network: 'Base Sepolia',
            totalStaked: totalStakedInMor,
            totalClaimed: 0,
            minDeposit: minDepositInMor,
            lockPeriod: lockPeriodFormatted,
            withdrawLockPeriodRaw: lockPeriodSeconds,
            stakingCount: parseInt(project.totalUsers || '0', 10),
            website: project.website || '',
            image_src: project.image || '',
            image: project.image || '',
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
            startsAt: '',
          };

          return builder;
        });

        return adminSubnets;
      }

      // For other networks, filter builders from context
      if (!builders) {
        return null;
      }

      const adminSubnets = builders.filter((b: Builder) => 
        b.admin?.toLowerCase() === userAddress.toLowerCase()
      );

      console.log(`[useUserAdminSubnets] Found ${adminSubnets.length} admin subnets from context`);
      return adminSubnets;
    },
    enabled: isEnabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2
  });
};

