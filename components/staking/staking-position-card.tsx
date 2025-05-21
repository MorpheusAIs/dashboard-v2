import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export interface StakingPositionCardProps {
  title?: string;
  description?: string;
  userStakedAmount: number;
  timeUntilUnlock?: string;
  onWithdraw: (amount: string) => void;
  disableWithdraw?: boolean;
  withdrawButtonText?: string;
  showUnlockTime?: boolean;
  additionalInfo?: React.ReactNode;
  isWithdrawing?: boolean;
  tokenSymbol?: string;
}

export function StakingPositionCard({
  title = "Your Position",
  description = "",
  userStakedAmount,
  timeUntilUnlock,
  onWithdraw,
  disableWithdraw = false,
  withdrawButtonText = "Withdraw MOR",
  showUnlockTime = true,
  additionalInfo,
  isWithdrawing = false,
  tokenSymbol = "MOR",
}: StakingPositionCardProps) {
  const [withdrawAmount, setWithdrawAmount] = useState("");
  
  // Handle input change with TWO decimal place formatting (updated from 1)
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newAmount = e.target.value;
    
    // Prevent negative values
    if (parseFloat(newAmount) < 0) {
      newAmount = "0";
    }
    
    // Format to TWO decimal places if there's a decimal point
    if (newAmount.includes('.')) {
      const parts = newAmount.split('.');
      if (parts[1].length > 2) { // Changed from 1 to 2
        newAmount = `${parts[0]}.${parts[1].substring(0, 2)}`; // Changed from 1 to 2
      }
    }
    
    setWithdrawAmount(newAmount);
  };

  // Add useEffect to listen for reset-withdraw-form event
  useEffect(() => {
    const resetForm = () => {
      setWithdrawAmount("");
    };
    
    document.addEventListener('reset-withdraw-form', resetForm);
    return () => {
      document.removeEventListener('reset-withdraw-form', resetForm);
    };
  }, []);

  const handleWithdraw = () => {
    onWithdraw(withdrawAmount);
  };

  const setMaxAmount = () => {
    // Use exact amount with 2 decimal precision (no rounding/flooring)
    const formattedMaxAmount = userStakedAmount > 0
      ? userStakedAmount.toFixed(2)
      : "0";
    setWithdrawAmount(formattedMaxAmount);
  };

  const isAmountExceedingBalance = parseFloat(withdrawAmount) > userStakedAmount;
  const isAmountInvalid = parseFloat(withdrawAmount) <= 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-bold">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">Your staked amount:</span>
            <span className="text-gray-200">{userStakedAmount.toFixed(2)} {tokenSymbol}</span>
          </div>
          
          {showUnlockTime && timeUntilUnlock && (
            <div className="flex justify-between text-sm mb-4">
              <span className="text-gray-400">Time until unlock:</span>
              <span className="text-gray-200">{timeUntilUnlock}</span>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="withdraw-amount">Amount to withdraw</Label>
            <div className="relative">
              <Input
                id="withdraw-amount"
                type="number"
                min="0"
                step="0.01"
                placeholder={`Enter ${tokenSymbol} amount`}
                value={withdrawAmount}
                onChange={handleAmountChange}
                disabled={disableWithdraw}
                className="pr-16" // Reduced padding since we're removing the balance display
              />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                <button
                  type="button"
                  className="h-8 px-2 text-xs copy-button-secondary"
                  onClick={setMaxAmount}
                  disabled={disableWithdraw || userStakedAmount <= 0}
                >
                  Max
                </button>
              </div>
            </div>
            {isAmountExceedingBalance && (
              <p className="text-yellow-400 text-sm">
                You are trying to withdraw more {tokenSymbol} than you have staked.
              </p>
            )}
            {isAmountInvalid && withdrawAmount !== "" && (
              <p className="text-yellow-400 text-sm">
                Withdrawal amount must be greater than zero.
              </p>
            )}
          </div>
          
          <Button 
            onClick={handleWithdraw}
            className="w-full"
            variant="outline"
            disabled={disableWithdraw || !withdrawAmount || isWithdrawing || isAmountExceedingBalance || isAmountInvalid}
          >
            {isWithdrawing ? "Withdrawing..." : withdrawButtonText}
          </Button>
          
          {additionalInfo}
        </div>
      </CardContent>
    </Card>
  );
} 