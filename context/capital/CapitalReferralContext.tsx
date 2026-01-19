"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useReferralData, useReferrerSummary } from "@/hooks/use-referral-data";
import { useCapitalNetwork } from "./CapitalNetworkContext";
import { formatBigInt } from "@/lib/utils/formatters";
import type { AssetSymbol, ReferralAmountByAsset } from "./types";

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

  // Loading states
  isLoadingReferralData: boolean;
  isLoadingReferrerSummary: boolean;

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
  const { userAddress, networkEnv } = useCapitalNetwork();

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
      isLoadingReferralData,
      isLoadingReferrerSummary,
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
      isLoadingReferralData,
      isLoadingReferrerSummary,
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
  const { isLoadingReferralData, isLoadingReferrerSummary } = useCapitalReferral();
  return {
    isLoadingReferralData,
    isLoadingReferrerSummary,
    isLoadingAny: isLoadingReferralData || isLoadingReferrerSummary,
  };
}
