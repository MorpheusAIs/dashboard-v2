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
  usePublicClient,
  type BaseError 
} from "wagmi";
import { parseUnits, parseEther, zeroAddress, maxInt256, getContract } from "viem";
import { toast } from "sonner";

// Import Config, Utils & ABIs
import { 
  testnetChains, 
  mainnetChains, 
  getContractAddress, 
  type NetworkEnvironment 
} from "@/config/networks";
import { formatTimestamp, formatBigInt } from "@/lib/utils/formatters";

// Static ABI imports as fallbacks - keep these for reliability
import ERC1967ProxyAbi from "@/app/abi/ERC1967Proxy.json";
import DepositPoolAbi from "@/app/abi/DepositPool.json"; // V2 ABI - Now using!
import ERC20Abi from "@/app/abi/ERC20.json";

const PUBLIC_POOL_ID = BigInt(0);
// Removed unused SECONDS_PER_DAY constant

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
type ActiveModal = "deposit" | "withdraw" | "claim" | "changeLock" | "stakeMorRewards" | "claimMorRewards" | null;
type TimeUnit = "days" | "months" | "years";

// V2 Asset Types
type AssetSymbol = 'stETH' | 'LINK';

// Contract types for better typing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DynamicContract = any; // Complex viem contract type - simplified for now

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

// Helper to parse V2 user data from contract response
const parseV2UserData = (data: unknown): UserPoolData | undefined => {
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

// Helper to parse V2 protocol details from contract response
const parseV2ProtocolDetails = (data: unknown): PoolLimitsData | undefined => {
  if (!data) return undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dataArray = data as any[];
  if (!Array.isArray(dataArray) || dataArray.length < 5) return undefined;
  try {
    return {
      claimLockPeriodAfterStake: BigInt(dataArray[1]),
      claimLockPeriodAfterClaim: BigInt(dataArray[2]),
    };
  } catch (e) {
    console.error("Error parsing V2 protocol details:", e);
    return undefined;
  }
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

  // V2-specific claim data for individual assets
  stETHV2CanClaim: boolean;
  linkV2CanClaim: boolean;
  stETHV2ClaimUnlockTimestamp?: bigint;
  linkV2ClaimUnlockTimestamp?: bigint;
  stETHV2ClaimUnlockTimestampFormatted: string;
  linkV2ClaimUnlockTimestampFormatted: string;

  // V2 Referral Data
  referralData: {
    totalReferrals: string; // Count of people referred (may need event tracking)
    lifetimeRewards: string; // Total value generated by referrals (from amountStaked)
    claimableRewards: string; // Current claimable referral rewards
    isLoadingReferralData: boolean;
    stETHReferralRewards: bigint;
    linkReferralRewards: bigint;
    stETHReferralData: {
      amountStaked: bigint;
      pendingRewards: bigint;
      lastClaim: bigint;
    } | null;
    linkReferralData: {
      amountStaked: bigint;
      pendingRewards: bigint;
      lastClaim: bigint;
    } | null;
  };

  // Loading States - NOW PROPERLY USED!
  isLoadingAssetData: boolean;
  isLoadingUserData: boolean;
  isLoadingBalances: boolean;
  isLoadingAllowances: boolean;
  isLoadingRewards: boolean;
  isLoadingTotalDeposits: boolean;

  // Legacy Properties (for backward compatibility)
  userDepositFormatted: string;
  claimableAmountFormatted: string;
  userData?: UserPoolData;
  currentUserMultiplierData?: bigint;
  poolInfo?: PoolInfoData;

  // Action States
  isProcessingDeposit: boolean;
  isProcessingClaim: boolean;
  isProcessingWithdraw: boolean;
  isProcessingChangeLock: boolean;
  isApprovalSuccess: boolean;

  // V2 Action Functions (asset-aware)
  deposit: (asset: AssetSymbol, amount: string, lockDurationSeconds?: bigint) => Promise<void>;
  claim: () => Promise<void>; // Claims from all pools
  withdraw: (asset: AssetSymbol, amount: string) => Promise<void>;
  changeLock: (lockValue: string, lockUnit: TimeUnit) => Promise<void>;
  approveToken: (asset: AssetSymbol) => Promise<void>;
  claimAssetRewards: (asset: AssetSymbol) => Promise<void>;
  lockAssetRewards: (asset: AssetSymbol, lockDurationSeconds: bigint) => Promise<void>;
  claimReferralRewards: (asset: AssetSymbol) => Promise<void>;
  
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

  // Dynamic Contract Loading
  dynamicContracts: {
    stETHToken?: DynamicContract;
    linkToken?: DynamicContract;
    stETHDepositPool?: DynamicContract;
    linkDepositPool?: DynamicContract;
  };
}

// --- Create Context ---
const CapitalPageContext = createContext<CapitalContextState | null>(null);

// --- Provider Component ---
export function CapitalProvider({ children }: { children: React.ReactNode }) {
  // --- Modal State ---
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [selectedAsset, setSelectedAsset] = useState<AssetSymbol>('stETH');

  // --- Hooks from Page ---
  const { address: userAddress } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();

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
  const stEthContractAddress = useMemo(() => {
    const address = getContractAddress(l1ChainId, 'stETH', networkEnv) as `0x${string}` | undefined;
    if (networkEnv === 'testnet') {
      console.log('📄 stETH Contract Address Resolution:', {
        l1ChainId,
        networkEnv,
        resolvedAddress: address,
        expectedSepoliaAddress: '0xa878Ad6fF38d6fAE81FBb048384cE91979d448DA'
      });
    }
    return address;
  }, [l1ChainId, networkEnv]);
  const morContractAddress = useMemo(() => getContractAddress(l2ChainId, 'morToken', networkEnv) as `0x${string}` | undefined, [l2ChainId, networkEnv]);

  // V2 Contract Addresses
  const stETHDepositPoolAddress = useMemo(() => getContractAddress(l1ChainId, 'stETHDepositPool', networkEnv) as `0x${string}` | undefined, [l1ChainId, networkEnv]);
  const linkDepositPoolAddress = useMemo(() => getContractAddress(l1ChainId, 'linkDepositPool', networkEnv) as `0x${string}` | undefined, [l1ChainId, networkEnv]);
  const linkTokenAddress = useMemo(() => {
    const address = getContractAddress(l1ChainId, 'linkToken', networkEnv) as `0x${string}` | undefined;
    if (networkEnv === 'testnet') {
      console.log('🔗 LINK Token Address Resolution:', {
        l1ChainId,
        networkEnv,
        resolvedAddress: address,
        expectedSepoliaAddress: '0xf8Fb3713D459D7C1018BD0A49D19b4C44290EBE5'
      });
    }
    return address;
  }, [l1ChainId, networkEnv]);
  const distributorV2Address = useMemo(() => getContractAddress(l1ChainId, 'distributorV2', networkEnv) as `0x${string}` | undefined, [l1ChainId, networkEnv]);
  const rewardPoolV2Address = useMemo(() => getContractAddress(l1ChainId, 'rewardPoolV2', networkEnv) as `0x${string}` | undefined, [l1ChainId, networkEnv]);
  const l1SenderV2Address = useMemo(() => getContractAddress(l1ChainId, 'l1SenderV2', networkEnv) as `0x${string}` | undefined, [l1ChainId, networkEnv]);

  // --- Dynamic Contract Loading with getContract ---
  const dynamicContracts = useMemo(() => {
    if (!publicClient) return {};
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contracts: Record<string, any> = {};
    
    try {
      // Create dynamic stETH token contract
      if (stEthContractAddress) {
        contracts.stETHToken = getContract({
          address: stEthContractAddress,
          abi: ERC20Abi, // Fallback to static ABI
          client: publicClient,
        });
      }
      
      // Create dynamic LINK token contract
      if (linkTokenAddress) {
        contracts.linkToken = getContract({
          address: linkTokenAddress,
          abi: ERC20Abi, // Fallback to static ABI
          client: publicClient,
        });
      }
      
      // Create dynamic stETH deposit pool contract
      if (stETHDepositPoolAddress) {
        contracts.stETHDepositPool = getContract({
          address: stETHDepositPoolAddress,
          abi: DepositPoolAbi, // Fallback to static ABI
          client: publicClient,
        });
      }
      
      // Create dynamic LINK deposit pool contract
      if (linkDepositPoolAddress) {
        contracts.linkDepositPool = getContract({
          address: linkDepositPoolAddress,
          abi: DepositPoolAbi, // Fallback to static ABI
          client: publicClient,
        });
      }
      
      console.log("🎯 Dynamic contracts created:", Object.keys(contracts));
    } catch (error) {
      console.error("❌ Error creating dynamic contracts:", error);
    }
    
    return contracts;
  }, [publicClient, stEthContractAddress, linkTokenAddress, stETHDepositPoolAddress, linkDepositPoolAddress]);

  // --- Read Hooks --- 
  const { data: poolInfoResult } = useReadContract({
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

  const { data: poolLimitsResult } = useReadContract({
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
    data: totalDepositedDataRaw
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

  const { data: stEthBalanceData, isLoading: isLoadingStEthBalance, refetch: refetchStEthBalance, error: stEthBalanceError } = useBalance({ address: userAddress, token: stEthContractAddress, chainId: l1ChainId, query: { enabled: !!userAddress && !!stEthContractAddress } });
  
  // Debug logging for stETH balance on testnet
  useEffect(() => {
    if (networkEnv === 'testnet') {
      console.log('🔍 stETH Balance Debug:', {
        userAddress,
        stEthContractAddress,
        l1ChainId,
        chainId: l1ChainId,
        balanceData: stEthBalanceData,
        isLoading: isLoadingStEthBalance,
        error: stEthBalanceError,
        value: stEthBalanceData?.value,
        formatted: stEthBalanceData?.formatted,
        symbol: stEthBalanceData?.symbol,
        decimals: stEthBalanceData?.decimals,
        queryEnabled: !!userAddress && !!stEthContractAddress
      });
      
      if (stEthBalanceError) {
        console.error('❌ stETH Balance Error:', stEthBalanceError);
        console.warn('💡 Tip: The stETH contract address on Sepolia might be invalid. Consider using a valid test ERC20 token address.');
      }
    }
  }, [networkEnv, userAddress, stEthContractAddress, l1ChainId, stEthBalanceData, isLoadingStEthBalance, stEthBalanceError]);
  
  // Handle invalid contract gracefully on testnet
  const stEthBalance = useMemo(() => {
    if (networkEnv === 'testnet' && stEthBalanceError) {
      // On testnet with error, return 0 and log a helpful message
      console.warn('🚨 Using fallback balance of 0 for stETH due to contract error on testnet');
      return BigInt(0);
    }
    return stEthBalanceData?.value ?? BigInt(0);
  }, [stEthBalanceData, stEthBalanceError, networkEnv]);

  const { data: morBalanceData, isLoading: isLoadingMorBalance, refetch: refetchMorBalance } = useBalance({ address: userAddress, token: morContractAddress, chainId: l2ChainId, query: { enabled: !!userAddress && !!morContractAddress } });
  const morBalance = morBalanceData?.value ?? BigInt(0);

  const { isLoading: isLoadingAllowance, refetch: refetchAllowance } = useReadContract({
    address: stEthContractAddress,
    abi: ERC20Abi,
    functionName: 'allowance',
    args: [userAddress || zeroAddress, poolContractAddress || zeroAddress],
    chainId: l1ChainId,
    query: { enabled: !!userAddress && !!stEthContractAddress && !!poolContractAddress }
  });
  // allowanceData removed as it was unused

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

  const { data: stETHV2CurrentUserReward, isLoading: isLoadingStETHV2Reward, refetch: refetchStETHV2Reward } = useReadContract({
    address: stETHDepositPoolAddress,
    abi: DepositPoolAbi,
    functionName: 'getLatestUserReward',
    args: [V2_REWARD_POOL_INDEX, userAddress || zeroAddress],
    chainId: l1ChainId,
    query: { enabled: !!stETHDepositPoolAddress && !!userAddress, refetchInterval: 15000 }
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

  const { data: linkV2CurrentUserReward, isLoading: isLoadingLinkV2Reward, refetch: refetchLinkV2Reward } = useReadContract({
    address: linkDepositPoolAddress,
    abi: DepositPoolAbi,
    functionName: 'getLatestUserReward',
    args: [V2_REWARD_POOL_INDEX, userAddress || zeroAddress],
    chainId: l1ChainId,
    query: { enabled: !!linkDepositPoolAddress && !!userAddress, refetchInterval: 15000 }
  });

  // --- V2 Referral Data Reads ---
  const { data: stETHV2ReferralReward, isLoading: isLoadingStETHReferralReward } = useReadContract({
    address: stETHDepositPoolAddress,
    abi: DepositPoolAbi,
    functionName: 'getLatestReferrerReward',
    args: [V2_REWARD_POOL_INDEX, userAddress || zeroAddress] as const,
    chainId: l1ChainId,
    query: { enabled: !!stETHDepositPoolAddress && !!userAddress }
  });

  const { data: linkV2ReferralReward, isLoading: isLoadingLinkReferralReward } = useReadContract({
    address: linkDepositPoolAddress,
    abi: DepositPoolAbi,
    functionName: 'getLatestReferrerReward',
    args: [V2_REWARD_POOL_INDEX, userAddress || zeroAddress] as const,
    chainId: l1ChainId,
    query: { enabled: !!linkDepositPoolAddress && !!userAddress }
  });

  const { data: stETHV2ReferrersData, isLoading: isLoadingStETHReferrersData } = useReadContract({
    address: stETHDepositPoolAddress,
    abi: DepositPoolAbi,
    functionName: 'referrersData',
    args: [userAddress || zeroAddress, V2_REWARD_POOL_INDEX] as const,
    chainId: l1ChainId,
    query: { enabled: !!stETHDepositPoolAddress && !!userAddress }
  });

  const { data: linkV2ReferrersData, isLoading: isLoadingLinkReferrersData } = useReadContract({
    address: linkDepositPoolAddress,
    abi: DepositPoolAbi,
    functionName: 'referrersData',
    args: [userAddress || zeroAddress, V2_REWARD_POOL_INDEX] as const,
    chainId: l1ChainId,
    query: { enabled: !!linkDepositPoolAddress && !!userAddress }
  });

  // --- V2 Token Balances ---
  const { data: linkBalanceData, isLoading: isLoadingLinkBalance, refetch: refetchLinkBalance } = useBalance({ 
    address: userAddress, 
    token: linkTokenAddress, 
    chainId: l1ChainId, 
    query: { enabled: !!userAddress && !!linkTokenAddress } 
  });
  const linkBalance = linkBalanceData?.value ?? BigInt(0);

  // --- V2 Token Allowances ---
  const { data: stETHV2AllowanceData, isLoading: isLoadingStETHV2Allowance, refetch: refetchStETHV2Allowance } = useReadContract({
    address: stEthContractAddress,
    abi: ERC20Abi,
    functionName: 'allowance',
    args: [userAddress || zeroAddress, stETHDepositPoolAddress || zeroAddress],
    chainId: l1ChainId,
    query: { enabled: !!userAddress && !!stEthContractAddress && !!stETHDepositPoolAddress }
  });
  const stETHV2Allowance = stETHV2AllowanceData as bigint | undefined ?? BigInt(0);

  const { data: linkV2AllowanceData, isLoading: isLoadingLinkV2Allowance, refetch: refetchLinkV2Allowance } = useReadContract({
    address: linkTokenAddress,
    abi: ERC20Abi,
    functionName: 'allowance',
    args: [userAddress || zeroAddress, linkDepositPoolAddress || zeroAddress],
    chainId: l1ChainId,
    query: { enabled: !!userAddress && !!linkTokenAddress && !!linkDepositPoolAddress }
  });
  const linkV2Allowance = linkV2AllowanceData as bigint | undefined ?? BigInt(0);

  // --- Write Hooks ---
  const { data: approveHash, writeContractAsync: approveAsync, isPending: isSendingApproval } = useWriteContract();
  const { data: stakeHash, writeContractAsync: stakeAsync, isPending: isSendingStake } = useWriteContract();
  const { data: claimHash, writeContractAsync: claimAsync, isPending: isSendingClaim } = useWriteContract();
  const { data: withdrawHash, writeContractAsync: withdrawAsync, isPending: isSendingWithdraw } = useWriteContract();
  const { data: lockClaimHash, writeContractAsync: lockClaimAsync, isPending: isSendingLockClaim } = useWriteContract();

  // --- Transaction Monitoring ---
  const { isLoading: isConfirmingApproval, isSuccess: isApprovalSuccess, isError: isApprovalError, error: approvalError } = useWaitForTransactionReceipt({ hash: approveHash, chainId: l1ChainId });
  const { isLoading: isConfirmingStake, isSuccess: isStakeSuccess, isError: isStakeError, error: stakeError } = useWaitForTransactionReceipt({ hash: stakeHash, chainId: l1ChainId });
  const { isLoading: isConfirmingClaim, isSuccess: isClaimSuccess, isError: isClaimError, error: claimError } = useWaitForTransactionReceipt({ hash: claimHash, chainId: l1ChainId });
  const { isLoading: isConfirmingWithdraw, isSuccess: isWithdrawSuccess, isError: isWithdrawError, error: withdrawError } = useWaitForTransactionReceipt({ hash: withdrawHash, chainId: l1ChainId });
  const { isLoading: isConfirmingLockClaim, isSuccess: isLockClaimSuccess, isError: isLockClaimError, error: lockClaimError } = useWaitForTransactionReceipt({ hash: lockClaimHash, chainId: l1ChainId });

  // --- Combined Loading States (NOW PROPERLY USED!) ---
  const isLoadingUserData = isLoadingUserDataRaw || isLoadingUserReward || isLoadingUserMultiplier || isLoadingStETHV2User || isLoadingLinkV2User; 
  const isLoadingBalances = isLoadingStEthBalance || isLoadingMorBalance || isLoadingLinkBalance;
  const isLoadingAllowances = isLoadingAllowance || isLoadingStETHV2Allowance || isLoadingLinkV2Allowance;
  const isLoadingRewards = isLoadingStETHV2Reward || isLoadingLinkV2Reward;
  const isLoadingTotalDeposits = isLoadingStETHV2Total || isLoadingLinkV2Total;
  const isLoadingAssetData = isLoadingStETHV2Pool || isLoadingLinkV2Pool;

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

  // Removed unused currentDailyReward calculation

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

  // Asset-aware utility functions
  const needsApproval = useCallback((asset: AssetSymbol, amountString: string): boolean => {
    try {
      const amountBigInt = amountString ? parseUnits(amountString, 18) : BigInt(0);
      if (amountBigInt <= BigInt(0)) return false;
      
      if (asset === 'stETH') {
        return stETHV2Allowance < amountBigInt;
      } else if (asset === 'LINK') {
        return linkV2Allowance < amountBigInt;
      }
      return false;
    } catch {
      return false; 
    }
  }, [stETHV2Allowance, linkV2Allowance]);

  const checkAndUpdateApprovalNeeded = useCallback(async (asset: AssetSymbol, amountString: string): Promise<boolean> => {
    try {
      const amountBigInt = amountString ? parseUnits(amountString, 18) : BigInt(0);
      if (amountBigInt <= BigInt(0)) return false;
      
      // Refetch the current allowance to get the latest value
      let currentAllowanceValue: bigint;
      if (asset === 'stETH') {
        const { data: latestAllowance } = await refetchStETHV2Allowance();
        currentAllowanceValue = latestAllowance as bigint ?? BigInt(0);
      } else if (asset === 'LINK') {
        const { data: latestAllowance } = await refetchLinkV2Allowance();
        currentAllowanceValue = latestAllowance as bigint ?? BigInt(0);
      } else {
        return false;
      }
      
      return currentAllowanceValue < amountBigInt;
    } catch (error) {
      console.error("Error checking approval status:", error);
      return false; 
    }
  }, [refetchStETHV2Allowance, refetchLinkV2Allowance]);

  // --- Formatted Data ---
  const userDepositFormatted = formatBigInt(userData?.deposited, 18, 2);
  const claimableAmountFormatted = formatBigInt(currentUserRewardData, 18, 2);

  // --- Log Raw Multiplier Data ---
  useEffect(() => {
    if (currentUserMultiplierData !== undefined) {
      console.log("Raw currentUserMultiplierData:", currentUserMultiplierData);
    }
  }, [currentUserMultiplierData]);
  // --------------------------------

  // Removed unused formatted timestamp variables - V2 specific ones are used instead

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
      const errorMessage = (error as BaseError)?.shortMessage || (error as Error)?.message;
      toast.error(options.error, {
        description: errorMessage,
        duration: 5000,
        style: {
          background: 'hsl(var(--destructive))',
          color: 'hsl(var(--destructive-foreground))',
          border: '1px solid hsl(var(--destructive))'
        }
      });
      throw error; // Re-throw for modal error handling
    }
  }, []); // Removed setActiveModal dependency
  
  // V2 Asset-aware functions
  const approveToken = useCallback(async (asset: AssetSymbol) => {
    if (asset === 'stETH') {
      if (!stETHDepositPoolAddress || !stEthContractAddress || !l1ChainId) {
        throw new Error("stETH approve prerequisites not met");
      }
      await handleTransaction(() => approveAsync({
          address: stEthContractAddress,
          abi: ERC20Abi,
          functionName: 'approve',
        args: [stETHDepositPoolAddress, maxInt256],
          chainId: l1ChainId,
      }), {
        loading: "Requesting stETH approval...",
        success: "stETH approval successful!", 
        error: "stETH approval failed",
        skipClose: true
      });
    } else if (asset === 'LINK') {
      if (!linkDepositPoolAddress || !linkTokenAddress || !l1ChainId) {
        throw new Error("LINK approve prerequisites not met");
      }
      await handleTransaction(() => approveAsync({
        address: linkTokenAddress,
        abi: ERC20Abi,
        functionName: 'approve',
        args: [linkDepositPoolAddress, maxInt256],
        chainId: l1ChainId,
      }), {
        loading: "Requesting LINK approval...",
        success: "LINK approval successful!", 
        error: "LINK approval failed",
        skipClose: true
      });
    }
  }, [approveAsync, stETHDepositPoolAddress, stEthContractAddress, linkDepositPoolAddress, linkTokenAddress, l1ChainId, handleTransaction]);

  const deposit = useCallback(async (asset: AssetSymbol, amountString: string, lockDurationSeconds?: bigint) => {
      const amountBigInt = parseUnits(amountString, 18);
      if (amountBigInt <= BigInt(0)) throw new Error("Invalid deposit amount");
      
    // Default to 0 seconds lock if not provided
    const lockDuration = lockDurationSeconds || BigInt(0);
    
    if (asset === 'stETH') {
      if (!stETHDepositPoolAddress || !l1ChainId) throw new Error("stETH deposit prerequisites not met");
      console.log('🏦 stETH Deposit Details:', {
        asset,
        depositPoolAddress: stETHDepositPoolAddress,
        amount: amountString,
        amountBigInt: amountBigInt.toString(),
        lockDuration: lockDuration.toString(),
        poolIndex: V2_REWARD_POOL_INDEX.toString(),
        chainId: l1ChainId
      });
      const claimLockEnd = BigInt(Math.floor(Date.now() / 1000)) + lockDuration;
      await handleTransaction(() => stakeAsync({
        address: stETHDepositPoolAddress,
        abi: DepositPoolAbi,
          functionName: 'stake',
        args: [V2_REWARD_POOL_INDEX, amountBigInt, claimLockEnd, zeroAddress],
          chainId: l1ChainId,
      }), {
        loading: "Requesting stETH deposit...",
        success: `Successfully deposited ${amountString} stETH!`, 
        error: "stETH deposit failed"
      });
    } else if (asset === 'LINK') {
      if (!linkDepositPoolAddress || !l1ChainId) throw new Error("LINK deposit prerequisites not met");
      if (!linkTokenAddress) throw new Error("LINK token address not resolved");
      
      // Additional validation for LINK staking
      if (!linkBalance || linkBalance <= BigInt(0)) {
        throw new Error("Insufficient LINK balance");
      }
      if (amountBigInt > linkBalance) {
        throw new Error(`Insufficient LINK balance. Required: ${formatBigInt(amountBigInt, 18, 4)}, Available: ${formatBigInt(linkBalance, 18, 4)}`);
      }
      if (!linkV2Allowance || linkV2Allowance < amountBigInt) {
        throw new Error(`Insufficient LINK allowance. Please approve LINK spending first. Required: ${formatBigInt(amountBigInt, 18, 4)}, Current: ${formatBigInt(linkV2Allowance || BigInt(0), 18, 4)}`);
      }
      console.log('🔗 LINK Deposit Details:', {
        asset,
        depositPoolAddress: linkDepositPoolAddress,
        tokenAddress: linkTokenAddress,
        amount: amountString,
        amountBigInt: amountBigInt.toString(),
        lockDuration: lockDuration.toString(),
        poolIndex: V2_REWARD_POOL_INDEX.toString(),
        chainId: l1ChainId,
        userBalance: formatBigInt(linkBalance, 18, 4),
        userAllowance: linkV2Allowance?.toString(),
        // Comparison with successful transaction from Jul 29, 2025
        successfulTxComparison: {
          poolIndex: { current: V2_REWARD_POOL_INDEX.toString(), successful: "0", match: V2_REWARD_POOL_INDEX.toString() === "0" },
          amount: { current: amountBigInt.toString(), successful: "10000000000000000000" },
          lockDuration: { current: lockDuration.toString(), successful: "86400" },
          claimLockEnd: { current: (BigInt(Math.floor(Date.now() / 1000)) + lockDuration).toString(), note: "Unix timestamp = current_time + lock_duration" },
          referrer: { current: zeroAddress, successful: "0x0000000000000000000000000000000000000000", match: zeroAddress === "0x0000000000000000000000000000000000000000" }
        }
      });
      const claimLockEnd = BigInt(Math.floor(Date.now() / 1000)) + lockDuration;
      await handleTransaction(() => stakeAsync({
        address: linkDepositPoolAddress,
        abi: DepositPoolAbi,
        functionName: 'stake',
        args: [V2_REWARD_POOL_INDEX, amountBigInt, claimLockEnd, zeroAddress],
        chainId: l1ChainId,
      }), {
        loading: "Requesting LINK deposit...",
        success: `Successfully deposited ${amountString} LINK!`, 
        error: "LINK deposit failed"
      });
    }
  }, [stakeAsync, stETHDepositPoolAddress, linkDepositPoolAddress, linkTokenAddress, l1ChainId, handleTransaction, linkBalance, linkV2Allowance]);

  const withdraw = useCallback(async (asset: AssetSymbol, amountString: string) => {
    const amountBigInt = parseUnits(amountString, 18);
    if (amountBigInt <= BigInt(0)) throw new Error("Invalid withdraw amount");
    
    if (asset === 'stETH') {
      if (!stETHDepositPoolAddress || !l1ChainId || !canWithdraw) throw new Error("stETH withdraw prerequisites not met");
      if (userData?.deposited && amountBigInt > userData.deposited) throw new Error("Insufficient stETH deposited balance");
      
      await handleTransaction(() => withdrawAsync({
        address: stETHDepositPoolAddress,
        abi: DepositPoolAbi,
        functionName: 'withdraw',
        args: [V2_REWARD_POOL_INDEX, amountBigInt],
        chainId: l1ChainId,
        gas: BigInt(1200000),
      }), {
        loading: "Requesting stETH withdrawal...",
        success: `Successfully withdrew ${amountString} stETH!`, 
        error: "stETH withdrawal failed"
      });
    } else if (asset === 'LINK') {
      if (!linkDepositPoolAddress || !l1ChainId) throw new Error("LINK withdraw prerequisites not met");
      const linkUserData = parseV2UserData(linkV2UserData);
      if (linkUserData?.deposited && amountBigInt > linkUserData.deposited) throw new Error("Insufficient LINK deposited balance");
      
      await handleTransaction(() => withdrawAsync({
        address: linkDepositPoolAddress,
        abi: DepositPoolAbi,
        functionName: 'withdraw',
        args: [V2_REWARD_POOL_INDEX, amountBigInt],
        chainId: l1ChainId,
        gas: BigInt(1200000),
      }), {
        loading: "Requesting LINK withdrawal...",
        success: `Successfully withdrew ${amountString} LINK!`, 
        error: "LINK withdrawal failed"
      });
    }
  }, [withdrawAsync, stETHDepositPoolAddress, linkDepositPoolAddress, l1ChainId, canWithdraw, userData?.deposited, linkV2UserData, handleTransaction]);

  // Removed unused legacy functions: approveStEth, legacyDeposit

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

  // Removed unused legacyWithdraw function
  
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
        refetchStETHV2Allowance();
        refetchLinkV2Allowance();
        // Don't close modal after approval
    }
  }, [isApprovalSuccess, refetchAllowance, refetchStETHV2Allowance, refetchLinkV2Allowance]);
  
  useEffect(() => {
      if (isStakeSuccess) {
          toast.success(`Stake confirmed!`);
          refetchUserData();
          refetchUserReward();
          refetchStEthBalance(); 
          refetchLinkBalance();
          refetchStETHV2User();
          refetchLinkV2User();
          refetchStETHV2Reward();
          refetchLinkV2Reward();
          setActiveModal(null); // Close modal on success
      }
  }, [isStakeSuccess, refetchUserData, refetchUserReward, refetchStEthBalance, refetchLinkBalance, refetchStETHV2User, refetchLinkV2User, refetchStETHV2Reward, refetchLinkV2Reward, setActiveModal]);
  
  useEffect(() => {
      if (isClaimSuccess) {
          toast.success("Claim confirmed!");
          refetchUserData();
          refetchUserReward();
          refetchMorBalance();
          refetchStETHV2Reward();
          refetchLinkV2Reward();
          setActiveModal(null); // Close modal on success
      }
  }, [isClaimSuccess, refetchUserData, refetchUserReward, refetchMorBalance, refetchStETHV2Reward, refetchLinkV2Reward, setActiveModal]);
  
  useEffect(() => {
      if (isWithdrawSuccess) {
          toast.success("Withdrawal confirmed!");
          refetchUserData();
          refetchUserReward();
          refetchStEthBalance();
          refetchLinkBalance();
          refetchStETHV2User();
          refetchLinkV2User();
          setActiveModal(null); // Close modal on success
      }
  }, [isWithdrawSuccess, refetchUserData, refetchUserReward, refetchStEthBalance, refetchLinkBalance, refetchStETHV2User, refetchLinkV2User, setActiveModal]);

  useEffect(() => {
      if (isLockClaimSuccess) {
          toast.success("Lock period update confirmed!");
          refetchUserData();
          refetchUserMultiplier();
          setActiveModal(null); // Close modal on success
      }
  }, [isLockClaimSuccess, refetchUserData, refetchUserMultiplier, setActiveModal]);

  // --- Transaction Error Effects ---
  useEffect(() => {
      if (isApprovalError && approvalError) {
          console.error("Approval transaction failed:", approvalError);
          const errorMessage = (approvalError as BaseError)?.shortMessage || approvalError.message;
          toast.error("Approval Failed", {
            description: errorMessage,
            duration: 5000,
            style: {
              background: 'hsl(var(--destructive))',
              color: 'hsl(var(--destructive-foreground))',
              border: '1px solid hsl(var(--destructive))'
            }
          });
      }
  }, [isApprovalError, approvalError]);

  useEffect(() => {
      if (isStakeError && stakeError) {
          console.error("Stake transaction failed:", stakeError);
          const errorMessage = (stakeError as BaseError)?.shortMessage || stakeError.message;
          toast.error("Staking Failed", {
            description: errorMessage,
            duration: 5000,
            style: {
              background: 'hsl(var(--destructive))',
              color: 'hsl(var(--destructive-foreground))',
              border: '1px solid hsl(var(--destructive))'
            }
          });
      }
  }, [isStakeError, stakeError]);

  useEffect(() => {
      if (isClaimError && claimError) {
          console.error("Claim transaction failed:", claimError);
          const errorMessage = (claimError as BaseError)?.shortMessage || claimError.message;
          toast.error("Claim Failed", {
            description: errorMessage,
            duration: 5000,
            style: {
              background: 'hsl(var(--destructive))',
              color: 'hsl(var(--destructive-foreground))',
              border: '1px solid hsl(var(--destructive))'
            }
          });
      }
  }, [isClaimError, claimError]);

  useEffect(() => {
      if (isWithdrawError && withdrawError) {
          console.error("Withdraw transaction failed:", withdrawError);
          const errorMessage = (withdrawError as BaseError)?.shortMessage || withdrawError.message;
          toast.error("Withdrawal Failed", {
            description: errorMessage,
            duration: 5000,
            style: {
              background: 'hsl(var(--destructive))',
              color: 'hsl(var(--destructive-foreground))',
              border: '1px solid hsl(var(--destructive))'
            }
          });
      }
  }, [isWithdrawError, withdrawError]);

  useEffect(() => {
      if (isLockClaimError && lockClaimError) {
          console.error("Lock claim transaction failed:", lockClaimError);
          const errorMessage = (lockClaimError as BaseError)?.shortMessage || lockClaimError.message;
          toast.error("Lock Update Failed", {
            description: errorMessage,
            duration: 5000,
            style: {
              background: 'hsl(var(--destructive))',
              color: 'hsl(var(--destructive-foreground))',
              border: '1px solid hsl(var(--destructive))'
            }
          });
      }
  }, [isLockClaimError, lockClaimError]);

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

  // Parse V2 user data
  const stETHV2UserParsed = useMemo(() => parseV2UserData(stETHV2UserData), [stETHV2UserData]);
  const linkV2UserParsed = useMemo(() => parseV2UserData(linkV2UserData), [linkV2UserData]);
  const stETHV2ProtocolParsed = useMemo(() => parseV2ProtocolDetails(stETHV2PoolData), [stETHV2PoolData]);
  const linkV2ProtocolParsed = useMemo(() => parseV2ProtocolDetails(linkV2PoolData), [linkV2PoolData]);

  // V2-specific unlock timestamp calculations (since we're using V2 contracts for rewards)
  const stETHV2ClaimUnlockTimestamp = useMemo(() => {
    if (!stETHV2UserParsed?.claimLockEnd) return undefined;
    return stETHV2UserParsed.claimLockEnd;
  }, [stETHV2UserParsed]);

  const linkV2ClaimUnlockTimestamp = useMemo(() => {
    if (!linkV2UserParsed?.claimLockEnd) return undefined;
    return linkV2UserParsed.claimLockEnd;
  }, [linkV2UserParsed]);

  // V2-specific claim eligibility checks
  const stETHV2CanClaim = useMemo((): boolean => {
    const reward = stETHV2CurrentUserReward as bigint | undefined;
    const hasRewards = reward !== undefined && reward > BigInt(0);
    const unlockTimeReached = !stETHV2ClaimUnlockTimestamp || currentTimestampSeconds >= stETHV2ClaimUnlockTimestamp;
    return hasRewards && unlockTimeReached;
  }, [stETHV2CurrentUserReward, stETHV2ClaimUnlockTimestamp, currentTimestampSeconds]);

  const linkV2CanClaim = useMemo((): boolean => {
    const reward = linkV2CurrentUserReward as bigint | undefined;
    const hasRewards = reward !== undefined && reward > BigInt(0);
    const unlockTimeReached = !linkV2ClaimUnlockTimestamp || currentTimestampSeconds >= linkV2ClaimUnlockTimestamp;
    return hasRewards && unlockTimeReached;
  }, [linkV2CurrentUserReward, linkV2ClaimUnlockTimestamp, currentTimestampSeconds]);

  // Helper to parse referral data from contract result
  const parseReferralData = (referralDataRaw: unknown) => {
    if (!referralDataRaw || !Array.isArray(referralDataRaw)) return null;
    const [amountStaked, virtualAmountStaked, rate, pendingRewards, lastClaim] = referralDataRaw;
    return {
      amountStaked: amountStaked as bigint,
      virtualAmountStaked: virtualAmountStaked as bigint,
      rate: rate as bigint,
      pendingRewards: pendingRewards as bigint,
      lastClaim: lastClaim as bigint,
    };
  };

  // V2 Referral Data Processing
  const stETHReferralRewards = (stETHV2ReferralReward as bigint) || BigInt(0);
  const linkReferralRewards = (linkV2ReferralReward as bigint) || BigInt(0);
  const stETHReferralData = parseReferralData(stETHV2ReferrersData);
  const linkReferralData = parseReferralData(linkV2ReferrersData);

  const referralData = useMemo(() => {
    const isLoadingReferralData = isLoadingStETHReferralReward || isLoadingLinkReferralReward || isLoadingStETHReferrersData || isLoadingLinkReferrersData;
    
    // Total claimable rewards from both pools
    const totalClaimableRewards = stETHReferralRewards + linkReferralRewards;
    
    // Lifetime rewards approximation - sum of amount staked by all referrals
    const stETHLifetimeValue = stETHReferralData?.amountStaked || BigInt(0);
    const linkLifetimeValue = linkReferralData?.amountStaked || BigInt(0);
    const totalLifetimeValue = stETHLifetimeValue + linkLifetimeValue;
    
    return {
      totalReferrals: "N/A", // TODO: Implement event-based tracking for accurate count
      lifetimeRewards: formatBigInt(totalLifetimeValue, 18, 2),
      claimableRewards: formatBigInt(totalClaimableRewards, 18, 4),
      isLoadingReferralData,
      stETHReferralRewards,
      linkReferralRewards,
      stETHReferralData,
      linkReferralData,
    };
  }, [
    isLoadingStETHReferralReward, isLoadingLinkReferralReward, 
    isLoadingStETHReferrersData, isLoadingLinkReferrersData,
    stETHReferralRewards, linkReferralRewards, 
    stETHReferralData, linkReferralData
  ]);

  // V2 Claim and Lock Functions
  const claimAssetRewards = useCallback(async (asset: AssetSymbol) => {
    if (!userAddress || !l1ChainId) throw new Error("Claim prerequisites not met");
    
    const targetAddress = asset === 'stETH' ? stETHDepositPoolAddress : linkDepositPoolAddress;
    const canAssetClaim = asset === 'stETH' ? stETHV2CanClaim : linkV2CanClaim;
    
    if (!targetAddress || !canAssetClaim) {
      throw new Error(`${asset} claim prerequisites not met`);
    }

    // For V2 claims, we need ETH for cross-chain gas fees to L2 (Arbitrum Sepolia)
    // The claim will trigger cross-chain communication via LayerZero
    const ETH_FOR_CROSS_CHAIN_GAS = parseEther("0.01"); // 0.01 ETH for L2 gas

    await handleTransaction(() => claimAsync({
      address: targetAddress,
      abi: DepositPoolAbi,
      functionName: 'claim',
      args: [V2_REWARD_POOL_INDEX, userAddress],
      chainId: l1ChainId,
      value: ETH_FOR_CROSS_CHAIN_GAS, // Send ETH for cross-chain gas
      gas: BigInt(800000), // Higher gas limit for cross-chain operations
    }), {
      loading: `Claiming ${asset} rewards...`,
      success: `Successfully claimed ${asset} rewards! MOR tokens will be minted on Arbitrum Sepolia.`,
      error: `${asset} claim failed`
    });
  }, [claimAsync, stETHDepositPoolAddress, linkDepositPoolAddress, stETHV2CanClaim, linkV2CanClaim, l1ChainId, userAddress, handleTransaction]);

  const lockAssetRewards = useCallback(async (asset: AssetSymbol, lockDurationSeconds: bigint) => {
    if (!userAddress || !l1ChainId) throw new Error("Lock claim prerequisites not met");
    
    const targetAddress = asset === 'stETH' ? stETHDepositPoolAddress : linkDepositPoolAddress;
    
    if (!targetAddress) {
      throw new Error(`${asset} lock claim prerequisites not met`);
    }

    const lockEndTimestamp = BigInt(Math.floor(Date.now() / 1000)) + lockDurationSeconds;

    await handleTransaction(() => lockClaimAsync({
      address: targetAddress,
      abi: DepositPoolAbi,
      functionName: 'lockClaim',
      args: [V2_REWARD_POOL_INDEX, lockEndTimestamp],
      chainId: l1ChainId,
      gas: BigInt(500000),
    }), {
      loading: `Locking ${asset} rewards...`,
      success: `Successfully locked ${asset} rewards for increased multiplier!`,
      error: `${asset} lock failed`
    });
  }, [lockClaimAsync, stETHDepositPoolAddress, linkDepositPoolAddress, l1ChainId, userAddress, handleTransaction]);

  const claimReferralRewards = useCallback(async (asset: AssetSymbol) => {
    if (!userAddress || !l1ChainId) throw new Error("Referral claim prerequisites not met");
    
    const targetAddress = asset === 'stETH' ? stETHDepositPoolAddress : linkDepositPoolAddress;
    const hasRewards = asset === 'stETH' ? stETHReferralRewards > BigInt(0) : linkReferralRewards > BigInt(0);
    
    if (!targetAddress || !hasRewards) {
      throw new Error(`${asset} referral claim prerequisites not met`);
    }

    await handleTransaction(() => claimAsync({
      address: targetAddress,
      abi: DepositPoolAbi,
      functionName: 'claimReferrerTier',
      args: [V2_REWARD_POOL_INDEX, userAddress],
      chainId: l1ChainId,
      gas: BigInt(600000),
    }), {
      loading: `Claiming ${asset} referral rewards...`,
      success: `Successfully claimed ${asset} referral rewards!`,
      error: `${asset} referral claim failed`
    });
  }, [claimAsync, stETHDepositPoolAddress, linkDepositPoolAddress, stETHReferralRewards, linkReferralRewards, l1ChainId, userAddress, handleTransaction]);

  // --- Context Value ---
  const contextValue = useMemo(() => ({
    // Static Info
    l1ChainId,
    l2ChainId,
    userAddress,
    networkEnv,
    
    // V2 Contract Addresses
    distributorV2Address,
    rewardPoolV2Address,
    l1SenderV2Address,

    // Asset Configuration & Data
    assets: {
      stETH: {
        symbol: 'stETH' as AssetSymbol,
        config: {
          symbol: 'stETH' as AssetSymbol,
          depositPoolAddress: stETHDepositPoolAddress || zeroAddress,
          tokenAddress: stEthContractAddress || zeroAddress,
          decimals: 18,
          icon: 'eth',
        },
        userBalance: stEthBalance,
        userDeposited: stETHV2UserParsed?.deposited || BigInt(0),
        userAllowance: stETHV2Allowance,
        claimableAmount: stETHV2CurrentUserReward as bigint || BigInt(0),
        userMultiplier: BigInt(1), // TODO: Add V2 multiplier calculation
        totalDeposited: stETHV2TotalDeposited as bigint || BigInt(0),
        protocolDetails: stETHV2ProtocolParsed || null,
        poolData: null,
        userBalanceFormatted: formatBigInt(stEthBalance, 18, 4),
        userDepositedFormatted: formatBigInt(stETHV2UserParsed?.deposited, 18, 2),
        claimableAmountFormatted: formatBigInt(stETHV2CurrentUserReward as bigint, 18, 2),
        userMultiplierFormatted: "1.0x", // TODO: Add V2 multiplier formatting
        totalDepositedFormatted: formatBigInt(stETHV2TotalDeposited as bigint, 18, 2),
        minimalStakeFormatted: stETHV2ProtocolParsed ? formatBigInt(BigInt(100), 18, 0) : "---", // TODO: Get from protocol details
      },
      LINK: {
        symbol: 'LINK' as AssetSymbol,
        config: {
          symbol: 'LINK' as AssetSymbol,
          depositPoolAddress: linkDepositPoolAddress || zeroAddress,
          tokenAddress: linkTokenAddress || zeroAddress,
          decimals: 18,
          icon: 'link',
        },
        userBalance: linkBalance,
        userDeposited: linkV2UserParsed?.deposited || BigInt(0),
        userAllowance: linkV2Allowance,
        claimableAmount: linkV2CurrentUserReward as bigint || BigInt(0),
        userMultiplier: BigInt(1), // TODO: Add V2 multiplier calculation
        totalDeposited: linkV2TotalDeposited as bigint || BigInt(0),
        protocolDetails: linkV2ProtocolParsed || null,
        poolData: null,
        userBalanceFormatted: formatBigInt(linkBalance, 18, 4),
        userDepositedFormatted: formatBigInt(linkV2UserParsed?.deposited, 18, 2),
        claimableAmountFormatted: formatBigInt(linkV2CurrentUserReward as bigint, 18, 2),
        userMultiplierFormatted: "1.0x", // TODO: Add V2 multiplier formatting
        totalDepositedFormatted: formatBigInt(linkV2TotalDeposited as bigint, 18, 2),
        minimalStakeFormatted: linkV2ProtocolParsed ? formatBigInt(BigInt(100), 18, 0) : "---", // TODO: Get from protocol details
      },
    },
    selectedAsset,
    setSelectedAsset: (asset: AssetSymbol) => {
      setSelectedAsset(asset);
      // Don't close modal when changing assets - let the component handle it
    },

    // Aggregated Data (across all assets)
    totalDepositedUSD: (stETHV2TotalDeposited as bigint || BigInt(0)) + (linkV2TotalDeposited as bigint || BigInt(0)),
    totalClaimableAmount: (stETHV2CurrentUserReward as bigint || BigInt(0)) + (linkV2CurrentUserReward as bigint || BigInt(0)),
    morBalance: morBalance,

    // Formatted Data (aggregated)
    totalDepositedUSDFormatted: formatBigInt((stETHV2TotalDeposited as bigint || BigInt(0)) + (linkV2TotalDeposited as bigint || BigInt(0)), 18, 2),
    totalClaimableAmountFormatted: formatBigInt((stETHV2CurrentUserReward as bigint || BigInt(0)) + (linkV2CurrentUserReward as bigint || BigInt(0)), 18, 2),
    morBalanceFormatted: formatBigInt(morBalance, 18, 4),

    // Asset-specific formatted data (for selected asset)
    selectedAssetUserBalanceFormatted: selectedAsset === 'stETH' ? formatBigInt(stEthBalance, 18, 4) : formatBigInt(linkBalance, 18, 4),
    selectedAssetDepositedFormatted: selectedAsset === 'stETH' ? formatBigInt(stETHV2UserParsed?.deposited, 18, 2) : formatBigInt(linkV2UserParsed?.deposited, 18, 2),
    selectedAssetClaimableFormatted: selectedAsset === 'stETH' ? formatBigInt(stETHV2CurrentUserReward as bigint, 18, 2) : formatBigInt(linkV2CurrentUserReward as bigint, 18, 2),
    selectedAssetMultiplierFormatted: "1.0x", // TODO: Asset-specific multiplier
    selectedAssetTotalStakedFormatted: selectedAsset === 'stETH' ? formatBigInt(stETHV2TotalDeposited as bigint, 18, 2) : formatBigInt(linkV2TotalDeposited as bigint, 18, 2),
    selectedAssetMinimalStakeFormatted: "100", // TODO: Asset-specific minimal stake
    
    // Calculated Data (for selected asset) - TODO: Make asset-aware
    withdrawUnlockTimestamp: withdrawUnlockTimestamp,
    claimUnlockTimestamp: claimUnlockTimestamp,
    withdrawUnlockTimestampFormatted: formatTimestamp(withdrawUnlockTimestamp),
    claimUnlockTimestampFormatted: formatTimestamp(claimUnlockTimestamp),

    // Eligibility Flags (for selected asset) - TODO: Make asset-aware
    canWithdraw: canWithdraw,
    canClaim: canClaim,

    // V2-specific claim data for individual assets
    stETHV2CanClaim: stETHV2CanClaim,
    linkV2CanClaim: linkV2CanClaim,
    stETHV2ClaimUnlockTimestamp: stETHV2ClaimUnlockTimestamp,
    linkV2ClaimUnlockTimestamp: linkV2ClaimUnlockTimestamp,
    stETHV2ClaimUnlockTimestampFormatted: formatTimestamp(stETHV2ClaimUnlockTimestamp),
    linkV2ClaimUnlockTimestampFormatted: formatTimestamp(linkV2ClaimUnlockTimestamp),

    // V2 Referral Data
    referralData,

    // Loading States - NOW PROPERLY USED! 🎉
    isLoadingAssetData,
    isLoadingUserData,
    isLoadingBalances,
    isLoadingAllowances,
    isLoadingRewards,
    isLoadingTotalDeposits,

    // Action States
    isProcessingDeposit: isProcessingDeposit,
    isProcessingClaim: isProcessingClaim,
    isProcessingWithdraw: isProcessingWithdraw,
    isProcessingChangeLock: isProcessingChangeLock,
    isApprovalSuccess: isApprovalSuccess,

    // V2 Action Functions (asset-aware)
    deposit,
    claim, // Claims from all pools
    withdraw,
    changeLock,
    approveToken,
    claimAssetRewards,
    lockAssetRewards,
    claimReferralRewards,
    
    // Utility Functions
    needsApproval,
    checkAndUpdateApprovalNeeded,

    // Modal State
    activeModal,
    setActiveModal,

    // Multiplier simulation for selected asset
    multiplierSimArgs,
    triggerMultiplierEstimation,
    estimatedMultiplierValue,
    isSimulatingMultiplier,

    // Dynamic Contract Loading
    dynamicContracts,

    // Legacy Properties (for backward compatibility)
    userDepositFormatted,
    claimableAmountFormatted,
    userData,
    currentUserMultiplierData,
    poolInfo,
  }), [
    // Dependencies for all values provided
    l1ChainId, l2ChainId, userAddress, networkEnv,
    stEthContractAddress, morContractAddress, distributorV2Address, rewardPoolV2Address, l1SenderV2Address,
    stETHDepositPoolAddress, linkDepositPoolAddress, linkTokenAddress,
    userData, totalDepositedData, currentUserRewardData, currentUserMultiplierData,
    stEthBalance, morBalance, linkBalance, stETHV2Allowance, linkV2Allowance,
    stETHV2UserParsed, linkV2UserParsed, stETHV2ProtocolParsed, linkV2ProtocolParsed,
    stETHV2TotalDeposited, linkV2TotalDeposited, stETHV2CurrentUserReward, linkV2CurrentUserReward,
    selectedAsset, poolInfo, poolLimits,
    withdrawUnlockTimestamp, claimUnlockTimestamp,
    canWithdraw, canClaim,
    isLoadingUserData, isLoadingBalances, isLoadingStETHV2User, isLoadingLinkV2User, 
    isLoadingStETHV2Pool, isLoadingLinkV2Pool, isLoadingAssetData, isLoadingAllowances, 
    isLoadingRewards, isLoadingTotalDeposits,
    isProcessingDeposit, isProcessingClaim, isProcessingWithdraw, isProcessingChangeLock, isApprovalSuccess,
    deposit, claim, withdraw, changeLock, approveToken, needsApproval, checkAndUpdateApprovalNeeded,
    claimAssetRewards, lockAssetRewards, claimReferralRewards, referralData,
    triggerMultiplierEstimation, estimatedMultiplierValue, isSimulatingMultiplier,
    activeModal, setActiveModal,
    multiplierSimArgs, dynamicContracts,
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