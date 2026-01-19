"use client";

import { useState, useMemo, useEffect } from "react";

import { Dialog, DialogPortal, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Import Context hooks - Using new focused contexts
import {
  useCapitalNetwork,
  useCapitalModal,
  useSelectedAsset,
  useCapitalTransactions,
  type TimeUnit,
} from "@/context/capital";
import { formatTimestamp, formatBigInt } from "@/lib/utils/formatters";

interface ChangeLockModalProps {
  currentUserMultiplierData?: bigint;
  userData?: { claimLockEnd?: bigint };
}

export function ChangeLockModal({
  currentUserMultiplierData,
  userData
}: ChangeLockModalProps) {
  // Get state/control from focused contexts
  const { userAddress } = useCapitalNetwork();
  const { activeModal, setActiveModal } = useCapitalModal();
  const { selectedAsset } = useSelectedAsset();
  const {
    changeLock,
    triggerMultiplierEstimation,
    estimatedMultiplierValue,
    isSimulatingMultiplier,
    isProcessingChangeLock,
  } = useCapitalTransactions();

  const isOpen = activeModal === 'changeLock';

  const [lockValue, setLockValue] = useState<string>("");
  const [lockUnit, setLockUnit] = useState<TimeUnit>("days");
  // const [estimatedMultiplier, setEstimatedMultiplier] = useState<string | null>("---x"); // Removed local state
  const [formError, setFormError] = useState<string | null>(null);

  // Format existing data
  const currentLockEndFormatted = useMemo(() => formatTimestamp(userData?.claimLockEnd), [userData?.claimLockEnd]);
  const currentMultiplierFormatted = useMemo(() => currentUserMultiplierData ? `${formatBigInt(currentUserMultiplierData, 24, 1)}x` : "---x", [currentUserMultiplierData]);

  // Effect to trigger multiplier estimation when duration changes
  useEffect(() => {
    if (isOpen) { // Only trigger when modal is open
        triggerMultiplierEstimation(lockValue, lockUnit);
    }
  }, [isOpen, lockValue, lockUnit, triggerMultiplierEstimation]); // Dependencies updated

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    if (!lockValue || parseInt(lockValue, 10) <= 0) {
      setFormError("Please enter a valid lock duration");
      return;
    }
    
    try {
      await changeLock(selectedAsset, lockValue, lockUnit);
      // Context action now handles closing on success
    } catch (error) {
      console.error("Change Lock Action Error:", error);
      setFormError((error as Error)?.message || "An unexpected error occurred.");
    }
  };

  // Reset form state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setLockValue("");
      setLockUnit("days");
      setFormError(null);
      // Reset simulation args when closing
      triggerMultiplierEstimation("", "days"); 
    }
  }, [isOpen, triggerMultiplierEstimation]); // Added trigger dependency

  return (
    // Use context state for open and onOpenChange
    <Dialog open={isOpen} onOpenChange={(open) => !open && setActiveModal(null)}>
      <DialogPortal>
        <DialogContent className="sm:max-w-[425px] bg-background border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-emerald-400">Stake MOR Rewards / Change Lock</DialogTitle>
            <DialogDescription className="text-gray-400">
              Increase your Power Factor (reward multiplier) by selecting a longer lock period for your next claim.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="lock-value" className="text-sm font-medium">
                New Lock Period
              </Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="lock-value"
                  placeholder="e.g., 30"
                  value={lockValue}
                  onChange={(e) => { setLockValue(e.target.value); setFormError(null); }}
                  className={`bg-background border-gray-700 w-1/2 ${formError && (!lockValue || parseInt(lockValue, 10) <= 0) ? 'border-red-500' : ''}`}
                  type="number"
                  min="1"
                  required
                  disabled={isProcessingChangeLock}
                />
                <Select 
                  value={lockUnit}
                  onValueChange={(value: TimeUnit) => setLockUnit(value)}
                  disabled={isProcessingChangeLock}
                >
                  <SelectTrigger className="w-1/2">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days">Days</SelectItem>
                    <SelectItem value="months">Months</SelectItem>
                    <SelectItem value="years">Years</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="text-sm space-y-1 border border-gray-700 rounded-md p-3 bg-background/30">
              <div className="flex justify-between">
                <span>Current Lock Until:</span> 
                <span className="text-white font-medium">{currentLockEndFormatted}</span>
              </div>
              <div className="flex justify-between">
                <span>Current Power Factor:</span> 
                <span className="text-white font-medium">{currentMultiplierFormatted}</span>
              </div>
              <div className="flex justify-between">
                <span>Estimated New Power Factor:</span>
                <span className="text-emerald-400 font-medium">
                  {estimatedMultiplierValue}
                </span>
              </div>
            </div>

            {formError && (
               <p className="text-xs text-red-500 pt-1">{formError}</p>
            )}
            {/* Context handles transaction errors via toasts */}

            <DialogFooter className="pt-2">
              <Button
                type="button" 
                variant="outline"
                onClick={() => setActiveModal(null)} // Use context action
                disabled={isProcessingChangeLock}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
                disabled={isProcessingChangeLock || !lockValue || parseInt(lockValue, 10) <= 0 || !userAddress || isSimulatingMultiplier}
              >
                {isProcessingChangeLock ? "Updating..." : "Confirm Lock Change"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
} 