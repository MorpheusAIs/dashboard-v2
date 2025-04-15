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

export interface StakingFormCardProps {
  title?: string;
  description?: string;
  onStake: (amount: string) => void;
  onAmountChange?: (amount: string) => void;
  buttonText?: string;
  minAmount?: number;
  maxAmount?: number;
  disableStaking?: boolean;
  showWarning?: boolean;
  warningMessage?: string;
}

export function StakingFormCard({
  title = "Stake MOR",
  description = "",
  onStake,
  onAmountChange,
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
    
    // Skip minimum validation if minAmount is undefined
    if (minAmount !== undefined && amount < minAmount) return false;
    if (maxAmount !== undefined && amount > maxAmount) return false;
    
    return true;
  };
  
  // New: Check if the amount is just positive for approval
  const hasPositiveAmount = () => {
    const amount = parseFloat(stakeAmount);
    return !isNaN(amount) && amount > 0;
  };
  
  // Show warning based on logic or explicit flag
  const displayWarning = showWarning || (
    maxAmount !== undefined && 
    parseFloat(stakeAmount) > maxAmount
  );

  // Log props for debugging
  useEffect(() => {
    if (showWarning && buttonText) {
      console.log("StakingFormCard state:", {
        buttonText,
        showWarning,
        warningMessage,
        isApprovalButton: buttonText.toLowerCase().includes('approve'),
        hasPositiveAmount: hasPositiveAmount(),
        isAmountValid: isAmountValid()
      });
    }
  }, [buttonText, showWarning, warningMessage]);

  const handleStake = () => {
    // Add explicit logging for button click
    console.log("Button clicked:", { 
      buttonText, 
      isApproval: buttonText?.toLowerCase().includes('approve')
    });
    
    // Allow approval with any positive amount
    if (buttonText?.toLowerCase().includes('approve') && hasPositiveAmount()) {
      console.log("Calling onStake for approval with amount:", stakeAmount);
      onStake(stakeAmount);
    } 
    // For staking, require valid amount per requirements
    else if (isAmountValid()) {
      console.log("Calling onStake for staking with amount:", stakeAmount);
      onStake(stakeAmount);
    } else {
      console.log("Amount validation failed:", {
        amount: stakeAmount,
        parsedAmount: parseFloat(stakeAmount),
        minAmount,
        maxAmount,
        isPositive: hasPositiveAmount(),
        isValid: isAmountValid()
      });
    }
  };
  
  // Handle amount change with validation and callback
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Get the value from the input
    let newAmount = e.target.value;
    
    // Prevent negative values (input min attribute should handle this,
    // but this is a backup for manual entry or browsers that don't respect min)
    if (parseFloat(newAmount) < 0) {
      newAmount = "0";
    }
    
    setStakeAmount(newAmount);
    if (onAmountChange) {
      onAmountChange(newAmount);
    }
  };

  // Determine button class
  const getButtonClass = () => {
    const baseClass = "w-full copy-button-base";
    
    // If button text contains "approve", use white background with black text
    if (buttonText?.toLowerCase().includes('approve')) {
      return `${baseClass} bg-white text-black hover:bg-white/90`;
    }
    
    // For stake actions, use primary style
    return `${baseClass} copy-button`;
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
              min="0"
              step="any"
              placeholder="Enter MOR amount"
              value={stakeAmount}
              onChange={handleAmountChange}
            />
          </div>
          
          {displayWarning && (
            <div className="text-yellow-400 text-sm">
              {warningMessage}
            </div>
          )}
          
          <button 
            onClick={handleStake}
            className={getButtonClass()}
            disabled={
              disableStaking || 
              // For approval buttons, only require a positive amount
              (buttonText?.toLowerCase().includes('approve') 
                ? !hasPositiveAmount() 
                : !isAmountValid())
            }
          >
            {buttonText}
          </button>
        </div>
      </CardContent>
    </Card>
  );
} 