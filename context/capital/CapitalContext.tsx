"use client";

/**
 * Capital Page Context
 * Orchestrates all capital pool functionality by composing specialized hooks
 */

import React, { createContext, useContext, useMemo, useState, useEffect } from "react";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { getContract, zeroAddress } from "viem";

// Import config
import {
  testnetChains,
  mainnetChains,
  getContractAddress,
  type NetworkEnvironment,
} from "@/config/networks";
import { type AssetSymbol } from "@/components/capital/constants/asset-config";

// Import types
import type { CapitalContextState, ActiveModal } from "./types";
import { TIMESTAMP_UPDATE_INTERVAL } from "./constants";

// Import utility functions
import { formatBigInt, formatTimestamp } from "@/lib/utils/formatters";
import { parseV2UserData } from "@/lib/utils/capital-helpers";

// Import hooks
import { useCapitalPoolData } from "@/hooks/use-capital-pool-data";
import { useTokenPrices } from "@/components/capital/hooks/use-token-prices";
import { useAssetContractData } from "@/hooks/use-asset-contract-data";
import { incrementLocalDepositorCount } from "@/app/hooks/useCapitalMetrics";
import { useCapitalContractReads } from "@/hooks/capital/use-capital-contract-reads";
import { useCapitalAssets } from "@/hooks/capital/use-capital-assets";
import { useCapitalReferrals } from "@/hooks/capital/use-capital-referrals";
import { useCapitalTransactions } from "@/hooks/capital/use-capital-transactions";
import { useMultiplierSimulation } from "@/hooks/capital/use-multiplier-simulation";

// Import ABIs for dynamic contracts
import ERC20Abi from "@/app/abi/ERC20.json";
import DepositPoolAbi from "@/app/abi/DepositPool.json";

// --- Create Context ---
const CapitalPageContext = createContext<CapitalContextState | null>(null);

// --- Provider Component ---
export function CapitalProvider({ children }: { children: React.ReactNode }) {
  // --- Modal State ---
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [selectedAsset, setSelectedAsset] = useState<AssetSymbol>("stETH");
  const [preReferrerAddress, setPreReferrerAddress] = useState<string>("");

  // --- Wagmi Hooks ---
  const { address: userAddress } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();

  // --- Network Environment ---
  const networkEnv = useMemo((): NetworkEnvironment => {
    return [1, 42161, 8453].includes(chainId) ? "mainnet" : "testnet";
  }, [chainId]);

  const l1ChainId = useMemo(() => {
    return networkEnv === "mainnet" ? mainnetChains.mainnet.id : testnetChains.sepolia.id;
  }, [networkEnv]);

  const l2ChainId = useMemo(() => {
    return networkEnv === "mainnet" ? mainnetChains.arbitrum.id : testnetChains.baseSepolia.id;
  }, [networkEnv]);

  // --- Contract Addresses ---
  const stETHDepositPoolAddress = useMemo(() => {
    return getContractAddress(l1ChainId, "stETHDepositPool", networkEnv) as `0x${string}` | undefined;
  }, [l1ChainId, networkEnv]);

  const stEthContractAddress = useMemo(() => {
    return getContractAddress(l1ChainId, "stETH", networkEnv) as `0x${string}` | undefined;
  }, [l1ChainId, networkEnv]);

  const morContractAddress = useMemo(() => {
    return getContractAddress(l2ChainId, "morToken", networkEnv) as `0x${string}` | undefined;
  }, [l2ChainId, networkEnv]);

  const linkDepositPoolAddress = useMemo(() => {
    return getContractAddress(l1ChainId, "linkDepositPool", networkEnv) as `0x${string}` | undefined;
  }, [l1ChainId, networkEnv]);

  const linkTokenAddress = useMemo(() => {
    return getContractAddress(l1ChainId, "linkToken", networkEnv) as `0x${string}` | undefined;
  }, [l1ChainId, networkEnv]);

  const distributorV2Address = useMemo(() => {
    return getContractAddress(l1ChainId, "distributorV2", networkEnv) as `0x${string}` | undefined;
  }, [l1ChainId, networkEnv]);

  const rewardPoolV2Address = useMemo(() => {
    return getContractAddress(l1ChainId, "rewardPoolV2", networkEnv) as `0x${string}` | undefined;
  }, [l1ChainId, networkEnv]);

  const l1SenderV2Address = useMemo(() => {
    return getContractAddress(l1ChainId, "l1SenderV2", networkEnv) as `0x${string}` | undefined;
  }, [l1ChainId, networkEnv]);

  // --- Clear Stale Price Cache on Mount ---
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const cached = localStorage.getItem("morpheus_token_prices");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.morPrice && parsed.morPrice < 0.5) {
          localStorage.removeItem("morpheus_token_prices");
        }
        const cacheAge = Date.now() - (parsed.timestamp || 0);
        const oneDayMs = 24 * 60 * 60 * 1000;
        if (cacheAge > oneDayMs) {
          localStorage.removeItem("morpheus_token_prices");
        }
      }
    } catch {
      // Ignore cache errors
    }
  }, []);

  // --- Token Prices Hook ---
  const { morPrice } = useTokenPrices({
    isInitialLoad: true,
    shouldRefreshData: false,
    userAddress: undefined,
    networkEnv: networkEnv,
  });

  // --- Pool Data Hook ---
  const capitalPoolData = useCapitalPoolData({ morPrice: morPrice || undefined });

  // --- Asset Contract Data Hooks ---
  const assetContractData = {
    stETH: useAssetContractData("stETH"),
    LINK: useAssetContractData("LINK"),
    USDC: useAssetContractData("USDC"),
    USDT: useAssetContractData("USDT"),
    wBTC: useAssetContractData("wBTC"),
    wETH: useAssetContractData("wETH"),
  };

  // --- Contract Reads Hook ---
  const contractReads = useCapitalContractReads({
    userAddress,
    l1ChainId,
    l2ChainId,
    networkEnv,
    stETHDepositPoolAddress,
    linkDepositPoolAddress,
    distributorV2Address,
    morContractAddress,
  });

  // --- Assets Hook ---
  const assetsResult = useCapitalAssets({
    networkEnv,
    l1ChainId,
    assetContractData,
  });

  // --- Referrals Hook ---
  const referralsResult = useCapitalReferrals({
    userAddress,
    l1ChainId,
    networkEnv,
  });

  // --- Multiplier Simulation Hook ---
  const multiplierSim = useMultiplierSimulation({
    distributorV2Address,
    l1ChainId,
  });

  // --- Transactions Hook ---
  const transactions = useCapitalTransactions({
    userAddress,
    l1ChainId,
    networkEnv,
    assets: assetsResult.assets,
    selectedAsset,
    assetContractData,
    capitalPoolData,
    referralAssetConfigMap: referralsResult.referralAssetConfigMap,
    referralRewardsByAsset: referralsResult.referralRewardsByAsset,
    distributorV2Address,
    onModalClose: () => setActiveModal(null),
    onFirstDeposit: () => incrementLocalDepositorCount(networkEnv),
    refetchUserData: contractReads.refetchUserData,
    refetchUserReward: contractReads.refetchUserReward,
    refetchUserMultiplier: contractReads.refetchUserMultiplier,
    refetchMorBalance: contractReads.refetchMorBalance,
  });

  // --- Current Timestamp for Eligibility Checks ---
  const [currentTimestampSeconds, setCurrentTimestampSeconds] = useState<bigint>(
    BigInt(Math.floor(Date.now() / 1000))
  );

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentTimestampSeconds(BigInt(Math.floor(Date.now() / 1000)));
    }, TIMESTAMP_UPDATE_INTERVAL);

    return () => clearInterval(intervalId);
  }, []);

  // --- Eligibility Calculations ---
  const canClaim = useMemo(() => {
    const { claimUnlockTimestamp, currentUserRewardData } = contractReads;
    if (!claimUnlockTimestamp || !currentUserRewardData || currentUserRewardData === BigInt(0)) {
      return false;
    }
    return currentTimestampSeconds >= claimUnlockTimestamp;
  }, [contractReads, currentTimestampSeconds]);

  const canWithdraw = useMemo(() => {
    const currentAssetData = assetsResult.assets[selectedAsset];
    if (!currentAssetData) return false;

    const hasDeposited = currentAssetData.userDeposited > BigInt(0);
    if (!hasDeposited) return false;

    // Use asset's canWithdraw flag
    return currentAssetData.canWithdraw;
  }, [selectedAsset, assetsResult.assets]);

  // --- V2 Claim Eligibility (derived from assets) ---
  const stETHV2CanClaim = useMemo(() => {
    return assetsResult.assets.stETH?.canClaim ?? false;
  }, [assetsResult.assets]);

  const linkV2CanClaim = useMemo(() => {
    return assetsResult.assets.LINK?.canClaim ?? false;
  }, [assetsResult.assets]);

  // --- Dynamic Contract Loading ---
  const dynamicContracts = useMemo(() => {
    if (!publicClient) return {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contracts: Record<string, any> = {};

    try {
      if (stEthContractAddress) {
        contracts.stETHToken = getContract({
          address: stEthContractAddress,
          abi: ERC20Abi,
          client: publicClient,
        });
      }

      if (linkTokenAddress) {
        contracts.linkToken = getContract({
          address: linkTokenAddress,
          abi: ERC20Abi,
          client: publicClient,
        });
      }

      if (stETHDepositPoolAddress) {
        contracts.stETHDepositPool = getContract({
          address: stETHDepositPoolAddress,
          abi: DepositPoolAbi,
          client: publicClient,
        });
      }

      if (linkDepositPoolAddress) {
        contracts.linkDepositPool = getContract({
          address: linkDepositPoolAddress,
          abi: DepositPoolAbi,
          client: publicClient,
        });
      }
    } catch (error) {
      console.error("Error creating dynamic contracts:", error);
    }

    return contracts;
  }, [publicClient, stEthContractAddress, linkTokenAddress, stETHDepositPoolAddress, linkDepositPoolAddress]);

  // --- Formatted Legacy Data ---
  const userDepositFormatted = formatBigInt(contractReads.userData?.deposited, 18, 2);
  const claimableAmountFormatted = formatBigInt(contractReads.currentUserRewardData, 18, 2);

  // --- Context Value ---
  const contextValue = useMemo(
    (): CapitalContextState => ({
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
      assets: assetsResult.assets,
      selectedAsset,
      setSelectedAsset: (asset: AssetSymbol) => {
        setSelectedAsset(asset);
      },

      // Aggregated Data
      totalDepositedUSD: assetsResult.totalDepositedUSD,
      totalClaimableAmount: assetsResult.totalClaimableAmount,
      morBalance: contractReads.morBalance,

      // Formatted Data (aggregated)
      totalDepositedUSDFormatted: formatBigInt(assetsResult.totalDepositedUSD, 18, 2),
      totalClaimableAmountFormatted: formatBigInt(assetsResult.totalClaimableAmount, 18, 2),
      morBalanceFormatted: formatBigInt(contractReads.morBalance, 18, 4),

      // Asset-specific formatted data
      selectedAssetUserBalanceFormatted: assetsResult.assets[selectedAsset]?.userBalanceFormatted || "0",
      selectedAssetDepositedFormatted: assetsResult.assets[selectedAsset]?.userDepositedFormatted || "0",
      selectedAssetClaimableFormatted: assetsResult.assets[selectedAsset]?.claimableAmountFormatted || "0",
      selectedAssetMultiplierFormatted: assetsResult.assets[selectedAsset]?.userMultiplierFormatted || "---",
      selectedAssetTotalStakedFormatted: assetsResult.assets[selectedAsset]?.totalDepositedFormatted || "0",
      selectedAssetMinimalStakeFormatted: assetsResult.assets[selectedAsset]?.minimalStakeFormatted || "100",

      // Calculated Data
      withdrawUnlockTimestamp: contractReads.withdrawUnlockTimestamp,
      claimUnlockTimestamp: contractReads.claimUnlockTimestamp,
      withdrawUnlockTimestampFormatted: formatTimestamp(contractReads.withdrawUnlockTimestamp),
      claimUnlockTimestampFormatted: formatTimestamp(contractReads.claimUnlockTimestamp),

      // Eligibility Flags
      canWithdraw,
      canClaim,
      selectedAssetCanClaim: assetsResult.assets[selectedAsset]?.canClaim ?? false,

      // V2-specific claim data (legacy - deprecated)
      stETHV2CanClaim,
      linkV2CanClaim,
      stETHV2ClaimUnlockTimestamp: contractReads.stETHV2ClaimUnlockTimestamp,
      linkV2ClaimUnlockTimestamp: contractReads.linkV2ClaimUnlockTimestamp,
      stETHV2ClaimUnlockTimestampFormatted: formatTimestamp(contractReads.stETHV2ClaimUnlockTimestamp),
      linkV2ClaimUnlockTimestampFormatted: formatTimestamp(contractReads.linkV2ClaimUnlockTimestamp),

      // Referral Data
      referralData: referralsResult.referralData,

      // Loading States
      isLoadingAssetData: assetsResult.isLoadingAssetData,
      isLoadingUserData: contractReads.isLoadingUserData,
      isLoadingBalances: contractReads.isLoadingBalances,
      isLoadingAllowances: assetsResult.isLoadingAllowances,
      isLoadingRewards: contractReads.isLoadingRewards,
      isLoadingTotalDeposits: assetsResult.isLoadingTotalDeposits,

      // Legacy Properties
      userDepositFormatted,
      claimableAmountFormatted,
      userData: contractReads.userData,
      currentUserMultiplierData: contractReads.currentUserMultiplierData,
      poolInfo: contractReads.poolInfo,

      // Action States
      isProcessingDeposit: transactions.isProcessingDeposit,
      isProcessingClaim: transactions.isProcessingClaim,
      isProcessingWithdraw: transactions.isProcessingWithdraw,
      isProcessingChangeLock: transactions.isProcessingChangeLock,
      isApprovalSuccess: transactions.isApprovalSuccess,

      // Claim transaction states
      isClaimSuccess: transactions.isClaimSuccess,
      claimHash: transactions.claimHash,
      lastHandledClaimHash: transactions.lastHandledClaimHash,

      // Action Functions
      deposit: transactions.deposit,
      claim: transactions.claim,
      withdraw: transactions.withdraw,
      changeLock: transactions.changeLock,
      approveToken: transactions.approveToken,
      claimAssetRewards: transactions.claimAssetRewards,
      lockAssetRewards: transactions.lockAssetRewards,
      claimReferralRewards: transactions.claimReferralRewards,

      // Utility Functions
      needsApproval: assetsResult.needsApproval,
      checkAndUpdateApprovalNeeded: assetsResult.checkAndUpdateApprovalNeeded,

      // Modal State
      activeModal,
      setActiveModal,

      // Pre-populated referrer address
      preReferrerAddress,
      setPreReferrerAddress,

      // Multiplier simulation
      multiplierSimArgs: multiplierSim.multiplierSimArgs,
      triggerMultiplierEstimation: multiplierSim.triggerMultiplierEstimation,
      estimatedMultiplierValue: multiplierSim.estimatedMultiplierValue,
      isSimulatingMultiplier: multiplierSim.isSimulatingMultiplier,

      // Dynamic Contract Loading
      dynamicContracts,
    }),
    [
      l1ChainId,
      l2ChainId,
      userAddress,
      networkEnv,
      distributorV2Address,
      rewardPoolV2Address,
      l1SenderV2Address,
      assetsResult,
      selectedAsset,
      contractReads,
      canWithdraw,
      canClaim,
      stETHV2CanClaim,
      linkV2CanClaim,
      referralsResult.referralData,
      userDepositFormatted,
      claimableAmountFormatted,
      transactions,
      activeModal,
      preReferrerAddress,
      multiplierSim,
      dynamicContracts,
    ]
  );

  return <CapitalPageContext.Provider value={contextValue}>{children}</CapitalPageContext.Provider>;
}

// --- Consumer Hook ---
export function useCapitalContext() {
  const context = useContext(CapitalPageContext);
  if (!context) {
    throw new Error("useCapitalContext must be used within a CapitalProvider");
  }
  return context;
}
