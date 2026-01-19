"use client";

/**
 * Capital Context Module
 *
 * This module provides focused context providers for the Capital page,
 * splitting the monolithic CapitalPageContext into smaller, more efficient pieces.
 *
 * Usage:
 * 1. Wrap your app with <CapitalProvider> (replaces CapitalPageContextProvider)
 * 2. Use specific hooks like useCapitalUI(), useCapitalNetwork() for focused subscriptions
 * 3. Use useCapitalPage() for backward compatibility (subscribes to all contexts)
 *
 * Benefits:
 * - Components only re-render when their subscribed context changes
 * - Better code organization and testability
 * - Smaller bundle sizes per route (potential code splitting)
 */

import React from "react";

// ============================================================================
// Type Exports
// ============================================================================

export * from "./types";
import { type AssetSymbol } from "./types";

// ============================================================================
// Context Imports & Exports
// ============================================================================

// UI Context - Modal state, selected asset, referrer address
import {
  CapitalUIProvider,
  useCapitalUI,
  useCapitalModal,
  useSelectedAsset,
  usePreReferrer,
} from "./CapitalUIContext";

export {
  CapitalUIProvider,
  useCapitalUI,
  useCapitalModal,
  useSelectedAsset,
  usePreReferrer,
};

// Network Context - Network info, chain IDs, contract addresses
import {
  CapitalNetworkProvider,
  useCapitalNetwork,
  useCapitalNetworkEnv,
  useCapitalUserAddress,
  useCapitalV2Addresses,
  useCapitalDepositPoolAddresses,
  useCapitalTokenAddresses,
} from "./CapitalNetworkContext";

export {
  CapitalNetworkProvider,
  useCapitalNetwork,
  useCapitalNetworkEnv,
  useCapitalUserAddress,
  useCapitalV2Addresses,
  useCapitalDepositPoolAddresses,
  useCapitalTokenAddresses,
};

// Assets Context - Asset configurations and contract data
import {
  CapitalAssetsProvider,
  useCapitalAssets,
  useAssets,
  useAssetData,
  useAssetLoadingStates,
  useRefetchAssets,
} from "./CapitalAssetsContext";

export {
  CapitalAssetsProvider,
  useCapitalAssets,
  useAssets,
  useAssetData,
  useAssetLoadingStates,
  useRefetchAssets,
};

// MOR Balance Context - L2 MOR token balance
import {
  CapitalMORBalanceProvider,
  useCapitalMORBalance,
  useMORBalance,
  useMORBalanceLoading,
} from "./CapitalMORBalanceContext";

export {
  CapitalMORBalanceProvider,
  useCapitalMORBalance,
  useMORBalance,
  useMORBalanceLoading,
};

// Referral Context - Referral data and metrics
import {
  CapitalReferralProvider,
  useCapitalReferral,
  useReferralTotals,
  useReferralsByAsset,
  useReferralLoadingStates,
  useReferralRewardsByAsset,
  useReferralAssetConfig,
} from "./CapitalReferralContext";

export {
  CapitalReferralProvider,
  useCapitalReferral,
  useReferralTotals,
  useReferralsByAsset,
  useReferralLoadingStates,
  useReferralRewardsByAsset,
  useReferralAssetConfig,
};

// Transactions Context - Write operations and transaction state
import {
  CapitalTransactionsProvider,
  useCapitalTransactions,
  useDepositTransaction,
  useWithdrawTransaction,
  useClaimTransaction,
  useLockTransaction,
  useTransactionProcessingStates,
  useReferralClaimTransaction,
} from "./CapitalTransactionsContext";

export {
  CapitalTransactionsProvider,
  useCapitalTransactions,
  useDepositTransaction,
  useWithdrawTransaction,
  useClaimTransaction,
  useLockTransaction,
  useTransactionProcessingStates,
  useReferralClaimTransaction,
};

// ============================================================================
// Combined Provider
// ============================================================================

interface CapitalProviderProps {
  children: React.ReactNode;
  defaultAsset?: AssetSymbol;
}

/**
 * Combined provider that wraps all Capital contexts.
 *
 * Provider hierarchy (outer to inner):
 * 1. CapitalNetworkProvider - Foundation layer (network, addresses)
 * 2. CapitalUIProvider - UI state (modals, selected asset)
 * 3. CapitalAssetsProvider - Asset configurations and contract data
 * 4. CapitalMORBalanceProvider - L2 MOR token balance
 * 5. CapitalReferralProvider - Referral data and metrics
 * 6. CapitalTransactionsProvider - Write operations and transaction state
 */
export function CapitalProvider({ children, defaultAsset = "stETH" }: CapitalProviderProps) {
  return (
    <CapitalNetworkProvider>
      <CapitalUIProvider defaultAsset={defaultAsset}>
        <CapitalAssetsProvider>
          <CapitalMORBalanceProvider>
            <CapitalReferralProvider>
              <CapitalTransactionsProvider>
                {children}
              </CapitalTransactionsProvider>
            </CapitalReferralProvider>
          </CapitalMORBalanceProvider>
        </CapitalAssetsProvider>
      </CapitalUIProvider>
    </CapitalNetworkProvider>
  );
}

// ============================================================================
// Backward Compatibility
// ============================================================================

/**
 * @deprecated Use specific context hooks instead (useCapitalUI, useCapitalNetwork, etc.)
 *
 * This hook combines all contexts for backward compatibility during migration.
 * Components using this will re-render on ANY capital context change.
 *
 * Migration guide:
 * - useCapitalPage().activeModal -> useCapitalUI().activeModal
 * - useCapitalPage().networkEnv -> useCapitalNetwork().networkEnv
 * - useCapitalPage().assets -> useCapitalAssets().assets
 * - useCapitalPage().morBalance -> useCapitalMORBalance().morBalance
 * - etc.
 */
export function useCapitalPagePartial() {
  const ui = useCapitalUI();
  const network = useCapitalNetwork();
  const assetsCtx = useCapitalAssets();
  const morBalanceCtx = useCapitalMORBalance();
  const referralCtx = useCapitalReferral();
  const txCtx = useCapitalTransactions();

  return {
    // From UI Context
    activeModal: ui.activeModal,
    setActiveModal: ui.setActiveModal,
    selectedAsset: ui.selectedAsset,
    setSelectedAsset: ui.setSelectedAsset,
    preReferrerAddress: ui.preReferrerAddress,
    setPreReferrerAddress: ui.setPreReferrerAddress,

    // From Network Context
    networkEnv: network.networkEnv,
    l1ChainId: network.l1ChainId,
    l2ChainId: network.l2ChainId,
    userAddress: network.userAddress,
    distributorV2Address: network.distributorV2Address,
    rewardPoolV2Address: network.rewardPoolV2Address,
    l1SenderV2Address: network.l1SenderV2Address,
    stETHDepositPoolAddress: network.stETHDepositPoolAddress,
    stEthContractAddress: network.stEthContractAddress,
    linkDepositPoolAddress: network.linkDepositPoolAddress,
    linkTokenAddress: network.linkTokenAddress,
    morContractAddress: network.morContractAddress,
    dynamicContracts: network.dynamicContracts,
    poolInfo: network.poolInfo,
    isLoadingPoolInfo: network.isLoadingPoolInfo,

    // From Assets Context
    assets: assetsCtx.assets,
    assetContractData: assetsCtx.assetContractData,
    isLoadingAssetData: assetsCtx.isLoadingAssets,
    isLoadingBalances: assetsCtx.isLoadingBalances,
    isLoadingAllowances: assetsCtx.isLoadingAllowances,
    isLoadingRewards: assetsCtx.isLoadingRewards,
    isLoadingTotalDeposits: assetsCtx.isLoadingTotalDeposits,

    // From MOR Balance Context
    morBalance: morBalanceCtx.morBalance,
    morBalanceFormatted: morBalanceCtx.morBalanceFormatted,
    isLoadingMorBalance: morBalanceCtx.isLoadingMorBalance,
    refetchMorBalance: morBalanceCtx.refetchMorBalance,

    // From Referral Context
    referralData: {
      totalReferrals: String(referralCtx.totalReferrals),
      totalReferralAmount: referralCtx.totalReferralAmountFormatted,
      lifetimeRewards: referralCtx.totalMorEarnedFormatted,
      claimableRewards: "0", // Computed from referralRewardsByAsset
      isLoadingReferralData: referralCtx.isLoadingReferralData || referralCtx.isLoadingReferrerSummary || referralCtx.isLoadingReferralRewards,
      referralAmountsByAsset: referralCtx.referralAmountsByAsset,
      rewardsByAsset: referralCtx.referralRewardsByAsset,
      referrerDetailsByAsset: referralCtx.referrerDetailsByAsset,
      assetsWithClaimableRewards: referralCtx.assetsWithClaimableRewards,
      availableReferralAssets: referralCtx.availableReferralAssets,
      stETHReferralRewards: referralCtx.referralRewardsByAsset.stETH ?? BigInt(0),
      linkReferralRewards: referralCtx.referralRewardsByAsset.LINK ?? BigInt(0),
      stETHReferralData: referralCtx.referrerDetailsByAsset.stETH ?? null,
      linkReferralData: referralCtx.referrerDetailsByAsset.LINK ?? null,
    },

    // From Transactions Context
    deposit: txCtx.deposit,
    withdraw: txCtx.withdraw,
    claim: txCtx.claim,
    approveToken: txCtx.approveToken,
    changeLock: txCtx.changeLock,
    claimReferralRewards: txCtx.claimReferralRewards,
    isProcessingDeposit: txCtx.isProcessingDeposit,
    isProcessingWithdraw: txCtx.isProcessingWithdraw,
    isProcessingClaim: txCtx.isProcessingClaim,
    isProcessingChangeLock: txCtx.isProcessingChangeLock,
    isProcessingReferralClaim: txCtx.isProcessingReferralClaim,
    isApprovalSuccess: txCtx.isApprovalSuccess,
    isClaimSuccess: txCtx.isClaimSuccess,
    isReferralClaimSuccess: txCtx.isReferralClaimSuccess,
    claimHash: txCtx.claimHash,
    referralClaimHash: txCtx.referralClaimHash,

    // Multiplier simulation (for change-lock-modal)
    triggerMultiplierEstimation: txCtx.triggerMultiplierEstimation,
    estimatedMultiplierValue: txCtx.estimatedMultiplierValue,
    isSimulatingMultiplier: txCtx.isSimulatingMultiplier,
  };
}
