"use client";

import React, { createContext, useContext, useMemo, useCallback, useRef, useEffect } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, zeroAddress, isAddress } from "viem";
import { toast } from "sonner";
import { useCapitalNetwork } from "./CapitalNetworkContext";
import { useCapitalAssets } from "./CapitalAssetsContext";
import { useCapitalMORBalance } from "./CapitalMORBalanceContext";
import { useCapitalUI } from "./CapitalUIContext";
import { type AssetSymbol, type TimeUnit, durationToSeconds } from "./types";
import { getAssetConfig } from "@/components/capital/constants/asset-config";
import { formatBigInt } from "@/lib/utils/formatters";
import ERC20Abi from "@/app/abi/ERC20.json";
import DepositPoolAbi from "@/app/abi/DepositPool.json";
import { getSafeWalletUrlIfApplicable } from "@/lib/utils/safe-wallet-detection";

const V2_REWARD_POOL_INDEX = BigInt(0);

// ============================================================================
// Context State Interface
// ============================================================================

interface CapitalTransactionsState {
  // Action functions
  deposit: (asset: AssetSymbol, amount: string, lockDurationSeconds?: bigint, referrerAddress?: string) => Promise<void>;
  withdraw: (asset: AssetSymbol, amount: string) => Promise<void>;
  claim: (asset: AssetSymbol) => Promise<void>;
  approveToken: (asset: AssetSymbol) => Promise<void>;
  changeLock: (asset: AssetSymbol, lockValue: string, lockUnit: TimeUnit) => Promise<void>;

  // Transaction hashes
  approveHash?: `0x${string}`;
  stakeHash?: `0x${string}`;
  claimHash?: `0x${string}`;
  withdrawHash?: `0x${string}`;
  lockClaimHash?: `0x${string}`;

  // Sending states (wallet interaction pending)
  isSendingApproval: boolean;
  isSendingStake: boolean;
  isSendingClaim: boolean;
  isSendingWithdraw: boolean;
  isSendingLockClaim: boolean;

  // Confirming states (transaction in mempool)
  isConfirmingApproval: boolean;
  isConfirmingStake: boolean;
  isConfirmingClaim: boolean;
  isConfirmingWithdraw: boolean;
  isConfirmingLockClaim: boolean;

  // Success states
  isApprovalSuccess: boolean;
  isStakeSuccess: boolean;
  isClaimSuccess: boolean;
  isWithdrawSuccess: boolean;
  isLockClaimSuccess: boolean;

  // Combined processing states
  isProcessingDeposit: boolean;
  isProcessingWithdraw: boolean;
  isProcessingClaim: boolean;
  isProcessingChangeLock: boolean;
  isProcessingApproval: boolean;
}

// ============================================================================
// Context Creation
// ============================================================================

const CapitalTransactionsContext = createContext<CapitalTransactionsState | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

interface CapitalTransactionsProviderProps {
  children: React.ReactNode;
}

export function CapitalTransactionsProvider({ children }: CapitalTransactionsProviderProps) {
  const { l1ChainId, networkEnv, userAddress, distributorV2Address } = useCapitalNetwork();
  const { assets, assetContractData, refetchAllAssets } = useCapitalAssets();
  const { refetchMorBalance } = useCapitalMORBalance();
  const { setActiveModal } = useCapitalUI();

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

  // --- Transaction Success Tracking (prevents repeated toasts) ---
  const lastHandledApprovalHashRef = useRef<string | undefined>(undefined);
  const lastHandledStakeHashRef = useRef<string | undefined>(undefined);
  const lastHandledClaimHashRef = useRef<string | undefined>(undefined);
  const lastHandledWithdrawHashRef = useRef<string | undefined>(undefined);
  const lastHandledLockClaimHashRef = useRef<string | undefined>(undefined);

  // --- Transaction Helper ---
  const handleTransaction = useCallback(async (
    txFunction: () => Promise<`0x${string}`>,
    options: { loading: string; success: string; error: string; skipClose?: boolean }
  ) => {
    const toastId = options.loading;

    let safeWalletUrl: string | null = null;
    if (userAddress && l1ChainId) {
      try {
        safeWalletUrl = await getSafeWalletUrlIfApplicable(userAddress, l1ChainId);
      } catch (error) {
        console.warn("Failed to check if wallet is Safe:", error);
      }
    }

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
      return hash;
    } catch (error) {
      console.error(options.error, error);
      toast.dismiss(toastId);

      const detailedError = error as {
        shortMessage?: string;
        message?: string;
      };

      const errorMessage = detailedError?.shortMessage || detailedError?.message || "Transaction failed";
      toast.error(options.error, { description: errorMessage });
      throw error;
    }
  }, [userAddress, l1ChainId]);

  // --- Approval Success Effect ---
  useEffect(() => {
    if (isApprovalSuccess && approveHash && approveHash !== lastHandledApprovalHashRef.current) {
      toast.success("Approval successful!", { description: "You can now proceed with your deposit." });
      Object.values(assetContractData).forEach(asset => asset.refetch.allowance());
      lastHandledApprovalHashRef.current = approveHash;
    }
  }, [isApprovalSuccess, approveHash, assetContractData]);

  // --- Stake Success Effect ---
  useEffect(() => {
    if (isStakeSuccess && stakeHash && stakeHash !== lastHandledStakeHashRef.current) {
      toast.success("Deposit successful!");
      refetchAllAssets();
      if (typeof window !== 'undefined' && (window as unknown as { refreshMORBalances?: () => void }).refreshMORBalances) {
        (window as unknown as { refreshMORBalances: () => void }).refreshMORBalances();
      }
      lastHandledStakeHashRef.current = stakeHash;
      setActiveModal(null);
    }
  }, [isStakeSuccess, stakeHash, refetchAllAssets, setActiveModal]);

  // --- Claim Success Effect ---
  useEffect(() => {
    if (isClaimSuccess && claimHash && claimHash !== lastHandledClaimHashRef.current) {
      toast.success("Claim successful!");
      Object.values(assetContractData).forEach(asset => asset.refetch.rewards());
      refetchMorBalance();
      if (typeof window !== 'undefined' && (window as unknown as { refreshMORBalances?: () => void }).refreshMORBalances) {
        (window as unknown as { refreshMORBalances: () => void }).refreshMORBalances();
      }
      lastHandledClaimHashRef.current = claimHash;
      setActiveModal(null);
    }
  }, [isClaimSuccess, claimHash, assetContractData, refetchMorBalance, setActiveModal]);

  // --- Withdraw Success Effect ---
  useEffect(() => {
    if (isWithdrawSuccess && withdrawHash && withdrawHash !== lastHandledWithdrawHashRef.current) {
      toast.success("Withdrawal successful!");
      refetchAllAssets();
      if (typeof window !== 'undefined' && (window as unknown as { refreshMORBalances?: () => void }).refreshMORBalances) {
        (window as unknown as { refreshMORBalances: () => void }).refreshMORBalances();
      }
      lastHandledWithdrawHashRef.current = withdrawHash;
      setActiveModal(null);
    }
  }, [isWithdrawSuccess, withdrawHash, refetchAllAssets, setActiveModal]);

  // --- Lock Claim Success Effect ---
  useEffect(() => {
    if (isLockClaimSuccess && lockClaimHash && lockClaimHash !== lastHandledLockClaimHashRef.current) {
      toast.success("Lock change successful!");
      Object.values(assetContractData).forEach(asset => asset.refetch.multiplier());
      lastHandledLockClaimHashRef.current = lockClaimHash;
      setActiveModal(null);
    }
  }, [isLockClaimSuccess, lockClaimHash, assetContractData, setActiveModal]);

  // --- Action: Approve Token ---
  const approveToken = useCallback(async (asset: AssetSymbol) => {
    const assetInfo = getAssetConfig(asset, networkEnv);
    if (!assetInfo) throw new Error(`Asset ${asset} not supported`);
    if (!l1ChainId || !distributorV2Address) throw new Error("Network not ready");

    await handleTransaction(() => {
      return approveAsync({
        address: assetInfo.address,
        abi: ERC20Abi,
        functionName: "approve",
        args: [distributorV2Address, BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")],
        chainId: l1ChainId,
      });
    }, {
      loading: `Requesting ${asset} approval...`,
      success: `${asset} approved!`,
      error: `${asset} approval failed`,
      skipClose: true
    });
  }, [approveAsync, l1ChainId, networkEnv, distributorV2Address, handleTransaction]);

  // --- Action: Deposit ---
  const deposit = useCallback(async (asset: AssetSymbol, amountString: string, lockDurationSeconds?: bigint, referrerAddress?: string) => {
    const assetInfo = getAssetConfig(asset, networkEnv);
    if (!assetInfo) throw new Error(`Asset ${asset} not supported on ${networkEnv}`);

    const assetData = assets[asset];
    if (!assetData) throw new Error(`Asset ${asset} data not available`);

    const amountBigInt = parseUnits(amountString, assetInfo.metadata.decimals);
    if (amountBigInt <= BigInt(0)) throw new Error("Invalid deposit amount");

    if (assetData.config.depositPoolAddress === zeroAddress) {
      throw new Error(`${asset} deposits not yet supported. Deposit pool contract not deployed.`);
    }

    if (assetData.userBalance <= BigInt(0)) {
      throw new Error(`No ${asset} balance available`);
    }

    if (amountBigInt > assetData.userBalance) {
      throw new Error(`Insufficient ${asset} balance. Required: ${formatBigInt(amountBigInt, assetInfo.metadata.decimals, 4)}, Available: ${assetData.userBalanceFormatted}`);
    }

    if (assetData.userAllowance < amountBigInt) {
      throw new Error(`Insufficient ${asset} allowance. Please approve ${asset} spending first.`);
    }

    if (!l1ChainId) throw new Error("Chain ID not available");

    const MINIMUM_CLAIM_LOCK_PERIOD = BigInt(90 * 24 * 60 * 60);
    const lockDuration = lockDurationSeconds || MINIMUM_CLAIM_LOCK_PERIOD;

    const finalReferrerAddress = (referrerAddress && isAddress(referrerAddress))
      ? referrerAddress as `0x${string}`
      : zeroAddress;

    await handleTransaction(() => {
      const claimLockEnd = BigInt(Math.floor(Date.now() / 1000)) + lockDuration;

      return stakeAsync({
        address: assetData.config.depositPoolAddress,
        abi: DepositPoolAbi,
        functionName: "stake",
        args: [V2_REWARD_POOL_INDEX, amountBigInt, claimLockEnd, finalReferrerAddress],
        chainId: l1ChainId,
      });
    }, {
      loading: `Requesting ${asset} deposit...`,
      success: `Successfully deposited ${amountString} ${asset}!`,
      error: `${asset} deposit failed`
    });
  }, [stakeAsync, l1ChainId, networkEnv, assets, handleTransaction]);

  // --- Action: Withdraw ---
  const withdraw = useCallback(async (asset: AssetSymbol, amountString: string) => {
    const assetInfo = getAssetConfig(asset, networkEnv);
    if (!assetInfo) throw new Error(`Asset ${asset} not supported`);

    const assetData = assets[asset];
    if (!assetData) throw new Error(`Asset ${asset} data not available`);

    // Refresh data before validation
    assetContractData[asset]?.refetch.userData();
    // Small delay to allow refetch to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    const amountBigInt = parseUnits(amountString, assetInfo.metadata.decimals);
    if (amountBigInt <= BigInt(0)) throw new Error("Invalid withdrawal amount");

    if (assetData.userDeposited <= BigInt(0)) {
      throw new Error(`No ${asset} deposited balance available`);
    }

    if (amountBigInt > assetData.userDeposited) {
      throw new Error(`Insufficient ${asset} deposited balance.`);
    }

    if (!l1ChainId) throw new Error("Chain ID not available");

    await handleTransaction(() => {
      return withdrawAsync({
        address: assetData.config.depositPoolAddress,
        abi: DepositPoolAbi,
        functionName: "withdraw",
        args: [V2_REWARD_POOL_INDEX, amountBigInt],
        chainId: l1ChainId,
      });
    }, {
      loading: `Requesting ${asset} withdrawal...`,
      success: `Successfully withdrew ${amountString} ${asset}!`,
      error: `${asset} withdrawal failed`
    });
  }, [withdrawAsync, l1ChainId, networkEnv, assets, handleTransaction, assetContractData]);

  // --- Action: Claim ---
  const claim = useCallback(async (asset: AssetSymbol) => {
    const assetData = assets[asset];
    if (!assetData) throw new Error(`Asset ${asset} data not available`);

    if (assetData.claimableAmount <= BigInt(0)) {
      throw new Error(`No ${asset} rewards available to claim`);
    }

    if (!l1ChainId) throw new Error("Chain ID not available");

    await handleTransaction(() => {
      return claimAsync({
        address: assetData.config.depositPoolAddress,
        abi: DepositPoolAbi,
        functionName: "claim",
        args: [V2_REWARD_POOL_INDEX, userAddress],
        chainId: l1ChainId,
      });
    }, {
      loading: `Requesting ${asset} reward claim...`,
      success: `Successfully claimed ${asset} rewards!`,
      error: `${asset} claim failed`
    });
  }, [claimAsync, l1ChainId, assets, handleTransaction, userAddress]);

  // --- Action: Change Lock ---
  const changeLock = useCallback(async (asset: AssetSymbol, lockValue: string, lockUnit: TimeUnit) => {
    const assetData = assets[asset];
    if (!assetData) throw new Error(`Asset ${asset} data not available`);

    if (assetData.claimableAmount <= BigInt(0)) {
      throw new Error(`No ${asset} rewards available to lock`);
    }

    if (!l1ChainId) throw new Error("Chain ID not available");

    const lockDurationSeconds = durationToSeconds(lockValue, lockUnit);
    const newClaimLockEnd = BigInt(Math.floor(Date.now() / 1000)) + lockDurationSeconds;

    await handleTransaction(() => {
      return lockClaimAsync({
        address: assetData.config.depositPoolAddress,
        abi: DepositPoolAbi,
        functionName: "lockClaim",
        args: [V2_REWARD_POOL_INDEX, newClaimLockEnd],
        chainId: l1ChainId,
      });
    }, {
      loading: `Requesting lock change for ${asset}...`,
      success: `Successfully updated ${asset} lock period!`,
      error: `${asset} lock change failed`
    });
  }, [lockClaimAsync, l1ChainId, assets, handleTransaction]);

  // --- Combined Processing States ---
  const isProcessingDeposit = isSendingStake || isConfirmingStake;
  const isProcessingWithdraw = isSendingWithdraw || isConfirmingWithdraw;
  const isProcessingClaim = isSendingClaim || isConfirmingClaim;
  const isProcessingChangeLock = isSendingLockClaim || isConfirmingLockClaim;
  const isProcessingApproval = isSendingApproval || isConfirmingApproval;

  // Memoized context value
  const value = useMemo<CapitalTransactionsState>(
    () => ({
      // Actions
      deposit,
      withdraw,
      claim,
      approveToken,
      changeLock,

      // Hashes
      approveHash,
      stakeHash,
      claimHash,
      withdrawHash,
      lockClaimHash,

      // Sending states
      isSendingApproval,
      isSendingStake,
      isSendingClaim,
      isSendingWithdraw,
      isSendingLockClaim,

      // Confirming states
      isConfirmingApproval,
      isConfirmingStake,
      isConfirmingClaim,
      isConfirmingWithdraw,
      isConfirmingLockClaim,

      // Success states
      isApprovalSuccess,
      isStakeSuccess,
      isClaimSuccess,
      isWithdrawSuccess,
      isLockClaimSuccess,

      // Combined states
      isProcessingDeposit,
      isProcessingWithdraw,
      isProcessingClaim,
      isProcessingChangeLock,
      isProcessingApproval,
    }),
    [
      deposit,
      withdraw,
      claim,
      approveToken,
      changeLock,
      approveHash,
      stakeHash,
      claimHash,
      withdrawHash,
      lockClaimHash,
      isSendingApproval,
      isSendingStake,
      isSendingClaim,
      isSendingWithdraw,
      isSendingLockClaim,
      isConfirmingApproval,
      isConfirmingStake,
      isConfirmingClaim,
      isConfirmingWithdraw,
      isConfirmingLockClaim,
      isApprovalSuccess,
      isStakeSuccess,
      isClaimSuccess,
      isWithdrawSuccess,
      isLockClaimSuccess,
      isProcessingDeposit,
      isProcessingWithdraw,
      isProcessingClaim,
      isProcessingChangeLock,
      isProcessingApproval,
    ]
  );

  return (
    <CapitalTransactionsContext.Provider value={value}>
      {children}
    </CapitalTransactionsContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useCapitalTransactions(): CapitalTransactionsState {
  const context = useContext(CapitalTransactionsContext);
  if (!context) {
    throw new Error("useCapitalTransactions must be used within a CapitalTransactionsProvider");
  }
  return context;
}

// ============================================================================
// Selective Hooks
// ============================================================================

/**
 * Get deposit-related state and actions
 */
export function useDepositTransaction() {
  const { deposit, approveToken, isProcessingDeposit, isProcessingApproval, isStakeSuccess, isApprovalSuccess } = useCapitalTransactions();
  return { deposit, approveToken, isProcessingDeposit, isProcessingApproval, isStakeSuccess, isApprovalSuccess };
}

/**
 * Get withdraw-related state and actions
 */
export function useWithdrawTransaction() {
  const { withdraw, isProcessingWithdraw, isWithdrawSuccess } = useCapitalTransactions();
  return { withdraw, isProcessingWithdraw, isWithdrawSuccess };
}

/**
 * Get claim-related state and actions
 */
export function useClaimTransaction() {
  const { claim, isProcessingClaim, isClaimSuccess } = useCapitalTransactions();
  return { claim, isProcessingClaim, isClaimSuccess };
}

/**
 * Get lock change state and actions
 */
export function useLockTransaction() {
  const { changeLock, isProcessingChangeLock, isLockClaimSuccess } = useCapitalTransactions();
  return { changeLock, isProcessingChangeLock, isLockClaimSuccess };
}

/**
 * Get all processing states
 */
export function useTransactionProcessingStates() {
  const {
    isProcessingDeposit,
    isProcessingWithdraw,
    isProcessingClaim,
    isProcessingChangeLock,
    isProcessingApproval,
  } = useCapitalTransactions();
  return {
    isProcessingDeposit,
    isProcessingWithdraw,
    isProcessingClaim,
    isProcessingChangeLock,
    isProcessingApproval,
    isProcessingAny: isProcessingDeposit || isProcessingWithdraw || isProcessingClaim || isProcessingChangeLock || isProcessingApproval,
  };
}
