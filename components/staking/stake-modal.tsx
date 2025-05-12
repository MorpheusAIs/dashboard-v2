"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStakingContractInteractions } from "@/hooks/useStakingContractInteractions";
import { formatEther } from "viem";
import { useChainId } from "wagmi";
import { Builder } from "@/app/builders/builders-data";

interface StakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBuilder: Builder | null;
}

export function StakeModal({ 
  isOpen, 
  onClose, 
  selectedBuilder 
}: StakeModalProps) {
  const [stakeAmount, setStakeAmount] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const chainId = useChainId(); // Get current chain ID
  
  // Use the staking hook
  const {
    isCorrectNetwork,
    tokenSymbol,
    tokenBalance,
    needsApproval,
    isSubmitting,
    handleNetworkSwitch,
    handleApprove,
    handleStake,
    checkAndUpdateApprovalNeeded
  } = useStakingContractInteractions({
    subnetId: selectedBuilder?.id as `0x${string}` | undefined,
    networkChainId: chainId,
    onTxSuccess: () => {
      setStakeAmount("");
      onClose();
    }
  });

  // Format a value to one decimal place
  const formatToOneDecimal = useCallback((value: number): string => {
    return (Math.floor(value * 10) / 10).toString();
  }, []);
  
  // Handle max button click
  const handleMaxClick = () => {
    if (tokenBalance) {
      const maxAmount = parseFloat(formatEther(tokenBalance));
      // Format the max amount to one decimal place
      const formattedMaxAmount = formatToOneDecimal(maxAmount);
      setStakeAmount(formattedMaxAmount);
    }
  };

  // Check if entered amount is above minimum and below maximum
  const isAmountValid = useCallback(() => {
    const amount = parseFloat(stakeAmount);
    if (isNaN(amount) || amount <= 0) return false;
    
    // Check minimum deposit
    if (selectedBuilder?.minDeposit && amount < selectedBuilder.minDeposit) return false;
    
    // Check if amount is greater than balance
    if (tokenBalance && amount > parseFloat(formatEther(tokenBalance))) return false;
    
    return true;
  }, [stakeAmount, selectedBuilder, tokenBalance]);

  // Show warning based on validation conditions
  const displayWarning = useCallback(() => {
    if (!stakeAmount) return null;
    
    const amount = parseFloat(stakeAmount);
    if (isNaN(amount) || amount <= 0) return null;
    
    // Check if amount is greater than balance
    if (tokenBalance !== undefined) {
      const balance = parseFloat(formatEther(tokenBalance));
      if (amount > balance) {
        console.log('Warning: amount exceeds balance', { amount, balance });
        return `Warning: Insufficient ${tokenSymbol} balance`;
      }
    }
    
    // Check minimum deposit
    if (selectedBuilder?.minDeposit && amount < selectedBuilder.minDeposit) {
      console.log('Warning: amount below min deposit', { amount, minDeposit: selectedBuilder.minDeposit });
      return `Minimum deposit is ${selectedBuilder.minDeposit} ${tokenSymbol}`;
    }
    
    return null;
  }, [stakeAmount, tokenBalance, tokenSymbol, selectedBuilder]);

  // Check approval status when amount changes
  useEffect(() => {
    if (stakeAmount && parseFloat(stakeAmount) > 0) {
      checkAndUpdateApprovalNeeded(stakeAmount);
    }
  }, [stakeAmount, checkAndUpdateApprovalNeeded]);
  
  // Debug logs to help troubleshoot
  useEffect(() => {
    if (stakeAmount) {
      const amount = parseFloat(stakeAmount);
      const balance = tokenBalance ? parseFloat(formatEther(tokenBalance)) : 0;
      
      console.log("Validation state:", {
        amount,
        balance,
        isValid: isAmountValid(),
        warning: displayWarning(),
        exceedsBalance: amount > balance
      });
    }
  }, [stakeAmount, tokenBalance, isAmountValid, displayWarning]);

  // Reset form state when modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      setStakeAmount("");
      setFormError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    // Use our validation function
    if (!isAmountValid()) {
      setFormError(displayWarning() || "Invalid amount");
      return;
    }

    try {
      // If not on the correct network, switch first
      if (!isCorrectNetwork()) {
        await handleNetworkSwitch();
        return;
      }

      // Check if approval is needed
      const currentlyNeedsApproval = stakeAmount ? await checkAndUpdateApprovalNeeded(stakeAmount) : false;

      if ((currentlyNeedsApproval || needsApproval) && stakeAmount && parseFloat(stakeAmount) > 0) {
        await handleApprove(stakeAmount);
      } else if (stakeAmount && parseFloat(stakeAmount) > 0) {
        await handleStake(stakeAmount);
      }
    } catch (error) {
      console.error("Stake/Approve Action Error:", error);
      setFormError((error as Error)?.message || "An unexpected error occurred.");
    }
  };

  // Get warning message
  const warningMessage = displayWarning();
  
  // Separate check for amount exceeded (for button disable logic)
  const amountExceedsBalance = useMemo(() => {
    if (!stakeAmount || !tokenBalance) return false;
    
    const amount = parseFloat(stakeAmount);
    const balance = parseFloat(formatEther(tokenBalance));
    
    return !isNaN(amount) && amount > balance;
  }, [stakeAmount, tokenBalance]);
  
  // Network name for display
  const networkToUse = selectedBuilder?.networks?.[0] || 'appropriate network';
  
  // Check if we're on the correct network for this builder
  const onCorrectNetwork = isCorrectNetwork();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px] bg-background border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-emerald-400">
            Stake {tokenSymbol} on {selectedBuilder?.name || "Builder"}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Support this builder by staking your tokens.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="stake-amount" className="text-sm font-medium">
              Amount to stake
            </Label>
            <div className="relative">
              <Input
                id="stake-amount"
                placeholder="0.0"
                value={stakeAmount}
                onChange={(e) => {
                  // Only allow numbers and decimal point
                  const value = e.target.value;
                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
                    setStakeAmount(value);
                    setFormError(null);
                    
                    // Immediately check if we should show warnings
                    const amount = parseFloat(value);
                    if (!isNaN(amount)) {
                      if (tokenBalance && amount > parseFloat(formatEther(tokenBalance))) {
                        console.log("Amount exceeds balance:", amount, parseFloat(formatEther(tokenBalance)));
                      }
                      
                      if (selectedBuilder?.minDeposit && amount < selectedBuilder.minDeposit) {
                        console.log("Amount below min deposit:", amount, selectedBuilder.minDeposit);
                      }
                    }
                  }
                }}
                className={`bg-background border-gray-700 pr-32 ${amountExceedsBalance ? 'border-yellow-500' : ''}`}
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[.]?[0-9]*"
                min="0"
                disabled={isSubmitting}
                required
                onKeyDown={(e) => {
                  // Prevent 'e', '-', '+' keys
                  if (['e', 'E', '-', '+'].includes(e.key)) {
                    e.preventDefault();
                  }
                }}
              />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                {tokenBalance !== undefined && (
                  <span className="text-xs text-gray-400 mr-2">
                    {parseFloat(formatEther(tokenBalance)).toFixed(1)} {tokenSymbol}
                  </span>
                )}
                <button
                  type="button"
                  className="h-8 px-2 text-xs copy-button-secondary"
                  onClick={handleMaxClick}
                  disabled={!tokenBalance || isSubmitting}
                >
                  Max
                </button>
              </div>
            </div>
            {formError && (
              <p className="text-xs text-red-500 pt-1">{formError}</p>
            )}
          </div>

          {warningMessage && (
            <div className="text-yellow-400 text-sm">
              {warningMessage}
            </div>
          )}

          {selectedBuilder && (
            <div className="p-1 rounded-md text-sm">
              <p className="text-gray-300 mb-1"><strong>Lock period:</strong> {selectedBuilder.lockPeriod || "N/A"}</p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button" 
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className={`${!onCorrectNetwork ? 'bg-blue-500 hover:bg-blue-600' : 'bg-emerald-500 hover:bg-emerald-600'} text-white`}
              disabled={
                isSubmitting || 
                !stakeAmount || 
                (onCorrectNetwork && !!warningMessage) ||
                isNaN(parseFloat(stakeAmount)) || 
                parseFloat(stakeAmount) <= 0
              }
            >
              {isSubmitting ? (
                "Processing..."
              ) : !onCorrectNetwork ? (
                `Switch to ${networkToUse}`
              ) : (needsApproval && stakeAmount && parseFloat(stakeAmount) > 0) ? (
                `Approve ${tokenSymbol}`
              ) : (
                `Stake ${tokenSymbol}`
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 