"use client";

import { useEffect } from "react";
import type { UserAsset } from "../types/user-asset";

export interface UserAssetsCache {
  metricsData: {
    stakedValue: string;
    totalMorStaked: string;
    dailyEmissionsEarned: string;
    lifetimeEmissionsEarned: string;
    totalAvailableToClaim: string;
    referralRewards: string;
  };
  userAssets: UserAsset[];
  stethPrice: number | null;
  linkPrice: number | null;
  timestamp: number;
  userAddress: string;
  networkEnv: string;
}

const USER_ASSETS_CACHE_KEY = 'morpheus_user_assets_cache';
const CACHE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

// Cache management functions
export const getCachedUserAssets = (userAddress: string, networkEnv: string): UserAssetsCache | null => {
  if (typeof window === 'undefined' || !userAddress) return null;
  try {
    const cached = localStorage.getItem(`${USER_ASSETS_CACHE_KEY}_${userAddress}_${networkEnv}`);
    if (!cached) return null;

    const parsedCache: UserAssetsCache = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is still valid (not expired)
    if (now - parsedCache.timestamp > CACHE_EXPIRY_MS) {
      localStorage.removeItem(`${USER_ASSETS_CACHE_KEY}_${userAddress}_${networkEnv}`);
      return null;
    }

    return parsedCache;
  } catch (error) {
    console.warn('Error reading user assets cache:', error);
    return null;
  }
};

export const setCachedUserAssets = (cache: UserAssetsCache, userAddress: string, networkEnv: string): void => {
  if (typeof window === 'undefined' || !userAddress) return;
  try {
    localStorage.setItem(`${USER_ASSETS_CACHE_KEY}_${userAddress}_${networkEnv}`, JSON.stringify(cache));
  } catch (error) {
    console.warn('Error saving user assets cache:', error);
  }
};

interface UseUserAssetsCacheOptions {
  userAddress?: string;
  networkEnv: string;
  onCacheLoaded?: (cache: UserAssetsCache) => void;
  isWalletInitialized?: boolean; // Add wallet initialization check
}

export function useUserAssetsCache({
  userAddress,
  networkEnv,
  onCacheLoaded,
  isWalletInitialized = true, // Default to true for backward compatibility
}: UseUserAssetsCacheOptions) {
  // Load cached data on mount and when user/network changes
  useEffect(() => {
    if (!userAddress) return;

    const cachedData = getCachedUserAssets(userAddress, networkEnv);
    if (cachedData) {
      console.log('📦 Loading cached user assets data:', cachedData);
      // Only call onCacheLoaded if wallet is initialized to prevent inconsistent UI
      if (isWalletInitialized) {
        onCacheLoaded?.(cachedData);
      } else {
        console.log('🔒 Cached data found but wallet not initialized - waiting...');
      }
    }
  }, [userAddress, networkEnv, onCacheLoaded, isWalletInitialized]);

  return {
    getCachedUserAssets: (userAddress: string, networkEnv: string) =>
      getCachedUserAssets(userAddress, networkEnv),
    setCachedUserAssets: (cache: UserAssetsCache, userAddress: string, networkEnv: string) =>
      setCachedUserAssets(cache, userAddress, networkEnv)
  };
}
