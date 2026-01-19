"use client";

import React, { createContext, useContext, useMemo } from "react";
import {
  type AssetSymbol,
  getEnabledAssets,
} from "@/components/capital/constants/asset-config";
import { useAssetContractData, type AssetContractData } from "@/hooks/use-asset-contract-data";
import { useCapitalNetworkEnv } from "./CapitalNetworkContext";
import { type AssetData, type PoolInfoData, type PoolLimitsData } from "./types";

// ============================================================================
// Context State Interface
// ============================================================================

interface CapitalAssetsState {
  // Asset contract data by symbol
  assetContractData: Record<AssetSymbol, AssetContractData>;

  // Computed assets record with full data
  assets: Partial<Record<AssetSymbol, AssetData>>;

  // Available/enabled asset symbols for current network
  availableAssets: AssetSymbol[];

  // Loading states
  isLoadingAssets: boolean;
  isLoadingBalances: boolean;
  isLoadingAllowances: boolean;
  isLoadingRewards: boolean;
  isLoadingTotalDeposits: boolean;

  // Refetch all asset data
  refetchAllAssets: () => void;
}

// ============================================================================
// Context Creation
// ============================================================================

const CapitalAssetsContext = createContext<CapitalAssetsState | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

interface CapitalAssetsProviderProps {
  children: React.ReactNode;
}

export function CapitalAssetsProvider({ children }: CapitalAssetsProviderProps) {
  const { networkEnv } = useCapitalNetworkEnv();

  // Get asset contract data for each asset using the existing hook
  // The hook handles enabling/disabling based on contract availability
  const stETHData = useAssetContractData("stETH");
  const linkData = useAssetContractData("LINK");
  const usdcData = useAssetContractData("USDC");
  const usdtData = useAssetContractData("USDT");
  const wbtcData = useAssetContractData("wBTC");
  const wethData = useAssetContractData("wETH");

  // Combine all asset contract data
  const assetContractData = useMemo<Record<AssetSymbol, AssetContractData>>(() => ({
    stETH: stETHData,
    LINK: linkData,
    USDC: usdcData,
    USDT: usdtData,
    wBTC: wbtcData,
    wETH: wethData,
  }), [stETHData, linkData, usdcData, usdtData, wbtcData, wethData]);

  // Get available/enabled assets for current network
  const availableAssets = useMemo<AssetSymbol[]>(() => {
    const enabledAssetInfos = getEnabledAssets(networkEnv);
    return enabledAssetInfos.map((info) => info.metadata.symbol);
  }, [networkEnv]);

  // Build the full assets record
  const assets = useMemo<Partial<Record<AssetSymbol, AssetData>>>(() => {
    const assetsRecord: Partial<Record<AssetSymbol, AssetData>> = {};
    const enabledAssetInfos = getEnabledAssets(networkEnv);

    enabledAssetInfos.forEach((assetInfo) => {
      const symbol = assetInfo.metadata.symbol;
      const contractData = assetContractData[symbol];

      // Only include assets that have deployed contracts (non-zero addresses)
      if (
        contractData.depositPoolAddress === "0x0000000000000000000000000000000000000000" ||
        contractData.tokenAddress === "0x0000000000000000000000000000000000000000"
      ) {
        return; // Skip assets without deployed contracts
      }

      assetsRecord[symbol] = {
        symbol,
        config: {
          symbol,
          depositPoolAddress: contractData.depositPoolAddress,
          tokenAddress: contractData.tokenAddress,
          decimals: assetInfo.metadata.decimals,
          icon: assetInfo.metadata.icon,
        },
        // User-specific data
        userBalance: contractData.userBalance,
        userDeposited: contractData.userDeposited,
        userAllowance: contractData.userAllowance,
        claimableAmount: contractData.claimableAmount,
        userMultiplier: contractData.userMultiplier,
        // Pool-specific data
        totalDeposited: contractData.totalDeposited,
        protocolDetails: null as PoolLimitsData | null, // Can be populated later if needed
        poolData: null as PoolInfoData | null, // Can be populated later if needed
        // Unlock timestamps
        claimUnlockTimestamp: contractData.claimUnlockTimestamp,
        withdrawUnlockTimestamp: contractData.withdrawUnlockTimestamp,
        // Formatted for display
        userBalanceFormatted: contractData.userBalanceFormatted,
        userDepositedFormatted: contractData.userDepositedFormatted,
        claimableAmountFormatted: contractData.claimableAmountFormatted,
        userMultiplierFormatted: contractData.userMultiplierFormatted,
        totalDepositedFormatted: contractData.totalDepositedFormatted,
        minimalStakeFormatted: "0", // Can be fetched from pool data if needed
        claimUnlockTimestampFormatted: contractData.claimUnlockTimestampFormatted,
        withdrawUnlockTimestampFormatted: contractData.withdrawUnlockTimestampFormatted,
        // Eligibility flags
        canClaim: contractData.canClaim,
        canWithdraw: contractData.canWithdraw,
      };
    });

    return assetsRecord;
  }, [networkEnv, assetContractData]);

  // Combined loading states
  const isLoadingAssets = useMemo(() => {
    return Object.values(assetContractData).some((asset) => asset.isLoading);
  }, [assetContractData]);

  const isLoadingBalances = isLoadingAssets;
  const isLoadingAllowances = isLoadingAssets;
  const isLoadingRewards = isLoadingAssets;
  const isLoadingTotalDeposits = isLoadingAssets;

  // Refetch function
  const refetchAllAssets = useMemo(() => {
    return () => {
      Object.values(assetContractData).forEach((asset) => asset.refetch.all());
    };
  }, [assetContractData]);

  // Memoized context value
  const value = useMemo<CapitalAssetsState>(
    () => ({
      assetContractData,
      assets,
      availableAssets,
      isLoadingAssets,
      isLoadingBalances,
      isLoadingAllowances,
      isLoadingRewards,
      isLoadingTotalDeposits,
      refetchAllAssets,
    }),
    [
      assetContractData,
      assets,
      availableAssets,
      isLoadingAssets,
      isLoadingBalances,
      isLoadingAllowances,
      isLoadingRewards,
      isLoadingTotalDeposits,
      refetchAllAssets,
    ]
  );

  return (
    <CapitalAssetsContext.Provider value={value}>
      {children}
    </CapitalAssetsContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useCapitalAssets(): CapitalAssetsState {
  const context = useContext(CapitalAssetsContext);
  if (!context) {
    throw new Error("useCapitalAssets must be used within a CapitalAssetsProvider");
  }
  return context;
}

// ============================================================================
// Selective Hooks
// ============================================================================

/**
 * Get only the assets record
 */
export function useAssets() {
  const { assets, availableAssets, isLoadingAssets } = useCapitalAssets();
  return { assets, availableAssets, isLoadingAssets };
}

/**
 * Get data for a specific asset
 */
export function useAssetData(symbol: AssetSymbol) {
  const { assetContractData } = useCapitalAssets();
  return assetContractData[symbol];
}

/**
 * Get loading states
 */
export function useAssetLoadingStates() {
  const {
    isLoadingAssets,
    isLoadingBalances,
    isLoadingAllowances,
    isLoadingRewards,
    isLoadingTotalDeposits,
  } = useCapitalAssets();
  return {
    isLoadingAssets,
    isLoadingBalances,
    isLoadingAllowances,
    isLoadingRewards,
    isLoadingTotalDeposits,
  };
}

/**
 * Get refetch function for all assets
 */
export function useRefetchAssets() {
  const { refetchAllAssets, assetContractData } = useCapitalAssets();
  return { refetchAllAssets, assetContractData };
}
