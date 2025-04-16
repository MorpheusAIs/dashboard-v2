import { useState } from "react";
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
  
  // Handle input change with one decimal place formatting
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newAmount = e.target.value;
    
    // Prevent negative values
    if (parseFloat(newAmount) < 0) {
      newAmount = "0";
    }
    
    // Format to one decimal place if there's a decimal point
    if (newAmount.includes('.')) {
      const parts = newAmount.split('.');
      if (parts[1].length > 1) {
        newAmount = `${parts[0]}.${parts[1].substring(0, 1)}`;
      }
    }
    
    setWithdrawAmount(newAmount);
  };

  const handleWithdraw = () => {
    onWithdraw(withdrawAmount);
  };

  const setMaxAmount = () => {
    // Format the max amount to one decimal place
    const formattedMaxAmount = userStakedAmount > 0
      ? (Math.floor(userStakedAmount * 10) / 10).toString()
      : "0";
    setWithdrawAmount(formattedMaxAmount);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">Your staked amount:</span>
            <span className="text-gray-200">{userStakedAmount.toLocaleString()} {tokenSymbol}</span>
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
                step="0.1"
                placeholder={`Enter ${tokenSymbol} amount`}
                value={withdrawAmount}
                onChange={handleAmountChange}
                disabled={disableWithdraw}
                className="pr-16" // Reduced padding since we're removing the balance display
              />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs bg-gray-800"
                  onClick={setMaxAmount}
                  disabled={disableWithdraw || userStakedAmount <= 0}
                >
                  Max
                </Button>
              </div>
            </div>
          </div>
          
          <Button 
            onClick={handleWithdraw}
            className="w-full"
            variant="outline"
            disabled={disableWithdraw || !withdrawAmount || isWithdrawing}
          >
            {isWithdrawing ? "Withdrawing..." : withdrawButtonText}
          </Button>
          
          {additionalInfo}
        </div>
      </CardContent>
    </Card>
  );
} 