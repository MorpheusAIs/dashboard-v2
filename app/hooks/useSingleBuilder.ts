import { useQuery } from '@tanstack/react-query';
import { Builder } from '@/app/builders/builders-data';
import { useNetworkInfo } from './useNetworkInfo';
import { arbitrum, base } from 'wagmi/chains';
import { useChainId } from 'wagmi';
import { formatTimePeriod } from '@/app/utils/time-utils';

interface UseSingleBuilderProps {
  projectId: string | null | undefined;
  network?: string;
}

/**
 * Hook to fetch a single builder's data from Goldsky API
 * This is more efficient than fetching all builders and filtering
 */
export const useSingleBuilder = ({ projectId, network }: UseSingleBuilderProps) => {
  const chainId = useChainId();
  const { isTestnet } = useNetworkInfo();
  
  // Determine network from prop, chainId, or default to 'base'
  const networkName = network || (chainId === arbitrum.id ? 'arbitrum' : chainId === base.id ? 'base' : 'base');
  
  return useQuery<Builder | null, Error>({
    queryKey: ['singleBuilder', projectId, networkName, isTestnet],
    queryFn: async () => {
      if (!projectId) {
        return null;
      }

      // For testnet, we still use the all-builders approach
      // since testnet uses different endpoints
      if (isTestnet) {
        console.log('[useSingleBuilder] Testnet detected, skipping single builder fetch');
        return null;
      }

      try {
        console.log(`[useSingleBuilder] Fetching builder ${projectId} from ${networkName} network`);
        
        const response = await fetch(`/api/builders/goldsky/${projectId}?network=${networkName}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[useSingleBuilder] Failed to fetch builder: ${response.status}`, errorText);
          throw new Error(`Failed to fetch builder: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
          console.error('[useSingleBuilder] API route returned error:', data.error);
          throw new Error(`Builder query failed: ${data.error}`);
        }

        const project = data.buildersProject;
        if (!project) {
          console.warn(`[useSingleBuilder] No project found for ID: ${projectId}`);
          return null;
        }

        // Transform the project data to Builder format
        const totalStakedInMor = Number(project.totalStaked || '0') / 1e18;
        const totalClaimedInMor = Number(project.totalClaimed || '0') / 1e18;
        const minDepositInMor = Number(project.minimalDeposit || '0') / 1e18;
        const stakingCount = parseInt(project.totalUsers || '0', 10);
        const lockPeriodSeconds = parseInt(project.withdrawLockPeriodAfterDeposit || '0', 10);
        const lockPeriodFormatted = formatTimePeriod(lockPeriodSeconds);

        const builder: Builder = {
          id: project.id,
          mainnetProjectId: project.id,
          name: project.name,
          description: project.description || '',
          long_description: project.description || '',
          admin: project.admin || '',
          networks: [networkName === 'arbitrum' ? 'Arbitrum' : 'Base'],
          network: networkName === 'arbitrum' ? 'Arbitrum' : 'Base',
          totalStaked: totalStakedInMor,
          totalClaimed: totalClaimedInMor,
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

        console.log(`[useSingleBuilder] Successfully fetched builder: ${builder.name}`, {
          totalStaked: builder.totalStaked,
          totalClaimed: builder.totalClaimed,
          stakingCount: builder.stakingCount
        });

        return builder;
      } catch (error) {
        console.error('[useSingleBuilder] Error fetching builder:', error);
        throw error;
      }
    },
    enabled: !!projectId && !isTestnet, // Only fetch if we have a projectId and we're on mainnet
    staleTime: 30 * 1000, // Consider data stale after 30 seconds
    refetchOnWindowFocus: true,
  });
};

