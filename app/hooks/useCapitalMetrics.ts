"use client";

import { useState, useEffect, useMemo } from "react";
import { useCapitalPoolData } from "@/hooks/use-capital-pool-data";
import { useTokenPrices } from "@/components/capital/hooks/use-token-prices";

// Cache for last known good TVL data
interface TVLCache {
  totalValueLockedUSD: string;
  timestamp: number;
  stethAmount: number;
  linkAmount: number;
  stethPrice: number;
  linkPrice: number;
}

// Cache for active stakers data
interface ActiveStakersCache {
  activeStakers: number;
  timestamp: number;
  networkEnv: string;
}

const TVL_CACHE_KEY = 'morpheus_tvl_cache';
const ACTIVE_STAKERS_CACHE_KEY = 'morpheus_active_stakers_cache';
const CACHE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes
const MAX_RETRY_ATTEMPTS = 3;

// Cache management functions
const getCachedTVL = (): TVLCache | null => {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(TVL_CACHE_KEY);
    if (!cached) return null;
    
    const parsedCache: TVLCache = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is still valid (not expired)
    if (now - parsedCache.timestamp > CACHE_EXPIRY_MS) {
      localStorage.removeItem(TVL_CACHE_KEY);
      return null;
    }
    
    return parsedCache;
  } catch (error) {
    console.warn('Error reading TVL cache:', error);
    return null;
  }
};

const setCachedTVL = (cache: TVLCache): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TVL_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn('Error saving TVL cache:', error);
  }
};

// Active stakers cache management functions
const getCachedActiveStakers = (networkEnv: string): ActiveStakersCache | null => {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(ACTIVE_STAKERS_CACHE_KEY);
    if (!cached) return null;
    
    const parsedCache: ActiveStakersCache = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is still valid (not expired) and for correct network
    if (now - parsedCache.timestamp > CACHE_EXPIRY_MS || parsedCache.networkEnv !== networkEnv) {
      localStorage.removeItem(ACTIVE_STAKERS_CACHE_KEY);
      return null;
    }
    
    return parsedCache;
  } catch (error) {
    console.warn('Error reading active stakers cache:', error);
    return null;
  }
};

const setCachedActiveStakers = (cache: ActiveStakersCache): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_STAKERS_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn('Error saving active stakers cache:', error);
  }
};

export interface CapitalMetrics {
  totalValueLockedUSD: string;
  currentDailyRewardMOR: string;
  avgApyRate: string;
  activeStakers: string;
  isLoading: boolean;
  error: string | null;
}

/**
 * Custom hook to calculate live capital metrics from pool data
 * Uses live V2 contract data for both mainnet and testnet networks
 * Accounts for different reward timing (mainnet: daily, testnet: per-minute)
 */
export function useCapitalMetrics(): CapitalMetrics {
  const poolData = useCapitalPoolData();

  // Use shared token prices hook
  const { stethPrice, linkPrice, isPriceUpdating } = useTokenPrices({
    isInitialLoad: true,
    shouldRefreshData: false,
    userAddress: undefined,
    networkEnv: poolData.networkEnvironment || 'mainnet'
  });

  // State for active stakers from Dune API (both testnet and mainnet)
  const [activeStakersCount, setActiveStakersCount] = useState<number | null>(null);
  const [isLoadingActiveStakers, setIsLoadingActiveStakers] = useState<boolean>(false);
  const [activeStakersError, setActiveStakersError] = useState<string | null>(null);
  const [retryAttempts, setRetryAttempts] = useState<number>(0);


  // Fetch active stakers count from Dune API with caching and retry logic
  useEffect(() => {
    // Skip if running on server (SSR)
    if (typeof window === 'undefined') {
      return;
    }

    // Skip if no network environment is set
    if (!poolData.networkEnvironment) {
      return;
    }

    // Check cache first
    const cachedData = getCachedActiveStakers(poolData.networkEnvironment);
    if (cachedData) {
      console.log(`📦 [FRONTEND] Using cached active stakers data for ${poolData.networkEnvironment}:`, cachedData.activeStakers);
      setActiveStakersCount(cachedData.activeStakers);
      setActiveStakersError(null);
      setRetryAttempts(0);
      return;
    }

    async function fetchActiveStakersWithRetry(attemptNumber: number = 1): Promise<void> {
      setIsLoadingActiveStakers(true);
      setActiveStakersError(null);
      setRetryAttempts(attemptNumber);
      
      try {
        // Determine which endpoint to call based on network environment
        const endpoint = poolData.networkEnvironment === 'testnet' 
          ? '/api/dune/active-stakers-testnet'
          : '/api/dune/active-stakers-mainnet';
        
        console.log(`🔍 [FRONTEND] Fetching active stakers for ${poolData.networkEnvironment} from ${endpoint} (attempt ${attemptNumber}/${MAX_RETRY_ATTEMPTS})`);
        
        const response = await fetch(endpoint);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && typeof data.active_stakers === 'number') {
          // Success - cache the result and update state
          const cacheData: ActiveStakersCache = {
            activeStakers: data.active_stakers,
            timestamp: Date.now(),
            networkEnv: poolData.networkEnvironment
          };
          setCachedActiveStakers(cacheData);
          
          setActiveStakersCount(data.active_stakers);
          setActiveStakersError(null);
          setRetryAttempts(0);
          console.log(`✅ [FRONTEND] Active stakers count set and cached (${data.network}):`, data.active_stakers);
        } else {
          console.log('❌ [FRONTEND] API returned failure:', data.error || 'Invalid response format');
          throw new Error(data.error || 'Invalid response format');
        }
      } catch (error) {
        console.error(`💥 [FRONTEND] Error on attempt ${attemptNumber}/${MAX_RETRY_ATTEMPTS}:`);
        console.error('  - Error type:', typeof error);
        console.error('  - Error message:', error instanceof Error ? error.message : String(error));
        console.error('  - Network environment:', poolData.networkEnvironment);
        
        if (attemptNumber < MAX_RETRY_ATTEMPTS) {
          // Retry with exponential backoff
          const delayMs = Math.min(1000 * Math.pow(2, attemptNumber - 1), 10000); // Cap at 10 seconds
          console.log(`🔄 [FRONTEND] Retrying in ${delayMs}ms...`);
          
          setTimeout(() => {
            fetchActiveStakersWithRetry(attemptNumber + 1);
          }, delayMs);
        } else {
          // All retries failed
          console.error(`💀 [FRONTEND] All ${MAX_RETRY_ATTEMPTS} attempts failed for active stakers fetch`);
          setActiveStakersError('Failed to fetch active stakers data after multiple attempts');
          setActiveStakersCount(null);
          setRetryAttempts(0);
        }
      } finally {
        if (attemptNumber >= MAX_RETRY_ATTEMPTS) {
          setIsLoadingActiveStakers(false);
        }
      }
    }

    // Add a small delay to ensure everything is properly initialized
    const timeoutId = setTimeout(() => fetchActiveStakersWithRetry(1), 100);
    
    return () => clearTimeout(timeoutId);
  }, [poolData.networkEnvironment]);

  // Helper function to safely parse pool amounts
  const parsePoolAmount = (amountStr: string): number => {
    try {
      if (!amountStr || typeof amountStr !== 'string') {
        return 0;
      }
      const cleanedValue = amountStr.replace(/,/g, '');
      const parsed = parseFloat(cleanedValue);
      return isNaN(parsed) ? 0 : parsed;
    } catch (error) {
      console.error('Error parsing pool amount:', error);
      return 0;
    }
  };

  // Calculate active stakers display value separately to avoid dependency issues
  const activeStakersDisplay = useMemo(() => {
    // For both testnet and mainnet, use Dune API data
    if (activeStakersCount !== null && activeStakersCount >= 0) {
      return activeStakersCount.toString();
    } else if (isLoadingActiveStakers) {
      // Show retry attempt info during loading if retries are happening
      return retryAttempts > 1 ? `... (${retryAttempts}/${MAX_RETRY_ATTEMPTS})` : "...";
    } else if (activeStakersError) {
      return "Error"; // Error state - only shown after all retries fail
    }
    
    // Fallback if no network environment is set
    return "N/A";
  }, [poolData.networkEnvironment, activeStakersCount, isLoadingActiveStakers, activeStakersError, retryAttempts]);

  // Calculate core metrics from live pool data (excluding active stakers to avoid blocking)
  const coreMetrics = useMemo(() => {
    // Core metrics loading (DON'T include active stakers loading to avoid blocking chart)
    const isLoading = poolData.stETH.isLoading || poolData.LINK.isLoading || isPriceUpdating;
    // Core metrics errors (DON'T include active stakers errors - they're non-critical)
    const hasError = poolData.stETH.error || poolData.LINK.error;

    // If still loading, show loading state instead of zeros
    if (isLoading) {
      return {
        totalValueLockedUSD: "...",
        currentDailyRewardMOR: "...",
        avgApyRate: "...%",
        isLoading: true,
        error: null
      };
    }

    // If there are errors but we still have partial data, try to calculate with available data
    if (hasError) {
      console.warn('⚠️ Partial error in capital metrics, attempting calculation with available data:', {
        stETHError: poolData.stETH.error?.message,
        linkError: poolData.LINK.error?.message,
        availableData: {
          stETHData: { totalStaked: poolData.stETH.totalStaked, apy: poolData.stETH.apy },
          linkData: { totalStaked: poolData.LINK.totalStaked, apy: poolData.LINK.apy },
          prices: { stethPrice, linkPrice }
        }
      });
      
      // Only return error state if we have NO usable data at all
      if ((!poolData.stETH.totalStaked || poolData.stETH.totalStaked === '0') && 
          (!poolData.LINK.totalStaked || poolData.LINK.totalStaked === '0')) {
        // Try cached data as last resort
        const cachedTVL = getCachedTVL();
        if (cachedTVL) {
          console.log('📦 Using cached TVL data as last resort due to complete error:', cachedTVL);
          return {
            totalValueLockedUSD: `${cachedTVL.totalValueLockedUSD} (cached)`,
            currentDailyRewardMOR: "Error",
            avgApyRate: "Error",
            isLoading: false,
            error: hasError.toString()
          };
        }
        
        return {
          totalValueLockedUSD: "Error",
          currentDailyRewardMOR: "Error",
          avgApyRate: "Error",
          isLoading: false,
          error: hasError.toString()
        };
      }
      // Continue with calculation even with partial errors
    }

    // Calculate Total Value Locked in USD
    const stethAmount = parsePoolAmount(poolData.stETH.totalStaked);
    const linkAmount = parsePoolAmount(poolData.LINK.totalStaked);
    
    // Handle missing price data more gracefully
    const stethUSDValue = (stethPrice && stethAmount > 0) ? stethAmount * stethPrice : 0;
    const linkUSDValue = (linkPrice && linkAmount > 0) ? linkAmount * linkPrice : 0;
    const totalValueLockedUSD = Math.floor(stethUSDValue + linkUSDValue);
    
    // Log calculation details for debugging
    console.log('💰 TVL Calculation Debug:', {
      stethAmount,
      linkAmount,
      stethPrice,
      linkPrice,
      stethUSDValue,
      linkUSDValue,
      totalValueLockedUSD,
      networkEnv: poolData.networkEnvironment
    });

    // Calculate average APY (weighted by USD value)
    let avgApy = 0;
    if (totalValueLockedUSD > 0) {
      const stethApyNum = parseFloat(poolData.stETH.apy.replace('%', ''));
      const linkApyNum = parseFloat(poolData.LINK.apy.replace('%', ''));
      
      const stethWeight = stethUSDValue / totalValueLockedUSD;
      const linkWeight = linkUSDValue / totalValueLockedUSD;
      
      avgApy = (stethApyNum * stethWeight) + (linkApyNum * linkWeight);
    }

    // Calculate LIVE daily MOR emissions from actual contract data (both networks)
    const currentDailyRewardMOR = (() => {
      // Calculate from live APR data and total deposited amounts for all networks
      try {
        // Parse APR values to get the underlying rates
        const stETHAPR = parseFloat(poolData.stETH.apy.replace('%', '').replace(/,/g, ''));
        const linkAPR = parseFloat(poolData.LINK.apy.replace('%', '').replace(/,/g, ''));
        
        // Parse deposited amounts 
        const stETHDeposited = parseFloat(poolData.stETH.totalStaked.replace(/,/g, ''));
        const linkDeposited = parseFloat(poolData.LINK.totalStaked.replace(/,/g, ''));

        if (isNaN(stETHAPR) || isNaN(linkAPR) || isNaN(stETHDeposited) || isNaN(linkDeposited)) {
          console.warn('Cannot calculate daily emissions: invalid data', {
            stETHAPR, linkAPR, stETHDeposited, linkDeposited
          });
          return "N/A";
        }

        // Calculate daily rewards for each pool
        // Formula: (APR / 100 / 365) * totalDeposited = daily rewards
        const stETHDailyRewards = (stETHAPR / 100 / 365) * stETHDeposited;
        const linkDailyRewards = (linkAPR / 100 / 365) * linkDeposited;
        
        // Total daily emissions across all pools and assets
        const totalDailyEmissions = stETHDailyRewards + linkDailyRewards;

        // Format for display
        return totalDailyEmissions < 1000 
          ? totalDailyEmissions.toFixed(0)
          : Math.round(totalDailyEmissions).toLocaleString();

      } catch (error) {
        console.error('Error calculating daily emissions:', error);
        return "N/A"; // Show unavailable instead of fake numbers
      }
    })();

    // Save successful calculation to cache
    if (totalValueLockedUSD > 0 && stethPrice && linkPrice) {
      const cacheData: TVLCache = {
        totalValueLockedUSD: totalValueLockedUSD.toLocaleString(),
        timestamp: Date.now(),
        stethAmount,
        linkAmount,
        stethPrice,
        linkPrice
      };
      setCachedTVL(cacheData);
    }

    // Provide better display values based on data availability
    const totalValueLockedUSDDisplay = (() => {
      if (totalValueLockedUSD > 0) {
        return totalValueLockedUSD.toLocaleString();
      } else if ((stethAmount > 0 || linkAmount > 0) && (!stethPrice || !linkPrice)) {
        // We have pool deposits but missing price data - try to use cached price
        const cachedTVL = getCachedTVL();
        if (cachedTVL && (cachedTVL.stethAmount > 0 || cachedTVL.linkAmount > 0)) {
          console.log('📦 Using cached TVL data due to missing price data:', cachedTVL);
          return `${cachedTVL.totalValueLockedUSD} (cached)`;
        }
        return "Price loading...";
      } else if (stethAmount === 0 && linkAmount === 0) {
        // No deposits in either pool
        return "0";
      } else {
        // Some other issue - try cache
        const cachedTVL = getCachedTVL();
        if (cachedTVL) {
          console.log('📦 Using cached TVL data due to calculation error:', cachedTVL);
          return `${cachedTVL.totalValueLockedUSD} (cached)`;
        }
        return "Calculating...";
      }
    })();

    return {
      totalValueLockedUSD: totalValueLockedUSDDisplay,
      currentDailyRewardMOR,
      avgApyRate: `${avgApy.toFixed(2)}%`,
      isLoading,
      error: null
    };
  }, [poolData, stethPrice, linkPrice, isPriceUpdating]);

  // Combine core metrics with active stakers display
  const metrics = useMemo(() => ({
    ...coreMetrics,
    activeStakers: activeStakersDisplay
  }), [coreMetrics, activeStakersDisplay]);

  return metrics;
}
