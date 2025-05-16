"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode, useCallback } from 'react';
import { Builder } from '@/app/builders/builders-data';
import { useUrlParams, useInitStateFromUrl, ParamConverters } from '@/lib/utils/url-params';
import { useAllBuildersQuery } from '@/app/hooks/useAllBuildersQuery';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/auth-context';
import { useChainId } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';
import { getClientForNetwork } from '@/lib/apollo-client';
import { COMBINED_BUILDER_SUBNETS, GET_BUILDERS_PROJECTS } from '@/lib/graphql/builders-queries';
import { formatTimePeriod } from '@/app/utils/time-utils';
import { OrderDirection } from '@/lib/types/graphql';
import { formatUnits } from 'viem';

interface BuildersContextType {
  builders: Builder[];
  userAdminSubnets: Builder[] | null;
  isLoading: boolean;
  isLoadingUserAdminSubnets: boolean;
  error: Error | null;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc' | null;
  setSorting: (column: string) => void;
  nameFilter: string;
  setNameFilter: (filter: string) => void;
  rewardTypeFilter: string;
  setRewardTypeFilter: (filter: string) => void;
  networkFilter: string;
  setNetworkFilter: (filter: string) => void;
  filteredBuilders: Builder[];
  rewardTypes: string[];
  totalMetrics: {
    totalBuilders: number;
    totalStaked: number;
    totalStaking: number;
  };
  refreshData: () => Promise<void>;
  participatingBuilders: Builder[] | null;
  isLoadingParticipating: boolean;
}

const BuildersContext = createContext<BuildersContextType | undefined>(undefined);

export function BuildersProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { userAddress, isAuthenticated, isLoading: isLoadingAuth } = useAuth();
  const chainId = useChainId();
  const isTestnet = chainId === arbitrumSepolia.id;

  // State for builders data
  const [builders, setBuilders] = useState<Builder[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isLoadingUserAdminSubnets, setIsLoadingUserAdminSubnets] = useState(true);
  const [isLoadingParticipating, setIsLoadingParticipating] = useState(true);

  // State for filtering and sorting
  const [sortColumn, setSortColumn] = useState<string | null>('totalStaked');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>('desc');
  const [nameFilter, setNameFilter] = useState('');
  const [rewardTypeFilter, setRewardTypeFilter] = useState('all');
  const [networkFilter, setNetworkFilter] = useState('all');

  const setSorting = useCallback((column: string) => {
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
  }, [sortColumn, sortDirection]);

  // Fetch builders data
  const fetchBuildersData = useCallback(async () => {
    setIsLoadingData(true);
    setError(null);
    console.log('[BuildersContext] fetchBuildersData called. isTestnet:', isTestnet, 'isAuthenticated:', isAuthenticated, 'userAddress:', userAddress, 'isLoadingAuth:', isLoadingAuth);
    try {
      const client = getClientForNetwork(isTestnet ? 'ArbitrumSepolia' : 'Arbitrum');
      if (!client) {
        throw new Error('Could not get Apollo client');
      }

      const variables = {
        first: 100,
        skip: 0,
        orderBy: 'totalStaked',
        orderDirection: OrderDirection.Desc,
        userAddress: isAuthenticated ? userAddress : '',
      };

      const response = await client.query({
        query: isTestnet ? COMBINED_BUILDER_SUBNETS : GET_BUILDERS_PROJECTS,
        variables,
        fetchPolicy: 'no-cache',
      });

      const data = isTestnet ? response.data.builderSubnets : response.data.buildersProjects;
      console.log('[BuildersContext] Raw data from GraphQL:', JSON.stringify(data, null, 2));

      const mappedBuilders = data.map((item: any): Builder => {
        const totalStaked = Number(item.totalStaked || '0') / 1e18;
        const minDeposit = Number(item.minStake || item.minimalDeposit || '0') / 1e18;
        const lockPeriodSeconds = parseInt(
          item.withdrawLockPeriodAfterStake || 
          item.withdrawLockPeriodAfterDeposit || 
          '0', 
          10
        );
        return {
          id: item.id,
          mainnetProjectId: isTestnet ? item.id : item.mainnetProjectId || null,
          name: item.name,
          description: item.description || '',
          long_description: item.description || '',
          admin: isTestnet ? item.owner : item.admin,
          networks: [isTestnet ? 'Arbitrum Sepolia' : 'Arbitrum'],
          network: isTestnet ? 'Arbitrum Sepolia' : 'Arbitrum',
          totalStaked,
          minDeposit,
          lockPeriod: formatTimePeriod(lockPeriodSeconds),
          withdrawLockPeriodRaw: lockPeriodSeconds,
          stakingCount: parseInt(item.totalUsers || '0', 10),
          website: item.website || '',
          image_src: item.image || '',
          image: item.image || '',
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
          startsAt: item.startsAt,
          builderUsers: item.builderUsers?.map((user: any) => ({
            id: user.id,
            address: user.address,
            staked: user.staked,
            claimed: user.claimed || '0',
            claimLockEnd: user.claimLockEnd || '0',
            lastStake: user.lastStake,
          })),
        };
      });
      console.log('[BuildersContext] Mapped builders:', JSON.stringify(mappedBuilders, null, 2));
      setBuilders(mappedBuilders);
      setIsLoadingData(false);
    } catch (e) {
      console.error('Error fetching builder data:', e);
      setError(e instanceof Error ? e : new Error('Unknown error fetching builder data'));
      setIsLoadingData(false);
    }
  }, [isTestnet, isAuthenticated, userAddress]);

  useEffect(() => {
    fetchBuildersData();
  }, [fetchBuildersData]);

  const userAdminSubnets = useMemo<Builder[] | null>(() => {
    console.log('[BuildersContext] Recalculating userAdminSubnets. isAuthenticated:', isAuthenticated, 'isLoadingAuth:', isLoadingAuth, 'userAddress:', userAddress, 'Builders count:', builders?.length, 'isLoadingData:', isLoadingData);
    if (isLoadingAuth || isLoadingData || !isAuthenticated || !userAddress || !builders) return null;
    const filtered = builders.filter((b: Builder) => {
      const isAdmin = b.admin?.toLowerCase() === userAddress.toLowerCase();
      return isAdmin;
    });
    console.log('[BuildersContext] Filtered admin subnets:', JSON.stringify(filtered, null, 2));
    return filtered;
  }, [isAuthenticated, userAddress, builders, isLoadingAuth, isLoadingData]);

  const participatingBuilders = useMemo<Builder[] | null>(() => {
    console.log('[BuildersContext] Recalculating participatingBuilders. isAuthenticated:', isAuthenticated, 'isLoadingAuth:', isLoadingAuth, 'userAddress:', userAddress, 'Builders count:', builders?.length, 'isLoadingData:', isLoadingData);
    if (isLoadingAuth || isLoadingData || !isAuthenticated || !userAddress || !builders) return null;
    const filtered = builders.filter(builder => {
      if (!builder.builderUsers) return false;
      const isParticipating = builder.builderUsers.some(user => {
        const addressMatch = user.address.toLowerCase() === userAddress.toLowerCase();
        const stakedAmount = parseFloat(formatUnits(BigInt(user.staked), 18));
        return addressMatch && stakedAmount > 0;
      });
      return isParticipating;
    });
    console.log('[BuildersContext] Filtered participating builders:', JSON.stringify(filtered, null, 2));
    return filtered;
  }, [isAuthenticated, userAddress, builders, isLoadingAuth, isLoadingData]);

  const filteredBuilders = useMemo(() => {
    let result = [...builders];
    if (nameFilter) {
      result = result.filter(b => 
        b.name.toLowerCase().includes(nameFilter.toLowerCase())
      );
    }
    if (rewardTypeFilter !== 'all') {
      result = result.filter(b => 
        b.reward_types?.includes(rewardTypeFilter)
      );
    }
    if (networkFilter !== 'all') {
      result = result.filter(b => 
        b.networks?.includes(networkFilter)
      );
    }
    if (sortColumn) {
      result.sort((a, b) => {
        const aValue = a[sortColumn as keyof Builder];
        const bValue = b[sortColumn as keyof Builder];
        if (aValue === undefined) return sortDirection === 'asc' ? 1 : -1;
        if (bValue === undefined) return sortDirection === 'asc' ? -1 : 1;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortDirection === 'asc' ? 
            aValue.localeCompare(bValue) : 
            bValue.localeCompare(aValue);
        }
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }
        return 0;
      });
    }
    return result;
  }, [builders, nameFilter, rewardTypeFilter, networkFilter, sortColumn, sortDirection]);

  const rewardTypes = useMemo(() => {
    const types = new Set<string>();
    builders.forEach(b => {
      b.reward_types?.forEach(t => types.add(t));
    });
    return Array.from(types);
  }, [builders]);

  const totalMetrics = useMemo(() => ({
    totalBuilders: builders.length,
    totalStaked: builders.reduce((acc, b) => acc + (b.totalStaked || 0), 0),
    totalStaking: builders.reduce((acc, b) => acc + (b.stakingCount || 0), 0),
  }), [builders]);

  const refreshData = useCallback(async () => {
    await fetchBuildersData();
  }, [fetchBuildersData]);

  return (
    <BuildersContext.Provider
      value={{
        builders,
        userAdminSubnets,
        isLoading: isLoadingData || isLoadingAuth,
        isLoadingUserAdminSubnets: isLoadingAuth || isLoadingData || (isAuthenticated && userAddress != null && userAdminSubnets === null),
        isLoadingParticipating: isLoadingAuth || isLoadingData || (isAuthenticated && userAddress != null && participatingBuilders === null),
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
        refreshData,
        participatingBuilders,
      }}
    >
      {children}
    </BuildersContext.Provider>
  );
}

export function useBuilders() {
  const context = useContext(BuildersContext);
  if (!context) {
    throw new Error('useBuilders must be used within BuildersProvider');
  }
  return context;
} 