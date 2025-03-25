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

export interface StakingFormCardProps {
  title?: string;
  description?: string;
  onStake: (amount: string) => void;
  buttonText?: string;
  minAmount?: number;
  maxAmount?: number;
  disableStaking?: boolean;
  showWarning?: boolean;
  warningMessage?: string;
}

export function StakingFormCard({
  title = "Stake MOR",
  description = "Stake MOR to support this project",
  onStake,
  buttonText = "Stake MOR",
  minAmount,
  maxAmount,
  disableStaking = false,
  showWarning = false,
  warningMessage = "Warning: You don't have enough MOR to stake this amount.",
}: StakingFormCardProps) {
  const [stakeAmount, setStakeAmount] = useState("");
  
  // Check if entered amount is above minimum and below maximum
  const isAmountValid = () => {
    const amount = parseFloat(stakeAmount);
    if (isNaN(amount) || amount <= 0) return false;
    
    if (minAmount !== undefined && amount < minAmount) return false;
    if (maxAmount !== undefined && amount > maxAmount) return false;
    
    return true;
  };
  
  // Show warning based on logic or explicit flag
  const displayWarning = showWarning || (
    maxAmount !== undefined && 
    parseFloat(stakeAmount) > maxAmount
  );

  const handleStake = () => {
    if (isAmountValid()) {
      onStake(stakeAmount);
    }
  };

  return (
    <Card>
      <CardHeader>
        {title && <CardTitle>{title}</CardTitle>}
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stake-amount">Amount to stake</Label>
            <Input
              id="stake-amount"
              type="number"
              placeholder="Enter MOR amount"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              disabled={disableStaking}
            />
          </div>
          
          {displayWarning && (
            <div className="text-yellow-400 text-sm">
              {warningMessage}
            </div>
          )}
          
          {minAmount !== undefined && (
            <div className="text-xs text-gray-400">
              Minimum stake: {minAmount.toLocaleString()} MOR
            </div>
          )}
          
          <Button 
            onClick={handleStake}
            className="w-full"
            disabled={disableStaking || !isAmountValid()}
          >
            {buttonText}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 