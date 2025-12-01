import { getClientForNetwork } from '@/lib/apollo-client';
import { 
  COMBINED_BUILDERS_LIST_FILTERED_BY_PREDEFINED_BUILDERS,
  COMBINED_BUILDER_SUBNETS,
  COMBINED_BUILDERS_PROJECTS_BASE_SEPOLIA,
  COMBINED_BUILDERS_PROJECTS_BASE_MAINNET,
  COMBINED_BUILDERS_PROJECTS_ARBITRUM_MAINNET
} from '@/lib/graphql/builders-queries';
import { 
  BuilderProject, 
  CombinedBuildersListFilteredByPredefinedBuildersResponse, // Ensure this type is correctly defined/imported
  OrderDirection
} from '@/lib/types/graphql';
import { Builder, mergeBuilderData } from '@/app/builders/builders-data'; // Assuming mergeBuilderData is needed and correctly typed
import { BuilderDB } from '@/app/lib/supabase'; // Assuming BuilderDB type is correctly defined/imported
import { formatTimePeriod } from "@/app/utils/time-utils";

/**
 * Helper function to detect if a subnet is V4 (has on-chain metadata) or V1 (missing metadata)
 * V4 subnets will have metadata fields populated (description, website, image, slug)
 * V1 subnets discovered via V4 query will have these fields empty/null
 */
function isV4Subnet(project: BuilderProject): boolean {
  // V4 subnets have metadata fields populated
  return !!(
    project.description || 
    project.website || 
    project.image || 
    project.slug
  );
}

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
  userAddress?: string | null, // Added userAddress as an optional parameter
  getNewlyCreatedSubnetAdmin?: (subnetName: string) => string | null, // Function to get admin address for newly created subnets
  chainId?: number // Optional chainId to determine which testnet network to query
): Promise<Builder[]> => {
  // console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  // console.log('!!!!!!!!!! fetchBuildersAPI HAS BEEN CALLED !!!!!!!!!!');
  // console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  // console.log('fetchBuildersAPI called. isTestnet:', isTestnet, 'supabaseBuildersLoaded:', supabaseBuildersLoaded, 'supabaseBuilders count:', supabaseBuilders?.length);
  
  try {
    let combinedProjects: BuilderProject[] = [];

    if (isTestnet) {
      // Determine which testnet network to query based on chainId
      // Base Sepolia (84532) uses BuildersV4 schema (like mainnet), Arbitrum Sepolia uses old schema
      const isBaseSepolia = chainId === 84532;
      const networkString = isBaseSepolia ? 'BaseSepolia' : 'ArbitrumSepolia';
      const networkName = isBaseSepolia ? 'Base Sepolia' : 'Arbitrum Sepolia';
      
      console.log(`[API] Fetching all subnet data from ${networkString} network (${networkName}).`);
      const client = getClientForNetwork(networkString);
      if (!client) {
        throw new Error(`[API] Could not get Apollo client for network: ${networkString}`);
      }
      
      if (isBaseSepolia) {
        // Base Sepolia uses BuildersV4 schema with items structure
        console.log(`[API Base Sepolia Query] Fetching projects...`);
        const response = await client.query<{ buildersProjects?: { items?: BuilderProject[] } }>({
          query: COMBINED_BUILDERS_PROJECTS_BASE_SEPOLIA,
          fetchPolicy: 'no-cache',
        });
        
        const projects = response.data?.buildersProjects?.items || [];
        console.log(`[API Base Sepolia] Received response with ${projects.length} projects`);
        
        combinedProjects = projects.map((project: BuilderProject): BuilderProject => {
          const totalStakedRaw = project.totalStaked || '0';
          const totalStakedInMor = Number(totalStakedRaw) / 1e18;
          const minStakeInMor = Number(project.minimalDeposit || '0') / 1e18;
          const totalClaimedRaw = project.totalClaimed || '0';
          const totalClaimedInMor = Number(totalClaimedRaw) / 1e18;
          
          const stakingCount = parseInt(project.totalUsers || '0', 10);
          const lockPeriodSeconds = parseInt(project.withdrawLockPeriodAfterDeposit || '0', 10);
          const lockPeriodFormatted = formatTimePeriod(lockPeriodSeconds);
          
          return {
            ...project,
            admin: project.admin || '', // May not be in response, set default
            networks: [networkName],
            network: networkName,
            totalStaked: totalStakedInMor.toString(),
            minDeposit: minStakeInMor,
            minimalDeposit: project.minimalDeposit,
            lockPeriod: lockPeriodFormatted,
            stakingCount: stakingCount,
            totalStakedFormatted: totalStakedInMor,
            totalClaimedFormatted: totalClaimedInMor,
            totalClaimed: totalClaimedInMor.toString(),
            startsAt: project.startsAt || '',
            claimLockEnd: project.claimLockEnd || '',
            builderUsers: [], // User stakes would need a separate query if needed
          };
        });
      } else {
        // Arbitrum Sepolia uses old schema (deprecated)
        const testnetVariables = {
          first: 100,
          skip: 0,
          orderBy: 'totalStaked',
          orderDirection: OrderDirection.Desc,
          usersOrderBy: 'builderSubnet__totalStaked',
          usersDirection: OrderDirection.Asc,
          builderSubnetName: "", 
          address: "" 
        };
        
        console.log(`[API Arbitrum Sepolia Query] Variables:`, testnetVariables);
        const response = await client.query<{ builderSubnets?: TestnetSubnet[] }>({
          query: COMBINED_BUILDER_SUBNETS,
          variables: testnetVariables,
          fetchPolicy: 'no-cache',
        });
        
        console.log(`[API Arbitrum Sepolia] Received response with ${response.data?.builderSubnets?.length || 0} subnets`);
      
        combinedProjects = (response.data?.builderSubnets || []).map((subnet: TestnetSubnet): BuilderProject => {
          const totalStakedRaw = subnet.totalStaked || '0';
          const totalStakedInMor = Number(totalStakedRaw) / 1e18;
          const minStakeInMor = Number(subnet.minStake || '0') / 1e18;
          const totalClaimedRaw = subnet.totalClaimed || '0';
          const totalClaimedInMor = Number(totalClaimedRaw) / 1e18;
          
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
            networks: [networkName],
            network: networkName,
            totalStaked: totalStakedInMor.toString(), 
            minDeposit: minStakeInMor, 
            minimalDeposit: subnet.minStake, 
            lockPeriod: lockPeriodFormatted,
            stakingCount: stakingCount,
            totalUsers: subnet.totalUsers,
            website: subnet.website || '',
            image: subnet.image || '',
            totalStakedFormatted: totalStakedInMor,
            totalClaimedFormatted: totalClaimedInMor,
            startsAt: subnet.startsAt,
            claimLockEnd: subnet.maxClaimLockEnd,
            withdrawLockPeriodAfterDeposit: subnet.withdrawLockPeriodAfterStake, 
            totalClaimed: totalClaimedInMor.toString(),
            builderUsers: subnet.builderUsers,
          };

          return project;
        });
      }
      
      // To correctly pass lockPeriodSeconds for each project to the final mapping stage,
      // we need to associate it with the project. We can return an array of [project, lockPeriodSeconds] tuples.
      // Or, more simply, recalculate it where needed if project has withdrawLockPeriodAfterStake.
      // For now, the final mapping for testnet will re-calculate it from project.withdrawLockPeriodAfterDeposit.

      console.log(`[API Testnet] Processed ${combinedProjects.length} subnets for BuilderProject format`);

      // Return mapped Builder array for testnet
      return combinedProjects.map((project): Builder => {
        const lockPeriodSeconds = parseInt(project.withdrawLockPeriodAfterDeposit || '0', 10);
        const startsAtString = project.startsAt;
        return {
          id: project.id,
          mainnetProjectId: project.id,
          name: project.name,
          description: project.description || '',
          long_description: project.description || '',
          admin: project.admin as string, 
          networks: project.networks || [networkName],
          network: project.network || networkName,
          totalStaked: project.totalStakedFormatted !== undefined ? project.totalStakedFormatted : parseFloat(project.totalStaked || '0'),
          totalClaimed: project.totalClaimedFormatted !== undefined ? project.totalClaimedFormatted : parseFloat(project.totalClaimed || '0'),
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
        // console.log('[API] Mainnet: Supabase builders not ready or empty. Returning empty array.');
        return [];
      }
      
      // FIXED: Use ALL builders (including Morlord-only ones), not just original Supabase
      let builderNames = supabaseBuilders.map(b => b.name);
      
      // FIX: Handle name mismatch between Morlord API and GraphQL subgraphs
      // Morlord API uses "Protection and Capital Incentive" 
      // But Arbitrum GraphQL uses "Protection and Capital Incentives Program"
      const nameMapping: Record<string, string[]> = {
        "Protection and Capital Incentive": [
          "Protection and Capital Incentive", // Base version
          "Protection and Capital Incentives Program" // Arbitrum version  
        ]
      };
      
      // Expand builder names to include GraphQL variations
      const expandedBuilderNames: string[] = [];
      builderNames.forEach(name => {
        expandedBuilderNames.push(name);
        if (nameMapping[name]) {
          expandedBuilderNames.push(...nameMapping[name]);
        }
      });
      
      // Remove duplicates
      builderNames = Array.from(new Set(expandedBuilderNames));
      
      // console.log(`[API] Mainnet: Using ${builderNames.length} builder names for filtering (includes name variations).`);
      
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
      
      // TODO: Add feature flag or version detection for mainnet V4
      // For now, assume both Base and Arbitrum mainnet use V4 queries when V4 contracts are deployed
      const useBaseV4Queries = true; // Set to true when Base mainnet V4 contracts are deployed
      const useArbitrumV4Queries = true; // Set to true when Arbitrum mainnet V4 contracts are deployed
      
      // console.log('[API] Mainnet: Fetching on-chain data from Base and Arbitrum.');
      
      // Base mainnet: Use V4 query if enabled, otherwise use V1 query
      const baseQueryPromise = useBaseV4Queries
        ? baseClient.query<{ buildersProjects?: { items?: BuilderProject[] } }>({
            query: COMBINED_BUILDERS_PROJECTS_BASE_MAINNET,
            fetchPolicy: 'no-cache',
          })
        : baseClient.query<CombinedBuildersListFilteredByPredefinedBuildersResponse>({
            query: COMBINED_BUILDERS_LIST_FILTERED_BY_PREDEFINED_BUILDERS,
            variables: commonVariables,
            fetchPolicy: 'no-cache',
          });
      
      // Arbitrum mainnet: Use V4 query if enabled, otherwise use V1 query
      const arbitrumQueryPromise = useArbitrumV4Queries
        ? arbitrumClient.query<{ buildersProjects?: { items?: BuilderProject[] } }>({
            query: COMBINED_BUILDERS_PROJECTS_ARBITRUM_MAINNET,
            fetchPolicy: 'no-cache',
          })
        : arbitrumClient.query<CombinedBuildersListFilteredByPredefinedBuildersResponse>({
            query: COMBINED_BUILDERS_LIST_FILTERED_BY_PREDEFINED_BUILDERS,
            variables: commonVariables,
            fetchPolicy: 'no-cache',
          });
      
      const [baseResponse, arbitrumResponse] = await Promise.all([
        baseQueryPromise,
        arbitrumQueryPromise
      ]);

      // Helper function to normalize GraphQL names back to Morlord API names
      const normalizeBuilderName = (graphqlName: string): string => {
        if (graphqlName === "Protection and Capital Incentives Program") {
          return "Protection and Capital Incentive";
        }
        return graphqlName;
      };

      // Process Base projects - handle both V4 query (with items) and V1 query (flat array)
      let baseProjects: BuilderProject[] = [];
      
      if (useBaseV4Queries) {
        // Base V4 query returns nested structure: buildersProjects.items[]
        const v4Projects = (baseResponse.data as { buildersProjects?: { items?: BuilderProject[] } })?.buildersProjects?.items || [];
        
        baseProjects = v4Projects.map((project): BuilderProject => {
          const totalStakedInMor = Number(project.totalStaked || '0') / 1e18;
          const minDepositInMor = Number(project.minimalDeposit || '0') / 1e18;
          const totalClaimedInMor = Number(project.totalClaimed || '0') / 1e18;
          
          return {
            ...project,
            name: normalizeBuilderName(project.name), // Normalize the name
            startsAt: typeof project.startsAt === 'string' ? project.startsAt : '',
            claimLockEnd: typeof project.claimLockEnd === 'string' ? project.claimLockEnd : '',
            networks: ['Base'],
            network: 'Base',
            stakingCount: parseInt(project.totalUsers || '0', 10),
            lockPeriod: formatTimePeriod(parseInt(project.withdrawLockPeriodAfterDeposit || '0', 10)),
            minDeposit: minDepositInMor,
            totalStakedFormatted: totalStakedInMor,
            totalClaimedFormatted: totalClaimedInMor,
            totalClaimed: totalClaimedInMor.toString(),
            mainnetProjectId: project.id,
          };
        });
      } else {
        // Base V1 query returns flat array: buildersProjects[]
        const v1Projects = (baseResponse.data as CombinedBuildersListFilteredByPredefinedBuildersResponse)?.buildersProjects || [];
        
        baseProjects = v1Projects.map((project): BuilderProject => {
          const totalStakedInMor = Number(project.totalStaked || '0') / 1e18;
          const minDepositInMor = Number(project.minimalDeposit || '0') / 1e18;
          const totalClaimedInMor = Number(project.totalClaimed || '0') / 1e18;
          
          return {
            ...project,
            name: normalizeBuilderName(project.name), // Normalize the name
            startsAt: typeof project.startsAt === 'string' ? project.startsAt : '',
            claimLockEnd: typeof project.claimLockEnd === 'string' ? project.claimLockEnd : '',
            networks: ['Base'],
            network: 'Base',
            stakingCount: parseInt(project.totalUsers || '0', 10),
            lockPeriod: formatTimePeriod(parseInt(project.withdrawLockPeriodAfterDeposit || '0', 10)),
            minDeposit: minDepositInMor,
            totalStakedFormatted: totalStakedInMor,
            totalClaimedFormatted: totalClaimedInMor,
            totalClaimed: totalClaimedInMor.toString(),
            mainnetProjectId: project.id,
          };
        });
      }
      
      // Process Arbitrum projects - handle both V4 query (with items) and V1 query (flat array)
      let arbitrumProjects: BuilderProject[] = [];
      
      if (useArbitrumV4Queries) {
        // Arbitrum V4 query returns nested structure: buildersProjects.items[]
        const v4Projects = (arbitrumResponse.data as { buildersProjects?: { items?: BuilderProject[] } })?.buildersProjects?.items || [];
        
        arbitrumProjects = v4Projects.map((project): BuilderProject => {
          const totalStakedInMor = Number(project.totalStaked || '0') / 1e18;
          const minDepositInMor = Number(project.minimalDeposit || '0') / 1e18;
          const totalClaimedInMor = Number(project.totalClaimed || '0') / 1e18;
          
          return {
            ...project,
            name: normalizeBuilderName(project.name), // Normalize the name
            startsAt: typeof project.startsAt === 'string' ? project.startsAt : '',
            claimLockEnd: typeof project.claimLockEnd === 'string' ? project.claimLockEnd : '',
            networks: ['Arbitrum'],
            network: 'Arbitrum',
            stakingCount: parseInt(project.totalUsers || '0', 10),
            lockPeriod: formatTimePeriod(parseInt(project.withdrawLockPeriodAfterDeposit || '0', 10)),
            minDeposit: minDepositInMor,
            totalStakedFormatted: totalStakedInMor,
            totalClaimedFormatted: totalClaimedInMor,
            totalClaimed: totalClaimedInMor.toString(),
            mainnetProjectId: project.id,
          };
        });
      } else {
        // Arbitrum V1 query returns flat array: buildersProjects[]
        const v1Projects = (arbitrumResponse.data as CombinedBuildersListFilteredByPredefinedBuildersResponse)?.buildersProjects || [];
        
        arbitrumProjects = v1Projects.map((project): BuilderProject => {
          const totalStakedInMor = Number(project.totalStaked || '0') / 1e18;
          const minDepositInMor = Number(project.minimalDeposit || '0') / 1e18;
          const totalClaimedInMor = Number(project.totalClaimed || '0') / 1e18;
          const lockPeriodFormatted = formatTimePeriod(parseInt(project.withdrawLockPeriodAfterDeposit || '0', 10));

          return {
            ...project,
            name: normalizeBuilderName(project.name), // Normalize the name
            startsAt: typeof project.startsAt === 'string' ? project.startsAt : '',
            claimLockEnd: typeof project.claimLockEnd === 'string' ? project.claimLockEnd : '',
            networks: ['Arbitrum'],
            network: 'Arbitrum',
            stakingCount: parseInt(project.totalUsers || '0', 10),
            lockPeriod: lockPeriodFormatted,
            minDeposit: minDepositInMor,
            totalStakedFormatted: totalStakedInMor,
            totalClaimedFormatted: totalClaimedInMor,
            totalClaimed: totalClaimedInMor.toString(),
            mainnetProjectId: project.id,
          };
        });
      }

      // console.log('[API] Mainnet: Fetched from Base:', baseProjects.length, 'projects');
      // console.log('[API] Mainnet: Fetched from Arbitrum:', arbitrumProjects.length, 'projects');
      
      combinedProjects = [...baseProjects, ...arbitrumProjects];
      // console.log('[API] Mainnet: Combined projects:', combinedProjects.length);

      if (!supabaseBuilders) {
        // console.warn("[API] Mainnet: supabaseBuilders is null at merging stage. Returning empty Builder array.");
        return [];
      }

      // Check for duplicate builder names across networks
      const builderNameCounts = combinedProjects.reduce((counts, project) => {
        counts[project.name] = (counts[project.name] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);

      const duplicateBuilderNames = Object.entries(builderNameCounts)
        .filter(([, count]) => count > 1)
        .map(([name]) => name);

      // if (duplicateBuilderNames.length > 0) {
      //   console.log('[API] Mainnet: Found builders deployed on multiple networks:', duplicateBuilderNames);
      // }

      // NEW APPROACH: Map from combined projects to preserve network information
      const mappedBuilders: Builder[] = [];
      
      // First process all combined projects to create builder objects
      combinedProjects.forEach(onChainProject => {
        // For mainnet V4 queries: Detect if subnet is V4 (has metadata) or V1 (missing metadata)
        // Works for both Base and Arbitrum when using V4 queries
        const isV4Query = (useBaseV4Queries && onChainProject.network === 'Base') || 
                          (useArbitrumV4Queries && onChainProject.network === 'Arbitrum');
        const subnetIsV4 = isV4Query ? isV4Subnet(onChainProject) : false;
        
        const matchingSupabaseBuilder = supabaseBuilders.find(b => b.name === onChainProject.name);
        
        if (matchingSupabaseBuilder) {
          const mainnetLockPeriodSeconds = parseInt(onChainProject.withdrawLockPeriodAfterDeposit || '0', 10);
          
          // For V4 subnets: Use on-chain metadata as primary source, optionally enrich with Supabase
          // For V1 subnets: Merge on-chain data with Supabase metadata
          if (subnetIsV4) {
            // V4 subnet: Use on-chain metadata, enrich with Supabase extended metadata
            const builder = mergeBuilderData(matchingSupabaseBuilder, {
              id: onChainProject.id,
              totalStaked: onChainProject.totalStakedFormatted !== undefined 
                ? onChainProject.totalStakedFormatted 
                : parseFloat(onChainProject.totalStaked || '0') / 1e18 || 0,
              totalClaimed: onChainProject.totalClaimedFormatted !== undefined 
                ? onChainProject.totalClaimedFormatted 
                : parseFloat(onChainProject.totalClaimed || '0') / 1e18 || 0,
              minimalDeposit: parseFloat(onChainProject.minimalDeposit || '0') / 1e18 || 0,
              withdrawLockPeriodAfterDeposit: mainnetLockPeriodSeconds,
              withdrawLockPeriodRaw: mainnetLockPeriodSeconds,
              stakingCount: onChainProject.stakingCount || 0,
              lockPeriod: onChainProject.lockPeriod || '',
              network: onChainProject.network || 'Unknown',
              networks: onChainProject.networks || ['Unknown'],
              admin: onChainProject.admin,
              // V4: Use on-chain metadata (description, website, image, slug)
              image: onChainProject.image || matchingSupabaseBuilder.image_src || undefined,
              website: onChainProject.website || matchingSupabaseBuilder.website || undefined,
              description: onChainProject.description || matchingSupabaseBuilder.description || undefined,
              startsAt: onChainProject.startsAt,
            });
            
            // Add slug if available (V4-only field)
            if (onChainProject.slug) {
              (builder as any).slug = onChainProject.slug;
            }
            
            // Add a unique identifier for duplicate builders across networks
            if (duplicateBuilderNames.includes(onChainProject.name)) {
              builder.id = `${builder.id}-${onChainProject.network?.toLowerCase()}`;
            }
            
            mappedBuilders.push(builder);
          } else {
            // V1 subnet: Merge on-chain data with Supabase metadata
            const builder = mergeBuilderData(matchingSupabaseBuilder, {
              id: onChainProject.id,
              totalStaked: onChainProject.totalStakedFormatted !== undefined 
                ? onChainProject.totalStakedFormatted 
                : parseFloat(onChainProject.totalStaked || '0') / 1e18 || 0,
              totalClaimed: onChainProject.totalClaimedFormatted !== undefined 
                ? onChainProject.totalClaimedFormatted 
                : parseFloat(onChainProject.totalClaimed || '0') / 1e18 || 0,
              minimalDeposit: parseFloat(onChainProject.minimalDeposit || '0') / 1e18 || 0,
              withdrawLockPeriodAfterDeposit: mainnetLockPeriodSeconds,
              withdrawLockPeriodRaw: mainnetLockPeriodSeconds,
              stakingCount: onChainProject.stakingCount || 0,
              lockPeriod: onChainProject.lockPeriod || '',
              network: onChainProject.network || 'Unknown',
              networks: onChainProject.networks || ['Unknown'],
              admin: onChainProject.admin,
              // V1: Use Supabase metadata (image_src, website, description from Supabase)
              image: matchingSupabaseBuilder.image_src || onChainProject.image || undefined,
              website: matchingSupabaseBuilder.website || onChainProject.website || undefined,
              startsAt: onChainProject.startsAt,
            });
            
            // Add a unique identifier for duplicate builders across networks
            if (duplicateBuilderNames.includes(onChainProject.name)) {
              // Append network to the ID to make it unique
              builder.id = `${builder.id}-${onChainProject.network?.toLowerCase()}`;
            }
            
            mappedBuilders.push(builder);
          }
        } else {
          // This is an on-chain builder that doesn't exist in Supabase
          // Create a minimal builder object
          // console.log(`[API] Mainnet: Found on-chain builder '${onChainProject.name}' on ${onChainProject.network} not in Supabase`);
          
          const currentDate = new Date().toISOString();
          const builder: Builder = {
            id: onChainProject.id,
            mainnetProjectId: onChainProject.id,
            name: onChainProject.name,
            description: onChainProject.description || `${onChainProject.name} (on ${onChainProject.network})`,
            long_description: '',
            admin: onChainProject.admin || "",
            networks: onChainProject.networks || [onChainProject.network || 'Unknown'],
            network: onChainProject.network || 'Unknown',
            totalStaked: onChainProject.totalStakedFormatted !== undefined 
              ? onChainProject.totalStakedFormatted 
              : parseFloat(onChainProject.totalStaked || '0') / 1e18 || 0,
            totalClaimed: onChainProject.totalClaimedFormatted !== undefined
              ? onChainProject.totalClaimedFormatted
              : parseFloat(onChainProject.totalClaimed || '0') / 1e18 || 0,
            minDeposit: parseFloat(onChainProject.minimalDeposit || '0') / 1e18 || 0,
            lockPeriod: onChainProject.lockPeriod || '',
            stakingCount: onChainProject.stakingCount || 0,
            website: onChainProject.website || '',
            image_src: onChainProject.image || '',
            image: onChainProject.image || '',
            tags: [],
            github_url: '',
            twitter_url: '',
            discord_url: '',
            contributors: 0,
            github_stars: 0,
            reward_types: ['TBA'],
            reward_types_detail: [],
            created_at: currentDate,
            updated_at: currentDate,
            startsAt: onChainProject.startsAt,
          };
          
          // Add a unique identifier for duplicate builders across networks
          if (duplicateBuilderNames.includes(onChainProject.name)) {
            // Append network to the ID to make it unique
            builder.id = `${builder.id}-${onChainProject.network?.toLowerCase()}`;
          }
          
          mappedBuilders.push(builder);
        }
      });
      
      // Process any remaining Supabase builders that weren't found on-chain
      const onChainBuilderNames = combinedProjects.map(p => p.name);
      const supabaseOnlyBuilders = supabaseBuilders.filter(b => !onChainBuilderNames.includes(b.name));
      
      if (supabaseOnlyBuilders.length > 0) {
        // console.log(`[API] Mainnet: Found ${supabaseOnlyBuilders.length} builders in Supabase without on-chain data`);
        
        // Add these builders to the mapped list with default on-chain values
        supabaseOnlyBuilders.forEach(builderDB => {
          // Check if this is a newly created subnet and get its admin address
          const newlyCreatedAdmin = getNewlyCreatedSubnetAdmin ? getNewlyCreatedSubnetAdmin(builderDB.name) : null;
          const adminAddress = newlyCreatedAdmin || ""; // Use cached admin address if available
          
          // console.log(`[API] Mainnet: Processing Supabase-only builder "${builderDB.name}" with admin: ${adminAddress || 'none'}`);
          
          const builder = mergeBuilderData(builderDB, {
            id: "",
            totalStaked: 0,
            minimalDeposit: 0,
            withdrawLockPeriodAfterDeposit: 0,
            withdrawLockPeriodRaw: 0,
            stakingCount: 0,
            lockPeriod: '',
            network: builderDB.networks?.[0] || 'Unknown',
            networks: builderDB.networks || ['Unknown'],
            admin: adminAddress, // Use the admin address from cache if this is a newly created subnet
          });
          
          mappedBuilders.push(builder);
        });
      }
      
      // console.log("[fetchBuildersAPI Mainnet] Finished creating builders list. Count:", mappedBuilders.length);

      // Populate builderUsers for mainnet if userAddress was provided
      if (userAddress && (baseResponse.data?.buildersUsers || arbitrumResponse.data?.buildersUsers)) {
        const allUserStakes = [
          ...(baseResponse.data?.buildersUsers || []),
          ...(arbitrumResponse.data?.buildersUsers || [])
        ];

        mappedBuilders.forEach(builder => {
          const userStakesForThisBuilder = allUserStakes.filter(
            stake => stake.buildersProject?.id === builder.mainnetProjectId || stake.buildersProject?.name === builder.name
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
    console.error('[API] Error fetching builder data:', e);
    throw e instanceof Error ? e : new Error('An unknown error occurred while fetching builder data via API service');
  }
}; 