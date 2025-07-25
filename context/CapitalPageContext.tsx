"use client";

import React, { createContext, useContext, useMemo, useEffect, useCallback, useState } from "react";
import { 
  useAccount, 
  useChainId, 
  useReadContract, 
  useBalance, 
  useWriteContract, 
  useWaitForTransactionReceipt, 
  useSimulateContract,
  type BaseError 
} from "wagmi";
import { parseUnits, zeroAddress, maxInt256 } from "viem";
import { toast } from "sonner";

// Import Config, Utils & ABIs
import { 
  testnetChains, 
  mainnetChains, 
  getContractAddress, 
  type NetworkEnvironment 
} from "@/config/networks";
import { formatTimestamp, formatBigInt } from "@/lib/utils/formatters";
import ERC1967ProxyAbi from "@/app/abi/ERC1967Proxy.json";
import DepositPoolAbi from "@/app/abi/DepositPool.json"; // V2 ABI - Now using!
import ERC20Abi from "@/app/abi/ERC20.json";

const PUBLIC_POOL_ID = BigInt(0);
const SECONDS_PER_DAY = BigInt(86400);

// V2 Confirmed Pool Index (from discovery script)
const V2_REWARD_POOL_INDEX = BigInt(0); // ✅ Confirmed active on Sepolia

// --- Specific Types based on ABI/Description ---

interface PoolInfoData {
  payoutStart: bigint; // uint128
  decreaseInterval: bigint; // uint128
  withdrawLockPeriod: bigint; // uint128
  claimLockPeriod: bigint; // uint128
  withdrawLockPeriodAfterStake: bigint; // uint128
  initialReward: bigint; // uint256
  rewardDecrease: bigint; // uint256
  minimalStake: bigint; // uint256
  isPublic: boolean; // bool
}

interface PoolLimitsData {
  claimLockPeriodAfterStake: bigint; // uint128
  claimLockPeriodAfterClaim: bigint; // uint128
}

interface UserPoolData {
  lastStake: bigint; // uint128
  deposited: bigint; // uint256
  rate: bigint; // uint256 - Might not be used directly in UI yet
  pendingRewards: bigint; // uint256 - Might not be used directly in UI yet
  claimLockStart: bigint; // uint128
  claimLockEnd: bigint; // uint128
  virtualDeposited: bigint; // uint256 - Might not be used directly in UI yet
  lastClaim: bigint; // uint128
  referrer: `0x${string}`; // address - Might not be used directly in UI yet
}

// --- Types & Helpers moved from ChangeLockModal ---
type ActiveModal = "deposit" | "withdraw" | "claim" | "changeLock" | null;
type TimeUnit = "days" | "months" | "years";

// V2 Asset Types
type AssetSymbol = 'stETH' | 'LINK';

interface AssetConfig {
  symbol: AssetSymbol;
  depositPoolAddress: `0x${string}`;
  tokenAddress: `0x${string}`;
  decimals: number;
  icon: string;
}

interface AssetData {
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
  // Formatted for display
  userBalanceFormatted: string;
  userDepositedFormatted: string;
  claimableAmountFormatted: string;
  userMultiplierFormatted: string;
  totalDepositedFormatted: string;
  minimalStakeFormatted: string;
}

const durationToSeconds = (value: string, unit: TimeUnit): bigint => {
  const numValue = parseInt(value, 10);
  if (isNaN(numValue) || numValue <= 0) return BigInt(0);
  let multiplier: bigint;
  switch (unit) {
    case "days": multiplier = BigInt(86400); break;
    case "months": multiplier = BigInt(86400) * BigInt(30); break; // Approximation
    case "years": multiplier = BigInt(86400) * BigInt(365); break; // Approximation
    default: multiplier = BigInt(0);
  }
  return BigInt(numValue) * multiplier;
};

// --- Helper: BigInt Max ---
const maxBigInt = (...args: (bigint | undefined | null)[]): bigint => {
  let max = BigInt(0);
  for (const arg of args) {
    if (arg !== undefined && arg !== null && arg > max) {
      max = arg;
    }
  }
  return max;
};

// --- Context Shape ---
interface CapitalContextState {
  // Static Info
  l1ChainId?: number;
  l2ChainId?: number;
  userAddress?: `0x${string}`;
  networkEnv: NetworkEnvironment;
  
  // V2 Contract Addresses
  distributorV2Address?: `0x${string}`;
  rewardPoolV2Address?: `0x${string}`;
  l1SenderV2Address?: `0x${string}`;
  
  // Asset Configuration & Data
  assets: Record<AssetSymbol, AssetData>;
  selectedAsset: AssetSymbol;
  setSelectedAsset: (asset: AssetSymbol) => void;
  
  // Aggregated Data (across all assets)
  totalDepositedUSD: bigint; // Combined value of all assets
  totalClaimableAmount: bigint; // Combined claimable MOR from all pools
  morBalance?: bigint;

  // Formatted Data (aggregated)
  totalDepositedUSDFormatted: string;
  totalClaimableAmountFormatted: string;
  morBalanceFormatted: string;

  // Asset-specific formatted data (for selected asset)
  selectedAssetUserBalanceFormatted: string;
  selectedAssetDepositedFormatted: string;
  selectedAssetClaimableFormatted: string;
  selectedAssetMultiplierFormatted: string;
  selectedAssetTotalStakedFormatted: string;
  selectedAssetMinimalStakeFormatted: string;
  
  // Calculated Data (for selected asset)
  withdrawUnlockTimestamp?: bigint;
  claimUnlockTimestamp?: bigint;
  withdrawUnlockTimestampFormatted: string;
  claimUnlockTimestampFormatted: string;

  // Eligibility Flags (for selected asset)
  canWithdraw: boolean;
  canClaim: boolean;

  // Loading States
  isLoadingAssetData: boolean;
  isLoadingUserData: boolean;
  isLoadingBalances: boolean;

  // Action States
  isProcessingDeposit: boolean;
  isProcessingClaim: boolean;
  isProcessingWithdraw: boolean;
  isProcessingChangeLock: boolean;
  isApprovalSuccess: boolean;

  // V2 Action Functions (asset-aware)
  deposit: (asset: AssetSymbol, amount: string) => Promise<void>;
  claim: () => Promise<void>; // Claims from all pools
  withdraw: (asset: AssetSymbol, amount: string) => Promise<void>;
  changeLock: (lockValue: string, lockUnit: TimeUnit) => Promise<void>;
  approveToken: (asset: AssetSymbol) => Promise<void>;
  
  // Utility Functions
  needsApproval: (asset: AssetSymbol, amount: string) => boolean;
  checkAndUpdateApprovalNeeded: (asset: AssetSymbol, amount: string) => Promise<boolean>;

  // Modal State
  activeModal: ActiveModal;
  setActiveModal: (modal: ActiveModal) => void;

  // Multiplier simulation for selected asset
  multiplierSimArgs: {value: string, unit: TimeUnit} | null;
  triggerMultiplierEstimation: (lockValue: string, lockUnit: TimeUnit) => void;
  estimatedMultiplierValue: string;
  isSimulatingMultiplier: boolean;
}

// --- Create Context ---
const CapitalPageContext = createContext<CapitalContextState | null>(null);

// --- Provider Component ---
export function CapitalProvider({ children }: { children: React.ReactNode }) {
  // --- Modal State ---
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  // --- Hooks from Page ---
  const { address: userAddress } = useAccount();
  const chainId = useChainId();

  const networkEnv = useMemo((): NetworkEnvironment => {
    return [1, 42161, 8453].includes(chainId) ? 'mainnet' : 'testnet';
  }, [chainId]);

  const l1ChainId = useMemo(() => {
    return networkEnv === 'mainnet' ? mainnetChains.mainnet.id : testnetChains.sepolia.id;
  }, [networkEnv]);
  const l2ChainId = useMemo(() => {
    return networkEnv === 'mainnet' ? mainnetChains.arbitrum.id : testnetChains.arbitrumSepolia.id;
  }, [networkEnv]);

  // V1 Contract Addresses (keep for backward compatibility)
  const poolContractAddress = useMemo(() => getContractAddress(l1ChainId, 'erc1967Proxy', networkEnv) as `0x${string}` | undefined, [l1ChainId, networkEnv]);
  const stEthContractAddress = useMemo(() => getContractAddress(l1ChainId, 'stETH', networkEnv) as `0x${string}` | undefined, [l1ChainId, networkEnv]);
  const morContractAddress = useMemo(() => getContractAddress(l2ChainId, 'morToken', networkEnv) as `0x${string}` | undefined, [l2ChainId, networkEnv]);

  // V2 Contract Addresses
  const stETHDepositPoolAddress = useMemo(() => getContractAddress(l1ChainId, 'stETHDepositPool', networkEnv) as `0x${string}` | undefined, [l1ChainId, networkEnv]);
  const linkDepositPoolAddress = useMemo(() => getContractAddress(l1ChainId, 'linkDepositPool', networkEnv) as `0x${string}` | undefined, [l1ChainId, networkEnv]);
  const linkTokenAddress = useMemo(() => getContractAddress(l1ChainId, 'linkToken', networkEnv) as `0x${string}` | undefined, [l1ChainId, networkEnv]);
  const distributorV2Address = useMemo(() => getContractAddress(l1ChainId, 'distributorV2', networkEnv) as `0x${string}` | undefined, [l1ChainId, networkEnv]);
  const rewardPoolV2Address = useMemo(() => getContractAddress(l1ChainId, 'rewardPoolV2', networkEnv) as `0x${string}` | undefined, [l1ChainId, networkEnv]);
  const l1SenderV2Address = useMemo(() => getContractAddress(l1ChainId, 'l1SenderV2', networkEnv) as `0x${string}` | undefined, [l1ChainId, networkEnv]);

  // --- Read Hooks --- 
  const { data: poolInfoResult, isLoading: isLoadingPoolInfo } = useReadContract({
    address: poolContractAddress,
    abi: ERC1967ProxyAbi,
    functionName: 'pools',
    args: [PUBLIC_POOL_ID],
    chainId: l1ChainId,
    query: { enabled: !!poolContractAddress }
  });
  const poolInfo = useMemo((): PoolInfoData | undefined => {
    if (!poolInfoResult) return undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dataArray = poolInfoResult as any[]; // Cast needed because wagmi returns struct as unknown[]/any[]
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
        console.error("Error parsing poolInfoData:", e);
        return undefined;
    }
  }, [poolInfoResult]);

  const { data: poolLimitsResult, isLoading: isLoadingPoolLimits } = useReadContract({
    address: poolContractAddress,
    abi: ERC1967ProxyAbi,
    functionName: 'poolsLimits',
    args: [PUBLIC_POOL_ID],
    chainId: l1ChainId,
    query: { enabled: !!poolContractAddress }
  });
  const poolLimits = useMemo((): PoolLimitsData | undefined => {
     if (!poolLimitsResult) return undefined;
     // eslint-disable-next-line @typescript-eslint/no-explicit-any
     const dataArray = poolLimitsResult as any[]; // Cast needed because wagmi returns struct as unknown[]/any[]
     if (!Array.isArray(dataArray) || dataArray.length < 2) return undefined;
     try {
       return {
         claimLockPeriodAfterStake: BigInt(dataArray[0]),
         claimLockPeriodAfterClaim: BigInt(dataArray[1]),
       };
     } catch (e) {
        console.error("Error parsing poolLimitsData:", e);
        return undefined;
     }
  }, [poolLimitsResult]);

  const { 
    data: totalDepositedDataRaw, 
    isLoading: isLoadingTotalDeposited, 
  } = useReadContract({
    address: poolContractAddress,
    abi: ERC1967ProxyAbi,
    functionName: 'totalDepositedInPublicPools',
    chainId: l1ChainId,
    query: { enabled: !!poolContractAddress }
  });
  const totalDepositedData = useMemo(() => totalDepositedDataRaw as bigint | undefined, [totalDepositedDataRaw]);

  const { data: usersDataResult, isLoading: isLoadingUserDataRaw, refetch: refetchUserData } = useReadContract({
    address: poolContractAddress,
    abi: ERC1967ProxyAbi,
    functionName: 'usersData',
    args: [userAddress || zeroAddress, PUBLIC_POOL_ID],
    chainId: l1ChainId,
    query: { enabled: !!poolContractAddress && !!userAddress }
  });
  const userData = useMemo((): UserPoolData | undefined => {
    if (!usersDataResult) return undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dataArray = usersDataResult as any[]; // Cast needed because wagmi returns struct as unknown[]/any[]
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
        console.error("Error parsing usersDataResult:", e);
        return undefined;
    }
  }, [usersDataResult]);

  const { data: currentUserRewardDataRaw, isLoading: isLoadingUserReward, refetch: refetchUserReward } = useReadContract({
    address: poolContractAddress,
    abi: ERC1967ProxyAbi,
    functionName: 'getCurrentUserReward',
    args: [PUBLIC_POOL_ID, userAddress || zeroAddress],
    chainId: l1ChainId,
    query: { enabled: !!poolContractAddress && !!userAddress, refetchInterval: 15000 } 
  });
  const currentUserRewardData = useMemo(() => currentUserRewardDataRaw as bigint | undefined, [currentUserRewardDataRaw]);

  const { data: currentUserMultiplierDataRaw, isLoading: isLoadingUserMultiplier, refetch: refetchUserMultiplier } = useReadContract({
    address: poolContractAddress,
    abi: ERC1967ProxyAbi,
    functionName: 'getCurrentUserMultiplier',
    args: [PUBLIC_POOL_ID, userAddress || zeroAddress],
    chainId: l1ChainId,
    query: { enabled: !!poolContractAddress && !!userAddress } 
  });
  const currentUserMultiplierData = useMemo(() => currentUserMultiplierDataRaw as bigint | undefined, [currentUserMultiplierDataRaw]);

  const { data: stEthBalanceData, isLoading: isLoadingStEthBalance, refetch: refetchStEthBalance } = useBalance({ address: userAddress, token: stEthContractAddress, chainId: l1ChainId, query: { enabled: !!userAddress && !!stEthContractAddress } });
  const stEthBalance = stEthBalanceData?.value ?? BigInt(0);

  const { data: morBalanceData, isLoading: isLoadingMorBalance, refetch: refetchMorBalance } = useBalance({ address: userAddress, token: morContractAddress, chainId: l2ChainId, query: { enabled: !!userAddress && !!morContractAddress } });
  const morBalance = morBalanceData?.value ?? BigInt(0);

  const { data: allowanceData, isLoading: isLoadingAllowance, refetch: refetchAllowance } = useReadContract({
    address: stEthContractAddress,
    abi: ERC20Abi,
    functionName: 'allowance',
    args: [userAddress || zeroAddress, poolContractAddress || zeroAddress],
    chainId: l1ChainId,
    query: { enabled: !!userAddress && !!stEthContractAddress && !!poolContractAddress }
  });
  const currentAllowance = allowanceData as bigint | undefined ?? BigInt(0);

  // --- V2 DepositPool Reads (stETH) ---
  const { data: stETHV2UserData, isLoading: isLoadingStETHV2User, refetch: refetchStETHV2User } = useReadContract({
    address: stETHDepositPoolAddress,
    abi: DepositPoolAbi,
    functionName: 'usersData',
    args: [userAddress || zeroAddress, V2_REWARD_POOL_INDEX],
    chainId: l1ChainId,
    query: { enabled: !!stETHDepositPoolAddress && !!userAddress }
  });

  const { data: stETHV2PoolData, isLoading: isLoadingStETHV2Pool } = useReadContract({
    address: stETHDepositPoolAddress,
    abi: DepositPoolAbi,
    functionName: 'rewardPoolsProtocolDetails',
    args: [V2_REWARD_POOL_INDEX],
    chainId: l1ChainId,
    query: { enabled: !!stETHDepositPoolAddress }
  });

  const { data: stETHV2TotalDeposited, isLoading: isLoadingStETHV2Total } = useReadContract({
    address: stETHDepositPoolAddress,
    abi: DepositPoolAbi,
    functionName: 'totalDepositedInPublicPools',
    chainId: l1ChainId,
    query: { enabled: !!stETHDepositPoolAddress }
  });

  // --- V2 DepositPool Reads (LINK) ---
  const { data: linkV2UserData, isLoading: isLoadingLinkV2User, refetch: refetchLinkV2User } = useReadContract({
    address: linkDepositPoolAddress,
    abi: DepositPoolAbi,
    functionName: 'usersData',
    args: [userAddress || zeroAddress, V2_REWARD_POOL_INDEX],
    chainId: l1ChainId,
    query: { enabled: !!linkDepositPoolAddress && !!userAddress }
  });

  const { data: linkV2PoolData, isLoading: isLoadingLinkV2Pool } = useReadContract({
    address: linkDepositPoolAddress,
    abi: DepositPoolAbi,
    functionName: 'rewardPoolsProtocolDetails',
    args: [V2_REWARD_POOL_INDEX],
    chainId: l1ChainId,
    query: { enabled: !!linkDepositPoolAddress }
  });

  const { data: linkV2TotalDeposited, isLoading: isLoadingLinkV2Total } = useReadContract({
    address: linkDepositPoolAddress,
    abi: DepositPoolAbi,
    functionName: 'totalDepositedInPublicPools',
    chainId: l1ChainId,
    query: { enabled: !!linkDepositPoolAddress }
  });

  // --- V2 Token Balances ---
  const { data: linkBalanceData, isLoading: isLoadingLinkBalance, refetch: refetchLinkBalance } = useBalance({ 
    address: userAddress, 
    token: linkTokenAddress, 
    chainId: l1ChainId, 
    query: { enabled: !!userAddress && !!linkTokenAddress } 
  });
  const linkBalance = linkBalanceData?.value ?? BigInt(0);

  // --- Write Hooks ---
  const { data: approveHash, writeContractAsync: approveAsync, isPending: isSendingApproval } = useWriteContract();
  const { data: stakeHash, writeContractAsync: stakeAsync, isPending: isSendingStake } = useWriteContract();
  const { data: claimHash, writeContractAsync: claimAsync, isPending: isSendingClaim } = useWriteContract();
  const { data: withdrawHash, writeContractAsync: withdrawAsync, isPending: isSendingWithdraw } = useWriteContract();
  const { data: lockClaimHash, writeContractAsync: lockClaimAsync, isPending: isSendingLockClaim } = useWriteContract();

  // --- Transaction Monitoring ---
  const { isLoading: isConfirmingApproval, isSuccess: isApprovalSuccess } = useWaitForTransactionReceipt({ hash: approveHash, chainId: l1ChainId });
  const { isLoading: isConfirmingStake, isSuccess: isStakeSuccess } = useWaitForTransactionReceipt({ hash: stakeHash, chainId: l1ChainId });
  const { isLoading: isConfirmingClaim, isSuccess: isClaimSuccess } = useWaitForTransactionReceipt({ hash: claimHash, chainId: l1ChainId });
  const { isLoading: isConfirmingWithdraw, isSuccess: isWithdrawSuccess } = useWaitForTransactionReceipt({ hash: withdrawHash, chainId: l1ChainId });
  const { isLoading: isConfirmingLockClaim, isSuccess: isLockClaimSuccess } = useWaitForTransactionReceipt({ hash: lockClaimHash, chainId: l1ChainId });

  // --- Combined Loading States ---
  const isLoadingGlobalData = isLoadingTotalDeposited || isLoadingPoolInfo || isLoadingPoolLimits;
  const isLoadingUserData = isLoadingUserDataRaw || isLoadingUserReward || isLoadingUserMultiplier; 
  const isLoadingBalances = isLoadingStEthBalance || isLoadingMorBalance;

  // --- Action Processing States ---
  const isProcessingDeposit = isSendingApproval || isConfirmingApproval || isSendingStake || isConfirmingStake;
  const isProcessingClaim = isSendingClaim || isConfirmingClaim;
  const isProcessingWithdraw = isSendingWithdraw || isConfirmingWithdraw;
  const isProcessingChangeLock = isSendingLockClaim || isConfirmingLockClaim;

  // --- Calculations (Moved from page) ---
  // Use state and effect for a periodically updating timestamp
  const [currentTimestampSeconds, setCurrentTimestampSeconds] = useState<bigint>(BigInt(Math.floor(Date.now() / 1000)));

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentTimestampSeconds(BigInt(Math.floor(Date.now() / 1000)));
    }, 1000); // Update every second

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, []);

  const currentDailyReward = useMemo(() => {
    if (!poolInfo?.payoutStart || !poolInfo.initialReward || !poolInfo.rewardDecrease || !poolInfo.decreaseInterval || poolInfo.decreaseInterval === BigInt(0)) return undefined;
    if (currentTimestampSeconds < poolInfo.payoutStart) return BigInt(0);
    const intervalsPassed = (currentTimestampSeconds - poolInfo.payoutStart) / poolInfo.decreaseInterval;
    const currentRewardRate = poolInfo.initialReward - (intervalsPassed * poolInfo.rewardDecrease);
    const effectiveRewardRate = currentRewardRate > BigInt(0) ? currentRewardRate : BigInt(0);
    return (effectiveRewardRate * SECONDS_PER_DAY) / poolInfo.decreaseInterval;
  }, [poolInfo, currentTimestampSeconds]);

  const withdrawUnlockTimestamp = useMemo(() => {
    if (!poolInfo?.payoutStart || !poolInfo.withdrawLockPeriod || !userData?.lastStake || !poolInfo.withdrawLockPeriodAfterStake) return undefined;
    return maxBigInt(poolInfo.payoutStart + poolInfo.withdrawLockPeriod, userData.lastStake + poolInfo.withdrawLockPeriodAfterStake);
  }, [poolInfo, userData]);

  const claimUnlockTimestamp = useMemo(() => {
    // Debug logging for claim unlock calculation
    console.log("🔍 Debug: Calculating claimUnlockTimestamp", {
      poolInfo: poolInfo ? {
        payoutStart: poolInfo.payoutStart?.toString(),
        claimLockPeriod: poolInfo.claimLockPeriod?.toString()
      } : "undefined",
      poolLimits: poolLimits ? {
        claimLockPeriodAfterClaim: poolLimits.claimLockPeriodAfterClaim?.toString(),
        claimLockPeriodAfterStake: poolLimits.claimLockPeriodAfterStake?.toString()
      } : "undefined",
      userData: userData ? {
        lastStake: userData.lastStake?.toString(),
        lastClaim: userData.lastClaim?.toString(),
        claimLockEnd: userData.claimLockEnd?.toString()
      } : "undefined",
      currentUserRewardData: currentUserRewardData?.toString(),
      userAddress,
      chainId,
      networkEnv,
      l1ChainId,
      poolContractAddress
    });

    if (
      !poolInfo?.payoutStart ||
      !poolInfo.claimLockPeriod ||
      !poolLimits?.claimLockPeriodAfterClaim ||
      !poolLimits.claimLockPeriodAfterStake ||
      !userData?.lastStake ||
      !userData.lastClaim ||
      userData.claimLockEnd === undefined
    ) {
      console.log("❌ claimUnlockTimestamp is undefined due to missing data:", {
        hasPayoutStart: !!poolInfo?.payoutStart,
        hasClaimLockPeriod: !!poolInfo?.claimLockPeriod,
        hasClaimLockPeriodAfterClaim: !!poolLimits?.claimLockPeriodAfterClaim,
        hasClaimLockPeriodAfterStake: !!poolLimits?.claimLockPeriodAfterStake,
        hasLastStake: !!userData?.lastStake,
        hasLastClaim: !!userData?.lastClaim,
        hasClaimLockEnd: userData?.claimLockEnd !== undefined
      });
      return undefined;
    }
    
    const result = maxBigInt(
      userData.claimLockEnd,
      poolInfo.payoutStart + poolInfo.claimLockPeriod,
      userData.lastClaim + poolLimits.claimLockPeriodAfterClaim,
      userData.lastStake + poolLimits.claimLockPeriodAfterStake
    );
    
    console.log("✅ claimUnlockTimestamp calculated:", {
      result: result.toString(),
      formatted: new Date(Number(result) * 1000).toISOString(),
      components: {
        claimLockEnd: userData.claimLockEnd.toString(),
        payoutStartPlusLock: (poolInfo.payoutStart + poolInfo.claimLockPeriod).toString(),
        lastClaimPlusLock: (userData.lastClaim + poolLimits.claimLockPeriodAfterClaim).toString(),
        lastStakePlusLock: (userData.lastStake + poolLimits.claimLockPeriodAfterStake).toString()
      }
    });
    
    return result;
  }, [poolInfo, poolLimits, userData, currentUserRewardData, userAddress, chainId, networkEnv, l1ChainId, poolContractAddress]);

  // --- Eligibility Checks ---
  const canWithdraw = useMemo(() => {
    if (!withdrawUnlockTimestamp || !userData?.deposited || userData.deposited === BigInt(0)) return false;
    return currentTimestampSeconds >= withdrawUnlockTimestamp;
  }, [withdrawUnlockTimestamp, userData?.deposited, currentTimestampSeconds]);

  const canClaim = useMemo(() => {
    const result = !(!claimUnlockTimestamp || !currentUserRewardData || currentUserRewardData === BigInt(0)) && 
                   currentTimestampSeconds >= claimUnlockTimestamp;
    
    console.log("🔍 Debug: canClaim calculation", {
      claimUnlockTimestamp: claimUnlockTimestamp?.toString(),
      currentUserRewardData: currentUserRewardData?.toString(),
      currentTimestampSeconds: currentTimestampSeconds.toString(),
      timeComparison: claimUnlockTimestamp ? `${currentTimestampSeconds} >= ${claimUnlockTimestamp} = ${currentTimestampSeconds >= claimUnlockTimestamp}` : "N/A",
      canClaim: result
    });
    
    return result;
  }, [claimUnlockTimestamp, currentUserRewardData, currentTimestampSeconds]);

  const needsApproval = useCallback((amountString: string): boolean => {
    try {
      const amountBigInt = amountString ? parseUnits(amountString, 18) : BigInt(0);
      if (amountBigInt <= BigInt(0)) return false;
      return currentAllowance < amountBigInt;
    } catch {
      return false; 
    }
  }, [currentAllowance]);

  const checkAndUpdateApprovalNeeded = useCallback(async (amountString: string): Promise<boolean> => {
    try {
      const amountBigInt = amountString ? parseUnits(amountString, 18) : BigInt(0);
      if (amountBigInt <= BigInt(0)) return false;
      
      // Refetch the current allowance to get the latest value
      const { data: latestAllowance } = await refetchAllowance();
      const currentAllowanceValue = latestAllowance as bigint ?? BigInt(0);
      
      return currentAllowanceValue < amountBigInt;
    } catch (error) {
      console.error("Error checking approval status:", error);
      return false; 
    }
  }, [refetchAllowance]);

  // --- Formatted Data ---
  const totalDepositedFormatted = formatBigInt(totalDepositedData, 18, 2);
  const userDepositFormatted = formatBigInt(userData?.deposited, 18, 2);
  const claimableAmountFormatted = formatBigInt(currentUserRewardData, 18, 2);
  const userMultiplierFormatted = currentUserMultiplierData ? `${formatBigInt(currentUserMultiplierData, 24, 1)}x` : "---x";
  const poolStartTimeFormatted = formatTimestamp(poolInfo?.payoutStart);
  const currentDailyRewardFormatted = formatBigInt(currentDailyReward, 18, 2);

  // --- Log Raw Multiplier Data ---
  useEffect(() => {
    if (currentUserMultiplierData !== undefined) {
      console.log("Raw currentUserMultiplierData:", currentUserMultiplierData);
    }
  }, [currentUserMultiplierData]);
  // --------------------------------

  const withdrawUnlockTimestampFormatted = formatTimestamp(withdrawUnlockTimestamp);
  const claimUnlockTimestampFormatted = formatTimestamp(claimUnlockTimestamp);
  const minimalStakeFormatted = formatBigInt(poolInfo?.minimalStake, 18, 0);
  const stEthBalanceFormatted = formatBigInt(stEthBalance, 18, 4);

  // --- Action Functions (Update to close modal on success) --- 
  const handleTransaction = useCallback(async (
    txFunction: () => Promise<`0x${string}`>,
    options: { loading: string; success: string; error: string; onSuccess?: () => void; skipClose?: boolean } // Add skipClose option
  ) => {
    const toastId = options.loading; // Use loading message as ID
    toast.loading(options.loading, { id: toastId });
    try {
      const hash = await txFunction();
      console.log("Transaction initiated:", hash);
      toast.dismiss(toastId); 
      // Wait for confirmation effects to handle success toast & closing
      return hash;
    } catch (error) {
      console.error(options.error, error);
      toast.dismiss(toastId);
      toast.error(`${options.error}: ${(error as BaseError)?.shortMessage || (error as Error)?.message}`);
      throw error; // Re-throw for modal error handling
    }
  }, []); // Removed setActiveModal dependency
  
  const approveStEth = useCallback(async () => {
      if (!poolContractAddress || !stEthContractAddress || !l1ChainId) throw new Error("Approve prerequisites not met");
      await handleTransaction(() => approveAsync({
          address: stEthContractAddress,
          abi: ERC20Abi,
          functionName: 'approve',
          args: [poolContractAddress, maxInt256],
          chainId: l1ChainId,
      }), {
          loading: "Requesting approval...",
          success: "Approval successful!", 
          error: "Approval failed",
          skipClose: true // Don't close modal on approval success
      });
  }, [approveAsync, poolContractAddress, stEthContractAddress, l1ChainId, handleTransaction]);

  const deposit = useCallback(async (amountString: string) => {
      if (!poolContractAddress || !l1ChainId) throw new Error("Deposit prerequisites not met");
      const amountBigInt = parseUnits(amountString, 18);
      if (amountBigInt <= BigInt(0)) throw new Error("Invalid deposit amount");
      
      await handleTransaction(() => stakeAsync({
          address: poolContractAddress,
          abi: ERC1967ProxyAbi,
          functionName: 'stake',
          args: [PUBLIC_POOL_ID, amountBigInt, BigInt(0), zeroAddress],
          chainId: l1ChainId,
      }), {
          loading: "Requesting deposit...",
          success: `Successfully deposited ${amountString} stETH/wstETH!`, 
          error: "Deposit failed"
      });
  }, [stakeAsync, poolContractAddress, l1ChainId, handleTransaction]);

  const claim = useCallback(async () => {
    if (!poolContractAddress || !l1ChainId || !userAddress || !canClaim) throw new Error("Claim prerequisites not met");
      await handleTransaction(() => claimAsync({
          address: poolContractAddress,
          abi: ERC1967ProxyAbi,
          functionName: 'claim',
          args: [PUBLIC_POOL_ID, userAddress],
          chainId: l1ChainId,
      }), {
          loading: "Requesting claim...",
          success: "Successfully claimed MOR!",
          error: "Claim failed"
      });
  }, [claimAsync, poolContractAddress, l1ChainId, userAddress, canClaim, handleTransaction]);

  const withdraw = useCallback(async (amountString: string) => {
      if (!poolContractAddress || !l1ChainId || !canWithdraw) throw new Error("Withdraw prerequisites not met");
      const amountBigInt = parseUnits(amountString, 18);
      if (amountBigInt <= BigInt(0)) throw new Error("Invalid withdraw amount");
      if (userData?.deposited && amountBigInt > userData.deposited) throw new Error("Insufficient deposited balance");

      // Set a safe gas limit based on direct contract call experience (adjust as needed)
      const SAFE_WITHDRAW_GAS_LIMIT = BigInt(1200000); // <-- Adjust this value if needed

      await handleTransaction(() => withdrawAsync({
          address: poolContractAddress,
          abi: ERC1967ProxyAbi,
          functionName: 'withdraw',
          args: [PUBLIC_POOL_ID, amountBigInt],
          chainId: l1ChainId,
          gas: SAFE_WITHDRAW_GAS_LIMIT,
      }), {
          loading: "Requesting withdrawal...",
          success: `Successfully withdrew ${amountString} stETH/wstETH!`, 
          error: "Withdrawal failed"
      });
  }, [withdrawAsync, poolContractAddress, l1ChainId, canWithdraw, userData?.deposited, handleTransaction]);
  
  const changeLock = useCallback(async (lockValue: string, lockUnit: TimeUnit) => {
      if (!poolContractAddress || !l1ChainId) throw new Error("Change lock prerequisites not met");
      const durationSeconds = durationToSeconds(lockValue, lockUnit);
      if (durationSeconds <= BigInt(0)) throw new Error("Invalid lock duration");
      const finalLockEndTimestamp = BigInt(Math.floor(Date.now() / 1000)) + durationSeconds;
      
      await handleTransaction(() => lockClaimAsync({
          address: poolContractAddress,
          abi: ERC1967ProxyAbi,
          functionName: 'lockClaim',
          args: [PUBLIC_POOL_ID, finalLockEndTimestamp],
          chainId: l1ChainId,
      }), {
          loading: "Requesting lock change...",
          success: "Successfully updated lock period!",
          error: "Lock update failed"
      });
  }, [lockClaimAsync, poolContractAddress, l1ChainId, handleTransaction]);
  
  // --- Transaction Success/Error Effects (Update to close modal) ---
  useEffect(() => {
    if (isApprovalSuccess) {
        toast.success("Approval successful!");
        refetchAllowance();
        // Don't close modal after approval
    }
  }, [isApprovalSuccess, refetchAllowance]);
  
  useEffect(() => {
      if (isStakeSuccess) {
          toast.success(`Stake confirmed!`);
          refetchUserData();
          refetchUserReward();
          refetchStEthBalance(); 
          setActiveModal(null); // Close modal on success
      }
  }, [isStakeSuccess, refetchUserData, refetchUserReward, refetchStEthBalance, setActiveModal]);
  
  useEffect(() => {
      if (isClaimSuccess) {
          toast.success("Claim confirmed!");
          refetchUserData();
          refetchUserReward();
          refetchMorBalance();
          setActiveModal(null); // Close modal on success
      }
  }, [isClaimSuccess, refetchUserData, refetchUserReward, refetchMorBalance, setActiveModal]);
  
  useEffect(() => {
      if (isWithdrawSuccess) {
          toast.success("Withdrawal confirmed!");
          refetchUserData();
          refetchUserReward();
          refetchStEthBalance();
          setActiveModal(null); // Close modal on success
      }
  }, [isWithdrawSuccess, refetchUserData, refetchUserReward, refetchStEthBalance, setActiveModal]);

  useEffect(() => {
      if (isLockClaimSuccess) {
          toast.success("Lock period update confirmed!");
          refetchUserData();
          refetchUserMultiplier();
          setActiveModal(null); // Close modal on success
      }
  }, [isLockClaimSuccess, refetchUserData, refetchUserMultiplier, setActiveModal]);

  // --- New state for multiplier simulation ---
  const [multiplierSimArgs, setMultiplierSimArgs] = useState<{value: string, unit: TimeUnit} | null>(null);

  const { data: simulatedMultiplierResult, error: simulateMultiplierError, isLoading: isSimulatingMultiplier } = useSimulateContract({
    address: poolContractAddress,
    abi: ERC1967ProxyAbi,
    functionName: 'getClaimLockPeriodMultiplier',
    args: useMemo(() => {
      if (!multiplierSimArgs) return undefined;
      const durationSeconds = durationToSeconds(multiplierSimArgs.value, multiplierSimArgs.unit);
      if (durationSeconds <= BigInt(0)) return undefined;
      const estimatedLockStartTimestamp = BigInt(Math.floor(Date.now() / 1000));
      const estimatedLockEndTimestamp = estimatedLockStartTimestamp + durationSeconds;
      return [PUBLIC_POOL_ID, estimatedLockStartTimestamp, estimatedLockEndTimestamp];
    }, [multiplierSimArgs]),
    chainId: l1ChainId,
    query: { 
      enabled: !!multiplierSimArgs && !!poolContractAddress && !!l1ChainId, // Only run when args are set
    } 
  });

  // This function is now just used by the modal to set the simulation arguments
  const triggerMultiplierEstimation = useCallback((lockValue: string, lockUnit: TimeUnit) => {
      if (lockValue && parseInt(lockValue, 10) > 0) {
          setMultiplierSimArgs({ value: lockValue, unit: lockUnit });
      } else {
          setMultiplierSimArgs(null); // Clear args if input is invalid
      }
  }, []);

  // The estimated multiplier result is now derived from the simulation state
  const estimatedMultiplierValue = useMemo(() => {
      if (isSimulatingMultiplier) return "Loading...";
      if (simulateMultiplierError) return "Error";
      if (simulatedMultiplierResult?.result) {
          // --- Log Raw Simulated Multiplier Data ---
          console.log("Raw simulatedMultiplierResult.result:", simulatedMultiplierResult.result);
          // -----------------------------------------
          return formatBigInt(simulatedMultiplierResult.result as bigint, 24, 1) + "x";
      }
      return "---x"; // Default or if no valid args set
  }, [simulatedMultiplierResult, simulateMultiplierError, isSimulatingMultiplier]);

  // --- Context Value ---
  const contextValue = useMemo(() => ({
    // Static Info
    l1ChainId,
    l2ChainId,
    userAddress,
    networkEnv,
    
    // V2 Contract Addresses
    distributorV2Address: getContractAddress(l1ChainId, 'distributorV2', networkEnv) as `0x${string}` | undefined,
    rewardPoolV2Address: getContractAddress(l1ChainId, 'rewardPoolV2', networkEnv) as `0x${string}` | undefined,
    l1SenderV2Address: getContractAddress(l1ChainId, 'l1SenderV2', networkEnv) as `0x${string}` | undefined,

    // Asset Configuration & Data
    assets: {
      stETH: {
        symbol: 'stETH' as AssetSymbol,
        config: {
          symbol: 'stETH' as AssetSymbol,
          depositPoolAddress: getContractAddress(l1ChainId, 'stETHDepositPool', networkEnv) as `0x${string}`,
          tokenAddress: stEthContractAddress || zeroAddress,
          decimals: 18,
          icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84/logo.png',
        },
        userBalance: stEthBalance,
        userDeposited: userData?.deposited || BigInt(0),
        userAllowance: currentAllowance,
        claimableAmount: currentUserRewardData || BigInt(0),
        userMultiplier: currentUserMultiplierData || BigInt(1),
        totalDeposited: totalDepositedData || BigInt(0),
        protocolDetails: poolLimits || null,
        poolData: null, // No direct pool data for stETH here, as it's a single pool
        userBalanceFormatted: formatBigInt(stEthBalance, 18, 4),
        userDepositedFormatted: formatBigInt(userData?.deposited, 18, 2),
        claimableAmountFormatted: formatBigInt(currentUserRewardData, 18, 2),
        userMultiplierFormatted: currentUserMultiplierData ? `${formatBigInt(currentUserMultiplierData, 24, 1)}x` : "---x",
        totalDepositedFormatted: formatBigInt(totalDepositedData, 18, 2),
        minimalStakeFormatted: formatBigInt(poolInfo?.minimalStake, 18, 0),
      },
      LINK: {
        symbol: 'LINK' as AssetSymbol,
        config: {
          symbol: 'LINK' as AssetSymbol,
          depositPoolAddress: getContractAddress(l1ChainId, 'linkDepositPool', networkEnv) as `0x${string}`,
          tokenAddress: getContractAddress(l1ChainId, 'linkToken', networkEnv) as `0x${string}`,
          decimals: 18,
          icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xF977814e90dA44bFA03b6295A0616a897441aceC/logo.png',
        },
        userBalance: BigInt(0), // No direct user balance for LINK here, as it's a separate pool
        userDeposited: BigInt(0),
        userAllowance: BigInt(0),
        claimableAmount: BigInt(0),
        userMultiplier: BigInt(1),
        totalDeposited: BigInt(0),
        protocolDetails: null,
        poolData: null,
        userBalanceFormatted: "---",
        userDepositedFormatted: "---",
        claimableAmountFormatted: "---",
        userMultiplierFormatted: "---x",
        totalDepositedFormatted: "---",
        minimalStakeFormatted: "---",
      },
    },
    selectedAsset: 'stETH' as AssetSymbol,
    setSelectedAsset: (_asset: AssetSymbol) => setActiveModal(null), // Close modal when changing asset

    // Aggregated Data (across all assets)
    totalDepositedUSD: totalDepositedData || BigInt(0),
    totalClaimableAmount: currentUserRewardData || BigInt(0),
    morBalance: morBalance,

    // Formatted Data (aggregated)
    totalDepositedUSDFormatted: formatBigInt(totalDepositedData, 18, 2),
    totalClaimableAmountFormatted: formatBigInt(currentUserRewardData, 18, 2),
    morBalanceFormatted: formatBigInt(morBalance, 18, 4),

    // Asset-specific formatted data (for selected asset)
    selectedAssetUserBalanceFormatted: formatBigInt(stEthBalance, 18, 4),
    selectedAssetDepositedFormatted: formatBigInt(userData?.deposited, 18, 2),
    selectedAssetClaimableFormatted: formatBigInt(currentUserRewardData, 18, 2),
    selectedAssetMultiplierFormatted: currentUserMultiplierData ? `${formatBigInt(currentUserMultiplierData, 24, 1)}x` : "---x",
    selectedAssetTotalStakedFormatted: formatBigInt(totalDepositedData, 18, 2),
    selectedAssetMinimalStakeFormatted: formatBigInt(poolInfo?.minimalStake, 18, 0),
    
    // Calculated Data (for selected asset)
    withdrawUnlockTimestamp: withdrawUnlockTimestamp,
    claimUnlockTimestamp: claimUnlockTimestamp,
    withdrawUnlockTimestampFormatted: formatTimestamp(withdrawUnlockTimestamp),
    claimUnlockTimestampFormatted: formatTimestamp(claimUnlockTimestamp),

    // Eligibility Flags (for selected asset)
    canWithdraw: canWithdraw,
    canClaim: canClaim,

    // Loading States
    isLoadingAssetData: false, // This state is not directly managed here, but could be added if needed
    isLoadingUserData: isLoadingUserData,
    isLoadingBalances: isLoadingBalances,

    // Action States
    isProcessingDeposit: isProcessingDeposit,
    isProcessingClaim: isProcessingClaim,
    isProcessingWithdraw: isProcessingWithdraw,
    isProcessingChangeLock: isProcessingChangeLock,
    isApprovalSuccess: isApprovalSuccess,

    // V2 Action Functions (asset-aware)
    deposit: (asset: AssetSymbol, amountString: string) => {
      if (asset === 'stETH') {
        deposit(amountString);
      } else if (asset === 'LINK') {
        // For LINK, we would need to call a LINK-specific deposit function
        // This would involve a different contract interaction and state management
        // For now, we'll just show a message or throw an error
        toast.error("LINK deposit functionality not yet implemented.");
      }
    },
    claim: () => claim(), // Claims from all pools
    withdraw: (asset: AssetSymbol, amountString: string) => {
      if (asset === 'stETH') {
        withdraw(amountString);
      } else if (asset === 'LINK') {
        // For LINK, we would need to call a LINK-specific withdraw function
        // This would involve a different contract interaction and state management
        // For now, we'll just show a message or throw an error
        toast.error("LINK withdrawal functionality not yet implemented.");
      }
    },
    changeLock: (lockValue: string, lockUnit: TimeUnit) => changeLock(lockValue, lockUnit),
    approveToken: (asset: AssetSymbol) => {
      if (asset === 'stETH') {
        approveStEth();
      } else if (asset === 'LINK') {
        // For LINK, we would need to call a LINK-specific approve function
        // This would involve a different contract interaction and state management
        // For now, we'll just show a message or throw an error
        toast.error("LINK approval functionality not yet implemented.");
      }
    },
    
    // Utility Functions
    needsApproval: (asset: AssetSymbol, amountString: string) => {
      if (asset === 'stETH') {
        return needsApproval(amountString);
      } else if (asset === 'LINK') {
        // For LINK, we would need to call a LINK-specific allowance check
        // This would involve a different contract interaction and state management
        // For now, we'll just show a message or throw an error
        toast.error("LINK approval check functionality not yet implemented.");
        return false; // Default to false for now
      }
      return false;
    },
    checkAndUpdateApprovalNeeded: async (asset: AssetSymbol, amountString: string) => {
      if (asset === 'stETH') {
        return checkAndUpdateApprovalNeeded(amountString);
      } else if (asset === 'LINK') {
        // For LINK, we would need to call a LINK-specific allowance check
        // This would involve a different contract interaction and state management
        // For now, we'll just show a message or throw an error
        toast.error("LINK approval check functionality not yet implemented.");
        return false; // Default to false for now
      }
      return false;
    },

    // Modal State
    activeModal,
    setActiveModal,

    // Multiplier simulation for selected asset
    multiplierSimArgs,
    triggerMultiplierEstimation,
    estimatedMultiplierValue,
    isSimulatingMultiplier,
  }), [
    // Dependencies for all values provided
    l1ChainId, l2ChainId, userAddress, networkEnv,
    stEthContractAddress, morContractAddress,
    userData, totalDepositedData, currentUserRewardData, currentUserMultiplierData,
    stEthBalance, morBalance, currentAllowance,
    poolInfo, poolLimits,
    withdrawUnlockTimestamp, claimUnlockTimestamp,
    canWithdraw, canClaim,
    isLoadingUserData, isLoadingBalances,
    isProcessingDeposit, isProcessingClaim, isProcessingWithdraw, isProcessingChangeLock, isApprovalSuccess,
    deposit, claim, withdraw, changeLock, approveStEth, needsApproval, checkAndUpdateApprovalNeeded,
    triggerMultiplierEstimation, estimatedMultiplierValue, isSimulatingMultiplier,
    activeModal, setActiveModal,
    // New state for multiplier simulation
    multiplierSimArgs,
  ]);

  return (
    <CapitalPageContext.Provider value={contextValue}>
      {children}
    </CapitalPageContext.Provider>
  );
}

// --- Consumer Hook ---
export function useCapitalContext() {
  const context = useContext(CapitalPageContext);
  if (!context) {
    throw new Error("useCapitalContext must be used within a CapitalProvider");
  }
  return context;
} 