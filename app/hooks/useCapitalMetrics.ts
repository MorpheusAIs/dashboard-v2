"use client";

import { useState, useEffect, useMemo } from "react";
import { useCapitalPoolData } from "@/hooks/use-capital-pool-data";
import { useTokenPrices } from "@/components/capital/hooks/use-token-prices";
import { getSupportedAssetSymbols, type AssetSymbol } from "@/components/capital/constants/asset-config";

// Cache for last known good TVL data
interface TVLCache {
  totalValueLockedUSD: string;
  timestamp: number;
  networkEnvironment: string;
  assetAmounts: Partial<Record<AssetSymbol, number>>;
  prices: Record<string, number>; // Keyed by asset symbol
}

// Cache for active stakers data
interface ActiveStakersCache {
  activeStakers: number;
  timestamp: number;
  networkEnv: string;
}

// Cache for local active depositor adjustments
interface LocalDepositorAdjustment {
  networkEnv: string;
  localIncrement: number; // How many we've locally added
  timestamp: number;
}

const TVL_CACHE_KEY = 'morpheus_tvl_cache';
const ACTIVE_STAKERS_CACHE_KEY = 'morpheus_active_stakers_cache';
const LOCAL_DEPOSITOR_ADJUSTMENT_KEY = 'morpheus_local_depositor_adjustment';
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes - shorter cache for more frequent updates
const MAX_RETRY_ATTEMPTS = 3;

// Cache management functions
const getCachedTVL = (): TVLCache | null => {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(TVL_CACHE_KEY);
    if (!cached) return null;

    const parsedCache = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is still valid (not expired)
    if (now - parsedCache.timestamp > CACHE_EXPIRY_MS) {
      localStorage.removeItem(TVL_CACHE_KEY);
      return null;
    }

    // Handle backward compatibility - convert old cache format to new format
    if (parsedCache.stethAmount !== undefined || parsedCache.linkAmount !== undefined) {
      // Convert old format to new format
      const assetAmounts: Partial<Record<AssetSymbol, number>> = {};
      const prices: Record<string, number> = {};

      if (parsedCache.stethAmount !== undefined) {
        assetAmounts.stETH = parsedCache.stethAmount;
      }
      if (parsedCache.linkAmount !== undefined) {
        assetAmounts.LINK = parsedCache.linkAmount;
      }
      if (parsedCache.stethPrice !== undefined) {
        prices.stETH = parsedCache.stethPrice;
      }
      if (parsedCache.linkPrice !== undefined) {
        prices.LINK = parsedCache.linkPrice;
      }

      const convertedCache: TVLCache = {
        totalValueLockedUSD: parsedCache.totalValueLockedUSD,
        timestamp: parsedCache.timestamp,
        networkEnvironment: parsedCache.networkEnvironment || 'mainnet',
        assetAmounts,
        prices
      };

      return convertedCache;
    }

    return parsedCache as TVLCache;
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

// Local depositor adjustment cache management functions
const getLocalDepositorAdjustment = (networkEnv: string): LocalDepositorAdjustment | null => {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(LOCAL_DEPOSITOR_ADJUSTMENT_KEY);
    if (!cached) return null;

    const parsedCache: LocalDepositorAdjustment = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is still valid (not expired) and for correct network
    if (now - parsedCache.timestamp > CACHE_EXPIRY_MS || parsedCache.networkEnv !== networkEnv) {
      localStorage.removeItem(LOCAL_DEPOSITOR_ADJUSTMENT_KEY);
      return null;
    }

    return parsedCache;
  } catch (error) {
    console.warn('Error reading local depositor adjustment cache:', error);
    return null;
  }
};

const setLocalDepositorAdjustment = (cache: LocalDepositorAdjustment): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_DEPOSITOR_ADJUSTMENT_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn('Error saving local depositor adjustment cache:', error);
  }
};

const incrementLocalDepositorCount = (networkEnv: string): void => {
  const currentAdjustment = getLocalDepositorAdjustment(networkEnv);
  const newAdjustment: LocalDepositorAdjustment = {
    networkEnv,
    localIncrement: (currentAdjustment?.localIncrement || 0) + 1,
    timestamp: Date.now()
  };
  setLocalDepositorAdjustment(newAdjustment);
  console.log(`🔄 [FRONTEND] Locally incremented active depositors count for ${networkEnv}: +1 (total local increment: ${newAdjustment.localIncrement})`);
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
// Export the function for external use when user makes first deposit
export { incrementLocalDepositorCount };

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

  // State for daily emissions from server-side API
  const [dailyEmissions, setDailyEmissions] = useState<number | null>(null);
  const [isLoadingDailyEmissions, setIsLoadingDailyEmissions] = useState<boolean>(false);
  const [dailyEmissionsError, setDailyEmissionsError] = useState<string | null>(null);


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

    // Check cache first for immediate UI update, but always fetch fresh data
    const cachedData = getCachedActiveStakers(poolData.networkEnvironment);
    if (cachedData) {
      console.log(`📦 [FRONTEND] Using cached active stakers data as initial state for ${poolData.networkEnvironment}:`, cachedData.activeStakers, '(fetching fresh data...)');
      setActiveStakersCount(cachedData.activeStakers);
      setActiveStakersError(null);
      setRetryAttempts(0);
      // Don't return - continue to fetch fresh data
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

  // Fetch daily emissions from server-side API
  useEffect(() => {
    // Skip if running on server (SSR)
    if (typeof window === 'undefined') {
      return;
    }

    // Skip if no network environment is set
    if (!poolData.networkEnvironment) {
      return;
    }

    async function fetchDailyEmissions(): Promise<void> {
      setIsLoadingDailyEmissions(true);
      setDailyEmissionsError(null);

      try {
        console.log(`💰 [FRONTEND] Fetching daily emissions for ${poolData.networkEnvironment} from server API`);

        const response = await fetch(`/api/daily-emissions?networkEnv=${poolData.networkEnvironment}`);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success && typeof data.dailyEmissions === 'number') {
          setDailyEmissions(data.dailyEmissions);
          setDailyEmissionsError(null);
          console.log(`✅ [FRONTEND] Daily emissions fetched and set:`, data.dailyEmissions);
        } else {
          console.log('❌ [FRONTEND] API returned failure:', data.error || 'Invalid response format');
          throw new Error(data.error || 'Invalid response format');
        }
      } catch (error) {
        console.error(`💥 [FRONTEND] Error fetching daily emissions:`);
        console.error('  - Error type:', typeof error);
        console.error('  - Error message:', error instanceof Error ? error.message : String(error));
        console.error('  - Network environment:', poolData.networkEnvironment);

        setDailyEmissionsError('Failed to fetch daily emissions data');
        setDailyEmissions(null);
      } finally {
        setIsLoadingDailyEmissions(false);
      }
    }

    // Add a small delay to ensure everything is properly initialized
    const timeoutId = setTimeout(() => fetchDailyEmissions(), 100);

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
      // Apply local adjustment for new depositors
      const localAdjustment = getLocalDepositorAdjustment(poolData.networkEnvironment || 'mainnet');
      const adjustedCount = activeStakersCount + (localAdjustment?.localIncrement || 0);

      if (localAdjustment && localAdjustment.localIncrement > 0) {
        console.log(`🔄 [FRONTEND] Applied local adjustment to active stakers: ${activeStakersCount} + ${localAdjustment.localIncrement} = ${adjustedCount}`);
      }

      return adjustedCount.toString();
    } else if (isLoadingActiveStakers) {
      // Show retry attempt info during loading if retries are happening
      return retryAttempts > 1 ? `... (${retryAttempts}/${MAX_RETRY_ATTEMPTS})` : "...";
    } else if (activeStakersError) {
      return "Error"; // Error state - only shown after all retries fail
    }

    // Fallback if no network environment is set
    return "N/A";
  }, [activeStakersCount, isLoadingActiveStakers, activeStakersError, retryAttempts, poolData.networkEnvironment]);

  // Get supported assets for the current network
  const supportedAssets = useMemo(() => {
    return getSupportedAssetSymbols(poolData.networkEnvironment || 'mainnet');
  }, [poolData.networkEnvironment]);

  // Calculate core metrics from live pool data (excluding active stakers to avoid blocking)
  const coreMetrics = useMemo(() => {
    // Core metrics loading (DON'T include active stakers loading to avoid blocking chart)
    const isLoading = supportedAssets.some(assetSymbol => poolData.assets[assetSymbol]?.isLoading) || isPriceUpdating || isLoadingDailyEmissions;
    // Core metrics errors (DON'T include active stakers errors - they're non-critical)
    const hasError = supportedAssets.some(assetSymbol => poolData.assets[assetSymbol]?.error) || !!dailyEmissionsError;

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
      const errorDetails = supportedAssets.reduce((acc, assetSymbol) => {
        acc[assetSymbol] = poolData.assets[assetSymbol]?.error?.message;
        return acc;
      }, {} as Record<AssetSymbol, string | undefined>);

      const availableData = supportedAssets.reduce((acc, assetSymbol) => {
        acc[assetSymbol] = {
          totalStaked: poolData.assets[assetSymbol]?.totalStaked,
          apy: poolData.assets[assetSymbol]?.apy
        };
        return acc;
      }, {} as Record<AssetSymbol, { totalStaked?: string; apy?: string }>);

      console.warn('⚠️ Partial error in capital metrics, attempting calculation with available data:', {
        errors: errorDetails,
        availableData,
        prices: { stethPrice, linkPrice }
      });

      // Only return error state if we have NO usable data at all
      const hasAnyData = supportedAssets.some(assetSymbol =>
        poolData.assets[assetSymbol]?.totalStaked &&
        poolData.assets[assetSymbol]?.totalStaked !== '0'
      );

      if (!hasAnyData) {
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

    // Calculate Total Value Locked in USD dynamically for all supported assets
    let totalValueLockedUSD = 0;
    const assetAmounts: Record<AssetSymbol, number> = {} as Record<AssetSymbol, number>;
    const assetUSDValues: Record<AssetSymbol, number> = {} as Record<AssetSymbol, number>;

    supportedAssets.forEach(assetSymbol => {
      const assetData = poolData.assets[assetSymbol];
      if (!assetData) return;

      const amount = parsePoolAmount(assetData.totalStaked || '0');
      assetAmounts[assetSymbol] = amount;

      // Calculate USD value based on asset type
      let usdValue = 0;
      if (assetSymbol === 'stETH' && stethPrice && amount > 0) {
        usdValue = amount * stethPrice;
      } else if (assetSymbol === 'LINK' && linkPrice && amount > 0) {
        usdValue = amount * linkPrice;
      } else if ((assetSymbol === 'USDC' || assetSymbol === 'USDT') && amount > 0) {
        // Stablecoins are always $1.00
        usdValue = amount * 1.0;
      }
      // For other assets (wBTC, wETH), we would need their price data

      assetUSDValues[assetSymbol] = usdValue;
      totalValueLockedUSD += usdValue;
    });

    totalValueLockedUSD = Math.floor(totalValueLockedUSD);

    // Log calculation details for debugging
    console.log('💰 TVL Calculation Debug:', {
      supportedAssets,
      assetAmounts,
      assetUSDValues,
      totalValueLockedUSD,
      networkEnv: poolData.networkEnvironment
    });

    // Calculate average APY (weighted by USD value) dynamically
    let avgApy = 0;
    if (totalValueLockedUSD > 0) {
      let weightedApySum = 0;

      supportedAssets.forEach(assetSymbol => {
        const assetData = poolData.assets[assetSymbol];
        if (!assetData || !assetUSDValues[assetSymbol]) return;

        // Skip assets with no APY data or 'N/A' values
        if (!assetData.apy || assetData.apy === 'N/A' || assetData.apy === 'Coming Soon') {
          return;
        }

        const apyNum = parseFloat((assetData.apy || '0%').replace('%', ''));
        if (isNaN(apyNum) || apyNum <= 0) return;

        const weight = assetUSDValues[assetSymbol] / totalValueLockedUSD;

        weightedApySum += apyNum * weight;
      });

      avgApy = weightedApySum;
    }

    // Calculate LIVE daily MOR emissions from server-side API (both networks) dynamically
    // ✅ REAL daily MOR emissions from RewardPool.getPeriodRewards() contract call via API
    const currentDailyRewardMOR = (() => {
      // Use REAL daily emissions from server-side API instead of direct contract call
      const realDailyEmissions = dailyEmissions;

      console.log('💰 DAILY EMISSIONS METRIC DATA:', {
        realDailyEmissions,
        hasData: realDailyEmissions !== null,
        source: 'Server-side API (RewardPool.getPeriodRewards())',
        networkEnvironment: poolData.networkEnvironment,
        isLoading: isLoadingDailyEmissions,
        error: dailyEmissionsError
      });

      if (realDailyEmissions === null || realDailyEmissions <= 0) {
        if (isLoadingDailyEmissions) {
          return "..."; // Show loading state
        } else if (dailyEmissionsError) {
          return "Error"; // Show error state
        } else {
          return "N/A"; // No data available
        }
      }

      // Format for display
      return realDailyEmissions < 1000
        ? realDailyEmissions.toFixed(0)
        : Math.round(realDailyEmissions).toLocaleString();
    })();

    // Save successful calculation to cache
    if (totalValueLockedUSD > 0) {
      // Cache data for all supported assets with available price data
      const prices: Record<string, number> = {};
      let hasAnyPriceData = false;

      // Collect available price data
      if (stethPrice) {
        prices.stETH = stethPrice;
        hasAnyPriceData = true;
      }
      if (linkPrice) {
        prices.LINK = linkPrice;
        hasAnyPriceData = true;
      }
      // Always include stablecoin prices
      prices.USDC = 1.0;
      prices.USDT = 1.0;
      hasAnyPriceData = true;

      if (hasAnyPriceData) {
        const cacheData: TVLCache = {
          totalValueLockedUSD: totalValueLockedUSD.toLocaleString(),
          timestamp: Date.now(),
          networkEnvironment: poolData.networkEnvironment || 'mainnet',
          assetAmounts: { ...assetAmounts }, // Copy all asset amounts
          prices
        };
        setCachedTVL(cacheData);
      }
    }

    // Provide better display values based on data availability
    const totalValueLockedUSDDisplay = (() => {
      if (totalValueLockedUSD > 0) {
        return totalValueLockedUSD.toLocaleString();
      }

      // Check if we have any asset deposits but missing price data
      const hasAnyDeposits = supportedAssets.some(assetSymbol => assetAmounts[assetSymbol] > 0);
      const hasAllPrices = supportedAssets.every(assetSymbol => {
        if (assetSymbol === 'stETH') return !!stethPrice;
        if (assetSymbol === 'LINK') return !!linkPrice;
        if (assetSymbol === 'USDC' || assetSymbol === 'USDT') return true; // Stablecoins always have price
        // For other assets (wBTC, wETH), assume no price data available yet
        return false;
      });

      if (hasAnyDeposits && !hasAllPrices) {
        // We have pool deposits but missing price data - try to use cached price
        const cachedTVL = getCachedTVL();
        if (cachedTVL && cachedTVL.networkEnvironment === (poolData.networkEnvironment || 'mainnet')) {
          // Check if cached data has any deposits for supported assets
          const hasCachedDeposits = supportedAssets.some(assetSymbol =>
            (cachedTVL.assetAmounts[assetSymbol] || 0) > 0
          );
          if (hasCachedDeposits) {
            console.log('📦 Using cached TVL data due to missing price data:', cachedTVL);
            return `${cachedTVL.totalValueLockedUSD} (cached)`;
          }
        }
        return "Price loading...";
      }

      // Check if all supported assets have zero deposits
      const allAssetsEmpty = supportedAssets.every(assetSymbol => assetAmounts[assetSymbol] === 0);
      if (allAssetsEmpty) {
        // No deposits in any supported pool
        return "0";
      }

      // Some other issue - try cache
      const cachedTVL = getCachedTVL();
      if (cachedTVL && cachedTVL.networkEnvironment === (poolData.networkEnvironment || 'mainnet')) {
        // Check if cached data has any deposits for supported assets
        const hasCachedDeposits = supportedAssets.some(assetSymbol =>
          (cachedTVL.assetAmounts[assetSymbol] || 0) > 0
        );
        if (hasCachedDeposits) {
          console.log('📦 Using cached TVL data due to calculation error:', cachedTVL);
          return `${cachedTVL.totalValueLockedUSD} (cached)`;
        }
      }
      return "Calculating...";
    })();

    return {
      totalValueLockedUSD: totalValueLockedUSDDisplay,
      currentDailyRewardMOR,
      avgApyRate: `${avgApy.toFixed(2)}%`,
      isLoading,
      error: null
    };
  }, [poolData, stethPrice, linkPrice, isPriceUpdating, supportedAssets, dailyEmissions, dailyEmissionsError, isLoadingDailyEmissions]);

  // Combine core metrics with active stakers display
  const metrics = useMemo(() => ({
    ...coreMetrics,
    activeStakers: activeStakersDisplay
  }), [coreMetrics, activeStakersDisplay]);

  return metrics;
}
