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
  supabaseBuilders: BuilderDB[] | null, // Supabase data, can be null if not loaded
  supabaseBuildersLoaded: boolean      // Flag to indicate if Supabase data has been attempted to load
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
        };
        // Store lockPeriodSeconds separately for the final Builder mapping, not on BuilderProject
        // (project as any).withdrawLockPeriodRaw = lockPeriodSeconds; 
        return project; // project is returned, lockPeriodSeconds needs to be passed differently or recalculated
      });
      
      // To correctly pass lockPeriodSeconds for each project to the final mapping stage,
      // we need to associate it with the project. We can return an array of [project, lockPeriodSeconds] tuples.
      // Or, more simply, recalculate it where needed if project has withdrawLockPeriodAfterStake.
      // For now, the final mapping for testnet will re-calculate it from project.withdrawLockPeriodAfterDeposit.

      console.log(`[API Testnet] Processed ${combinedProjects.length} subnets for BuilderProject format`);

    } else { // Mainnet logic
      if (!supabaseBuildersLoaded || !supabaseBuilders || supabaseBuilders.length === 0) {
        console.log('[API] Mainnet: Supabase builders not ready or empty. Returning empty array.');
        return []; // Return empty if Supabase data isn't there for mainnet
      }
      
      const builderNames = supabaseBuilders.map(b => b.name);
      console.log(`[API] Mainnet: Using ${builderNames.length} builder names for filtering from Supabase.`);
      
      const commonVariables = {
        orderBy: "totalStaked",
        orderDirection: OrderDirection.Desc,
        usersOrderBy: "buildersProject__totalStaked",
        usersDirection: OrderDirection.Asc,
        name_in: builderNames,
        address: ""
      };

      const baseClient = getClientForNetwork('Base');
      const arbitrumClient = getClientForNetwork('Arbitrum');
      
      if (!baseClient || !arbitrumClient) {
        throw new Error(`[API] Could not get Apollo clients for Base or Arbitrum`);
      }
      
      console.log('[API] Mainnet: Fetching on-chain data from Base and Arbitrum.');
      
      console.log(`[API Mainnet Query] Variables for Base:`, commonVariables);
      const [baseResponse, arbitrumResponse] = await Promise.all([
        baseClient.query<CombinedBuildersListFilteredByPredefinedBuildersResponse>({
          query: COMBINED_BUILDERS_LIST_FILTERED_BY_PREDEFINED_BUILDERS,
          variables: commonVariables,
          fetchPolicy: 'no-cache',
        }),
        (console.log(`[API Mainnet Query] Variables for Arbitrum:`, commonVariables), 
        arbitrumClient.query<CombinedBuildersListFilteredByPredefinedBuildersResponse>({
          query: COMBINED_BUILDERS_LIST_FILTERED_BY_PREDEFINED_BUILDERS,
          variables: commonVariables,
          fetchPolicy: 'no-cache',
        }))
      ]);

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
    }
    
    // Final transformation from BuilderProject[] to Builder[]
    // This step might need adjustment based on how `mergeBuilderData` and Supabase data are used.
    // For now, assuming direct transformation for testnet or merging for mainnet.

    if (isTestnet) {
      // For testnet, directly map BuilderProject to Builder
      return combinedProjects.map((project): Builder => {
        const lockPeriodSeconds = parseInt(project.withdrawLockPeriodAfterDeposit || '0', 10);
        const startsAtString = project.startsAt; // Assumed string
        return {
          id: project.id,
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
          created_at: startsAtString || new Date().toISOString(), 
          updated_at: startsAtString || new Date().toISOString(), 
          startsAt: startsAtString,
        };
      });
    } else {
      // For mainnet, merge BuilderDB with on-chain BuilderProject data
      if (!supabaseBuilders) {
        console.warn("[API] Mainnet: supabaseBuilders is null, cannot merge. Returning empty Builder array.");
        return [];
      }
      console.log("[fetchBuildersAPI Mainnet] Starting to map supabaseBuilders...");
      const mappedBuilders = supabaseBuilders.map((builderDB, index): Builder => {
        // console.log(`[fetchBuildersAPI Mainnet Map] Processing index: ${index}, builderDB.name: ${builderDB.name}`);
        const onChainProject = combinedProjects.find(p => p.name === builderDB.name);
        if (!onChainProject) {
          // console.warn(`[fetchBuildersAPI Mainnet Map] No onChainProject found for ${builderDB.name}`);
        }
        const mainnetLockPeriodSeconds = onChainProject ? parseInt(onChainProject.withdrawLockPeriodAfterDeposit || '0', 10) : 0;
        
        // Log the inputs to mergeBuilderData for the first item, or if onChainProject is missing
        if (index < 2 || !onChainProject) {
            console.log(`[fetchBuildersAPI Mainnet Map - DEBUG ${index}] For builderDB: ${builderDB.name}`);
            console.log(`[fetchBuildersAPI Mainnet Map - DEBUG ${index}] onChainProject found: ${!!onChainProject}`);
            if(onChainProject) {
                console.log(`[fetchBuildersAPI Mainnet Map - DEBUG ${index}] onChainProject.startsAt type: ${typeof onChainProject.startsAt}, value: ${onChainProject.startsAt}`);
            }
        }

        return mergeBuilderData(builderDB, {
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
          startsAt: onChainProject?.startsAt, // Assumed string, problem might be here if it's Date at runtime
        });
      });
      console.log("[fetchBuildersAPI Mainnet] Finished mapping supabaseBuilders. Count:", mappedBuilders.length);
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