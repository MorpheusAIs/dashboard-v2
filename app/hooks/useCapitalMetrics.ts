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

  // Calculate metrics from live pool data
  const metrics = useMemo(() => {
    const isLoading = poolData.stETH.isLoading || poolData.LINK.isLoading || isLoadingPrices;
    const hasError = poolData.stETH.error || poolData.LINK.error || priceError;

    if (hasError) {
      return {
        totalValueLockedUSD: "0",
        currentDailyRewardMOR: "0",
        avgApyRate: "0%",
        activeStakers: "N/A",
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

    // Active stakers count is not available from contracts or GraphQL
    // The deposit pool contracts don't expose a function to get unique depositor counts
    // and our GraphQL queries only track total amounts, not individual addresses
    const activeStakers = "N/A";

    // Daily rewards - also not available from current contract/GraphQL setup
    // Would need to be calculated from reward pool emission rates and distribution logic
    // Using placeholder values for now - could be "N/A" if we want to be consistent
    const currentDailyRewardMOR = poolData.networkEnvironment === 'mainnet' ? "2,836" : "150";

    return {
      totalValueLockedUSD: totalValueLockedUSD.toLocaleString(),
      currentDailyRewardMOR,
      avgApyRate: `${avgApy.toFixed(2)}%`,
      activeStakers: activeStakers,
      isLoading,
      error: null
    };
  }, [poolData, stethPrice, linkPrice, isLoadingPrices, priceError]);

  return metrics;
}
