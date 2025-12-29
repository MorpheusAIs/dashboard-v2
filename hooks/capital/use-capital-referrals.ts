"use client";

/**
 * Hook for managing referral data and operations
 * Handles referral rewards, referrer details, and claiming
 */

import { useMemo, useCallback } from "react";
import { useContractReads } from "wagmi";
import { zeroAddress } from "viem";
import type { NetworkEnvironment } from "@/config/networks";
import { getContractAddress } from "@/config/networks";
import {
  getAssetConfig,
  getAssetsForNetwork,
  type AssetSymbol,
} from "@/components/capital/constants/asset-config";
import type { ReferralData, ReferralContractData, ReferralAmountByAsset } from "@/context/capital/types";
import { V2_REWARD_POOL_INDEX } from "@/context/capital/constants";
import { formatBigInt } from "@/lib/utils/formatters";
import { getDepositPoolContractName } from "@/lib/utils/capital-helpers";
import { useReferralData as useGraphQLReferralData, useReferrerSummary } from "@/hooks/use-referral-data";

// Import ABI
import DepositPoolAbi from "@/app/abi/DepositPool.json";

export interface ReferralAssetConfig {
  symbol: AssetSymbol;
  depositPoolAddress: `0x${string}`;
}

export interface CapitalReferralsOptions {
  userAddress?: `0x${string}`;
  l1ChainId: number;
  networkEnv: NetworkEnvironment;
}

export interface CapitalReferralsResult {
  referralData: ReferralData;

  // Contract data structures
  referralAssetConfigs: ReferralAssetConfig[];
  referralAssetConfigMap: Map<AssetSymbol, ReferralAssetConfig>;
  referralRewardsByAsset: Partial<Record<AssetSymbol, bigint>>;
  referrerDetailsByAsset: Partial<Record<AssetSymbol, ReferralContractData | null>>;

  // Loading state
  isLoadingReferralData: boolean;
}

export function useCapitalReferrals(options: CapitalReferralsOptions): CapitalReferralsResult {
  const { userAddress, l1ChainId, networkEnv } = options;

  // --- GraphQL Referral Data ---
  const liveReferralData = useGraphQLReferralData({
    userAddress: userAddress,
    networkEnvironment: networkEnv,
  });

  const referrerSummaryData = useReferrerSummary({
    userAddress: userAddress,
    networkEnvironment: networkEnv,
  });

  // --- Referral Asset Configs ---
  const referralAssetConfigs = useMemo(() => {
    if (!l1ChainId) {
      return [] as ReferralAssetConfig[];
    }

    const assetsFromConfig = getAssetsForNetwork(networkEnv);

    return assetsFromConfig
      .map((assetInfo) => {
        const symbol = assetInfo.metadata.symbol;
        const depositPoolContractName = getDepositPoolContractName(symbol);

        if (!depositPoolContractName) {
          return null;
        }

        const address = getContractAddress(l1ChainId, depositPoolContractName, networkEnv);

        if (!address || address === "" || address === zeroAddress) {
          return null;
        }

        return {
          symbol,
          depositPoolAddress: address as `0x${string}`,
        };
      })
      .filter((config): config is ReferralAssetConfig => config !== null);
  }, [l1ChainId, networkEnv]);

  const referralAssetConfigMap = useMemo(() => {
    const map = new Map<AssetSymbol, ReferralAssetConfig>();
    referralAssetConfigs.forEach((config) => {
      map.set(config.symbol, config);
    });
    return map;
  }, [referralAssetConfigs]);

  // --- Contract Read Configs ---
  const referralRewardContracts = useMemo(() => {
    if (!userAddress) return [];

    return referralAssetConfigs.map((config) => ({
      address: config.depositPoolAddress,
      abi: DepositPoolAbi,
      functionName: "getLatestReferrerReward" as const,
      args: [V2_REWARD_POOL_INDEX, userAddress] as const,
      chainId: l1ChainId,
    }));
  }, [referralAssetConfigs, l1ChainId, userAddress]);

  const referrerDataContracts = useMemo(() => {
    if (!userAddress) return [];

    return referralAssetConfigs.map((config) => ({
      address: config.depositPoolAddress,
      abi: DepositPoolAbi,
      functionName: "referrersData" as const,
      args: [userAddress, V2_REWARD_POOL_INDEX] as const,
      chainId: l1ChainId,
    }));
  }, [referralAssetConfigs, l1ChainId, userAddress]);

  // --- Contract Reads ---
  const { data: referralRewardsResults, isLoading: isLoadingReferralRewards } = useContractReads({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: referralRewardContracts as any,
    allowFailure: true,
    query: {
      enabled: referralRewardContracts.length > 0 && !!userAddress,
    },
  });

  const { data: referrerDetailsResults, isLoading: isLoadingReferrerDetails } = useContractReads({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: referrerDataContracts as any,
    allowFailure: true,
    query: {
      enabled: referrerDataContracts.length > 0 && !!userAddress,
    },
  });

  // --- Parse Referral Data ---
  const parseReferralContractData = useCallback((referralDataRaw: unknown): ReferralContractData | null => {
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

  // --- Computed Values ---
  const referralRewardsByAsset = useMemo(() => {
    const rewards: Partial<Record<AssetSymbol, bigint>> = {};

    referralAssetConfigs.forEach((config, index) => {
      const result = referralRewardsResults?.[index];

      let value: bigint = BigInt(0);

      if (result && typeof result === "object") {
        if ("result" in result && result.status === "success") {
          value = result.result as bigint;
        }
      } else if (typeof result === "bigint") {
        value = result;
      }

      rewards[config.symbol] = value;
    });

    return rewards;
  }, [referralAssetConfigs, referralRewardsResults]);

  const referrerDetailsByAsset = useMemo(() => {
    const details: Partial<Record<AssetSymbol, ReferralContractData | null>> = {};

    referralAssetConfigs.forEach((config, index) => {
      const raw = referrerDetailsResults?.[index];
      // Handle the result structure from useContractReads with allowFailure
      if (raw && typeof raw === "object" && "result" in raw) {
        details[config.symbol] = parseReferralContractData(raw.result);
      } else {
        details[config.symbol] = parseReferralContractData(raw);
      }
    });

    return details;
  }, [parseReferralContractData, referrerDetailsResults, referralAssetConfigs]);

  // --- Final Referral Data Object ---
  const referralData: ReferralData = useMemo(() => {
    const availableReferralAssetSymbols = referralAssetConfigs.map((config) => config.symbol);
    const assetsWithClaimableRewards = referralAssetConfigs
      .filter((config) => (referralRewardsByAsset[config.symbol] ?? BigInt(0)) > BigInt(0))
      .map((config) => config.symbol);
    const totalClaimableRewards = referralAssetConfigs.reduce((sum, config) => {
      const reward = referralRewardsByAsset[config.symbol] ?? BigInt(0);
      return sum + reward;
    }, BigInt(0));

    const isLoadingReferralData =
      isLoadingReferralRewards || isLoadingReferrerDetails || liveReferralData.isLoading || referrerSummaryData.isLoading;

    const totalReferralsDisplay = liveReferralData.error
      ? "Error"
      : liveReferralData.isLoading
        ? "..."
        : liveReferralData.totalReferrals.toString();

    // Calculate total referrals with positive amounts from referrer summary
    const totalReferralsFromSummary = referrerSummaryData.rawData
      ? (() => {
          const uniqueReferralAddresses = new Set<string>();
          const pools = [
            referrerSummaryData.rawData.stETH_referrer,
            referrerSummaryData.rawData.wBTC_referrer,
            referrerSummaryData.rawData.wETH_referrer,
            referrerSummaryData.rawData.USDC_referrer,
            referrerSummaryData.rawData.USDT_referrer,
          ];

          pools.forEach((poolReferrers) => {
            poolReferrers.forEach((referrer) => {
              referrer.referrals.forEach((ref) => {
                try {
                  if (BigInt(ref.amount) > BigInt(0)) {
                    uniqueReferralAddresses.add(ref.referralAddress);
                  }
                } catch {
                  // Skip invalid amounts
                }
              });
            });
          });

          return uniqueReferralAddresses.size;
        })()
      : 0;

    const referralAmountsByAsset: ReferralAmountByAsset[] = referrerSummaryData.rawData
      ? (() => {
          const amounts: ReferralAmountByAsset[] = [];

          const poolMapping = [
            { key: "stETH_referrer", asset: "stETH" },
            { key: "wBTC_referrer", asset: "wBTC" },
            { key: "wETH_referrer", asset: "wETH" },
            { key: "USDC_referrer", asset: "USDC" },
            { key: "USDT_referrer", asset: "USDT" },
          ];

          poolMapping.forEach(({ key, asset }) => {
            const poolReferrers = referrerSummaryData.rawData![key as keyof typeof referrerSummaryData.rawData] as Array<{
              referrerAddress: string;
              claimed: string;
              referrals: Array<{ amount: string; referralAddress: string }>;
            }>;

            if (poolReferrers && poolReferrers.length > 0) {
              const totalAmount = poolReferrers.reduce((sum, referrer) => {
                return (
                  sum +
                  referrer.referrals.reduce((refSum, ref) => {
                    try {
                      return refSum + BigInt(ref.amount);
                    } catch {
                      return refSum;
                    }
                  }, BigInt(0))
                );
              }, BigInt(0));

              if (totalAmount > BigInt(0)) {
                const assetConfig = getAssetConfig(asset as AssetSymbol, networkEnv);
                const decimals = assetConfig?.metadata.decimals || 18;

                amounts.push({
                  asset,
                  amount: totalAmount,
                  formattedAmount: formatBigInt(totalAmount, decimals, 4),
                });
              }
            }
          });

          return amounts.sort((a, b) => Number(b.amount - a.amount));
        })()
      : [];

    return {
      totalReferrals: referrerSummaryData.isLoading
        ? "..."
        : totalReferralsFromSummary > 0
          ? totalReferralsFromSummary.toString()
          : totalReferralsDisplay,
      totalReferralAmount: liveReferralData.isLoading ? "---" : formatBigInt(liveReferralData.totalReferralAmount, 18, 4),
      lifetimeRewards: referrerSummaryData.isLoading ? "---" : formatBigInt(referrerSummaryData.totalMorEarned, 18, 2),
      claimableRewards: formatBigInt(totalClaimableRewards, 18, 4),
      referralAmountsByAsset,
      isLoadingReferralData,

      // Dynamic asset rewards and data
      rewardsByAsset: referralRewardsByAsset,
      referrerDetailsByAsset,
      assetsWithClaimableRewards,
      availableReferralAssets: availableReferralAssetSymbols,

      // Legacy exports (deprecated)
      stETHReferralRewards: referralRewardsByAsset.stETH ?? BigInt(0),
      linkReferralRewards: referralRewardsByAsset.LINK ?? BigInt(0),
      stETHReferralData: referrerDetailsByAsset.stETH ?? null,
      linkReferralData: referrerDetailsByAsset.LINK ?? null,
    };
  }, [
    isLoadingReferralRewards,
    isLoadingReferrerDetails,
    referralRewardsByAsset,
    referrerDetailsByAsset,
    referralAssetConfigs,
    liveReferralData.isLoading,
    liveReferralData.error,
    liveReferralData.totalReferrals,
    liveReferralData.totalReferralAmount,
    referrerSummaryData.isLoading,
    referrerSummaryData.totalMorEarned,
    referrerSummaryData.rawData,
    networkEnv,
  ]);

  const isLoadingReferralData =
    isLoadingReferralRewards || isLoadingReferrerDetails || liveReferralData.isLoading || referrerSummaryData.isLoading;

  return {
    referralData,
    referralAssetConfigs,
    referralAssetConfigMap,
    referralRewardsByAsset,
    referrerDetailsByAsset,
    isLoadingReferralData,
  };
}
