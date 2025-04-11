import { useState, useCallback, useMemo, useEffect } from "react";
import { fetchGraphQL, getEndpointForNetwork } from "@/app/graphql/client";
import { BuildersGraphQLResponse, ComputeGraphQLResponse, StakingEntry } from "@/app/graphql/types";
import { GET_BUILDERS_PROJECT_BY_NAME, GET_BUILDERS_PROJECT_USERS, GET_BUILDER_SUBNET_BY_NAME, GET_BUILDER_SUBNET_USERS } from "@/app/graphql/queries/builders";
import { GET_SUBNET_USERS } from "@/app/graphql/queries/compute";
import { useChainId } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';

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
  formatEntryFunc?: (entry: any) => StakingEntry;
  queryEndpoint?: string;
  queryFunction?: string;
  queryDocument?: string;
  isComputeProject?: boolean;
  isTestnet?: boolean;
}

// Define types for testnet responses
interface BuilderSubnetUser {
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

interface BuilderSubnetResponse {
  builderSubnets?: BuilderSubnet[];
  builderUsers?: BuilderSubnetUser[];
}

export function useStakingData({
  projectId,
  projectName,
  network = 'Base',
  initialPageSize = 5,
  initialSort = { column: 'amount', direction: 'desc' },
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
  const isTestnet = providedIsTestnet !== undefined ? providedIsTestnet : chainId === arbitrumSepolia.id;
  
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
        
        if (!response.data?.builderSubnets?.length) {
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
        
        if (!response.data?.buildersProjects?.length) {
          return null;
        }
        
        const project = response.data.buildersProjects[0];
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
    // We should set loading to true on initial load, even if we're already loading
    // This fixes the issue where tables are stuck in loading state
    setIsLoading(true);
    
    try {
      setError(null); // Clear any previous errors when starting a new fetch
      
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
        console.log('Using cached data for page', pagination.currentPage);
        setEntries(cachedPages[pagination.currentPage]);
        setIsLoading(false);
        return;
      }
      
      // Get project ID 
      let projectIdToUse = id;
      
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
        throw new Error("No project ID available for fetching data");
      }
      
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
        
        console.log('Compute data received:', response);
        
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
        
        console.log('Formatted entries:', formattedEntries);
        
        // Only update cache and state if we have data and we're still on the same page
        setCachedPages(prev => ({
          ...prev,
          [pagination.currentPage]: formattedEntries
        }));
        
        setEntries(formattedEntries);
      } else if (isTestnet) {
        // Testnet builder subnet query
        const response = await fetchGraphQL<BuilderSubnetResponse>(
          endpoint,
          queryFunction || "getBuilderSubnetUsers",
          queryDocument || GET_BUILDER_SUBNET_USERS,
          {
            first: pagination.pageSize,
            skip,
            builderSubnetId: projectIdToUse
          }
        );
        
        if (!response.data) {
          throw new Error("No data returned from API");
        }
        
        console.log('[Testnet] Builder subnet users data received:', response);
        
        // Format the data using provided formatter or default
        const formattedEntries = (response.data.builderUsers || []).map((user: BuilderSubnetUser) => {
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
        
        console.log('[Testnet] Formatted entries:', formattedEntries);
        
        // Update cache and state
        setCachedPages(prev => ({
          ...prev,
          [pagination.currentPage]: formattedEntries
        }));
        
        setEntries(formattedEntries);
      } else {
        // Mainnet builders project query
        const response = await fetchGraphQL<BuildersGraphQLResponse>(
          endpoint,
          queryFunction || "getBuildersProjectUsers",
          queryDocument || GET_BUILDERS_PROJECT_USERS,
          {
            first: pagination.pageSize,
            skip,
            buildersProjectId: projectIdToUse,
            orderBy: 'staked',
            orderDirection: 'desc'
          }
        );
        
        if (!response.data) {
          throw new Error("No data returned from API");
        }
        
        console.log('Builders data received:', response);
        
        // Format the data using provided formatter or default
        const formattedEntries = (response.data.buildersUsers || []).map(user => {
          if (formatEntryFunc) {
            return formatEntryFunc(user);
          }
          
          // Default formatter - this would need more info like withdrawLockPeriod
          return {
            address: user.address,
            displayAddress: formatAddress(user.address),
            amount: parseFloat(user.staked || '0') / 10**18,
            timestamp: parseInt(user.lastStake || '0'),
          };
        });
        
        console.log('Formatted entries:', formattedEntries);
        
        // Update cache and state
        setCachedPages(prev => ({
          ...prev,
          [pagination.currentPage]: formattedEntries
        }));
        
        setEntries(formattedEntries);
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
    cachedPages
  ]);

  // Define the refresh function to explicitly trigger data fetching
  const refresh = useCallback(() => {
    // Clear cached pages when refreshing to ensure we get fresh data
    setCachedPages({});
    // Only fetch if we're not already loading
    if (!isLoading) {
      fetchData();
    }
  }, [fetchData, isLoading]);

  // Initial data fetching - only run once on mount
  useEffect(() => {
    fetchData();
  }, []); // Empty dependency array to run only once

  // Handle pagination and sorting changes
  useEffect(() => {
    // Don't fetch on initial mount since we already do that in the effect above
    const shouldFetch = id !== null || projectName !== undefined;
    if (shouldFetch) {
      fetchData();
    }
  }, [
    pagination.currentPage,
    pagination.pageSize,
    sorting.column,
    sorting.direction,
    fetchData
  ]);

  // Sorting handler
  const setSort = useCallback((column: string) => {
    setSorting(prev => {
      const direction = prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc';
      return { column, direction };
    });
  }, []);

  // Pagination handlers
  const nextPage = useCallback(() => {
    setPagination(prev => ({
      ...prev,
      currentPage: Math.min(prev.currentPage + 1, prev.totalPages)
    }));
  }, []);

  const prevPage = useCallback(() => {
    setPagination(prev => ({
      ...prev,
      currentPage: Math.max(prev.currentPage - 1, 1)
    }));
  }, []);

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

  // Update the useEffect to prevent unnecessary data clearing
  // Fix the issue with project ID changes
  useEffect(() => {
    // Only reset when ID changes AND we actually have a previous ID to avoid clearing on mount
    if (projectId && projectId !== id) {
      setId(projectId);
      setCachedPages({});
      setError(null);
      // Don't immediately clear entries to prevent layout flickering
      // Instead, we'll wait until new data is loaded
    }
  }, [projectId, id]);

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