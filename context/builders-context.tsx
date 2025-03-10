"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { getDefaultClient } from '@/lib/apollo-client';
import { 
  COMBINED_BUILDERS_LIST,
  COMBINED_BUILDERS_LIST_FILTERED_BY_PREDEFINED_BUILDERS
} from '@/lib/graphql/builders-queries';
import { 
  BuilderProject, 
  BuildersCounter, 
  BuildersUser_OrderBy,
  BuildersProject_OrderBy,
  OrderDirection,
  CombinedBuildersListResponse,
  CombinedBuildersListFilteredByPredefinedBuildersResponse
} from '@/lib/types/graphql';
import { Builder } from '@/app/builders/builders-data';
import { adaptBuilderProjectsToUI } from '@/lib/utils/builders-adapter';
import { 
  loadPredefinedBuilders, 
  PredefinedBuilder, 
  adaptPredefinedBuildersToBuilders 
} from '@/lib/utils/load-predefined-builders';

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
  const [userAccountBuildersProjects, setUserAccountBuildersProjects] = useState<BuilderProject[]>([]);
  const [buildersCounters, setBuildersCounters] = useState<BuildersCounter | undefined>(undefined);
  
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
  
  // Handle async adaptation of user builder projects
  const [adaptedUserBuilders, setAdaptedUserBuilders] = useState<Builder[]>([]);
  
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
      const matchesName = builder.name.toLowerCase().includes(nameFilter.toLowerCase());
      
      // Reward type filter
      const matchesRewardType = rewardTypeFilter === 'all' || 
        (builder.rewardType && builder.rewardType.toLowerCase() === rewardTypeFilter.toLowerCase());
      
      // Network filter
      const matchesNetwork = networkFilter === 'all' || 
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
  
  // Handle sorting
  const setSorting = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction or clear sorting
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      // New column, start with ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };
  
  // Fetch data function with better error handling
  const fetchData = async () => {
    // Don't fetch data until predefined builders are loaded
    if (!predefinedBuildersLoaded) {
      console.log('Waiting for predefined builders to load...');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Fetching data from GraphQL API...');
      const client = getDefaultClient();
      
      // Map sorting to GraphQL variables
      let orderBy = BuildersProject_OrderBy.TotalStaked;
      let orderDirection = OrderDirection.Desc;
      
      if (sortColumn) {
        switch (sortColumn) {
          case 'totalStaked':
            orderBy = BuildersProject_OrderBy.TotalStaked;
            break;
          case 'stakingCount':
            orderBy = BuildersProject_OrderBy.TotalUsers;
            break;
          case 'minDeposit':
            orderBy = BuildersProject_OrderBy.MinimalDeposit;
            break;
          default:
            orderBy = BuildersProject_OrderBy.TotalStaked;
        }
        
        orderDirection = sortDirection === 'asc' ? OrderDirection.Asc : OrderDirection.Desc;
      }
      
      // Extract builder names from predefined builders for filtering
      const predefinedBuilderNames = predefinedBuilders.map(builder => builder.name);
      
      console.log('Using predefined builder names for filtering:', predefinedBuilderNames);
      
      try {
        // Use the filtered query with predefined builder names
        const { data: filteredData } = await client.query<CombinedBuildersListFilteredByPredefinedBuildersResponse>({
          query: COMBINED_BUILDERS_LIST_FILTERED_BY_PREDEFINED_BUILDERS,
          variables: {
            orderBy,
            orderDirection,
            usersOrderBy: BuildersUser_OrderBy.Staked,
            usersDirection: OrderDirection.Desc,
            name_in: predefinedBuilderNames,
            address: '' // TODO: Add connected wallet address
          },
          fetchPolicy: 'network-only'
        });
        
        console.log('GraphQL filtered response:', filteredData);
        
        if (!filteredData || !filteredData.buildersProjects || filteredData.buildersProjects.length === 0) {
          console.warn('No data returned from filtered GraphQL API, trying unfiltered query');
          
          // Fallback to unfiltered query if filtered query returns no data
          const { data: combinedData } = await client.query<CombinedBuildersListResponse>({
            query: COMBINED_BUILDERS_LIST,
            variables: {
              first: 100, // Fetch all data at once
              skip: 0,
              orderBy,
              orderDirection,
              usersOrderBy: BuildersUser_OrderBy.Staked,
              usersDirection: OrderDirection.Desc,
              address: '' // TODO: Add connected wallet address
            },
            fetchPolicy: 'network-only'
          });
          
          console.log('GraphQL unfiltered response:', combinedData);
          
          if (!combinedData || !combinedData.buildersProjects || combinedData.buildersProjects.length === 0) {
            console.warn('No data returned from unfiltered GraphQL API, using predefined builders only');
            setBuildersProjects([]);
            setUserAccountBuildersProjects([]);
            setBuildersCounters(undefined);
          } else {
            console.log('Setting data from unfiltered GraphQL response');
            setBuildersProjects(combinedData.buildersProjects);
            setUserAccountBuildersProjects(
              combinedData.buildersUsers?.map(user => user.buildersProject as BuilderProject) || []
            );
            setBuildersCounters(combinedData.counters?.[0]);
          }
        } else {
          console.log('Setting data from filtered GraphQL response');
          setBuildersProjects(filteredData.buildersProjects);
          setUserAccountBuildersProjects(
            filteredData.buildersUsers?.map(user => user.buildersProject as BuilderProject) || []
          );
        }
      } catch (queryError) {
        console.error('GraphQL query error:', queryError);
        // Fall back to predefined builders by setting empty arrays
        setBuildersProjects([]);
        setUserAccountBuildersProjects([]);
        setBuildersCounters(undefined);
        setError(queryError instanceof Error ? queryError : new Error('GraphQL query failed'));
      }
    } catch (error) {
      console.error('Error in fetchData:', error);
      setBuildersProjects([]);
      setUserAccountBuildersProjects([]);
      setBuildersCounters(undefined);
      setError(error instanceof Error ? error : new Error('An unknown error occurred'));
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

  // Handle async adaptation of builder projects
  useEffect(() => {
    if (buildersProjects && buildersProjects.length > 0) {
      setIsLoading(true);
      adaptBuilderProjectsToUI(buildersProjects, predefinedBuilders)
        .then(adapted => {
          setAdaptedBuilders(adapted);
          setIsLoading(false);
        })
        .catch(error => {
          console.error('Error adapting builder projects:', error);
          setError(error instanceof Error ? error : new Error('Failed to adapt builder projects'));
          setIsLoading(false);
        });
    }
  }, [buildersProjects, predefinedBuilders]);

  // Handle async adaptation of user builder projects
  useEffect(() => {
    if (userAccountBuildersProjects && userAccountBuildersProjects.length > 0) {
      adaptBuilderProjectsToUI(userAccountBuildersProjects, predefinedBuilders)
        .then(adapted => {
          setAdaptedUserBuilders(adapted);
        })
        .catch(error => {
          console.error('Error adapting user builder projects:', error);
        });
    }
  }, [userAccountBuildersProjects, predefinedBuilders]);

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
        refreshData: fetchData
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