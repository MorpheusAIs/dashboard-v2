"use client";

import { useState, useEffect, useTransition } from "react";
import { getTokenPrice, updateSharedPrices } from "@/app/services/token-price.service";
import {
  type NetworkEnvironment,
  type AssetSymbol,
  getAssetsForNetwork
} from "../constants/asset-config";

export interface TokenPriceCache {
  // Dynamic prices for all assets
  prices: Record<AssetSymbol, number | null>;
  morPrice: number | null;
  timestamp: number;
  retryCount: number;
  lastSuccessfulFetch: number;
  
  // Legacy fields for backward compatibility
  stethPrice: number | null;
  linkPrice: number | null;
}

const TOKEN_PRICE_CACHE_KEY = 'morpheus_token_prices';
const PRICE_CACHE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const PRICE_RETRY_EXPIRY_MS = 2 * 60 * 1000; // 2 minutes before allowing retry
export const MAX_PRICE_RETRIES = 3;

// Helper to get user-specific cache key for better isolation
const getUserPriceCacheKey = (userAddress?: string): string => {
  // Use global key if no user address (for anonymous access)
  // Otherwise use user-specific key to prevent cross-user contamination
  return userAddress ? `${TOKEN_PRICE_CACHE_KEY}_${userAddress}` : TOKEN_PRICE_CACHE_KEY;
};

// Cache management functions with user-specific support
export const getCachedPrices = (userAddress?: string): TokenPriceCache | null => {
  if (typeof window === 'undefined') return null;
  try {
    const cacheKey = getUserPriceCacheKey(userAddress);
    const cached = localStorage.getItem(cacheKey);
    
    // If user-specific cache doesn't exist, try global cache for fallback
    const fallbackCache = userAddress && !cached ? localStorage.getItem(TOKEN_PRICE_CACHE_KEY) : null;
    const cacheToUse = cached || fallbackCache;
    
    if (!cacheToUse) return null;

    const parsedCache: TokenPriceCache = JSON.parse(cacheToUse);
    
    // If we used fallback cache, log it
    if (fallbackCache && !cached && userAddress) {
      console.log('💰 Using global price cache as fallback for user:', userAddress.slice(0, 6));
    }
    
    return parsedCache;
  } catch (error) {
    console.warn('Error reading token prices cache:', error);
    return null;
  }
};

export const setCachedPrices = (cache: TokenPriceCache, userAddress?: string): void => {
  if (typeof window === 'undefined') return;
  try {
    const cacheKey = getUserPriceCacheKey(userAddress);
    localStorage.setItem(cacheKey, JSON.stringify(cache));
    
    // Also update global cache for fallback purposes (with rate limiting to avoid spam)
    const globalCache = localStorage.getItem(TOKEN_PRICE_CACHE_KEY);
    if (!globalCache || (cache.lastSuccessfulFetch > 0 && Math.random() < 0.1)) {
      localStorage.setItem(TOKEN_PRICE_CACHE_KEY, JSON.stringify(cache));
    }
  } catch (error) {
    console.warn('Error saving token prices cache:', error);
  }
};

export const shouldRetryPriceFetch = (cachedPrices: TokenPriceCache | null): boolean => {
  if (!cachedPrices) return true;

  const now = Date.now();
  const timeSinceLastTry = now - cachedPrices.timestamp;
  const timeSinceLastSuccess = now - cachedPrices.lastSuccessfulFetch;
  const cacheExpired = timeSinceLastSuccess > PRICE_CACHE_EXPIRY_MS;
  const hasReachedMaxRetries = cachedPrices.retryCount >= MAX_PRICE_RETRIES;
  const shouldRetryAfterCooldown = timeSinceLastTry > PRICE_RETRY_EXPIRY_MS;

  return (cacheExpired || !hasReachedMaxRetries) && shouldRetryAfterCooldown;
};

interface UseTokenPricesOptions {
  isInitialLoad: boolean;
  shouldRefreshData: boolean;
  userAddress?: string;
  networkEnv: string;
}

export function useTokenPrices({
  isInitialLoad,
  shouldRefreshData,
  userAddress,
  networkEnv
}: UseTokenPricesOptions) {
  // Dynamic price state for all assets - initialize stablecoins to $1.00
  const [prices, setPrices] = useState<Record<AssetSymbol, number | null>>({
    stETH: null,
    LINK: null,
    USDC: 1.0, // Stablecoin - always $1.00
    USDT: 1.0, // Stablecoin - always $1.00
    wBTC: null,
    wETH: null,
  });
  const [morPrice, setMorPrice] = useState<number | null>(null);
  const [isPriceUpdating, startPriceTransition] = useTransition();

  // Legacy getters for backward compatibility
  const stethPrice = prices.stETH;
  const linkPrice = prices.LINK;

  // Load cached prices on mount
  useEffect(() => {
    const cachedPrices = getCachedPrices(userAddress);
    if (cachedPrices) {
      console.log('💰 Loading cached token prices:', {
        ...cachedPrices,
        userAddress: userAddress?.slice(0, 6) || 'anonymous'
      });

      // Load dynamic prices if available, but preserve stablecoin prices
      if (cachedPrices.prices) {
        setPrices(prev => ({
          ...prev,
          ...cachedPrices.prices,
          // Always ensure stablecoins are $1.00 regardless of cache
          USDC: 1.0,
          USDT: 1.0,
        }));
      } else {
        // Fallback to legacy cache structure
        setPrices(prev => ({
          ...prev,
          stETH: cachedPrices.stethPrice,
          LINK: cachedPrices.linkPrice,
          // Preserve stablecoin prices
          USDC: 1.0,
          USDT: 1.0,
        }));
      }
      setMorPrice(cachedPrices.morPrice);

      // Update shared state with cached prices
      if (cachedPrices.prices || cachedPrices.stethPrice || cachedPrices.morPrice) {
        updateSharedPrices({
          stETH: cachedPrices.stethPrice || cachedPrices.prices?.stETH || null,
          wBTC: cachedPrices.prices?.wBTC || null,
          wETH: cachedPrices.prices?.wETH || null,
          LINK: cachedPrices.linkPrice || cachedPrices.prices?.LINK || null,
          MOR: cachedPrices.morPrice || null,
        });
      }
    }
  }, [userAddress]);

  // Fetch token prices with robust retry and fallback logic
  useEffect(() => {
    // Only fetch if it's initial load or data refresh is needed
    if (!isInitialLoad && !shouldRefreshData) return;
    // Allow fetching prices even when userAddress is not available for anonymous access
    // This ensures TVL calculations work properly even when wallet is not connected

    async function fetchTokenPricesWithRetry() {
      const cachedPrices = getCachedPrices(userAddress);

      // Check if we should attempt a fresh fetch or use cache
      if (cachedPrices && !shouldRetryPriceFetch(cachedPrices)) {
        console.log('💰 Using cached prices due to retry limit or cooldown:', {
          retryCount: cachedPrices.retryCount,
          maxRetries: MAX_PRICE_RETRIES,
          timeSinceLastTry: Date.now() - cachedPrices.timestamp,
          userAddress: userAddress?.slice(0, 6) || 'anonymous'
        });

        // Use cached prices and reset loading flags
        startPriceTransition(() => {
          setPrices(prev => ({
            ...prev,
            stETH: cachedPrices.stethPrice,
            LINK: cachedPrices.linkPrice,
            // Always ensure stablecoins are $1.00
            USDC: 1.0,
            USDT: 1.0,
          }));
          setMorPrice(cachedPrices.morPrice);
        });

        // Update shared state
        updateSharedPrices({
          stETH: cachedPrices.stethPrice || null,
          wBTC: cachedPrices.prices?.wBTC || null,
          wETH: cachedPrices.prices?.wETH || null,
          LINK: cachedPrices.linkPrice || null,
          MOR: cachedPrices.morPrice || null,
        });

        return;
      }

      try {
        console.log('💰 Attempting to fetch fresh token prices...', {
          retryCount: cachedPrices?.retryCount || 0,
          maxRetries: MAX_PRICE_RETRIES
        });

        // Get all available assets and fetch prices dynamically
        const networkEnvironment: NetworkEnvironment = networkEnv as NetworkEnvironment;
        const availableAssets = getAssetsForNetwork(networkEnvironment);

        // Create price fetch promises for all available assets
        const assetPricePromises = availableAssets.map(async (assetInfo) => {
          try {
            const price = await getTokenPrice(assetInfo.metadata.coinGeckoId, 'usd');
            return { symbol: assetInfo.metadata.symbol, price };
          } catch (error) {
            console.warn(`Failed to fetch price for ${assetInfo.metadata.symbol}:`, error);
            return { symbol: assetInfo.metadata.symbol, price: null };
          }
        });

        // Fetch MOR price separately (from CoinGecko via server cache)
        const morPricePromise = getTokenPrice('morpheusai', 'usd');

        const [assetPriceResults, morPriceData] = await Promise.all([
          Promise.all(assetPricePromises),
          morPricePromise
        ]);

        // Build dynamic prices object - initialize stablecoins to $1.00
        const newPrices: Record<AssetSymbol, number | null> = {
          stETH: null,
          LINK: null,
          USDC: 1.0, // Always $1.00 for stablecoin
          USDT: 1.0, // Always $1.00 for stablecoin
          wBTC: null,
          wETH: null,
        };

        // Update prices from API results (but skip stablecoins as they're already set)
        assetPriceResults.forEach(({ symbol, price }) => {
          if (symbol !== 'USDC' && symbol !== 'USDT') {
            newPrices[symbol] = price;
          }
        });

        // Fallback: if some core tokens are still null, merge from server cache API
        const coreSymbols: AssetSymbol[] = ['stETH', 'wBTC', 'wETH', 'LINK'];
        if (coreSymbols.some(sym => newPrices[sym] == null)) {
          try {
            const resp = await fetch('/api/token-prices', {
              headers: { 'Accept': 'application/json' },
              cache: 'no-store',
              signal: AbortSignal.timeout(5000),
            });
            if (resp.ok) {
              const data = await resp.json();
              coreSymbols.forEach(sym => {
                const v = data?.prices?.[sym];
                if (typeof v === 'number' && v > 0) newPrices[sym] = v;
              });
            }
          } catch {}
        }

        // Update shared state with fresh prices
        updateSharedPrices({
          stETH: newPrices.stETH,
          wBTC: newPrices.wBTC,
          wETH: newPrices.wETH,
          LINK: newPrices.LINK,
          MOR: morPriceData,
        });

        // Save successful prices to cache
        const now = Date.now();
        const newCache: TokenPriceCache = {
          prices: newPrices,
          morPrice: morPriceData,
          // Legacy fields for backward compatibility
          stethPrice: newPrices.stETH,
          linkPrice: newPrices.LINK,
          timestamp: now,
          retryCount: 0, // Reset retry count on success
          lastSuccessfulFetch: now
        };
        setCachedPrices(newCache, userAddress);

        // Use transition to prevent UI blocking during price updates
        startPriceTransition(() => {
          setPrices(newPrices);
          setMorPrice(morPriceData);
        });

        console.log('💰 Token prices fetched and cached successfully:', {
          ...newPrices,
          MOR: morPriceData
        });

      } catch (error) {
        console.error('Error fetching token prices:', error);

        // Increment retry count and update cache
        const now = Date.now();
        const newRetryCount = (cachedPrices?.retryCount || 0) + 1;

        if (cachedPrices) {
          const updatedCache: TokenPriceCache = {
            ...cachedPrices,
            timestamp: now,
            retryCount: newRetryCount
          };
          setCachedPrices(updatedCache, userAddress);

          // Use cached prices as fallback, but preserve stablecoin prices
          const fallbackPrices = cachedPrices.prices || {
            stETH: cachedPrices.stethPrice,
            LINK: cachedPrices.linkPrice,
            USDC: 1.0, // Always $1.00 for stablecoin
            USDT: 1.0, // Always $1.00 for stablecoin
            wBTC: null,
            wETH: null,
          };

          // Ensure stablecoins are always $1.00 even in fallback
          fallbackPrices.USDC = 1.0;
          fallbackPrices.USDT = 1.0;

          console.log('💰 Using cached prices as fallback after error:', {
            ...fallbackPrices,
            MOR: cachedPrices.morPrice,
            newRetryCount
          });

          // Update shared state with fallback prices
          updateSharedPrices({
            stETH: fallbackPrices.stETH,
            wBTC: fallbackPrices.wBTC,
            wETH: fallbackPrices.wETH,
            LINK: fallbackPrices.LINK,
            MOR: cachedPrices.morPrice,
          });

          startPriceTransition(() => {
            setPrices(fallbackPrices);
            setMorPrice(cachedPrices.morPrice);
          });
        } else {
          // No cache available, create empty cache with retry count (but preserve stablecoin prices)
          const errorCache: TokenPriceCache = {
            prices: {
              stETH: null,
              LINK: null,
              USDC: 1.0, // Always $1.00 for stablecoin
              USDT: 1.0, // Always $1.00 for stablecoin
              wBTC: null,
              wETH: null,
            },
            stethPrice: null,
            linkPrice: null,
            morPrice: null,
            timestamp: now,
            retryCount: newRetryCount,
            lastSuccessfulFetch: 0
          };
          setCachedPrices(errorCache, userAddress);

          // Set stablecoin prices in state even when there's no cache
          startPriceTransition(() => {
            setPrices(prev => ({
              ...prev,
              USDC: 1.0,
              USDT: 1.0,
            }));
          });

          // Update shared state with empty values
          updateSharedPrices({
            stETH: null,
            wBTC: null,
            wETH: null,
            LINK: null,
            MOR: null,
          });
        }
      }
    }

    // Safety timeout to reset refresh flag in case of hangs
    const safetyTimeout = setTimeout(() => {
      if (shouldRefreshData) {
        console.warn('⚠️ Price refresh timeout, this should be handled by parent component');
      }
    }, 15000); // 15 second timeout

    fetchTokenPricesWithRetry();

    return () => clearTimeout(safetyTimeout);
  }, [isInitialLoad, shouldRefreshData, userAddress, networkEnv, startPriceTransition]);

  return {
    // Legacy exports for backward compatibility
    stethPrice,
    linkPrice,
    morPrice,
    isPriceUpdating,
    // Dynamic prices for all assets
    prices,
    // Helper to get price for any asset
    getAssetPrice: (symbol: AssetSymbol) => prices[symbol],
    // Individual asset price getters for clean access
    usdcPrice: prices.USDC,
    usdtPrice: prices.USDT,
    wbtcPrice: prices.wBTC,
    wethPrice: prices.wETH,
  };
}
