"use client";

import { useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { usePublicClient, useReadContract, useReadContracts } from "wagmi";
import { zeroAddress, type Abi } from "viem";
import { getContractAddress, type ContractAddresses, type NetworkEnvironment } from "@/config/networks";
import type { AssetSymbol } from "@/components/capital/constants/asset-config";
import {
  LOCK_PREVIEW_PRESETS,
  MULTIPLIER_PRECISION,
  SECONDS_PER_DAY,
  type LockPeriods,
} from "@/lib/utils/lock-preview-utils";

import DepositPoolAbi from "@/app/abi/DepositPool.json";
import LockMultiplierMathAbi from "@/app/abi/LockMultiplierMath.json";

const V2_REWARD_POOL_INDEX = BigInt(0);
// Upper bound for the "no boost" search; the curve clears 1.0× well before 2 years
const NO_BOOST_SEARCH_MAX_DAYS = 730;

const depositPoolMapping: Record<AssetSymbol, keyof ContractAddresses> = {
  stETH: "stETHDepositPool",
  LINK: "linkDepositPool",
  USDC: "usdcDepositPool",
  USDT: "usdtDepositPool",
  wBTC: "wbtcDepositPool",
  wETH: "wethDepositPool",
};

export interface UserPositionData {
  lastStake: bigint;
  deposited: bigint;
  claimLockEnd: bigint;
  virtualDeposited: bigint;
  lastClaim: bigint;
  referrer: `0x${string}`;
}

interface UseLockMultiplierPreviewParams {
  asset: AssetSymbol;
  lockDays: number;
  maxDays: number;
  /** Lock start in unix seconds; held stable by the caller so reads don't refetch every render */
  now: number;
  l1ChainId?: number;
  networkEnv: NetworkEnvironment;
  userAddress?: `0x${string}`;
}

export function useLockMultiplierPreview({
  asset,
  lockDays,
  maxDays,
  now,
  l1ChainId,
  networkEnv,
  userAddress,
}: UseLockMultiplierPreviewParams) {
  const lockMultiplierMathAddress = useMemo(
    () => (l1ChainId ? getContractAddress(l1ChainId, "lockMultiplierMath", networkEnv) as `0x${string}` | undefined : undefined),
    [l1ChainId, networkEnv]
  );

  const depositPoolAddress = useMemo(
    () => (l1ChainId ? getContractAddress(l1ChainId, depositPoolMapping[asset], networkEnv) as `0x${string}` | undefined : undefined),
    [l1ChainId, networkEnv, asset]
  );

  const nowBigInt = BigInt(now);
  const lockEnd = nowBigInt + BigInt(lockDays * SECONDS_PER_DAY);
  const mathEnabled = !!lockMultiplierMathAddress && !!l1ChainId;

  // Multiplier for the selected lock length
  const { data: lockMultiplierRaw, isLoading: isLoadingLockMultiplier, error: lockMultiplierError } = useReadContract({
    address: lockMultiplierMathAddress,
    abi: LockMultiplierMathAbi,
    functionName: "getLockPeriodMultiplier",
    args: [nowBigInt, lockEnd],
    chainId: l1ChainId,
    query: { enabled: mathEnabled, staleTime: 3_600_000, placeholderData: keepPreviousData },
  });

  // Multipliers for the preset chips plus the slider maximum, batched into one multicall
  const presetDays = useMemo(() => [...LOCK_PREVIEW_PRESETS.map((preset) => preset.days), maxDays], [maxDays]);
  const { data: presetResults } = useReadContracts({
    contracts: presetDays.map((days) => ({
      address: lockMultiplierMathAddress,
      abi: LockMultiplierMathAbi as Abi,
      functionName: "getLockPeriodMultiplier",
      args: [nowBigInt, nowBigInt + BigInt(days * SECONDS_PER_DAY)],
      chainId: l1ChainId,
    })),
    query: { enabled: mathEnabled, staleTime: 3_600_000 },
  });

  const presetMultipliers = useMemo(() => {
    const byDays: Record<number, bigint | undefined> = {};
    presetDays.forEach((days, i) => {
      const result = presetResults?.[i];
      byDays[days] = result?.status === "success" ? (result.result as bigint) : undefined;
    });
    return byDays;
  }, [presetDays, presetResults]);

  // Shortest lock that yields any boost today. The curve is max(1, f(start, end)), so short locks
  // sit on the 1.0× floor; binary-search the first day above it (~10 pure calls, cached for an hour).
  const publicClient = usePublicClient({ chainId: l1ChainId });
  const { data: noBoostThresholdDays } = useQuery({
    queryKey: ["lockMultiplierNoBoostThreshold", l1ChainId, lockMultiplierMathAddress, Math.floor(now / SECONDS_PER_DAY)],
    enabled: mathEnabled && !!publicClient,
    staleTime: 3_600_000,
    queryFn: async () => {
      let low = 1;
      let high = NO_BOOST_SEARCH_MAX_DAYS;
      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        const multiplier = (await publicClient!.readContract({
          address: lockMultiplierMathAddress!,
          abi: LockMultiplierMathAbi,
          functionName: "getLockPeriodMultiplier",
          args: [nowBigInt, nowBigInt + BigInt(mid * SECONDS_PER_DAY)],
        })) as bigint;
        if (multiplier > MULTIPLIER_PRECISION) high = mid;
        else low = mid + 1;
      }
      return low;
    },
  });

  // Pool lock periods
  const { data: protocolDetailsRaw } = useReadContract({
    address: depositPoolAddress,
    abi: DepositPoolAbi,
    functionName: "rewardPoolsProtocolDetails",
    args: [V2_REWARD_POOL_INDEX],
    chainId: l1ChainId,
    query: { enabled: !!depositPoolAddress && !!l1ChainId, staleTime: 3_600_000 },
  });

  const lockPeriods = useMemo((): LockPeriods | undefined => {
    if (!Array.isArray(protocolDetailsRaw)) return undefined;
    return {
      withdrawLockPeriodAfterStake: BigInt(protocolDetailsRaw[0]),
      claimLockPeriodAfterStake: BigInt(protocolDetailsRaw[1]),
      claimLockPeriodAfterClaim: BigInt(protocolDetailsRaw[2]),
    };
  }, [protocolDetailsRaw]);

  // Existing position in this pool
  const userEnabled = !!depositPoolAddress && !!l1ChainId && !!userAddress;
  const { data: usersDataRaw } = useReadContract({
    address: depositPoolAddress,
    abi: DepositPoolAbi,
    functionName: "usersData",
    args: [userAddress || zeroAddress, V2_REWARD_POOL_INDEX],
    chainId: l1ChainId,
    query: { enabled: userEnabled },
  });

  const position = useMemo((): UserPositionData | undefined => {
    if (!Array.isArray(usersDataRaw) || usersDataRaw.length < 9) return undefined;
    return {
      lastStake: BigInt(usersDataRaw[0]),
      deposited: BigInt(usersDataRaw[1]),
      claimLockEnd: BigInt(usersDataRaw[5]),
      virtualDeposited: BigInt(usersDataRaw[6]),
      lastClaim: BigInt(usersDataRaw[7]),
      referrer: usersDataRaw[8] as `0x${string}`,
    };
  }, [usersDataRaw]);

  const { data: currentUserMultiplierRaw } = useReadContract({
    address: depositPoolAddress,
    abi: DepositPoolAbi,
    functionName: "getCurrentUserMultiplier",
    args: [V2_REWARD_POOL_INDEX, userAddress || zeroAddress],
    chainId: l1ChainId,
    query: { enabled: userEnabled && !!position && position.deposited > BigInt(0) },
  });

  return {
    lockEnd,
    lockMultiplier: lockMultiplierRaw as bigint | undefined,
    isLoadingLockMultiplier,
    lockMultiplierError,
    presetMultipliers,
    maxMultiplier: presetMultipliers[maxDays],
    noBoostThresholdDays,
    lockPeriods,
    position,
    currentUserMultiplier: currentUserMultiplierRaw as bigint | undefined,
  };
}
