"use client";

import React, { createContext, useContext, useMemo, useCallback } from "react";
import { useBalance } from "wagmi";
import { useCapitalNetwork } from "./CapitalNetworkContext";
import { formatBigInt } from "@/lib/utils/formatters";

// ============================================================================
// Context State Interface
// ============================================================================

interface CapitalMORBalanceState {
  // Raw balance
  morBalance: bigint;

  // Formatted balance
  morBalanceFormatted: string;

  // Loading state
  isLoadingMorBalance: boolean;

  // Refetch function
  refetchMorBalance: () => void;
}

// ============================================================================
// Context Creation
// ============================================================================

const CapitalMORBalanceContext = createContext<CapitalMORBalanceState | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

interface CapitalMORBalanceProviderProps {
  children: React.ReactNode;
}

export function CapitalMORBalanceProvider({ children }: CapitalMORBalanceProviderProps) {
  const { userAddress, morContractAddress, l2ChainId } = useCapitalNetwork();

  // MOR balance on L2
  const {
    data: morBalanceData,
    isLoading: isLoadingMorBalance,
    refetch: refetchMorBalanceRaw,
  } = useBalance({
    address: userAddress,
    token: morContractAddress,
    chainId: l2ChainId,
    query: { enabled: !!userAddress && !!morContractAddress },
  });

  const morBalance = useMemo(() => morBalanceData?.value ?? BigInt(0), [morBalanceData]);

  const morBalanceFormatted = useMemo(
    () => formatBigInt(morBalance, 18, 4),
    [morBalance]
  );

  const refetchMorBalance = useCallback(() => {
    refetchMorBalanceRaw();
  }, [refetchMorBalanceRaw]);

  // Memoized context value
  const value = useMemo<CapitalMORBalanceState>(
    () => ({
      morBalance,
      morBalanceFormatted,
      isLoadingMorBalance,
      refetchMorBalance,
    }),
    [morBalance, morBalanceFormatted, isLoadingMorBalance, refetchMorBalance]
  );

  return (
    <CapitalMORBalanceContext.Provider value={value}>
      {children}
    </CapitalMORBalanceContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useCapitalMORBalance(): CapitalMORBalanceState {
  const context = useContext(CapitalMORBalanceContext);
  if (!context) {
    throw new Error("useCapitalMORBalance must be used within a CapitalMORBalanceProvider");
  }
  return context;
}

// ============================================================================
// Selective Hooks
// ============================================================================

/**
 * Get only the MOR balance value
 */
export function useMORBalance() {
  const { morBalance, morBalanceFormatted } = useCapitalMORBalance();
  return { morBalance, morBalanceFormatted };
}

/**
 * Get MOR balance loading state
 */
export function useMORBalanceLoading() {
  const { isLoadingMorBalance } = useCapitalMORBalance();
  return isLoadingMorBalance;
}
