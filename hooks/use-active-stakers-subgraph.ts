"use client";
// @ts-nocheck

import { useState, useEffect } from 'react';
import { getGraphQLApiUrl } from '@/config/networks';
import { fetchGraphQL } from '@/app/graphql/client';

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

    // Simple in-memory cache to avoid duplicate requests across components
    const CACHE_KEY = `active-stakers:${networkEnv}`;
    const CACHE_TTL_MS = 60_000; // 1 minute
    const LS_KEY = 'morpheus_active_stakers_cache_v1';
    const LS_TTL_MS = 5 * 60_000; // 5 minutes
    const memoryCache = (globalThis as unknown as {
      __activeStakersCache?: Map<string, { timestamp: number; value: number }>;
    });
    if (!memoryCache.__activeStakersCache) {
      memoryCache.__activeStakersCache = new Map();
    }

    const readLocalStorage = (): number | null => {
      try {
        if (typeof window === 'undefined') return null;
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Record<string, { timestamp: number; value: number }>;
        const entry = parsed[networkEnv];
        if (!entry) return null;
        if (Date.now() - entry.timestamp > LS_TTL_MS) return null;
        return entry.value;
      } catch {
        return null;
      }
    };

    const writeLocalStorage = (value: number) => {
      try {
        if (typeof window === 'undefined') return;
        const raw = localStorage.getItem(LS_KEY);
        const parsed = raw ? (JSON.parse(raw) as Record<string, { timestamp: number; value: number }>) : {};
        parsed[networkEnv] = { timestamp: Date.now(), value };
        localStorage.setItem(LS_KEY, JSON.stringify(parsed));
      } catch {
        // ignore
      }
    };

    // Provide immediate best-effort value from localStorage on mount
    const lsInitial = readLocalStorage();
    if (lsInitial !== null) {
      setCount(lsInitial);
      setIsLoading(false);
    }

    async function fetchActiveStakers() {
      setIsLoading(true);
      setError(null);

      try {
        const graphqlUrl = getGraphQLApiUrl(networkEnv);
        
        if (!graphqlUrl) {
          throw new Error(`GraphQL URL not configured for ${networkEnv}`);
        }

        // Try in-memory cache first
        const cachedEntry = memoryCache.__activeStakersCache!.get(CACHE_KEY);
        const now = Date.now();
        if (cachedEntry && now - cachedEntry.timestamp < CACHE_TTL_MS) {
          if (isMounted) {
            setCount(cachedEntry.value);
            setIsLoading(false);
          }
          return;
        }

        console.log(`🔍 Fetching active stakers from subgraph for ${networkEnv}: ${graphqlUrl}`);
        const result = await fetchGraphQL<SubgraphResponse>(
          graphqlUrl,
          'GetActiveStakersCount',
          GET_ACTIVE_STAKERS_QUERY
        );

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

        // Store in in-memory cache
        memoryCache.__activeStakersCache!.set(CACHE_KEY, {
          timestamp: Date.now(),
          value: activeStakersCount,
        });

        // Store in localStorage for fallback display
        writeLocalStorage(activeStakersCount);
      } catch (err) {
        console.error('Error fetching active stakers from subgraph:', err);
        if (isMounted) {
          const lsFallback = readLocalStorage();
          if (lsFallback !== null) {
            // Use cached value instead of error to avoid flashing "Error" in the UI
            setCount(lsFallback);
            setError(null);
            setIsLoading(false);
          } else {
            setError(err instanceof Error ? err.message : 'Unknown error');
            setIsLoading(false);
          }
        }
      }
    }

    // Add small randomized delay to reduce potential thundering herd
    const initialJitter = Math.floor(Math.random() * 500);
    const timeoutId = setTimeout(fetchActiveStakers, initialJitter);

    // Poll every 2 minutes for fresh data
    const intervalId = setInterval(fetchActiveStakers, 120_000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [networkEnv]);

  return {
    count,
    isLoading,
    error,
  };
}
