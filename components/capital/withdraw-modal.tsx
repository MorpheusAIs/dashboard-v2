"use client";

import { useState, useEffect, useMemo } from "react";
import { parseUnits } from "viem";

import { Dialog, DialogPortal, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useCapitalContext } from "@/context/CapitalPageContext";

interface WithdrawModalProps {
  depositedAmount: string;
}

export function WithdrawModal({ 
  depositedAmount = "0"
}: WithdrawModalProps) {
  const {
    userAddress,
    withdraw,
    canWithdraw,
    isProcessingWithdraw,
    activeModal,
    setActiveModal
  } = useCapitalContext();

  const isOpen = activeModal === 'withdraw';

  const [amount, setAmount] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const amountBigInt = useMemo(() => {
    try {
      return amount ? parseUnits(amount, 18) : BigInt(0);
    } catch { 
      return BigInt(0); 
    }
  }, [amount]);

  const numericDeposited = useMemo(() => {
    try {
      return parseFloat(depositedAmount);
    } catch {
      return 0;
    }
  }, [depositedAmount]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    const numericAmount = parseFloat(amount);

    if (!canWithdraw) {
      setFormError("Withdrawal is currently locked.");
      return;
    }
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setFormError("Please enter a valid amount to withdraw");
      return;
    }
    if (numericAmount > numericDeposited) {
      setFormError("Withdrawal amount cannot exceed your deposited amount");
      return;
    }
    
    try {
      await withdraw(amount);
    } catch (error) {
      console.error("Withdraw Action Error:", error);
      setFormError((error as Error)?.message || "An unexpected error occurred.");
    }
  };

  const handleMaxClick = () => {
    setAmount(depositedAmount);
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
            <DialogTitle className="text-xl font-bold text-emerald-400">Withdraw stETH/wstETH</DialogTitle>
            <DialogDescription className="text-gray-400">
              Withdraw your deposited capital from the public pool.
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
                  className={`bg-background border-gray-700 pr-28 ${formError ? 'border-red-500' : ''}`}
                  type="text" // Changed from "number" to "text" for better control
                  inputMode="decimal" // Suggests a decimal keypad on mobile
                  pattern="[0-9]*[.]?[0-9]*" // HTML5 pattern for numbers only
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
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 space-x-2">
                  <span className="text-sm text-gray-400">{parseFloat(depositedAmount).toFixed(2)} stETH</span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleMaxClick}
                    className="h-7 px-2 text-xs"
                    disabled={isProcessingWithdraw || !canWithdraw}
                  >
                    Max
                  </Button>
                </div>
              </div>
              {!canWithdraw && numericDeposited > 0 && (
                <p className="text-xs text-yellow-400 pt-1">Withdrawal is currently locked.</p>
              )}
              {formError && !(!canWithdraw && numericDeposited > 0) && (
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
              <Button
                type="submit"
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
                disabled={isProcessingWithdraw || !canWithdraw || amountBigInt <= BigInt(0) || amountBigInt > parseUnits(depositedAmount, 18) || !userAddress}
              >
                {isProcessingWithdraw ? "Withdrawing..." : "Confirm Withdraw"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
} 