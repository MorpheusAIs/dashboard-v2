"use client";

import { useMemo, useState, useCallback, useEffect, useTransition, useRef } from "react";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { useCapitalContext } from "@/context/CapitalPageContext";
import { formatNumber } from "@/lib/utils";
import { StakeMorRewardsModal } from "./stake-mor-rewards-modal";
import { ClaimMorRewardsModal } from "./claim-mor-rewards-modal";
import { UserAssetsMetrics } from "./user-assets-metrics";
import { UserAssetsTable } from "./user-assets-table";
import { EmptyAssetsState } from "./empty-assets-state";
import { useTokenPrices } from "./hooks/use-token-prices";
import { useUserAssetsCache } from "./hooks/use-user-assets-cache";
import { useAssetsTable } from "./hooks/use-assets-table";
import { useDailyEmissions } from "./hooks/use-daily-emissions";
import { useTotalMorEarned } from "@/hooks/use-total-mor-earned";
import {
  parseDepositAmount,
  hasStakedAssets as checkHasStakedAssets,
  isUnlockDateReached,
  formatUnlockDate
} from "./utils/asset-formatters";
import { getAssetConfig } from "./constants/asset-config";
import type { AssetSymbol } from "@/context/CapitalPageContext";
import type { UserAsset } from "./types/user-asset";
import type { UserAssetsCache } from "./hooks/use-user-assets-cache";
import { useAuth } from "@/context/auth-context";

// Type for modal actions that can be triggered from dropdowns
type ModalAction = "deposit" | "withdraw" | "changeLock" | "stakeMorRewards" | "claimMorRewards";

// Re-export cache functions for backward compatibility
export { getCachedPrices, setCachedPrices, shouldRetryPriceFetch, MAX_PRICE_RETRIES, type TokenPriceCache } from "./hooks/use-token-prices";
export { getCachedUserAssets, setCachedUserAssets, type UserAssetsCache } from "./hooks/use-user-assets-cache";

export function UserAssetsPanel() {
  const {
    userAddress,
    setActiveModal,
    setSelectedAsset,
    assets,
    networkEnv,
    isProcessingDeposit,
    isProcessingClaim,
    isProcessingWithdraw,
    isProcessingChangeLock,
    // Add loading states to detect when data is loaded
    isLoadingUserData,
    isLoadingBalances,
    isLoadingRewards,
  } = useCapitalContext();

  // Get wallet initialization status from auth context
  const { isWalletInitialized, isLoading: isAuthLoading } = useAuth();

  // Calculate daily emissions for each asset dynamically using real contract data
  const stETHEmissions = useDailyEmissions(
    assets.stETH?.claimableAmount,
    assets.stETH?.userDeposited,
    'stETH',
    networkEnv
  );

  const linkEmissions = useDailyEmissions(
    assets.LINK?.claimableAmount,
    assets.LINK?.userDeposited,
    'LINK',
    networkEnv
  );

  const usdcEmissions = useDailyEmissions(
    assets.USDC?.claimableAmount,
    assets.USDC?.userDeposited,
    'USDC',
    networkEnv
  );

  const usdtEmissions = useDailyEmissions(
    assets.USDT?.claimableAmount,
    assets.USDT?.userDeposited,
    'USDT',
    networkEnv
  );

  const wbtcEmissions = useDailyEmissions(
    assets.wBTC?.claimableAmount,
    assets.wBTC?.userDeposited,
    'wBTC',
    networkEnv
  );

  const wethEmissions = useDailyEmissions(
    assets.wETH?.claimableAmount,
    assets.wETH?.userDeposited,
    'wETH',
    networkEnv
  );

  // Create a mapping of asset symbols to their emission data for easy lookup
  const assetEmissions = useMemo(() => ({
    stETH: stETHEmissions,
    LINK: linkEmissions,
    USDC: usdcEmissions,
    USDT: usdtEmissions,
    wBTC: wbtcEmissions,
    wETH: wethEmissions,
  }), [stETHEmissions, linkEmissions, usdcEmissions, usdtEmissions, wbtcEmissions, wethEmissions]);

  // Fetch total MOR earned from Capital v2 subgraph (testnet only)
  const totalMorEarnedResult = useTotalMorEarned(userAddress || null, networkEnv);
  const {
    totalEarned: totalMorEarned,
    isLoading: isTotalMorEarnedLoading
  } = totalMorEarnedResult;


  // State for controlling initial vs background loading
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [shouldRefreshData, setShouldRefreshData] = useState(false);
  const lastUserActionRef = useRef<string>('');
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track data freshness to prevent unnecessary skeleton states
  const [hasValidData, setHasValidData] = useState(false);

  // Use extracted hooks - now with dynamic pricing for all assets
  const { stethPrice, linkPrice, getAssetPrice } = useTokenPrices({
    isInitialLoad,
    shouldRefreshData,
    userAddress,
    networkEnv
  });

  const { setCachedUserAssets } = useUserAssetsCache({
    userAddress,
    networkEnv,
    isWalletInitialized,
    onCacheLoaded: (cache) => {
      console.log('📦 Loading cached user assets data:', cache);
      setHasValidData(true);
      setIsInitialLoad(false);
    }
  });

  // Note: Daily emissions loading state is tracked individually in assetEmissions.*.isLoading
  // Could be used for combined loading state if needed: Object.values(assetEmissions).some(emission => emission.isLoading)

  // Handle cache loading and initial state
  useEffect(() => {
    if (!userAddress) {
      setHasValidData(false);
      setIsInitialLoad(true);
      return;
    }

    if (!hasValidData) {
      console.log('🔄 No cached data found, will show initial loading');
      setIsInitialLoad(true);
    }
  }, [userAddress, hasValidData]);

  // Coordinate cached data display with wallet initialization
  useEffect(() => {
    if (isWalletInitialized && !hasValidData) {
      console.log('✅ Wallet initialized - allowing cached data display');
      // If wallet is initialized but we don't have valid data,
      // allow initial load to proceed normally
      setIsInitialLoad(true);
    }
  }, [isWalletInitialized, hasValidData]);

  // Detect when initial data loading is complete for new wallets with no assets
  useEffect(() => {
    if (!userAddress || hasValidData || !isInitialLoad) return;
    
    // Check if all critical loading states are complete
    const isDataLoadingComplete = !isLoadingUserData && !isLoadingBalances && !isLoadingRewards;
    
    if (isDataLoadingComplete) {
      // Check if user truly has no assets (both no deposits and no claimable rewards)
      const stethDeposited = assets.stETH?.userDeposited || BigInt(0);
      const linkDeposited = assets.LINK?.userDeposited || BigInt(0);
      const stethClaimable = assets.stETH?.claimableAmount || BigInt(0);
      const linkClaimable = assets.LINK?.claimableAmount || BigInt(0);
      
      const hasNoAssets = stethDeposited === BigInt(0) && 
                         linkDeposited === BigInt(0) && 
                         stethClaimable === BigInt(0) && 
                         linkClaimable === BigInt(0);
      
      if (hasNoAssets) {
        console.log('✅ Data loading complete - user has no assets, showing empty state');
        setHasValidData(true);
        setIsInitialLoad(false);
      } else {
        console.log('✅ Data loading complete - user has assets, updating state');
        setHasValidData(true);
        setIsInitialLoad(false);
      }
    }
  }, [userAddress, hasValidData, isInitialLoad, isLoadingUserData, isLoadingBalances, isLoadingRewards, assets.stETH?.userDeposited, assets.stETH?.claimableAmount, assets.LINK?.userDeposited, assets.LINK?.claimableAmount]);

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
  }, [isProcessingDeposit, isProcessingClaim, isProcessingWithdraw, isProcessingChangeLock, shouldRefreshData]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  // Check if user has any assets staked (stETH or LINK)
  const hasStakedAssets = useMemo(() => {
    return checkHasStakedAssets(assets);
  }, [assets]);

  // Helper function to get claim unlock date for specific asset using real contract data
  const getAssetUnlockDateCallback = useCallback((assetSymbol: AssetSymbol): string | null => {
    const asset = assets[assetSymbol];
    if (!asset || asset.userDeposited <= BigInt(0)) return null;
    
    // Use the real claim unlock timestamp from contract data
    // The claimUnlockTimestampFormatted includes all 3 conditions from the contract:
    // 1. Minimum claim lock period since last stake must have passed
    // 2. Minimum interval since last claim must have passed  
    // 3. Custom claim lock (claimLockEnd) must have expired
    return asset.claimUnlockTimestampFormatted || null;
  }, [assets]);

  // Helper function to get withdraw unlock date for specific asset using per-asset withdraw logic
  const getAssetWithdrawUnlockDateCallback = useCallback((assetSymbol: AssetSymbol): string | null => {
    const asset = assets[assetSymbol];
    if (!asset || asset.userDeposited <= BigInt(0)) return null;
    
    // Use per-asset withdraw unlock timestamp from contract data
    return asset.withdrawUnlockTimestampFormatted || null;
  }, [assets]);

  // Helper function to check if asset rewards can be claimed using complete unlock logic
  const canAssetClaim = useCallback((assetSymbol: AssetSymbol): boolean => {
    // Use dynamic asset data with proper claim unlock validation
    const asset = assets[assetSymbol];
    if (!asset || asset.claimableAmount <= BigInt(0)) return false;
    
    // Use the asset's own canClaim property which should include all 3 conditions:
    // 1. Minimum claim lock period since last stake must have passed
    // 2. Minimum interval since last claim must have passed  
    // 3. Custom claim lock (claimLockEnd) must have expired
    // 4. Must have claimable rewards > 0
    return asset.canClaim;
  }, [assets]);

  // Helper function to check if specific asset can be withdrawn
  const canAssetWithdraw = useCallback((assetSymbol: AssetSymbol): boolean => {
    const asset = assets[assetSymbol];
    if (!asset || asset.userDeposited <= BigInt(0)) return false;
    
    // Use per-asset withdraw unlock logic from contract data
    return asset.canWithdraw;
  }, [assets]);

  // Helper function to check if withdraw unlock date has passed (for Amount Staked column badge)
  const isWithdrawUnlockDateReachedCallback = useCallback((withdrawUnlockDate: string | null): boolean => {
    return isUnlockDateReached(withdrawUnlockDate, hasStakedAssets);
  }, [hasStakedAssets]);



  // Check if any action is currently processing
  const isAnyActionProcessing = isProcessingDeposit || isProcessingClaim || isProcessingWithdraw || isProcessingChangeLock;

  // State to control which dropdown is open (by asset ID)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Transitions for smooth modal and dropdown interactions
  const [isModalTransitioning, startModalTransition] = useTransition();
  const [isDropdownTransitioning, startDropdownTransition] = useTransition();

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

  // Helper function to handle dropdown menu actions and manage focus properly
  const handleDropdownAction = useCallback((modalType: ModalAction, assetSymbol?: AssetSymbol) => {
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

  // User assets data with real staking amounts for stETH and LINK
  const unsortedUserAssets: UserAsset[] = useMemo(() => {
    if (!hasStakedAssets) {
      return [];
    }

    // Use all available assets from our dynamic system instead of hardcoded list
    const supportedAssets = Object.keys(assets) as AssetSymbol[];

    return supportedAssets.map((assetSymbol, index) => {
      const assetData = assets[assetSymbol];
      if (!assetData) return null;

      // Get asset configuration for metadata
      const assetConfigData = getAssetConfig(assetSymbol, networkEnv);
      if (!assetConfigData) return null;

      // Use dynamic asset data from our assets structure
      const amount = parseFloat(assetData.userDepositedFormatted) || 0;
      const available = parseFloat(assetData.userBalanceFormatted) || 0;
      const claimable = parseFloat(assetData.claimableAmountFormatted) || 0;
      
      // Use dynamic emissions data based on asset symbol
      const emissions = assetEmissions[assetSymbol]?.emissions || 0;
      
        const multiplier = assetData.userMultiplierFormatted;
        const rawClaimUnlockDate = getAssetUnlockDateCallback(assetSymbol);
        const rawWithdrawUnlockDate = getAssetWithdrawUnlockDateCallback(assetSymbol);
        const displayClaimUnlockDate = formatUnlockDate(rawClaimUnlockDate, assetSymbol);
        const displayWithdrawUnlockDate = formatUnlockDate(rawWithdrawUnlockDate, assetSymbol);

        return {
          id: (index + 1).toString(),
          symbol: assetData.symbol,
          assetSymbol: assetSymbol,
          icon: assetData.config.icon,
          amountStaked: amount,
          available: available,
          dailyEmissions: emissions,
          powerFactor: multiplier || "x1.0",
          unlockDate: displayClaimUnlockDate, // For "Claim Unlock Date" column
          withdrawUnlockDate: displayWithdrawUnlockDate, // For "Amount Staked" badge/tooltip  
          availableToClaim: claimable,
          canClaim: canAssetClaim(assetSymbol),
          canWithdraw: canAssetWithdraw(assetSymbol),
        };
    })
    .filter(asset => asset !== null && (asset.amountStaked > 0 || asset.availableToClaim > 0)) as UserAsset[];
  }, [hasStakedAssets, assets, canAssetClaim, getAssetUnlockDateCallback, getAssetWithdrawUnlockDateCallback, assetEmissions, canAssetWithdraw, networkEnv]);

  // Use sorting hook
  const { sortedUserAssets: userAssets, sorting, handleSortingChange } = useAssetsTable(unsortedUserAssets);

  // Calculate metrics from real asset data
  const metricsData = useMemo(() => {
    if (!hasStakedAssets) {
      return {
        stakedValue: "0",
        totalMorStaked: "0",
        dailyEmissionsEarned: "0",
        lifetimeEmissionsEarned: "N/A",
        totalAvailableToClaim: "0",
        referralRewards: "0",
      };
    }

    // Calculate total staked value dynamically across all assets with dynamic pricing
    const totalStakedValue = Object.values(assets).reduce((total, asset) => {
      const stakedAmount = parseDepositAmount(asset.userDepositedFormatted);
      const assetPrice = getAssetPrice(asset.symbol) || 1; // Dynamic price lookup with fallback
      
      return total + (stakedAmount * assetPrice);
    }, 0);

    // Calculate total daily emissions dynamically across all available assets
    const totalDailyEmissions = Object.values(assets).reduce((total, asset) => {
      // Get emissions for this asset dynamically from our assetEmissions mapping
      const emissions = assetEmissions[asset.symbol as keyof typeof assetEmissions]?.emissions || 0;
      return total + emissions;
    }, 0);

    // Calculate total available to claim from table rows
    const totalTableAvailableToClaim = unsortedUserAssets.reduce((sum, asset) => sum + asset.availableToClaim, 0);

    // Calculate lifetime earnings using subgraph data (testnet)
    const lifetimeEarnings = networkEnv === 'testnet'
      ? (isTotalMorEarnedLoading ? "..." : (totalMorEarned > 0 ? formatNumber(totalMorEarned) : "0"))
      : "N/A";

    const freshMetrics = {
      stakedValue: Math.floor(totalStakedValue).toLocaleString(),
      totalMorStaked: "0",
      dailyEmissionsEarned: formatNumber(totalDailyEmissions),
      lifetimeEmissionsEarned: lifetimeEarnings,
      totalAvailableToClaim: formatNumber(totalTableAvailableToClaim),
      referralRewards: "0",
    };

    // Save successful data to cache
    if (userAddress && hasStakedAssets) {
      try {
        const cacheData: UserAssetsCache = {
          metricsData: freshMetrics,
          userAssets: unsortedUserAssets,
          // Legacy cache fields for backward compatibility
          stethPrice: stethPrice,
          linkPrice: linkPrice,
          timestamp: Date.now(),
          userAddress,
          networkEnv
        };
        setCachedUserAssets(cacheData, userAddress, networkEnv);
      } catch (error) {
        console.warn('Error saving metrics to cache:', error);
      }
    }

    return freshMetrics;
  }, [hasStakedAssets, assets, stethPrice, linkPrice, assetEmissions, unsortedUserAssets, networkEnv, isTotalMorEarnedLoading, totalMorEarned, userAddress, setCachedUserAssets, getAssetPrice]);


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
                </div>
              </div>

              {/* Metric Cards */}
              <UserAssetsMetrics
                metricsData={metricsData}
                isLoading={!isWalletInitialized || isAuthLoading || (isInitialLoad && !hasValidData)}
              />

              {/* Assets table or empty state */}
              {hasStakedAssets || (!isWalletInitialized || isAuthLoading || (isInitialLoad && !hasValidData)) ? (
                <UserAssetsTable
                  userAssets={userAssets}
                  isLoading={!isWalletInitialized || isAuthLoading || (isInitialLoad && !hasValidData)}
                  sorting={sorting}
                  onSortingChangeAction={handleSortingChange}
                  onDropdownOpenChangeAction={handleDropdownOpenChange}
                  onDropdownActionAction={handleDropdownAction}
                  openDropdownId={openDropdownId}
                  isWithdrawUnlockDateReachedAction={isWithdrawUnlockDateReachedCallback}
                  isAnyActionProcessing={isAnyActionProcessing}
                  isModalTransitioning={isModalTransitioning}
                  isDropdownTransitioning={isDropdownTransitioning}
                />
              ) : (
                <EmptyAssetsState
                  userAddress={userAddress}
                  onDepositAction={() => setActiveModal('deposit')}
                  isProcessing={isAnyActionProcessing}
                  isModalTransitioning={isModalTransitioning}
                />
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
