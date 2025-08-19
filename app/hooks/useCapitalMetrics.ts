"use client";

import { useState, useEffect, useMemo } from "react";
import { useCapitalPoolData } from "@/hooks/use-capital-pool-data";
import { getTokenPrice } from "@/app/services/token-price.service";

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
 * Shows live data from mainnet when on mainnet/arbitrum/base networks
 * Shows testnet data when on sepolia/arbitrum sepolia networks
 */
export function useCapitalMetrics(): CapitalMetrics {
  const poolData = useCapitalPoolData();
  
  // State for token prices from CoinGecko
  const [stethPrice, setStethPrice] = useState<number | null>(null);
  const [linkPrice, setLinkPrice] = useState<number | null>(null);
  const [isLoadingPrices, setIsLoadingPrices] = useState<boolean>(true);
  const [priceError, setPriceError] = useState<string | null>(null);

  // State for active stakers from Dune API (testnet only)
  const [activeStakersCount, setActiveStakersCount] = useState<number | null>(null);
  const [isLoadingActiveStakers, setIsLoadingActiveStakers] = useState<boolean>(false);
  const [activeStakersError, setActiveStakersError] = useState<string | null>(null);

  // Fetch token prices from CoinGecko
  useEffect(() => {
    async function fetchTokenPrices() {
      setIsLoadingPrices(true);
      setPriceError(null);
      
      try {
        const [stethPriceData, linkPriceData] = await Promise.all([
          getTokenPrice('staked-ether', 'usd'), // stETH/Lido token ID
          getTokenPrice('chainlink', 'usd')     // LINK token ID
        ]);
        
        setStethPrice(stethPriceData);
        setLinkPrice(linkPriceData);
        
        console.log('💰 Token prices fetched for metrics:', {
          stETH: stethPriceData,
          LINK: linkPriceData
        });
      } catch (error) {
        console.error('Error fetching token prices for metrics:', error);
        setPriceError('Failed to fetch token prices');
      } finally {
        setIsLoadingPrices(false);
      }
    }

    fetchTokenPrices();
  }, []);

  // Fetch active stakers count from Dune API (testnet only)
  useEffect(() => {
    // Skip if running on server (SSR)
    if (typeof window === 'undefined') {
      return;
    }

    async function fetchActiveStakers() {
      // Only fetch for testnet networks (sepolia, arbitrum sepolia)
      if (poolData.networkEnvironment !== 'testnet') {
        return;
      }

      setIsLoadingActiveStakers(true);
      setActiveStakersError(null);
      
      try {
        console.log('🌐 [FRONTEND] Calling active stakers API...');
        const response = await fetch('/api/dune/active-stakers-testnet');
        console.log('📡 [FRONTEND] API response status:', response.status, response.statusText);
        
        const data = await response.json();
        console.log('📦 [FRONTEND] API response data:', JSON.stringify(data, null, 2));
        
        if (data.success) {
          setActiveStakersCount(data.active_stakers);
          console.log('✅ [FRONTEND] Active stakers count set:', data.active_stakers);
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
    if (poolData.networkEnvironment === 'testnet') {
      // For testnet (Sepolia, Arbitrum Sepolia), use Dune API data
      if (activeStakersCount !== null && activeStakersCount >= 0) {
        return activeStakersCount.toString();
      } else if (isLoadingActiveStakers) {
        return "..."; // Loading indicator
      } else if (activeStakersError) {
        return "Error"; // Error state
      }
    }
    // For mainnet, contracts don't expose unique depositor counts
    return "N/A";
  }, [poolData.networkEnvironment, activeStakersCount, isLoadingActiveStakers, activeStakersError]);

  // Calculate core metrics from live pool data (excluding active stakers to avoid blocking)
  const coreMetrics = useMemo(() => {
    // Core metrics loading (DON'T include active stakers loading to avoid blocking chart)
    const isLoading = poolData.stETH.isLoading || poolData.LINK.isLoading || isLoadingPrices;
    // Core metrics errors (DON'T include active stakers errors - they're non-critical)
    const hasError = poolData.stETH.error || poolData.LINK.error || priceError;

    if (hasError) {
      return {
        totalValueLockedUSD: "0",
        currentDailyRewardMOR: "0",
        avgApyRate: "0%",
        isLoading: false,
        error: hasError.toString()
      };
    }

    // Calculate Total Value Locked in USD
    const stethAmount = parsePoolAmount(poolData.stETH.totalStaked);
    const linkAmount = parsePoolAmount(poolData.LINK.totalStaked);
    
    const stethUSDValue = stethPrice ? stethAmount * stethPrice : 0;
    const linkUSDValue = linkPrice ? linkAmount * linkPrice : 0;
    const totalValueLockedUSD = Math.floor(stethUSDValue + linkUSDValue);

    console.log('📊 TVL Calculation:', {
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

    // Daily rewards - also not available from current contract/GraphQL setup
    // Would need to be calculated from reward pool emission rates and distribution logic
    // Using placeholder values for now - could be "N/A" if we want to be consistent
    const currentDailyRewardMOR = poolData.networkEnvironment === 'mainnet' ? "2,836" : "150";

    return {
      totalValueLockedUSD: totalValueLockedUSD.toLocaleString(),
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
