import { useState, useCallback, useMemo, useEffect } from "react";
import { GRAPHQL_ENDPOINTS, fetchGraphQL } from "@/app/graphql/client";
import { BuildersGraphQLResponse, ComputeGraphQLResponse, StakingEntry } from "@/app/graphql/types";

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
}: UseStakingDataProps) {
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
      const endpoint = GRAPHQL_ENDPOINTS[network as keyof typeof GRAPHQL_ENDPOINTS] || GRAPHQL_ENDPOINTS.Base;
      
      if (isComputeProject) {
        // Logic for compute project
        // Not implemented since we're using the existing subnet.id
        return null;
      } else {
        // Logic for builders project
        const response = await fetchGraphQL<BuildersGraphQLResponse>(
          endpoint,
          "getBuildersProjectsByName",
          queryDocument || '', // Use provided query or fallback
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
  }, [network, queryDocument, isComputeProject]);

  // Fetch data
  const fetchData = useCallback(async () => {
    // Don't set loading state multiple times if we're already loading
    if (isLoading) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null); // Clear any previous errors when starting a new fetch
      
      // For compute projects, we need a projectId
      if (isComputeProject && !id) {
        setIsLoading(false); // End loading if no ID for compute project
        return;
      }

      // For builder projects, we need either projectId or projectName
      if (!isComputeProject && !id && !projectName) {
        setIsLoading(false); // End loading if no parameters for builder project
        return;
      }
      
      // Check cache first
      if (cachedPages[pagination.currentPage]?.length > 0) {
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
      const endpoint = queryEndpoint || 
        GRAPHQL_ENDPOINTS[network as keyof typeof GRAPHQL_ENDPOINTS] || 
        GRAPHQL_ENDPOINTS.Base;
      
      // Make the actual data query
      if (isComputeProject) {
        const response = await fetchGraphQL<ComputeGraphQLResponse>(
          endpoint,
          queryFunction || "GetProviders",
          queryDocument || '',
          {
            subnetId: projectIdToUse,
            skip,
            first: pagination.pageSize
          }
        );
        
        if (!response.data) {
          throw new Error("No data returned from API");
        }
        
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
        const formattedEntries = response.data.subnetUsers?.map(user => {
          if (formatEntryFunc) {
            return formatEntryFunc(user);
          }
          
          // Default formatter
          return {
            address: user.address,
            displayAddress: formatAddress(user.address),
            amount: parseFloat(user.staked) / 10**18,
            claimed: parseFloat(user.claimed) / 10**18,
          };
        }) || [];
        
        // Only update cache and state if we have data and we're still on the same page
        setCachedPages(prev => ({
          ...prev,
          [pagination.currentPage]: formattedEntries
        }));
        
        setEntries(formattedEntries);
      } else {
        // Builders project query
        const response = await fetchGraphQL<BuildersGraphQLResponse>(
          endpoint,
          queryFunction || "getBuildersProjectUsers",
          queryDocument || '',
          {
            first: pagination.pageSize,
            skip,
            buildersProjectId: projectIdToUse,
            orderBy: 'staked',
            orderDirection: 'desc'
          }
        );
        
        if (!response.data || !response.data.buildersUsers) {
          throw new Error("No data returned from API");
        }
        
        // Format the data using provided formatter or default
        const formattedEntries = response.data.buildersUsers.map(user => {
          if (formatEntryFunc) {
            return formatEntryFunc(user);
          }
          
          // Default formatter - this would need more info like withdrawLockPeriod
          return {
            address: user.address,
            displayAddress: formatAddress(user.address),
            amount: parseInt(user.staked) / 10**18,
            timestamp: parseInt(user.lastStake),
          };
        });
        
        // Cache and set entries
        setCachedPages(prev => ({
          ...prev,
          [pagination.currentPage]: formattedEntries
        }));
        
        setEntries(formattedEntries);
      }
        
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching staking data:", error);
      setError(error instanceof Error ? error : new Error("Failed to fetch staking data"));
      setIsLoading(false);
      // Don't clear entries if we fail, keep the previous entries to prevent layout flickering
    }
  }, [
    id, 
    projectName, 
    isLoading, 
    pagination,
    cachedPages,
    network,
    fetchProjectIdByName,
    queryEndpoint,
    queryFunction,
    queryDocument,
    isComputeProject,
    formatEntryFunc,
    formatAddress
  ]);

  // Handle page changes
  const setPage = useCallback((page: number) => {
    setPagination(prev => ({
      ...prev,
      currentPage: Math.max(1, Math.min(page, prev.totalPages))
    }));
  }, []);

  // Handle next/previous pages
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

  // Handle sorting
  const setSort = useCallback((column: string) => {
    setSorting(prev => {
      if (prev.column === column) {
        // Toggle direction
        return { 
          column, 
          direction: prev.direction === 'asc' ? 'desc' : 'asc' 
        };
      }
      
      // New column
      return { column, direction: 'asc' };
    });
    
    // Clear cached pages when sort changes
    setCachedPages({});
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

  // Fetch data on mount and when dependencies change
  useEffect(() => {
    fetchData();
  }, [fetchData, pagination.currentPage]);

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
      ...pagination,
      setPage,
      nextPage,
      prevPage
    },
    sorting: {
      ...sorting,
      setSort
    },
    refresh: fetchData
  };
} 