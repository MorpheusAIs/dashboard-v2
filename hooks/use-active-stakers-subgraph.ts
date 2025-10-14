"use client";

import { useState, useEffect } from 'react';
import { getGraphQLApiUrl } from '@/config/networks';

const GET_ACTIVE_STAKERS_QUERY = `
  query GetActiveStakersCount {
    users(where: { staked_gt: "0" }, first: 1000) {
      address
      staked
      depositPool
    }
  }
`;

interface User {
  address: string;
  staked: string;
  depositPool: string;
}

interface SubgraphResponse {
  data?: {
    users: User[];
  };
  errors?: Array<{ message: string }>;
}

export interface ActiveStakersData {
  count: number;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to fetch active stakers count from the subgraph
 * Much faster than Dune API (50-200ms vs 10-20 seconds)
 * Uses the new subgraph query to fetch users with staked > 0
 */
export function useActiveStakersSubgraph(networkEnv: 'mainnet' | 'testnet' = 'mainnet'): ActiveStakersData {
  const [count, setCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchActiveStakers() {
      setIsLoading(true);
      setError(null);

      try {
        const graphqlUrl = getGraphQLApiUrl(networkEnv);
        
        if (!graphqlUrl) {
          throw new Error(`GraphQL URL not configured for ${networkEnv}`);
        }

        console.log(`🔍 Fetching active stakers from subgraph for ${networkEnv}: ${graphqlUrl}`);

        const response = await fetch(graphqlUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: GET_ACTIVE_STAKERS_QUERY,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result: SubgraphResponse = await response.json();

        if (result.errors && result.errors.length > 0) {
          throw new Error(result.errors[0].message);
        }

        if (!result.data?.users) {
          throw new Error('No data returned from subgraph');
        }

        // Deduplicate addresses and count unique users
        const uniqueAddresses = new Set<string>();
        
        result.data.users.forEach((user: User) => {
          // Add each address to the Set (automatically handles duplicates)
          uniqueAddresses.add(user.address.toLowerCase());
        });
        
        // Count the unique addresses
        const activeStakersCount = uniqueAddresses.size;
        
        console.log(`📊 Active depositors: ${activeStakersCount} unique addresses from ${result.data.users.length} total entries`);

        if (isMounted) {
          setCount(activeStakersCount);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error fetching active stakers from subgraph:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setIsLoading(false);
        }
      }
    }

    fetchActiveStakers();

    // Poll every 30 seconds for fresh data
    const intervalId = setInterval(fetchActiveStakers, 30000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [networkEnv]);

  return {
    count,
    isLoading,
    error,
  };
}
