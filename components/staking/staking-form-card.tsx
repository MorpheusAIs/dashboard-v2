import { useState, useEffect, useCallback } from "react";
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
  onAmountChange?: (amount: string) => void;
  buttonText?: string;
  minAmount?: number;
  maxAmount?: number;
  disableStaking?: boolean;
  showWarning?: boolean;
  warningMessage?: string;
  tokenSymbol?: string;
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
  tokenSymbol = "MOR",
}: StakingFormCardProps) {
  const [stakeAmount, setStakeAmount] = useState("");
  
  // Format a value to one decimal place
  const formatToOneDecimal = useCallback((value: number): string => {
    return (Math.floor(value * 10) / 10).toString();
  }, []);
  
  // Handle max button click
  const handleMaxClick = () => {
    if (maxAmount !== undefined) {
      // Format the max amount to one decimal place
      const formattedMaxAmount = formatToOneDecimal(maxAmount);
      setStakeAmount(formattedMaxAmount);
      if (onAmountChange) {
        onAmountChange(formattedMaxAmount);
      }
    }
  };
  
  // Check if entered amount is above minimum and below maximum
  const isAmountValid = useCallback(() => {
    const amount = parseFloat(stakeAmount);
    if (isNaN(amount) || amount <= 0) return false;
    
    // Skip minimum validation if minAmount is undefined
    if (minAmount !== undefined && amount < minAmount) return false;
    if (maxAmount !== undefined && amount > maxAmount) return false;
    
    return true;
  }, [stakeAmount, minAmount, maxAmount]);
  
  // New: Check if the amount is just positive for approval
  const hasPositiveAmount = useCallback(() => {
    const amount = parseFloat(stakeAmount);
    return !isNaN(amount) && amount > 0;
  }, [stakeAmount]);
  
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
  }, [buttonText, showWarning, warningMessage, hasPositiveAmount, isAmountValid]);

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
    
    setStakeAmount(newAmount);
    if (onAmountChange) {
      onAmountChange(newAmount);
    }
  };

  // Determine button class
  const getButtonClass = useCallback(() => {
    const baseClass = "w-full copy-button-base";
    
    // If button text contains "approve", use white background with black text
    if (buttonText?.toLowerCase().includes('approve')) {
      return `${baseClass} bg-white text-black hover:bg-white/90`;
    }
    
    // For stake actions, use primary style
    return `${baseClass} copy-button`;
  }, [buttonText]);

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
            <div className="relative">
              <Input
                id="stake-amount"
                type="number"
                min="0"
                step="0.1"
                placeholder="Enter MOR amount"
                value={stakeAmount}
                onChange={handleAmountChange}
                className="pr-32" // Add padding for the button and balance
              />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                {maxAmount !== undefined && (
                  <span className="text-xs text-gray-400 mr-2">
                    {maxAmount >= 1 ? Math.floor(maxAmount) : maxAmount.toFixed(1)} {tokenSymbol}
                  </span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs bg-gray-800"
                  onClick={handleMaxClick}
                  disabled={maxAmount === undefined || maxAmount <= 0 || disableStaking}
                >
                  Max
                </Button>
              </div>
            </div>
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