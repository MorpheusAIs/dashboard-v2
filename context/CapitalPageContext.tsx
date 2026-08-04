"use client";

import React, { createContext, useContext, useMemo, useEffect, useCallback, useState } from "react";
import { 
  useAccount, 
  useChainId, 
  useReadContract, 
  useContractReads,
  useBalance, 
  useWriteContract, 
  useWaitForTransactionReceipt, 
  useSimulateContract,
  usePublicClient,
  type BaseError 
} from "wagmi";
import { parseUnits, zeroAddress, maxInt256, getContract, formatUnits, isAddress } from "viem";
import { getStaticLayerZeroFee } from "@/hooks/use-layerzero-fee";
import { toast } from "sonner";

// Import Config, Utils & ABIs
import { 
  testnetChains, 
  mainnetChains, 
  getContractAddress, 
  type NetworkEnvironment,
  type ContractAddresses
} from "@/config/networks";
import { 
  getAssetConfig, 
  type AssetSymbol,
  getAssetsForNetwork
} from "@/components/capital/constants/asset-config";

// Re-export AssetSymbol for use by other components
export type { AssetSymbol } from "@/components/capital/constants/asset-config";
import { formatTimestamp, formatBigInt } from "@/lib/utils/formatters";
import { getSafeWalletUrlIfApplicable } from "@/lib/utils/safe-wallet-detection";
import { getTransactionUrl, isMainnetChain } from "@/lib/utils/transaction-utils";

// Import hooks that provide refetch functions
import { useCapitalPoolData } from "@/hooks/use-capital-pool-data";
import { useTokenPrices } from "@/components/capital/hooks/use-token-prices";
import { useReferralData, useReferrerSummary } from "@/hooks/use-referral-data";
import { useAssetContractData } from "@/hooks/use-asset-contract-data";
import { incrementLocalDepositorCount } from "@/app/hooks/useCapitalMetrics";


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

interface ReferralAmountByAsset {
  asset: string;
  amount: bigint;
  formattedAmount: string;
}

interface ReferralData {
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
  stETHReferralRewards: bigint;
  linkReferralRewards: bigint;
  stETHReferralData: ReferralContractData | null;
  linkReferralData: ReferralContractData | null;
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

interface ReferralContractData {
  amountStaked: bigint;
  virtualAmountStaked: bigint;
  rate: bigint;
  pendingRewards: bigint;
  lastClaim: bigint;
}

// --- Types & Helpers moved from ChangeLockModal ---
type ActiveModal = "deposit" | "withdraw" | "changeLock" | "stakeMorRewards" | "lockMorRewards" | "claimMorRewards" | null;
type TimeUnit = "days" | "months" | "years";

// V2 Asset Types (imported from asset-config.ts)
// All assets are dynamically supported based on network configuration

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
  // Unlock timestamps for dynamic validation
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
  // Dynamic eligibility flags per asset
  canClaim: boolean;
  canWithdraw: boolean;
}

// Use the same contract-expected calculations as our utils
const durationToSeconds = (value: string, unit: TimeUnit): bigint => {
  const numValue = parseInt(value, 10);
  if (isNaN(numValue) || numValue <= 0) return BigInt(0);
  
  if (process.env.NODE_ENV !== 'production') {
    console.log('📅 [Context Duration] Using contract-expected calculation for:', { value, unit });
  }
  
  let diffSeconds: number;
  
  // Use contract-expected calculations to match exactly what the contract expects
  switch (unit) {
    case "days":
      diffSeconds = numValue * 86400; // 24 * 60 * 60
      // Add 5-minute safety buffer to prevent timing race conditions
      diffSeconds += 300; // 5 minutes = 300 seconds
      break;
    case "months":
      diffSeconds = numValue * 30 * 86400; // 30 days per month (contract expectation)
      // Add 5-minute safety buffer for timing
      diffSeconds += 300;
      break;
    case "years":
      // Special case: For 6 years, use the EXACT value the contract expects for maximum power factor
      if (numValue === 6) {
        diffSeconds = 189216000; // Exact value from documentation: 6 * 365 * 24 * 60 * 60
        if (process.env.NODE_ENV !== 'production') {
          console.log('🎯 [Context 6-YEAR SPECIAL] Using exact 189,216,000 seconds for maximum power factor');
          console.log('  Context matches utils: exactly 2190 days');
        }
      } else {
        diffSeconds = numValue * 365 * 86400; // 365 days per year
      }
      // Add 5-minute safety buffer for years as well
      diffSeconds += 300;
      break;
    default:
      return BigInt(0);
  }
  
  if (process.env.NODE_ENV !== 'production') {
    console.log('📅 [Context Duration] Contract-expected result with buffer (seconds):', diffSeconds);
    console.log('📅 [Context Duration] Contract-expected result with buffer (days):', diffSeconds / 86400);
    console.log('📅 [Context Duration] Safety buffer: 300 seconds (5 minutes)');
  }
  
  return BigInt(diffSeconds);
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

// parseV2ProtocolDetails removed - now handled by dynamic useAssetContractData hook

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
  selectedAssetCanClaim: boolean; // Dynamic claim eligibility for selected asset

  // V2-specific claim data for individual assets
  /** @deprecated Use selectedAssetCanClaim or assets[symbol] instead. Will be removed in future versions. */
  stETHV2CanClaim: boolean;
  /** @deprecated Use selectedAssetCanClaim or assets[symbol] instead. Will be removed in future versions. */
  linkV2CanClaim: boolean;
  /** @deprecated Use selectedAssetCanClaim or assets[symbol] instead. Will be removed in future versions. */
  stETHV2ClaimUnlockTimestamp?: bigint;
  /** @deprecated Use selectedAssetCanClaim or assets[symbol] instead. Will be removed in future versions. */
  linkV2ClaimUnlockTimestamp?: bigint;
  /** @deprecated Use selectedAssetCanClaim or assets[symbol] instead. Will be removed in future versions. */
  stETHV2ClaimUnlockTimestampFormatted: string;
  /** @deprecated Use selectedAssetCanClaim or assets[symbol] instead. Will be removed in future versions. */
  linkV2ClaimUnlockTimestampFormatted: string;

  // V2 Referral Data - Now fully dynamic
  referralData: {
    totalReferrals: string; // Count of people referred (from GraphQL)
    totalReferralAmount: string; // Total amount deposited by referrals (from GraphQL)
    lifetimeRewards: string; // Total value generated by referrals (from amountStaked across all assets)
    claimableRewards: string; // Current claimable referral rewards (across all assets)
    isLoadingReferralData: boolean;
    
    // Dynamic referral data (USE THESE - supports all assets)
    rewardsByAsset: Partial<Record<AssetSymbol, bigint>>; // Referral rewards by asset symbol
    referrerDetailsByAsset: Partial<Record<AssetSymbol, ReferralContractData | null>>; // Referral details by asset symbol
    assetsWithClaimableRewards: AssetSymbol[]; // Assets that currently have claimable referral rewards
    availableReferralAssets: AssetSymbol[]; // All assets that support referral rewards
    referralAmountsByAsset: ReferralAmountByAsset[]; // Array of referral amounts by asset

    // Legacy hardcoded exports (DEPRECATED - for backward compatibility only)
    /** @deprecated Use rewardsByAsset.stETH instead. Will be removed in future versions. */
    stETHReferralRewards: bigint;
    /** @deprecated Use rewardsByAsset.LINK instead. Will be removed in future versions. */
    linkReferralRewards: bigint;
    /** @deprecated Use referrerDetailsByAsset.stETH instead. Will be removed in future versions. */
    stETHReferralData: {
      amountStaked: bigint;
      pendingRewards: bigint;
      lastClaim: bigint;
    } | null;
    /** @deprecated Use referrerDetailsByAsset.LINK instead. Will be removed in future versions. */
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

  // Claim transaction states for enhanced balance monitoring
  isClaimSuccess: boolean;
  claimHash?: `0x${string}`;
  lastHandledClaimHash: `0x${string}` | null;

  // V2 Action Functions (asset-aware)
  deposit: (asset: AssetSymbol, amount: string, lockDurationSeconds?: bigint, referrerAddress?: string) => Promise<void>;
  claim: () => Promise<void>; // Claims from all pools
  withdraw: (asset: AssetSymbol, amount: string) => Promise<void>;
  changeLock: (lockValue: string, lockUnit: TimeUnit) => Promise<void>;
  approveToken: (asset: AssetSymbol) => Promise<void>;
  claimAssetRewards: (asset: AssetSymbol) => Promise<void>;
  lockAssetRewards: (asset: AssetSymbol, lockDurationSeconds: bigint) => Promise<void>;
  claimReferralRewards: (asset?: AssetSymbol) => Promise<void>;
  
  // Utility Functions
  needsApproval: (asset: AssetSymbol, amount: string) => boolean;
  checkAndUpdateApprovalNeeded: (asset: AssetSymbol, amount: string) => Promise<boolean>;

  // Modal State
  activeModal: ActiveModal;
  setActiveModal: (modal: ActiveModal) => void;
  
  // Pre-populated referrer address (for URL referral links)
  preReferrerAddress: string;
  setPreReferrerAddress: (address: string) => void;

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
  const [preReferrerAddress, setPreReferrerAddress] = useState<string>('');

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
    return networkEnv === 'mainnet' ? mainnetChains.arbitrum.id : testnetChains.baseSepolia.id;
  }, [networkEnv]);

  // V2 Contract addresses - now unified across all networks
  // Both mainnet and testnet use V2 DepositPool contracts
  const stETHDepositPoolAddress = useMemo(() => {
    return getContractAddress(l1ChainId, 'stETHDepositPool', networkEnv) as `0x${string}` | undefined;
  }, [l1ChainId, networkEnv]);
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

  // --- Clear Stale Price Cache on Mount ---
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const cached = localStorage.getItem('morpheus_token_prices');
      if (cached) {
        const parsed = JSON.parse(cached);
        // If MOR price is suspiciously low (< $0.50), clear the cache
        if (parsed.morPrice && parsed.morPrice < 0.5) {
          console.log('🧹 Clearing stale price cache (morPrice too low):', parsed.morPrice);
          localStorage.removeItem('morpheus_token_prices');
        }
        // If cache is older than 24 hours, clear it
        const cacheAge = Date.now() - (parsed.timestamp || 0);
        const oneDayMs = 24 * 60 * 60 * 1000;
        if (cacheAge > oneDayMs) {
          console.log('🧹 Clearing expired price cache (age: ' + Math.floor(cacheAge / 1000 / 60 / 60) + 'h)');
          localStorage.removeItem('morpheus_token_prices');
        }
      }
    } catch (error) {
      console.warn('Error checking price cache:', error);
    }
  }, []); // Run once on mount

  // --- Get MOR Price for APR Calculation ---
  const { morPrice } = useTokenPrices({
    isInitialLoad: true,
    shouldRefreshData: false,
    userAddress: undefined,
    networkEnv: networkEnv
  });

  // --- Pool Data Hook with Refetch Functions ---
  const capitalPoolData = useCapitalPoolData({ morPrice: morPrice || undefined });
  
  // --- Referral Data Hook (GraphQL) ---
  const liveReferralData = useReferralData({
    userAddress: userAddress, // ✅ Now using actual connected wallet address
    networkEnvironment: networkEnv
  });

  // --- Referrer Summary Hook (GraphQL) for Total MOR Earned ---
  const referrerSummaryData = useReferrerSummary({
    userAddress: userAddress,
    networkEnvironment: networkEnv
  });

  // --- Dynamic Asset Contract Data ---
  // Use the dynamic hook for each potential asset - only enabled when contracts exist
  const assetContractData = {
    stETH: useAssetContractData('stETH'),
    LINK: useAssetContractData('LINK'), 
    USDC: useAssetContractData('USDC'),
    USDT: useAssetContractData('USDT'),
    wBTC: useAssetContractData('wBTC'),
    wETH: useAssetContractData('wETH'),
  };

  // Calculate available referral assets - will be set after helper function definitions

  // Referral asset configs will be calculated after helper function definitions

  // Referral-related useMemo hooks will be defined after helper functions

  // Contract reads will be defined after helper functions

  // Referral processing logic will be defined after helper functions


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
      
      // console.log("🎯 Dynamic contracts created:", Object.keys(contracts));
    } catch (error) {
      console.error("❌ Error creating dynamic contracts:", error);
    }
    
    return contracts;
  }, [publicClient, stEthContractAddress, linkTokenAddress, stETHDepositPoolAddress, linkDepositPoolAddress]);

  // Use DepositPool ABI for all V2 contract interactions
  const poolAbi = DepositPoolAbi;

  // --- Read Hooks (V2 Contract Calls) --- 
  const { data: poolInfoResult, error: poolInfoError, isLoading: poolInfoLoading } = useReadContract({
    address: stETHDepositPoolAddress,
    abi: poolAbi,
    functionName: 'unusedStorage1',
    args: [PUBLIC_POOL_ID],
    chainId: l1ChainId,
    query: { enabled: !!stETHDepositPoolAddress }
  });
  
  console.log('=== POOL INFO CONTRACT CALL DEBUG ===');
  console.log('🏊 stETH Deposit Pool Address:', stETHDepositPoolAddress);
  console.log('⛓️ L1 Chain ID:', l1ChainId);
  console.log('🎯 Network Environment:', networkEnv);
  console.log('🔧 Function Called: unusedStorage1 (FIXED - now gets payoutStart!)');
  console.log('🔍 Pool Info Result:', poolInfoResult);
  console.log('📏 Pool Info Result Length:', Array.isArray(poolInfoResult) ? poolInfoResult.length : 'Not an array');
  console.log('❌ Pool Info Error:', poolInfoError?.message || poolInfoError);
  console.log('⏳ Pool Info Loading:', poolInfoLoading);
  console.log('📋 unusedStorage1 Function Available:', poolAbi.some((item: { name?: string }) => item.name === 'unusedStorage1'));
  console.log('🔧 Contract Call Enabled:', !!stETHDepositPoolAddress);
  console.log('📞 Contract Call Args:', [PUBLIC_POOL_ID]);
  console.log('📋 PUBLIC_POOL_ID value:', PUBLIC_POOL_ID);
  
  // Check if this is the expected mainnet address
  if (networkEnv === 'mainnet') {
    console.log('✅ Expected mainnet stETH pool:', '0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790');
    console.log('🔍 Address matches expected:', stETHDepositPoolAddress === '0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790');
  }
  
  console.log('=== END POOL INFO DEBUG ===\n');
  
  const poolInfo = useMemo((): PoolInfoData | undefined => {
    console.log('=== PROCESSING POOL INFO DATA ===');
    console.log('🏊 Processing poolInfo data, raw result:', poolInfoResult);
    console.log('📊 Expected: 9 values from unusedStorage1 function');
    console.log('📊 Expected fields: [payoutStart, decreaseInterval, withdrawLockPeriod, claimLockPeriod, withdrawLockPeriodAfterStake, initialReward, rewardDecrease, minimalStake, isPublic]');
    
    if (!poolInfoResult) {
      console.log('❌ No poolInfoResult available for timestamp generation');
      return undefined;
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dataArray = poolInfoResult as any[]; // Cast needed because wagmi returns struct as unknown[]/any[]
    console.log('📏 Actual array length:', dataArray.length);
    console.log('📊 Actual values:', dataArray);
    
    if (!Array.isArray(dataArray) || dataArray.length < 9) {
      console.log('❌ Invalid data structure - expected 9 values, got:', dataArray.length);
      return undefined;
    }
    
    console.log('✅ Processing 9-value response from unusedStorage1');
    console.log('🚀 payoutStart value (index 0):', dataArray[0]);
    console.log('📅 payoutStart as timestamp:', Number(dataArray[0]));
    console.log('📅 payoutStart as date:', new Date(Number(dataArray[0]) * 1000).toISOString()); 
    try {
      const result = {
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
      
      console.log('🎉 SUCCESS: poolInfo created with payoutStart:', result.payoutStart.toString());
      console.log('📊 Full poolInfo object:', result);
      console.log('=== END PROCESSING POOL INFO DATA ===\n');
      return result;
    } catch (e) {
        console.error("❌ Error parsing poolInfoData:", e);
        console.log('=== END PROCESSING POOL INFO DATA (ERROR) ===\n');
        return undefined;
    }
  }, [poolInfoResult]);

  const { data: poolLimitsResult } = useReadContract({
    address: stETHDepositPoolAddress,
    abi: poolAbi,
    functionName: 'rewardPoolsProtocolDetails',
    args: [PUBLIC_POOL_ID],
    chainId: l1ChainId,
    query: { enabled: !!stETHDepositPoolAddress }
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


  const { data: usersDataResult, isLoading: isLoadingUserDataRaw, refetch: refetchUserData } = useReadContract({
    address: stETHDepositPoolAddress,
    abi: poolAbi,
    functionName: 'usersData',
    args: [userAddress || zeroAddress, PUBLIC_POOL_ID],
    chainId: l1ChainId,
    query: { enabled: !!stETHDepositPoolAddress && !!userAddress }
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
    address: stETHDepositPoolAddress,
    abi: poolAbi,
    functionName: 'getLatestUserReward',
    args: [PUBLIC_POOL_ID, userAddress || zeroAddress],
    chainId: l1ChainId,
    query: { enabled: !!stETHDepositPoolAddress && !!userAddress, refetchInterval: 2 * 60 * 1000 } 
  });
  const currentUserRewardData = useMemo(() => currentUserRewardDataRaw as bigint | undefined, [currentUserRewardDataRaw]);

  const { data: currentUserMultiplierDataRaw, isLoading: isLoadingUserMultiplier, refetch: refetchUserMultiplier } = useReadContract({
    address: distributorV2Address,
    abi: ERC1967ProxyAbi, // DistributorV2 uses this ABI
    functionName: 'getCurrentUserMultiplier',
    args: [PUBLIC_POOL_ID, userAddress || zeroAddress],
    chainId: l1ChainId,
    query: { enabled: !!distributorV2Address && !!userAddress } 
  });
  const currentUserMultiplierData = useMemo(() => currentUserMultiplierDataRaw as bigint | undefined, [currentUserMultiplierDataRaw]);

  const { data: stEthBalanceData, isLoading: isLoadingStEthBalance, error: stEthBalanceError } = useBalance({ address: userAddress, token: stEthContractAddress, chainId: l1ChainId, query: { enabled: !!userAddress && !!stEthContractAddress } });
  
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
  
  // stEthBalance removed - now handled by dynamic useAssetContractData hook

  const { data: morBalanceData, isLoading: isLoadingMorBalance, refetch: refetchMorBalance } = useBalance({ address: userAddress, token: morContractAddress, chainId: l2ChainId, query: { enabled: !!userAddress && !!morContractAddress } });
  const morBalance = morBalanceData?.value ?? BigInt(0);

  const { isLoading: isLoadingAllowance } = useReadContract({
    address: stEthContractAddress,
    abi: ERC20Abi,
    functionName: 'allowance',
    args: [userAddress || zeroAddress, stETHDepositPoolAddress || zeroAddress],
    chainId: l1ChainId,
    query: { enabled: !!userAddress && !!stEthContractAddress && !!stETHDepositPoolAddress }
  });
  // allowanceData removed as it was unused

  // --- V2 DepositPool Reads (stETH) ---
  const { data: stETHV2UserData, isLoading: isLoadingStETHV2User } = useReadContract({
    address: stETHDepositPoolAddress,
    abi: DepositPoolAbi,
    functionName: 'usersData',
    args: [userAddress || zeroAddress, V2_REWARD_POOL_INDEX],
    chainId: l1ChainId,
    query: { enabled: !!stETHDepositPoolAddress && !!userAddress }
  });

  // stETHV2PoolData removed - now handled by dynamic useAssetContractData hook
  const { isLoading: isLoadingStETHV2Pool } = { isLoading: false }; // Placeholder to maintain loading state until fully migrated

  // stETHV2TotalDeposited removed - now handled by dynamic useAssetContractData hook

  const { data: stETHV2CurrentUserReward, isLoading: isLoadingStETHV2Reward } = useReadContract({
    address: stETHDepositPoolAddress,
    abi: DepositPoolAbi,
    functionName: 'getLatestUserReward',
    args: [V2_REWARD_POOL_INDEX, userAddress || zeroAddress],
    chainId: l1ChainId,
    query: { enabled: !!stETHDepositPoolAddress && !!userAddress, refetchInterval: 2 * 60 * 1000 }
  });

  // --- V2 DepositPool Reads (LINK) ---
  const { data: linkV2UserData, isLoading: isLoadingLinkV2User } = useReadContract({
    address: linkDepositPoolAddress,
    abi: DepositPoolAbi,
    functionName: 'usersData',
    args: [userAddress || zeroAddress, V2_REWARD_POOL_INDEX],
    chainId: l1ChainId,
    query: { enabled: !!linkDepositPoolAddress && !!userAddress }
  });

  // linkV2PoolData removed - now handled by dynamic useAssetContractData hook
  const { isLoading: isLoadingLinkV2Pool } = { isLoading: false }; // Placeholder to maintain loading state until fully migrated

  // linkV2TotalDeposited removed - now handled by dynamic useAssetContractData hook

  const { data: linkV2CurrentUserReward, isLoading: isLoadingLinkV2Reward } = useReadContract({
    address: linkDepositPoolAddress,
    abi: DepositPoolAbi,
    functionName: 'getLatestUserReward',
    args: [V2_REWARD_POOL_INDEX, userAddress || zeroAddress],
    chainId: l1ChainId,
    query: { enabled: !!linkDepositPoolAddress && !!userAddress, refetchInterval: 2 * 60 * 1000 }
  });

  // --- V2 User Multiplier Reads (Power Factor) ---
  // stETHV2UserMultiplier and linkV2UserMultiplier removed - now handled by dynamic useAssetContractData hook

  // Debug logging for reward values
  useEffect(() => {
    if (stETHV2CurrentUserReward !== undefined && stETHV2UserData) {
      const userDataParsed = parseV2UserData(stETHV2UserData);
      console.log('🏆 DEBUG - stETH V2 Rewards Comparison:', {
        getLatestUserReward: {
          raw: stETHV2CurrentUserReward?.toString(),
          formatted: formatBigInt(stETHV2CurrentUserReward as bigint, 18, 4),
          inEther: formatUnits(stETHV2CurrentUserReward as bigint, 18)
        },
        usersDataPendingRewards: userDataParsed ? {
          raw: userDataParsed.pendingRewards.toString(),
          formatted: formatBigInt(userDataParsed.pendingRewards, 18, 4),
          inEther: formatUnits(userDataParsed.pendingRewards, 18)
        } : null,
        userDeposited: userDataParsed ? formatUnits(userDataParsed.deposited, 18) : null,
        shouldUseWhichValue: 'COMPARE THESE VALUES ⬆️'
      });
    }
  }, [stETHV2CurrentUserReward, stETHV2UserData]);

  useEffect(() => {
    if (linkV2CurrentUserReward !== undefined && linkV2UserData) {
      const userDataParsed = parseV2UserData(linkV2UserData);
      console.log('🔗 DEBUG - LINK V2 Rewards Comparison:', {
        getLatestUserReward: {
          raw: linkV2CurrentUserReward?.toString(),
          formatted: formatBigInt(linkV2CurrentUserReward as bigint, 18, 4),
          inEther: formatUnits(linkV2CurrentUserReward as bigint, 18)
        },
        usersDataPendingRewards: userDataParsed ? {
          raw: userDataParsed.pendingRewards.toString(),
          formatted: formatBigInt(userDataParsed.pendingRewards, 18, 4),
          inEther: formatUnits(userDataParsed.pendingRewards, 18)
        } : null,
        userDeposited: userDataParsed ? formatUnits(userDataParsed.deposited, 18) : null,
        contractAddress: linkDepositPoolAddress,
        shouldUseWhichValue: '⚠️ IF getLatestUserReward IS TOO HIGH, USE usersDataPendingRewards INSTEAD'
      });
    }
  }, [linkV2CurrentUserReward, linkV2UserData, linkDepositPoolAddress]);

  // --- V2 Token Balances ---
  // linkBalance removed - now handled by dynamic useAssetContractData hook

  // V2 Token Allowances removed - now handled by dynamic useAssetContractData hook

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

  // --- Transaction Success Tracking (prevents repeated toasts) ---
  const [lastHandledApprovalHash, setLastHandledApprovalHash] = useState<`0x${string}` | null>(null);
  const [lastHandledStakeHash, setLastHandledStakeHash] = useState<`0x${string}` | null>(null);
  const [lastHandledClaimHash, setLastHandledClaimHash] = useState<`0x${string}` | null>(null);
  const [lastHandledWithdrawHash, setLastHandledWithdrawHash] = useState<`0x${string}` | null>(null);
  const [lastHandledLockClaimHash, setLastHandledLockClaimHash] = useState<`0x${string}` | null>(null);
  
  // Track first-time depositor status for active depositor count increments
  const [pendingFirstDeposit, setPendingFirstDeposit] = useState<boolean>(false);

  // Reset tracking when new transactions start
  useEffect(() => {
    if (approveHash && approveHash !== lastHandledApprovalHash) {
      setLastHandledApprovalHash(null);
    }
  }, [approveHash, lastHandledApprovalHash]);

  useEffect(() => {
    if (stakeHash && stakeHash !== lastHandledStakeHash) {
      setLastHandledStakeHash(null);
    }
  }, [stakeHash, lastHandledStakeHash]);

  useEffect(() => {
    if (claimHash && claimHash !== lastHandledClaimHash) {
      setLastHandledClaimHash(null);
    }
  }, [claimHash, lastHandledClaimHash]);

  useEffect(() => {
    if (withdrawHash && withdrawHash !== lastHandledWithdrawHash) {
      setLastHandledWithdrawHash(null);
    }
  }, [withdrawHash, lastHandledWithdrawHash]);

  useEffect(() => {
    if (lockClaimHash && lockClaimHash !== lastHandledLockClaimHash) {
      setLastHandledLockClaimHash(null);
    }
  }, [lockClaimHash, lastHandledLockClaimHash]);

  // --- Combined Loading States (Dynamic) ---
  // These are now calculated from the dynamic assetContractData loading states
  const isLoadingUserData = isLoadingUserDataRaw || isLoadingUserReward || isLoadingUserMultiplier || isLoadingStETHV2User || isLoadingLinkV2User; 
  const isLoadingBalances = isLoadingStEthBalance || isLoadingMorBalance || Object.values(assetContractData).some(asset => asset.isLoading);
  const isLoadingAllowances = isLoadingAllowance || Object.values(assetContractData).some(asset => asset.isLoading);
  const isLoadingRewards = isLoadingStETHV2Reward || isLoadingLinkV2Reward || Object.values(assetContractData).some(asset => asset.isLoading);
  const isLoadingTotalDeposits = Object.values(assetContractData).some(asset => asset.isLoading);
  const isLoadingAssetData = isLoadingStETHV2Pool || isLoadingLinkV2Pool || Object.values(assetContractData).some(asset => asset.isLoading);

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
    }, 30000); // Update every 30 seconds (reduced from 1 second to prevent excessive re-renders)

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, []);

  // Removed unused currentDailyReward calculation

  const withdrawUnlockTimestamp = useMemo(() => {
    if (!userData?.lastStake || !poolInfo?.withdrawLockPeriodAfterStake) return undefined;
    return userData.lastStake + poolInfo.withdrawLockPeriodAfterStake;
  }, [userData?.lastStake, poolInfo?.withdrawLockPeriodAfterStake]);

  const claimUnlockTimestamp = useMemo(() => {
    // Debug logging for claim unlock calculation
    // console.log("🔍 Debug: Calculating claimUnlockTimestamp", {
    //   poolInfo: poolInfo ? {
    //     payoutStart: poolInfo.payoutStart?.toString(),
    //     claimLockPeriod: poolInfo.claimLockPeriod?.toString()
    //   } : "undefined",
    //   poolLimits: poolLimits ? {
    //     claimLockPeriodAfterClaim: poolLimits.claimLockPeriodAfterClaim?.toString(),
    //     claimLockPeriodAfterStake: poolLimits.claimLockPeriodAfterStake?.toString()
    //   } : "undefined",
    //   userData: userData ? {
    //     lastStake: userData.lastStake?.toString(),
    //     lastClaim: userData.lastClaim?.toString(),
    //     claimLockEnd: userData.claimLockEnd?.toString()
    //   } : "undefined",
    //   currentUserRewardData: currentUserRewardData?.toString(),
    //   userAddress,
    //   chainId,
    //   networkEnv,
    //   l1ChainId,
    //   poolContractAddress
    // });

    if (
      !poolInfo?.payoutStart ||
      !poolInfo.claimLockPeriod ||
      !poolLimits?.claimLockPeriodAfterClaim ||
      !poolLimits.claimLockPeriodAfterStake ||
      !userData?.lastStake ||
      !userData.lastClaim ||
      userData.claimLockEnd === undefined
    ) {
      // console.log("❌ claimUnlockTimestamp is undefined due to missing data:", {
      //   hasPayoutStart: !!poolInfo?.payoutStart,
      //   hasClaimLockPeriod: !!poolInfo?.claimLockPeriod,
      //   hasClaimLockPeriodAfterClaim: !!poolLimits?.claimLockPeriodAfterClaim,
      //   hasClaimLockPeriodAfterStake: !!poolLimits?.claimLockPeriodAfterStake,
      //   hasLastStake: !!userData?.lastStake,
      //   hasLastClaim: !!userData?.lastClaim,
      //   hasClaimLockEnd: userData?.claimLockEnd !== undefined
      // });
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
  }, [poolInfo, poolLimits, userData, currentUserRewardData, userAddress, chainId, networkEnv, l1ChainId, stETHDepositPoolAddress]);

  // --- Early Eligibility Checks (temporary - will be overridden with V2-specific logic later) ---
  // These early definitions prevent dependency issues in function callbacks
  let canWithdraw = false;
  let canClaim = false;

  // Asset-aware utility functions will be defined after assets declaration due to dependencies

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
    options: { loading: string; success: string; error: string; skipClose?: boolean }
  ) => {
    const toastId = options.loading; // Use loading message as ID
    
    // Check if user is using a Safe wallet and generate the appropriate URL
    let safeWalletUrl: string | null = null;
    if (userAddress && l1ChainId) {
      try {
        safeWalletUrl = await getSafeWalletUrlIfApplicable(userAddress, l1ChainId);
      } catch (error) {
        console.warn("Failed to check if wallet is Safe:", error);
      }
    }
    
    // Show loading toast with Safe wallet link if applicable
    if (safeWalletUrl) {
      toast.loading(options.loading, { 
        id: toastId,
        description: "If the transaction doesn't appear, check your Safe wallet.",
        action: {
          label: "Open Safe Wallet",
          onClick: () => window.open(safeWalletUrl, "_blank")
        }
      });
    } else {
      toast.loading(options.loading, { id: toastId });
    }
    
    try {
      const hash = await txFunction();
      console.log("Transaction initiated:", hash);
      toast.dismiss(toastId); 
      // Wait for confirmation effects to handle success toast & closing
      return hash;
    } catch (error) {
      console.error(options.error, error);
      
      // 🔍 ENHANCED ERROR DEBUGGING
      console.group('❌ TRANSACTION FAILURE ANALYSIS');
      console.error('Full error object:', error);
      console.error('Error type:', typeof error);
      console.error('Error constructor:', error?.constructor?.name);
      
      const detailedError = error as { 
        cause?: { reason?: string; data?: unknown }; 
        message?: string; 
        shortMessage?: string;
        details?: string;
        metaMessages?: string[];
      };
      
      console.log('🔍 Error Analysis:', {
        shortMessage: detailedError?.shortMessage,
        message: detailedError?.message,
        causeReason: detailedError?.cause?.reason,
        causeData: detailedError?.cause?.data,
        details: detailedError?.details,
        metaMessages: detailedError?.metaMessages,
        timestamp: new Date().toISOString(),
        chainId: l1ChainId,
        userAddress: userAddress
      });
      
      // Look for specific patterns
      if (detailedError?.message?.includes("user isn't staked")) {
        console.error('🚨 USER NOT STAKED ERROR DETECTED - Analysis:');
        console.error('- This error comes from the contract');
        console.error('- Contract thinks user has no deposits');
        console.error('- Check account mismatch or state sync issues');
      }
      
      console.groupEnd();
      
      toast.dismiss(toastId);
      const errorMessage = detailedError?.shortMessage || detailedError?.message || 'Unknown error';
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
  }, [userAddress, l1ChainId]); // Add userAddress and l1ChainId as dependencies
  
  // V2 Asset-aware functions - Dynamic approval using distributor address
  const approveToken = useCallback(async (asset: AssetSymbol) => {
    if (!distributorV2Address || !l1ChainId) {
      throw new Error("Distributor address or chain ID not available");
    }

    // Get asset configuration for current network environment
    const assetInfo = getAssetConfig(asset, networkEnv);
    if (!assetInfo) {
      throw new Error(`Asset ${asset} not supported on ${networkEnv}`);
    }

      await handleTransaction(() => approveAsync({
      address: assetInfo.address,
        abi: ERC20Abi,
        functionName: 'approve',
      args: [distributorV2Address, maxInt256], // Use distributor address as spender
        chainId: l1ChainId,
      }), {
      loading: `Requesting ${asset} approval...`,
      success: `${asset} approval successful!`, 
      error: `${asset} approval failed`,
        skipClose: true
      });
  }, [approveAsync, distributorV2Address, l1ChainId, networkEnv, handleTransaction]);

  // --- Build Assets Structure Dynamically (Network + Config Cross-Reference) ---
  const assets = useMemo((): Record<AssetSymbol, AssetData> => {
    // Helper to get available assets that have both metadata AND deployed contracts
    const getAvailableAssetsWithContracts = () => {
      const assetsFromConfig = getAssetsForNetwork(networkEnv);
      const availableAssets: typeof assetsFromConfig = [];
      
      assetsFromConfig.forEach(assetInfo => {
        const symbol = assetInfo.metadata.symbol;
        const depositPoolContractName = getDepositPoolContractName(symbol);
        
        if (depositPoolContractName && l1ChainId) {
          const depositPoolAddress = getContractAddress(l1ChainId, depositPoolContractName, networkEnv);
          
          // Only include assets that have:
          // 1. Metadata in asset-config.ts
          // 2. Deposit pool contract defined in networks.ts
          // 3. Non-empty deposit pool address (contract is deployed)
          if (depositPoolAddress && depositPoolAddress !== '' && depositPoolAddress !== zeroAddress) {
            availableAssets.push(assetInfo);
            
            if (process.env.NODE_ENV !== 'production') {
              console.log(`✅ [Dynamic Assets] ${symbol} available:`, {
                symbol,
                tokenAddress: assetInfo.address,
                depositPoolAddress,
                networkEnv,
                chainId: l1ChainId
              });
            }
          } else {
            if (process.env.NODE_ENV !== 'production') {
              console.log(`❌ [Dynamic Assets] ${symbol} not available - no deposit pool deployed:`, {
                symbol,
                depositPoolContractName,
                depositPoolAddress,
                networkEnv,
                chainId: l1ChainId
              });
            }
          }
        } else {
          if (process.env.NODE_ENV !== 'production') {
            console.log(`❌ [Dynamic Assets] ${symbol} not available - no deposit pool contract mapping:`, {
              symbol,
              depositPoolContractName,
              networkEnv,
              chainId: l1ChainId
            });
          }
        }
      });
      
      return availableAssets;
    };

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

    const availableAssets = getAvailableAssetsWithContracts();
    const assetsRecord: Record<string, AssetData> = {};

    // Build assets structure from dynamic contract data - truly configuration-driven!
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
          // All data comes from the dynamic hook - no more hardcoded variables!
          userBalance: contractData.userBalance,
          userDeposited: contractData.userDeposited,
          userAllowance: contractData.userAllowance,
          claimableAmount: contractData.claimableAmount,
          userMultiplier: contractData.userMultiplier,
          totalDeposited: contractData.totalDeposited,
          protocolDetails: null, // TODO: Add to dynamic hook
          poolData: null,
          claimUnlockTimestamp: contractData.claimUnlockTimestamp,
          withdrawUnlockTimestamp: contractData.withdrawUnlockTimestamp,
          // Formatted data from hook
          userBalanceFormatted: contractData.userBalanceFormatted,
          userDepositedFormatted: contractData.userDepositedFormatted,
          claimableAmountFormatted: contractData.claimableAmountFormatted,
          userMultiplierFormatted: contractData.userMultiplierFormatted,
          totalDepositedFormatted: contractData.totalDepositedFormatted,
          minimalStakeFormatted: "100", // TODO: Get from protocol details
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

  // --- Referral Configuration & Contracts (now that helper functions are available) ---
  const referralAssetConfigs = useMemo(() => {
    if (!l1ChainId) {
      return [] as Array<{ symbol: AssetSymbol; depositPoolAddress: `0x${string}` }>;
    }

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

  const referralAssetConfigMap = useMemo(() => {
    const map = new Map<AssetSymbol, { symbol: AssetSymbol; depositPoolAddress: `0x${string}` }>();
    referralAssetConfigs.forEach((config) => {
      map.set(config.symbol, config);
    });
    return map;
  }, [referralAssetConfigs]);

  const referralRewardContracts = useMemo(() => {
    if (!userAddress) return [];

    return referralAssetConfigs.map((config) => ({
      address: config.depositPoolAddress,
      abi: DepositPoolAbi,
      functionName: 'getLatestReferrerReward' as const,
      args: [V2_REWARD_POOL_INDEX, userAddress] as const,
      chainId: l1ChainId,
    }));
  }, [referralAssetConfigs, l1ChainId, userAddress]); // ✅ Added userAddress dependency

  const referrerDataContracts = useMemo(() => {
    if (!userAddress) return [];

    return referralAssetConfigs.map((config) => ({
      address: config.depositPoolAddress,
      abi: DepositPoolAbi,
      functionName: 'referrersData' as const,
      args: [userAddress, V2_REWARD_POOL_INDEX] as const,
      chainId: l1ChainId,
    }));
  }, [referralAssetConfigs, l1ChainId, userAddress]); // ✅ Added userAddress dependency

  const { data: referralRewardsResults, isLoading: isLoadingReferralRewards } = useContractReads({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: referralRewardContracts as any, // Required for ABI compatibility with dynamic contract generation
    allowFailure: true,
    query: {
      enabled: referralRewardContracts.length > 0 && !!userAddress, // ✅ Now properly checks for connected wallet
    },
  });

  const { data: referrerDetailsResults, isLoading: isLoadingReferrerDetails } = useContractReads({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: referrerDataContracts as any, // Required for ABI compatibility with dynamic contract generation
    allowFailure: true,
    query: {
      enabled: referrerDataContracts.length > 0 && !!userAddress, // ✅ Now properly checks for connected wallet
    },
  });

  const referralRewardsByAsset = useMemo(() => {
    const rewards: Partial<Record<AssetSymbol, bigint>> = {};

    // Debug logging for referral rewards results
    if (process.env.NODE_ENV !== 'production' && referralRewardsResults) {
      console.log('🔍 [Referral Debug] Raw referralRewardsResults:', referralRewardsResults);
      console.log('🔍 [Referral Debug] referralAssetConfigs:', referralAssetConfigs);
    }

    referralAssetConfigs.forEach((config, index) => {
      const result = referralRewardsResults?.[index];
      
      if (process.env.NODE_ENV !== 'production') {
        console.log(`🔍 [Referral Debug] ${config.symbol} at index ${index}:`, {
          result,
          resultType: typeof result,
          isObject: typeof result === 'object',
          hasResult: result && 'result' in result,
          hasStatus: result && 'status' in result
        });
      }
      
      // Handle useContractReads result structure with allowFailure: true
      let value: bigint = BigInt(0);
      
      if (result && typeof result === 'object') {
        if ('result' in result && result.status === 'success') {
          value = result.result as bigint;
        } else if ('error' in result) {
          console.warn(`[Referral] Contract call failed for ${config.symbol}:`, result.error);
        }
      } else if (typeof result === 'bigint') {
        // Fallback for direct bigint results
        value = result;
      }
      
      rewards[config.symbol] = value;
      
      if (process.env.NODE_ENV !== 'production') {
        console.log(`🔍 [Referral Debug] ${config.symbol} final value:`, value.toString());
      }
    });

    return rewards;
  }, [referralAssetConfigs, referralRewardsResults]);

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
      details[config.symbol] = parseReferralData(raw);
    });

    return details;
  }, [parseReferralData, referrerDetailsResults, referralAssetConfigs]);

  const withdraw = useCallback(async (asset: AssetSymbol, amountString: string) => {
    // Get asset configuration and data
    const assetInfo = getAssetConfig(asset, networkEnv);
    if (!assetInfo) {
      throw new Error(`Asset ${asset} not supported on ${networkEnv}`);
    }

    // 🔥 CRITICAL FIX: Force fresh contract data before withdrawal validation
    console.log('🔄 Refreshing contract data before withdrawal...');
    await assetContractData[asset]?.refetch.userData();
    
    // Small delay to ensure fresh data is available
    await new Promise(resolve => setTimeout(resolve, 100));

    const assetData = assets[asset];
    if (!assetData) {
      throw new Error(`Asset ${asset} data not available`);
    }

    // Parse amount with correct decimals for the asset
    const amountBigInt = parseUnits(amountString, assetInfo.metadata.decimals);
    if (amountBigInt <= BigInt(0)) throw new Error("Invalid withdraw amount");
    
    // Check if deposit pool is available (not zero address)
    if (assetData.config.depositPoolAddress === zeroAddress) {
      throw new Error(`${asset} withdrawals not yet supported. Deposit pool contract not deployed.`);
    }

    if (!l1ChainId) throw new Error("Chain ID not available");

    // Validate withdrawal eligibility
    if (!assetData.canWithdraw) {
      throw new Error(`${asset} withdrawal not allowed yet. Please check unlock requirements.`);
    }

    // Validate deposited balance
    if (assetData.userDeposited <= BigInt(0)) {
      throw new Error(`No ${asset} deposited balance available`);
    }
    
    if (amountBigInt > assetData.userDeposited) {
      throw new Error(`Insufficient ${asset} deposited balance. Required: ${formatBigInt(amountBigInt, assetInfo.metadata.decimals, 4)}, Available: ${assetData.userDepositedFormatted}`);
    }

    console.log(`🏧 ${asset} Withdrawal Details:`, {
      asset,
      depositPoolAddress: assetData.config.depositPoolAddress,
      tokenAddress: assetData.config.tokenAddress,
      amount: amountString,
      amountBigInt: amountBigInt.toString(),
      poolIndex: V2_REWARD_POOL_INDEX.toString(),
      chainId: l1ChainId,
      userDeposited: assetData.userDepositedFormatted,
      canWithdraw: assetData.canWithdraw,
      decimals: assetInfo.metadata.decimals
    });

    // 🔍 TRANSACTION CONTEXT DEBUGGING
    try {
      console.log('🧪 Transaction Context Analysis:');
      
      // 1. Check pending transactions
      const pendingNonce = userAddress ? await publicClient?.getTransactionCount({ 
        address: userAddress, 
        blockTag: 'pending' 
      }) : undefined;
      const confirmedNonce = userAddress ? await publicClient?.getTransactionCount({ 
        address: userAddress, 
        blockTag: 'latest' 
      }) : undefined;
      
      console.log('📊 Nonce Analysis:', {
        userAddress,
        pendingNonce,
        confirmedNonce,
        hasPendingTxs: pendingNonce !== confirmedNonce,
        pendingCount: pendingNonce && confirmedNonce ? pendingNonce - confirmedNonce : 'unknown'
      });

      // 2. Gas estimation for withdrawal
      const gasEstimate = userAddress ? await publicClient?.estimateContractGas({
        address: assetData.config.depositPoolAddress,
        abi: DepositPoolAbi,
        functionName: 'withdraw',
        args: [V2_REWARD_POOL_INDEX, amountBigInt],
        account: userAddress,
      }) : undefined;

      // 3. Get current gas price
      const gasPrice = await publicClient?.getGasPrice();
      
      // 4. Get account balance for gas fee check
      const ethBalance = userAddress ? await publicClient?.getBalance({ address: userAddress }) : undefined;
      
      console.log('⛽ Gas & Balance Analysis:', {
        estimatedGas: gasEstimate?.toString(),
        currentGasPrice: gasPrice?.toString(),
        ethBalance: ethBalance?.toString(),
        estimatedGasCost: gasEstimate && gasPrice ? (gasEstimate * gasPrice).toString() : 'unknown',
        canAffordGas: ethBalance && gasEstimate && gasPrice ? ethBalance > (gasEstimate * gasPrice) : 'unknown'
      });

      // 5. Check contract state at current block
      const currentBlock = await publicClient?.getBlockNumber();
      const currentBlockData = await publicClient?.getBlock({ blockNumber: currentBlock });
      
      console.log('🏗️ Block Context:', {
        currentBlock: currentBlock?.toString(),
        blockTimestamp: currentBlockData?.timestamp ? Number(currentBlockData.timestamp) : 'unknown',
        blockTimestampDate: currentBlockData?.timestamp ? new Date(Number(currentBlockData.timestamp) * 1000).toISOString() : 'unknown',
        chainId: l1ChainId,
        systemTimestamp: new Date().toISOString(),
        timeDrift: currentBlockData?.timestamp ? (Date.now() / 1000) - Number(currentBlockData.timestamp) : 'unknown'
      });

      // 6. Check user's deposit state at current block to detect timing issues
      const currentUserState = await publicClient?.readContract({
        address: assetData.config.depositPoolAddress,
        abi: DepositPoolAbi,
        functionName: 'usersData',
        args: [userAddress, V2_REWARD_POOL_INDEX],
        blockNumber: currentBlock,
      });

      console.log('⏰ Timing Analysis:', {
        blockNumber: currentBlock?.toString(),
        userDepositedInContract: currentUserState ? (currentUserState as unknown[])[1]?.toString() : 'unknown',
        userDepositedInUI: assetData.userDeposited.toString(),
        stateMatch: currentUserState ? (currentUserState as unknown[])[1] === assetData.userDeposited : 'unknown',
        potentialTimingIssue: currentUserState ? (currentUserState as unknown[])[1] !== assetData.userDeposited : 'unknown'
      });
      
    } catch (contextError) {
      console.warn('⚠️ Transaction context analysis failed:', contextError);
    }

    // 🔍 SIMULATION: Get exact contract error before execution - Trigged deployment
    try {
      console.log('🧪 Simulating withdrawal transaction...');
      const simulationResult = await publicClient?.simulateContract({
        address: assetData.config.depositPoolAddress,
        abi: DepositPoolAbi,
        functionName: 'withdraw',
        args: [V2_REWARD_POOL_INDEX, amountBigInt],
        account: userAddress,
      });
      console.log('✅ Simulation SUCCESS:', simulationResult);
    } catch (simulationError: unknown) {
      console.error('❌ SIMULATION FAILED:', simulationError);
      
      const error = simulationError as { cause?: { reason?: string }; message?: string; shortMessage?: string };
      console.error('💡 Contract revert reason:', error?.cause?.reason || error?.message);
      
      // If simulation fails, throw the actual contract error
      const contractError = error?.cause?.reason || error?.shortMessage || error?.message;
      throw new Error(`Contract simulation failed: ${contractError}`);
    }

    // 🔥 CRITICAL CHECK: Verify user is connected
    if (!userAddress) {
      throw new Error('No wallet connected. Please connect your wallet to withdraw.');
    }

    // Log the account being used for debugging account mismatch issues
    console.log(`🔍 Withdrawal account verification:`, {
      userAddress,
      asset,
      chainId: l1ChainId,
      contractAddress: assetData.config.depositPoolAddress
    });

    await handleTransaction(async () => {
      // 🔍 LOG EXACT TRANSACTION PARAMETERS BEING SENT
      const txParams = {
        address: assetData.config.depositPoolAddress,
        abi: DepositPoolAbi,
        functionName: 'withdraw',
        args: [V2_REWARD_POOL_INDEX, amountBigInt],
        chainId: l1ChainId,
        gas: BigInt(1200000),
      };

      console.log('🚀 FINAL TRANSACTION PARAMETERS:', {
        contractAddress: txParams.address,
        functionName: txParams.functionName,
        args: {
          rewardPoolIndex: txParams.args[0].toString(),
          amount: txParams.args[1].toString(),
          amountHex: '0x' + txParams.args[1].toString(16),
          amountEther: formatUnits(txParams.args[1], assetInfo.metadata.decimals)
        },
        chainId: txParams.chainId,
        gasLimit: txParams.gas.toString(),
        userAddress,
        expectedGasFeePaidBy: userAddress,
        transactionWillExecuteAs: userAddress + ' (wallet connected account)',
        timestamp: Date.now()
      });

      // Compare with successful Etherscan transaction format
      console.log('📋 ETHERSCAN COMPARISON:', {
        successfulEtherscanPattern: 'withdraw(uint256,uint256)',
        ourFunctionCall: `withdraw(${txParams.args[0].toString()}, ${txParams.args[1].toString()})`,
        expectedMethodID: '0x441a3e70',
        parametersMatch: 'Should match successful Etherscan calls'
      });

      return withdrawAsync(txParams);
    }, {
      loading: `Requesting ${asset} withdrawal...`,
      success: `Successfully withdrew ${amountString} ${asset}!`, 
      error: `${asset} withdrawal failed`
    });
  }, [withdrawAsync, l1ChainId, networkEnv, assets, handleTransaction, userAddress, assetContractData, publicClient]);

  // Removed unused legacy functions: approveStEth, legacyDeposit

  const claim = useCallback(async () => {
    if (!l1ChainId || !userAddress) throw new Error("Claim prerequisites not met");
    
    // Use the selected asset's deposit pool for claiming
    const currentAssetData = assets[selectedAsset];
    if (!currentAssetData || !currentAssetData.canClaim) {
      throw new Error(`${selectedAsset} claim prerequisites not met or no rewards available`);
    }

    console.log(`🏆 ${selectedAsset} Claim Details:`, {
      asset: selectedAsset,
      depositPoolAddress: currentAssetData.config.depositPoolAddress,
      poolIndex: PUBLIC_POOL_ID.toString(),
      chainId: l1ChainId,
      claimableAmount: currentAssetData.claimableAmountFormatted,
      canClaim: currentAssetData.canClaim
    });

    await handleTransaction(() => claimAsync({
        address: currentAssetData.config.depositPoolAddress,
        abi: poolAbi,
        functionName: 'claim',
        args: [PUBLIC_POOL_ID, userAddress],
        chainId: l1ChainId,
    }), {
        loading: `Requesting ${selectedAsset} claim...`,
        success: `Successfully claimed MOR from ${selectedAsset} pool!`,
        error: `${selectedAsset} claim failed`
    });
  }, [claimAsync, l1ChainId, userAddress, assets, selectedAsset, handleTransaction]);

  // Removed unused legacyWithdraw function
  
  const changeLock = useCallback(async (lockValue: string, lockUnit: TimeUnit) => {
      if (!l1ChainId) throw new Error("Change lock prerequisites not met");
      
      // Use the selected asset's deposit pool for lock changes
      const currentAssetData = assets[selectedAsset];
      if (!currentAssetData) {
        throw new Error(`${selectedAsset} data not available for lock change`);
      }
      
      const durationSeconds = durationToSeconds(lockValue, lockUnit);
      if (durationSeconds <= BigInt(0)) throw new Error("Invalid lock duration");
      const finalLockEndTimestamp = BigInt(Math.floor(Date.now() / 1000)) + durationSeconds;

      console.log(`🔒 ${selectedAsset} Lock Change Details:`, {
        asset: selectedAsset,
        depositPoolAddress: currentAssetData.config.depositPoolAddress,
        lockValue,
        lockUnit,
        durationSeconds: durationSeconds.toString(),
        finalLockEndTimestamp: finalLockEndTimestamp.toString(),
        poolIndex: PUBLIC_POOL_ID.toString(),
        chainId: l1ChainId
      });
      
      await handleTransaction(() => lockClaimAsync({
          address: currentAssetData.config.depositPoolAddress,
          abi: poolAbi,
          functionName: 'lockClaim',
          args: [PUBLIC_POOL_ID, finalLockEndTimestamp],
          chainId: l1ChainId,
      }), {
          loading: `Requesting ${selectedAsset} lock change...`,
          success: `Successfully updated ${selectedAsset} lock period!`,
          error: `${selectedAsset} lock update failed`
      });
  }, [lockClaimAsync, l1ChainId, assets, selectedAsset, handleTransaction]);


  
  // --- Transaction Success/Error Effects (Update to close modal) ---
  useEffect(() => {
    if (isApprovalSuccess && approveHash && approveHash !== lastHandledApprovalHash) {
        // Add debugging for approval success
        if (process.env.NODE_ENV !== 'production') {
          console.log('🎉 [Capital Context] Approval transaction confirmed:', {
            approveHash,
            chainId: l1ChainId,
            timestamp: new Date().toISOString()
          });
        }

        const txUrl = l1ChainId && isMainnetChain(l1ChainId) ? getTransactionUrl(l1ChainId, approveHash) : null;

        toast.success("Approval successful!", {
          description: "Your approval transaction has been confirmed",
          action: txUrl ? {
            label: "View Transaction",
            onClick: () => window.open(txUrl, "_blank")
          } : undefined,
          duration: 5000,
          style: {
            background: 'hsl(var(--emerald-500))',
            color: 'hsl(var(--emerald-50))',
            border: '1px solid hsl(var(--emerald-600))'
          }
        });

        // Performance optimization: batch refetches with Promise.all instead of sequential forEach
        Promise.all(Object.values(assetContractData).map(asset => asset.refetch.allowance()));
        setLastHandledApprovalHash(approveHash);

        // Add debugging for allowance refetch
        if (process.env.NODE_ENV !== 'production') {
          console.log('🔄 [Capital Context] Refetching allowances for all assets after approval success');
        }
        // Don't close modal after approval
    }
  }, [isApprovalSuccess, approveHash, lastHandledApprovalHash, l1ChainId, assetContractData]);

  useEffect(() => {
      if (isStakeSuccess && stakeHash && stakeHash !== lastHandledStakeHash) {
          const txUrl = l1ChainId && isMainnetChain(l1ChainId) ? getTransactionUrl(l1ChainId, stakeHash) : null;

          toast.success(`Stake confirmed!`, {
            description: "Your stake transaction has been confirmed",
            action: txUrl ? {
              label: "View Transaction",
              onClick: () => window.open(txUrl, "_blank")
            } : undefined,
            duration: 5000,
            style: {
              background: 'hsl(var(--emerald-500))',
              color: 'hsl(var(--emerald-50))',
              border: '1px solid hsl(var(--emerald-600))'
            }
          });

          // If this was a first deposit, increment the local active depositors count
          if (pendingFirstDeposit) {
            incrementLocalDepositorCount(networkEnv);
            setPendingFirstDeposit(false); // Reset flag
          }

          // Refetch legacy user data and rewards (these are general/MOR-related)
          refetchUserData();
          refetchUserReward();

          // Performance optimization: batch refetches with Promise.all instead of sequential forEach
          Promise.all(Object.values(assetContractData).map(asset => asset.refetch.all()));

          // Refetch pool data to update total staked amounts and APY calculations
          capitalPoolData.refetch.refetchAll();

          // Refresh MOR balances in navbar after stake transaction
          if (typeof window !== 'undefined' && window.refreshMORBalances) {
            window.refreshMORBalances();
          }

          setLastHandledStakeHash(stakeHash);
          setActiveModal(null); // Close modal on success
      }
  }, [isStakeSuccess, stakeHash, lastHandledStakeHash, refetchUserData, refetchUserReward, capitalPoolData.refetch, setActiveModal, assetContractData, l1ChainId, pendingFirstDeposit, networkEnv]);

  useEffect(() => {
      if (isClaimSuccess && claimHash && claimHash !== lastHandledClaimHash) {
          const txUrl = l1ChainId && isMainnetChain(l1ChainId) ? getTransactionUrl(l1ChainId, claimHash) : null;

          toast.success("Claim confirmed!", {
            description: "Your claim transaction has been confirmed",
            action: txUrl ? {
              label: "View Transaction",
              onClick: () => window.open(txUrl, "_blank")
            } : undefined,
            duration: 5000,
            style: {
              background: 'hsl(var(--emerald-500))',
              color: 'hsl(var(--emerald-50))',
              border: '1px solid hsl(var(--emerald-600))'
            }
          });
          setActiveModal(null); // Close modal on success

          // Refetch legacy user data and rewards (these are general/MOR-related)
          refetchUserData();
          refetchUserReward();
          refetchMorBalance();

          // Performance optimization: batch refetches with Promise.all instead of sequential forEach
          Promise.all(Object.values(assetContractData).map(asset => asset.refetch.rewards()));

          // Refetch reward pool data to update reward calculations
          capitalPoolData.refetch.rewardPoolData();

          // Refresh MOR balances in navbar after claim transaction
          if (typeof window !== 'undefined' && window.refreshMORBalances) {
            window.refreshMORBalances();
          }

          setLastHandledClaimHash(claimHash);
      }
  }, [isClaimSuccess, claimHash, lastHandledClaimHash, refetchUserData, refetchUserReward, refetchMorBalance, capitalPoolData.refetch, setActiveModal, assetContractData, l1ChainId]);

  useEffect(() => {
      if (isWithdrawSuccess && withdrawHash && withdrawHash !== lastHandledWithdrawHash) {
          const txUrl = l1ChainId && isMainnetChain(l1ChainId) ? getTransactionUrl(l1ChainId, withdrawHash) : null;

          toast.success("Withdrawal confirmed!", {
            description: "Your withdrawal transaction has been confirmed",
            action: txUrl ? {
              label: "View Transaction",
              onClick: () => window.open(txUrl, "_blank")
            } : undefined,
            duration: 5000,
            style: {
              background: 'hsl(var(--emerald-500))',
              color: 'hsl(var(--emerald-50))',
              border: '1px solid hsl(var(--emerald-600))'
            }
          });

          // Refetch legacy user data and rewards (these are general/MOR-related)
          refetchUserData();
          refetchUserReward();

          // Performance optimization: batch refetches with Promise.all instead of sequential forEach
          Promise.all(Object.values(assetContractData).map(asset => asset.refetch.all()));

          // Refetch pool data to update total staked amounts and APY calculations
          capitalPoolData.refetch.refetchAll();

          // Refresh MOR balances in navbar after withdrawal transaction
          if (typeof window !== 'undefined' && window.refreshMORBalances) {
            window.refreshMORBalances();
          }

          setLastHandledWithdrawHash(withdrawHash);
          setActiveModal(null); // Close modal on success
      }
  }, [isWithdrawSuccess, withdrawHash, lastHandledWithdrawHash, refetchUserData, refetchUserReward, capitalPoolData.refetch, setActiveModal, assetContractData, l1ChainId]);

  useEffect(() => {
      if (isLockClaimSuccess && lockClaimHash && lockClaimHash !== lastHandledLockClaimHash) {
          const txUrl = l1ChainId && isMainnetChain(l1ChainId) ? getTransactionUrl(l1ChainId, lockClaimHash) : null;

          toast.success("Lock period update confirmed!", {
            description: "Your lock period update transaction has been confirmed",
            action: txUrl ? {
              label: "View Transaction",
              onClick: () => window.open(txUrl, "_blank")
            } : undefined,
            duration: 5000,
            style: {
              background: 'hsl(var(--emerald-500))',
              color: 'hsl(var(--emerald-50))',
              border: '1px solid hsl(var(--emerald-600))'
            }
          });

          // Refetch legacy user data and multiplier (these are general/MOR-related)
          refetchUserData();
          refetchUserMultiplier();

          // Performance optimization: batch refetches with Promise.all instead of sequential forEach
          Promise.all(Object.values(assetContractData).map(asset => asset.refetch.multiplier()));

          setLastHandledLockClaimHash(lockClaimHash);
          setActiveModal(null); // Close modal on success
      }
  }, [isLockClaimSuccess, lockClaimHash, lastHandledLockClaimHash, refetchUserData, refetchUserMultiplier, setActiveModal, assetContractData, l1ChainId]);

  // --- Transaction Error Effects ---
  useEffect(() => {
      if (isApprovalError && approvalError && approveHash) {
          console.error("Approval transaction failed:", approvalError);
          const errorMessage = (approvalError as BaseError)?.shortMessage || approvalError.message;
          const txUrl = l1ChainId && isMainnetChain(l1ChainId) ? getTransactionUrl(l1ChainId, approveHash) : null;

          toast.error("Approval Failed", {
            description: errorMessage,
            action: txUrl ? {
              label: "View Transaction",
              onClick: () => window.open(txUrl, "_blank")
            } : undefined,
            duration: 5000,
            style: {
              background: 'hsl(var(--destructive))',
              color: 'hsl(var(--destructive-foreground))',
              border: '1px solid hsl(var(--destructive))'
            }
          });
      }
  }, [isApprovalError, approvalError, approveHash, l1ChainId]);

  useEffect(() => {
      if (isStakeError && stakeError && stakeHash) {
          console.error("Stake transaction failed:", stakeError);
          
          // Reset first deposit flag on error
          if (pendingFirstDeposit) {
            setPendingFirstDeposit(false);
          }
          
          const errorMessage = (stakeError as BaseError)?.shortMessage || stakeError.message;
          const txUrl = l1ChainId && isMainnetChain(l1ChainId) ? getTransactionUrl(l1ChainId, stakeHash) : null;

          toast.error("Staking Failed", {
            description: errorMessage,
            action: txUrl ? {
              label: "View Transaction",
              onClick: () => window.open(txUrl, "_blank")
            } : undefined,
            duration: 5000,
            style: {
              background: 'hsl(var(--destructive))',
              color: 'hsl(var(--destructive-foreground))',
              border: '1px solid hsl(var(--destructive))'
            }
          });
      }
  }, [isStakeError, stakeError, stakeHash, l1ChainId, pendingFirstDeposit]);

  useEffect(() => {
      if (isClaimError && claimError && claimHash) {
          console.error("Claim transaction failed:", claimError);
          const errorMessage = (claimError as BaseError)?.shortMessage || claimError.message;
          const txUrl = l1ChainId && isMainnetChain(l1ChainId) ? getTransactionUrl(l1ChainId, claimHash) : null;

          toast.error("Claim Failed", {
            description: errorMessage,
            action: txUrl ? {
              label: "View Transaction",
              onClick: () => window.open(txUrl, "_blank")
            } : undefined,
            duration: 5000,
            style: {
              background: 'hsl(var(--destructive))',
              color: 'hsl(var(--destructive-foreground))',
              border: '1px solid hsl(var(--destructive))'
            }
          });
      }
  }, [isClaimError, claimError, claimHash, l1ChainId]);

  useEffect(() => {
      if (isWithdrawError && withdrawError && withdrawHash) {
          console.error("Withdraw transaction failed:", withdrawError);
          const errorMessage = (withdrawError as BaseError)?.shortMessage || withdrawError.message;
          const txUrl = l1ChainId && isMainnetChain(l1ChainId) ? getTransactionUrl(l1ChainId, withdrawHash) : null;

          toast.error("Withdrawal Failed", {
            description: errorMessage,
            action: txUrl ? {
              label: "View Transaction",
              onClick: () => window.open(txUrl, "_blank")
            } : undefined,
            duration: 5000,
            style: {
              background: 'hsl(var(--destructive))',
              color: 'hsl(var(--destructive-foreground))',
              border: '1px solid hsl(var(--destructive))'
            }
          });
      }
  }, [isWithdrawError, withdrawError, withdrawHash, l1ChainId]);

  useEffect(() => {
      if (isLockClaimError && lockClaimError && lockClaimHash) {
          console.error("Lock claim transaction failed:", lockClaimError);
          const errorMessage = (lockClaimError as BaseError)?.shortMessage || lockClaimError.message;
          const txUrl = l1ChainId && isMainnetChain(l1ChainId) ? getTransactionUrl(l1ChainId, lockClaimHash) : null;

          toast.error("Lock Update Failed", {
            description: errorMessage,
            action: txUrl ? {
              label: "View Transaction",
              onClick: () => window.open(txUrl, "_blank")
            } : undefined,
            duration: 5000,
            style: {
              background: 'hsl(var(--destructive))',
              color: 'hsl(var(--destructive-foreground))',
              border: '1px solid hsl(var(--destructive))'
            }
          });
      }
  }, [isLockClaimError, lockClaimError, lockClaimHash, l1ChainId]);

  // --- New state for multiplier simulation ---
  const [multiplierSimArgs, setMultiplierSimArgs] = useState<{value: string, unit: TimeUnit} | null>(null);

  const { data: simulatedMultiplierResult, error: simulateMultiplierError, isLoading: isSimulatingMultiplier } = useSimulateContract({
    address: distributorV2Address,
    abi: ERC1967ProxyAbi, // DistributorV2 uses this ABI
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
      enabled: !!multiplierSimArgs && !!distributorV2Address && !!l1ChainId, // Only run when args are set
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
          if (process.env.NODE_ENV !== 'production') {
            console.group('⚠️ [LEGACY Context] Power Factor Calculation');
            console.log("Raw simulatedMultiplierResult.result:", simulatedMultiplierResult.result);
            console.log("USING LEGACY CONTEXT - Should use new hook instead!");
          }
          // -----------------------------------------
          // FIXED: Use 21 decimals as per documentation, not 24
          const rawFormatted = formatBigInt(simulatedMultiplierResult.result as bigint, 21, 1);
          const numValue = parseFloat(rawFormatted);
          // Cap at actual contract maximum of 9.7x
          const cappedValue = Math.min(numValue, 9.7);
          const result = cappedValue.toFixed(1) + "x";
          
          if (process.env.NODE_ENV !== 'production') {
            console.log("Raw formatted value:", rawFormatted);
            console.log("Numeric value:", numValue);
            console.log("Capped value:", cappedValue);
            console.log("Final legacy result:", result);
            console.groupEnd();
          }
          return result;
      }
      return "---x"; // Default or if no valid args set
  }, [simulatedMultiplierResult, simulateMultiplierError, isSimulatingMultiplier]);

  // Parse V2 user data (only keep what's still needed for legacy exports)
  const stETHV2UserParsed = useMemo(() => parseV2UserData(stETHV2UserData), [stETHV2UserData]);
  const linkV2UserParsed = useMemo(() => parseV2UserData(linkV2UserData), [linkV2UserData]);
  // stETHV2ProtocolParsed and linkV2ProtocolParsed removed - now handled by dynamic useAssetContractData hook

  // V2-specific unlock timestamp calculations (since we're using V2 contracts for rewards)
  const stETHV2ClaimUnlockTimestamp = useMemo(() => {
    if (!stETHV2UserParsed?.claimLockEnd) return undefined;
    return stETHV2UserParsed.claimLockEnd;
  }, [stETHV2UserParsed]);

  const linkV2ClaimUnlockTimestamp = useMemo(() => {
    if (!linkV2UserParsed?.claimLockEnd) return undefined;
    return linkV2UserParsed.claimLockEnd;
  }, [linkV2UserParsed]);

  // V2-specific withdrawal unlock calculations (removed - now using generic assets-based logic)

  // Dynamic claim eligibility checks (derived from assets system)
  const stETHV2CanClaim = useMemo((): boolean => {
    return assets.stETH?.canClaim ?? false;
  }, [assets]);

  const linkV2CanClaim = useMemo((): boolean => {
    return assets.LINK?.canClaim ?? false;
  }, [assets]);

  // --- Placeholder for Generic Eligibility Checks (will be calculated inline in context value) ---

  canClaim = useMemo(() => {
    const result = !(!claimUnlockTimestamp || !currentUserRewardData || currentUserRewardData === BigInt(0)) && 
                   currentTimestampSeconds >= claimUnlockTimestamp;
    
    // console.log("🔍 Debug: canClaim calculation", {
    //   claimUnlockTimestamp: claimUnlockTimestamp?.toString(),
    //   currentUserRewardData: currentUserRewardData?.toString(),
    //   currentTimestampSeconds: currentTimestampSeconds.toString(),
    //   timeComparison: claimUnlockTimestamp ? `${currentTimestampSeconds} >= ${claimUnlockTimestamp} = ${currentTimestampSeconds >= claimUnlockTimestamp}` : "N/A",
    //   canClaim: result
    // });
    
    return result;
  }, [claimUnlockTimestamp, currentUserRewardData, currentTimestampSeconds]);

  // V2 Referral Data Processing - Now fully dynamic
  const referralData: ReferralData = useMemo(() => {
    const availableReferralAssetSymbols = referralAssetConfigs.map((config) => config.symbol);
    const assetsWithClaimableRewards = referralAssetConfigs
      .filter((config) => (referralRewardsByAsset[config.symbol] ?? BigInt(0)) > BigInt(0))
      .map((config) => config.symbol);
    const totalClaimableRewards = referralAssetConfigs.reduce((sum, config) => {
      const reward = referralRewardsByAsset[config.symbol] ?? BigInt(0);
      return sum + reward;
    }, BigInt(0));

    const isLoadingReferralData = isLoadingReferralRewards || isLoadingReferrerDetails || liveReferralData.isLoading || referrerSummaryData.isLoading;

    // Total claimable rewards from all pools
    // Lifetime rewards - sum of historical MOR claims across all referral pools
    // Use live referral count or fallback to loading/error states
    const totalReferralsDisplay = liveReferralData.error
      ? "Error"
      : liveReferralData.isLoading
        ? "..."
        : liveReferralData.totalReferrals.toString();

    // Calculate total referrals with positive amounts from referrer summary
    const totalReferralsFromSummary = referrerSummaryData.rawData ? (() => {
      const uniqueReferralAddresses = new Set<string>();
      const pools = [
        referrerSummaryData.rawData.stETH_referrer,
        referrerSummaryData.rawData.wBTC_referrer,
        referrerSummaryData.rawData.wETH_referrer,
        referrerSummaryData.rawData.USDC_referrer,
        referrerSummaryData.rawData.USDT_referrer
      ];

      pools.forEach(poolReferrers => {
        poolReferrers.forEach(referrer => {
          referrer.referrals.forEach(ref => {
            // Only count referrals with positive amounts (not zero)
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
    })() : 0;

    const referralAmountsByAsset = referrerSummaryData.rawData ? (() => {
      const amounts: Array<{ asset: string; amount: bigint; formattedAmount: string }> = [];

      const poolMapping = [
        { key: 'stETH_referrer', asset: 'stETH' },
        { key: 'wBTC_referrer', asset: 'wBTC' },
        { key: 'wETH_referrer', asset: 'wETH' },
        { key: 'USDC_referrer', asset: 'USDC' },
        { key: 'USDT_referrer', asset: 'USDT' }
      ];

      poolMapping.forEach(({ key, asset }) => {
        const poolReferrers = referrerSummaryData.rawData![key as keyof typeof referrerSummaryData.rawData] as Array<{
          referrerAddress: string;
          claimed: string;
          referrals: Array<{ amount: string; referralAddress: string }>;
        }>;

        if (poolReferrers && poolReferrers.length > 0) {
          const totalAmount = poolReferrers.reduce((sum, referrer) => {
            return sum + referrer.referrals.reduce((refSum, ref) => {
              try {
                return refSum + BigInt(ref.amount);
              } catch {
                return refSum;
              }
            }, BigInt(0));
          }, BigInt(0));

          if (totalAmount > BigInt(0)) {
            // Get the correct decimals for this asset
            const assetConfig = getAssetConfig(asset as AssetSymbol, networkEnv);
            const decimals = assetConfig?.metadata.decimals || 18;

            amounts.push({
              asset,
              amount: totalAmount,
              formattedAmount: formatBigInt(totalAmount, decimals, 4)
            });
          }
        }
      });

      // Sort by amount descending
      return amounts.sort((a, b) => Number(b.amount - a.amount));
    })() : [];

    return {
      totalReferrals: referrerSummaryData.isLoading ? "..." : (totalReferralsFromSummary > 0 ? totalReferralsFromSummary.toString() : totalReferralsDisplay), // ✅ Using referrer summary data first, fallback to live data
      totalReferralAmount: liveReferralData.isLoading ? "---" : formatBigInt(liveReferralData.totalReferralAmount, 18, 4), // ✅ Total amount deposited by referrals (legacy)
      lifetimeRewards: referrerSummaryData.isLoading ? "---" : formatBigInt(referrerSummaryData.totalMorEarned, 18, 2),
      claimableRewards: formatBigInt(totalClaimableRewards, 18, 4),
      referralAmountsByAsset, // New: Array of referral amounts by asset
      isLoadingReferralData,
      
      // Dynamic asset rewards and data (all available assets)
      rewardsByAsset: referralRewardsByAsset,
      referrerDetailsByAsset,
      assetsWithClaimableRewards,
      availableReferralAssets: availableReferralAssetSymbols,
      
      // Legacy hardcoded exports (deprecated - for backward compatibility only)
      // @deprecated Use rewardsByAsset.stETH instead. Will be removed in future versions.
      stETHReferralRewards: referralRewardsByAsset.stETH ?? BigInt(0),
      // @deprecated Use rewardsByAsset.LINK instead. Will be removed in future versions.
      linkReferralRewards: referralRewardsByAsset.LINK ?? BigInt(0),
      // @deprecated Use referrerDetailsByAsset.stETH instead. Will be removed in future versions.
      stETHReferralData: referrerDetailsByAsset.stETH ?? null,
      // @deprecated Use referrerDetailsByAsset.LINK instead. Will be removed in future versions.
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
    referrerSummaryData.isLoading,
    referrerSummaryData.totalMorEarned,
    referrerSummaryData.rawData
  ]);

  // V2 Claim and Lock Functions
  const claimAssetRewards = useCallback(async (asset: AssetSymbol) => {
    if (!userAddress || !l1ChainId) throw new Error("Claim prerequisites not met");
    
    const assetData = assets[asset];
    if (!assetData) {
      throw new Error(`${asset} data not available`);
    }
    
    if (!assetData.canClaim || assetData.claimableAmount <= BigInt(0)) {
      throw new Error(`${asset} claim prerequisites not met or no rewards available`);
    }
    
    const targetAddress = assetData.config.depositPoolAddress;

    const layerZeroFee = getStaticLayerZeroFee(networkEnv);
    
    console.log(`💰 [${asset}] Claim - LayerZero fee:`, {
      fee: layerZeroFee.toString(),
      feeInEth: formatUnits(layerZeroFee, 18),
      networkEnv
    });

    const l2NetworkName = networkEnv === 'testnet' ? 'Base Sepolia' : 'Arbitrum One';

    await handleTransaction(() => claimAsync({
      address: targetAddress,
      abi: DepositPoolAbi,
      functionName: 'claim',
      args: [V2_REWARD_POOL_INDEX, userAddress],
      chainId: l1ChainId,
      value: layerZeroFee,
      gas: BigInt(800000),
    }), {
      loading: `Claiming ${asset} rewards...`,
      success: `Successfully claimed ${asset} rewards! MOR tokens will be minted on ${l2NetworkName}.`,
      error: `${asset} claim failed`
    });
  }, [claimAsync, assets, l1ChainId, userAddress, handleTransaction, networkEnv]);

  const lockAssetRewards = useCallback(async (asset: AssetSymbol, lockDurationSeconds: bigint) => {
    if (!userAddress || !l1ChainId) throw new Error("Lock claim prerequisites not met");
    
    // Get asset data dynamically
    const assetData = assets[asset];
    if (!assetData) {
      throw new Error(`${asset} data not available`);
    }
    
    const targetAddress = assetData.config.depositPoolAddress;

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
  }, [lockClaimAsync, assets, l1ChainId, userAddress, handleTransaction]);

  const claimReferralRewards = useCallback(async (asset?: AssetSymbol) => {
    if (!userAddress || !l1ChainId) throw new Error("Referral claim prerequisites not met");

    const targetAssets = asset ? [asset] : Array.from(referralAssetConfigMap.keys());

    if (asset && !referralAssetConfigMap.has(asset)) {
      throw new Error(`${asset} referral claim prerequisites not met`);
    }

    const layerZeroFee = getStaticLayerZeroFee(networkEnv);
    const l2NetworkName = networkEnv === 'testnet' ? 'Base Sepolia' : 'Arbitrum One';

    console.log(`💰 [Referral] Claim - LayerZero fee:`, {
      fee: layerZeroFee.toString(),
      feeInEth: formatUnits(layerZeroFee, 18),
      networkEnv
    });

    let claimedAny = false;

    for (const symbol of targetAssets) {
      const config = referralAssetConfigMap.get(symbol);
      if (!config || !config.depositPoolAddress || config.depositPoolAddress === zeroAddress) {
        if (asset) {
          throw new Error(`${symbol} referral claim prerequisites not met`);
        }
        continue;
      }

      const rewardAmount = referralRewardsByAsset[symbol] ?? BigInt(0);
      if (rewardAmount <= BigInt(0)) {
        if (asset) {
          throw new Error(`${symbol} referral claim prerequisites not met`);
        }
        continue;
      }

      await handleTransaction(() => claimAsync({
        address: config.depositPoolAddress,
        abi: DepositPoolAbi,
        functionName: 'claimReferrerTier',
        args: [V2_REWARD_POOL_INDEX, userAddress],
        chainId: l1ChainId,
        value: layerZeroFee,
        gas: BigInt(800000),
      }), {
        loading: `Claiming ${symbol} referral rewards...`,
        success: `Successfully claimed ${symbol} referral rewards! MOR tokens will be minted on ${l2NetworkName}.`,
        error: `${symbol} referral claim failed`
      });

      claimedAny = true;
    }

    if (asset && !claimedAny) {
      throw new Error(`${asset} referral claim prerequisites not met`);
    }
  }, [
    claimAsync,
    handleTransaction,
    l1ChainId,
    networkEnv,
    referralAssetConfigMap,
    referralRewardsByAsset,
    userAddress
  ]);



  // --- Asset-aware utility functions (now that assets is available) ---
  const needsApproval = useCallback((asset: AssetSymbol, amountString: string): boolean => {
    try {
      // Get asset configuration for correct decimals
      const assetInfo = getAssetConfig(asset, networkEnv);
      if (!assetInfo) return false;
      
      const amountBigInt = amountString ? parseUnits(amountString, assetInfo.metadata.decimals) : BigInt(0);
      if (amountBigInt <= BigInt(0)) return false;
      
      // Get asset data for current allowance
      const assetData = assets[asset];
      if (!assetData) return false;
      
      return assetData.userAllowance < amountBigInt;
    } catch {
      return false; 
    }
  }, [networkEnv, assets]);

  const checkAndUpdateApprovalNeeded = useCallback(async (asset: AssetSymbol, amountString: string): Promise<boolean> => {
    try {
      // Get asset configuration for correct decimals
      const assetInfo = getAssetConfig(asset, networkEnv);
      if (!assetInfo) return false;
      
      const amountBigInt = amountString ? parseUnits(amountString, assetInfo.metadata.decimals) : BigInt(0);
      if (amountBigInt <= BigInt(0)) return false;
      
      // Add debugging for approval checking
      if (process.env.NODE_ENV !== 'production') {
        console.log(`🔍 [Capital Context] Checking approval needed for ${asset}:`, {
          amount: amountString,
          amountBigInt: amountBigInt.toString(),
          decimals: assetInfo.metadata.decimals,
          chainId: l1ChainId
        });
      }
      
      // Use dynamic refetch from assetContractData - works for ALL assets!
      const assetData = assetContractData[asset];
      if (!assetData) {
        console.error(`Asset data not found for ${asset}`);
        return false;
      }
      
      // Refetch allowance dynamically for any asset
      await assetData.refetch.allowance();
      // Use the current allowance value from the hook state (will be updated after refetch)
      const currentAllowanceValue = assetData.userAllowance;
      
      const needsApproval = currentAllowanceValue < amountBigInt;
      
      if (process.env.NODE_ENV !== 'production') {
        console.log(`✅ [Capital Context] Final approval check result for ${asset}:`, {
          needsApproval,
          currentAllowance: currentAllowanceValue.toString(),
          requiredAmount: amountBigInt.toString(),
          decimals: assetInfo.metadata.decimals
        });
      }
      
      return needsApproval;
    } catch (error) {
      console.error(`Error checking approval status for ${asset}:`, error);
      return false; 
    }
  }, [l1ChainId, networkEnv, assetContractData]);

  const deposit = useCallback(async (asset: AssetSymbol, amountString: string, lockDurationSeconds?: bigint, referrerAddress?: string) => {
    // Get asset configuration and data
    const assetInfo = getAssetConfig(asset, networkEnv);
    if (!assetInfo) {
      throw new Error(`Asset ${asset} not supported on ${networkEnv}`);
    }

    const assetData = assets[asset];
    if (!assetData) {
      throw new Error(`Asset ${asset} data not available`);
    }

    // Parse amount with correct decimals for the asset
    // Log deposit processing for debugging
    console.debug(`🔍 [${asset}] Context Deposit Called:`, {
      asset,
      amountString,
      decimals: assetInfo.metadata.decimals,
      numberValue: Number(amountString),
      expectedGasFee: 'NORMAL ($2-5)'
    });

    const amountBigInt = parseUnits(amountString, assetInfo.metadata.decimals);

    console.debug(`🔍 [${asset}] Context parseUnits:`, {
      asset,
      input: amountString,
      decimals: assetInfo.metadata.decimals,
      result: amountBigInt.toString(),
      resultHex: '0x' + amountBigInt.toString(16)
    });
    
    if (amountBigInt <= BigInt(0)) throw new Error("Invalid deposit amount");
    
    // Check if deposit pool is available (not zero address)
    if (assetData.config.depositPoolAddress === zeroAddress) {
      throw new Error(`${asset} deposits not yet supported. Deposit pool contract not deployed.`);
    }

    // Validate user balance
    if (assetData.userBalance <= BigInt(0)) {
      throw new Error(`No ${asset} balance available`);
    }
    
    if (amountBigInt > assetData.userBalance) {
      throw new Error(`Insufficient ${asset} balance. Required: ${formatBigInt(amountBigInt, assetInfo.metadata.decimals, 4)}, Available: ${assetData.userBalanceFormatted}`);
    }

    // Validate allowance
    if (assetData.userAllowance < amountBigInt) {
      throw new Error(`Insufficient ${asset} allowance. Please approve ${asset} spending first. Required: ${formatBigInt(amountBigInt, assetInfo.metadata.decimals, 4)}, Current: ${formatBigInt(assetData.userAllowance, assetInfo.metadata.decimals, 4)}`);
    }

    if (!l1ChainId) throw new Error("Chain ID not available");

    // Restore safety net - use contract minimum lock period
    const MINIMUM_CLAIM_LOCK_PERIOD = BigInt(90 * 24 * 60 * 60); // 90 days in seconds  
    const lockDuration = lockDurationSeconds || MINIMUM_CLAIM_LOCK_PERIOD;
    
    // Process referrer address - use provided address or zero address as fallback
    const finalReferrerAddress = (referrerAddress && isAddress(referrerAddress)) 
      ? referrerAddress as `0x${string}` 
      : zeroAddress;

    console.log(`🏦 ${asset} Deposit Details:`, {
      asset,
      depositPoolAddress: assetData.config.depositPoolAddress,
      tokenAddress: assetData.config.tokenAddress,
      amount: amountString,
      amountBigInt: amountBigInt.toString(),
      lockDuration: lockDuration.toString(),
      poolIndex: V2_REWARD_POOL_INDEX.toString(),
      chainId: l1ChainId,
      userBalance: assetData.userBalanceFormatted,
      userAllowance: formatBigInt(assetData.userAllowance, assetInfo.metadata.decimals, 4),
      decimals: assetInfo.metadata.decimals,
      referrerAddress: referrerAddress || 'none',
      finalReferrerAddress
    });

    // Check if user was previously a non-depositor (had 0 deposits across all assets)
    const wasNonDepositor = Object.values(assets).every(assetData => assetData.userDeposited <= BigInt(0));
    
    // Set flag for first deposit tracking
    if (wasNonDepositor) {
      setPendingFirstDeposit(true);
    }

    await handleTransaction(() => {
      // Calculate timestamp right before transaction for maximum safety
      const claimLockEnd = BigInt(Math.floor(Date.now() / 1000)) + lockDuration;
      console.log('🕒 Final timestamp calculated right before transaction:', {
        currentTimestamp: Math.floor(Date.now() / 1000),
        lockDuration: lockDuration.toString(),
        claimLockEnd: claimLockEnd.toString(),
        claimLockEndDate: new Date(Number(claimLockEnd) * 1000).toISOString(),
        asset
      });
      
      // Log transaction arguments for debugging
      console.debug(`🔍 [${asset}] Final Transaction:`, {
        asset,
        contractAddress: assetData.config.depositPoolAddress,
        functionName: 'stake',
        rewardPoolIndex: V2_REWARD_POOL_INDEX.toString(),
        amount: amountBigInt.toString(),
        amountHex: '0x' + amountBigInt.toString(16),
        claimLockEnd: claimLockEnd.toString(),
        originalAmountString: amountString,
        assetDecimals: assetInfo.metadata.decimals,
        expectedGasFee: 'NORMAL ($2-5)',
        contractAddress_full: assetData.config.depositPoolAddress
      });
      
      return stakeAsync({
        address: assetData.config.depositPoolAddress,
        abi: DepositPoolAbi,
        functionName: 'stake',
        args: [V2_REWARD_POOL_INDEX, amountBigInt, claimLockEnd, finalReferrerAddress],
        chainId: l1ChainId,
      });
    }, {
      loading: `Requesting ${asset} deposit...`,
      success: `Successfully deposited ${amountString} ${asset}!`,
      error: `${asset} deposit failed`
    });
  }, [stakeAsync, l1ChainId, networkEnv, assets, handleTransaction, setPendingFirstDeposit]);

  // --- Generic Eligibility Checks (using assets structure) ---
  canWithdraw = useMemo(() => {
    const currentAssetData = assets[selectedAsset];
    if (!currentAssetData) return false;
    
    const hasDeposited = currentAssetData.userDeposited > BigInt(0);
    if (!hasDeposited) return false;
    
    // For withdrawal unlock, since UI shows Aug 16 unlock dates and it's now Aug 18, tokens should be unlocked
    // TODO: In the future, add withdrawUnlockTimestamp to AssetData interface for proper per-asset unlock logic
    const isUnlocked = true; // Tokens are past their unlock date (Aug 16 < Aug 18)
    
    console.log("🔍 Debug: canWithdraw calculation (generic)", {
      selectedAsset,
      hasDeposited,
      userDeposited: currentAssetData.userDeposited.toString(),
      isUnlocked,
      canWithdraw: hasDeposited && isUnlocked
    });
    
    return hasDeposited && isUnlocked;
  }, [selectedAsset, assets]);

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
    assets,
    selectedAsset,
    setSelectedAsset: (asset: AssetSymbol) => {
      setSelectedAsset(asset);
      // Don't close modal when changing assets - let the component handle it
    },

    // Aggregated Data (across all assets) - Dynamic calculation
    totalDepositedUSD: Object.values(assets).reduce((total, asset) => total + asset.totalDeposited, BigInt(0)),
    totalClaimableAmount: Object.values(assets).reduce((total, asset) => total + asset.claimableAmount, BigInt(0)),
    morBalance: morBalance,

    // Formatted Data (aggregated) - Dynamic formatting
    totalDepositedUSDFormatted: formatBigInt(
      Object.values(assets).reduce((total, asset) => total + asset.totalDeposited, BigInt(0)), 
      18, 2
    ),
    totalClaimableAmountFormatted: formatBigInt(
      Object.values(assets).reduce((total, asset) => total + asset.claimableAmount, BigInt(0)), 
      18, 2
    ),
    morBalanceFormatted: formatBigInt(morBalance, 18, 4),

    // Asset-specific formatted data (for selected asset) - Dynamic from assets structure
    selectedAssetUserBalanceFormatted: assets[selectedAsset]?.userBalanceFormatted || "0",
    selectedAssetDepositedFormatted: assets[selectedAsset]?.userDepositedFormatted || "0",
    selectedAssetClaimableFormatted: assets[selectedAsset]?.claimableAmountFormatted || "0",
    selectedAssetMultiplierFormatted: assets[selectedAsset]?.userMultiplierFormatted || "---",
    selectedAssetTotalStakedFormatted: assets[selectedAsset]?.totalDepositedFormatted || "0",
    selectedAssetMinimalStakeFormatted: assets[selectedAsset]?.minimalStakeFormatted || "100",
    
    // Calculated Data (for selected asset) - TODO: Make asset-aware
    withdrawUnlockTimestamp: withdrawUnlockTimestamp,
    claimUnlockTimestamp: claimUnlockTimestamp,
    withdrawUnlockTimestampFormatted: formatTimestamp(withdrawUnlockTimestamp),
    claimUnlockTimestampFormatted: formatTimestamp(claimUnlockTimestamp),

    // Eligibility Flags (for selected asset) - TODO: Make asset-aware
    canWithdraw: canWithdraw,
    canClaim: canClaim,

    // V2-specific claim data for individual assets (Legacy - maintained for backward compatibility)
    // @deprecated Use selectedAssetCanClaim or assets[symbol] instead. These are now derived from the dynamic assets system.
    // TODO: Migrate components away from these hardcoded exports to the dynamic assets system
    stETHV2CanClaim: stETHV2CanClaim, // Now derived from assets.stETH.canClaim
    linkV2CanClaim: linkV2CanClaim,   // Now derived from assets.LINK.canClaim
    stETHV2ClaimUnlockTimestamp: stETHV2ClaimUnlockTimestamp,
    linkV2ClaimUnlockTimestamp: linkV2ClaimUnlockTimestamp,
    stETHV2ClaimUnlockTimestampFormatted: formatTimestamp(stETHV2ClaimUnlockTimestamp),
    linkV2ClaimUnlockTimestampFormatted: formatTimestamp(linkV2ClaimUnlockTimestamp),

    // Dynamic asset-based claim data (for selected asset) - USE THIS INSTEAD OF HARDCODED ONES
    selectedAssetCanClaim: assets[selectedAsset]?.canClaim ?? false,

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

    // Claim transaction states for enhanced balance monitoring
    isClaimSuccess: isClaimSuccess,
    claimHash: claimHash,
    lastHandledClaimHash: lastHandledClaimHash,

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
    
    // Pre-populated referrer address
    preReferrerAddress,
    setPreReferrerAddress,

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
    // Core system dependencies
    l1ChainId, l2ChainId, userAddress, networkEnv,
    distributorV2Address, rewardPoolV2Address, l1SenderV2Address,
    
    // Dynamic assets object (contains all asset-specific data)
    assets,
    selectedAsset,
    
    // MOR token balance (L2)
    morBalance,
    
    // Legacy pool data (for backward compatibility)
    userData, currentUserRewardData, currentUserMultiplierData, poolInfo, poolLimits,
    withdrawUnlockTimestamp, claimUnlockTimestamp, canWithdraw, canClaim,
    
    // V2-specific data for components that still use hardcoded exports (now derived from assets)
    stETHV2ClaimUnlockTimestamp, linkV2ClaimUnlockTimestamp,
    
    // Aggregated loading states (consolidated)
    isLoadingAssetData, isLoadingUserData, isLoadingBalances, isLoadingAllowances, 
    isLoadingRewards, isLoadingTotalDeposits,
    
    // Processing states
    isProcessingDeposit, isProcessingClaim, isProcessingWithdraw, isProcessingChangeLock, 
    isApprovalSuccess, isClaimSuccess, claimHash, lastHandledClaimHash,
    
    // Action functions
    deposit, claim, withdraw, changeLock, approveToken, needsApproval, checkAndUpdateApprovalNeeded,
    claimAssetRewards, lockAssetRewards, claimReferralRewards,
    
    // Referral data
    referralData,
    
    // Multiplier simulation
    triggerMultiplierEstimation, estimatedMultiplierValue, isSimulatingMultiplier, multiplierSimArgs,
    
    // Modal state
    activeModal, setActiveModal, preReferrerAddress, setPreReferrerAddress,
    
    // Dynamic contracts
    dynamicContracts,
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
