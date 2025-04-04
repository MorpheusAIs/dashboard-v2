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
}: StakingPositionCardProps) {
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const handleWithdraw = () => {
    onWithdraw(withdrawAmount);
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
            <span className="text-gray-200">{userStakedAmount.toLocaleString()} MOR</span>
          </div>
          
          {showUnlockTime && timeUntilUnlock && (
            <div className="flex justify-between text-sm mb-4">
              <span className="text-gray-400">Time until unlock:</span>
              <span className="text-gray-200">{timeUntilUnlock}</span>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="withdraw-amount">Amount to withdraw</Label>
            <Input
              id="withdraw-amount"
              placeholder="Enter MOR amount"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              disabled={disableWithdraw}
            />
          </div>
          
          <Button 
            onClick={handleWithdraw}
            className="w-full"
            variant="outline"
            disabled={disableWithdraw || !withdrawAmount}
          >
            {withdrawButtonText}
          </Button>
          
          {additionalInfo}
        </div>
      </CardContent>
    </Card>
  );
} 