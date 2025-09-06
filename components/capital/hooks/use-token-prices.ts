"use client";

import { useState, useEffect, useTransition } from "react";
import { getTokenPrice } from "@/app/services/token-price.service";
import { getAssetConfig, type NetworkEnvironment } from "../constants/asset-config";

export interface TokenPriceCache {
  stethPrice: number | null;
  linkPrice: number | null;
  morPrice: number | null;
  timestamp: number;
  retryCount: number;
  lastSuccessfulFetch: number;
}

const TOKEN_PRICE_CACHE_KEY = 'morpheus_token_prices';
const PRICE_CACHE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const PRICE_RETRY_EXPIRY_MS = 2 * 60 * 1000; // 2 minutes before allowing retry
export const MAX_PRICE_RETRIES = 3;

// Cache management functions
export const getCachedPrices = (): TokenPriceCache | null => {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(TOKEN_PRICE_CACHE_KEY);
    if (!cached) return null;

    const parsedCache: TokenPriceCache = JSON.parse(cached);
    return parsedCache;
  } catch (error) {
    console.warn('Error reading token prices cache:', error);
    return null;
  }
};

export const setCachedPrices = (cache: TokenPriceCache): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TOKEN_PRICE_CACHE_KEY, JSON.stringify(cache));
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
  const [stethPrice, setStethPrice] = useState<number | null>(null);
  const [linkPrice, setLinkPrice] = useState<number | null>(null);
  const [morPrice, setMorPrice] = useState<number | null>(null);
  const [isPriceUpdating, startPriceTransition] = useTransition();

  // Load cached prices on mount
  useEffect(() => {
    const cachedPrices = getCachedPrices();
    if (cachedPrices) {
      console.log('💰 Loading cached token prices:', cachedPrices);
      setStethPrice(cachedPrices.stethPrice);
      setLinkPrice(cachedPrices.linkPrice);
      setMorPrice(cachedPrices.morPrice);
    }
  }, []);

  // Fetch token prices with robust retry and fallback logic
  useEffect(() => {
    // Only fetch if it's initial load or data refresh is needed
    if (!isInitialLoad && !shouldRefreshData) return;
    if (!userAddress) return;

    async function fetchTokenPricesWithRetry() {
      const cachedPrices = getCachedPrices();

      // Check if we should attempt a fresh fetch or use cache
      if (cachedPrices && !shouldRetryPriceFetch(cachedPrices)) {
        console.log('💰 Using cached prices due to retry limit or cooldown:', {
          retryCount: cachedPrices.retryCount,
          maxRetries: MAX_PRICE_RETRIES,
          timeSinceLastTry: Date.now() - cachedPrices.timestamp
        });

        // Use cached prices and reset loading flags
        startPriceTransition(() => {
          setStethPrice(cachedPrices.stethPrice);
          setLinkPrice(cachedPrices.linkPrice);
          setMorPrice(cachedPrices.morPrice);
        });
        return;
      }

      try {
        console.log('💰 Attempting to fetch fresh token prices...', {
          retryCount: cachedPrices?.retryCount || 0,
          maxRetries: MAX_PRICE_RETRIES
        });

        // Get CoinGecko IDs from centralized asset config
        const networkEnvironment: NetworkEnvironment = networkEnv as NetworkEnvironment;
        const stethConfig = getAssetConfig('stETH', networkEnvironment);
        const linkConfig = getAssetConfig('LINK', networkEnvironment);

        const [stethPriceData, linkPriceData, morPriceData] = await Promise.all([
          getTokenPrice(stethConfig?.metadata.coinGeckoId || 'staked-ether', 'usd'),
          getTokenPrice(linkConfig?.metadata.coinGeckoId || 'chainlink', 'usd'),
          getTokenPrice('morpheus-network', 'usd') // MOR token
        ]);

        // Save successful prices to cache
        const now = Date.now();
        const newCache: TokenPriceCache = {
          stethPrice: stethPriceData,
          linkPrice: linkPriceData,
          morPrice: morPriceData,
          timestamp: now,
          retryCount: 0, // Reset retry count on success
          lastSuccessfulFetch: now
        };
        setCachedPrices(newCache);

        // Use transition to prevent UI blocking during price updates
        startPriceTransition(() => {
          setStethPrice(stethPriceData);
          setLinkPrice(linkPriceData);
          setMorPrice(morPriceData);
        });

        console.log('💰 Token prices fetched and cached successfully:', {
          stETH: stethPriceData,
          LINK: linkPriceData,
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
          setCachedPrices(updatedCache);

          // Use cached prices as fallback
          console.log('💰 Using cached prices as fallback after error:', {
            stETH: cachedPrices.stethPrice,
            LINK: cachedPrices.linkPrice,
            MOR: cachedPrices.morPrice,
            newRetryCount
          });

          startPriceTransition(() => {
            setStethPrice(cachedPrices.stethPrice);
            setLinkPrice(cachedPrices.linkPrice);
            setMorPrice(cachedPrices.morPrice);
          });
        } else {
          // No cache available, create empty cache with retry count
          const errorCache: TokenPriceCache = {
            stethPrice: null,
            linkPrice: null,
            morPrice: null,
            timestamp: now,
            retryCount: newRetryCount,
            lastSuccessfulFetch: 0
          };
          setCachedPrices(errorCache);
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
    stethPrice,
    linkPrice,
    morPrice,
    isPriceUpdating
  };
}
