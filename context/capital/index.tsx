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
 *
 * Note: Additional contexts (Assets, Balances, Deposits, Rewards, etc.)
 * will be added as they are implemented.
 */
export function CapitalProvider({ children, defaultAsset = "stETH" }: CapitalProviderProps) {
  return (
    <CapitalNetworkProvider>
      <CapitalUIProvider defaultAsset={defaultAsset}>
        {children}
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
 * - etc.
 */
export function useCapitalPagePartial() {
  const ui = useCapitalUI();
  const network = useCapitalNetwork();

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
  };
}
