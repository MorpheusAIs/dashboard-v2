/**
 * Shared types for Capital context modules
 *
 * These types are extracted from the original CapitalPageContext
 * and shared across all focused context providers.
 */

import { type AssetSymbol } from "@/components/capital/constants/asset-config";

// Re-export for convenience
export type { AssetSymbol };

// ============================================================================
// Pool Data Types
// ============================================================================

export interface PoolInfoData {
  payoutStart: bigint;
  decreaseInterval: bigint;
  withdrawLockPeriod: bigint;
  claimLockPeriod: bigint;
  withdrawLockPeriodAfterStake: bigint;
  initialReward: bigint;
  rewardDecrease: bigint;
  minimalStake: bigint;
  isPublic: boolean;
}

export interface PoolLimitsData {
  claimLockPeriodAfterStake: bigint;
  claimLockPeriodAfterClaim: bigint;
}

export interface UserPoolData {
  lastStake: bigint;
  deposited: bigint;
  rate: bigint;
  pendingRewards: bigint;
  claimLockStart: bigint;
  claimLockEnd: bigint;
  virtualDeposited: bigint;
  lastClaim: bigint;
  referrer: `0x${string}`;
}

// ============================================================================
// Referral Types
// ============================================================================

export interface ReferralContractData {
  amountStaked: bigint;
  virtualAmountStaked: bigint;
  rate: bigint;
  pendingRewards: bigint;
  lastClaim: bigint;
}

export interface ReferralAmountByAsset {
  asset: string;
  amount: bigint;
  formattedAmount: string;
}

export interface ReferralData {
  totalReferrals: string;
  totalReferralAmount: string;
  lifetimeRewards: string;
  claimableRewards: string;
  referralAmountsByAsset: ReferralAmountByAsset[];
  isLoadingReferralData: boolean;
  rewardsByAsset: Partial<Record<AssetSymbol, bigint>>;
  referrerDetailsByAsset: Partial<Record<AssetSymbol, ReferralContractData | null>>;
  assetsWithClaimableRewards: AssetSymbol[];
  availableReferralAssets: AssetSymbol[];
  /** @deprecated Use rewardsByAsset.stETH instead */
  stETHReferralRewards: bigint;
  /** @deprecated Use rewardsByAsset.LINK instead */
  linkReferralRewards: bigint;
  /** @deprecated Use referrerDetailsByAsset.stETH instead */
  stETHReferralData: ReferralContractData | null;
  /** @deprecated Use referrerDetailsByAsset.LINK instead */
  linkReferralData: ReferralContractData | null;
}

// ============================================================================
// Asset Types
// ============================================================================

export interface AssetConfig {
  symbol: AssetSymbol;
  depositPoolAddress: `0x${string}`;
  tokenAddress: `0x${string}`;
  decimals: number;
  icon: string;
}

export interface AssetData {
  symbol: AssetSymbol;
  config: AssetConfig;
  // User-specific data
  userBalance: bigint;
  userDeposited: bigint;
  userAllowance: bigint;
  claimableAmount: bigint;
  userMultiplier: bigint;
  // Pool-specific data
  totalDeposited: bigint;
  protocolDetails: PoolLimitsData | null;
  poolData: PoolInfoData | null;
  // Unlock timestamps
  claimUnlockTimestamp?: bigint;
  withdrawUnlockTimestamp?: bigint;
  // Formatted for display
  userBalanceFormatted: string;
  userDepositedFormatted: string;
  claimableAmountFormatted: string;
  userMultiplierFormatted: string;
  totalDepositedFormatted: string;
  minimalStakeFormatted: string;
  claimUnlockTimestampFormatted: string;
  withdrawUnlockTimestampFormatted: string;
  // Eligibility flags
  canClaim: boolean;
  canWithdraw: boolean;
}

// ============================================================================
// UI Types
// ============================================================================

export type ActiveModal =
  | "deposit"
  | "withdraw"
  | "changeLock"
  | "stakeMorRewards"
  | "lockMorRewards"
  | "claimMorRewards"
  | null;

export type TimeUnit = "days" | "months" | "years";

// Contract types - simplified for now
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DynamicContract = any;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert duration to seconds using contract-expected calculations
 */
export const durationToSeconds = (value: string, unit: TimeUnit): bigint => {
  const numValue = parseInt(value, 10);
  if (isNaN(numValue) || numValue <= 0) return BigInt(0);

  let diffSeconds: number;

  switch (unit) {
    case "days":
      diffSeconds = numValue * 86400; // 24 * 60 * 60
      diffSeconds += 300; // 5-minute safety buffer
      break;
    case "months":
      diffSeconds = numValue * 30 * 86400; // 30 days per month
      diffSeconds += 300;
      break;
    case "years":
      // Special case: 6 years = exact value for maximum power factor
      if (numValue === 6) {
        diffSeconds = 189216000; // 6 * 365 * 24 * 60 * 60
      } else {
        diffSeconds = numValue * 365 * 86400;
      }
      diffSeconds += 300;
      break;
    default:
      return BigInt(0);
  }

  return BigInt(diffSeconds);
};

/**
 * Return the maximum of multiple bigint values
 */
export const maxBigInt = (...args: (bigint | undefined | null)[]): bigint => {
  let max = BigInt(0);
  for (const arg of args) {
    if (arg !== undefined && arg !== null && arg > max) {
      max = arg;
    }
  }
  return max;
};

/**
 * Parse V2 user data from contract response
 */
export const parseV2UserData = (data: unknown): UserPoolData | undefined => {
  if (!data) return undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dataArray = data as any[];
  if (!Array.isArray(dataArray) || dataArray.length < 9) return undefined;
  try {
    return {
      lastStake: BigInt(dataArray[0]),
      deposited: BigInt(dataArray[1]),
      rate: BigInt(dataArray[2]),
      pendingRewards: BigInt(dataArray[3]),
      claimLockStart: BigInt(dataArray[4]),
      claimLockEnd: BigInt(dataArray[5]),
      virtualDeposited: BigInt(dataArray[6]),
      lastClaim: BigInt(dataArray[7]),
      referrer: dataArray[8] as `0x${string}`,
    };
  } catch (e) {
    console.error("Error parsing V2 user data:", e);
    return undefined;
  }
};
