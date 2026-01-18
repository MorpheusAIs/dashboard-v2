"use client";

import { useState, useEffect } from "react";

// Cache management for cumulative deposits data
const CUMULATIVE_DEPOSITS_CACHE_KEY = 'morpheus_cumulative_deposits_cache';
const CACHE_EXPIRY_MS = 3 * 60 * 60 * 1000; // 3 hours

interface CumulativeDepositsCache {
  data: CumulativeDepositsPoint[];
  timestamp: number;
}

export interface CumulativeDepositsPoint {
  date: string;
  cumulativeDeposit: number;
}

const getCachedCumulativeDeposits = (allowStale: boolean = false): CumulativeDepositsPoint[] | null => {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(CUMULATIVE_DEPOSITS_CACHE_KEY);
    if (!cached) return null;

    const parsedCache: CumulativeDepositsCache = JSON.parse(cached);
    const now = Date.now();
    const ageHours = Math.round((now - parsedCache.timestamp) / 1000 / 60 / 60);

    // Check if cache is still valid (not expired)
    if (now - parsedCache.timestamp > CACHE_EXPIRY_MS) {
      if (allowStale) {
        // Return stale data as fallback when API fails
        console.log(`📦 Using STALE cached cumulative deposits: ${parsedCache.data.length} points (${ageHours} hours old)`);
        return parsedCache.data;
      }
      localStorage.removeItem(CUMULATIVE_DEPOSITS_CACHE_KEY);
      return null;
    }

    console.log(`📦 Using cached cumulative deposits: ${parsedCache.data.length} points (${ageHours} hours old)`);
    return parsedCache.data;
  } catch (error) {
    console.warn('Error reading cumulative deposits cache:', error);
    return null;
  }
};

const setCachedCumulativeDeposits = (data: CumulativeDepositsPoint[]): void => {
  if (typeof window === 'undefined') return;
  try {
    const cache: CumulativeDepositsCache = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(CUMULATIVE_DEPOSITS_CACHE_KEY, JSON.stringify(cache));
    console.log(`💾 Cached cumulative deposits: ${data.length} points`);
  } catch (error) {
    console.warn('Error saving cumulative deposits cache:', error);
  }
};

export function useCumulativeDeposits() {
  const [data, setData] = useState<CumulativeDepositsPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCumulativeDeposits = async () => {
      setLoading(true);
      setError(null);

      try {
        // Try to get cached data first
        const cachedData = getCachedCumulativeDeposits();
        if (cachedData && cachedData.length > 0) {
          console.log('📦 Using cached cumulative deposits data');
          setData(cachedData);
          setLoading(false);
          return;
        }

        // Fetch fresh data from API
        console.log('🌐 Fetching fresh cumulative deposits data');
        const response = await fetch('/api/dune/cumulative-deposits');

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        // Check if API returned an error (success: false)
        if (!result.success) {
          console.warn('⚠️  Dune API returned error:', result.error);
          throw new Error(result.error || 'Dune API error - cumulative deposits data unavailable');
        }

        if (Array.isArray(result.data) && result.data.length > 0) {
          // Transform the data to match our expected format
          const transformedData = result.data.map((item: { date: string; cumulativeDeposit: string | number }) => ({
            date: item.date,
            cumulativeDeposit: item.cumulativeDeposit
          }));

          console.log(`✅ Fetched ${transformedData.length} cumulative deposits data points`);
          setData(transformedData);

          // Cache the data
          setCachedCumulativeDeposits(transformedData);
        } else {
          console.warn('⚠️  Dune API returned empty data array');
          throw new Error('No cumulative deposits data available');
        }
      } catch (error) {
        console.error('Failed to fetch cumulative deposits data:', error);

        // Try to use cached data as fallback (allow stale cache on error)
        const cachedData = getCachedCumulativeDeposits(true);
        if (cachedData && cachedData.length > 0) {
          console.log('Using cached cumulative deposits data due to API error');
          setData(cachedData);
          // Don't set error state if we have fallback data - user can still see the chart
          setError(null);
        } else {
          // Only set error if we have no fallback data at all
          setError(error instanceof Error ? error.message : 'Failed to fetch data');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCumulativeDeposits();
  }, []);

  // Format data for chart display (convert to format expected by chart component)
  const chartData = data.map(point => ({
    date: point.date,
    deposits: point.cumulativeDeposit
  }));

  return {
    data: chartData,
    loading,
    error,
    // Cache utilities
    clearCache: () => {
      try {
        localStorage.removeItem(CUMULATIVE_DEPOSITS_CACHE_KEY);
        console.log('📦 Cumulative deposits cache cleared');
      } catch (error) {
        console.warn('Error clearing cumulative deposits cache:', error);
      }
    },
  };
}
