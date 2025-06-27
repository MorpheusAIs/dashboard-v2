"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { formatUnits, parseUnits } from "viem";

import { Dialog, DialogPortal, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Import Context hook
import { useCapitalContext } from "@/context/CapitalPageContext";

// Removed ABI imports

// Removed PUBLIC_POOL_ID constant

interface DepositModalProps {
  minimalStake?: bigint; // Still useful for validation message
  // Removed props now handled by context:
  // poolContractAddress?: `0x${string}`;
  // stEthContractAddress?: `0x${string}`;
  // l1ChainId?: number;
  // refetchUserData: () => void;
}

export function DepositModal({ 
  minimalStake
}: DepositModalProps) {
  // Get modal state/control from context
  const {
    userAddress,
    stEthBalance,
    deposit,
    approveStEth,
    checkAndUpdateApprovalNeeded,
    isProcessingDeposit,
    isApprovalSuccess,
    activeModal,
    setActiveModal
    // Removed isLoadingBalances, isLoadingAllowance as they aren't directly used here
  } = useCapitalContext();

  const isOpen = activeModal === 'deposit'; // Determine open state from context

  const [amount, setAmount] = useState("");
  const [formError, setFormError] = useState<string | null>(null); // Local form error

  const amountBigInt = useMemo(() => {
    try {
      return amount ? parseUnits(amount, 18) : BigInt(0);
    } catch { 
      return BigInt(0);
    }
  }, [amount]);

  // State to track approval status dynamically
  const [currentlyNeedsApproval, setCurrentlyNeedsApproval] = useState(false);
  // Track if we've already processed the current approval success
  const [processedApprovalSuccess, setProcessedApprovalSuccess] = useState(false);
  
  // Comprehensive approval status checking function
  const checkApprovalStatus = useCallback(async () => {
    if (amount && parseFloat(amount) > 0 && userAddress) {
      const needsApproval = await checkAndUpdateApprovalNeeded(amount);
      setCurrentlyNeedsApproval(needsApproval);
    } else {
      setCurrentlyNeedsApproval(false);
    }
  }, [amount, userAddress, checkAndUpdateApprovalNeeded]);

  // Check approval status when relevant dependencies change
  useEffect(() => {
    checkApprovalStatus();
    // Reset the processed flag when dependencies change
    setProcessedApprovalSuccess(false);
  }, [checkApprovalStatus]);

  // Recheck approval status when approval transaction is confirmed
  useEffect(() => {
    if (isApprovalSuccess && amount && parseFloat(amount) > 0 && !processedApprovalSuccess) {
      // Mark this approval success as processed
      setProcessedApprovalSuccess(true);
      // Wait a bit for the blockchain state to update, then recheck
      setTimeout(() => {
        checkApprovalStatus();
      }, 1000);
    }
  }, [isApprovalSuccess, amount, processedApprovalSuccess, checkApprovalStatus]);
  
  // Use the dynamic approval status
  const showApprovalButton = currentlyNeedsApproval;

  // Validation (using context data)
  const validationError = useMemo(() => {
    if (amountBigInt <= BigInt(0)) return null;
    if (minimalStake !== undefined && amountBigInt < minimalStake) {
      return `Minimum deposit is ${formatUnits(minimalStake, 18)} stETH`;
    }
    if (stEthBalance !== undefined && amountBigInt > stEthBalance) {
      return "Insufficient stETH balance";
    }
    return null;
  }, [amountBigInt, stEthBalance, minimalStake]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null); // Clear previous errors
    if (validationError) {
      setFormError(validationError);
      // toast.error(validationError); // Optional: Show toast too
      return;
    }

    try {
      if (showApprovalButton) {
        await approveStEth();
        // Don't proceed with deposit immediately - let the approval success effect handle the recheck
      } else {
        await deposit(amount); 
        // Context action now handles closing on success
        // onOpenChange(false); 
      }
    } catch (error) {
      console.error("Deposit/Approve Action Error:", error);
      setFormError((error as Error)?.message || "An unexpected error occurred.");
    }
  };

  // Reset form state when modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      setAmount("");
      setFormError(null);
      setCurrentlyNeedsApproval(false);
      setProcessedApprovalSuccess(false);
    }
  }, [isOpen]);

  return (
    // Use context state for open and onOpenChange
    <Dialog open={isOpen} onOpenChange={(open) => !open && setActiveModal(null)}>
      <DialogPortal>
        <DialogContent className="sm:max-w-[425px] bg-background border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-emerald-400">Deposit stETH</DialogTitle>
            <DialogDescription className="text-gray-400">
              Contribute capital to the public pool.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="deposit-amount" className="text-sm font-medium">
                  Amount
                </Label>
                <span className="text-xs text-gray-400">
                  Balance: {stEthBalance !== undefined ? Number(formatUnits(stEthBalance, 18)).toFixed(3) : 'Loading...'} stETH
                </span>
              </div>
              <div className="relative">
                <Input
                  id="deposit-amount"
                  placeholder="0.0"
                  value={amount}
                  onChange={(e) => {
                    // Only allow numbers and decimal point
                    const value = e.target.value;
                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                      setAmount(value);
                      setFormError(null);
                    }
                  }}
                  className={`bg-background border-gray-700 ${(validationError || formError) ? 'border-red-500' : ''}`}
                  type="text" // Changed from "number" to "text" for better control
                  inputMode="decimal" // Suggests a decimal keypad on mobile
                  pattern="[0-9]*[.]?[0-9]*" // HTML5 pattern for numbers only
                  min="0"
                  disabled={isProcessingDeposit}
                  required
                  onKeyDown={(e) => {
                    // Prevent 'e', '-', '+' keys
                    if (['e', 'E', '-', '+'].includes(e.key)) {
                      e.preventDefault();
                    }
                  }}
                />
              </div>
               {(validationError || formError) && (
                  <p className="text-xs text-red-500 pt-1">{validationError || formError}</p>
                )}
            </div>

            {/* Removed explicit error display, context handles toasts */}

            <DialogFooter>
              <Button
                type="button" 
                variant="outline"
                onClick={() => setActiveModal(null)} // Use context action to close
                disabled={isProcessingDeposit}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
                disabled={isProcessingDeposit || !!validationError || amountBigInt <= BigInt(0) || !userAddress }
              >
                {isProcessingDeposit ? (
                   "Processing..." // Simplified loading state
                ) : (
                  showApprovalButton ? "Approve stETH" : "Confirm Deposit"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
} 