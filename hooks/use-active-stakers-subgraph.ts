"use client";

import { useState, useEffect } from 'react';

export interface ActiveStakersData {
  count: number;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to fetch active stakers count from server-side ISR API
 * Server fetches from mainnet subgraph every hour and caches the result
 * Client polls every 5 minutes for fresh data from server
 * Always returns mainnet data since active stakers represents Ethereum deposits
 */
export function useActiveStakersSubgraph(): ActiveStakersData {
  const [count, setCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Simple in-memory cache to avoid duplicate requests across components
    const CACHE_KEY = 'active-stakers:mainnet'; // Always mainnet
    const CACHE_TTL_MS = 60_000; // 1 minute
    const LS_KEY = 'morpheus_active_stakers_cache_v1';
    const LS_TTL_MS = 10 * 60_000; // 10 minutes (longer since server handles ISR)
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
        const entry = parsed['mainnet']; // Always mainnet
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
        parsed['mainnet'] = { timestamp: Date.now(), value }; // Always mainnet
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

        console.log(`🔍 Fetching active stakers from server API (always mainnet data)`);

        // Fetch from server-side ISR API (server always uses mainnet for active stakers)
        const response = await fetch(`/api/subgraph/active-stakers`);

        if (!response.ok) {
          throw new Error(`Server API request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Server API returned failure');
        }

        const activeStakersCount = data.active_stakers || 0;

        console.log(`📊 Active depositors from server API: ${activeStakersCount} for mainnet`);

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
        console.error('Error fetching active stakers from server API:', err);
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

    // Poll every 5 minutes for fresh data (server handles ISR every hour)
    const intervalId = setInterval(fetchActiveStakers, 300_000); // 5 minutes

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, []); // No dependencies since we always use mainnet

  return {
    count,
    isLoading,
    error,
  };
}
