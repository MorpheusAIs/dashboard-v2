import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useChainId } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';
import { Builder } from '@/app/builders/builders-data';
import { fetchGraphQL, getEndpointForNetwork } from '@/app/graphql/client';
import { GET_BUILDERS_PROJECT_BY_NAME, GET_BUILDER_SUBNET_BY_NAME } from '@/app/graphql/queries/builders';
import { slugToBuilderName } from '@/app/utils/supabase-utils';
import { useSupabaseBuilders } from '@/app/hooks/useSupabaseBuilders';
import { mergeBuilderData } from '@/app/builders/builders-data';
import { formatTimePeriod } from '@/app/utils/time-utils';

export function useIndividualBuilder(slug: string) {
  const queryClient = useQueryClient();
  const chainId = useChainId();
  const isTestnet = chainId === arbitrumSepolia.id;
  const { supabaseBuilders, supabaseBuildersLoaded } = useSupabaseBuilders();

  // Extract network from slug if present
  const hasNetworkSuffix = slug.includes('-base') || slug.includes('-arbitrum');
  const network = slug.includes('-base') ? 'Base' : 
                 slug.includes('-arbitrum') ? 'Arbitrum' : undefined;
  
  // Extract base name without network suffix
  const slugWithoutNetwork = hasNetworkSuffix 
    ? slug.substring(0, slug.lastIndexOf('-'))
    : slug;
  
  const builderNameFromSlug = slugToBuilderName(slugWithoutNetwork);

  return useQuery<Builder | null>({
    queryKey: [
      'individual-builder',
      {
        builderName: builderNameFromSlug,
        isTestnet,
        network: network || (isTestnet ? 'Arbitrum Sepolia' : 'Base'),
        slug
      }
    ],
    queryFn: async () => {
      console.log(`[useIndividualBuilder] Fetching builder data for: ${builderNameFromSlug}`);

      // First check if we have prefetched data
      const prefetchedQueryKey = [
        'individual-builder-data',
        {
          builderName: builderNameFromSlug,
          isTestnet,
          network: network || (isTestnet ? 'Arbitrum Sepolia' : 'Base')
        }
      ];

      const prefetchedData = queryClient.getQueryData(prefetchedQueryKey);
      
      let onChainData = null;
      
      if (prefetchedData) {
        console.log(`[useIndividualBuilder] Using prefetched data for ${builderNameFromSlug}`);
        onChainData = prefetchedData;
      } else {
        // Fetch fresh data
        const networkForQuery = network || (isTestnet ? 'Arbitrum Sepolia' : 'Base');
        const endpoint = getEndpointForNetwork(networkForQuery);

        try {
          if (isTestnet) {
            const response = await fetchGraphQL(
              endpoint,
              "getBuilderSubnetByName",
              GET_BUILDER_SUBNET_BY_NAME,
              { name: builderNameFromSlug }
            ) as { data: unknown };
            onChainData = response.data;
          } else {
            const response = await fetchGraphQL(
              endpoint,
              "getBuildersProjectsByName",
              GET_BUILDERS_PROJECT_BY_NAME,
              { name: builderNameFromSlug }
            ) as { data: unknown };
            onChainData = response.data;
          }
        } catch (error) {
          console.error(`[useIndividualBuilder] Error fetching ${builderNameFromSlug}:`, error);
          return null;
        }
      }

      // Process the data based on network type
      if (isTestnet) {
        const data = onChainData as { builderSubnets?: unknown[] };
        const subnets = data?.builderSubnets;
        
        if (!subnets || !Array.isArray(subnets) || subnets.length === 0) {
          return null;
        }

        const subnet = subnets[0] as Record<string, string | number>;
        
        // Find matching Supabase data
        let supabaseBuilder = null;
        if (supabaseBuildersLoaded && supabaseBuilders) {
          supabaseBuilder = supabaseBuilders.find(b => 
            b.name.toLowerCase() === builderNameFromSlug.toLowerCase()
          );
        }

        const totalStakedInMor = Number(subnet.totalStaked || '0') / 1e18;
        const minStakeInMor = Number(subnet.minStake || '0') / 1e18;
        const lockPeriodSeconds = parseInt(String(subnet.withdrawLockPeriodAfterStake || '0'), 10);
        const stakingCount = parseInt(String(subnet.totalUsers || '0'), 10);

        const builder: Builder = {
          id: String(subnet.id || ''),
          mainnetProjectId: String(subnet.id || ''),
          name: String(subnet.name || ''),
          description: String(subnet.description || ''),
          long_description: String(subnet.description || ''),
          admin: String(subnet.owner || ''),
          networks: ['Arbitrum Sepolia'],
          network: 'Arbitrum Sepolia',
          totalStaked: totalStakedInMor,
          totalClaimed: Number(subnet.totalClaimed || '0') / 1e18,
          minDeposit: minStakeInMor,
          lockPeriod: formatTimePeriod(lockPeriodSeconds),
          withdrawLockPeriodRaw: lockPeriodSeconds,
          stakingCount,
          website: String(subnet.website || ''),
          image_src: String(subnet.image || ''),
          image: String(subnet.image || ''),
          tags: supabaseBuilder?.tags || [],
          github_url: supabaseBuilder?.github_url || '',
          twitter_url: supabaseBuilder?.twitter_url || '',
          discord_url: supabaseBuilder?.discord_url || '',
          contributors: supabaseBuilder?.contributors || 0,
          github_stars: supabaseBuilder?.github_stars || 0,
          reward_types: supabaseBuilder?.reward_types || [],
          reward_types_detail: supabaseBuilder?.reward_types_detail || [],
          created_at: supabaseBuilder?.created_at || new Date().toISOString(),
          updated_at: supabaseBuilder?.updated_at || new Date().toISOString(),
          startsAt: String(subnet.startsAt || ''),
        };

        return builder;

      } else {
        // Mainnet logic
        const data = onChainData as { buildersProjects?: unknown[] };
        const projects = data?.buildersProjects;
        
        if (!projects || !Array.isArray(projects) || projects.length === 0) {
          return null;
        }

        const project = projects[0] as Record<string, string | number>;
        
        // If we have a network specified, try to find the project on that network
        // This would require additional logic to match network to project
        
        // Find matching Supabase data
        let supabaseBuilder = null;
        if (supabaseBuildersLoaded && supabaseBuilders) {
          supabaseBuilder = supabaseBuilders.find(b => 
            b.name.toLowerCase() === builderNameFromSlug.toLowerCase()
          );
        }

        if (supabaseBuilder) {
          // Merge with Supabase data
          const totalStakedInMor = Number(project.totalStaked || '0') / 1e18;
          const minDepositInMor = Number(project.minimalDeposit || '0') / 1e18;
          const lockPeriodSeconds = parseInt(String(project.withdrawLockPeriodAfterDeposit || '0'), 10);

          const builder = mergeBuilderData(supabaseBuilder, {
            id: String(project.id || ''),
            totalStaked: totalStakedInMor,
            totalClaimed: Number(project.totalClaimed || '0') / 1e18,
            minimalDeposit: minDepositInMor,
            withdrawLockPeriodAfterDeposit: lockPeriodSeconds,
            withdrawLockPeriodRaw: lockPeriodSeconds,
            stakingCount: parseInt(String(project.totalUsers || '0'), 10),
            lockPeriod: formatTimePeriod(lockPeriodSeconds),
            network: network || 'Base',
            networks: [network || 'Base'],
            admin: String(project.admin || ''),
            image: String(project.image || ''),
            website: String(project.website || ''),
            startsAt: String(project.startsAt || ''),
          });

          return builder;
        } else {
          // Create minimal builder from on-chain data only
          const totalStakedInMor = Number(project.totalStaked || '0') / 1e18;
          const minDepositInMor = Number(project.minimalDeposit || '0') / 1e18;
          const lockPeriodSeconds = parseInt(String(project.withdrawLockPeriodAfterDeposit || '0'), 10);

          const builder: Builder = {
            id: String(project.id || ''),
            mainnetProjectId: String(project.id || ''),
            name: String(project.name || ''),
            description: String(project.description) || `${String(project.name)} (on ${network || 'Base'})`,
            long_description: '',
            admin: String(project.admin || ''),
            networks: [network || 'Base'],
            network: network || 'Base',
            totalStaked: totalStakedInMor,
            totalClaimed: Number(project.totalClaimed || '0') / 1e18,
            minDeposit: minDepositInMor,
            lockPeriod: formatTimePeriod(lockPeriodSeconds),
            withdrawLockPeriodRaw: lockPeriodSeconds,
            stakingCount: parseInt(String(project.totalUsers || '0'), 10),
            website: String(project.website || ''),
            image_src: String(project.image || ''),
            image: String(project.image || ''),
            tags: [],
            github_url: '',
            twitter_url: '',
            discord_url: '',
            contributors: 0,
            github_stars: 0,
            reward_types: ['TBA'],
            reward_types_detail: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            startsAt: String(project.startsAt || ''),
          };

          return builder;
        }
      }
    },
    enabled: !!builderNameFromSlug && (!isTestnet ? supabaseBuildersLoaded : true),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
} 