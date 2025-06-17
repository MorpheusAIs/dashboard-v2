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
import { formatUnits } from "viem";

export interface WithdrawalPositionCardProps {
  title?: string;
  description?: string;
  userStakedAmount: number;
  rawStakedAmount?: bigint; // Add raw staked amount for accurate MAX button
  timeUntilUnlock?: string;
  onWithdraw: (amount: string) => void;
  disableWithdraw?: boolean;
  withdrawButtonText?: string;
  showUnlockTime?: boolean;
  additionalInfo?: React.ReactNode;
  isWithdrawing?: boolean;
  tokenSymbol?: string;
  compactMode?: boolean;
}

export function WithdrawalPositionCard({
  title = "Your Position",
  description = "",
  userStakedAmount,
  rawStakedAmount,
  timeUntilUnlock,
  onWithdraw,
  disableWithdraw = false,
  withdrawButtonText = "Withdraw MOR",
  showUnlockTime = true,
  additionalInfo,
  isWithdrawing = false,
  tokenSymbol = "MOR",
  compactMode = false,
}: WithdrawalPositionCardProps) {
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
    // Use raw staked amount for accurate MAX button to avoid rounding issues
    if (rawStakedAmount && rawStakedAmount > BigInt(0)) {
      // Convert raw amount to string with full precision, then format to reasonable decimals
      const exactAmount = formatUnits(rawStakedAmount, 18);
      setWithdrawAmount(exactAmount);
    } else {
      // Fallback to formatted amount if raw amount is not available
      const formattedMaxAmount = userStakedAmount > 0
        ? userStakedAmount.toFixed(2)
        : "0";
      setWithdrawAmount(formattedMaxAmount);
    }
  };

  const isAmountExceedingBalance = parseFloat(withdrawAmount) > userStakedAmount;
  const isAmountInvalid = parseFloat(withdrawAmount) <= 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-bold">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className={compactMode ? "pt-1 px-3 pb-3" : "pb-6 pt-2"}>
        <div className={compactMode ? "space-y-2" : "space-y-8"}>
          {/* Only show these rows in non-compact mode */}
          {!compactMode && (
            <div className="flex flex-col space-y-2">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Your deposited amount:</span>
                <span className="text-gray-200">{userStakedAmount.toFixed(2)} {tokenSymbol}</span>
              </div>
              
              {showUnlockTime && timeUntilUnlock && (
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Time until unlock:</span>
                  <span className="text-gray-200">{timeUntilUnlock}</span>
                </div>
              )}
            </div>
          )}
          
          <div className={`space-y-2 ${compactMode ? "pt-0" : "pt-[67px]"}`}>
            <div className="flex justify-between items-center">
              <Label htmlFor="withdraw-amount">Amount to withdraw</Label>
              {/* In compact mode, show time until unlock on the right side */}
              {compactMode && showUnlockTime && timeUntilUnlock && (
                <div className="text-sm text-gray-400">
                  <span className="text-gray-500">Time until unlock:</span>{" "}
                  <span className="text-gray-300">{timeUntilUnlock}</span>
                </div>
              )}
            </div>
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
                className={compactMode ? "pr-32" : "pr-16"} // More padding in compact mode for deposited amount + max button
              />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                {/* In compact mode, show deposited amount inside the input field */}
                {compactMode && userStakedAmount > 0 && (
                  <span className="text-xs text-gray-400 mr-2">
                    {userStakedAmount.toFixed(1)} {tokenSymbol}
                  </span>
                )}
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
                You are trying to withdraw more {tokenSymbol} than you have deposited.
              </p>
            )}
            {isAmountInvalid && withdrawAmount !== "" && (
              <p className="text-yellow-400 text-sm">
                Withdrawal amount must be greater than zero.
              </p>
            )}
          <Button 
            onClick={handleWithdraw}
            className="w-full mt-2!"
            variant="outline"
            disabled={disableWithdraw || !withdrawAmount || isWithdrawing || isAmountExceedingBalance || isAmountInvalid}
          >
            {isWithdrawing ? "Withdrawing..." : withdrawButtonText}
          </Button>
          
          {additionalInfo}
          </div>
          
        </div>
      </CardContent>
    </Card>
  );
} 