import { useQuery, QueryKey } from '@tanstack/react-query';
import { useAuth } from '@/context/auth-context';
import { useNetworkInfo } from './useNetworkInfo';
import { Builder } from '@/app/builders/builders-data';
import { getClientForNetwork } from '@/lib/apollo-client';
import { GET_PROJECTS_BY_ADMIN_BASE_SEPOLIA, GET_PROJECTS_BY_ADMIN_BASE_MAINNET, GET_PROJECTS_BY_ADMIN_ARBITRUM_MAINNET } from '@/lib/graphql/builders-queries';
import { formatTimePeriod } from "@/app/utils/time-utils";
import { useChainId } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { useBuilders } from '@/context/builders-context';
import { USE_GOLDSKY_V1_DATA } from '@/app/config/subgraph-endpoints';

/**
 * Hook to fetch subnets where the user is the admin
 * Handles both testnet and mainnet with different data sources
 * - Base Sepolia: Uses dedicated GraphQL query
 * - Base Mainnet: Uses dedicated GraphQL query
 * - Arbitrum Mainnet: Uses dedicated GraphQL query
 * - Other testnets: Filters builders from context
 */
export const useUserAdminSubnets = () => {
  const { userAddress, isAuthenticated } = useAuth();
  const { isTestnet } = useNetworkInfo();
  const chainId = useChainId();
  const { builders } = useBuilders();

  const isBaseSepolia = chainId === baseSepolia.id;

  // Create a unique query key
  const queryKey: QueryKey = ['userAdminSubnets', { userAddress, isTestnet, isBaseSepolia }];

  // The query is enabled only if the user is authenticated and has an address
  // For Base Sepolia and mainnet networks, we query directly
  // For other testnets, we need builders to be loaded
  const isEnabled = isAuthenticated && !!userAddress && (isBaseSepolia || !isTestnet || !!builders);
  
  console.log('[useUserAdminSubnets] Query enabled:', {
    isAuthenticated,
    userAddress,
    isTestnet,
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

        const response = await baseSepoliaClient.query<{ buildersProjects?: { items?: Array<{
          id: string;
          name: string;
          admin: string;
          slug: string;
          description: string;
          website: string;
          image: string;
          totalStaked: string;
          totalUsers: string;
          minimalDeposit: string;
          withdrawLockPeriodAfterDeposit: string;
          startsAt: string;
          chainId: string;
        }> } }>({
          query: GET_PROJECTS_BY_ADMIN_BASE_SEPOLIA,
          variables: { adminAddress: userAddress },
          fetchPolicy: 'no-cache',
        });

        console.log('[useUserAdminSubnets] Raw GraphQL response:', response);
        console.log('[useUserAdminSubnets] Response data:', response.data);
        
        // Handle both items wrapper and direct array formats
        const projects = response.data?.buildersProjects?.items || [];
        console.log(`[useUserAdminSubnets] Found ${projects.length} Base Sepolia admin subnets`);

        const adminSubnets: Builder[] = projects.map((project) => {
          const totalStakedInMor = Number(project.totalStaked || '0') / 1e18;
          const minDepositInMor = Number(project.minimalDeposit || '0') / 1e18;
          const lockPeriodSeconds = parseInt(project.withdrawLockPeriodAfterDeposit || '0', 10);
          const lockPeriodFormatted = formatTimePeriod(lockPeriodSeconds);
          const stakingCount = parseInt(project.totalUsers || '0', 10);

          const builder: Builder = {
            id: project.id,
            mainnetProjectId: project.id,
            name: project.name,
            description: project.description || '',
            long_description: project.description || '',
            admin: project.admin || userAddress,
            networks: ['Base Sepolia'],
            network: 'Base Sepolia',
            totalStaked: totalStakedInMor,
            totalClaimed: 0,
            minDeposit: minDepositInMor,
            lockPeriod: lockPeriodFormatted,
            withdrawLockPeriodRaw: lockPeriodSeconds,
            stakingCount: stakingCount,
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
            startsAt: project.startsAt || '',
          };

          return builder;
        });

        return adminSubnets;
      }

      if (!isTestnet) {
        // Mainnet: Fetch from both Base and Arbitrum networks
        console.log('[useUserAdminSubnets] Fetching mainnet admin subnets for:', userAddress);

        let baseProjects: Array<{
          id: string;
          name: string;
          admin: string;
          slug: string;
          description: string;
          website: string;
          image: string;
          totalStaked: string;
          totalUsers: string;
          minimalDeposit: string;
          withdrawLockPeriodAfterDeposit: string;
          startsAt: string;
          chainId: string;
        }> = [];
        
        let arbitrumProjects: Array<{
          id: string;
          name: string;
          admin: string;
          slug: string;
          description: string;
          website: string;
          image: string;
          totalStaked: string;
          totalUsers: string;
          minimalDeposit: string;
          withdrawLockPeriodAfterDeposit: string;
          startsAt: string;
          chainId: string;
        }> = [];

        if (USE_GOLDSKY_V1_DATA) {
          // Use Goldsky API routes (server-side extracted and transformed data)
          console.log('[useUserAdminSubnets] Mainnet: Using Goldsky V1 data via API routes');
          
          const [baseApiResponse, arbitrumApiResponse] = await Promise.all([
            fetch(`/api/builders/goldsky/user-admin/base?adminAddress=${encodeURIComponent(userAddress)}`),
            fetch(`/api/builders/goldsky/user-admin/arbitrum?adminAddress=${encodeURIComponent(userAddress)}`)
          ]);

          if (!baseApiResponse.ok || !arbitrumApiResponse.ok) {
            throw new Error(`Failed to fetch Goldsky user admin subnets data: Base=${baseApiResponse.status}, Arbitrum=${arbitrumApiResponse.status}`);
          }

          const baseData = await baseApiResponse.json();
          const arbitrumData = await arbitrumApiResponse.json();

          baseProjects = baseData.buildersProjects?.items || [];
          arbitrumProjects = arbitrumData.buildersProjects?.items || [];
        } else {
          // Use direct Ponder V4 GraphQL queries
          const baseClient = getClientForNetwork('Base');
          const arbitrumClient = getClientForNetwork('Arbitrum');

          if (!baseClient || !arbitrumClient) {
            throw new Error('Could not get Apollo clients for Base or Arbitrum');
          }

          // Fetch from both Base and Arbitrum networks
          const [baseResponse, arbitrumResponse] = await Promise.all([
            baseClient.query<{ buildersProjects?: { items?: Array<{
              id: string;
              name: string;
              admin: string;
              slug: string;
              description: string;
              website: string;
              image: string;
              totalStaked: string;
              totalUsers: string;
              minimalDeposit: string;
              withdrawLockPeriodAfterDeposit: string;
              startsAt: string;
              chainId: string;
            }> } }>({
              query: GET_PROJECTS_BY_ADMIN_BASE_MAINNET,
              variables: { adminAddress: userAddress },
              fetchPolicy: 'no-cache',
            }),
            arbitrumClient.query<{ buildersProjects?: { items?: Array<{
              id: string;
              name: string;
              admin: string;
              slug: string;
              description: string;
              website: string;
              image: string;
              totalStaked: string;
              totalUsers: string;
              minimalDeposit: string;
              withdrawLockPeriodAfterDeposit: string;
              startsAt: string;
              chainId: string;
            }> } }>({
              query: GET_PROJECTS_BY_ADMIN_ARBITRUM_MAINNET,
              variables: { adminAddress: userAddress },
              fetchPolicy: 'no-cache',
            })
          ]);

          // Handle both items wrapper and direct array formats
          baseProjects = baseResponse.data?.buildersProjects?.items || [];
          arbitrumProjects = arbitrumResponse.data?.buildersProjects?.items || [];
        }

        console.log(`[useUserAdminSubnets] Found ${baseProjects.length} Base admin subnets and ${arbitrumProjects.length} Arbitrum admin subnets`);

        const adminSubnets: Builder[] = [];

        // Process Base projects
        baseProjects.forEach((project) => {
          const totalStakedInMor = Number(project.totalStaked || '0') / 1e18;
          const minDepositInMor = Number(project.minimalDeposit || '0') / 1e18;
          const lockPeriodSeconds = parseInt(project.withdrawLockPeriodAfterDeposit || '0', 10);
          const lockPeriodFormatted = formatTimePeriod(lockPeriodSeconds);
          const stakingCount = parseInt(project.totalUsers || '0', 10);

          const builder: Builder = {
            id: project.id,
            mainnetProjectId: project.id,
            name: project.name,
            description: project.description || '',
            long_description: project.description || '',
            admin: project.admin || userAddress,
            networks: ['Base'],
            network: 'Base',
            totalStaked: totalStakedInMor,
            totalClaimed: 0,
            minDeposit: minDepositInMor,
            lockPeriod: lockPeriodFormatted,
            withdrawLockPeriodRaw: lockPeriodSeconds,
            stakingCount: stakingCount,
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
            startsAt: project.startsAt || '',
          };

          adminSubnets.push(builder);
        });

        // Process Arbitrum projects
        arbitrumProjects.forEach((project) => {
          const totalStakedInMor = Number(project.totalStaked || '0') / 1e18;
          const minDepositInMor = Number(project.minimalDeposit || '0') / 1e18;
          const lockPeriodSeconds = parseInt(project.withdrawLockPeriodAfterDeposit || '0', 10);
          const lockPeriodFormatted = formatTimePeriod(lockPeriodSeconds);
          const stakingCount = parseInt(project.totalUsers || '0', 10);

          const builder: Builder = {
            id: project.id,
            mainnetProjectId: project.id,
            name: project.name,
            description: project.description || '',
            long_description: project.description || '',
            admin: project.admin || userAddress,
            networks: ['Arbitrum'],
            network: 'Arbitrum',
            totalStaked: totalStakedInMor,
            totalClaimed: 0,
            minDeposit: minDepositInMor,
            lockPeriod: lockPeriodFormatted,
            withdrawLockPeriodRaw: lockPeriodSeconds,
            stakingCount: stakingCount,
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
            startsAt: project.startsAt || '',
          };

          adminSubnets.push(builder);
        });

        console.log(`[useUserAdminSubnets] Processed ${adminSubnets.length} total admin subnets`);
        return adminSubnets;
      }

      // For other testnets, filter builders from context
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

