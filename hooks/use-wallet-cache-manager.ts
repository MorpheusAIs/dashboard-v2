"use client";

import { useEffect, useRef } from "react";
import { getCachedPrices, setCachedPrices, type TokenPriceCache } from "@/components/capital/hooks/use-token-prices";
import { getCachedUserAssets } from "@/components/capital/hooks/use-user-assets-cache";

/**
 * Hook to manage cache invalidation when user address changes
 * This ensures that when a user switches wallets, we don't show cached data from the previous wallet
 */
export function useWalletCacheManager(userAddress?: string, networkEnv?: string) {
  const previousUserAddressRef = useRef<string | undefined>(userAddress);

  useEffect(() => {
    const previousUserAddress = previousUserAddressRef.current;
    const currentUserAddress = userAddress;

    // Detect wallet change (including connect/disconnect)
    if (previousUserAddress !== currentUserAddress) {
      console.log('👤 Wallet address changed:', {
        from: previousUserAddress,
        to: currentUserAddress,
        networkEnv
      });

      // If switching to a different wallet (not just disconnecting)
      if (previousUserAddress && currentUserAddress && previousUserAddress !== currentUserAddress) {
        console.log('🧹 Clearing cache data for previous wallet...');
        
        // Clear previous user's asset cache
        if (typeof window !== 'undefined' && networkEnv) {
          try {
            localStorage.removeItem(`morpheus_user_assets_cache_${previousUserAddress}_${networkEnv}`);
            console.log('✅ Previous wallet asset cache cleared');
          } catch (error) {
            console.warn('Error clearing previous wallet cache:', error);
          }
        }

        // Clear price cache for previous user and invalidate current user's cache
        console.log('🔄 Clearing price cache for previous user and invalidating current cache...');
        
        // Clear previous user's price cache
        try {
          localStorage.removeItem(`morpheus_token_prices_${previousUserAddress}`);
          console.log('✅ Previous wallet price cache cleared');
        } catch (error) {
          console.warn('Error clearing previous wallet price cache:', error);
        }

        // Invalidate current user's price cache to force fresh fetch
        const cachedPrices = getCachedPrices(currentUserAddress);
        if (cachedPrices) {
          // Force cache expiry by setting old timestamp
          const expiredCache: TokenPriceCache = {
            ...cachedPrices,
            timestamp: Date.now() - (20 * 60 * 1000), // 20 minutes ago
            lastSuccessfulFetch: Date.now() - (20 * 60 * 1000),
            retryCount: 0 // Reset retry count to allow fresh fetch
          };
          setCachedPrices(expiredCache, currentUserAddress);
          console.log('✅ Current user price cache invalidated - will fetch fresh prices');
        }
      }
      
      // If disconnecting wallet, clear current session data
      if (previousUserAddress && !currentUserAddress) {
        console.log('🚪 Wallet disconnected - clearing session data...');
        // Could clear additional session data here if needed
      }

      // Update the ref for next comparison
      previousUserAddressRef.current = currentUserAddress;
    }
  }, [userAddress, networkEnv]);

  // Utility functions for manual cache management
  const clearAllUserCache = (targetUserAddress: string, targetNetworkEnv: string) => {
    if (typeof window === 'undefined') return;
    
    try {
      // Clear user-specific asset cache
      localStorage.removeItem(`morpheus_user_assets_cache_${targetUserAddress}_${targetNetworkEnv}`);
      
      // Clear user-specific price cache
      localStorage.removeItem(`morpheus_token_prices_${targetUserAddress}`);
      
      // Force refresh of current price cache if it exists
      const cachedPrices = getCachedPrices(targetUserAddress);
      if (cachedPrices) {
        const expiredCache: TokenPriceCache = {
          ...cachedPrices,
          timestamp: Date.now() - (20 * 60 * 1000), // Force expiry
          lastSuccessfulFetch: Date.now() - (20 * 60 * 1000),
          retryCount: 0
        };
        setCachedPrices(expiredCache, targetUserAddress);
      }
      
      console.log('✅ All user cache data cleared for:', targetUserAddress);
    } catch (error) {
      console.warn('Error clearing user cache:', error);
    }
  };

  const debugCacheState = () => {
    if (typeof window === 'undefined' || !userAddress || !networkEnv) return;
    
    const priceCache = getCachedPrices(userAddress);
    const userCache = getCachedUserAssets(userAddress, networkEnv);
    
    console.log('🔍 Cache Debug Info:', {
      userAddress,
      networkEnv,
      priceCache: {
        exists: !!priceCache,
        timestamp: priceCache?.timestamp,
        stethPrice: priceCache?.prices?.stETH,
        retryCount: priceCache?.retryCount,
        age: priceCache ? (Date.now() - priceCache.timestamp) / 1000 / 60 : 'N/A'
      },
      userCache: {
        exists: !!userCache,
        timestamp: userCache?.timestamp,
        stakedValue: userCache?.metricsData?.stakedValue,
        age: userCache ? (Date.now() - userCache.timestamp) / 1000 / 60 : 'N/A'
      }
    });
  };

  return {
    clearAllUserCache,
    debugCacheState
  };
}
