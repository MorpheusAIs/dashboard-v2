"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
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


export function UserAssetsPanel() {
  const {
    userAddress,
    setActiveModal,
    setSelectedAsset,
    isLoadingUserData,
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

  // Combined loading state for total daily emissions
  const isDailyEmissionsLoading = isStETHEmissionsLoading || isLinkEmissionsLoading;

  // State for sorting
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // State for token prices from CoinGecko
  const [stethPrice, setStethPrice] = useState<number | null>(null);
  const [linkPrice, setLinkPrice] = useState<number | null>(null);

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
    // Use V2-specific unlock timestamps
    if (assetSymbol === 'stETH') {
      return stETHV2ClaimUnlockTimestampFormatted && stETHV2ClaimUnlockTimestampFormatted !== "--- --, ----" 
        ? stETHV2ClaimUnlockTimestampFormatted 
        : null;
    }
    
    if (assetSymbol === 'LINK') {
      return linkV2ClaimUnlockTimestampFormatted && linkV2ClaimUnlockTimestampFormatted !== "--- --, ----" 
        ? linkV2ClaimUnlockTimestampFormatted 
        : null;
    }
    
    return null;
  }, [stETHV2ClaimUnlockTimestampFormatted, linkV2ClaimUnlockTimestampFormatted]);

  // Helper function to check if asset rewards can be claimed
  const canAssetClaim = useCallback((assetSymbol: 'stETH' | 'LINK'): boolean => {
    // Use V2-specific claim eligibility
    if (assetSymbol === 'stETH') return stETHV2CanClaim;
    if (assetSymbol === 'LINK') return linkV2CanClaim;
    return false;
  }, [stETHV2CanClaim, linkV2CanClaim]);

  // Helper function to check if unlock date has passed (for withdraw functionality)
  const isUnlockDateReached = useCallback((unlockDate: string | null): boolean => {
    if (!unlockDate || unlockDate === "--- --, ----" || unlockDate === "Never" || unlockDate === "Invalid Date") {
      return false; // No unlock date set, invalid, or never unlocks
    }
    
    try {
      // Parse the unlock date string (format: "Aug 16, 2025, 5:30 PM" from toLocaleString)
      const unlockDateTime = new Date(unlockDate);
      const currentDate = new Date();
      
      // Validate that the date was parsed correctly
      if (isNaN(unlockDateTime.getTime())) {
        console.error('Invalid unlock date parsed:', unlockDate);
        return false;
      }
      
      // Compare dates including time
      const unlockReached = currentDate >= unlockDateTime;
      
      return unlockReached;
    } catch (error) {
      console.error('Error parsing unlock date:', unlockDate, error);
      return false; // If parsing fails, assume not unlocked
    }
  }, []);

  // Check if user has any assets staked (stETH or LINK)
  const hasStakedAssets = useMemo(() => {
    const stethDeposited = parseDepositAmount(assets.stETH?.userDepositedFormatted);
    const linkDeposited = parseDepositAmount(assets.LINK?.userDepositedFormatted);
    return stethDeposited > 0 || linkDeposited > 0;
  }, [assets]);

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

  // Fetch token prices from CoinGecko on component mount
  useEffect(() => {
    async function fetchTokenPrices() {
      try {
        const [stethPriceData, linkPriceData] = await Promise.all([
          getTokenPrice('staked-ether', 'usd'), // stETH/Lido token ID
          getTokenPrice('chainlink', 'usd')     // LINK token ID
        ]);
        
        setStethPrice(stethPriceData);
        setLinkPrice(linkPriceData);
        
        // console.log('💰 Token prices fetched:', {
        //   stETH: stethPriceData,
        //   LINK: linkPriceData
        // });
      } catch (error) {
        console.error('Error fetching token prices:', error);
      }
    }

    fetchTokenPrices();
  }, []);

  // State to control which dropdown is open (by asset ID)
  // This prevents multiple dropdowns from being open simultaneously and fixes ARIA focus conflicts
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Helper function to handle dropdown menu actions and manage focus properly
  const handleDropdownAction = useCallback((modalType: 'deposit' | 'withdraw' | 'changeLock' | 'claim' | 'claimMorRewards' | 'stakeMorRewards', assetSymbol?: AssetSymbol) => {
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
    // Then open modal after a short delay to allow dropdown to close properly
    setTimeout(() => {
      setActiveModal(modalType);
    }, 100);
  }, [setActiveModal, setSelectedAsset]);

  // Handle dropdown state changes to manage focus
  const handleDropdownOpenChange = useCallback((assetId: string, open: boolean) => {
    if (open) {
      setOpenDropdownId(assetId);
    } else {
      setOpenDropdownId(null);
      // When dropdown closes, ensure no element retains focus that could conflict with modals
      setTimeout(() => {
        if (document.activeElement && document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }, 50);
    }
  }, []);

  // User assets data will be calculated first, then metrics will use it

  // User assets data with real staking amounts for stETH and LINK
  const userAssets: UserAsset[] = useMemo(() => {
    if (!hasStakedAssets) return [];

    const stethAmount = parseDepositAmount(assets.stETH?.userDepositedFormatted);
    const linkAmount = parseDepositAmount(assets.LINK?.userDepositedFormatted);
    const stethAvailable = parseDepositAmount(assets.stETH?.userBalanceFormatted);
    const linkAvailable = parseDepositAmount(assets.LINK?.userBalanceFormatted);
    const stethClaimable = parseDepositAmount(assets.stETH?.claimableAmountFormatted);
    const linkClaimable = parseDepositAmount(assets.LINK?.claimableAmountFormatted);
    
    return [
      {
        id: "1",
        symbol: "stETH",
        assetSymbol: 'stETH' as AssetSymbol,
        icon: "eth",
        amountStaked: stethAmount,
        available: stethAvailable,
        dailyEmissions: stETHDailyEmissions,
        powerFactor: parseFloat(assets.stETH?.userMultiplierFormatted?.replace('x', '') || '0'),
        unlockDate: getAssetUnlockDate('stETH'),
        availableToClaim: stethClaimable,
        canClaim: canAssetClaim('stETH'),
      },
      {
        id: "2",
        symbol: "LINK",
        assetSymbol: 'LINK' as AssetSymbol,
        icon: "link",
        amountStaked: linkAmount,
        available: linkAvailable,
        dailyEmissions: linkDailyEmissions,
        powerFactor: parseFloat(assets.LINK?.userMultiplierFormatted?.replace('x', '') || '0'),
        unlockDate: getAssetUnlockDate('LINK'),
        availableToClaim: linkClaimable,
        canClaim: canAssetClaim('LINK'),
      },
    ].filter(asset => asset.amountStaked > 0 || asset.availableToClaim > 0); // Only show assets with activity
  }, [hasStakedAssets, assets, canAssetClaim, getAssetUnlockDate, stETHDailyEmissions, linkDailyEmissions]);

  // Calculate metrics from real asset data - now using userAssets for accurate table totals
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

    const stethStaked = parseDepositAmount(assets.stETH?.userDepositedFormatted);
    const linkStaked = parseDepositAmount(assets.LINK?.userDepositedFormatted);
    
    // Calculate USD value using CoinGecko prices
    const stethUSDValue = stethPrice ? stethStaked * stethPrice : 0;
    const linkUSDValue = linkPrice ? linkStaked * linkPrice : 0;
    const totalStakedValue = stethUSDValue + linkUSDValue;
    
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
    
    return {
      stakedValue: Math.floor(totalStakedValue).toLocaleString(), // Format as whole dollars with commas
      totalMorStaked: "0", // TODO: Calculate total MOR staked if applicable
      dailyEmissionsEarned: formatNumber(totalDailyEmissions),
      lifetimeEmissionsEarned: lifetimeEarnings, // N/A until we have historical claimed data
      totalAvailableToClaim: formatNumber(totalTableAvailableToClaim), // Sum from actual table rows
      referralRewards: "0", // TODO: Add referral rewards from context
    };
  }, [hasStakedAssets, assets, stethPrice, linkPrice, stETHDailyEmissions, linkDailyEmissions, userAssets, networkEnv, isTotalMorEarnedLoading, totalMorEarned]);

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
          // Determine if this specific asset is loading
          const isAssetLoading = (asset.symbol === 'stETH' && isStETHEmissionsLoading) || 
                                 (asset.symbol === 'LINK' && isLinkEmissionsLoading);
          
          return (
            <span className="text-gray-200">
              {isAssetLoading ? (
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
        enableSorting: true,
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
              <Button variant="ghost" size="icon" className="h-8 w-8 p-0" disabled={isAnyActionProcessing}>
                <Ellipsis className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="mt-2">
              <DropdownMenuItem onClick={() => handleDropdownAction('stakeMorRewards', asset.assetSymbol)} disabled={isAnyActionProcessing}>
                <TrendingUp className="mr-2 h-4 w-4" /> 
                Stake Rewards
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleDropdownAction('withdraw', asset.assetSymbol)} 
                disabled={isAnyActionProcessing || !isUnlockDateReached(asset.unlockDate)}
                className={!isUnlockDateReached(asset.unlockDate) ? "text-gray-500 cursor-not-allowed" : ""}
              >
                <ArrowDownToLine className="mr-2 h-4 w-4" /> 
                Withdraw
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleDropdownAction('claimMorRewards', asset.assetSymbol)}
                disabled={isAnyActionProcessing || asset.availableToClaim <= 0}
                className={asset.availableToClaim <= 0 ? "text-gray-500 cursor-not-allowed" : ""}
              >
                <Lock className="mr-2 h-4 w-4" />
                Lock Rewards
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleDropdownAction('claimMorRewards', asset.assetSymbol)} 
                disabled={isAnyActionProcessing || !asset.canClaim}
                className={!asset.canClaim ? "text-gray-500 cursor-not-allowed" : ""}
              >
                <HandCoins className="mr-2 h-4 w-4" /> 
                Claim Rewards
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [isAnyActionProcessing, handleDropdownAction, openDropdownId, handleDropdownOpenChange, isUnlockDateReached, isStETHEmissionsLoading, isLinkEmissionsLoading]
  );

  // Handle sorting change
  const handleSortingChange = (columnId: string) => {
    if (sortColumn === columnId) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to asc
      setSortColumn(columnId);
      setSortDirection('asc');
    }
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
        disabled={!userAddress || isAnyActionProcessing}
        >
          Deposit
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
                <button
                    className={!userAddress || isAnyActionProcessing ? "copy-button-secondary px-4 py-2 disabled:cursor-not-allowed" : "copy-button-base"}
                    onClick={() => setActiveModal('deposit')}
                    disabled={!userAddress || isAnyActionProcessing}
                >
                  Deposit
                </button>
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
                isLoading={isLoadingUserData}
              />
              <MetricCardMinimal
                title="Current Daily Rewards"
                value={metricsData.dailyEmissionsEarned}
                label="MOR"
                disableGlow={true}
                autoFormatNumbers={true}
                className="col-span-1"
                isLoading={isLoadingUserData || isDailyEmissionsLoading}
              />
               <MetricCardMinimal
                 title="Claimable Rewards"
                 value={metricsData.totalAvailableToClaim}
                 label="MOR"
                 disableGlow={true}
                 autoFormatNumbers={true}
                 className="col-span-1"
                 isLoading={isLoadingUserData}
               />
              <MetricCardMinimal
                title="Total MOR Earned"
                value={metricsData.lifetimeEmissionsEarned}
                label="MOR"
                disableGlow={true}
                autoFormatNumbers={true}
                className="col-span-1"
                isLoading={isLoadingUserData || (networkEnv === 'testnet' && isTotalMorEarnedLoading)}
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
            {hasStakedAssets || isLoadingUserData ? (
              <div className="[&>div]:max-h-[400px] overflow-auto custom-scrollbar">
                <DataTable
                  columns={assetsColumns}
                  data={userAssets}
                  isLoading={isLoadingUserData}
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