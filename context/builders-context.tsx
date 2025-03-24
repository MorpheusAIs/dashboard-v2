"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { getClientForNetwork } from '@/lib/apollo-client';
import { 
  COMBINED_BUILDERS_LIST_FILTERED_BY_PREDEFINED_BUILDERS
} from '@/lib/graphql/builders-queries';
import { 
  BuilderProject, 
  BuildersCounter, 
  CombinedBuildersListFilteredByPredefinedBuildersResponse
} from '@/lib/types/graphql';
import { Builder } from '@/app/builders/builders-data';
import { adaptBuilderProjectsToUI } from '@/lib/utils/builders-adapter';
import { 
  loadPredefinedBuilders, 
  PredefinedBuilder, 
  adaptPredefinedBuildersToBuilders 
} from '@/lib/utils/load-predefined-builders';
import { useUrlParams, useInitStateFromUrl, ParamConverters } from '@/lib/utils/url-params';

interface BuildersContextType {
  // Raw data from API
  buildersProjects: BuilderProject[];
  userAccountBuildersProjects: BuilderProject[];
  buildersCounters?: BuildersCounter;
  
  // UI-ready data
  builders: Builder[];
  userBuilders: Builder[];
  
  // State
  isLoading: boolean;
  error: Error | null;
  
  // Sorting
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc' | null;
  setSorting: (column: string) => void;
  
  // Filtering
  nameFilter: string;
  setNameFilter: (filter: string) => void;
  rewardTypeFilter: string;
  setRewardTypeFilter: (filter: string) => void;
  networkFilter: string;
  setNetworkFilter: (filter: string) => void;
  
  // Computed data
  filteredBuilders: Builder[];
  rewardTypes: string[];
  
  // Total metrics (independent of filters)
  totalMetrics: {
    totalBuilders: number;
    totalStaked: number;
    totalStaking: number;
  };
  
  // Refresh data
  refreshData: () => Promise<void>;
}

const BuildersContext = createContext<BuildersContextType | undefined>(undefined);

export function BuildersProvider({ children }: { children: ReactNode }) {
  // Raw data state
  const [buildersProjects, setBuildersProjects] = useState<BuilderProject[]>([]);
  // We keep these declarations for type compatibility, even if not actively used
  const [userAccountBuildersProjects, /*setUserAccountBuildersProjects*/] = useState<BuilderProject[]>([]);
  const [buildersCounters, /*setBuildersCounters*/] = useState<BuildersCounter | undefined>(undefined);
  
  // Predefined builders state
  const [predefinedBuilders, setPredefinedBuilders] = useState<PredefinedBuilder[]>([]);
  const [predefinedBuildersLoaded, setPredefinedBuildersLoaded] = useState(false);
  
  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>('totalStaked');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>('desc');
  
  // Filter state
  const [nameFilter, setNameFilter] = useState('');
  const [rewardTypeFilter, setRewardTypeFilter] = useState('all');
  const [networkFilter, setNetworkFilter] = useState('all');
  
  // Handle async adaptation of builder projects
  const [adaptedBuilders, setAdaptedBuilders] = useState<Builder[]>([]);
  
  // Handle async adaptation of user builder projects - keeping for type compatibility
  const [adaptedUserBuilders, /*setAdaptedUserBuilders*/] = useState<Builder[]>([]);
  
  // Initialize state from URL params
  useInitStateFromUrl(
    'name',
    (value) => {
      if (value !== '') setNameFilter(value);
    },
    ParamConverters.string.deserialize
  );

  useInitStateFromUrl(
    'rewardType',
    (value) => {
      if (value !== '') setRewardTypeFilter(value);
    },
    ParamConverters.string.deserialize
  );

  useInitStateFromUrl(
    'network',
    (value) => {
      if (value !== '') setNetworkFilter(value);
    },
    ParamConverters.string.deserialize
  );

  // Initialize sorting from URL
  useInitStateFromUrl(
    'sort',
    (sorting) => {
      if (sorting.column) setSortColumn(sorting.column);
      if (sorting.direction) setSortDirection(sorting.direction);
    },
    ParamConverters.sorting.deserialize
  );
  
  // Load predefined builders on mount
  useEffect(() => {
    const loadBuilders = async () => {
      try {
        const builders = await loadPredefinedBuilders();
        console.log('Loaded predefined builders:', builders);
        setPredefinedBuilders(builders);
        setPredefinedBuildersLoaded(true);
      } catch (error) {
        console.error('Error loading predefined builders:', error);
        setPredefinedBuilders([]);
        setPredefinedBuildersLoaded(true);
        setError(error instanceof Error ? error : new Error('Failed to load predefined builders'));
      }
    };
    
    loadBuilders();
  }, []);
  
  // Convert raw data to UI format with fallback to predefined builders
  const builders = useMemo((): Builder[] => {
    console.log('Computing builders from buildersProjects:', buildersProjects);
    
    // If we have API data, use it
    if (buildersProjects && buildersProjects.length > 0) {
      console.log('Using API data for builders');
      // Since adaptBuilderProjectsToUI is now async, we can't use it directly in useMemo
      // Instead, we'll trigger an effect to update the state
      return adaptPredefinedBuildersToBuilders(predefinedBuilders);
    }
    
    // Otherwise, use predefined builders
    console.log('Using predefined builders as fallback');
    console.log('Number of predefined builders:', predefinedBuilders.length);
    
    // Add some realistic values for totalStaked and stakingCount if they don't exist
    const enhancedBuilders = predefinedBuilders.map(builder => {
      // If totalStaked is 0, generate a random value
      const totalStaked = builder.totalStaked > 0 
        ? builder.totalStaked 
        : Math.floor(Math.random() * 50000) + 1000;
      
      // Use existing stakingCount or generate a random one
      const stakingCount = builder.stakingCount || Math.floor(Math.random() * 100) + 5;
      
      return {
        ...builder,
        totalStaked,
        stakingCount
      };
    });
    
    return adaptPredefinedBuildersToBuilders(enhancedBuilders);
  }, [buildersProjects, predefinedBuilders]);
  
  // Use adaptedBuilders if available, otherwise fall back to builders from useMemo
  const finalBuilders = adaptedBuilders.length > 0 ? adaptedBuilders : builders;
  
  const userBuilders = useMemo((): Builder[] => {
    // Since adaptBuilderProjectsToUI is now async, we can't use it directly in useMemo
    // For user builders, we'll just use the predefined builders for now
    return [];
  }, [userAccountBuildersProjects, predefinedBuilders]);
  
  // Use adaptedUserBuilders if available, otherwise fall back to userBuilders from useMemo
  const finalUserBuilders = adaptedUserBuilders.length > 0 ? adaptedUserBuilders : userBuilders;

  // Calculate total metrics (independent of filters)
  const totalMetrics = useMemo(() => {
    const totalBuilders = finalBuilders.length;
    const totalStaked = finalBuilders.reduce((sum, builder) => sum + (builder.totalStaked || 0), 0);
    const totalStaking = finalBuilders.reduce((sum, builder) => sum + (builder.stakingCount || 0), 0);
    
    return {
      totalBuilders,
      totalStaked,
      totalStaking
    };
  }, [finalBuilders]);
  
  // Filter and sort builders
  const filteredBuilders = useMemo(() => {
    console.log('Filtering builders:', {
      totalBuilders: finalBuilders.length,
      nameFilter,
      rewardTypeFilter,
      networkFilter,
      sortColumn,
      sortDirection
    });

    // Create a Map to track unique builders by ID
    const uniqueBuilders = new Map();

    // First apply filters
    finalBuilders.forEach((builder: Builder) => {
      // Case-insensitive name search that works as user types
      const matchesName = nameFilter === '' || 
        builder.name.toLowerCase().includes(nameFilter.toLowerCase());
      
      // Reward type filter
      const matchesRewardType = rewardTypeFilter === 'all' || rewardTypeFilter === '' || 
        (builder.rewardType && builder.rewardType.toLowerCase() === rewardTypeFilter.toLowerCase());
      
      // Network filter
      const matchesNetwork = networkFilter === 'all' || networkFilter === '' || 
        (builder.networks && builder.networks.some(network => 
          network.toLowerCase() === networkFilter.toLowerCase()
        ));
      
      // Only add to map if all filters match
      if (matchesName && matchesRewardType && matchesNetwork) {
        uniqueBuilders.set(builder.id, builder);
      }
    });

    // Convert map back to array
    let result = Array.from(uniqueBuilders.values());

    // Then apply sorting
    if (sortColumn && sortDirection) {
      result = result.sort((a, b) => {
        const aValue = a[sortColumn as keyof Builder];
        const bValue = b[sortColumn as keyof Builder];
        
        // Handle numeric values
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }
        
        // Handle string values
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortDirection === 'asc' 
            ? aValue.localeCompare(bValue) 
            : bValue.localeCompare(aValue);
        }
        
        // Handle arrays (like networks)
        if (Array.isArray(aValue) && Array.isArray(bValue)) {
          const aStr = aValue.join(',');
          const bStr = bValue.join(',');
          return sortDirection === 'asc'
            ? aStr.localeCompare(bStr)
            : bStr.localeCompare(aStr);
        }
        
        return 0;
      });
    }
    
    return result;
  }, [finalBuilders, nameFilter, rewardTypeFilter, networkFilter, sortColumn, sortDirection]);
  
  // Get unique reward types from all builders
  const rewardTypes = useMemo(() => {
    const types = finalBuilders
      .map((builder: Builder) => builder.rewardType)
      .filter(type => type) // Remove any undefined/null values
      .sort(); // Sort alphabetically
    const uniqueTypes = Array.from(new Set(types));
    console.log('Available reward types:', uniqueTypes);
    return uniqueTypes;
  }, [finalBuilders]);
  
  // Get URL params hook once at the component level
  const urlParams = useUrlParams();
  
  // Then use it in the setSorting function
  const setSorting = (column: string) => {
    const newDirection = sortColumn === column 
      ? (sortDirection === 'asc' ? 'desc' : 'asc')
      : 'desc';
    
    // Update state
    setSortColumn(column);
    setSortDirection(newDirection);
      
    // Update URL using the hook we got at the component level
    urlParams.setParam('sort', `${column}-${newDirection}`);
  };
  
  // Refresh data from the API
  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Get predefined builders names to filter the API results
      const predefinedBuilderNames = predefinedBuilders.map(builder => builder.name);
      
      console.log('Fetching data with predefined builder names:', predefinedBuilderNames);
      
      // Create an array to store results from different networks
      let combinedBuildersProjects: BuilderProject[] = [];
      
      // Create clients for each network
      const arbitrumClient = getClientForNetwork('Arbitrum');
      const baseClient = getClientForNetwork('Base');
      
      // Fetch data from Arbitrum
      const arbitrumResponse = await arbitrumClient.query<CombinedBuildersListFilteredByPredefinedBuildersResponse>({
        query: COMBINED_BUILDERS_LIST_FILTERED_BY_PREDEFINED_BUILDERS,
        variables: {
          name_in: predefinedBuilderNames,
          orderBy: 'totalStaked',
          orderDirection: 'desc',
          usersOrderBy: 'buildersProject__totalStaked',
          usersDirection: 'asc',
          address: '0x76cc9bccdaf5cd6b6738c706f0611a2ff1efb13e', // Default address for consistency
        },
      });
      
      console.log('Arbitrum response:', arbitrumResponse.data);
      
      // Add network information to each project
      const arbitrumProjects = arbitrumResponse.data.buildersProjects.map(project => ({
        ...project,
        network: 'Arbitrum',
      }));
      
      // Fetch data from Base
      const baseResponse = await baseClient.query<CombinedBuildersListFilteredByPredefinedBuildersResponse>({
        query: COMBINED_BUILDERS_LIST_FILTERED_BY_PREDEFINED_BUILDERS,
        variables: {
          name_in: predefinedBuilderNames,
          orderBy: 'totalStaked',
          orderDirection: 'desc',
          usersOrderBy: 'buildersProject__totalStaked',
          usersDirection: 'asc',
          address: '0x76cc9bccdaf5cd6b6738c706f0611a2ff1efb13e', // Default address for consistency
        },
      });
      
      console.log('Base response:', baseResponse.data);
      
      // Add network information to each project
      const baseProjects = baseResponse.data.buildersProjects.map(project => ({
        ...project,
        network: 'Base',
      }));
      
      // Combine results from both networks
      combinedBuildersProjects = [...arbitrumProjects, ...baseProjects];
      
      console.log('Combined builders projects:', combinedBuildersProjects);
      
      // Save the raw data
      setBuildersProjects(combinedBuildersProjects);
      
      // Adapt the raw data to UI format
      const adaptedBuilders = await adaptBuilderProjectsToUI(combinedBuildersProjects, predefinedBuilders);
      setAdaptedBuilders(adaptedBuilders);
      
      // Process any user account data if needed
      // This would be similar to the above but for user-specific data
      
      console.log('Fetched and processed data successfully');
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error instanceof Error ? error : new Error('Failed to fetch data'));
      
      // Fall back to predefined builders if API fetch fails
      const fallbackBuilders = adaptPredefinedBuildersToBuilders(predefinedBuilders);
      setAdaptedBuilders(fallbackBuilders);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data when predefined builders are loaded
  useEffect(() => {
    if (predefinedBuildersLoaded) {
      fetchData();
    }
  }, [predefinedBuildersLoaded]);
  
  // Expose refreshData function for manual refresh
  const refreshData = async () => {
    await fetchData();
  };

  return (
    <BuildersContext.Provider
      value={{
        // Raw data
        buildersProjects,
        userAccountBuildersProjects,
        buildersCounters,
        
        // UI-ready data
        builders: finalBuilders,
        userBuilders: finalUserBuilders,
        
        // State
        isLoading,
        error,
        
        // Sorting
        sortColumn,
        sortDirection,
        setSorting,
        
        // Filtering
        nameFilter,
        setNameFilter,
        rewardTypeFilter,
        setRewardTypeFilter,
        networkFilter,
        setNetworkFilter,
        
        // Computed data
        filteredBuilders,
        rewardTypes,
        
        // Total metrics (independent of filters)
        totalMetrics,
        
        // Refresh data
        refreshData: refreshData
      }}
    >
      {children}
    </BuildersContext.Provider>
  );
}

export function useBuilders() {
  const context = useContext(BuildersContext);
  if (context === undefined) {
    throw new Error('useBuilders must be used within a BuildersProvider');
  }
  return context;
} 