import { useState, useCallback, useMemo, useEffect } from "react";
import { fetchGraphQL, getEndpointForNetwork } from "@/app/graphql/client";
import { BuildersGraphQLResponse, ComputeGraphQLResponse, StakingEntry, BuildersUser, SubnetUser } from "@/app/graphql/types";
import { GET_BUILDERS_PROJECT_BY_NAME, GET_BUILDERS_PROJECT_USERS, GET_BUILDER_SUBNET_BY_NAME, GET_BUILDER_SUBNET_USERS } from "@/app/graphql/queries/builders";
import { GET_SUBNET_USERS } from "@/app/graphql/queries/compute";
import { useChainId } from 'wagmi';
import { baseSepolia, base, arbitrum } from 'wagmi/chains';
import { getClientForNetwork } from '@/lib/apollo-client';
import { 
  GET_PROJECT_WITH_DETAILS_BASE_SEPOLIA, 
  GET_PROJECT_WITH_DETAILS_BASE_MAINNET, 
  GET_PROJECT_WITH_DETAILS_ARBITRUM_MAINNET,
  GET_PROJECT_USERS_PAGINATED_BASE_SEPOLIA,
  GET_PROJECT_USERS_PAGINATED_BASE_MAINNET,
  GET_PROJECT_USERS_PAGINATED_ARBITRUM_MAINNET
} from '@/lib/graphql/builders-queries';
import { USE_GOLDSKY_V1_DATA } from '@/app/config/subgraph-endpoints';

export interface StakingPaginationState {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface StakingSortingState {
  column: string | null;
  direction: 'asc' | 'desc';
}

export interface UseStakingDataProps {
  projectId?: string;
  projectName?: string;
  network?: string;
  initialPageSize?: number;
  initialSort?: {
    column: string | null;
    direction: 'asc' | 'desc';
  };
  formatAddressFunc?: (address: string) => string;
  formatEntryFunc?: (entry: BuilderSubnetUser | BuildersUser | SubnetUser) => StakingEntry;
  queryEndpoint?: string;
  queryFunction?: string;
  queryDocument?: string;
  isComputeProject?: boolean;
  isTestnet?: boolean;
}

// Define types for testnet responses
export interface BuilderSubnetUser {
  id: string;
  address: string;
  staked: string;
  claimed: string;
  claimLockEnd: string;
  lastStake: string;
}

interface BuilderSubnet {
  id: string;
  name: string;
  totalStaked: string;
  totalUsers: string;
  withdrawLockPeriodAfterStake: string;
  minStake: string;
  builderUsers?: BuilderSubnetUser[];
}

// Data structure returned inside the data property
interface BuilderSubnetResponseData {
  builderSubnets?: BuilderSubnet[];
  builderUsers?: BuilderSubnetUser[];
}

// Full GraphQL response structure for subnet queries, matches other response interfaces
interface BuilderSubnetResponse {
  data: BuilderSubnetResponseData;
  errors?: Array<{ message: string }>;
}

export function useStakingData({
  projectId,
  projectName,
  network = 'Base',
  initialPageSize = 5, // Keep at 5 to match what the working implementation uses
  initialSort = { column: 'staked', direction: 'desc' }, // Change to 'staked' to match the GraphQL field name
  formatAddressFunc,
  formatEntryFunc,
  queryEndpoint,
  queryFunction,
  queryDocument,
  isComputeProject = false,
  isTestnet: providedIsTestnet,
}: UseStakingDataProps) {
  // Auto-detect testnet if not explicitly provided
  const chainId = useChainId();
  const isTestnet = providedIsTestnet !== undefined ? providedIsTestnet : chainId === baseSepolia.id;
  
  /**
   * Helper function to detect if a project is V4 (has on-chain metadata) or V1 (missing metadata)
   * V4 projects will have metadata fields populated (description, website, image, slug)
   * V1 projects discovered via V4 query will have these fields empty/null
   */
  const isV4Project = useCallback((project: { slug?: string; description?: string; website?: string; image?: string } | null): boolean => {
    if (!project) return false;
    // V4 projects have metadata fields populated
    return !!(
      project.description || 
      project.website || 
      project.image || 
      project.slug
    );
  }, []);
  
  // Get the appropriate Apollo client and queries for BuildersV4 networks
  const getBuildersV4Config = useCallback(() => {
    if (chainId === baseSepolia.id) {
      return {
        client: getClientForNetwork('BaseSepolia'),
        projectQuery: GET_PROJECT_WITH_DETAILS_BASE_SEPOLIA,
        usersQuery: GET_PROJECT_USERS_PAGINATED_BASE_SEPOLIA,
      };
    } else if (chainId === base.id) {
      return {
        client: getClientForNetwork('Base'),
        projectQuery: GET_PROJECT_WITH_DETAILS_BASE_MAINNET,
        usersQuery: GET_PROJECT_USERS_PAGINATED_BASE_MAINNET,
      };
    } else if (chainId === arbitrum.id) {
      return {
        client: getClientForNetwork('Arbitrum'),
        projectQuery: GET_PROJECT_WITH_DETAILS_ARBITRUM_MAINNET,
        usersQuery: GET_PROJECT_USERS_PAGINATED_ARBITRUM_MAINNET,
      };
    }
    return null;
  }, [chainId]);
  
  // Data fetching state
  const [entries, setEntries] = useState<StakingEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [id, setId] = useState<string | null>(projectId || null);
  
  // Pagination state
  const [pagination, setPagination] = useState<StakingPaginationState>({
    currentPage: 1,
    pageSize: initialPageSize,
    totalItems: 0,
    totalPages: 1
  });
  
  // Sorting state
  const [sorting, setSorting] = useState<StakingSortingState>(initialSort);
  
  // Cache for storing fetched pages
  const [cachedPages, setCachedPages] = useState<Record<number, StakingEntry[]>>({});
  
  // Default formatter functions
  const defaultFormatAddress = (address: string): string => {
    if (!address) return "";
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  // Use provided formatters or defaults
  const formatAddress = formatAddressFunc || defaultFormatAddress;
  
  // Fetch project ID by name if needed
  const fetchProjectIdByName = useCallback(async (name: string): Promise<string | null> => {
    try {
      const endpoint = getEndpointForNetwork(network);
      
      if (isComputeProject) {
        // Logic for compute project
        // Not implemented since we're using the existing subnet.id
        return null;
      } else if (isTestnet) {
        // Logic for testnet builders project
        console.log(`[Testnet] Fetching builder subnet by name: ${name}`);
        
        const response = await fetchGraphQL<BuilderSubnetResponse>(
          endpoint,
          "getBuilderSubnetByName",
          GET_BUILDER_SUBNET_BY_NAME,
          { name }
        );
        
        if (response.errors && response.errors.length > 0) {
          throw new Error(response.errors[0].message);
        }
        
        if (!response.data.builderSubnets?.length) {
          return null;
        }
        
        const subnet = response.data.builderSubnets[0];
        console.log(`[Testnet] Found subnet: ${subnet.name}, id: ${subnet.id}`);
        
        // Update total items count
        if (subnet.totalUsers) {
          setPagination(prev => ({
            ...prev,
            totalItems: parseInt(subnet.totalUsers),
            totalPages: Math.max(1, Math.ceil(parseInt(subnet.totalUsers) / prev.pageSize))
          }));
        }
        
        // If the subnet already has builderUsers, we can pre-populate the entries
        if (subnet.builderUsers && subnet.builderUsers.length > 0) {
          console.log(`[Testnet] Subnet has ${subnet.builderUsers.length} users, prepopulating`);
          
          // Format the data using provided formatter or default
          const formattedEntries = subnet.builderUsers.map((user: BuilderSubnetUser) => {
            if (formatEntryFunc) {
              return formatEntryFunc(user);
            }
            
            // Default formatter
            return {
              address: user.address,
              displayAddress: formatAddress(user.address),
              amount: parseFloat(user.staked || '0') / 10**18,
              timestamp: parseInt(user.lastStake || '0'),
            };
          });
          
          // Cache the entries for page 1
          setCachedPages(prev => ({
            ...prev,
            1: formattedEntries
          }));
          
          // Set entries if we're on page 1
          if (pagination.currentPage === 1) {
            setEntries(formattedEntries);
          }
        }
        
        return subnet.id;
      } else {
        // Logic for mainnet builders project
        const response = await fetchGraphQL<BuildersGraphQLResponse>(
          endpoint,
          "getBuildersProjectsByName",
          GET_BUILDERS_PROJECT_BY_NAME,
          { name }
        );
        
        if (response.errors && response.errors.length > 0) {
          throw new Error(response.errors[0].message);
        }
        
        if (!response.data?.buildersProjects?.items?.length) {
          return null;
        }
        
        const project = response.data.buildersProjects.items[0];
        // Update total items count
        if (project.totalUsers) {
          setPagination(prev => ({
            ...prev,
            totalItems: parseInt(project.totalUsers),
            totalPages: Math.max(1, Math.ceil(parseInt(project.totalUsers) / prev.pageSize))
          }));
        }
        
        return project.id;
      }
    } catch (error) {
      console.error("Error fetching project ID:", error);
      setError(error instanceof Error ? error : new Error("Failed to fetch project ID"));
      return null;
    }
  }, [network, isComputeProject, isTestnet, formatEntryFunc, formatAddress, pagination.currentPage, pagination.pageSize]);

  // Fetch data
  const fetchData = useCallback(async () => {
    console.log('[useStakingData] fetchData CALLED. Internal id before any checks:', id, 'projectName:', projectName, 'currentPage:', pagination.currentPage);
    // We should set loading to true on initial load, even if we're already loading
    // This fixes the issue where tables are stuck in loading state
    setIsLoading(true);
    setError(null); // Clear any previous errors when starting a new fetch
    
    try {
      
      // For compute projects, we need a projectId
      if (isComputeProject && !id) {
        console.log('No project ID available for compute project');
        setIsLoading(false); // End loading if no ID for compute project
        return;
      }

      // For builder projects, we need either projectId or projectName
      if (!isComputeProject && !id && !projectName) {
        console.log('No project ID or name available for builder project');
        setIsLoading(false); // End loading if no parameters for builder project
        return;
      }
      
      // Check cache first
      if (cachedPages[pagination.currentPage]?.length > 0) {
        console.log('[useStakingData] Using cached data for page', pagination.currentPage, cachedPages[pagination.currentPage]);
        setEntries(cachedPages[pagination.currentPage]);
        setIsLoading(false);
        return;
      }
      
      // Get project ID 
      let projectIdToUse = id;
      console.log('[useStakingData] Initial projectIdToUse:', projectIdToUse);
      
      // For builder projects, look up by name if needed
      if (!isComputeProject && !projectIdToUse && projectName) {
        projectIdToUse = await fetchProjectIdByName(projectName);
        if (projectIdToUse) {
          setId(projectIdToUse);
        } else {
          throw new Error(`Could not find project ID for: ${projectName}`);
        }
      }
      
      if (!projectIdToUse) {
        console.warn('[useStakingData] No projectIdToUse available for fetching data, returning.');
        // setError(new Error("No project ID available for fetching data")); // Maybe set error here too
        setIsLoading(false);
        setEntries([]); // Ensure entries are empty if no ID
        return; // Early return if no ID
      }
      console.log('[useStakingData] Final projectIdToUse for query:', projectIdToUse);
      
      // Calculate pagination skip
      const skip = (pagination.currentPage - 1) * pagination.pageSize;
      
      // Get the right endpoint
      const endpoint = queryEndpoint || getEndpointForNetwork(network);
      
      console.log('Fetching data from endpoint:', endpoint);
      console.log('Query parameters:', {
        projectId: projectIdToUse,
        skip,
        first: pagination.pageSize,
        isComputeProject,
        isTestnet
      });
      
      // Fetch total users count first for better pagination
      if (!isComputeProject && !isTestnet && projectIdToUse) {
        try {
          console.log(`[useStakingData] Fetching builder project details to get total user count`);
                     // We need to make a specific query for this to work properly
           const getProjectQuery = `
           query getBuildersProjects($id: ID!) {
             buildersProjects(where: {id: $id}) {
               items {
                 id
                 totalUsers
               }
             }
           }`;
           
           const builderResponse = await fetchGraphQL<BuildersGraphQLResponse>(
            endpoint,
            "getBuildersProjects",
            getProjectQuery,
            { id: projectIdToUse }
          );
          
          if (builderResponse.data?.buildersProjects?.items?.[0]) {
            const totalUsers = parseInt(builderResponse.data.buildersProjects.items[0].totalUsers || '0');
            console.log(`[useStakingData] Found builder with totalUsers: ${totalUsers}`);
            
            // Calculate total pages
            const totalPages = Math.max(1, Math.ceil(totalUsers / pagination.pageSize));
            
            // Update pagination with accurate total count
            setPagination(prev => ({
              ...prev,
              totalItems: totalUsers,
              totalPages: totalPages
            }));
            
            // Background prefetch the second page if there are more pages
            if (totalPages > 1 && pagination.currentPage === 1) {
              console.log(`[useStakingData] Background prefetching page 2 data`);
              setTimeout(() => {
                fetchGraphQL<BuildersGraphQLResponse>(
                  endpoint,
                  queryFunction || "getBuildersProjectUsers",
                  queryDocument || GET_BUILDERS_PROJECT_USERS,
                  {
                    first: pagination.pageSize,
                    skip: pagination.pageSize, // Skip first page
                    buildersProjectId: projectIdToUse,
                    orderBy: 'staked',
                    orderDirection: 'desc'
                  }
                ).then(nextPageResponse => {
                  if (nextPageResponse.data?.buildersUsers) {
                    // Format and cache the next page
                    const formattedNextPageEntries = (nextPageResponse.data.buildersUsers?.items || []).map(user => {
                      if (formatEntryFunc) {
                        return formatEntryFunc(user);
                      }
                      return {
                        address: user.address,
                        displayAddress: formatAddress(user.address),
                        amount: parseFloat(user.staked || '0') / 10**18,
                        timestamp: parseInt(user.lastStake || '0'),
                      };
                    });
                    
                    // Cache the prefetched page
                    setCachedPages(prev => ({
                      ...prev,
                      2: formattedNextPageEntries
                    }));
                    console.log(`[useStakingData] Page 2 prefetched and cached`);
                  }
                }).catch(error => {
                  console.warn(`[useStakingData] Error prefetching page 2:`, error);
                });
              }, 500); // Small delay to prioritize current page render
            }
          }
        } catch (error) {
          console.error('[useStakingData] Error fetching builder details:', error);
        }
      }
      
      // Make the actual data query
      if (isComputeProject) {
        const response = await fetchGraphQL<ComputeGraphQLResponse>(
          endpoint,
          queryFunction || "GetProviders",
          queryDocument || GET_SUBNET_USERS,
          {
            subnetId: projectIdToUse,
            skip,
            first: pagination.pageSize
          }
        );
        
        if (!response.data) {
          throw new Error("No data returned from API");
        }
        
        console.log('[useStakingData] Compute data received:', response);
        
        // Get total users count if available
        const project = response.data.subnets?.[0];
        if (project?.totalUsers) {
          setPagination(prev => ({
            ...prev,
            totalItems: parseInt(project.totalUsers),
            totalPages: Math.max(1, Math.ceil(parseInt(project.totalUsers) / prev.pageSize))
          }));
        }
        
        // Format the data using provided formatter or default
        const formattedEntries = (response.data.subnetUsers || []).map(user => {
          if (formatEntryFunc) {
            return formatEntryFunc(user);
          }
          
          // Default formatter
          return {
            address: user.address,
            displayAddress: formatAddress(user.address),
            amount: parseFloat(user.staked || '0') / 10**18,
            claimed: parseFloat(user.claimed || '0') / 10**18,
          };
        });
        
        console.log('[useStakingData] Formatted compute entries:', formattedEntries);
        
        // Only update cache and state if we have data and we're still on the same page
        setCachedPages(prev => ({
          ...prev,
          [pagination.currentPage]: formattedEntries
        }));
        
        setEntries(formattedEntries);
      } else {
        // Check if we're on a chain that supports BuildersV4 schema (Base Sepolia, Base Mainnet, Arbitrum Mainnet)
        // Note: On Base/Arbitrum mainnet, there can be both V1 subnets (old, no metadata) and V4 subnets (new, has metadata)
        // We use BuildersV4 queries for all subnets on these chains, but detect V1 vs V4 after fetching project data
        const buildersV4Config = getBuildersV4Config();
        
        if (buildersV4Config && buildersV4Config.client) {
          // BuildersV4 schema queries work for both V1 and V4 subnets on these chains
          // V1 subnets will have empty metadata fields and need Supabase metadata lookup
          console.log(`[useStakingData] Using BuildersV4 schema queries for chainId: ${chainId} (will detect V1 vs V4 after fetching project data)`);
          
          // Check if we should use Goldsky API routes
          const networkName = chainId === base.id ? 'base' : chainId === arbitrum.id ? 'arbitrum' : 'base';
          
          if (USE_GOLDSKY_V1_DATA && (chainId === base.id || chainId === arbitrum.id)) {
            // Use Goldsky API routes for mainnet
            console.log(`[useStakingData] Using Goldsky API routes for projectId: ${projectIdToUse}`);
            
            try {
              if (pagination.currentPage === 1) {
                // Page 1: Fetch project details and first page of users
                const [projectResponse, usersResponse] = await Promise.all([
                  fetch(`/api/builders/goldsky/${projectIdToUse}?network=${networkName}`),
                  fetch(`/api/builders/goldsky/${projectIdToUse}/users?network=${networkName}&limit=${pagination.pageSize}&offset=0`)
                ]);

                if (!projectResponse.ok || !usersResponse.ok) {
                  throw new Error(`Failed to fetch Goldsky data: project=${projectResponse.status}, users=${usersResponse.status}`);
                }

                const projectData = await projectResponse.json();
                const usersData = await usersResponse.json();

                const project = projectData.buildersProject;
                if (!project) {
                  throw new Error("No project data returned from Goldsky API");
                }

                // Detect if this is a V4 project (has metadata) or V1 project (needs Supabase metadata lookup)
                const projectIsV4 = isV4Project(project);
                if (!projectIsV4) {
                  console.log(`[useStakingData] Detected V1 subnet "${project.name}" (no metadata fields). Supabase metadata lookup needed for full project details.`);
                } else {
                  console.log(`[useStakingData] Detected V4 subnet "${project.name}" (has on-chain metadata).`);
                }

                // Update pagination with total count
                const totalUsers = usersData.buildersUsers?.totalCount || parseInt(project.totalUsers || '0', 10);
                const totalPages = Math.max(1, Math.ceil(totalUsers / pagination.pageSize));
                
                setPagination(prev => ({
                  ...prev,
                  totalItems: totalUsers,
                  totalPages: totalPages
                }));
                
                // Format users from API response
                const users = usersData.buildersUsers?.items || [];
                const formattedEntries = users.map((user: { address: string; staked: string; lastStake: string }) => {
                  if (formatEntryFunc) {
                    // Cast to BuildersUser (id may be missing but formatEntryFunc doesn't require it)
                    const buildersUser: BuildersUser = {
                      id: user.address, // Use address as id fallback
                      address: user.address,
                      staked: user.staked,
                      lastStake: user.lastStake,
                    };
                    return formatEntryFunc(buildersUser);
                  }
                  return {
                    address: user.address,
                    displayAddress: formatAddress(user.address),
                    amount: parseFloat(user.staked || '0') / 1e18,
                    timestamp: parseInt(user.lastStake || '0'),
                  };
                }).filter((entry: { amount: number }) => entry.amount > 0);
                
                // Cache and set entries
                setCachedPages(prev => ({
                  ...prev,
                  1: formattedEntries
                }));
                setEntries(formattedEntries);
                
                console.log(`[useStakingData] Loaded ${formattedEntries.length} entries from Goldsky API`);
              } else {
                // Page > 1: Use paginated users query
                const offset = (pagination.currentPage - 1) * pagination.pageSize;
                const limit = pagination.pageSize;
                
                console.log(`[useStakingData] Fetching paginated users from Goldsky: offset=${offset}, limit=${limit}`);
                
                const usersResponse = await fetch(
                  `/api/builders/goldsky/${projectIdToUse}/users?network=${networkName}&limit=${limit}&offset=${offset}`
                );

                if (!usersResponse.ok) {
                  throw new Error(`Failed to fetch Goldsky users: ${usersResponse.status}`);
                }

                const usersData = await usersResponse.json();
                const users = usersData.buildersUsers?.items || [];
                
                const formattedEntries = users.map((user: { address: string; staked: string; lastStake: string }) => {
                  if (formatEntryFunc) {
                    // Cast to BuildersUser (id may be missing but formatEntryFunc doesn't require it)
                    const buildersUser: BuildersUser = {
                      id: user.address, // Use address as id fallback
                      address: user.address,
                      staked: user.staked,
                      lastStake: user.lastStake,
                    };
                    return formatEntryFunc(buildersUser);
                  }
                  return {
                    address: user.address,
                    displayAddress: formatAddress(user.address),
                    amount: parseFloat(user.staked || '0') / 1e18,
                    timestamp: parseInt(user.lastStake || '0'),
                  };
                }).filter((entry: { amount: number }) => entry.amount > 0);
                
                // Cache and set entries
                setCachedPages(prev => ({
                  ...prev,
                  [pagination.currentPage]: formattedEntries
                }));
                setEntries(formattedEntries);
                
                console.log(`[useStakingData] Loaded ${formattedEntries.length} entries from Goldsky paginated users API`);
              }
            } catch (error) {
              console.error('[useStakingData] Error fetching from Goldsky API:', error);
              setError(error instanceof Error ? error : new Error('Failed to fetch staking data'));
              setIsLoading(false);
              return;
            }
          } else {
            // Use direct Ponder V4 GraphQL queries
            try {
              if (pagination.currentPage === 1) {
              // Page 1: Use project details query with first 10 users
              console.log(`[useStakingData] Fetching project details with first 10 users for projectId: ${projectIdToUse}`);
              
              const projectResponse = await buildersV4Config.client.query<{
                buildersProject?: {
                  id: string;
                  name: string;
                  admin: string;
                  totalStaked: string;
                  totalUsers: string;
                  totalClaimed: string;
                  slug: string;
                  description: string;
                  users?: {
                    items?: Array<{
                      id: string;
                      address: string;
                      staked: string;
                      lastStake: string;
                    }>;
                    totalCount: number;
                  };
                };
              }>({
                query: buildersV4Config.projectQuery,
                variables: { projectId: projectIdToUse },
                fetchPolicy: 'no-cache',
              });
              
              const project = projectResponse.data?.buildersProject;
              if (!project) {
                throw new Error("No project data returned from API");
              }
              
              // Detect if this is a V4 project (has metadata) or V1 project (needs Supabase metadata lookup)
              const projectIsV4 = isV4Project(project);
              if (!projectIsV4) {
                console.log(`[useStakingData] Detected V1 subnet "${project.name}" (no metadata fields). Supabase metadata lookup needed for full project details.`);
              } else {
                console.log(`[useStakingData] Detected V4 subnet "${project.name}" (has on-chain metadata).`);
              }
              
              // Update pagination with total count
              const totalUsers = project.users?.totalCount || parseInt(project.totalUsers || '0', 10);
              const totalPages = Math.max(1, Math.ceil(totalUsers / pagination.pageSize));
              
              setPagination(prev => ({
                ...prev,
                totalItems: totalUsers,
                totalPages: totalPages
              }));
              
              // Format users from project query (first 10)
              const users = project.users?.items || [];
              const formattedEntries = users.map(user => {
                if (formatEntryFunc) {
                  return formatEntryFunc(user);
                }
                return {
                  address: user.address,
                  displayAddress: formatAddress(user.address),
                  amount: parseFloat(user.staked || '0') / 1e18,
                  timestamp: parseInt(user.lastStake || '0'),
                };
              }).filter(entry => entry.amount > 0);
              
              // Cache and set entries
              setCachedPages(prev => ({
                ...prev,
                1: formattedEntries
              }));
              setEntries(formattedEntries);
              
              console.log(`[useStakingData] Loaded ${formattedEntries.length} entries from project query`);
            } else {
              // Page > 1: Use paginated users query
              const offset = (pagination.currentPage - 1) * pagination.pageSize;
              const limit = pagination.pageSize;
              
              console.log(`[useStakingData] Fetching paginated users: offset=${offset}, limit=${limit}`);
              
              const usersResponse = await buildersV4Config.client.query<{
                buildersUsers?: {
                  items?: Array<{
                    id: string;
                    address: string;
                    staked: string;
                    lastStake: string;
                  }>;
                  totalCount: number;
                };
              }>({
                query: buildersV4Config.usersQuery,
                variables: {
                  projectId: projectIdToUse,
                  limit: limit,
                  offset: offset
                },
                fetchPolicy: 'no-cache',
              });
              
              const users = usersResponse.data?.buildersUsers?.items || [];
              const formattedEntries = users.map(user => {
                if (formatEntryFunc) {
                  return formatEntryFunc(user);
                }
                return {
                  address: user.address,
                  displayAddress: formatAddress(user.address),
                  amount: parseFloat(user.staked || '0') / 1e18,
                  timestamp: parseInt(user.lastStake || '0'),
                };
              }).filter(entry => entry.amount > 0);
              
              // Cache and set entries
              setCachedPages(prev => ({
                ...prev,
                [pagination.currentPage]: formattedEntries
              }));
              setEntries(formattedEntries);
              
              console.log(`[useStakingData] Loaded ${formattedEntries.length} entries from paginated query`);
              }
            } catch (error) {
              console.error(`[useStakingData] Error fetching BuildersV4 data:`, error);
              setError(error instanceof Error ? error : new Error("Failed to fetch staking data"));
              setEntries([]);
            } finally {
              setIsLoading(false);
            }
          }
          
          return; // Exit early for BuildersV4
        }
        
        // Legacy testnet builder subnet query (for non-BuildersV4 testnets)
        if (isTestnet) {
          // Testnet builder subnet query
          try {
            const response = await fetchGraphQL<BuilderSubnetResponse>(
              endpoint,
              queryFunction || "getBuilderSubnetUsers",
              queryDocument || GET_BUILDER_SUBNET_USERS,
              {
                first: pagination.pageSize,
                skip,
                builderSubnetId: projectIdToUse,
                orderBy: 'staked',
                orderDirection: 'desc'
              }
            );
            
            if (!response.data) {
              throw new Error("No data returned from API");
            }
            
            console.log('[useStakingData] [Testnet] Builder subnet users data raw response:', response);
            
            // Format the data using provided formatter or default
            const formattedEntries = (response.data?.builderUsers || []).map((user: BuilderSubnetUser) => {
              if (formatEntryFunc) {
                return formatEntryFunc(user);
              }
              
              // Default formatter
              return {
                address: user.address,
                displayAddress: formatAddress(user.address),
                amount: parseFloat(user.staked || '0') / 10**18,
                timestamp: parseInt(user.lastStake || '0'),
              };
            }).filter(entry => entry.amount > 0); // Filter out entries with zero amount
            
            console.log('[useStakingData] [Testnet] Formatted entries (after filtering zeros):', formattedEntries);
            
            // Update cache and state
            setCachedPages(prev => ({
              ...prev,
              [pagination.currentPage]: formattedEntries
            }));
            
            setEntries(formattedEntries);
          } catch (error) {
            console.error(`[useStakingData] Error fetching testnet data:`, error);
            setError(error instanceof Error ? error : new Error("Failed to fetch staking data"));
            setEntries([]);
          }
        } else {
          // Legacy mainnet builders project query (for non-BuildersV4 networks)
          console.log(`[useStakingData] Using legacy query for projectId: ${projectIdToUse}`);
          console.log(`[useStakingData] Pagination state for query: page=${pagination.currentPage}, pageSize=${pagination.pageSize}, skip=${skip}`);

          // Function to format and filter entries
          const formatAndFilterEntries = (users: (BuilderSubnetUser | BuildersUser | SubnetUser)[], source: string) => {
            console.log(`[useStakingData] ${source}: Processing ${users.length} raw entries`);
            
            // First filter out zero staked entries
            const nonZeroUsers = users.filter(user => {
              const isZeroStaked = user.staked === "0";
              if (isZeroStaked) {
                console.log(`[useStakingData] ${source}: Filtering out zero-staked address ${user.address}`);
              }
              return !isZeroStaked;
            });
            
            console.log(`[useStakingData] ${source}: ${users.length - nonZeroUsers.length} zero-staked entries filtered out, ${nonZeroUsers.length} remaining`);
            
            // Then format the remaining entries
            const formatted = nonZeroUsers.map(user => {
              if (formatEntryFunc) {
                return formatEntryFunc(user);
              }
              
              // Default formatter
              return {
                address: user.address,
                displayAddress: formatAddress(user.address),
                amount: parseFloat(user.staked || '0') / 10**18,
                // Handle lastStake based on user type
                timestamp: 'lastStake' in user ? parseInt(user.lastStake || '0') : 0,
              };
            });
            
            // Additional check for any zero amounts after formatting
            const finalFiltered = formatted.filter(entry => {
              const isZeroAmount = entry.amount === 0;
              if (isZeroAmount) {
                console.log(`[useStakingData] ${source}: Found zero amount after formatting for address ${entry.address}`);
              }
              return !isZeroAmount;
            });
            
            console.log(`[useStakingData] ${source}: Final formatted entries: ${finalFiltered.length}`);
            return finalFiltered;
          };

          // Function to fetch a specific page of data for mainnet
          const fetchMainnetPageData = async (pageNumber: number, pageSize: number) => {
            const skip = (pageNumber - 1) * pageSize;
            
            const response = await fetchGraphQL<BuildersGraphQLResponse>(
              endpoint,
              queryFunction || "getBuildersProjectUsers",
              queryDocument || GET_BUILDERS_PROJECT_USERS,
              {
                first: pageSize,
                skip,
                buildersProjectId: projectIdToUse,
                orderBy: 'staked',
                orderDirection: 'desc'
              }
            );
            
            if (!response.data?.buildersUsers) {
              throw new Error("No data returned from API");
            }
            
            console.log('[useStakingData] Mainnet raw response with ordered data:', response.data.buildersUsers);
            return response.data.buildersUsers.items || [];
          };

          // Function to fetch a specific page of data for testnet
          const fetchTestnetPageData = async (pageNumber: number, pageSize: number) => {
            const skip = (pageNumber - 1) * pageSize;
            
            const response = await fetchGraphQL<BuilderSubnetResponse>(
              endpoint,
              queryFunction || "getBuilderSubnetUsers",
              queryDocument || GET_BUILDER_SUBNET_USERS,
              {
                first: pageSize,
                skip,
                builderSubnetId: projectIdToUse,
                orderBy: 'staked',
                orderDirection: 'desc'
              }
            );
            
            if (!response.data?.builderUsers) {
              throw new Error("No data returned from API");
            }
            
            console.log('[useStakingData] Testnet raw response with ordered data:', response.data.builderUsers);
            return response.data.builderUsers;
          };

          // Mainnet or testnet query with prefetching
          try {
            console.log(`[useStakingData] Starting ${isTestnet ? 'testnet' : 'mainnet'} fetch for page ${pagination.currentPage}`);
            
            // Fetch current page and next page in parallel
            const fetchFunc = isTestnet ? fetchTestnetPageData : fetchMainnetPageData;
            const [currentPageUsers, nextPageUsers] = await Promise.all([
              fetchFunc(pagination.currentPage, pagination.pageSize),
              pagination.currentPage === 1 ? fetchFunc(2, pagination.pageSize) : Promise.resolve([])
            ]);
            
            // Process current page
            const currentPageEntries = formatAndFilterEntries(currentPageUsers, 'Current Page');
            
            // Update current page in cache and state
            setCachedPages(prev => ({
              ...prev,
              [pagination.currentPage]: currentPageEntries
            }));
            setEntries(currentPageEntries);
            
            // If we're on page 1, process and cache next page
            if (pagination.currentPage === 1 && nextPageUsers.length > 0) {
              const nextPageEntries = formatAndFilterEntries(nextPageUsers, 'Next Page');
              
              // Cache next page
              setCachedPages(prev => ({
                ...prev,
                2: nextPageEntries
              }));
              
              // Update pagination if we have more data
              if (nextPageEntries.length > 0) {
                setPagination(prev => ({
                  ...prev,
                  totalPages: Math.max(prev.totalPages, 2)
                }));
              }
              
              console.log(`[useStakingData] Prefetched and cached page 2 with ${nextPageEntries.length} entries`);
            }
            
          } catch (error) {
            console.error(`[useStakingData] Error fetching ${isTestnet ? 'testnet' : 'mainnet'} data:`, error);
            setError(error instanceof Error ? error : new Error("Failed to fetch staking data"));
            setEntries([]);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching staking data:", error);
      setError(error instanceof Error ? error : new Error("Failed to fetch staking data"));
      setEntries([]); // Clear entries on error
    } finally {
      setIsLoading(false); // Always set loading to false, even on error
    }
  }, [
    id,
    projectName,
    pagination.currentPage,
    pagination.pageSize,
    network,
    queryDocument,
    queryFunction,
    queryEndpoint,
    formatEntryFunc,
    formatAddress,
    isComputeProject,
    isTestnet,
    fetchProjectIdByName,
    isV4Project
  ]);

  // Define the refresh function to explicitly trigger data fetching
  const refresh = useCallback(() => {
    console.log('[useStakingData] refresh CALLED. Current isLoading state:', isLoading, 'Clearing cache and calling fetchData unconditionally.');
    setCachedPages({});
    // isLoading check removed: A manual refresh should always attempt to fetch.
    // This also helps break potential loops if isLoading got stuck as true.
    fetchData(); 
  }, [fetchData]); // Removed isLoading from deps as it's no longer used in condition

  // useEffect to fetch data when the internal ID or critical pagination/sorting changes.
  // This replaces the old initial data fetching and the pagination/sorting effect.
  useEffect(() => {
    console.log('[useStakingData] Effect to run fetchData. Current internal id:', id, 'currentPage:', pagination.currentPage, 'sortingCol:', sorting.column);
    // Only fetch if we have an ID to fetch for.
    if (id) {
      console.log('[useStakingData] Condition (id is truthy) MET for calling fetchData. ID:', id);
      fetchData();
    } else {
      console.log('[useStakingData] Condition (id is truthy) NOT MET for calling fetchData. ID:', id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, pagination.currentPage, pagination.pageSize, sorting.column, sorting.direction]); // REMOVED fetchData from deps

  // useEffect to handle changes in the projectId prop from the parent component.
  useEffect(() => {
    console.log('[useStakingData] projectIdEffect triggered. Raw projectId prop value:', projectId, 'Current internal id state:', id, 'Is prop undefined?:', projectId === undefined);
    if (projectId !== undefined && projectId !== id) {
      console.log('[useStakingData] projectId prop is DEFINED (', projectId, ') and DIFFERENT from internal id (', id, '). Updating internal id and resetting.');
      // Set the internal ID, clear caches, and reset pagination.
      // The actual fetchData call will be triggered by the useEffect above, which depends on `id`.
      setId(projectId);
      setCachedPages({});
      setPagination(prev => ({ 
        ...prev, 
        currentPage: 1, 
        totalItems: 0, 
        totalPages: 1  
      }));
      setError(null);
      setIsLoading(true); // Set loading true, fetchData will manage it further
    } else if (projectId === undefined && id !== null) {
      console.log('[useStakingData] projectId prop became UNDEFINED. Clearing data. Previous internal id:', id);
      setId(null);
      setEntries([]); 
      setCachedPages({});
      setPagination(prev => ({ 
        ...prev, 
        currentPage: 1, 
        totalItems: 0, 
        totalPages: 1 
      }));
      setError(null);
      setIsLoading(false); 
    } else {
      console.log('[useStakingData] projectIdEffect: projectId prop (', projectId, ') is either undefined or already matches internal id (', id, '). No primary state update in this effect.');
    }
  }, [projectId]); // Only depends on projectId prop to react to its changes

  // Sorting handler
  const setSort = useCallback((column: string) => {
    setSorting(prev => {
      const direction = prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc';
      return { column, direction };
    });
  }, []);

  // Pagination handlers
  const nextPage = useCallback(() => {
    // First check if we're already at the last page with data
    if (pagination.currentPage === pagination.totalPages) {
      console.log('[useStakingData] Already at last page, not navigating forward');
      return;
    }
    
    // If we have empty entries on the current page and trying to go forward, don't proceed
    if (entries.length === 0 && pagination.currentPage > 1) {
      console.log('[useStakingData] Current page is empty, not navigating forward');
      return;
    }
    
    console.log(`[useStakingData] Moving to next page: ${pagination.currentPage + 1}`);
    setPagination(prev => ({
      ...prev,
      currentPage: Math.min(prev.currentPage + 1, prev.totalPages)
    }));
  }, [pagination.currentPage, pagination.totalPages, entries.length]);

  const prevPage = useCallback(() => {
    if (pagination.currentPage <= 1) {
      console.log('[useStakingData] Already at first page, not navigating backward');
      return;
    }
    
    console.log(`[useStakingData] Moving to previous page: ${pagination.currentPage - 1}`);
    setPagination(prev => ({
      ...prev,
      currentPage: Math.max(prev.currentPage - 1, 1)
    }));
  }, [pagination.currentPage]);

  // Sort entries in memory if needed
  const sortedEntries = useMemo(() => {
    if (!sorting.column) return entries;
    
    return [...entries].sort((a, b) => {
      const factor = sorting.direction === 'asc' ? 1 : -1;
      const colA = a[sorting.column as keyof typeof a];
      const colB = b[sorting.column as keyof typeof b];
      
      if (typeof colA === 'string' && typeof colB === 'string') {
        return colA.localeCompare(colB) * factor;
      }
      
      if (colA === undefined || colB === undefined) {
        return 0;
      }
      
      return ((colA as number) - (colB as number)) * factor;
    });
  }, [entries, sorting]);

  console.log('[useStakingData] Returning state:', { isLoading, error: error?.message, entriesLength: entries.length, currentPage: pagination.currentPage, totalPages: pagination.totalPages, id });
  return {
    entries: sortedEntries,
    isLoading,
    error,
    pagination: {
      currentPage: pagination.currentPage,
      totalPages: pagination.totalPages,
      nextPage,
      prevPage
    },
    sorting: {
      column: sorting.column,
      direction: sorting.direction,
      setSort
    },
    refresh
  };
} 