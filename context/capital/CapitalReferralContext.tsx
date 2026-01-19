"use client";

import React, { createContext, useContext, useMemo, useCallback } from "react";
import { useContractReads } from "wagmi";
import { zeroAddress } from "viem";
import { useReferralData, useReferrerSummary } from "@/hooks/use-referral-data";
import { useCapitalNetwork } from "./CapitalNetworkContext";
import { formatBigInt } from "@/lib/utils/formatters";
import { getContractAddress, type ContractAddresses } from "@/config/networks";
import { getAssetsForNetwork } from "@/components/capital/constants/asset-config";
import DepositPoolAbi from "@/app/abi/DepositPool.json";
import type { AssetSymbol, ReferralAmountByAsset, ReferralContractData } from "./types";

const V2_REWARD_POOL_INDEX = BigInt(0);

// Maps asset symbols to their corresponding deposit pool contract names in networks.ts
const getDepositPoolContractName = (symbol: AssetSymbol): keyof ContractAddresses | null => {
  const mapping: Record<AssetSymbol, keyof ContractAddresses> = {
    'stETH': 'stETHDepositPool',
    'LINK': 'linkDepositPool',
    'USDC': 'usdcDepositPool',
    'USDT': 'usdtDepositPool',
    'wBTC': 'wbtcDepositPool',
    'wETH': 'wethDepositPool',
  };
  return mapping[symbol] || null;
};

// ============================================================================
// Context State Interface
// ============================================================================

interface CapitalReferralState {
  // Referral counts
  totalReferrals: number;
  totalReferralAmount: bigint;
  totalReferralAmountFormatted: string;

  // MOR earned through referrals
  totalMorEarned: bigint;
  totalMorEarnedFormatted: string;

  // Unique referral addresses
  uniqueReferrals: Set<string>;

  // Per-asset referral data (from summary)
  referralAmountsByAsset: ReferralAmountByAsset[];

  // Claimable referral rewards per asset (from contract reads)
  referralRewardsByAsset: Partial<Record<AssetSymbol, bigint>>;
  referrerDetailsByAsset: Partial<Record<AssetSymbol, ReferralContractData | null>>;
  assetsWithClaimableRewards: AssetSymbol[];
  availableReferralAssets: AssetSymbol[];

  // Asset config map for claiming
  referralAssetConfigMap: Map<AssetSymbol, { symbol: AssetSymbol; depositPoolAddress: `0x${string}` }>;

  // Loading states
  isLoadingReferralData: boolean;
  isLoadingReferrerSummary: boolean;
  isLoadingReferralRewards: boolean;

  // Errors
  referralError: string | null;
  summaryError: string | null;
}

// ============================================================================
// Context Creation
// ============================================================================

const CapitalReferralContext = createContext<CapitalReferralState | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

interface CapitalReferralProviderProps {
  children: React.ReactNode;
}

export function CapitalReferralProvider({ children }: CapitalReferralProviderProps) {
  const { userAddress, networkEnv, l1ChainId } = useCapitalNetwork();

  // Use existing referral hooks
  const {
    isLoading: isLoadingReferralData,
    error: referralError,
    totalReferrals,
    totalReferralAmount,
    uniqueReferrals,
    // rawData not needed - metrics are computed from totalReferrals, totalReferralAmount
  } = useReferralData({
    userAddress,
    networkEnvironment: networkEnv,
  });

  const {
    isLoading: isLoadingReferrerSummary,
    error: summaryError,
    totalMorEarned,
    rawData: summaryRawData,
  } = useReferrerSummary({
    userAddress,
    networkEnvironment: networkEnv,
  });

  // Build referral asset configs with deposit pool addresses
  const referralAssetConfigs = useMemo(() => {
    if (!l1ChainId) return [];

    const assetsFromConfig = getAssetsForNetwork(networkEnv);

    return assetsFromConfig
      .map((assetInfo) => {
        const symbol = assetInfo.metadata.symbol;
        const depositPoolContractName = getDepositPoolContractName(symbol);

        if (!depositPoolContractName) {
          return null;
        }

        const address = getContractAddress(l1ChainId, depositPoolContractName, networkEnv);

        if (!address || address === '' || address === zeroAddress) {
          return null;
        }

        return {
          symbol,
          depositPoolAddress: address as `0x${string}`,
        };
      })
      .filter((config): config is { symbol: AssetSymbol; depositPoolAddress: `0x${string}` } => config !== null);
  }, [l1ChainId, networkEnv]);

  // Build asset config map for easy lookup
  const referralAssetConfigMap = useMemo(() => {
    const map = new Map<AssetSymbol, { symbol: AssetSymbol; depositPoolAddress: `0x${string}` }>();
    referralAssetConfigs.forEach((config) => {
      map.set(config.symbol, config);
    });
    return map;
  }, [referralAssetConfigs]);

  // Contract read configs for referral rewards
  const referralRewardContracts = useMemo(() => {
    if (!userAddress) return [];

    return referralAssetConfigs.map((config) => ({
      address: config.depositPoolAddress,
      abi: DepositPoolAbi,
      functionName: 'getLatestReferrerReward' as const,
      args: [V2_REWARD_POOL_INDEX, userAddress] as const,
      chainId: l1ChainId,
    }));
  }, [referralAssetConfigs, l1ChainId, userAddress]);

  // Contract read configs for referrer details
  const referrerDataContracts = useMemo(() => {
    if (!userAddress) return [];

    return referralAssetConfigs.map((config) => ({
      address: config.depositPoolAddress,
      abi: DepositPoolAbi,
      functionName: 'referrersData' as const,
      args: [userAddress, V2_REWARD_POOL_INDEX] as const,
      chainId: l1ChainId,
    }));
  }, [referralAssetConfigs, l1ChainId, userAddress]);

  // Fetch referral rewards from contracts
  const { data: referralRewardsResults, isLoading: isLoadingReferralRewards } = useContractReads({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: referralRewardContracts as any,
    allowFailure: true,
    query: {
      enabled: referralRewardContracts.length > 0 && !!userAddress,
    },
  });

  // Fetch referrer details from contracts
  const { data: referrerDetailsResults } = useContractReads({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: referrerDataContracts as any,
    allowFailure: true,
    query: {
      enabled: referrerDataContracts.length > 0 && !!userAddress,
    },
  });

  // Parse referral rewards by asset
  const referralRewardsByAsset = useMemo(() => {
    const rewards: Partial<Record<AssetSymbol, bigint>> = {};

    referralAssetConfigs.forEach((config, index) => {
      const result = referralRewardsResults?.[index];
      let value: bigint = BigInt(0);

      if (result && typeof result === 'object') {
        if ('result' in result && result.status === 'success') {
          value = result.result as bigint;
        }
      } else if (typeof result === 'bigint') {
        value = result;
      }

      rewards[config.symbol] = value;
    });

    return rewards;
  }, [referralAssetConfigs, referralRewardsResults]);

  // Parse referrer details
  const parseReferralData = useCallback((referralDataRaw: unknown): ReferralContractData | null => {
    if (!referralDataRaw || !Array.isArray(referralDataRaw)) return null;
    const [amountStaked, virtualAmountStaked, rate, pendingRewards, lastClaim] = referralDataRaw;
    return {
      amountStaked: amountStaked as bigint,
      virtualAmountStaked: virtualAmountStaked as bigint,
      rate: rate as bigint,
      pendingRewards: pendingRewards as bigint,
      lastClaim: lastClaim as bigint,
    };
  }, []);

  const referrerDetailsByAsset = useMemo(() => {
    const details: Partial<Record<AssetSymbol, ReferralContractData | null>> = {};

    referralAssetConfigs.forEach((config, index) => {
      const raw = referrerDetailsResults?.[index];
      // Handle useContractReads result structure
      let extractedResult: unknown = raw;
      if (raw && typeof raw === 'object' && 'result' in raw && (raw as { status?: string }).status === 'success') {
        extractedResult = (raw as { result: unknown }).result;
      }
      details[config.symbol] = parseReferralData(extractedResult);
    });

    return details;
  }, [parseReferralData, referrerDetailsResults, referralAssetConfigs]);

  // Compute assets with claimable rewards
  const assetsWithClaimableRewards = useMemo(() => {
    return referralAssetConfigs
      .filter((config) => (referralRewardsByAsset[config.symbol] ?? BigInt(0)) > BigInt(0))
      .map((config) => config.symbol);
  }, [referralAssetConfigs, referralRewardsByAsset]);

  // Available referral assets
  const availableReferralAssets = useMemo(() => {
    return referralAssetConfigs.map((config) => config.symbol);
  }, [referralAssetConfigs]);

  // Format amounts
  const totalReferralAmountFormatted = useMemo(
    () => formatBigInt(totalReferralAmount, 18, 4),
    [totalReferralAmount]
  );

  const totalMorEarnedFormatted = useMemo(
    () => formatBigInt(totalMorEarned, 18, 4),
    [totalMorEarned]
  );

  // Build per-asset referral amounts from summary data
  const referralAmountsByAsset = useMemo<ReferralAmountByAsset[]>(() => {
    if (!summaryRawData) return [];

    const assetKeys: { key: keyof typeof summaryRawData; symbol: AssetSymbol }[] = [
      { key: "stETH_referrer", symbol: "stETH" },
      { key: "wBTC_referrer", symbol: "wBTC" },
      { key: "wETH_referrer", symbol: "wETH" },
      { key: "USDC_referrer", symbol: "USDC" },
      { key: "USDT_referrer", symbol: "USDT" },
    ];

    const result: ReferralAmountByAsset[] = [];

    assetKeys.forEach(({ key, symbol }) => {
      const referrers = summaryRawData[key];
      if (!referrers || referrers.length === 0) return;

      // Sum all referral amounts for this asset
      const totalAmount = referrers.reduce((sum, referrer) => {
        const referralSum = referrer.referrals.reduce((refSum, ref) => {
          try {
            return refSum + BigInt(ref.amount);
          } catch {
            return refSum;
          }
        }, BigInt(0));
        return sum + referralSum;
      }, BigInt(0));

      if (totalAmount > BigInt(0)) {
        result.push({
          asset: symbol,
          amount: totalAmount,
          formattedAmount: formatBigInt(totalAmount, 18, 4),
        });
      }
    });

    return result;
  }, [summaryRawData]);

  // Memoized context value
  const value = useMemo<CapitalReferralState>(
    () => ({
      totalReferrals,
      totalReferralAmount,
      totalReferralAmountFormatted,
      totalMorEarned,
      totalMorEarnedFormatted,
      uniqueReferrals: uniqueReferrals || new Set(),
      referralAmountsByAsset,
      referralRewardsByAsset,
      referrerDetailsByAsset,
      assetsWithClaimableRewards,
      availableReferralAssets,
      referralAssetConfigMap,
      isLoadingReferralData,
      isLoadingReferrerSummary,
      isLoadingReferralRewards,
      referralError,
      summaryError,
    }),
    [
      totalReferrals,
      totalReferralAmount,
      totalReferralAmountFormatted,
      totalMorEarned,
      totalMorEarnedFormatted,
      uniqueReferrals,
      referralAmountsByAsset,
      referralRewardsByAsset,
      referrerDetailsByAsset,
      assetsWithClaimableRewards,
      availableReferralAssets,
      referralAssetConfigMap,
      isLoadingReferralData,
      isLoadingReferrerSummary,
      isLoadingReferralRewards,
      referralError,
      summaryError,
    ]
  );

  return (
    <CapitalReferralContext.Provider value={value}>
      {children}
    </CapitalReferralContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useCapitalReferral(): CapitalReferralState {
  const context = useContext(CapitalReferralContext);
  if (!context) {
    throw new Error("useCapitalReferral must be used within a CapitalReferralProvider");
  }
  return context;
}

// ============================================================================
// Selective Hooks
// ============================================================================

/**
 * Get referral counts and totals
 */
export function useReferralTotals() {
  const {
    totalReferrals,
    totalReferralAmount,
    totalReferralAmountFormatted,
    totalMorEarned,
    totalMorEarnedFormatted,
  } = useCapitalReferral();
  return {
    totalReferrals,
    totalReferralAmount,
    totalReferralAmountFormatted,
    totalMorEarned,
    totalMorEarnedFormatted,
  };
}

/**
 * Get per-asset referral data
 */
export function useReferralsByAsset() {
  const { referralAmountsByAsset } = useCapitalReferral();
  return referralAmountsByAsset;
}

/**
 * Get referral loading states
 */
export function useReferralLoadingStates() {
  const { isLoadingReferralData, isLoadingReferrerSummary, isLoadingReferralRewards } = useCapitalReferral();
  return {
    isLoadingReferralData,
    isLoadingReferrerSummary,
    isLoadingReferralRewards,
    isLoadingAny: isLoadingReferralData || isLoadingReferrerSummary || isLoadingReferralRewards,
  };
}

/**
 * Get claimable referral rewards by asset
 */
export function useReferralRewardsByAsset() {
  const { referralRewardsByAsset, assetsWithClaimableRewards, availableReferralAssets } = useCapitalReferral();
  return { referralRewardsByAsset, assetsWithClaimableRewards, availableReferralAssets };
}

/**
 * Get referral asset config map for claiming
 */
export function useReferralAssetConfig() {
  const { referralAssetConfigMap } = useCapitalReferral();
  return referralAssetConfigMap;
}
