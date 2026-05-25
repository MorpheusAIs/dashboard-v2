"use client";

import { useState, useEffect, useTransition } from "react";
import { getSharedPrices, updateSharedPrices } from "@/app/services/token-price.service";
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

type ApiPriceSymbol = Exclude<AssetSymbol, 'USDC' | 'USDT'> | 'MOR';

interface TokenPricesApiResponse {
  prices?: Partial<Record<ApiPriceSymbol, unknown>>;
}

interface TokenPriceSnapshot {
  prices: Record<AssetSymbol, number | null>;
  morPrice: number | null;
}

const inFlightPriceFetches: Partial<Record<NetworkEnvironment, Promise<TokenPriceSnapshot>>> = {};

const createDefaultPrices = (): Record<AssetSymbol, number | null> => ({
  stETH: null,
  LINK: null,
  USDC: 1.0,
  USDT: 1.0,
  wBTC: null,
  wETH: null,
});

const parsePositivePrice = (value: unknown): number | null => {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
};

const normalizeCachedPrices = (cachedPrices: TokenPriceCache): Record<AssetSymbol, number | null> => ({
  ...createDefaultPrices(),
  ...(cachedPrices.prices || {}),
  stETH: cachedPrices.prices?.stETH ?? cachedPrices.stethPrice ?? null,
  LINK: cachedPrices.prices?.LINK ?? cachedPrices.linkPrice ?? null,
  USDC: 1.0,
  USDT: 1.0,
});

const getSharedPriceSnapshot = (): TokenPriceSnapshot | null => {
  const sharedPrices = getSharedPrices();

  if (!sharedPrices.lastUpdated) {
    return null;
  }

  return {
    prices: {
      ...createDefaultPrices(),
      stETH: sharedPrices.stETH,
      LINK: sharedPrices.LINK,
      wBTC: sharedPrices.wBTC,
      wETH: sharedPrices.wETH,
    },
    morPrice: sharedPrices.MOR,
  };
};

const fetchTokenPriceSnapshot = async (networkEnvironment: NetworkEnvironment): Promise<TokenPriceSnapshot> => {
  const inFlightPriceFetch = inFlightPriceFetches[networkEnvironment];
  if (inFlightPriceFetch) {
    return inFlightPriceFetch;
  }

  const nextFetch = (async () => {
    const response = await fetch('/api/token-prices', {
      headers: {
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Token price API responded with status ${response.status}`);
    }

    const data: TokenPricesApiResponse = await response.json();
    const apiPrices = data.prices || {};
    const availableAssets = getAssetsForNetwork(networkEnvironment);
    const nextPrices = createDefaultPrices();

    availableAssets.forEach((assetInfo) => {
      const { symbol } = assetInfo.metadata;

      if (symbol === 'USDC' || symbol === 'USDT') {
        nextPrices[symbol] = 1.0;
        return;
      }

      const price = parsePositivePrice(apiPrices[symbol]);
      if (price === null) {
        throw new Error(`Token price API did not return a valid ${symbol} price`);
      }

      nextPrices[symbol] = price;
    });

    const morPrice = parsePositivePrice(apiPrices.MOR);
    if (morPrice === null) {
      throw new Error('Token price API did not return a valid MOR price');
    }

    return {
      prices: nextPrices,
      morPrice,
    };
  })().finally(() => {
    delete inFlightPriceFetches[networkEnvironment];
  });

  inFlightPriceFetches[networkEnvironment] = nextFetch;

  return nextFetch;
};

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
    const serializedCache = JSON.stringify(cache);
    localStorage.setItem(cacheKey, serializedCache);

    if (cache.lastSuccessfulFetch > 0 || cacheKey === TOKEN_PRICE_CACHE_KEY) {
      localStorage.setItem(TOKEN_PRICE_CACHE_KEY, serializedCache);
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
  const [prices, setPrices] = useState<Record<AssetSymbol, number | null>>(createDefaultPrices);
  const [morPrice, setMorPrice] = useState<number | null>(null);
  const [isPriceUpdating, startPriceTransition] = useTransition();

  // Legacy getters for backward compatibility
  const stethPrice = prices.stETH;
  const linkPrice = prices.LINK;

  // Load shared in-memory prices on mount. Browser localStorage is used only as a
  // network-failure fallback so different browsers do not render different cached prices first.
  useEffect(() => {
    const sharedSnapshot = getSharedPriceSnapshot();
    if (!sharedSnapshot) {
      return;
    }

    startPriceTransition(() => {
      setPrices(sharedSnapshot.prices);
      setMorPrice(sharedSnapshot.morPrice);
    });
  }, [startPriceTransition]);

  // Fetch token prices with robust retry and fallback logic
  useEffect(() => {
    // Only fetch if it's initial load or data refresh is needed
    if (!isInitialLoad && !shouldRefreshData) return;
    // Allow fetching prices even when userAddress is not available for anonymous access
    // This ensures TVL calculations work properly even when wallet is not connected

    async function fetchTokenPricesWithRetry() {
      const cachedPrices = getCachedPrices(userAddress);

      try {
        console.log('💰 Attempting to fetch fresh token prices...', {
          retryCount: cachedPrices?.retryCount || 0,
          maxRetries: MAX_PRICE_RETRIES
        });

        const networkEnvironment: NetworkEnvironment = networkEnv as NetworkEnvironment;
        const priceSnapshot = await fetchTokenPriceSnapshot(networkEnvironment);
        const newPrices = priceSnapshot.prices;
        const morPriceData = priceSnapshot.morPrice;

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
          const fallbackPrices = normalizeCachedPrices(cachedPrices);

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
            prices: createDefaultPrices(),
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
