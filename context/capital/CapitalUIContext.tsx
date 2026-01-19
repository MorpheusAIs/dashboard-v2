"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { type ActiveModal, type AssetSymbol } from "./types";

// ============================================================================
// Context State Interface
// ============================================================================

interface CapitalUIState {
  // Modal state
  activeModal: ActiveModal;
  setActiveModal: (modal: ActiveModal) => void;

  // Selected asset for operations
  selectedAsset: AssetSymbol;
  setSelectedAsset: (asset: AssetSymbol) => void;

  // Pre-populated referrer address (from URL referral links)
  preReferrerAddress: string;
  setPreReferrerAddress: (address: string) => void;
}

// ============================================================================
// Context Creation
// ============================================================================

const CapitalUIContext = createContext<CapitalUIState | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

interface CapitalUIProviderProps {
  children: React.ReactNode;
  defaultAsset?: AssetSymbol;
}

export function CapitalUIProvider({
  children,
  defaultAsset = "stETH",
}: CapitalUIProviderProps) {
  // Modal state
  const [activeModal, setActiveModalState] = useState<ActiveModal>(null);

  // Selected asset state
  const [selectedAsset, setSelectedAssetState] = useState<AssetSymbol>(defaultAsset);

  // Pre-populated referrer address (for URL referral links)
  const [preReferrerAddress, setPreReferrerAddressState] = useState<string>("");

  // Stable callbacks
  const setActiveModal = useCallback((modal: ActiveModal) => {
    setActiveModalState(modal);
  }, []);

  const setSelectedAsset = useCallback((asset: AssetSymbol) => {
    setSelectedAssetState(asset);
  }, []);

  const setPreReferrerAddress = useCallback((address: string) => {
    setPreReferrerAddressState(address);
  }, []);

  // Memoized context value
  const value = useMemo<CapitalUIState>(
    () => ({
      activeModal,
      setActiveModal,
      selectedAsset,
      setSelectedAsset,
      preReferrerAddress,
      setPreReferrerAddress,
    }),
    [
      activeModal,
      setActiveModal,
      selectedAsset,
      setSelectedAsset,
      preReferrerAddress,
      setPreReferrerAddress,
    ]
  );

  return (
    <CapitalUIContext.Provider value={value}>
      {children}
    </CapitalUIContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useCapitalUI(): CapitalUIState {
  const context = useContext(CapitalUIContext);
  if (!context) {
    throw new Error("useCapitalUI must be used within a CapitalUIProvider");
  }
  return context;
}

// ============================================================================
// Selective Hooks (for fine-grained subscriptions)
// ============================================================================

/**
 * Subscribe only to modal state changes
 */
export function useCapitalModal() {
  const { activeModal, setActiveModal } = useCapitalUI();
  return { activeModal, setActiveModal };
}

/**
 * Subscribe only to selected asset changes
 */
export function useSelectedAsset() {
  const { selectedAsset, setSelectedAsset } = useCapitalUI();
  return { selectedAsset, setSelectedAsset };
}

/**
 * Subscribe only to referrer address
 */
export function usePreReferrer() {
  const { preReferrerAddress, setPreReferrerAddress } = useCapitalUI();
  return { preReferrerAddress, setPreReferrerAddress };
}
