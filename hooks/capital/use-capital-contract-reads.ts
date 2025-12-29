"use client";

/**
 * Hook for reading capital pool contract data
 * Encapsulates all contract read operations for the capital page
 */

import { useMemo } from "react";
import { useReadContract, useBalance } from "wagmi";
import { zeroAddress } from "viem";
import type { NetworkEnvironment } from "@/config/networks";
import type { PoolInfoData, PoolLimitsData, UserPoolData } from "@/context/capital/types";
import { PUBLIC_POOL_ID, V2_REWARD_POOL_INDEX, REWARD_REFETCH_INTERVAL } from "@/context/capital/constants";
import { parsePoolInfoData, parsePoolLimitsData, parseV2UserData, maxBigInt } from "@/lib/utils/capital-helpers";

// Import ABIs
import ERC1967ProxyAbi from "@/app/abi/ERC1967Proxy.json";
import DepositPoolAbi from "@/app/abi/DepositPool.json";

export interface CapitalContractReadsOptions {
  userAddress?: `0x${string}`;
  l1ChainId: number;
  l2ChainId: number;
  networkEnv: NetworkEnvironment;
  stETHDepositPoolAddress?: `0x${string}`;
  linkDepositPoolAddress?: `0x${string}`;
  distributorV2Address?: `0x${string}`;
  morContractAddress?: `0x${string}`;
}

export interface CapitalContractReadsResult {
  // Pool data
  poolInfo: PoolInfoData | undefined;
  poolLimits: PoolLimitsData | undefined;
  userData: UserPoolData | undefined;

  // User rewards and multiplier
  currentUserRewardData: bigint | undefined;
  currentUserMultiplierData: bigint | undefined;

  // Balances
  morBalance: bigint;

  // V2 specific parsed data
  stETHV2UserParsed: UserPoolData | undefined;
  linkV2UserParsed: UserPoolData | undefined;

  // V2 rewards
  stETHV2CurrentUserReward: bigint | undefined;
  linkV2CurrentUserReward: bigint | undefined;

  // Unlock timestamps (V2)
  stETHV2ClaimUnlockTimestamp: bigint | undefined;
  linkV2ClaimUnlockTimestamp: bigint | undefined;

  // Calculated unlock timestamps
  withdrawUnlockTimestamp: bigint | undefined;
  claimUnlockTimestamp: bigint | undefined;

  // Loading states
  isLoadingUserData: boolean;
  isLoadingBalances: boolean;
  isLoadingRewards: boolean;
  isLoadingAllowance: boolean;

  // Refetch functions
  refetchUserData: () => void;
  refetchUserReward: () => void;
  refetchUserMultiplier: () => void;
  refetchMorBalance: () => void;
}

export function useCapitalContractReads(options: CapitalContractReadsOptions): CapitalContractReadsResult {
  const {
    userAddress,
    l1ChainId,
    l2ChainId,
    stETHDepositPoolAddress,
    linkDepositPoolAddress,
    distributorV2Address,
    morContractAddress,
  } = options;

  const poolAbi = DepositPoolAbi;

  // --- Pool Info Read ---
  const { data: poolInfoResult } = useReadContract({
    address: stETHDepositPoolAddress,
    abi: poolAbi,
    functionName: "unusedStorage1",
    args: [PUBLIC_POOL_ID],
    chainId: l1ChainId,
    query: { enabled: !!stETHDepositPoolAddress },
  });

  const poolInfo = useMemo((): PoolInfoData | undefined => {
    return parsePoolInfoData(poolInfoResult);
  }, [poolInfoResult]);

  // --- Pool Limits Read ---
  const { data: poolLimitsResult } = useReadContract({
    address: stETHDepositPoolAddress,
    abi: poolAbi,
    functionName: "rewardPoolsProtocolDetails",
    args: [PUBLIC_POOL_ID],
    chainId: l1ChainId,
    query: { enabled: !!stETHDepositPoolAddress },
  });

  const poolLimits = useMemo((): PoolLimitsData | undefined => {
    return parsePoolLimitsData(poolLimitsResult);
  }, [poolLimitsResult]);

  // --- User Data Read ---
  const {
    data: usersDataResult,
    isLoading: isLoadingUserDataRaw,
    refetch: refetchUserData,
  } = useReadContract({
    address: stETHDepositPoolAddress,
    abi: poolAbi,
    functionName: "usersData",
    args: [userAddress || zeroAddress, PUBLIC_POOL_ID],
    chainId: l1ChainId,
    query: { enabled: !!stETHDepositPoolAddress && !!userAddress },
  });

  const userData = useMemo((): UserPoolData | undefined => {
    return parseV2UserData(usersDataResult);
  }, [usersDataResult]);

  // --- User Reward Read ---
  const {
    data: currentUserRewardDataRaw,
    isLoading: isLoadingUserReward,
    refetch: refetchUserReward,
  } = useReadContract({
    address: stETHDepositPoolAddress,
    abi: poolAbi,
    functionName: "getLatestUserReward",
    args: [PUBLIC_POOL_ID, userAddress || zeroAddress],
    chainId: l1ChainId,
    query: {
      enabled: !!stETHDepositPoolAddress && !!userAddress,
      refetchInterval: REWARD_REFETCH_INTERVAL,
    },
  });

  const currentUserRewardData = useMemo(
    () => currentUserRewardDataRaw as bigint | undefined,
    [currentUserRewardDataRaw]
  );

  // --- User Multiplier Read ---
  const {
    data: currentUserMultiplierDataRaw,
    isLoading: isLoadingUserMultiplier,
    refetch: refetchUserMultiplier,
  } = useReadContract({
    address: distributorV2Address,
    abi: ERC1967ProxyAbi,
    functionName: "getCurrentUserMultiplier",
    args: [PUBLIC_POOL_ID, userAddress || zeroAddress],
    chainId: l1ChainId,
    query: { enabled: !!distributorV2Address && !!userAddress },
  });

  const currentUserMultiplierData = useMemo(
    () => currentUserMultiplierDataRaw as bigint | undefined,
    [currentUserMultiplierDataRaw]
  );

  // --- MOR Balance Read ---
  const {
    data: morBalanceData,
    isLoading: isLoadingMorBalance,
    refetch: refetchMorBalance,
  } = useBalance({
    address: userAddress,
    token: morContractAddress,
    chainId: l2ChainId,
    query: { enabled: !!userAddress && !!morContractAddress },
  });

  const morBalance = morBalanceData?.value ?? BigInt(0);

  // --- Allowance Loading State ---
  const { isLoading: isLoadingAllowance } = useReadContract({
    address: stETHDepositPoolAddress,
    abi: poolAbi,
    functionName: "allowance",
    args: [userAddress || zeroAddress, stETHDepositPoolAddress || zeroAddress],
    chainId: l1ChainId,
    query: { enabled: false }, // Disabled - using dynamic hook instead
  });

  // --- V2 stETH User Data ---
  const { data: stETHV2UserData, isLoading: isLoadingStETHV2User } = useReadContract({
    address: stETHDepositPoolAddress,
    abi: DepositPoolAbi,
    functionName: "usersData",
    args: [userAddress || zeroAddress, V2_REWARD_POOL_INDEX],
    chainId: l1ChainId,
    query: { enabled: !!stETHDepositPoolAddress && !!userAddress },
  });

  const stETHV2UserParsed = useMemo(() => parseV2UserData(stETHV2UserData), [stETHV2UserData]);

  // --- V2 stETH Rewards ---
  const { data: stETHV2CurrentUserRewardRaw, isLoading: isLoadingStETHV2Reward } = useReadContract({
    address: stETHDepositPoolAddress,
    abi: DepositPoolAbi,
    functionName: "getLatestUserReward",
    args: [V2_REWARD_POOL_INDEX, userAddress || zeroAddress],
    chainId: l1ChainId,
    query: {
      enabled: !!stETHDepositPoolAddress && !!userAddress,
      refetchInterval: REWARD_REFETCH_INTERVAL,
    },
  });

  const stETHV2CurrentUserReward = stETHV2CurrentUserRewardRaw as bigint | undefined;

  // --- V2 LINK User Data ---
  const { data: linkV2UserData, isLoading: isLoadingLinkV2User } = useReadContract({
    address: linkDepositPoolAddress,
    abi: DepositPoolAbi,
    functionName: "usersData",
    args: [userAddress || zeroAddress, V2_REWARD_POOL_INDEX],
    chainId: l1ChainId,
    query: { enabled: !!linkDepositPoolAddress && !!userAddress },
  });

  const linkV2UserParsed = useMemo(() => parseV2UserData(linkV2UserData), [linkV2UserData]);

  // --- V2 LINK Rewards ---
  const { data: linkV2CurrentUserRewardRaw, isLoading: isLoadingLinkV2Reward } = useReadContract({
    address: linkDepositPoolAddress,
    abi: DepositPoolAbi,
    functionName: "getLatestUserReward",
    args: [V2_REWARD_POOL_INDEX, userAddress || zeroAddress],
    chainId: l1ChainId,
    query: {
      enabled: !!linkDepositPoolAddress && !!userAddress,
      refetchInterval: REWARD_REFETCH_INTERVAL,
    },
  });

  const linkV2CurrentUserReward = linkV2CurrentUserRewardRaw as bigint | undefined;

  // --- V2-specific unlock timestamp calculations ---
  const stETHV2ClaimUnlockTimestamp = useMemo(() => {
    if (!stETHV2UserParsed?.claimLockEnd) return undefined;
    return stETHV2UserParsed.claimLockEnd;
  }, [stETHV2UserParsed]);

  const linkV2ClaimUnlockTimestamp = useMemo(() => {
    if (!linkV2UserParsed?.claimLockEnd) return undefined;
    return linkV2UserParsed.claimLockEnd;
  }, [linkV2UserParsed]);

  // --- Withdraw Unlock Timestamp ---
  const withdrawUnlockTimestamp = useMemo(() => {
    if (!userData?.lastStake || !poolInfo?.withdrawLockPeriodAfterStake) return undefined;
    return userData.lastStake + poolInfo.withdrawLockPeriodAfterStake;
  }, [userData?.lastStake, poolInfo?.withdrawLockPeriodAfterStake]);

  // --- Claim Unlock Timestamp ---
  const claimUnlockTimestamp = useMemo(() => {
    if (
      !poolInfo?.payoutStart ||
      !poolInfo.claimLockPeriod ||
      !poolLimits?.claimLockPeriodAfterClaim ||
      !poolLimits.claimLockPeriodAfterStake ||
      !userData?.lastStake ||
      !userData.lastClaim ||
      userData.claimLockEnd === undefined
    ) {
      return undefined;
    }

    return maxBigInt(
      userData.claimLockEnd,
      poolInfo.payoutStart + poolInfo.claimLockPeriod,
      userData.lastClaim + poolLimits.claimLockPeriodAfterClaim,
      userData.lastStake + poolLimits.claimLockPeriodAfterStake
    );
  }, [poolInfo, poolLimits, userData]);

  // --- Combined Loading States ---
  const isLoadingUserData =
    isLoadingUserDataRaw ||
    isLoadingUserReward ||
    isLoadingUserMultiplier ||
    isLoadingStETHV2User ||
    isLoadingLinkV2User;

  const isLoadingBalances = isLoadingMorBalance;

  const isLoadingRewards = isLoadingStETHV2Reward || isLoadingLinkV2Reward;

  return {
    // Pool data
    poolInfo,
    poolLimits,
    userData,

    // User rewards and multiplier
    currentUserRewardData,
    currentUserMultiplierData,

    // Balances
    morBalance,

    // V2 specific parsed data
    stETHV2UserParsed,
    linkV2UserParsed,

    // V2 rewards
    stETHV2CurrentUserReward,
    linkV2CurrentUserReward,

    // Unlock timestamps
    stETHV2ClaimUnlockTimestamp,
    linkV2ClaimUnlockTimestamp,
    withdrawUnlockTimestamp,
    claimUnlockTimestamp,

    // Loading states
    isLoadingUserData,
    isLoadingBalances,
    isLoadingRewards,
    isLoadingAllowance,

    // Refetch functions
    refetchUserData,
    refetchUserReward,
    refetchUserMultiplier,
    refetchMorBalance,
  };
}
