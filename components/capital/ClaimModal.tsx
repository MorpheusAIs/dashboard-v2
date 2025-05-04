"use client";

import { useEffect, useState } from "react";
// import { type BaseError } from "wagmi";

import { Dialog, DialogPortal, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
// import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Import Context hook
import { useCapitalContext } from "@/context/CapitalPageContext";

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
    setActiveModal
  } = useCapitalContext();
  
  const isOpen = activeModal === 'claim';

  const [formError, setFormError] = useState<string | null>(null);

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
      await claim();
      // Context action now handles closing on success
      // onOpenChange(false);
    } catch (error) {
      console.error("Claim Action Error:", error);
      setFormError((error as Error)?.message || "An unexpected error occurred.");
    }
  };

  // Reset form error when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setFormError(null);
    }
  }, [isOpen]);

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
                disabled={isProcessingClaim}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
                disabled={isProcessingClaim || !canClaim || !claimableAmount || parseFloat(claimableAmount) <= 0 || !userAddress}
              >
                {isProcessingClaim ? "Claiming..." : "Confirm Claim"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
} 