"use client";

/**
 * Hook for handling capital pool transactions
 * Manages all write operations and transaction lifecycle
 */

import { useState, useCallback, useEffect } from "react";
import { useWriteContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import { parseUnits, zeroAddress, maxInt256, isAddress, type BaseError } from "viem";
import { toast } from "sonner";

import type { NetworkEnvironment } from "@/config/networks";
import { getAssetConfig, type AssetSymbol } from "@/components/capital/constants/asset-config";
import type { AssetData, TimeUnit } from "@/context/capital/types";
import type { AssetContractData } from "@/hooks/use-asset-contract-data";
import type { CapitalPoolData } from "@/hooks/use-capital-pool-data";
import type { ReferralAssetConfig } from "@/hooks/capital/use-capital-referrals";
import {
  V2_REWARD_POOL_INDEX,
  MINIMUM_CLAIM_LOCK_PERIOD,
  ETH_FOR_CROSS_CHAIN_GAS,
  GAS_LIMIT_CLAIM,
  GAS_LIMIT_LOCK,
  GAS_LIMIT_REFERRAL_CLAIM,
  GAS_LIMIT_WITHDRAW,
  PUBLIC_POOL_ID,
} from "@/context/capital/constants";
import { durationToSeconds } from "@/lib/utils/capital-helpers";
import { formatBigInt } from "@/lib/utils/formatters";
import { getSafeWalletUrlIfApplicable } from "@/lib/utils/safe-wallet-detection";
import { getTransactionUrl, isMainnetChain } from "@/lib/utils/transaction-utils";

// Import ABIs
import ERC20Abi from "@/app/abi/ERC20.json";
import DepositPoolAbi from "@/app/abi/DepositPool.json";

interface TransactionOptions {
  loading: string;
  success: string;
  error: string;
  skipClose?: boolean;
}

export interface CapitalTransactionsOptions {
  userAddress?: `0x${string}`;
  l1ChainId: number;
  networkEnv: NetworkEnvironment;
  assets: Record<AssetSymbol, AssetData>;
  selectedAsset: AssetSymbol;
  assetContractData: Record<AssetSymbol, AssetContractData>;
  capitalPoolData: CapitalPoolData;
  referralAssetConfigMap: Map<AssetSymbol, ReferralAssetConfig>;
  referralRewardsByAsset: Partial<Record<AssetSymbol, bigint>>;
  distributorV2Address?: `0x${string}`;
  onModalClose: () => void;
  onFirstDeposit: () => void;
  refetchUserData: () => void;
  refetchUserReward: () => void;
  refetchUserMultiplier: () => void;
  refetchMorBalance: () => void;
}

export interface CapitalTransactionsResult {
  // Transaction hashes
  approveHash: `0x${string}` | undefined;
  stakeHash: `0x${string}` | undefined;
  claimHash: `0x${string}` | undefined;
  withdrawHash: `0x${string}` | undefined;
  lockClaimHash: `0x${string}` | undefined;

  // Processing states
  isProcessingDeposit: boolean;
  isProcessingClaim: boolean;
  isProcessingWithdraw: boolean;
  isProcessingChangeLock: boolean;

  // Success states
  isApprovalSuccess: boolean;
  isClaimSuccess: boolean;
  lastHandledClaimHash: `0x${string}` | null;

  // Action functions
  approveToken: (asset: AssetSymbol) => Promise<void>;
  deposit: (asset: AssetSymbol, amount: string, lockDurationSeconds?: bigint, referrerAddress?: string) => Promise<void>;
  withdraw: (asset: AssetSymbol, amount: string) => Promise<void>;
  claim: () => Promise<void>;
  changeLock: (lockValue: string, lockUnit: TimeUnit) => Promise<void>;
  claimAssetRewards: (asset: AssetSymbol) => Promise<void>;
  lockAssetRewards: (asset: AssetSymbol, lockDurationSeconds: bigint) => Promise<void>;
  claimReferralRewards: (asset?: AssetSymbol) => Promise<void>;
}

export function useCapitalTransactions(options: CapitalTransactionsOptions): CapitalTransactionsResult {
  const {
    userAddress,
    l1ChainId,
    networkEnv,
    assets,
    selectedAsset,
    assetContractData,
    capitalPoolData,
    referralAssetConfigMap,
    referralRewardsByAsset,
    distributorV2Address,
    onModalClose,
    onFirstDeposit,
    refetchUserData,
    refetchUserReward,
    refetchUserMultiplier,
    refetchMorBalance,
  } = options;

  const publicClient = usePublicClient();
  const poolAbi = DepositPoolAbi;

  // --- Write Hooks ---
  const { data: approveHash, writeContractAsync: approveAsync, isPending: isSendingApproval } = useWriteContract();
  const { data: stakeHash, writeContractAsync: stakeAsync, isPending: isSendingStake } = useWriteContract();
  const { data: claimHash, writeContractAsync: claimAsync, isPending: isSendingClaim } = useWriteContract();
  const { data: withdrawHash, writeContractAsync: withdrawAsync, isPending: isSendingWithdraw } = useWriteContract();
  const { data: lockClaimHash, writeContractAsync: lockClaimAsync, isPending: isSendingLockClaim } = useWriteContract();

  // --- Transaction Monitoring ---
  const {
    isLoading: isConfirmingApproval,
    isSuccess: isApprovalSuccess,
    isError: isApprovalError,
    error: approvalError,
  } = useWaitForTransactionReceipt({ hash: approveHash, chainId: l1ChainId });

  const {
    isLoading: isConfirmingStake,
    isSuccess: isStakeSuccess,
    isError: isStakeError,
    error: stakeError,
  } = useWaitForTransactionReceipt({ hash: stakeHash, chainId: l1ChainId });

  const {
    isLoading: isConfirmingClaim,
    isSuccess: isClaimSuccess,
    isError: isClaimError,
    error: claimError,
  } = useWaitForTransactionReceipt({ hash: claimHash, chainId: l1ChainId });

  const {
    isLoading: isConfirmingWithdraw,
    isSuccess: isWithdrawSuccess,
    isError: isWithdrawError,
    error: withdrawError,
  } = useWaitForTransactionReceipt({ hash: withdrawHash, chainId: l1ChainId });

  const {
    isLoading: isConfirmingLockClaim,
    isSuccess: isLockClaimSuccess,
    isError: isLockClaimError,
    error: lockClaimError,
  } = useWaitForTransactionReceipt({ hash: lockClaimHash, chainId: l1ChainId });

  // --- Transaction Hash Tracking State ---
  const [lastHandledApprovalHash, setLastHandledApprovalHash] = useState<`0x${string}` | null>(null);
  const [lastHandledStakeHash, setLastHandledStakeHash] = useState<`0x${string}` | null>(null);
  const [lastHandledClaimHash, setLastHandledClaimHash] = useState<`0x${string}` | null>(null);
  const [lastHandledWithdrawHash, setLastHandledWithdrawHash] = useState<`0x${string}` | null>(null);
  const [lastHandledLockClaimHash, setLastHandledLockClaimHash] = useState<`0x${string}` | null>(null);
  const [pendingFirstDeposit, setPendingFirstDeposit] = useState<boolean>(false);

  // --- Processing States ---
  const isProcessingDeposit = isSendingApproval || isConfirmingApproval || isSendingStake || isConfirmingStake;
  const isProcessingClaim = isSendingClaim || isConfirmingClaim;
  const isProcessingWithdraw = isSendingWithdraw || isConfirmingWithdraw;
  const isProcessingChangeLock = isSendingLockClaim || isConfirmingLockClaim;

  // --- Reset tracking when new transactions start ---
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

  // --- Generic Transaction Handler ---
  const handleTransaction = useCallback(
    async (txFunction: () => Promise<`0x${string}`>, txOptions: TransactionOptions) => {
      const toastId = txOptions.loading;

      let safeWalletUrl: string | null = null;
      if (userAddress && l1ChainId) {
        try {
          safeWalletUrl = await getSafeWalletUrlIfApplicable(userAddress, l1ChainId);
        } catch (error) {
          console.error("Failed to check if wallet is Safe:", error);
        }
      }

      if (safeWalletUrl) {
        toast.loading(txOptions.loading, {
          id: toastId,
          description: "If the transaction doesn't appear, check your Safe wallet.",
          action: {
            label: "Open Safe Wallet",
            onClick: () => window.open(safeWalletUrl, "_blank"),
          },
        });
      } else {
        toast.loading(txOptions.loading, { id: toastId });
      }

      try {
        const hash = await txFunction();
        toast.dismiss(toastId);
        return hash;
      } catch (error) {
        console.error(txOptions.error, error);
        toast.dismiss(toastId);

        const detailedError = error as {
          cause?: { reason?: string; data?: unknown };
          message?: string;
          shortMessage?: string;
        };

        const errorMessage = detailedError?.shortMessage || detailedError?.message || "Unknown error";
        toast.error(txOptions.error, {
          description: errorMessage,
          duration: 5000,
          style: {
            background: "hsl(var(--destructive))",
            color: "hsl(var(--destructive-foreground))",
            border: "1px solid hsl(var(--destructive))",
          },
        });
        throw error;
      }
    },
    [userAddress, l1ChainId]
  );

  // --- Action Functions ---
  const approveToken = useCallback(
    async (asset: AssetSymbol) => {
      if (!distributorV2Address || !l1ChainId) {
        throw new Error("Distributor address or chain ID not available");
      }

      const assetInfo = getAssetConfig(asset, networkEnv);
      if (!assetInfo) {
        throw new Error(`Asset ${asset} not supported on ${networkEnv}`);
      }

      await handleTransaction(
        () =>
          approveAsync({
            address: assetInfo.address,
            abi: ERC20Abi,
            functionName: "approve",
            args: [distributorV2Address, maxInt256],
            chainId: l1ChainId,
          }),
        {
          loading: `Requesting ${asset} approval...`,
          success: `${asset} approval successful!`,
          error: `${asset} approval failed`,
          skipClose: true,
        }
      );
    },
    [approveAsync, distributorV2Address, l1ChainId, networkEnv, handleTransaction]
  );

  const deposit = useCallback(
    async (asset: AssetSymbol, amountString: string, lockDurationSeconds?: bigint, referrerAddress?: string) => {
      const assetInfo = getAssetConfig(asset, networkEnv);
      if (!assetInfo) {
        throw new Error(`Asset ${asset} not supported on ${networkEnv}`);
      }

      const assetData = assets[asset];
      if (!assetData) {
        throw new Error(`Asset ${asset} data not available`);
      }

      const amountBigInt = parseUnits(amountString, assetInfo.metadata.decimals);
      if (amountBigInt <= BigInt(0)) throw new Error("Invalid deposit amount");

      if (assetData.config.depositPoolAddress === zeroAddress) {
        throw new Error(`${asset} deposits not yet supported. Deposit pool contract not deployed.`);
      }

      if (assetData.userBalance <= BigInt(0)) {
        throw new Error(`No ${asset} balance available`);
      }

      if (amountBigInt > assetData.userBalance) {
        throw new Error(
          `Insufficient ${asset} balance. Required: ${formatBigInt(amountBigInt, assetInfo.metadata.decimals, 4)}, Available: ${assetData.userBalanceFormatted}`
        );
      }

      if (assetData.userAllowance < amountBigInt) {
        throw new Error(
          `Insufficient ${asset} allowance. Please approve ${asset} spending first.`
        );
      }

      if (!l1ChainId) throw new Error("Chain ID not available");

      const lockDuration = lockDurationSeconds || MINIMUM_CLAIM_LOCK_PERIOD;
      const finalReferrerAddress =
        referrerAddress && isAddress(referrerAddress) ? (referrerAddress as `0x${string}`) : zeroAddress;

      const wasNonDepositor = Object.values(assets).every((a) => a.userDeposited <= BigInt(0));
      if (wasNonDepositor) {
        setPendingFirstDeposit(true);
      }

      await handleTransaction(
        () => {
          const claimLockEnd = BigInt(Math.floor(Date.now() / 1000)) + lockDuration;

          return stakeAsync({
            address: assetData.config.depositPoolAddress,
            abi: DepositPoolAbi,
            functionName: "stake",
            args: [V2_REWARD_POOL_INDEX, amountBigInt, claimLockEnd, finalReferrerAddress],
            chainId: l1ChainId,
          });
        },
        {
          loading: `Requesting ${asset} deposit...`,
          success: `Successfully deposited ${amountString} ${asset}!`,
          error: `${asset} deposit failed`,
        }
      );
    },
    [stakeAsync, l1ChainId, networkEnv, assets, handleTransaction]
  );

  const withdraw = useCallback(
    async (asset: AssetSymbol, amountString: string) => {
      const assetInfo = getAssetConfig(asset, networkEnv);
      if (!assetInfo) {
        throw new Error(`Asset ${asset} not supported on ${networkEnv}`);
      }

      await assetContractData[asset]?.refetch.userData();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const assetData = assets[asset];
      if (!assetData) {
        throw new Error(`Asset ${asset} data not available`);
      }

      const amountBigInt = parseUnits(amountString, assetInfo.metadata.decimals);
      if (amountBigInt <= BigInt(0)) throw new Error("Invalid withdraw amount");

      if (assetData.config.depositPoolAddress === zeroAddress) {
        throw new Error(`${asset} withdrawals not yet supported.`);
      }

      if (!l1ChainId) throw new Error("Chain ID not available");

      if (!assetData.canWithdraw) {
        throw new Error(`${asset} withdrawal not allowed yet.`);
      }

      if (assetData.userDeposited <= BigInt(0)) {
        throw new Error(`No ${asset} deposited balance available`);
      }

      if (amountBigInt > assetData.userDeposited) {
        throw new Error(
          `Insufficient ${asset} deposited balance.`
        );
      }

      if (!userAddress) {
        throw new Error("No wallet connected.");
      }

      // Simulate before executing
      try {
        await publicClient?.simulateContract({
          address: assetData.config.depositPoolAddress,
          abi: DepositPoolAbi,
          functionName: "withdraw",
          args: [V2_REWARD_POOL_INDEX, amountBigInt],
          account: userAddress,
        });
      } catch (simulationError: unknown) {
        const error = simulationError as { cause?: { reason?: string }; message?: string; shortMessage?: string };
        const contractError = error?.cause?.reason || error?.shortMessage || error?.message;
        throw new Error(`Contract simulation failed: ${contractError}`);
      }

      await handleTransaction(
        async () => {
          return withdrawAsync({
            address: assetData.config.depositPoolAddress,
            abi: DepositPoolAbi,
            functionName: "withdraw",
            args: [V2_REWARD_POOL_INDEX, amountBigInt],
            chainId: l1ChainId,
            gas: GAS_LIMIT_WITHDRAW,
          });
        },
        {
          loading: `Requesting ${asset} withdrawal...`,
          success: `Successfully withdrew ${amountString} ${asset}!`,
          error: `${asset} withdrawal failed`,
        }
      );
    },
    [withdrawAsync, l1ChainId, networkEnv, assets, handleTransaction, userAddress, assetContractData, publicClient]
  );

  const claim = useCallback(async () => {
    if (!l1ChainId || !userAddress) throw new Error("Claim prerequisites not met");

    const currentAssetData = assets[selectedAsset];
    if (!currentAssetData || !currentAssetData.canClaim) {
      throw new Error(`${selectedAsset} claim prerequisites not met or no rewards available`);
    }

    await handleTransaction(
      () =>
        claimAsync({
          address: currentAssetData.config.depositPoolAddress,
          abi: poolAbi,
          functionName: "claim",
          args: [PUBLIC_POOL_ID, userAddress],
          chainId: l1ChainId,
        }),
      {
        loading: `Requesting ${selectedAsset} claim...`,
        success: `Successfully claimed MOR from ${selectedAsset} pool!`,
        error: `${selectedAsset} claim failed`,
      }
    );
  }, [claimAsync, l1ChainId, userAddress, assets, selectedAsset, handleTransaction, poolAbi]);

  const changeLock = useCallback(
    async (lockValue: string, lockUnit: TimeUnit) => {
      if (!l1ChainId) throw new Error("Change lock prerequisites not met");

      const currentAssetData = assets[selectedAsset];
      if (!currentAssetData) {
        throw new Error(`${selectedAsset} data not available for lock change`);
      }

      const durationSeconds = durationToSeconds(lockValue, lockUnit);
      if (durationSeconds <= BigInt(0)) throw new Error("Invalid lock duration");
      const finalLockEndTimestamp = BigInt(Math.floor(Date.now() / 1000)) + durationSeconds;

      await handleTransaction(
        () =>
          lockClaimAsync({
            address: currentAssetData.config.depositPoolAddress,
            abi: poolAbi,
            functionName: "lockClaim",
            args: [PUBLIC_POOL_ID, finalLockEndTimestamp],
            chainId: l1ChainId,
          }),
        {
          loading: `Requesting ${selectedAsset} lock change...`,
          success: `Successfully updated ${selectedAsset} lock period!`,
          error: `${selectedAsset} lock update failed`,
        }
      );
    },
    [lockClaimAsync, l1ChainId, assets, selectedAsset, handleTransaction, poolAbi]
  );

  const claimAssetRewards = useCallback(
    async (asset: AssetSymbol) => {
      if (!userAddress || !l1ChainId) throw new Error("Claim prerequisites not met");

      const assetData = assets[asset];
      if (!assetData) {
        throw new Error(`${asset} data not available`);
      }

      if (!assetData.canClaim || assetData.claimableAmount <= BigInt(0)) {
        throw new Error(`${asset} claim prerequisites not met or no rewards available`);
      }

      const targetAddress = assetData.config.depositPoolAddress;

      await handleTransaction(
        () =>
          claimAsync({
            address: targetAddress,
            abi: DepositPoolAbi,
            functionName: "claim",
            args: [V2_REWARD_POOL_INDEX, userAddress],
            chainId: l1ChainId,
            value: ETH_FOR_CROSS_CHAIN_GAS,
            gas: GAS_LIMIT_CLAIM,
          }),
        {
          loading: `Claiming ${asset} rewards...`,
          success: `Successfully claimed ${asset} rewards!`,
          error: `${asset} claim failed`,
        }
      );
    },
    [claimAsync, assets, l1ChainId, userAddress, handleTransaction]
  );

  const lockAssetRewards = useCallback(
    async (asset: AssetSymbol, lockDurationSeconds: bigint) => {
      if (!userAddress || !l1ChainId) throw new Error("Lock claim prerequisites not met");

      const assetData = assets[asset];
      if (!assetData) {
        throw new Error(`${asset} data not available`);
      }

      const targetAddress = assetData.config.depositPoolAddress;
      const lockEndTimestamp = BigInt(Math.floor(Date.now() / 1000)) + lockDurationSeconds;

      await handleTransaction(
        () =>
          lockClaimAsync({
            address: targetAddress,
            abi: DepositPoolAbi,
            functionName: "lockClaim",
            args: [V2_REWARD_POOL_INDEX, lockEndTimestamp],
            chainId: l1ChainId,
            gas: GAS_LIMIT_LOCK,
          }),
        {
          loading: `Locking ${asset} rewards...`,
          success: `Successfully locked ${asset} rewards!`,
          error: `${asset} lock failed`,
        }
      );
    },
    [lockClaimAsync, assets, l1ChainId, userAddress, handleTransaction]
  );

  const claimReferralRewards = useCallback(
    async (asset?: AssetSymbol) => {
      if (!userAddress || !l1ChainId) throw new Error("Referral claim prerequisites not met");

      const targetAssets = asset ? [asset] : Array.from(referralAssetConfigMap.keys());

      if (asset && !referralAssetConfigMap.has(asset)) {
        throw new Error(`${asset} referral claim prerequisites not met`);
      }

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

        await handleTransaction(
          () =>
            claimAsync({
              address: config.depositPoolAddress,
              abi: DepositPoolAbi,
              functionName: "claimReferrerTier",
              args: [V2_REWARD_POOL_INDEX, userAddress],
              chainId: l1ChainId,
              gas: GAS_LIMIT_REFERRAL_CLAIM,
            }),
          {
            loading: `Claiming ${symbol} referral rewards...`,
            success: `Successfully claimed ${symbol} referral rewards!`,
            error: `${symbol} referral claim failed`,
          }
        );

        claimedAny = true;
      }

      if (asset && !claimedAny) {
        throw new Error(`${asset} referral claim prerequisites not met`);
      }
    },
    [claimAsync, handleTransaction, l1ChainId, referralAssetConfigMap, referralRewardsByAsset, userAddress]
  );

  // --- Transaction Success Effects ---
  useEffect(() => {
    if (isApprovalSuccess && approveHash && approveHash !== lastHandledApprovalHash) {
      const txUrl = l1ChainId && isMainnetChain(l1ChainId) ? getTransactionUrl(l1ChainId, approveHash) : null;

      toast.success("Approval successful!", {
        description: "Your approval transaction has been confirmed",
        action: txUrl
          ? {
              label: "View Transaction",
              onClick: () => window.open(txUrl, "_blank"),
            }
          : undefined,
        duration: 5000,
      });

      Object.values(assetContractData).forEach((asset) => asset.refetch.allowance());
      setLastHandledApprovalHash(approveHash);
    }
  }, [isApprovalSuccess, approveHash, lastHandledApprovalHash, l1ChainId, assetContractData]);

  useEffect(() => {
    if (isStakeSuccess && stakeHash && stakeHash !== lastHandledStakeHash) {
      const txUrl = l1ChainId && isMainnetChain(l1ChainId) ? getTransactionUrl(l1ChainId, stakeHash) : null;

      toast.success("Stake confirmed!", {
        description: "Your stake transaction has been confirmed",
        action: txUrl
          ? {
              label: "View Transaction",
              onClick: () => window.open(txUrl, "_blank"),
            }
          : undefined,
        duration: 5000,
      });

      if (pendingFirstDeposit) {
        onFirstDeposit();
        setPendingFirstDeposit(false);
      }

      refetchUserData();
      refetchUserReward();
      Object.values(assetContractData).forEach((asset) => asset.refetch.all());
      capitalPoolData.refetch.refetchAll();

      if (typeof window !== "undefined" && window.refreshMORBalances) {
        window.refreshMORBalances();
      }

      setLastHandledStakeHash(stakeHash);
      onModalClose();
    }
  }, [
    isStakeSuccess,
    stakeHash,
    lastHandledStakeHash,
    refetchUserData,
    refetchUserReward,
    capitalPoolData.refetch,
    onModalClose,
    assetContractData,
    l1ChainId,
    pendingFirstDeposit,
    onFirstDeposit,
  ]);

  useEffect(() => {
    if (isClaimSuccess && claimHash && claimHash !== lastHandledClaimHash) {
      const txUrl = l1ChainId && isMainnetChain(l1ChainId) ? getTransactionUrl(l1ChainId, claimHash) : null;

      toast.success("Claim confirmed!", {
        description: "Your claim transaction has been confirmed",
        action: txUrl
          ? {
              label: "View Transaction",
              onClick: () => window.open(txUrl, "_blank"),
            }
          : undefined,
        duration: 5000,
      });

      onModalClose();
      refetchUserData();
      refetchUserReward();
      refetchMorBalance();
      Object.values(assetContractData).forEach((asset) => asset.refetch.rewards());
      capitalPoolData.refetch.rewardPoolData();

      if (typeof window !== "undefined" && window.refreshMORBalances) {
        window.refreshMORBalances();
      }

      setLastHandledClaimHash(claimHash);
    }
  }, [
    isClaimSuccess,
    claimHash,
    lastHandledClaimHash,
    refetchUserData,
    refetchUserReward,
    refetchMorBalance,
    capitalPoolData.refetch,
    onModalClose,
    assetContractData,
    l1ChainId,
  ]);

  useEffect(() => {
    if (isWithdrawSuccess && withdrawHash && withdrawHash !== lastHandledWithdrawHash) {
      const txUrl = l1ChainId && isMainnetChain(l1ChainId) ? getTransactionUrl(l1ChainId, withdrawHash) : null;

      toast.success("Withdrawal confirmed!", {
        description: "Your withdrawal transaction has been confirmed",
        action: txUrl
          ? {
              label: "View Transaction",
              onClick: () => window.open(txUrl, "_blank"),
            }
          : undefined,
        duration: 5000,
      });

      refetchUserData();
      refetchUserReward();
      Object.values(assetContractData).forEach((asset) => asset.refetch.all());
      capitalPoolData.refetch.refetchAll();

      if (typeof window !== "undefined" && window.refreshMORBalances) {
        window.refreshMORBalances();
      }

      setLastHandledWithdrawHash(withdrawHash);
      onModalClose();
    }
  }, [
    isWithdrawSuccess,
    withdrawHash,
    lastHandledWithdrawHash,
    refetchUserData,
    refetchUserReward,
    capitalPoolData.refetch,
    onModalClose,
    assetContractData,
    l1ChainId,
  ]);

  useEffect(() => {
    if (isLockClaimSuccess && lockClaimHash && lockClaimHash !== lastHandledLockClaimHash) {
      const txUrl = l1ChainId && isMainnetChain(l1ChainId) ? getTransactionUrl(l1ChainId, lockClaimHash) : null;

      toast.success("Lock period update confirmed!", {
        description: "Your lock period update transaction has been confirmed",
        action: txUrl
          ? {
              label: "View Transaction",
              onClick: () => window.open(txUrl, "_blank"),
            }
          : undefined,
        duration: 5000,
      });

      refetchUserData();
      refetchUserMultiplier();
      Object.values(assetContractData).forEach((asset) => asset.refetch.multiplier());

      setLastHandledLockClaimHash(lockClaimHash);
      onModalClose();
    }
  }, [
    isLockClaimSuccess,
    lockClaimHash,
    lastHandledLockClaimHash,
    refetchUserData,
    refetchUserMultiplier,
    onModalClose,
    assetContractData,
    l1ChainId,
  ]);

  // --- Transaction Error Effects ---
  useEffect(() => {
    if (isApprovalError && approvalError && approveHash) {
      console.error("Approval transaction failed:", approvalError);
      const errorMessage = (approvalError as BaseError)?.shortMessage || approvalError.message;
      const txUrl = l1ChainId && isMainnetChain(l1ChainId) ? getTransactionUrl(l1ChainId, approveHash) : null;

      toast.error("Approval Failed", {
        description: errorMessage,
        action: txUrl
          ? {
              label: "View Transaction",
              onClick: () => window.open(txUrl, "_blank"),
            }
          : undefined,
        duration: 5000,
      });
    }
  }, [isApprovalError, approvalError, approveHash, l1ChainId]);

  useEffect(() => {
    if (isStakeError && stakeError && stakeHash) {
      console.error("Stake transaction failed:", stakeError);

      if (pendingFirstDeposit) {
        setPendingFirstDeposit(false);
      }

      const errorMessage = (stakeError as BaseError)?.shortMessage || stakeError.message;
      const txUrl = l1ChainId && isMainnetChain(l1ChainId) ? getTransactionUrl(l1ChainId, stakeHash) : null;

      toast.error("Staking Failed", {
        description: errorMessage,
        action: txUrl
          ? {
              label: "View Transaction",
              onClick: () => window.open(txUrl, "_blank"),
            }
          : undefined,
        duration: 5000,
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
        action: txUrl
          ? {
              label: "View Transaction",
              onClick: () => window.open(txUrl, "_blank"),
            }
          : undefined,
        duration: 5000,
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
        action: txUrl
          ? {
              label: "View Transaction",
              onClick: () => window.open(txUrl, "_blank"),
            }
          : undefined,
        duration: 5000,
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
        action: txUrl
          ? {
              label: "View Transaction",
              onClick: () => window.open(txUrl, "_blank"),
            }
          : undefined,
        duration: 5000,
      });
    }
  }, [isLockClaimError, lockClaimError, lockClaimHash, l1ChainId]);

  return {
    // Transaction hashes
    approveHash,
    stakeHash,
    claimHash,
    withdrawHash,
    lockClaimHash,

    // Processing states
    isProcessingDeposit,
    isProcessingClaim,
    isProcessingWithdraw,
    isProcessingChangeLock,

    // Success states
    isApprovalSuccess,
    isClaimSuccess,
    lastHandledClaimHash,

    // Action functions
    approveToken,
    deposit,
    withdraw,
    claim,
    changeLock,
    claimAssetRewards,
    lockAssetRewards,
    claimReferralRewards,
  };
}
