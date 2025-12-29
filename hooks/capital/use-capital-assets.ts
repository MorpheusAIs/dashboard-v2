"use client";

/**
 * Hook for computing and managing asset data
 * Builds the dynamic assets record from contract data
 */

import { useMemo, useCallback } from "react";
import { parseUnits, zeroAddress } from "viem";
import type { NetworkEnvironment } from "@/config/networks";
import { getContractAddress } from "@/config/networks";
import {
  getAssetConfig,
  getAssetsForNetwork,
  type AssetSymbol,
} from "@/components/capital/constants/asset-config";
import type { AssetData } from "@/context/capital/types";
import type { AssetContractData } from "@/hooks/use-asset-contract-data";
import { getDepositPoolContractName } from "@/lib/utils/capital-helpers";

export interface CapitalAssetsOptions {
  networkEnv: NetworkEnvironment;
  l1ChainId: number;
  assetContractData: Record<AssetSymbol, AssetContractData>;
}

export interface CapitalAssetsResult {
  assets: Record<AssetSymbol, AssetData>;

  // Utility functions
  needsApproval: (asset: AssetSymbol, amount: string) => boolean;
  checkAndUpdateApprovalNeeded: (asset: AssetSymbol, amount: string) => Promise<boolean>;

  // Aggregated data
  totalDepositedUSD: bigint;
  totalClaimableAmount: bigint;

  // Loading state
  isLoadingAssetData: boolean;
  isLoadingTotalDeposits: boolean;
  isLoadingAllowances: boolean;
}

export function useCapitalAssets(options: CapitalAssetsOptions): CapitalAssetsResult {
  const { networkEnv, l1ChainId, assetContractData } = options;

  // --- Build Assets Structure Dynamically ---
  const assets = useMemo((): Record<AssetSymbol, AssetData> => {
    // Helper to get available assets that have both metadata AND deployed contracts
    const getAvailableAssetsWithContracts = () => {
      const assetsFromConfig = getAssetsForNetwork(networkEnv);
      const availableAssets: typeof assetsFromConfig = [];

      assetsFromConfig.forEach((assetInfo) => {
        const symbol = assetInfo.metadata.symbol;
        const depositPoolContractName = getDepositPoolContractName(symbol);

        if (depositPoolContractName && l1ChainId) {
          const depositPoolAddress = getContractAddress(l1ChainId, depositPoolContractName, networkEnv);

          // Only include assets that have:
          // 1. Metadata in asset-config.ts
          // 2. Deposit pool contract defined in networks.ts
          // 3. Non-empty deposit pool address (contract is deployed)
          if (depositPoolAddress && depositPoolAddress !== "" && depositPoolAddress !== zeroAddress) {
            availableAssets.push(assetInfo);
          }
        }
      });

      return availableAssets;
    };

    const availableAssets = getAvailableAssetsWithContracts();
    const assetsRecord: Record<string, AssetData> = {};

    // Build assets structure from dynamic contract data
    availableAssets.forEach((assetInfo) => {
      const symbol = assetInfo.metadata.symbol;
      const contractData = assetContractData[symbol as AssetSymbol];

      // Only include assets that have deployed contracts (non-zero addresses)
      if (contractData.depositPoolAddress !== zeroAddress) {
        assetsRecord[symbol] = {
          symbol,
          config: {
            symbol,
            depositPoolAddress: contractData.depositPoolAddress,
            tokenAddress: contractData.tokenAddress,
            decimals: assetInfo.metadata.decimals,
            icon: assetInfo.metadata.icon,
          },
          // All data comes from the dynamic hook
          userBalance: contractData.userBalance,
          userDeposited: contractData.userDeposited,
          userAllowance: contractData.userAllowance,
          claimableAmount: contractData.claimableAmount,
          userMultiplier: contractData.userMultiplier,
          totalDeposited: contractData.totalDeposited,
          protocolDetails: null,
          poolData: null,
          claimUnlockTimestamp: contractData.claimUnlockTimestamp,
          withdrawUnlockTimestamp: contractData.withdrawUnlockTimestamp,
          // Formatted data from hook
          userBalanceFormatted: contractData.userBalanceFormatted,
          userDepositedFormatted: contractData.userDepositedFormatted,
          claimableAmountFormatted: contractData.claimableAmountFormatted,
          userMultiplierFormatted: contractData.userMultiplierFormatted,
          totalDepositedFormatted: contractData.totalDepositedFormatted,
          minimalStakeFormatted: "100",
          claimUnlockTimestampFormatted: contractData.claimUnlockTimestampFormatted,
          withdrawUnlockTimestampFormatted: contractData.withdrawUnlockTimestampFormatted,
          // Eligibility flags from hook
          canClaim: contractData.canClaim,
          canWithdraw: contractData.canWithdraw,
        };
      }
    });

    return assetsRecord as Record<AssetSymbol, AssetData>;
  }, [networkEnv, l1ChainId, assetContractData]);

  // --- Utility Functions ---
  const needsApproval = useCallback(
    (asset: AssetSymbol, amountString: string): boolean => {
      try {
        const assetInfo = getAssetConfig(asset, networkEnv);
        if (!assetInfo) return false;

        const amountBigInt = amountString ? parseUnits(amountString, assetInfo.metadata.decimals) : BigInt(0);
        if (amountBigInt <= BigInt(0)) return false;

        const assetData = assets[asset];
        if (!assetData) return false;

        return assetData.userAllowance < amountBigInt;
      } catch {
        return false;
      }
    },
    [networkEnv, assets]
  );

  const checkAndUpdateApprovalNeeded = useCallback(
    async (asset: AssetSymbol, amountString: string): Promise<boolean> => {
      try {
        const assetInfo = getAssetConfig(asset, networkEnv);
        if (!assetInfo) return false;

        const amountBigInt = amountString ? parseUnits(amountString, assetInfo.metadata.decimals) : BigInt(0);
        if (amountBigInt <= BigInt(0)) return false;

        const assetData = assetContractData[asset];
        if (!assetData) {
          console.error(`Asset data not found for ${asset}`);
          return false;
        }

        // Refetch allowance dynamically for any asset
        await assetData.refetch.allowance();
        const currentAllowanceValue = assetData.userAllowance;

        return currentAllowanceValue < amountBigInt;
      } catch (error) {
        console.error(`Error checking approval status for ${asset}:`, error);
        return false;
      }
    },
    [networkEnv, assetContractData]
  );

  // --- Aggregated Data ---
  const totalDepositedUSD = useMemo(() => {
    return Object.values(assets).reduce((total, asset) => total + asset.totalDeposited, BigInt(0));
  }, [assets]);

  const totalClaimableAmount = useMemo(() => {
    return Object.values(assets).reduce((total, asset) => total + asset.claimableAmount, BigInt(0));
  }, [assets]);

  // --- Loading States ---
  const isLoadingAssetData = Object.values(assetContractData).some((asset) => asset.isLoading);
  const isLoadingTotalDeposits = Object.values(assetContractData).some((asset) => asset.isLoading);
  const isLoadingAllowances = Object.values(assetContractData).some((asset) => asset.isLoading);

  return {
    assets,
    needsApproval,
    checkAndUpdateApprovalNeeded,
    totalDepositedUSD,
    totalClaimableAmount,
    isLoadingAssetData,
    isLoadingTotalDeposits,
    isLoadingAllowances,
  };
}
