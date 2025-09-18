"use client";

import { useEffect, useState } from "react";
// import { type BaseError } from "wagmi";

import { Dialog, DialogPortal, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Import Context hook
import { useCapitalContext } from "@/context/CapitalPageContext";
import { useMORBalanceMonitor } from "@/hooks/use-mor-balance-refresh";

interface ClaimModalProps {
  claimableAmount: string; 
}

export function ClaimModal({
  claimableAmount
}: ClaimModalProps) {
  // Get state/control from context
  const {
    userAddress,
    claim,
    canClaim,
    isProcessingClaim,
    activeModal,
    setActiveModal,
    isClaimSuccess,
    claimHash,
    lastHandledClaimHash
  } = useCapitalContext();

  const isOpen = activeModal === 'claim';

  const [formError, setFormError] = useState<string | null>(null);
  const [toastId, setToastId] = useState<string | number | null>(null);
  const [isWaitingForTokens, setIsWaitingForTokens] = useState(false);
  const [hasStartedClaim, setHasStartedClaim] = useState(false);

  // Balance monitoring for MOR tokens
  const { stopMonitoring } = useMORBalanceMonitor(
    isWaitingForTokens,
    (newBalance, increase) => {
      // Balance increased - tokens received!
      console.log('🎉 MOR tokens received! Balance increased by', increase);
      if (toastId) {
        toast.dismiss(toastId);
      }
      toast.success(`🎉 MOR Claimed Successfully! Received ${increase.toFixed(4)} MOR`, {
        description: `Your new balance is ${newBalance.toFixed(4)} MOR`,
        duration: 5000
      });
      setToastId(null);
      setIsWaitingForTokens(false);
      setHasStartedClaim(false);
      setActiveModal(null); // Close modal
    },
    () => {
      // Monitoring timed out
      console.log('⏰ Balance monitoring timed out');
      if (toastId) {
        toast.dismiss(toastId);
      }
      toast.warning("Still waiting for MOR tokens...", {
        description: "The claim transaction was successful, but tokens haven't arrived yet. Check your balance in a few minutes.",
        duration: 5000
      });
      setToastId(null);
      setIsWaitingForTokens(false);
      setHasStartedClaim(false);
      setActiveModal(null); // Close modal
    }
  );

  // Detect when claim transaction is confirmed and start monitoring
  useEffect(() => {
    if (isClaimSuccess && claimHash && claimHash !== lastHandledClaimHash && hasStartedClaim) {
      console.log('✅ Claim transaction confirmed, starting balance monitoring');
      setIsWaitingForTokens(true);

      // Update toast to show we're waiting for tokens
      if (toastId) {
        toast.loading("Transaction confirmed! Waiting for MOR tokens...", {
          id: toastId,
          description: "Tokens will arrive on Arbitrum Sepolia shortly",
          duration: Infinity
        });
      }
    }
  }, [isClaimSuccess, claimHash, lastHandledClaimHash, hasStartedClaim, toastId]);

  const handleSubmit = async () => {
    setFormError(null);
    if (!canClaim) {
      setFormError("Claim is currently locked.");
      return;
    }
    if (!claimableAmount || parseFloat(claimableAmount) <= 0) {
      setFormError("No rewards available to claim");
      return;
    }

    try {
      // Mark that we've started the claim process
      setHasStartedClaim(true);

      // Show loading toast
      const loadingToastId = toast.loading("Claiming MOR rewards...", {
        description: "Processing transaction on Ethereum Sepolia",
        duration: Infinity
      });
      setToastId(loadingToastId);

      await claim();

      // Transaction submitted successfully - wait for confirmation
      console.log('📤 Claim transaction submitted, waiting for confirmation...');

    } catch (error) {
      console.error("Claim Action Error:", error);
      // Dismiss loading toast and show error
      if (toastId) {
        toast.dismiss(toastId);
        setToastId(null);
      }
      toast.error("Claim Failed", {
        description: (error as Error)?.message || "An unexpected error occurred.",
        duration: 5000
      });
      setFormError((error as Error)?.message || "An unexpected error occurred.");
      setIsWaitingForTokens(false);
      setHasStartedClaim(false);
    }
  };

  // Reset form error and cleanup monitoring when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setFormError(null);
      // Cleanup monitoring and toasts when modal closes
      setIsWaitingForTokens(false);
      setHasStartedClaim(false);
      if (toastId) {
        toast.dismiss(toastId);
        setToastId(null);
      }
      stopMonitoring();
    }
  }, [isOpen, toastId, stopMonitoring]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && setActiveModal(null)}>
      <DialogPortal>
        <DialogContent className="sm:max-w-[425px] bg-background border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-emerald-400">Claim MOR Rewards</DialogTitle>
            <DialogDescription className="text-gray-400">
              Claim your earned MOR rewards from the public pool.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="space-y-1 text-center">
              <p className="text-sm text-gray-400">Amount Available to Claim</p>
              <p className="text-3xl font-bold text-white">{claimableAmount} MOR</p>
              {!canClaim && (
                  <p className="text-xs text-yellow-400 pt-1">Claim is currently locked.</p>
              )}
              {isWaitingForTokens && (
                <div className="pt-2">
                  <div className="inline-flex items-center space-x-2 text-sm text-blue-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-400 border-t-transparent"></div>
                    <span>Monitoring for token arrival...</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Checking Arbitrum Sepolia every 5 seconds</p>
                </div>
              )}
            </div>

            {formError && (
              <Alert variant="destructive" className="text-xs">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {formError}
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveModal(null)}
                disabled={isProcessingClaim || isWaitingForTokens}
              >
                {isWaitingForTokens ? "Close" : "Cancel"}
              </Button>
              <Button
                onClick={handleSubmit}
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
                disabled={isProcessingClaim || isWaitingForTokens || !canClaim || !claimableAmount || parseFloat(claimableAmount) <= 0 || !userAddress}
              >
                {isProcessingClaim ? "Processing Claim..." :
                 isWaitingForTokens ? "Waiting for Tokens..." :
                 "Confirm Claim"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
} 