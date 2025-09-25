"use client";

import { useState, useEffect, useMemo } from "react";
import { parseUnits, formatUnits } from "viem";

import { Dialog, DialogPortal, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useCapitalContext } from "@/context/CapitalPageContext";
import { getAssetConfig } from "@/components/capital/constants/asset-config";
import { useNetwork } from "@/context/network-context";

export function WithdrawModal() {
  const {
    userAddress,
    withdraw,
    canWithdraw,
    isProcessingWithdraw,
    activeModal,
    setActiveModal,
    selectedAsset,
    assets
  } = useCapitalContext();
  
  const { environment } = useNetwork();

  const isOpen = activeModal === 'withdraw';

  // Get asset-specific data from context
  const currentAsset = assets[selectedAsset];
  const rawDepositedAmount = currentAsset?.userDeposited || BigInt(0);
  const assetDisplayName = currentAsset?.config.symbol || selectedAsset;
  const assetUnit = currentAsset?.config.symbol || selectedAsset;

  // Get asset configuration for correct decimals
  const assetConfig = useMemo(() => {
    return getAssetConfig(selectedAsset, environment);
  }, [selectedAsset, environment]);

  const assetDecimals = assetConfig?.metadata.decimals || 18;

  // Format deposited amount with higher precision for display and max withdrawal
  const actualDepositedAmount = useMemo(() => {
    if (rawDepositedAmount <= BigInt(0)) return "0";
    return formatUnits(rawDepositedAmount, assetDecimals);
  }, [rawDepositedAmount, assetDecimals]);

  const [amount, setAmount] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const amountBigInt = useMemo(() => {
    try {
      return amount ? parseUnits(amount, assetDecimals) : BigInt(0);
    } catch { 
      return BigInt(0); 
    }
  }, [amount, assetDecimals]);

  const numericDeposited = useMemo(() => {
    try {
      return parseFloat(actualDepositedAmount);
    } catch {
      return 0;
    }
  }, [actualDepositedAmount]);

  const depositedAmountBigInt = rawDepositedAmount;

  // Validation logic similar to deposit modal
  const validationError = useMemo(() => {
    // Only validate if there's actually an amount entered
    if (!amount || amount.trim() === "" || amountBigInt <= BigInt(0)) {
      return null;
    }
    
    if (!canWithdraw) {
      return "Withdrawal is currently locked";
    }
    
    if (amountBigInt > depositedAmountBigInt) {
      return `Insufficient ${assetDisplayName} deposited. Available: ${parseFloat(actualDepositedAmount).toLocaleString(undefined, { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 6 
      })} ${assetUnit}`;
    }
    
    return null;
  }, [amount, amountBigInt, canWithdraw, depositedAmountBigInt, assetDisplayName, actualDepositedAmount, assetUnit]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    
    if (validationError) {
      setFormError(validationError);
      return;
    }
    
    try {
      await withdraw(selectedAsset, amount);
    } catch (error) {
      console.error("Withdraw Action Error:", error);
      
      // Handle user rejection specifically
      const errorMessage = (error as Error)?.message || "";
      if (errorMessage.includes("User rejected") || 
          errorMessage.includes("User denied") || 
          errorMessage.includes("rejected the request") ||
          errorMessage.includes("denied transaction signature")) {
        setFormError("Transaction was cancelled.");
        return;
      }
      
      // Handle other errors with a more user-friendly message
      if (errorMessage.includes("insufficient funds")) {
        setFormError("Insufficient funds for this transaction.");
      } else if (errorMessage.includes("gas")) {
        setFormError("Transaction failed due to gas issues. Please try again.");
      } else {
        setFormError("Transaction failed. Please try again.");
      }
    }
  };

  const handleMaxClick = () => {
    setAmount(actualDepositedAmount);
    setFormError(null);
  };

  useEffect(() => {
    if (!isOpen) {
      setAmount("");
      setFormError(null);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && setActiveModal(null)}>
      <DialogPortal>
        <DialogContent className="sm:max-w-[425px] bg-background border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-emerald-400">Withdraw {assetDisplayName}</DialogTitle>
            <DialogDescription className="text-gray-400">
              Withdraw your deposited {assetDisplayName} from the public pool.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="withdraw-amount" className="text-sm font-medium">
                Amount to Withdraw
              </Label>
              <div className="relative">
                <Input
                  id="withdraw-amount"
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
                  className={`bg-background pr-28 text-base ${
                    validationError ? '!border-red-500 border-2' : 
                    formError ? '!border-red-500 border-2' : 'border-gray-700 border'
                  }`}
                  type="text" // Changed from "number" to "text" for better control
                  inputMode="decimal" // Suggests a decimal keypad on mobile
                  pattern="[0-9]*\.?[0-9]*"
                  required
                  min="0"
                  disabled={isProcessingWithdraw || !canWithdraw}
                  onKeyDown={(e) => {
                    // Prevent 'e', '-', '+' keys
                    if (['e', 'E', '-', '+'].includes(e.key)) {
                      e.preventDefault();
                    }
                  }}
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                  <span className="text-xs text-gray-400 mr-2">
                    {parseFloat(actualDepositedAmount).toLocaleString(undefined, { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 6 
                    })} {assetUnit}
                  </span>
                  <button
                    type="button"
                    className="h-8 px-2 text-xs copy-button-secondary"
                    onClick={handleMaxClick}
                    disabled={isProcessingWithdraw || !canWithdraw}
                  >
                    Max
                  </button>
                </div>
              </div>
              
              {/* Validation error message */}
              {validationError && (
                <p className="text-red-500 text-sm mt-1">
                  {validationError}
                </p>
              )}
              
              {!canWithdraw && numericDeposited > 0 && !validationError && (
                <p className="text-xs text-yellow-400 pt-1">Withdrawal is currently locked.</p>
              )}
              {formError && !validationError && !(!canWithdraw && numericDeposited > 0) && (
                <p className="text-xs text-red-500 pt-1">{formError}</p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button" 
                variant="outline"
                onClick={() => setActiveModal(null)}
                disabled={isProcessingWithdraw}
              >
                Cancel
              </Button>
              <button
                type="submit"
                className={
                  isProcessingWithdraw || !!validationError || amountBigInt <= BigInt(0) || !userAddress
                    ? "copy-button-secondary px-2 py-2 text-sm opacity-50 cursor-not-allowed mb-2 sm:mb-0" 
                    : "copy-button-base mb-2 sm:mb-0"
                }
                disabled={isProcessingWithdraw || !!validationError || amountBigInt <= BigInt(0) || !userAddress}
              >
                {isProcessingWithdraw ? (
                  <div className="flex flex-row items-center justify-center gap-2">
                    <svg className="text-emerald-400 animate-spin" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"
                      width="16" height="16">
                      <path
                        d="M32 3C35.8083 3 39.5794 3.75011 43.0978 5.20749C46.6163 6.66488 49.8132 8.80101 52.5061 11.4939C55.199 14.1868 57.3351 17.3837 58.7925 20.9022C60.2499 24.4206 61 28.1917 61 32C61 35.8083 60.2499 39.5794 58.7925 43.0978C57.3351 46.6163 55.199 49.8132 52.5061 52.5061C49.8132 55.199 46.6163 57.3351 43.0978 58.7925C39.5794 60.2499 35.8083 61 32 61C28.1917 61 24.4206 60.2499 20.9022 58.7925C17.3837 57.3351 14.1868 55.199 11.4939 52.5061C8.801 49.8132 6.66487 46.6163 5.20749 43.0978C3.7501 39.5794 3 35.8083 3 32C3 28.1917 3.75011 24.4206 5.2075 20.9022C6.66489 17.3837 8.80101 14.1868 11.4939 11.4939C14.1868 8.80099 17.3838 6.66487 20.9022 5.20749C24.4206 3.7501 28.1917 3 32 3L32 3Z"
                        stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"></path>
                      <path
                        d="M32 3C36.5778 3 41.0906 4.08374 45.1692 6.16256C49.2477 8.24138 52.7762 11.2562 55.466 14.9605C58.1558 18.6647 59.9304 22.9531 60.6448 27.4748C61.3591 31.9965 60.9928 36.6232 59.5759 40.9762"
                        stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-900">
                      </path>
                    </svg>
                    Processing...
                  </div>
                ) : (
                  "Confirm Withdraw"
                )}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
} 