"use client";

import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';

const GET_ACTIVE_STAKERS_COUNT = gql`
  query GetActiveStakersCount {
    # Get the global count from the pre-calculated entity
    activeStakersCount(id: "global") {
      activeStakers
      lastUpdatedTimestamp
    }
    
    # Backup: count directly from user stats if global count doesn't exist yet
    userPoolStats(where: { isActiveStaker: true }, first: 1000) {
      id
      user
      poolType
    }
  }
`;

interface UserPoolStat {
  id: string;
  user: string;
  poolType: string;
}

export interface ActiveStakersData {
  count: number;
  isLoading: boolean;
  error: string | null;
  lastUpdated?: string;
}

/**
 * Hook to fetch active stakers count from the subgraph
 * Much faster than Dune API (50-200ms vs 10-20 seconds)
 */
export function useActiveStakersSubgraph(): ActiveStakersData {
  const { data, loading, error } = useQuery(GET_ACTIVE_STAKERS_COUNT, {
    // Refresh every 30 seconds to get latest data
    pollInterval: 30000,
    // Cache for 10 seconds to reduce API calls
    fetchPolicy: 'cache-first',
    errorPolicy: 'all'
  });

  if (loading) {
    return {
      count: 0,
      isLoading: true,
      error: null
    };
  }

  if (error) {
    console.error('Error fetching active stakers from subgraph:', error);
    return {
      count: 0,
      isLoading: false,
      error: error.message
    };
  }

  // Try to get count from pre-calculated entity first
  let activeStakersCount = 0;
  let lastUpdated: string | undefined;

  if (data?.activeStakersCount) {
    activeStakersCount = parseInt(data.activeStakersCount.activeStakers);
    lastUpdated = new Date(parseInt(data.activeStakersCount.lastUpdatedTimestamp) * 1000).toISOString();
  } else if (data?.userPoolStats) {
    // Fallback: count unique users from user stats
    const uniqueUsers = new Set();
    data.userPoolStats.forEach((stat: UserPoolStat) => {
      uniqueUsers.add(stat.user);
    });
    activeStakersCount = uniqueUsers.size;
  }

  return {
    count: activeStakersCount,
    isLoading: false,
    error: null,
    lastUpdated
  };
}

// Example usage in useCapitalMetrics:
/*
export function useCapitalMetrics(): CapitalMetrics {
  const poolData = useCapitalPoolData();
  const activeStakersData = useActiveStakersSubgraph();
  
  // ... other logic ...
  
  const activeStakers = poolData.networkEnvironment === 'testnet' 
    ? (activeStakersData.isLoading ? "..." : activeStakersData.count.toString())
    : "N/A";
    
  return {
    // ... other metrics ...
    activeStakers,
    isLoading: poolData.assets.stETH?.isLoading || poolData.assets.LINK?.isLoading || isLoadingPrices,
    // Note: Don't include activeStakersData.isLoading in main loading state
  };
}
*/
