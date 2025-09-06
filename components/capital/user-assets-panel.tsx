"use client";

import { useMemo, useState, useCallback, useEffect, useTransition, useRef } from "react";
import { TokenIcon } from '@web3icons/react';
import { DataTable, Column } from "@/components/ui/data-table";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Ellipsis,
  TrendingUp,
  ArrowDownToLine,
  Lock,
  LockOpen,
  HandCoins,
} from "lucide-react";
import { useCapitalContext } from "@/context/CapitalPageContext";
import { formatNumber } from "@/lib/utils";
import { MetricCardMinimal } from "@/components/metric-card-minimal";
import { getTokenPrice } from "@/app/services/token-price.service";
import { StakeMorRewardsModal } from "./stake-mor-rewards-modal";
import { ClaimMorRewardsModal } from "./claim-mor-rewards-modal";
import type { AssetSymbol } from "@/context/CapitalPageContext";
import type { UserAsset } from "./types/user-asset";
import { useDailyEmissions } from "./hooks/use-daily-emissions";
import { useTotalMorEarned } from "@/hooks/use-total-mor-earned";
import { getAssetConfig, type NetworkEnvironment } from "./constants/asset-config";

// Enhanced price cache with retry logic and expiry
interface TokenPriceCache {
  stethPrice: number | null;
  linkPrice: number | null;
  morPrice: number | null;
  timestamp: number;
  retryCount: number;
  lastSuccessfulFetch: number;
}

const TOKEN_PRICE_CACHE_KEY = 'morpheus_token_prices';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PRICE_CACHE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes - for future use
const PRICE_RETRY_EXPIRY_MS = 2 * 60 * 1000; // 2 minutes before allowing retry
const MAX_PRICE_RETRIES = 3;

// Price cache management functions
const getCachedPrices = (): TokenPriceCache | null => {
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

const setCachedPrices = (cache: TokenPriceCache): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TOKEN_PRICE_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn('Error saving token prices cache:', error);
  }
};

const shouldRetryPriceFetch = (cachedPrices: TokenPriceCache | null): boolean => {
  if (!cachedPrices) return true;
  
  const now = Date.now();
  const timeSinceLastTry = now - cachedPrices.timestamp;
  const hasReachedMaxRetries = cachedPrices.retryCount >= MAX_PRICE_RETRIES;
  const shouldRetryAfterCooldown = timeSinceLastTry > PRICE_RETRY_EXPIRY_MS;
  
  return !hasReachedMaxRetries && shouldRetryAfterCooldown;
};

// Export functions for use by other components (like chart-section.tsx)
export { getCachedPrices, setCachedPrices, shouldRetryPriceFetch, MAX_PRICE_RETRIES };
export type { TokenPriceCache };

// Cache for user assets data to prevent flickering and provide fallbacks
interface UserAssetsCache {
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
const getCachedUserAssets = (userAddress: string, networkEnv: string): UserAssetsCache | null => {
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

const setCachedUserAssets = (cache: UserAssetsCache, userAddress: string, networkEnv: string): void => {
  if (typeof window === 'undefined' || !userAddress) return;
  try {
    localStorage.setItem(`${USER_ASSETS_CACHE_KEY}_${userAddress}_${networkEnv}`, JSON.stringify(cache));
  } catch (error) {
    console.warn('Error saving user assets cache:', error);
  }
};

export function UserAssetsPanel() {
  const {
    userAddress,
    setActiveModal,
    setSelectedAsset,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    isLoadingUserData, // Keep for potential future use
    assets, // Get all asset data
    networkEnv, // Add network environment
    // Processing states to properly disable buttons
    isProcessingDeposit,
    isProcessingClaim,
    isProcessingWithdraw,
    isProcessingChangeLock,
    // V2-specific claim data
    stETHV2CanClaim,
    linkV2CanClaim,
    stETHV2ClaimUnlockTimestamp,
    linkV2ClaimUnlockTimestamp,
    stETHV2ClaimUnlockTimestampFormatted,
    linkV2ClaimUnlockTimestampFormatted,
  } = useCapitalContext();

  // Calculate daily emissions for each asset using real contract data
  const { emissions: stETHDailyEmissions, isLoading: isStETHEmissionsLoading } = useDailyEmissions(
    assets.stETH?.claimableAmount,
    assets.stETH?.userDeposited,
    'stETH',
    networkEnv
  );
  
  const { emissions: linkDailyEmissions, isLoading: isLinkEmissionsLoading } = useDailyEmissions(
    assets.LINK?.claimableAmount,
    assets.LINK?.userDeposited,
    'LINK',
    networkEnv
  );

  // Fetch total MOR earned from Capital v2 subgraph (testnet only)
  const totalMorEarnedResult = useTotalMorEarned(userAddress || null, networkEnv);
  const { 
    totalEarned: totalMorEarned,
    stETHEarned,
    linkEarned,
    isLoading: isTotalMorEarnedLoading,
    error: totalMorEarnedError
  } = totalMorEarnedResult;

  console.log('🎯 useTotalMorEarned hook result in UserAssetsPanel:', {
    totalEarned: totalMorEarned,
    stETHEarned,
    linkEarned,
    isLoading: isTotalMorEarnedLoading,
    error: totalMorEarnedError,
    userAddress,
    networkEnv,
    fullResult: totalMorEarnedResult,
  });


  // State for sorting with transition for smooth UI updates
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isSorting, startSortTransition] = useTransition();

  // State for token prices from CoinGecko with transition for smooth updates
  const [stethPrice, setStethPrice] = useState<number | null>(null);
  const [linkPrice, setLinkPrice] = useState<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [morPrice, setMorPrice] = useState<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isPriceUpdating, startPriceTransition] = useTransition();
  
  // State for controlling initial vs background loading
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [shouldRefreshData, setShouldRefreshData] = useState(false);
  const lastUserActionRef = useRef<string>('');
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track data freshness to prevent unnecessary skeleton states
  const [hasValidData, setHasValidData] = useState(false);

  // Combined loading state for total daily emissions - only during initial load
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isDailyEmissionsLoading = (isInitialLoad && !hasValidData) && (isStETHEmissionsLoading || isLinkEmissionsLoading);

  // Load cached data on mount and when user/network changes
  useEffect(() => {
    // Always try to load cached prices first
    const cachedPrices = getCachedPrices();
    if (cachedPrices) {
      console.log('💰 Loading cached token prices:', cachedPrices);
      setStethPrice(cachedPrices.stethPrice);
      setLinkPrice(cachedPrices.linkPrice);
      setMorPrice(cachedPrices.morPrice);
    }

    if (!userAddress) {
      setHasValidData(false);
      setIsInitialLoad(true);
      return;
    }

    const cachedData = getCachedUserAssets(userAddress, networkEnv);
    if (cachedData) {
      console.log('📦 Loading cached user assets data:', cachedData);
      // Use cached prices if not already loaded from global cache
      if (!cachedPrices) {
        setStethPrice(cachedData.stethPrice);
        setLinkPrice(cachedData.linkPrice);
      }
      setHasValidData(true);
      setIsInitialLoad(false); // We have cached data, no need for skeleton
    } else {
      console.log('🔄 No cached data found, will show initial loading');
      setIsInitialLoad(true);
      setHasValidData(false);
    }
  }, [userAddress, networkEnv]);

  // Smart refresh triggers: only refresh on page load or after user actions
  useEffect(() => {
    const currentActionState = `${isProcessingDeposit}-${isProcessingClaim}-${isProcessingWithdraw}-${isProcessingChangeLock}`;
    
    // Debug logging for processing states
    if (process.env.NODE_ENV === 'development') {
      console.log('Processing state change:', {
        previous: lastUserActionRef.current,
        current: currentActionState,
        shouldRefreshData
      });
    }
    
    // Only trigger if we have a previous state to compare against
    if (lastUserActionRef.current && lastUserActionRef.current !== currentActionState) {
      const wasProcessing = lastUserActionRef.current.includes('true');
      const isProcessing = currentActionState.includes('true');
      
      // Only trigger refresh once when transitioning from processing to not processing
      // and prevent multiple triggers by checking if refresh is already pending or timeout exists
      if (wasProcessing && !isProcessing && !shouldRefreshData && !refreshTimeoutRef.current) {
        console.log('🔄 User action completed, scheduling data refresh');
        
        // Use debounced refresh to prevent rapid-fire triggers
        refreshTimeoutRef.current = setTimeout(() => {
          console.log('🔄 Executing debounced data refresh after user action');
          setShouldRefreshData(true);
          refreshTimeoutRef.current = null;
        }, 1000); // Increased to 1 second debounce for more stability
      }
    }
    
    lastUserActionRef.current = currentActionState;
  }, [isProcessingDeposit, isProcessingClaim, isProcessingWithdraw, isProcessingChangeLock]); // Removed shouldRefreshData to prevent re-triggering

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  // Helper function to safely parse deposit amount
  const parseDepositAmount = (depositValue: string | undefined): number => {
    try {
      if (!depositValue || typeof depositValue !== 'string') {
        return 0;
      }
      const cleanedValue = depositValue.replace(/,/g, '');
      const parsed = parseFloat(cleanedValue);
      return isNaN(parsed) ? 0 : parsed;
    } catch (error) {
      console.error('Error parsing deposit amount:', error);
      return 0;
    }
  };

  // Helper function to format amounts with 2 decimals for small numbers
  const formatAssetAmount = (amount: number): string => {
    if (amount < 1 && amount > 0) {
      return amount.toFixed(2);
    }
    return formatNumber(amount);
  };

  // Helper function to format staked amounts with 1 decimal place
  const formatStakedAmount = (amount: number): string => {
    return amount.toFixed(1);
  };

    // Helper function to get unlock date for specific asset
  const getAssetUnlockDate = useCallback((assetSymbol: 'stETH' | 'LINK'): string | null => {
    let unlockDate: string | null = null;
    let rawFormatted: string;
    let rawTimestamp: bigint | undefined;

    // Get raw data for debugging
    if (assetSymbol === 'stETH') {
      rawFormatted = stETHV2ClaimUnlockTimestampFormatted;
      rawTimestamp = stETHV2ClaimUnlockTimestamp;
    } else {
      rawFormatted = linkV2ClaimUnlockTimestampFormatted;
      rawTimestamp = linkV2ClaimUnlockTimestamp;
    }

    // Debug logging
    console.log(`🔍 Raw data for ${assetSymbol}:`, {
      rawTimestamp,
      rawFormatted,
      isTimestampUndefined: rawTimestamp === undefined,
      isFormattedPlaceholder: rawFormatted === "--- --, ----",
      formattedType: typeof rawFormatted
    });

    // Use V2-specific unlock timestamps
    if (assetSymbol === 'stETH') {
      unlockDate = stETHV2ClaimUnlockTimestampFormatted && stETHV2ClaimUnlockTimestampFormatted !== "--- --, ----"
        ? stETHV2ClaimUnlockTimestampFormatted
        : null;
    }

    if (assetSymbol === 'LINK') {
      unlockDate = linkV2ClaimUnlockTimestampFormatted && linkV2ClaimUnlockTimestampFormatted !== "--- --, ----"
        ? linkV2ClaimUnlockTimestampFormatted
        : null;
    }

    // Log unlock date for debugging
    console.log(`🔓 getAssetUnlockDate for ${assetSymbol}:`, {
      rawTimestamp,
      rawFormatted,
      processedDate: unlockDate,
      isValid: unlockDate !== null,
      conditionCheck: rawFormatted && rawFormatted !== "--- --, ----",
      assetSymbol
    });

    return unlockDate;
  }, [stETHV2ClaimUnlockTimestampFormatted, linkV2ClaimUnlockTimestampFormatted, stETHV2ClaimUnlockTimestamp, linkV2ClaimUnlockTimestamp]);

  // Helper function to check if asset rewards can be claimed
  const canAssetClaim = useCallback((assetSymbol: 'stETH' | 'LINK'): boolean => {
    // Use V2-specific claim eligibility
    if (assetSymbol === 'stETH') return stETHV2CanClaim;
    if (assetSymbol === 'LINK') return linkV2CanClaim;
    return false;
  }, [stETHV2CanClaim, linkV2CanClaim]);

  // Check if user has any assets staked (stETH or LINK) - moved up for dependency
  const hasStakedAssets = useMemo(() => {
    const stethDeposited = parseDepositAmount(assets.stETH?.userDepositedFormatted);
    const linkDeposited = parseDepositAmount(assets.LINK?.userDepositedFormatted);
    return stethDeposited > 0 || linkDeposited > 0;
  }, [assets]);

  // Helper function to check if unlock date has passed (for withdraw functionality)
  const isUnlockDateReached = useCallback((unlockDate: string | null): boolean => {
    console.log('🔍 isUnlockDateReached called with:', unlockDate);

    if (!unlockDate || unlockDate === "--- --, ----" || unlockDate === "Never" || unlockDate === "Invalid Date") {
      console.log('❌ Unlock date check failed - invalid/null date:', unlockDate);
      // Fallback: If we have no unlock date but user has staked assets, allow withdrawal
      // This handles cases where timestamp data is missing but user should still be able to withdraw
      const hasStakedAssetsCheck = hasStakedAssets;
      console.log('🔄 Fallback check for staked assets:', hasStakedAssetsCheck);
      if (hasStakedAssetsCheck) {
        console.log('✅ Allowing withdrawal due to fallback - user has staked assets');
        return true;
      }
      return false; // No unlock date set, invalid, or never unlocks
    }

    try {
      // Parse the unlock date string (format: "Aug 16, 2025, 5:30 PM" from toLocaleString)
      const unlockDateTime = new Date(unlockDate);
      const currentDate = new Date();

      console.log('📅 Date parsing details:', {
        unlockDateString: unlockDate,
        unlockDateTime: unlockDateTime,
        unlockDateTimeParsed: unlockDateTime.toISOString(),
        currentDate: currentDate.toISOString(),
        unlockDateTimeValid: !isNaN(unlockDateTime.getTime())
      });

      // Validate that the date was parsed correctly
      if (isNaN(unlockDateTime.getTime())) {
        console.error('❌ Invalid unlock date parsed:', unlockDate, '- Date object:', unlockDateTime);
        return false;
      }

      // Compare dates including time
      const unlockReached = currentDate >= unlockDateTime;

      console.log('✅ Unlock date comparison result:', {
        unlockDate: unlockDate,
        unlockDateTime: unlockDateTime.toISOString(),
        currentDate: currentDate.toISOString(),
        timeDifferenceMs: currentDate.getTime() - unlockDateTime.getTime(),
        timeDifferenceHours: (currentDate.getTime() - unlockDateTime.getTime()) / (1000 * 60 * 60),
        unlockReached,
        shouldAllowWithdraw: unlockReached
      });

      return unlockReached;
    } catch (error) {
      console.error('❌ Error parsing unlock date:', unlockDate, error);
      return false; // If parsing fails, assume not unlocked
    }
  }, [hasStakedAssets]);



  // Check if any action is currently processing
  const isAnyActionProcessing = isProcessingDeposit || isProcessingClaim || isProcessingWithdraw || isProcessingChangeLock;

  // Cleanup dropdown state when user changes or actions are processing
  useEffect(() => {
    if (isAnyActionProcessing) {
      setOpenDropdownId(null);
    }
  }, [isAnyActionProcessing]);

  // Cleanup dropdown state when user changes
  useEffect(() => {
    setOpenDropdownId(null);
  }, [userAddress]);

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
          setHasValidData(true);
          if (isInitialLoad) setIsInitialLoad(false);
          if (shouldRefreshData) setShouldRefreshData(false);
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
          setHasValidData(true);
          if (isInitialLoad) setIsInitialLoad(false);
          if (shouldRefreshData) setShouldRefreshData(false);
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
            setHasValidData(true);
            if (isInitialLoad) setIsInitialLoad(false);
            if (shouldRefreshData) setShouldRefreshData(false);
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
          
          // Reset flags even on error to prevent stuck states
          if (isInitialLoad) setIsInitialLoad(false);
          if (shouldRefreshData) setShouldRefreshData(false);
        }
      }
    }

    // Safety timeout to reset refresh flag in case of hangs
    const safetyTimeout = setTimeout(() => {
      if (shouldRefreshData) {
        console.warn('⚠️ Data refresh timeout, resetting flag');
        setShouldRefreshData(false);
      }
      if (isInitialLoad) {
        console.warn('⚠️ Initial load timeout, resetting flag');
        setIsInitialLoad(false);
      }
    }, 15000); // 15 second timeout

    fetchTokenPricesWithRetry();

    return () => clearTimeout(safetyTimeout);
  }, [isInitialLoad, shouldRefreshData, userAddress, networkEnv, startPriceTransition]);

  // State to control which dropdown is open (by asset ID)
  // This prevents multiple dropdowns from being open simultaneously and fixes ARIA focus conflicts
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  
  // Transitions for smooth modal and dropdown interactions
  const [isModalTransitioning, startModalTransition] = useTransition();
  const [isDropdownTransitioning, startDropdownTransition] = useTransition();

  // Helper function to handle dropdown menu actions and manage focus properly
  const handleDropdownAction = useCallback((modalType: 'deposit' | 'withdraw' | 'changeLock' | 'claim' | 'claimMorRewards' | 'stakeMorRewards', assetSymbol?: AssetSymbol) => {
    // Prevent action if another action is processing (but allow withdraw even during claim processing)
    if (isAnyActionProcessing && modalType !== 'withdraw') {
      console.log('Blocking action due to processing state:', modalType);
      return;
    }

    // Use transition for smooth modal opening
    startModalTransition(() => {
      // Close dropdown first
      setOpenDropdownId(null);
      // Force focus to body to prevent ARIA conflicts
      if (document.body) {
        document.body.focus();
      }
      // Set the selected asset if provided (for asset-specific actions like withdraw)
      if (assetSymbol) {
        setSelectedAsset(assetSymbol);
      }
      // Open modal directly without setTimeout - transition handles the smoothness
      setActiveModal(modalType);
    });
  }, [setActiveModal, setSelectedAsset, isAnyActionProcessing, startModalTransition]);

  // Handle dropdown state changes to manage focus
  const handleDropdownOpenChange = useCallback((assetId: string, open: boolean) => {
    startDropdownTransition(() => {
      if (open) {
        setOpenDropdownId(assetId);
      } else {
        setOpenDropdownId(null);
        // When dropdown closes, ensure no element retains focus that could conflict with modals
        // Using transition eliminates need for setTimeout
        if (document.activeElement && document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    });
  }, [startDropdownTransition]);

  // User assets data will be calculated first, then metrics will use it

  // User assets data with real staking amounts for stETH and LINK
  const userAssets: UserAsset[] = useMemo(() => {
    // Try cached data first if we don't have fresh data
    const cachedData = getCachedUserAssets(userAddress || '', networkEnv);
    
    if (!hasStakedAssets) {
      // Return cached user assets if available, otherwise empty array
      return cachedData?.userAssets || [];
    }

    const stethAmount = parseDepositAmount(assets.stETH?.userDepositedFormatted);
    const linkAmount = parseDepositAmount(assets.LINK?.userDepositedFormatted);
    const stethAvailable = parseDepositAmount(assets.stETH?.userBalanceFormatted);
    const linkAvailable = parseDepositAmount(assets.LINK?.userBalanceFormatted);
    const stethClaimable = parseDepositAmount(assets.stETH?.claimableAmountFormatted);
    const linkClaimable = parseDepositAmount(assets.LINK?.claimableAmountFormatted);
    
    const stethUnlockDate = getAssetUnlockDate('stETH');
    const linkUnlockDate = getAssetUnlockDate('LINK');

    console.log('🏗️ Creating userAssets array:', {
      stETH: {
        unlockDate: stethUnlockDate,
        canWithdraw: isUnlockDateReached(stethUnlockDate),
        amountStaked: stethAmount
      },
      LINK: {
        unlockDate: linkUnlockDate,
        canWithdraw: isUnlockDateReached(linkUnlockDate),
        amountStaked: linkAmount
      },
      rawContextData: {
        stETHV2ClaimUnlockTimestampFormatted,
        linkV2ClaimUnlockTimestampFormatted
      }
    });

    // Get network environment and supported assets from centralized config
    const networkEnvironment: NetworkEnvironment = networkEnv as NetworkEnvironment;
    const supportedAssets = ['stETH', 'LINK'] as const; // Only these have user data for now
    
    return supportedAssets.map((assetSymbol, index) => {
      const assetConfigData = getAssetConfig(assetSymbol, networkEnvironment);
      if (!assetConfigData) return null;
      
      const isStETH = assetSymbol === 'stETH';
      const amount = isStETH ? stethAmount : linkAmount;
      const available = isStETH ? stethAvailable : linkAvailable;
      const claimable = isStETH ? stethClaimable : linkClaimable;
      const emissions = isStETH ? stETHDailyEmissions : linkDailyEmissions;
      const multiplier = isStETH ? assets.stETH?.userMultiplierFormatted : assets.LINK?.userMultiplierFormatted;
      const unlockDate = getAssetUnlockDate(assetSymbol);
      
      return {
        id: (index + 1).toString(),
        symbol: assetConfigData.metadata.symbol,
        assetSymbol: assetSymbol as AssetSymbol,
        icon: assetConfigData.metadata.icon,
        amountStaked: amount,
        available: available,
        dailyEmissions: emissions,
        powerFactor: multiplier || "x1.0", // Keep the formatted string with 'x' prefix
        unlockDate: unlockDate,
        availableToClaim: claimable,
        canClaim: canAssetClaim(assetSymbol),
      };
    })
    .filter(asset => asset !== null && (asset.amountStaked > 0 || asset.availableToClaim > 0)) as UserAsset[]; // Only show assets with activity
  }, [hasStakedAssets, assets, canAssetClaim, getAssetUnlockDate, stETHDailyEmissions, linkDailyEmissions]);

  // Calculate metrics from real asset data - now using userAssets for accurate table totals
  const metricsData = useMemo(() => {
    // Try to get cached data first if we don't have fresh data
    const cachedData = getCachedUserAssets(userAddress || '', networkEnv);
    const cachedPrices = getCachedPrices();
    
    if (!hasStakedAssets) {
      const emptyMetrics = {
        stakedValue: "0",
        totalMorStaked: "0",
        dailyEmissionsEarned: "0",
        lifetimeEmissionsEarned: "N/A",
        totalAvailableToClaim: "0",
        referralRewards: "0",
      };
      
      // Return cached data if available, otherwise empty state
      return cachedData?.metricsData || emptyMetrics;
    }

    const stethStaked = parseDepositAmount(assets.stETH?.userDepositedFormatted);
    const linkStaked = parseDepositAmount(assets.LINK?.userDepositedFormatted);
    
    // Critical fix: NEVER show 0 if user has staked assets
    // Use current prices, fallback to cached prices, then fallback to cached metrics
    let effectiveStethPrice = stethPrice;
    let effectiveLinkPrice = linkPrice;
    
    // If current prices are null but user has assets, use cached prices
    if (!effectiveStethPrice && cachedPrices?.stethPrice && (stethStaked > 0)) {
      effectiveStethPrice = cachedPrices.stethPrice;
      console.log('💰 Using cached stETH price for metrics calculation:', effectiveStethPrice);
    }
    if (!effectiveLinkPrice && cachedPrices?.linkPrice && (linkStaked > 0)) {
      effectiveLinkPrice = cachedPrices.linkPrice;
      console.log('💰 Using cached LINK price for metrics calculation:', effectiveLinkPrice);
    }
    
    // Calculate USD value using effective prices (current or cached)
    const stethUSDValue = effectiveStethPrice ? stethStaked * effectiveStethPrice : 0;
    const linkUSDValue = effectiveLinkPrice ? linkStaked * effectiveLinkPrice : 0;
    const totalStakedValue = stethUSDValue + linkUSDValue;
    
    // If we still get 0 but user has staked assets, use the most recent cached metrics
    if (totalStakedValue === 0 && (stethStaked > 0 || linkStaked > 0) && cachedData?.metricsData) {
      console.log('⚠️ Price calculation failed but user has assets, using cached metrics:', {
        stethStaked,
        linkStaked,
        cachedMetrics: cachedData.metricsData.stakedValue
      });
      return cachedData.metricsData;
    }
    
    console.log('💰 USD Value Calculation:', {
      stethStaked,
      linkStaked,
      stethPrice,
      linkPrice,
      stethUSDValue,
      linkUSDValue,
      totalStakedValue
    });
    
    // Calculate total daily emissions from both assets
    const totalDailyEmissions = stETHDailyEmissions + linkDailyEmissions;
    
    // Calculate total available to claim from table rows (sum of each row's "Available to Claim")
    const totalTableAvailableToClaim = userAssets.reduce((sum, asset) => sum + asset.availableToClaim, 0);
    
    // Calculate lifetime earnings using subgraph data (testnet) or fallback to current claimable
    console.log('🔍 UserAssetsPanel lifetime earnings calculation:', {
      networkEnv,
      isTotalMorEarnedLoading,
      totalMorEarned,
      totalMorEarnedType: typeof totalMorEarned,
      isTestnet: networkEnv === 'testnet',
      shouldShowLoading: isTotalMorEarnedLoading,
      shouldShowValue: totalMorEarned > 0,
    });
    
    const lifetimeEarnings = networkEnv === 'testnet' 
      ? (isTotalMorEarnedLoading ? "..." : (totalMorEarned > 0 ? formatNumber(totalMorEarned) : "0"))
      : "N/A"; // Mainnet: Need historical data when Capital v2 is deployed
    
    console.log('💰 Final lifetime earnings display value:', lifetimeEarnings);
    
    const freshMetrics = {
      stakedValue: Math.floor(totalStakedValue).toLocaleString(), // Format as whole dollars with commas
      totalMorStaked: "0", // TODO: Calculate total MOR staked if applicable
      dailyEmissionsEarned: formatNumber(totalDailyEmissions),
      lifetimeEmissionsEarned: lifetimeEarnings, // N/A until we have historical claimed data
      totalAvailableToClaim: formatNumber(totalTableAvailableToClaim), // Sum from actual table rows
      referralRewards: "0", // TODO: Add referral rewards from context
    };

    // Save successful data to cache (only if we have valid prices and user data)
    if (userAddress && (effectiveStethPrice || effectiveLinkPrice) && hasStakedAssets) {
      try {
        const cacheData: UserAssetsCache = {
          metricsData: freshMetrics,
          userAssets: userAssets,
          stethPrice: effectiveStethPrice,
          linkPrice: effectiveLinkPrice,
          timestamp: Date.now(),
          userAddress,
          networkEnv
        };
        setCachedUserAssets(cacheData, userAddress, networkEnv);
        console.log('💾 Saved fresh metrics to cache with effective prices');
      } catch (error) {
        console.warn('Error saving metrics to cache:', error);
      }
    }
    
    return freshMetrics;
  }, [hasStakedAssets, assets, stethPrice, linkPrice, stETHDailyEmissions, linkDailyEmissions, userAssets, networkEnv, isTotalMorEarnedLoading, totalMorEarned, userAddress]);

  // Sorting logic
  const sorting = useMemo(() => {
    if (!sortColumn) return null;
    return {
      id: sortColumn,
      desc: sortDirection === 'desc'
    };
  }, [sortColumn, sortDirection]);

  // Define columns for the assets table
  const assetsColumns: Column<UserAsset>[] = useMemo(
    () => [
      {
        id: "asset",
        header: "Asset",
        cell: (asset) => (
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center">
              <TokenIcon symbol={asset.icon} variant="background" size="24" />
            </div>
            <span className="font-medium text-white">{asset.symbol}</span>
          </div>
        ),
      },
      {
        id: "amountStaked",
        header: "Amount Staked",
        accessorKey: "amountStaked",
        enableSorting: true,
        cell: (asset) => (
          <span className="text-gray-200">
            {formatStakedAmount(asset.amountStaked)}
          </span>
        ),
      },
      {
        id: "available",
        header: "Available to Stake",
        accessorKey: "available",
        enableSorting: true,
        cell: (asset) => (
          <span className="text-gray-200">
            {formatAssetAmount(asset.available)}
          </span>
        ),
      },
      {
        id: "dailyEmissions",
        header: "Daily Emissions",
        accessorKey: "dailyEmissions",
        enableSorting: true,
        cell: (asset) => {
          // Only show skeleton during initial load, not during background updates
          const shouldShowSkeleton = (isInitialLoad && !hasValidData) && 
            ((asset.symbol === 'stETH' && isStETHEmissionsLoading) || 
             (asset.symbol === 'LINK' && isLinkEmissionsLoading));
          
          return (
            <span className="text-gray-200">
              {shouldShowSkeleton ? (
                <Skeleton className="h-4 w-16" />
              ) : (
                `${formatNumber(asset.dailyEmissions)} MOR`
              )}
            </span>
          );
        },
      },
      {
        id: "powerFactor",
        header: "Power Factor",
        accessorKey: "powerFactor",
        enableSorting: false, // Disable sorting for now since it's a formatted string
        cell: (asset) => (
          <span className="text-gray-200">
            {asset.powerFactor}
          </span>
        ),
      },
      {
        id: "unlockDate",
        header: "Unlock Date",
        cell: (asset) => (
          <span className="text-gray-300 whitespace-nowrap">
            {asset.unlockDate || "N/A"}
          </span>
        ),
      },
      {
        id: "availableToClaim", 
        header: "Available to Claim",
        accessorKey: "availableToClaim",
        enableSorting: true,
        cell: (asset) => (
          <div className="flex items-center gap-2">
            <span className={asset.canClaim ? "text-gray-200" : "text-gray-500"}>
              {formatNumber(asset.availableToClaim)} MOR
            </span>
            {asset.availableToClaim > 0 && (
              <Badge className={`h-4 min-w-4 rounded-full px-1 font-mono tabular-nums ${
                asset.canClaim 
                  ? "bg-emerald-400 hover:bg-emerald-500 text-black border-emerald-400" 
                  : "bg-yellow-600 hover:bg-yellow-700 text-white border-yellow-600"
              }`}>
                {asset.canClaim ? (
                  <LockOpen className="h-3 w-3" />
                ) : (
                  <Lock className="h-3 w-3" />
                )}
              </Badge>
            )}
          </div>
        ),
      },
      {
        id: "actions",
        header: "", // No header for actions column
        cell: (asset) => (
          <DropdownMenu 
            open={openDropdownId === asset.id} 
            onOpenChange={(open) => handleDropdownOpenChange(asset.id, open)}
          >
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 p-0" disabled={isAnyActionProcessing || isModalTransitioning || isDropdownTransitioning}>
                <Ellipsis className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="mt-2">
              <DropdownMenuItem onClick={() => handleDropdownAction('stakeMorRewards', asset.assetSymbol)} disabled={isAnyActionProcessing || isModalTransitioning}>
                <TrendingUp className="mr-2 h-4 w-4" /> 
                {isModalTransitioning ? 'Opening...' : 'Stake Rewards'}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleDropdownAction('withdraw', asset.assetSymbol)} 
                disabled={isAnyActionProcessing || isModalTransitioning || !isUnlockDateReached(asset.unlockDate)}
                className={!isUnlockDateReached(asset.unlockDate) ? "text-gray-500 cursor-not-allowed" : ""}
              >
                <ArrowDownToLine className="mr-2 h-4 w-4" /> 
                {isModalTransitioning ? 'Opening...' : 'Withdraw'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleDropdownAction('claimMorRewards', asset.assetSymbol)}
                disabled={isAnyActionProcessing || isModalTransitioning || asset.availableToClaim <= 0}
                className={asset.availableToClaim <= 0 ? "text-gray-500 cursor-not-allowed" : ""}
              >
                <Lock className="mr-2 h-4 w-4" />
                {isModalTransitioning ? 'Opening...' : 'Lock Rewards'}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleDropdownAction('claimMorRewards', asset.assetSymbol)} 
                disabled={isAnyActionProcessing || isModalTransitioning || !asset.canClaim}
                className={!asset.canClaim ? "text-gray-500 cursor-not-allowed" : ""}
              >
                <HandCoins className="mr-2 h-4 w-4" /> 
                {isModalTransitioning ? 'Opening...' : 'Claim Rewards'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [isAnyActionProcessing, handleDropdownAction, openDropdownId, handleDropdownOpenChange, isUnlockDateReached, isStETHEmissionsLoading, isLinkEmissionsLoading, isModalTransitioning, isDropdownTransitioning, isInitialLoad, hasValidData]
  );

  // Handle sorting change with transition for smooth UI updates
  const handleSortingChange = (columnId: string) => {
    startSortTransition(() => {
      if (sortColumn === columnId) {
        // Toggle direction if same column
        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
      } else {
        // New column, default to asc
        setSortColumn(columnId);
        setSortDirection('asc');
      }
    });
  };

  // Empty state component
  const EmptyState = () => (
    <div className="flex flex-col panel-gradient-base items-center h-[260px] justify-center py-12 px-6 rounded-xl border border-emerald-400/[0.1] bac">
      <h3 className={userAddress ? "text-lg font-semibold text-white mb-2" : "text-lg font-semibold text-gray-400 mb-2"}>
        {userAddress ? "Deposit an asset to start earning" : "Please connect your wallet"}
      </h3>
      {userAddress && (
      <button
        className="copy-button"
        onClick={() => userAddress && setActiveModal('deposit')}
        disabled={!userAddress || isAnyActionProcessing || isModalTransitioning}
        >
          {isModalTransitioning ? 'Opening...' : 'Deposit'}
        </button>
      )}
    </div>
  );

  // Always render the component structure with loading states instead of early return

  return (
    <>
      <div className="page-section mt-8">
        <div className="relative">
        <GlowingEffect 
          spread={40}
          glow={true}
          disabled={false}
          proximity={64}
          inactiveZone={0.01}
          borderWidth={2}
          borderRadius="rounded-xl"
        />
        <div className="section-content group relative px-1 py-4 sm:p-6">
          <div className="section-content-gradient group-hover:bg-gradient-to-bl group-hover:from-emerald-400/10 group-hover:to-transparent" />
          <div className="p-4 md:p-6">
            {/* Header with title and stake button */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">My Position</h2>
              <div className="flex flex-row items-center space-x-2">
                {hasStakedAssets &&
                  <button
                      className={!userAddress || isAnyActionProcessing || isModalTransitioning ? "copy-button-secondary px-4 py-2 disabled:cursor-not-allowed" : "copy-button-base"}
                      onClick={() => setActiveModal('deposit')}
                      disabled={!userAddress || isAnyActionProcessing || isModalTransitioning}
                  >
                    {isModalTransitioning ? 'Opening...' : 'Deposit'}
                  </button>
                }
                {/* <button
                    className="copy-button-secondary font-medium px-4 py-2 rounded-lg"
                    onClick={() => setActiveModal('claimMorRewards')}
                    disabled={!userAddress || isAnyActionProcessing}
                >
                    Claim all
                </button> */}
              </div>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-2 sm:gap-x-4 gap-y-2 mb-6">
              <MetricCardMinimal
                title="Deposits Value"
                value={metricsData.stakedValue}
                isUSD={true}
                disableGlow={true}
                className="col-span-1"
                isLoading={isInitialLoad && !hasValidData}
              />
              <MetricCardMinimal
                title="Current Daily Rewards"
                value={metricsData.dailyEmissionsEarned}
                label="MOR"
                disableGlow={true}
                autoFormatNumbers={true}
                className="col-span-1"
                isLoading={isInitialLoad && !hasValidData}
              />
               <MetricCardMinimal
                 title="Claimable Rewards"
                 value={metricsData.totalAvailableToClaim}
                 label="MOR"
                 disableGlow={true}
                 autoFormatNumbers={true}
                 className="col-span-1"
                 isLoading={isInitialLoad && !hasValidData}
               />
              <MetricCardMinimal
                title="Total MOR Earned"
                value={metricsData.lifetimeEmissionsEarned}
                label="MOR"
                disableGlow={true}
                autoFormatNumbers={true}
                className="col-span-1"
                isLoading={isInitialLoad && !hasValidData}
              />
              {/* <MetricCardMinimal
                title="MOR Staked"
                value={metricsData.totalMorStaked}
                label="MOR"
                disableGlow={true}
                autoFormatNumbers={true}
                className="col-span-1"
              /> */}
            </div>

            {/* Assets table or empty state */}
            {hasStakedAssets || (isInitialLoad && !hasValidData) ? (
              <div className="[&>div]:max-h-[400px] overflow-auto custom-scrollbar">
                <DataTable
                  columns={assetsColumns}
                  data={userAssets}
                  isLoading={isInitialLoad && !hasValidData}
                  sorting={sorting}
                  onSortingChange={handleSortingChange}
                  loadingRows={2}
                  noResultsMessage="No assets found."
                />
              </div>
            ) : (
              <EmptyState />
            )}
          </div>
        </div>
      </div>
      
      {/* Stake MOR Rewards Modal */}
      <StakeMorRewardsModal />
      
      {/* Claim MOR Rewards Modal */}
      <ClaimMorRewardsModal />
      </div>
    </>
  );
} 