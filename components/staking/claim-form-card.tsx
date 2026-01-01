import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface ClaimFormCardProps {
  title?: string;
  description?: string;
  onClaim: () => void;
  buttonText?: string;
  claimableAmount?: number;
  disableClaiming?: boolean;
  tokenSymbol?: string;
  isClaiming?: boolean;
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
}: ClaimFormCardProps) {
  
  // Check if there are rewards to claim
  const hasClaimableRewards = claimableAmount > 0;

  const handleClaim = () => {
    if (hasClaimableRewards && !disableClaiming) {
      onClaim();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-bold">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="pt-1 px-6 pb-2">
        <div className="space-y-2">
          {/* Main content: Amount on left, Button on right */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="text-2xl font-bold text-white">
                {claimableAmount.toFixed(1)} {tokenSymbol}
              </div>
              {/* <div className="text-sm text-gray-400 mt-1">
                {hasClaimableRewards ? "Available to claim" : "No rewards available to claim"}
              </div> */}
            </div>
            
            <div className="shrink-0 ml-6">
              <button 
                onClick={handleClaim}
                className="copy-button-base copy-button-secondary px-6 hover:bg-black"
                disabled={disableClaiming || !hasClaimableRewards}
              >
                {isClaiming ? "Claiming..." : buttonText}
              </button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 