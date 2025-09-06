"use client";

import { useState, useEffect, useMemo } from "react";
import { useCapitalPoolData } from "@/hooks/use-capital-pool-data";
import { getTokenPrice } from "@/app/services/token-price.service";
import { getCachedPrices, setCachedPrices, shouldRetryPriceFetch, type TokenPriceCache } from "@/components/capital/user-assets-panel";

// Cache for last known good TVL data
interface TVLCache {
  totalValueLockedUSD: string;
  timestamp: number;
  stethAmount: number;
  linkAmount: number;
  stethPrice: number;
  linkPrice: number;
}

const TVL_CACHE_KEY = 'morpheus_tvl_cache';
const CACHE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

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
  
  // State for token prices from CoinGecko
  const [stethPrice, setStethPrice] = useState<number | null>(null);
  const [linkPrice, setLinkPrice] = useState<number | null>(null);
  const [isLoadingPrices, setIsLoadingPrices] = useState<boolean>(true);
  const [priceError, setPriceError] = useState<string | null>(null);

  // State for active stakers from Dune API (both testnet and mainnet)
  const [activeStakersCount, setActiveStakersCount] = useState<number | null>(null);
  const [isLoadingActiveStakers, setIsLoadingActiveStakers] = useState<boolean>(false);
  const [activeStakersError, setActiveStakersError] = useState<string | null>(null);

  // Fetch token prices from shared cache or CoinGecko with retry logic
  useEffect(() => {
    async function fetchTokenPricesWithCache() {
      // Always try to load cached prices first
      const cachedPrices = getCachedPrices();
      if (cachedPrices) {
        console.log('💰 [Metrics] Loading cached token prices:', cachedPrices);
        setStethPrice(cachedPrices.stethPrice);
        setLinkPrice(cachedPrices.linkPrice);
        setIsLoadingPrices(false);
        
        // Don't fetch if we've hit retry limit
        if (!shouldRetryPriceFetch(cachedPrices)) {
          console.log('💰 [Metrics] Using cached prices due to retry limit');
          return;
        }
      } else {
        setIsLoadingPrices(true);
      }
      
      setPriceError(null);
      
      try {
        const [stethPriceData, linkPriceData] = await Promise.all([
          getTokenPrice('staked-ether', 'usd'), // stETH/Lido token ID
          getTokenPrice('chainlink', 'usd')     // LINK token ID
        ]);
        
        setStethPrice(stethPriceData);
        setLinkPrice(linkPriceData);
        
        // Update shared cache if we got fresh data
        const now = Date.now();
        const updatedCache: TokenPriceCache = {
          stethPrice: stethPriceData,
          linkPrice: linkPriceData,
          morPrice: cachedPrices?.morPrice || null, // Keep existing MOR price
          timestamp: now,
          retryCount: 0,
          lastSuccessfulFetch: now
        };
        setCachedPrices(updatedCache);
        
        console.log('💰 [Metrics] Token prices fetched and cached:', {
          stETH: stethPriceData,
          LINK: linkPriceData
        });
      } catch (error) {
        console.error('Error fetching token prices for metrics:', error);
        
        // Update retry count in cache
        if (cachedPrices) {
          const updatedCache: TokenPriceCache = {
            ...cachedPrices,
            timestamp: Date.now(),
            retryCount: (cachedPrices.retryCount || 0) + 1
          };
          setCachedPrices(updatedCache);
          
          // Use cached prices on error
          setStethPrice(cachedPrices.stethPrice);
          setLinkPrice(cachedPrices.linkPrice);
        } else {
          setPriceError('Failed to fetch token prices');
        }
      } finally {
        setIsLoadingPrices(false);
      }
    }

    fetchTokenPricesWithCache();
  }, []);

  // Fetch active stakers count from Dune API (testnet and mainnet)
  useEffect(() => {
    // Skip if running on server (SSR)
    if (typeof window === 'undefined') {
      return;
    }

    async function fetchActiveStakers() {
      // Skip if no network environment is set
      if (!poolData.networkEnvironment) {
        return;
      }

      setIsLoadingActiveStakers(true);
      setActiveStakersError(null);
      
      try {
        // Determine which endpoint to call based on network environment
        const endpoint = poolData.networkEnvironment === 'testnet' 
          ? '/api/dune/active-stakers-testnet'
          : '/api/dune/active-stakers-mainnet';
        
        console.log(`🔍 [FRONTEND] Fetching active stakers for ${poolData.networkEnvironment} from ${endpoint}`);
        
        const response = await fetch(endpoint);
        
        const data = await response.json();
        
        if (data.success) {
          setActiveStakersCount(data.active_stakers);
          console.log(`✅ [FRONTEND] Active stakers count set (${data.network}):`, data.active_stakers);
        } else {
          console.log('❌ [FRONTEND] API returned failure:', data.error);
          throw new Error(data.error || 'Failed to fetch active stakers');
        }
      } catch (error) {
        console.error('💥 [FRONTEND] Error details:');
        console.error('  - Error type:', typeof error);
        console.error('  - Error message:', error instanceof Error ? error.message : String(error));
        console.error('  - Network environment:', poolData.networkEnvironment);
        
        setActiveStakersError('Failed to fetch active stakers data');
        setActiveStakersCount(null);
      } finally {
        setIsLoadingActiveStakers(false);
      }
    }

    // Add a small delay to ensure everything is properly initialized
    const timeoutId = setTimeout(fetchActiveStakers, 100);
    
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
      return "..."; // Loading indicator
    } else if (activeStakersError) {
      return "Error"; // Error state
    }
    
    // Fallback if no network environment is set
    return "N/A";
  }, [poolData.networkEnvironment, activeStakersCount, isLoadingActiveStakers, activeStakersError]);

  // Calculate core metrics from live pool data (excluding active stakers to avoid blocking)
  const coreMetrics = useMemo(() => {
    // Core metrics loading (DON'T include active stakers loading to avoid blocking chart)
    const isLoading = poolData.stETH.isLoading || poolData.LINK.isLoading || isLoadingPrices;
    // Core metrics errors (DON'T include active stakers errors - they're non-critical)
    const hasError = poolData.stETH.error || poolData.LINK.error || priceError;

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
        priceError,
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
  }, [poolData, stethPrice, linkPrice, isLoadingPrices, priceError]);

  // Combine core metrics with active stakers display
  const metrics = useMemo(() => ({
    ...coreMetrics,
    activeStakers: activeStakersDisplay
  }), [coreMetrics, activeStakersDisplay]);

  return metrics;
}
