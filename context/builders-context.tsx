"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode, useCallback } from 'react';
import { Builder } from '@/app/builders/builders-data';
import { useUrlParams, useInitStateFromUrl, ParamConverters } from '@/lib/utils/url-params';
import { useAllBuildersQuery } from '@/app/hooks/useAllBuildersQuery';
import { useQueryClient } from '@tanstack/react-query';

interface BuildersContextType {
  builders: Builder[];
  isLoading: boolean;
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
}

const BuildersContext = createContext<BuildersContextType | undefined>(undefined);

export function BuildersProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { 
    data: allBuildersData,
    isLoading: isLoadingBuilders,
    error: buildersError,
  } = useAllBuildersQuery();

  const builders = useMemo(() => allBuildersData || [], [allBuildersData]);

  const [sortColumn, setSortColumn] = useState<string | null>('totalStaked');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>('desc');
  const [nameFilter, setNameFilter] = useState('');
  const [rewardTypeFilter, setRewardTypeFilter] = useState('all');
  const [networkFilter, setNetworkFilter] = useState('all');

  useInitStateFromUrl('name', (value) => { if (value !== '') setNameFilter(value); }, ParamConverters.string.deserialize);
  useInitStateFromUrl('rewardType', (value) => { if (value !== '') setRewardTypeFilter(value); }, ParamConverters.string.deserialize);
  useInitStateFromUrl('network', (value) => { if (value !== '') setNetworkFilter(value); }, ParamConverters.string.deserialize);
  useInitStateFromUrl('sort', (sorting) => { if (sorting.column) setSortColumn(sorting.column); if (sorting.direction) setSortDirection(sorting.direction); }, ParamConverters.sorting.deserialize);

  const { setParam } = useUrlParams();
  useEffect(() => { setParam('name', nameFilter || null); }, [nameFilter, setParam]);
  useEffect(() => { setParam('rewardType', (rewardTypeFilter && rewardTypeFilter !== 'all') ? rewardTypeFilter : null); }, [rewardTypeFilter, setParam]);
  useEffect(() => { setParam('network', (networkFilter && networkFilter !== 'all') ? networkFilter : null); }, [networkFilter, setParam]);
  useEffect(() => { setParam('sort', sortColumn ? ParamConverters.sorting.serialize({ column: sortColumn, direction: sortDirection }) : null); }, [sortColumn, sortDirection, setParam]);

  const setSorting = (column: string) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else if (sortDirection === 'desc') { setSortColumn(null); setSortDirection(null); } 
      else setSortDirection('asc');
    } else {
      setSortColumn(column); setSortDirection('asc');
    }
  };

  const filteredBuilders = useMemo(() => {
    let result = [...builders];
    if (nameFilter && nameFilter.trim() !== '') {
      result = result.filter(builder => builder.name.toLowerCase().includes(nameFilter.toLowerCase().trim()));
    }
    if (rewardTypeFilter && rewardTypeFilter !== 'all') {
      result = result.filter(builder => builder.reward_types && builder.reward_types.includes(rewardTypeFilter));
    }
    if (networkFilter && networkFilter !== 'all') {
      result = result.filter(builder => builder.networks && builder.networks.includes(networkFilter));
    }
    if (sortColumn) {
      result.sort((a, b) => {
        const aValue = a[sortColumn as keyof Builder];
        const bValue = b[sortColumn as keyof Builder];
        if (aValue === undefined) return sortDirection === 'asc' ? 1 : -1;
        if (bValue === undefined) return sortDirection === 'asc' ? -1 : 1;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
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
    builders.forEach(builder => {
      if (builder.reward_types && Array.isArray(builder.reward_types)) {
        builder.reward_types.forEach(type => types.add(type));
      }
    });
    return Array.from(types);
  }, [builders]);

  const totalMetrics = useMemo(() => {
    return {
      totalBuilders: builders.length,
      totalStaked: builders.reduce((acc, builder) => acc + (builder.totalStaked || 0), 0),
      totalStaking: builders.reduce((acc, builder) => acc + (builder.stakingCount || 0), 0),
    };
  }, [builders]);
  
  const refreshData = useCallback(async () => {
    console.log("[BuildersContext] refreshData called. Invalidating 'builders' query.");
    await queryClient.invalidateQueries({ queryKey: ['builders'] });
  }, [queryClient]);

  return (
    <BuildersContext.Provider
      value={{
        builders,
        isLoading: isLoadingBuilders,
        error: buildersError,
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