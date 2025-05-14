import { getClientForNetwork } from '@/lib/apollo-client';
import { 
  COMBINED_BUILDERS_LIST_FILTERED_BY_PREDEFINED_BUILDERS,
  COMBINED_BUILDER_SUBNETS
} from '@/lib/graphql/builders-queries';
import { 
  BuilderProject, 
  CombinedBuildersListFilteredByPredefinedBuildersResponse, // Ensure this type is correctly defined/imported
  OrderDirection
} from '@/lib/types/graphql';
import { Builder, mergeBuilderData } from '@/app/builders/builders-data'; // Assuming mergeBuilderData is needed and correctly typed
import { BuilderDB } from '@/app/lib/supabase'; // Assuming BuilderDB type is correctly defined/imported
import { formatTimePeriod } from "@/app/utils/time-utils";

// Interface for the structure of subnet data from the testnet query
interface TestnetSubnet {
  id: string;
  name: string;
  owner: string;
  minStake: string;
  fee: string;
  feeTreasury: string;
  startsAt: string;
  totalClaimed: string;
  totalStaked: string;
  totalUsers: string;
  withdrawLockPeriodAfterStake: string;
  maxClaimLockEnd: string;
  description: string;
  website: string;
  slug?: string; // Was noted as potentially incorrect, marked optional
  image?: string;
  builderUsers?: { 
    id: string; 
    address: string; 
    staked: string; 
    claimed: string;
    claimLockEnd: string;
    lastStake: string;
  }[];
}

export const fetchBuildersAPI = async (
  isTestnet: boolean, 
  supabaseBuilders: BuilderDB[] | null, 
  supabaseBuildersLoaded: boolean, 
  userAddress?: string | null // Added userAddress as an optional parameter
): Promise<Builder[]> => {
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  console.log('!!!!!!!!!! fetchBuildersAPI HAS BEEN CALLED !!!!!!!!!!');
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  console.log('fetchBuildersAPI called. isTestnet:', isTestnet, 'supabaseBuildersLoaded:', supabaseBuildersLoaded, 'supabaseBuilders count:', supabaseBuilders?.length);
  
  try {
    let combinedProjects: BuilderProject[] = [];

    if (isTestnet) {
      const networkString = 'ArbitrumSepolia';
      console.log(`[API] Fetching all subnet data from ${networkString} network.`);
      const client = getClientForNetwork(networkString);
      if (!client) {
        throw new Error(`[API] Could not get Apollo client for network: ${networkString}`);
      }
      
      const testnetVariables = {
        first: 100, // Consider making this configurable or fetching all
        skip: 0,
        orderBy: 'totalStaked',
        orderDirection: OrderDirection.Desc, // Make sure OrderDirection is correctly imported or defined
        usersOrderBy: 'builderSubnet__totalStaked',
        usersDirection: OrderDirection.Asc,
        builderSubnetName: "", 
        address: "" 
      };
      
      console.log(`[API Testnet Query] Variables for ${networkString}:`, testnetVariables);
      const response = await client.query<{ builderSubnets?: TestnetSubnet[] }>({ // Typed response
        query: COMBINED_BUILDER_SUBNETS,
        variables: testnetVariables,
        fetchPolicy: 'no-cache',
      });
      
      console.log(`[API Testnet] Received response with ${response.data?.builderSubnets?.length || 0} subnets`);
      
      combinedProjects = (response.data?.builderSubnets || []).map((subnet: TestnetSubnet): BuilderProject => {
        const totalStakedRaw = subnet.totalStaked || '0';
        const totalStakedInMor = Number(totalStakedRaw) / 1e18;
        const minStakeInMor = Number(subnet.minStake || '0') / 1e18;
        
        const stakingCount = subnet.builderUsers && subnet.builderUsers.length > 0 
          ? subnet.builderUsers.length 
          : parseInt(subnet.totalUsers || '0', 10);
        
        const lockPeriodSeconds = parseInt(subnet.withdrawLockPeriodAfterStake || '0', 10);
        const lockPeriodFormatted = formatTimePeriod(lockPeriodSeconds);
        
        const project: BuilderProject = {
          id: subnet.id,
          name: subnet.name,
          description: subnet.description || '',
          admin: subnet.owner, 
          networks: ['Arbitrum Sepolia'],
          network: 'Arbitrum Sepolia',
          totalStaked: totalStakedInMor.toString(), 
          minDeposit: minStakeInMor, 
          minimalDeposit: subnet.minStake, 
          lockPeriod: lockPeriodFormatted,
          stakingCount: stakingCount,
          totalUsers: subnet.totalUsers,
          website: subnet.website || '',
          image: subnet.image || '',
          totalStakedFormatted: totalStakedInMor,
          startsAt: subnet.startsAt,
          claimLockEnd: subnet.maxClaimLockEnd,
          withdrawLockPeriodAfterDeposit: subnet.withdrawLockPeriodAfterStake, 
          totalClaimed: subnet.totalClaimed || '0',
          builderUsers: subnet.builderUsers,
        };
        return project;
      });
      
      // To correctly pass lockPeriodSeconds for each project to the final mapping stage,
      // we need to associate it with the project. We can return an array of [project, lockPeriodSeconds] tuples.
      // Or, more simply, recalculate it where needed if project has withdrawLockPeriodAfterStake.
      // For now, the final mapping for testnet will re-calculate it from project.withdrawLockPeriodAfterDeposit.

      console.log(`[API Testnet] Processed ${combinedProjects.length} subnets for BuilderProject format`);

      // Return mapped Builder array for testnet
      return combinedProjects.map((project): Builder => {
        const lockPeriodSeconds = parseInt(project.withdrawLockPeriodAfterStake || project.withdrawLockPeriodAfterDeposit || '0', 10);
        const startsAtString = project.startsAt;
        return {
          id: project.id,
          mainnetProjectId: project.id,
          name: project.name,
          description: project.description || '',
          long_description: project.description || '',
          admin: project.admin as string, 
          networks: project.networks || ['Arbitrum Sepolia'],
          network: project.network || 'Arbitrum Sepolia',
          totalStaked: project.totalStakedFormatted !== undefined ? project.totalStakedFormatted : parseFloat(project.totalStaked || '0'),
          minDeposit: project.minDeposit !== undefined ? project.minDeposit : parseFloat(project.minimalDeposit || '0') / 1e18,
          lockPeriod: project.lockPeriod || formatTimePeriod(lockPeriodSeconds),
          withdrawLockPeriodRaw: lockPeriodSeconds,
          stakingCount: project.stakingCount || 0,
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
          created_at: ' ', // Placeholder
          updated_at: ' ', // Placeholder
          startsAt: startsAtString,
          builderUsers: project.builderUsers,
        };
      });
    } else { // Mainnet logic
      if (!supabaseBuildersLoaded || !supabaseBuilders || supabaseBuilders.length === 0) {
        console.log('[API] Mainnet: Supabase builders not ready or empty. Returning empty array.');
        return [];
      }
      
      const builderNames = supabaseBuilders.map(b => b.name);
      console.log(`[API] Mainnet: Using ${builderNames.length} builder names for filtering from Supabase.`);
      
      const commonVariables = {
        orderBy: "totalStaked",
        orderDirection: OrderDirection.Desc,
        usersOrderBy: "buildersProject__totalStaked",
        usersDirection: OrderDirection.Asc,
        name_in: builderNames,
        address: userAddress || ""
      };

      const baseClient = getClientForNetwork('Base');
      const arbitrumClient = getClientForNetwork('Arbitrum');
      
      if (!baseClient || !arbitrumClient) {
        throw new Error(`[API] Could not get Apollo clients for Base or Arbitrum`);
      }
      
      console.log('[API] Mainnet: Fetching on-chain data from Base and Arbitrum.');
      
      const [baseResponse, arbitrumResponse] = await Promise.all([
        baseClient.query<CombinedBuildersListFilteredByPredefinedBuildersResponse>({
          query: COMBINED_BUILDERS_LIST_FILTERED_BY_PREDEFINED_BUILDERS,
          variables: commonVariables,
          fetchPolicy: 'no-cache',
        }),
        arbitrumClient.query<CombinedBuildersListFilteredByPredefinedBuildersResponse>({
          query: COMBINED_BUILDERS_LIST_FILTERED_BY_PREDEFINED_BUILDERS,
          variables: commonVariables,
          fetchPolicy: 'no-cache',
        })
      ]);

      // DEBUGGING LOGS FOR MAINNET PARTICIPATION
      console.log("[Mainnet Participation Check] userAddress:", userAddress);
      console.log("[Mainnet Participation Check] Base buildersUsers from GQL:", JSON.stringify(baseResponse.data?.buildersUsers, null, 2));
      console.log("[Mainnet Participation Check] Arbitrum buildersUsers from GQL:", JSON.stringify(arbitrumResponse.data?.buildersUsers, null, 2));

      const baseProjects = (baseResponse.data?.buildersProjects || []).map((project): BuilderProject => {
        const totalStakedInMor = Number(project.totalStaked || '0') / 1e18;
        const minDepositInMor = Number(project.minimalDeposit || '0') / 1e18;
        const lockPeriodFormatted = formatTimePeriod(parseInt(project.withdrawLockPeriodAfterDeposit || '0', 10));
        
        // Explicitly convert potential Date objects to ISO strings, defaulting to empty string if null/undefined
        const pStartsAt = project.startsAt;
        const pClaimLockEnd = project.claimLockEnd;

        return {
          ...project,
          startsAt: typeof pStartsAt === 'string' ? pStartsAt : (pStartsAt ? new Date(pStartsAt).toISOString() : ''),
          claimLockEnd: typeof pClaimLockEnd === 'string' ? pClaimLockEnd : (pClaimLockEnd ? new Date(pClaimLockEnd).toISOString() : ''),
          networks: ['Base'],
          network: 'Base',
          stakingCount: parseInt(project.totalUsers || '0', 10),
          lockPeriod: lockPeriodFormatted,
          minDeposit: minDepositInMor,
          totalStakedFormatted: totalStakedInMor,
        };
      });
      
      const arbitrumProjects = (arbitrumResponse.data?.buildersProjects || []).map((project): BuilderProject => {
        const totalStakedInMor = Number(project.totalStaked || '0') / 1e18;
        const minDepositInMor = Number(project.minimalDeposit || '0') / 1e18;
        const lockPeriodFormatted = formatTimePeriod(parseInt(project.withdrawLockPeriodAfterDeposit || '0', 10));

        // Explicitly convert potential Date objects to ISO strings, defaulting to empty string if null/undefined
        const pStartsAt = project.startsAt;
        const pClaimLockEnd = project.claimLockEnd;

        return {
          ...project,
          startsAt: typeof pStartsAt === 'string' ? pStartsAt : (pStartsAt ? new Date(pStartsAt).toISOString() : ''),
          claimLockEnd: typeof pClaimLockEnd === 'string' ? pClaimLockEnd : (pClaimLockEnd ? new Date(pClaimLockEnd).toISOString() : ''),
          networks: ['Arbitrum'],
          network: 'Arbitrum',
          stakingCount: parseInt(project.totalUsers || '0', 10),
          lockPeriod: lockPeriodFormatted,
          minDeposit: minDepositInMor,
          totalStakedFormatted: totalStakedInMor,
        };
      });

      console.log('[API] Mainnet: Fetched from Base:', baseProjects.length, 'projects');
      console.log('[API] Mainnet: Fetched from Arbitrum:', arbitrumProjects.length, 'projects');
      
      combinedProjects = [...baseProjects, ...arbitrumProjects];
      console.log('[API] Mainnet: Combined projects:', combinedProjects.length);

      if (!supabaseBuilders) {
        console.warn("[API] Mainnet: supabaseBuilders is null at merging stage. Returning empty Builder array.");
        return [];
      }
      const mappedBuilders = supabaseBuilders.map((builderDB): Builder => {
        const onChainProject = combinedProjects.find(p => p.name === builderDB.name);
        const mainnetLockPeriodSeconds = onChainProject ? parseInt(onChainProject.withdrawLockPeriodAfterDeposit || '0', 10) : 0;
        return mergeBuilderData(builderDB, {
          id: onChainProject?.id,
          mainnetProjectId: onChainProject?.id || null,
          totalStaked: onChainProject?.totalStakedFormatted !== undefined 
            ? onChainProject.totalStakedFormatted 
            : parseFloat(onChainProject?.totalStaked || '0') / 1e18 || 0, 
          minimalDeposit: parseFloat(onChainProject?.minimalDeposit || '0') / 1e18 || 0, 
          withdrawLockPeriodAfterDeposit: mainnetLockPeriodSeconds,
          withdrawLockPeriodRaw: mainnetLockPeriodSeconds,
          stakingCount: onChainProject?.stakingCount || 0,
          lockPeriod: onChainProject?.lockPeriod || '',
          network: onChainProject?.network || 'Unknown',
          networks: onChainProject?.networks || ['Unknown'],
          admin: onChainProject?.admin,
          image: onChainProject?.image, 
          website: onChainProject?.website,
          startsAt: onChainProject?.startsAt,
        });
      });
      console.log("[fetchBuildersAPI Mainnet] Finished mapping supabaseBuilders. Count:", mappedBuilders.length);

      // Populate builderUsers for mainnet if userAddress was provided
      if (userAddress && (baseResponse.data?.buildersUsers || arbitrumResponse.data?.buildersUsers)) {
        const allUserStakes = [
          ...(baseResponse.data?.buildersUsers || []),
          ...(arbitrumResponse.data?.buildersUsers || [])
        ];

        mappedBuilders.forEach(builder => {
          const userStakesForThisBuilder = allUserStakes.filter(
            stake => stake.buildersProject?.id === builder.id || stake.buildersProject?.name === builder.name
          );

          if (userStakesForThisBuilder.length > 0) {
            builder.builderUsers = userStakesForThisBuilder.map(stake => ({
              id: stake.id,
              address: stake.address,
              staked: stake.staked,
              claimed: "0",
              claimLockEnd: "0",
              lastStake: stake.lastStake,
            }));
          }
        });
      }
      return mappedBuilders;
    }

  } catch (e) {
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.error('!!!!!!!!!! fetchBuildersAPI ENCOUNTERED AN ERROR !!!!!!!!!!');
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.error('[API] Error fetching builder data inside fetchBuildersAPI catch block:', e);
    throw e instanceof Error ? e : new Error('An unknown error occurred while fetching builder data via API service');
  }
}; 