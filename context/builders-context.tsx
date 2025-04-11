"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { getClientForNetwork } from '@/lib/apollo-client';
import { 
  COMBINED_BUILDERS_LIST_FILTERED_BY_PREDEFINED_BUILDERS,
  COMBINED_BUILDER_SUBNETS
} from '@/lib/graphql/builders-queries';
import { 
  BuilderProject, 
  BuildersCounter, 
  CombinedBuildersListFilteredByPredefinedBuildersResponse,
  OrderDirection
} from '@/lib/types/graphql';
import { Builder, mergeBuilderData } from '@/app/builders/builders-data';
import { useUrlParams, useInitStateFromUrl, ParamConverters } from '@/lib/utils/url-params';
import { arbitrumSepolia } from 'wagmi/chains';
import { useChainId } from 'wagmi';
import { BuilderDB } from '@/app/lib/supabase';
import { BuildersService } from '@/app/services/builders.service';

// Remove the NetworkEnvironment type and BuildersProviderProps interface
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
  
  // Supabase builders state
  const [supabaseBuilders, setSupabaseBuilders] = useState<BuilderDB[]>([]);
  const [supabaseBuildersLoaded, setSupabaseBuildersLoaded] = useState(false);
  
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
  
  // Get chain ID directly from wagmi
  const chainId = useChainId();
  
  // Determine if we're on Arbitrum Sepolia
  const isArbitrumSepolia = chainId === arbitrumSepolia.id;
  
  // If we're on Arbitrum Sepolia, we're in testnet mode
  const isTestnet = isArbitrumSepolia;
  
  // Log detected network information for debugging
  useEffect(() => {
    console.log('Network detection in BuildersProvider:', {
      chainId,
      isArbitrumSepolia,
      isTestnet,
      arbitrumSepoliaId: arbitrumSepolia.id
    });
  }, [chainId, isArbitrumSepolia, isTestnet]);
  
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
  
  // Load builders from Supabase on mount
  useEffect(() => {
    const loadBuilders = async () => {
      try {
        const builders = await BuildersService.getAllBuilders();
        console.log('Loaded builders from Supabase:', builders);
        setSupabaseBuilders(builders);
        setSupabaseBuildersLoaded(true);
      } catch (error) {
        console.error('Error loading builders from Supabase:', error);
        setSupabaseBuilders([]);
        setSupabaseBuildersLoaded(true);
        setError(error instanceof Error ? error : new Error('Failed to load builders from Supabase'));
      }
    };
    
    loadBuilders();
  }, []);
  
  // Set up real-time subscription for Supabase
  useEffect(() => {
    // Only set up the subscription if we've loaded the initial data
    if (!supabaseBuildersLoaded) return;
    
    const unsubscribe = BuildersService.subscribeToBuilders((updatedBuilders) => {
      console.log('Real-time builder update received:', updatedBuilders);
      setSupabaseBuilders(updatedBuilders);
    });
    
    // Clean up subscription when component unmounts
    return () => {
      unsubscribe();
    };
  }, [supabaseBuildersLoaded]);
  
  // Convert raw data to UI format, merging Supabase data with on-chain data
  const builders = useMemo((): Builder[] => {
    console.log('Computing builders from Supabase and on-chain data');
    
    // When in testnet mode, directly use the on-chain data without Supabase dependency
    if (isTestnet) {
      console.log('Testnet mode: Using on-chain data directly without Supabase merging');
      return buildersProjects.map(subnet => {
        // Use the formatted values that we prepared
        const totalStaked = subnet.totalStakedFormatted !== undefined 
          ? subnet.totalStakedFormatted 
          : Number(subnet.totalStaked || '0') / 1e18;
        
        // Ensure we have a valid number
        const safeTotal = isNaN(totalStaked) ? 0 : totalStaked;
        const safeStakingCount = subnet.stakingCount || 0;
        
        return {
          id: subnet.id,
          name: subnet.name,
          description: subnet.description || '',
          long_description: subnet.description || '',
          admin: subnet.admin,
          networks: subnet.networks || ['Arbitrum Sepolia'],
          network: subnet.network || 'Arbitrum Sepolia',
          totalStaked: safeTotal, // Use the safe value
          minDeposit: subnet.minDeposit || 0,
          lockPeriod: subnet.lockPeriod || '',
          stakingCount: safeStakingCount,
          website: subnet.website || '',
          // Use the direct image URL for testnet subnets if available
          image_src: subnet.image || '', 
          // For compatibility with components that might use 'image' directly
          image: subnet.image || '',
          tags: [],
          github_url: '',
          twitter_url: '',
          discord_url: '',
          telegram_url: '',
          contributors: 0,
          github_stars: 0,
          reward_types: [],
          reward_types_detail: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      });
    }
    
    // In mainnet mode, use the existing Supabase merging logic
    if (!supabaseBuildersLoaded) {
        return [];
    }
    
    // Convert Supabase builders to UI builders by merging with on-chain data
    return supabaseBuilders.map(builderDB => {
      // Find corresponding on-chain data if it exists
      const onChainBuilder = buildersProjects.find(
        bp => bp.name === builderDB.name
      );
      
      // Merge DB data with on-chain data (or default values)
      // Use formatted values if available, otherwise fall back to original parsing
      return mergeBuilderData(builderDB, {
        totalStaked: onChainBuilder?.totalStakedFormatted !== undefined
          ? onChainBuilder.totalStakedFormatted
          : parseFloat(onChainBuilder?.totalStaked || '0') || 0,
        minimalDeposit: parseFloat(onChainBuilder?.minimalDeposit || '0') / 1e18 || 0,
        withdrawLockPeriodAfterDeposit: parseFloat(onChainBuilder?.withdrawLockPeriodAfterDeposit || '0') || 0,
        stakingCount: onChainBuilder?.stakingCount || 0,
        lockPeriod: onChainBuilder?.lockPeriod || '',
        // Pass the network information from the on-chain data source
        network: onChainBuilder?.network || 'Unknown',
        networks: onChainBuilder?.networks || ['Unknown']
      });
    });
  }, [supabaseBuilders, supabaseBuildersLoaded, buildersProjects, isTestnet]);
  
  // Set adapted builders whenever the computed builders change
  useEffect(() => {
    setAdaptedBuilders(builders);
    setIsLoading(false);
  }, [builders]);

  // Update URL params when filters change
  const { setParam } = useUrlParams();
  
  useEffect(() => {
    if (nameFilter) {
      setParam('name', nameFilter);
    } else {
      setParam('name', null);
    }
  }, [nameFilter, setParam]);

  useEffect(() => {
    if (rewardTypeFilter && rewardTypeFilter !== 'all') {
      setParam('rewardType', rewardTypeFilter);
    } else {
      setParam('rewardType', null);
    }
  }, [rewardTypeFilter, setParam]);

  useEffect(() => {
    if (networkFilter && networkFilter !== 'all') {
      setParam('network', networkFilter);
    } else {
      setParam('network', null);
    }
  }, [networkFilter, setParam]);

  // Update URL when sorting changes
  useEffect(() => {
    if (sortColumn) {
      // Use the serializer to convert the sorting object to a string
      setParam('sort', ParamConverters.sorting.serialize({ column: sortColumn, direction: sortDirection }));
    } else {
      setParam('sort', null);
    }
  }, [sortColumn, sortDirection, setParam]);

  const setSorting = (column: string) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const fetchBuildersData = async () => {
    setIsLoading(true);
    setError(null);
    console.log('fetchBuildersData called. isTestnet:', isTestnet);
    
    try {
      let combinedProjects: BuilderProject[] = [];

      if (isTestnet) {
        // For testnet, fetch all subnets directly from Arbitrum Sepolia
        const networkString = 'ArbitrumSepolia';
        console.log(`Fetching all subnet data from ${networkString} network.`);
        const client = getClientForNetwork(networkString);
        if (!client) {
          throw new Error(`Could not get Apollo client for network: ${networkString}`);
        }
        
        // Use the COMBINED_BUILDER_SUBNETS query with its expected variable format
        const testnetVariables = {
          first: 100,
          skip: 0,
          orderBy: 'totalStaked',
          orderDirection: OrderDirection.Desc,
          usersOrderBy: 'builderSubnet__totalStaked',
          usersDirection: OrderDirection.Asc,
          builderSubnetName: "", // Empty string to get all subnets
          address: "" // Can be updated if we need to filter by user
        };
        
        console.log(`[Testnet Query] Variables for ${networkString}:`, testnetVariables);
        const response = await client.query({
          query: COMBINED_BUILDER_SUBNETS,
          variables: testnetVariables,
          fetchPolicy: 'no-cache',
        });
        
        // Map subnet data to project format
        combinedProjects = (response.data.builderSubnets || []).map((subnet: {
          id: string;
          name: string;
          owner: string;
          minStake: string;
          startsAt: string;
          totalClaimed: string;
          totalStaked: string;
          totalUsers: string;
          withdrawLockPeriodAfterStake: string;
          maxClaimLockEnd: string;
          description: string;
          website: string;
          image?: string;
          builderUsers?: { id: string; address: string; staked: string; claimed: string; }[];
        }) => {
          // Convert Wei to ETH (divide by 10^18) - ensure it's a valid number
          const totalStakedRaw = subnet.totalStaked || '0';
          const totalStakedInMor = Number(totalStakedRaw) / 1e18;
          const minStakeInEth = Number(subnet.minStake || '0') / 1e18;
          
          // Get the correct staking count - from builderUsers array length or totalUsers
          const stakingCount = subnet.builderUsers && subnet.builderUsers.length > 0 
            ? subnet.builderUsers.length 
            : parseInt(subnet.totalUsers || '0', 10);
          
          // Convert seconds to minutes for lock period and format
          const lockPeriodSeconds = parseInt(subnet.withdrawLockPeriodAfterStake || '0', 10);
          let lockPeriodFormatted = '';
          
          if (lockPeriodSeconds >= 86400) {
            // If >= 24 hours, show in days
            const days = Math.floor(lockPeriodSeconds / 86400);
            lockPeriodFormatted = `${days} day${days !== 1 ? 's' : ''}`;
          } else if (lockPeriodSeconds >= 3600) {
            // If >= 60 minutes, show in hours
            const hours = Math.floor(lockPeriodSeconds / 3600);
            lockPeriodFormatted = `${hours} hour${hours !== 1 ? 's' : ''}`;
          } else {
            // Show in minutes
            const minutes = Math.floor(lockPeriodSeconds / 60);
            lockPeriodFormatted = `${minutes} min`;
          }
          
          console.log('Subnet data processing:', {
            name: subnet.name,
            totalStakedRaw,
            totalStakedInMor,
            stakingCount,
            totalUsers: subnet.totalUsers,
            builderUsersLength: subnet.builderUsers?.length
          });
          
          return {
            id: subnet.id,
            name: subnet.name,
            admin: subnet.owner,
            minimalDeposit: subnet.minStake, // Keep original value for compatibility
            startsAt: subnet.startsAt,
            totalClaimed: subnet.totalClaimed,
            totalStaked: subnet.totalStaked, // Keep original value for compatibility
            totalUsers: subnet.totalUsers,
            withdrawLockPeriodAfterDeposit: subnet.withdrawLockPeriodAfterStake,
            claimLockEnd: subnet.maxClaimLockEnd,
            // Additional fields with proper formatting
            networks: ['Arbitrum Sepolia'],
            network: 'Arbitrum Sepolia',
            description: subnet.description,
            website: subnet.website,
            stakingCount: stakingCount, // Use calculated staking count
            lockPeriod: lockPeriodFormatted,
            minDeposit: minStakeInEth, // Use converted ETH value
            totalStakedFormatted: totalStakedInMor, // Store formatted value
            image: subnet.image
          };
        });
        console.log('Fetched from Arbitrum Sepolia:', combinedProjects.length, 'projects');
      } else {
        // For mainnet, use existing logic with Supabase filtering
        if (!supabaseBuildersLoaded || supabaseBuilders.length === 0) {
          console.log('fetchBuildersData: Aborting mainnet query, Supabase builders not ready.');
          setBuildersProjects([]); 
          setIsLoading(false);
          return;
        }
        
        // Extract names from Supabase builders
        const builderNames = supabaseBuilders.map(b => b.name);
        console.log(`fetchBuildersData: Using ${builderNames.length} builder names for filtering.`);
        
        // Use string values instead of enums to match the expected schema
        const commonVariables = {
          orderBy: "totalStaked", // String instead of enum
          orderDirection: "desc", // String instead of enum
          usersOrderBy: "buildersProject__totalStaked", // Correct field name
          usersDirection: "asc", // String instead of enum
          name_in: builderNames,
          address: "" // Include address parameter (empty for now)
        };

        // Fetch from both Base and Arbitrum mainnet
        const baseClient = getClientForNetwork('Base');
        const arbitrumClient = getClientForNetwork('Arbitrum');
        
        if (!baseClient || !arbitrumClient) {
          throw new Error(`Could not get Apollo clients for Base or Arbitrum`);
        }
        
        console.log('Fetching on-chain data from Base and Arbitrum mainnet.');
        
        console.log(`[Mainnet Query] Variables for Base:`, commonVariables);
        const [baseResponse, arbitrumResponse] = await Promise.all([
          baseClient.query<CombinedBuildersListFilteredByPredefinedBuildersResponse>({
            query: COMBINED_BUILDERS_LIST_FILTERED_BY_PREDEFINED_BUILDERS,
            variables: commonVariables,
            fetchPolicy: 'no-cache',
          }),
          (console.log(`[Mainnet Query] Variables for Arbitrum:`, commonVariables), 
          arbitrumClient.query<CombinedBuildersListFilteredByPredefinedBuildersResponse>({
            query: COMBINED_BUILDERS_LIST_FILTERED_BY_PREDEFINED_BUILDERS,
            variables: commonVariables,
            fetchPolicy: 'no-cache',
          }))
        ]);

        const baseProjects = (baseResponse.data?.buildersProjects || []).map(project => {
          // Convert Wei to ETH (divide by 10^18) - ensure it's a valid number
          const totalStakedInMor = Number(project.totalStaked || '0') / 1e18;
          const minDepositInMor = Number(project.minimalDeposit || '0') / 1e18;
          
          // Format lock period from seconds to minutes/hours/days
          const lockPeriodSeconds = parseInt(project.withdrawLockPeriodAfterDeposit || '0', 10);
          let lockPeriodFormatted = '';
          
          if (lockPeriodSeconds >= 86400) {
            // If >= 24 hours, show in days
            const days = Math.floor(lockPeriodSeconds / 86400);
            lockPeriodFormatted = `${Math.floor(days)} day${days !== 1 ? 's' : ''}`;
          } else if (lockPeriodSeconds >= 3600) {
            // If >= 60 minutes, show in hours
            const hours = Math.floor(lockPeriodSeconds / 3600);
            lockPeriodFormatted = `${Math.floor(hours)} hour${hours !== 1 ? 's' : ''}`;
          } else {
            // Show in minutes
            const minutes = Math.floor(lockPeriodSeconds / 60);
            lockPeriodFormatted = `${Math.floor(minutes)} min`;
          }
          
          return {
            ...project,
            networks: ['Base'],
            network: 'Base',
            stakingCount: parseInt(project.totalUsers || '0', 10),
            lockPeriod: lockPeriodFormatted,
            minDeposit: minDepositInMor,
            minimalDeposit: project.minimalDeposit,
            totalStakedFormatted: totalStakedInMor,
            withdrawLockPeriodFormatted: lockPeriodFormatted
          };
        });
        
        const arbitrumProjects = (arbitrumResponse.data?.buildersProjects || []).map(project => {
          // Convert Wei to ETH (divide by 10^18) - ensure it's a valid number
          const totalStakedInMor = Number(project.totalStaked || '0') / 1e18;
          const minDepositInMor = Number(project.minimalDeposit || '0') / 1e18;
          
          // Format lock period from seconds to minutes/hours/days
          const lockPeriodSeconds = parseInt(project.withdrawLockPeriodAfterDeposit || '0', 10);
          let lockPeriodFormatted = '';
          
          if (lockPeriodSeconds >= 86400) {
            // If >= 24 hours, show in days
            const days = Math.floor(lockPeriodSeconds / 86400);
            lockPeriodFormatted = `${Math.floor(days)} day${days !== 1 ? 's' : ''}`;
          } else if (lockPeriodSeconds >= 3600) {
            // If >= 60 minutes, show in hours
            const hours = Math.floor(lockPeriodSeconds / 3600);
            lockPeriodFormatted = `${Math.floor(hours)} hour${hours !== 1 ? 's' : ''}`;
          } else {
            // Show in minutes
            const minutes = Math.floor(lockPeriodSeconds / 60);
            lockPeriodFormatted = `${Math.floor(minutes)} min`;
          }
          
          return {
            ...project,
            networks: ['Arbitrum'],
            network: 'Arbitrum',
            stakingCount: parseInt(project.totalUsers || '0', 10),
            lockPeriod: lockPeriodFormatted,
            minDeposit: minDepositInMor,
            minimalDeposit: project.minimalDeposit,
            totalStakedFormatted: totalStakedInMor,
            withdrawLockPeriodFormatted: lockPeriodFormatted
          };
        });

        console.log('Fetched from Base:', baseProjects.length, 'projects');
        console.log('Fetched from Arbitrum:', arbitrumProjects.length, 'projects');
        
        // Combine results
        combinedProjects = [...baseProjects, ...arbitrumProjects];
        console.log('Combined mainnet projects:', combinedProjects.length);
      }
      
      // Set the combined state
      setBuildersProjects(combinedProjects);
      
      setIsLoading(false);
    } catch (e) {
      console.error('Error fetching on-chain builder data:', e);
      setError(e instanceof Error ? e : new Error('An unknown error occurred while fetching on-chain data'));
      setIsLoading(false);
    }
  };

  // Fetch on-chain data initially and whenever the network OR supabase builders change
  useEffect(() => {
    // In testnet mode, fetch regardless of Supabase state
    if (isTestnet) {
      console.log("Testnet detected, fetching data without Supabase dependency");
      fetchBuildersData();
    } 
    // In mainnet mode, only fetch if Supabase builders are loaded
    else if (supabaseBuildersLoaded && supabaseBuilders.length > 0) {
      console.log("Mainnet with loaded Supabase data, fetching from mainnet networks");
      fetchBuildersData();
    } else if (supabaseBuildersLoaded && supabaseBuilders.length === 0) {
      console.log("Supabase builders loaded but empty, clearing on-chain data.");
      setBuildersProjects([]); // Clear potentially stale on-chain data
    } else {
      console.log("Skipping fetchBuildersData, Supabase builders not loaded yet for mainnet mode.");
    }
  }, [isTestnet, supabaseBuildersLoaded, supabaseBuilders]); // Add supabase state dependencies
  
  // Compute filtered builders
  const filteredBuilders = useMemo(() => {
    // Start with all builders
    let result = [...adaptedBuilders];
    
    // Filter by name if nameFilter is provided
    if (nameFilter && nameFilter.trim() !== '') {
      const normalizedFilter = nameFilter.toLowerCase().trim();
      result = result.filter(builder => 
        builder.name.toLowerCase().includes(normalizedFilter)
      );
    }
    
    // Filter by reward type if rewardTypeFilter is provided and not 'all'
    if (rewardTypeFilter && rewardTypeFilter !== 'all') {
      result = result.filter(builder => 
        builder.reward_types && builder.reward_types.includes(rewardTypeFilter)
      );
    }
    
    // Filter by network if networkFilter is provided and not 'all'
    if (networkFilter && networkFilter !== 'all') {
      result = result.filter(builder => 
        builder.networks && builder.networks.includes(networkFilter)
      );
    }
    
    // Sort the results
    if (sortColumn) {
      result = [...result].sort((a, b) => {
        // We need to handle the case where the property might not exist
        const aValue = a[sortColumn as keyof Builder];
        const bValue = b[sortColumn as keyof Builder];
        
        // If either value is undefined, sort it to the end
        if (aValue === undefined) return sortDirection === 'asc' ? 1 : -1;
        if (bValue === undefined) return sortDirection === 'asc' ? -1 : 1;
        
        // Handle string comparison
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortDirection === 'asc' 
            ? aValue.localeCompare(bValue) 
            : bValue.localeCompare(aValue);
        }
        
        // Handle number comparison
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }
        
        // Default fallback
        return 0;
      });
    }
    
    return result;
  }, [adaptedBuilders, nameFilter, rewardTypeFilter, networkFilter, sortColumn, sortDirection]);
  
  // Extract all unique reward types for filtering
  const rewardTypes = useMemo(() => {
    const types = new Set<string>();
    
    adaptedBuilders.forEach(builder => {
      if (builder.reward_types && Array.isArray(builder.reward_types)) {
        builder.reward_types.forEach(type => types.add(type));
      }
    });
    
    return Array.from(types);
  }, [adaptedBuilders]);
  
  // Compute total metrics independent of filters
  const totalMetrics = useMemo(() => {
    return {
      totalBuilders: adaptedBuilders.length,
      totalStaked: adaptedBuilders.reduce((acc, builder) => acc + (builder.totalStaked || 0), 0),
      totalStaking: adaptedBuilders.reduce((acc, builder) => acc + (builder.stakingCount || 0), 0),
    };
  }, [adaptedBuilders]);
  
  const refreshData = async () => {
    // Refresh both on-chain data and Supabase data
    await Promise.all([
      fetchBuildersData(),
      BuildersService.getAllBuilders().then(setSupabaseBuilders)
    ]);
  };

  return (
    <BuildersContext.Provider
      value={{
        buildersProjects,
        userAccountBuildersProjects,
        buildersCounters,
        builders: adaptedBuilders,
        userBuilders: adaptedUserBuilders,
        isLoading,
        error,
        sortColumn,
        sortDirection,
        setSorting,
        nameFilter,
        setNameFilter,
        rewardTypeFilter,
        setRewardTypeFilter,
        networkFilter,
        setNetworkFilter,
        filteredBuilders,
        rewardTypes,
        totalMetrics,
        refreshData
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