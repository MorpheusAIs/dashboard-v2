/**
 * Type definitions for the Capital Page Context
 * Extracted from CapitalPageContext.tsx for better maintainability
 */

// Re-export AssetSymbol from the asset-config module
export type { AssetSymbol } from "@/components/capital/constants/asset-config";

// Import AssetSymbol for use in this file
import type { AssetSymbol } from "@/components/capital/constants/asset-config";

// --- Pool Data Types ---

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

// --- Referral Types ---

export interface ReferralAmountByAsset {
  asset: string;
  amount: bigint;
  formattedAmount: string;
}

export interface ReferralContractData {
  amountStaked: bigint;
  virtualAmountStaked: bigint;
  rate: bigint;
  pendingRewards: bigint;
  lastClaim: bigint;
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
  stETHReferralRewards: bigint;
  linkReferralRewards: bigint;
  stETHReferralData: ReferralContractData | null;
  linkReferralData: ReferralContractData | null;
}

// --- Asset Types ---

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

// --- UI State Types ---

export type ActiveModal =
  | "deposit"
  | "withdraw"
  | "changeLock"
  | "stakeMorRewards"
  | "lockMorRewards"
  | "claimMorRewards"
  | null;

export type TimeUnit = "days" | "months" | "years";

// --- Dynamic Contract Type ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DynamicContract = any;

// --- Context State Type ---

export interface CapitalContextState {
  // Static Info
  l1ChainId?: number;
  l2ChainId?: number;
  userAddress?: `0x${string}`;
  networkEnv: import("@/config/networks").NetworkEnvironment;

  // V2 Contract Addresses
  distributorV2Address?: `0x${string}`;
  rewardPoolV2Address?: `0x${string}`;
  l1SenderV2Address?: `0x${string}`;

  // Asset Configuration & Data
  assets: Record<AssetSymbol, AssetData>;
  selectedAsset: AssetSymbol;
  setSelectedAsset: (asset: AssetSymbol) => void;

  // Aggregated Data (across all assets)
  totalDepositedUSD: bigint;
  totalClaimableAmount: bigint;
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
  selectedAssetCanClaim: boolean;

  // V2-specific claim data for individual assets (deprecated)
  /** @deprecated Use selectedAssetCanClaim or assets[symbol] instead */
  stETHV2CanClaim: boolean;
  /** @deprecated Use selectedAssetCanClaim or assets[symbol] instead */
  linkV2CanClaim: boolean;
  /** @deprecated Use selectedAssetCanClaim or assets[symbol] instead */
  stETHV2ClaimUnlockTimestamp?: bigint;
  /** @deprecated Use selectedAssetCanClaim or assets[symbol] instead */
  linkV2ClaimUnlockTimestamp?: bigint;
  /** @deprecated Use selectedAssetCanClaim or assets[symbol] instead */
  stETHV2ClaimUnlockTimestampFormatted: string;
  /** @deprecated Use selectedAssetCanClaim or assets[symbol] instead */
  linkV2ClaimUnlockTimestampFormatted: string;

  // V2 Referral Data
  referralData: ReferralData;

  // Loading States
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

  // Claim transaction states
  isClaimSuccess: boolean;
  claimHash?: `0x${string}`;
  lastHandledClaimHash: `0x${string}` | null;

  // V2 Action Functions (asset-aware)
  deposit: (asset: AssetSymbol, amount: string, lockDurationSeconds?: bigint, referrerAddress?: string) => Promise<void>;
  claim: () => Promise<void>;
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

  // Pre-populated referrer address
  preReferrerAddress: string;
  setPreReferrerAddress: (address: string) => void;

  // Multiplier simulation
  multiplierSimArgs: { value: string; unit: TimeUnit } | null;
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
