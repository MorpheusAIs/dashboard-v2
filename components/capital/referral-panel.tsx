"use client";

import { useState, useEffect } from "react";
import { MetricCardMinimal } from "@/components/metric-card-minimal";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { useCapitalContext } from "@/context/CapitalPageContext";
import { toast } from "sonner";
import { formatAssetAmount } from "./utils/asset-formatters";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function ReferralPanel() {
  const { userAddress, referralData, claimReferralRewards } = useCapitalContext();
  const [isCopying, setIsCopying] = useState(false);
  const [currentDomain, setCurrentDomain] = useState('');
  const [showClaimDialog, setShowClaimDialog] = useState(false);
  const [isHoveringEarnText, setIsHoveringEarnText] = useState(false);

  // Set current domain after component mounts (client-side only)
  useEffect(() => {
    setCurrentDomain(window.location.origin);
  }, []);

  // Generate referral link
  const referralLink = userAddress && currentDomain
    ? `${currentDomain}/capital?referrer=${userAddress}`
    : "";

  // Copy to clipboard function
  const handleCopyReferralLink = async () => {
    if (!referralLink) return;
    
    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(referralLink);
      toast.success("Referral link copied to clipboard");
    } catch {
      toast.error("Failed to copy referral link");
    } finally {
      setIsCopying(false);
    }
  };

  // Handle referral rewards claim - show confirmation dialog first
  const handleClaimReferralRewards = () => {
    if (!userAddress) return;
    setShowClaimDialog(true);
  };

  // Execute the actual claim after confirmation
  const executeClaimReferralRewards = async () => {
    setShowClaimDialog(false);
    if (!userAddress) return;
    
    try {
      await claimReferralRewards();
    } catch (error) {
      console.error('Error claiming referral rewards:', error);
      // Error handling is done in the context via toast notifications
    }
  };

  // Check if user has any claimable referral rewards
  const hasClaimableRewards = referralData.assetsWithClaimableRewards.length > 0;

  // Component for displaying referral amounts
  const ReferralAmountsDisplay = () => {
    if (referralData.isLoadingReferralData) {
      return (
        <div className="text-gray-400 text-center py-4">
          Loading...
        </div>
      );
    }

    // Access referral amounts data
    const referralAmounts = referralData.referralAmountsByAsset;

    if (!referralAmounts || referralAmounts.length === 0) {
      return (
        <div
          className="text-left cursor-pointer transition-colors text-emerald-400 hover:underline underline-offset-2 hover:translate-y-[-1px]"
          onMouseEnter={() => setIsHoveringEarnText(true)}
          onMouseLeave={() => setIsHoveringEarnText(false)}
        >
          Earn MOR by referring people
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <div className="flex gap-3 pb-2">
          {/* @ts-expect-error - TypeScript cannot infer the exact structure of referralAmounts */}
          {referralAmounts.map((item) => {
            const amount = parseFloat(item.formattedAmount);
            const formattedAmount = formatAssetAmount(amount, item.asset);

            return (
              <div
                key={item.asset}
                className="flex flex-row items-center gap-1 justify-between rounded-lg px-2 py-1 border border-emerald-400/40"
              >
                <div className="text-sm font-medium text-white">{formattedAmount}</div>
                <div className="text-xs text-gray-400 uppercase">{item.asset}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Format MOR values using same logic as daily emissions (4 decimals if < 0.01, 2 decimals otherwise)
  const formatMorValue = (value: string | number): string => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '0';
    return numValue < 0.01 ? numValue.toFixed(4) : numValue.toFixed(2);
  };

  return (
    <div className="page-section mt-8">
      <div className="relative">
        <GlowingEffect 
          spread={40}
          glow={true}
          disabled={false}
          proximity={64}
          inactiveZone={0.01}
          borderWidth={2}
          borderRadius="rounded-xl"
        />
        <div className="section-content group relative px-1 py-4 sm:p-6">
          <div className="section-content-gradient group-hover:bg-gradient-to-bl group-hover:from-emerald-400/10 group-hover:to-transparent" />
          <div className="p-4 md:p-6">
            {/* Header with button */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Referrals</h2>
              <button
                className={`copy-button-secondary font-medium px-4 py-2 rounded-lg transition-all duration-200 ${
                  !userAddress || !hasClaimableRewards || referralData.isLoadingReferralData 
                    ? '' 
                    : 'hover:copy-button'
                }`}
                onClick={handleClaimReferralRewards}
                disabled={!userAddress || !hasClaimableRewards || referralData.isLoadingReferralData}
              >
                {referralData.isLoadingReferralData ? "Loading..." : "Claim Rewards"}
              </button>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 sm:gap-4">
              {/* Total Deposited by Referrals */}
              <div className="col-span-1">
                <div className="card-minimal group relative p-4 h-full flex flex-col justify-center">
                  <div className="text-sm text-gray-400 mb-2">
                    Current Deposits by Referrals ({referralData.isLoadingReferralData ? "---" : referralData.totalReferrals})
                  </div>
                  <ReferralAmountsDisplay />
                </div>
              </div>

              {/* Claimable Rewards */}
              <div className="col-span-1">
                <MetricCardMinimal
                  title="Claimable Rewards"
                  value={referralData.isLoadingReferralData ? "---" : formatMorValue(referralData.claimableRewards)}
                  label={referralData.isLoadingReferralData ? "" : "MOR"}
                  disableGlow={true}
                  autoFormatNumbers={false}
                  className="h-full"
                />
              </div>
              {/* Lifetime Value Generated */}
              <div className="col-span-1">
                <MetricCardMinimal
                  title="Total MOR Earned"
                  value={referralData.isLoadingReferralData ? "---" : formatMorValue(referralData.lifetimeRewards)}
                  label={referralData.isLoadingReferralData ? "" : "MOR"}
                  disableGlow={true}
                  autoFormatNumbers={false}
                  className="h-full"
                />
              </div>


              {/* Referral Link */}
              <div className="col-span-1">
                <div className={`card-minimal group relative p-4 h-full flex flex-col justify-center transition-all duration-300 ${
                  isHoveringEarnText ? 'ring-2 ring-emerald-400 ring-opacity-75 animate-pulse' : ''
                }`}>
                  <div className="text-sm text-gray-400 mb-2">My Referral Link</div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-gray-200 truncate flex-1 font-mono text-sm">
                      {userAddress ? referralLink : "Connect wallet to generate link"}
                    </div>
                    {userAddress && (
                      <button
                        onClick={handleCopyReferralLink}
                        disabled={isCopying}
                        className="text-emerald-400 hover:text-emerald-300 transition-colors text-sm font-medium whitespace-nowrap"
                      >
                        {isCopying ? "Copying..." : "Copy"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Claim Confirmation Dialog */}
      <AlertDialog open={showClaimDialog} onOpenChange={setShowClaimDialog}>
        <AlertDialogContent className="bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-emerald-400">
              How claiming MOR rewards works?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300 leading-relaxed">
              When you claim MOR referral rewards:
              <br />
              <br />
              • MOR tokens are minted directly on Arbitrum (Layer 2)
              <br />
              • The transaction is processed cross-chain from Ethereum
              <br />
              • It may take 5-10 minutes for the MOR tokens to appear in your wallet balance
              <br />
              • You&apos;ll need a small amount of ETH (~0.01 ETH) for cross-chain gas fees
              <br />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={executeClaimReferralRewards}
              className="copy-button"
            >
              Proceed to Claim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 
