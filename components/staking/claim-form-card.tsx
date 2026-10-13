import { useEffect, useMemo, useState } from "react";
import { isAddress } from "viem";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ClaimFormCardProps {
  title?: string;
  description?: string;
  onClaim: (claimToAddress: `0x${string}`) => void | Promise<void>;
  buttonText?: string;
  claimableAmount?: number;
  disableClaiming?: boolean;
  tokenSymbol?: string;
  isClaiming?: boolean;
  connectedAddress?: `0x${string}`;
}

export function ClaimFormCard({
  title = "Your staking rewards",
  description = "",
  onClaim,
  buttonText = "Claim all",
  claimableAmount = 0,
  disableClaiming = false,
  tokenSymbol = "MOR",
  isClaiming = false,
  connectedAddress,
}: ClaimFormCardProps) {
  const [claimToAddress, setClaimToAddress] = useState("");
  const [isAddressAutoSet, setIsAddressAutoSet] = useState(false);

  useEffect(() => {
    if (connectedAddress && !claimToAddress) {
      setClaimToAddress(connectedAddress);
      setIsAddressAutoSet(true);
    }
  }, [connectedAddress, claimToAddress]);

  useEffect(() => {
    if (
      connectedAddress &&
      claimToAddress &&
      isAddressAutoSet &&
      claimToAddress !== connectedAddress
    ) {
      setClaimToAddress(connectedAddress);
    }
  }, [connectedAddress, claimToAddress, isAddressAutoSet]);

  const isClaimToAddressValid = useMemo(() => {
    if (!claimToAddress) return false;
    return isAddress(claimToAddress);
  }, [claimToAddress]);

  const hasClaimableRewards = claimableAmount > 0;

  const handleClaim = () => {
    if (
      hasClaimableRewards &&
      !disableClaiming &&
      isClaimToAddressValid
    ) {
      onClaim(claimToAddress as `0x${string}`);
    }
  };

  const handleAddressChange = (value: string) => {
    setClaimToAddress(value);
    setIsAddressAutoSet(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-bold">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="pt-1 px-6 pb-4">
        <div className="space-y-4">
          <div className="text-2xl font-bold text-white">
            {claimableAmount.toFixed(1)} {tokenSymbol}
          </div>

          <div className="space-y-2">
            <Label htmlFor="claim-to-address">Claim to address</Label>
            <Input
              id="claim-to-address"
              type="text"
              placeholder="0x..."
              value={claimToAddress}
              onChange={(e) => handleAddressChange(e.target.value)}
              disabled={disableClaiming || isClaiming}
            />
            <p className="text-xs text-gray-400">
              Rewards will be sent to this address. Defaults to your connected wallet.
            </p>
            {claimToAddress && !isClaimToAddressValid && (
              <p className="text-xs text-yellow-400">
                Please enter a valid Ethereum address
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleClaim}
              className="copy-button-base copy-button-secondary px-6 hover:bg-black"
              disabled={
                disableClaiming ||
                !hasClaimableRewards ||
                !isClaimToAddressValid
              }
            >
              {isClaiming ? "Claiming..." : buttonText}
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
