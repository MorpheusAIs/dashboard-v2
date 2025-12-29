/**
 * Pure helper functions for the Capital Page Context
 * These functions have no React dependencies and can be easily unit tested
 */

import type { ContractAddresses } from "@/config/networks";
import type { AssetSymbol } from "@/components/capital/constants/asset-config";
import type { TimeUnit, UserPoolData, PoolInfoData, PoolLimitsData } from "@/context/capital/types";
import {
  SECONDS_PER_DAY,
  SECONDS_PER_MONTH,
  SECONDS_PER_YEAR,
  SIX_YEARS_IN_SECONDS,
  TIMING_SAFETY_BUFFER_SECONDS,
} from "@/context/capital/constants";

/**
 * Converts a duration value and unit to seconds
 * Uses contract-expected calculations to match exactly what the contract expects
 */
export const durationToSeconds = (value: string, unit: TimeUnit): bigint => {
  const numValue = parseInt(value, 10);
  if (isNaN(numValue) || numValue <= 0) return BigInt(0);

  let diffSeconds: number;

  switch (unit) {
    case "days":
      diffSeconds = numValue * SECONDS_PER_DAY;
      diffSeconds += TIMING_SAFETY_BUFFER_SECONDS;
      break;
    case "months":
      diffSeconds = numValue * SECONDS_PER_MONTH;
      diffSeconds += TIMING_SAFETY_BUFFER_SECONDS;
      break;
    case "years":
      // Special case: For 6 years, use the EXACT value the contract expects for maximum power factor
      if (numValue === 6) {
        diffSeconds = SIX_YEARS_IN_SECONDS;
      } else {
        diffSeconds = numValue * SECONDS_PER_YEAR;
      }
      diffSeconds += TIMING_SAFETY_BUFFER_SECONDS;
      break;
    default:
      return BigInt(0);
  }

  return BigInt(diffSeconds);
};

/**
 * Returns the maximum BigInt from a list of values
 * Handles undefined and null values gracefully
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
 * Parses V2 user data from contract response
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

/**
 * Parses pool info data from contract response (unusedStorage1 function)
 */
export const parsePoolInfoData = (data: unknown): PoolInfoData | undefined => {
  if (!data) return undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dataArray = data as any[];
  if (!Array.isArray(dataArray) || dataArray.length < 9) return undefined;
  try {
    return {
      payoutStart: BigInt(dataArray[0]),
      decreaseInterval: BigInt(dataArray[1]),
      withdrawLockPeriod: BigInt(dataArray[2]),
      claimLockPeriod: BigInt(dataArray[3]),
      withdrawLockPeriodAfterStake: BigInt(dataArray[4]),
      initialReward: BigInt(dataArray[5]),
      rewardDecrease: BigInt(dataArray[6]),
      minimalStake: BigInt(dataArray[7]),
      isPublic: Boolean(dataArray[8]),
    };
  } catch (e) {
    console.error("Error parsing pool info data:", e);
    return undefined;
  }
};

/**
 * Parses pool limits data from contract response (rewardPoolsProtocolDetails function)
 */
export const parsePoolLimitsData = (data: unknown): PoolLimitsData | undefined => {
  if (!data) return undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dataArray = data as any[];
  if (!Array.isArray(dataArray) || dataArray.length < 2) return undefined;
  try {
    return {
      claimLockPeriodAfterStake: BigInt(dataArray[0]),
      claimLockPeriodAfterClaim: BigInt(dataArray[1]),
    };
  } catch (e) {
    console.error("Error parsing pool limits data:", e);
    return undefined;
  }
};

/**
 * Maps asset symbols to their corresponding deposit pool contract names
 * This is the single source of truth - previously duplicated in the codebase
 */
export const getDepositPoolContractName = (symbol: AssetSymbol): keyof ContractAddresses | null => {
  const mapping: Record<AssetSymbol, keyof ContractAddresses> = {
    stETH: "stETHDepositPool",
    LINK: "linkDepositPool",
    USDC: "usdcDepositPool",
    USDT: "usdtDepositPool",
    wBTC: "wbtcDepositPool",
    wETH: "wethDepositPool",
  };
  return mapping[symbol] || null;
};

/**
 * Maps asset symbols to their token contract names
 */
export const getTokenContractName = (symbol: AssetSymbol): keyof ContractAddresses | null => {
  const mapping: Partial<Record<AssetSymbol, keyof ContractAddresses>> = {
    stETH: "stETH",
    LINK: "linkToken",
    // Add more as needed
  };
  return mapping[symbol] || null;
};
