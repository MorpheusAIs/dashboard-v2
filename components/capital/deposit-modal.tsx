"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { formatUnits, parseUnits } from "viem";
import { TokenIcon } from '@web3icons/react';

import { Dialog, DialogPortal, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Import Context hook
import { useCapitalContext } from "@/context/CapitalPageContext";

// Time unit type for lock period
type TimeUnit = "days" | "months" | "years";

export function DepositModal() {
  // Get state and actions from V2 context
  const {
    userAddress,
    assets,
    selectedAsset,
    setSelectedAsset,
    deposit,
    approveToken,
    needsApproval: checkNeedsApproval,
    isProcessingDeposit,
    isApprovalSuccess,
    activeModal,
    setActiveModal,
    triggerMultiplierEstimation,
    estimatedMultiplierValue,
    isSimulatingMultiplier
  } = useCapitalContext();

  const isOpen = activeModal === 'deposit';

  // Form state
  const [amount, setAmount] = useState("");
  const [referrerAddress, setReferrerAddress] = useState("");
  const [lockValue, setLockValue] = useState("6");
  const [lockUnit, setLockUnit] = useState<TimeUnit>("months");
  const [formError, setFormError] = useState<string | null>(null);

  // Current asset data
  const currentAsset = assets[selectedAsset];
  
  const amountBigInt = useMemo(() => {
    try {
      return amount ? parseUnits(amount, 18) : BigInt(0);
    } catch { 
      return BigInt(0);
    }
  }, [amount]);

  // State to track approval status
  const [currentlyNeedsApproval, setCurrentlyNeedsApproval] = useState(false);
  const [processedApprovalSuccess, setProcessedApprovalSuccess] = useState(false);
  
  // Check approval status
  const checkApprovalStatus = useCallback(async () => {
    if (amount && parseFloat(amount) > 0 && userAddress) {
      const needsApproval = checkNeedsApproval(selectedAsset, amount);
      setCurrentlyNeedsApproval(needsApproval);
    } else {
      setCurrentlyNeedsApproval(false);
    }
  }, [amount, userAddress, selectedAsset, checkNeedsApproval]);

  // Check approval status when dependencies change
  useEffect(() => {
    checkApprovalStatus();
    setProcessedApprovalSuccess(false);
  }, [checkApprovalStatus]);

  // Handle approval success
  useEffect(() => {
    if (isApprovalSuccess && amount && parseFloat(amount) > 0 && !processedApprovalSuccess) {
      setProcessedApprovalSuccess(true);
      setTimeout(() => {
        checkApprovalStatus();
      }, 1000);
    }
  }, [isApprovalSuccess, amount, processedApprovalSuccess, checkApprovalStatus]);

  // Trigger multiplier estimation when lock period changes
  useEffect(() => {
    if (lockValue && parseInt(lockValue, 10) > 0) {
      triggerMultiplierEstimation(lockValue, lockUnit);
    }
  }, [lockValue, lockUnit, triggerMultiplierEstimation]);

  // Calculate unlock date
  const unlockDate = useMemo(() => {
    if (!lockValue || parseInt(lockValue, 10) <= 0) return null;
    
    const now = new Date();
    const lockDuration = parseInt(lockValue, 10);
    
    const calculatedUnlockDate = new Date(now);
    switch (lockUnit) {
      case "days":
        calculatedUnlockDate.setDate(now.getDate() + lockDuration);
        break;
      case "months":
        calculatedUnlockDate.setMonth(now.getMonth() + lockDuration);
        break;
      case "years":
        calculatedUnlockDate.setFullYear(now.getFullYear() + lockDuration);
        break;
    }
    
    return calculatedUnlockDate;
  }, [lockValue, lockUnit]);

  // Validation
  const validationError = useMemo(() => {
    if (amountBigInt <= BigInt(0)) return null;
    
    // TODO: Add minimal stake validation once PoolLimitsData interface is updated
    // const minimalStake = currentAsset?.protocolDetails?.minimalStake;
    // if (minimalStake && amountBigInt < minimalStake) {
    //   return `Minimum deposit is ${formatUnits(minimalStake, 18)} ${selectedAsset}`;
    // }
    
    if (currentAsset?.userBalance && amountBigInt > currentAsset.userBalance) {
      return `Insufficient ${selectedAsset} balance`;
    }
    
    return null;
  }, [amountBigInt, currentAsset, selectedAsset]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    
    if (validationError) {
      setFormError(validationError);
      return;
    }

    try {
      if (currentlyNeedsApproval) {
        await approveToken(selectedAsset);
      } else {
        await deposit(selectedAsset, amount);
      }
    } catch (error) {
      console.error("Deposit/Approve Action Error:", error);
      setFormError((error as Error)?.message || "An unexpected error occurred.");
    }
  };

  const handleMaxAmount = () => {
    if (currentAsset?.userBalance) {
      const maxAmount = formatUnits(currentAsset.userBalance, 18);
      setAmount(maxAmount);
    }
  };

  // Asset icon mapping
  const getAssetIcon = (asset: string) => {
    switch (asset) {
      case 'stETH':
        return 'eth';
      case 'LINK':
        return 'link';
      default:
        return 'eth';
    }
  };

  // Check if we should show warning/validation
  const showWarning = useMemo(() => {
    if (!amount || amount.trim() === "") return true;
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return true;
    return !!validationError || !!formError || currentlyNeedsApproval;
  }, [amount, validationError, formError, currentlyNeedsApproval]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setAmount("");
      setReferrerAddress("");
      setLockValue("6");
      setLockUnit("months");
      setFormError(null);
      setCurrentlyNeedsApproval(false);
      setProcessedApprovalSuccess(false);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && setActiveModal(null)}>
      <DialogPortal>
        <DialogContent className="sm:max-w-[425px] bg-background border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-emerald-400">Stake Capital</DialogTitle>
            <DialogDescription className="text-gray-400">
              Stake an asset to start earning MOR rewards.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            {/* Asset Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-white">Select Asset</Label>
              <Select 
                value={selectedAsset} 
                onValueChange={(value: 'stETH' | 'LINK') => setSelectedAsset(value)}
              >
                <SelectTrigger className="bg-background border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6">
                      <TokenIcon symbol={getAssetIcon(selectedAsset)} variant="background" size="24" />
                    </div>
                    <span>{selectedAsset}</span>
                    <span className="ml-auto text-gray-400 text-sm">
                      {currentAsset?.userBalanceFormatted || '0'} Available
                    </span>
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-background border-gray-700 z-[60]">
                  <SelectItem value="stETH" className="hover:bg-gray-800">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6">
                        <TokenIcon symbol="eth" variant="background" size="24" />
                      </div>
                      <span>stETH</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="LINK" className="hover:bg-gray-800">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6">
                        <TokenIcon symbol="link" variant="background" size="24" />
                      </div>
                      <span>LINK</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Stake Amount */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-white">Stake Amount</Label>
              <div className="relative">
                <Input
                  placeholder="0.0"
                  value={amount}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                      setAmount(value);
                      setFormError(null);
                    }
                  }}
                  className={`bg-background border-gray-700 pr-32 ${
                    (validationError || formError) ? 'border-red-500' : showWarning ? 'border-yellow-500' : ''
                  }`}
                  disabled={isProcessingDeposit}
                  onKeyDown={(e) => {
                    if (['e', 'E', '-', '+'].includes(e.key)) {
                      e.preventDefault();
                    }
                  }}
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                  {currentAsset?.userBalanceFormatted && (
                    <span className="text-xs text-gray-400 mr-2">
                      {currentAsset.userBalanceFormatted} {selectedAsset}
                    </span>
                  )}
                  <button
                    type="button"
                    className="h-8 px-2 text-xs copy-button-secondary"
                    onClick={handleMaxAmount}
                    disabled={!currentAsset?.userBalance || isProcessingDeposit}
                  >
                    Max
                  </button>
                </div>
              </div>
              {(validationError || formError) && (
                <p className="text-xs text-red-500 pt-1">{validationError || formError}</p>
              )}
            </div>

            {/* Referrer Address */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-white">Referrer Address</Label>
                <span className="text-xs text-gray-400">Optional</span>
              </div>
              <Input
                placeholder="davidjohnston.eth"
                value={referrerAddress}
                onChange={(e) => setReferrerAddress(e.target.value)}
                className="bg-background border-gray-700"
                disabled={isProcessingDeposit}
              />
            </div>

            {/* Time Lock Period */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-white">Time Lock Period</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="6"
                  value={lockValue}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^\d+$/.test(value)) {
                      setLockValue(value);
                    }
                  }}
                  className="bg-background border-gray-700 flex-1"
                  disabled={isProcessingDeposit}
                />
                <Select value={lockUnit} onValueChange={(value: TimeUnit) => setLockUnit(value)}>
                  <SelectTrigger className="bg-background border-gray-700 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border-gray-700 z-[60]">
                    <SelectItem value="days" className="hover:bg-gray-800">Days</SelectItem>
                    <SelectItem value="months" className="hover:bg-gray-800">Months</SelectItem>
                    <SelectItem value="years" className="hover:bg-gray-800">Years</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Summary Section */}
            {amount && parseFloat(amount) > 0 && lockValue && parseInt(lockValue, 10) > 0 && (
              <div className="p-1 rounded-md text-sm bg-emerald-500/10 rounded-lg p-2">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Stake Amount</span>
                    <span className="text-white">{amount} {selectedAsset}</span>
                  </div>
                  {unlockDate && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Unlock Date</span>
                      <span className="text-white">
                        {unlockDate.toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Power Factor</span>
                    <span className="text-white">
                      {isSimulatingMultiplier ? "Loading..." : (estimatedMultiplierValue || "1.0x")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Est. Rewards Earned</span>
                    <span className="text-white">
                      {/* TODO: Calculate estimated rewards based on current rates */}
                      --- MOR
                    </span>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveModal(null)}
                disabled={isProcessingDeposit}
              >
                Cancel
              </Button>
              <button
                type="submit"
                className={
                  isProcessingDeposit || !!validationError || amountBigInt <= BigInt(0) || !userAddress ||
                  !lockValue || parseInt(lockValue, 10) <= 0
                    ? "copy-button-secondary px-2 text-sm opacity-50 cursor-not-allowed" 
                    : currentlyNeedsApproval
                    ? "copy-button-secondary px-2 text-sm" 
                    : "copy-button-base"
                }
                disabled={
                  isProcessingDeposit || 
                  !!validationError || 
                  amountBigInt <= BigInt(0) || 
                  !userAddress ||
                  !lockValue ||
                  parseInt(lockValue, 10) <= 0
                }
              >
                {isProcessingDeposit ? (
                  "Processing..."
                ) : (
                  currentlyNeedsApproval ? `Approve ${selectedAsset}` : "Confirm Deposit"
                )}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
} 