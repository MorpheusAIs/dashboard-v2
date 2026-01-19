"use client";

import React, { useState, useEffect } from "react";
import { MetricCardMinimal } from "@/components/metric-card-minimal";
import { GlowingEffect } from "@/components/ui/glowing-effect";
// Import Context and Hooks - Using new focused contexts
import {
  useCapitalNetwork,
  useCapitalReferral,
  useCapitalTransactions,
  type AssetSymbol,
} from "@/context/capital";
import { formatBigInt } from "@/lib/utils/formatters";
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
import { LiquidButton } from "@/components/ui/shadcn-io/liquid-button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// Wrap in React.memo to prevent unnecessary re-renders from parent component changes
export const ReferralPanel = React.memo(function ReferralPanel() {
  // Get state from focused contexts
  const { userAddress } = useCapitalNetwork();
  const referralCtx = useCapitalReferral();
  const { claimReferralRewards, isProcessingReferralClaim } = useCapitalTransactions();

  // Compute total claimable rewards from referralRewardsByAsset
  const totalClaimableRewards = (Object.values(referralCtx.referralRewardsByAsset) as (bigint | undefined)[]).reduce(
    (sum: bigint, value) => sum + (value ?? BigInt(0)),
    BigInt(0)
  );
  const claimableRewardsFormatted = formatBigInt(totalClaimableRewards, 18, 4);

  // Construct referralData object from context (backward compatibility)
  const referralData = {
    totalReferrals: String(referralCtx.totalReferrals),
    totalReferralAmount: referralCtx.totalReferralAmountFormatted,
    lifetimeRewards: referralCtx.totalMorEarnedFormatted,
    claimableRewards: claimableRewardsFormatted,
    isLoadingReferralData: referralCtx.isLoadingReferralData || referralCtx.isLoadingReferrerSummary || referralCtx.isLoadingReferralRewards,
    referralAmountsByAsset: referralCtx.referralAmountsByAsset,
    assetsWithClaimableRewards: referralCtx.assetsWithClaimableRewards,
  };
  const [isCopying, setIsCopying] = useState(false);
  const [currentDomain, setCurrentDomain] = useState('');
  const [showClaimDialog, setShowClaimDialog] = useState(false);
  const [isHoveringEarnText, setIsHoveringEarnText] = useState(false);
  const [showHowToReferDialog, setShowHowToReferDialog] = useState(false);
  const [showHowDoIEarnDialog, setShowHowDoIEarnDialog] = useState(false);

  // Set current domain after component mounts (client-side only)
  useEffect(() => {
    setCurrentDomain(window.location.origin);
  }, []);

  // Generate referral link
  const referralLink = userAddress && currentDomain
    ? `${currentDomain}/capital?referrer=${userAddress}`
    : "";

  // Copy to clipboard function with fallback
  const handleCopyReferralLink = async () => {
    if (!referralLink) return;
    
    setIsCopying(true);
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(referralLink);
        toast.success("Referral link copied to clipboard");
      } else {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement("textarea");
        textArea.value = referralLink;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          const successful = document.execCommand('copy');
          if (successful) {
            toast.success("Referral link copied to clipboard");
          } else {
            throw new Error("Copy command failed");
          }
        } finally {
          document.body.removeChild(textArea);
        }
      }
    } catch (error) {
      console.error("Failed to copy referral link:", error);
      toast.error("Failed to copy referral link. Please select and copy manually.");
    } finally {
      // Always reset copying state after a short delay to show feedback
      setTimeout(() => {
        setIsCopying(false);
      }, 500);
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
          {referralAmounts.map((item) => {
            const amount = parseFloat(item.formattedAmount);
            const formattedAmount = formatAssetAmount(amount, item.asset as AssetSymbol);

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
            {/* Header with buttons */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-white">Referrals</h2>
                <Dialog open={showHowDoIEarnDialog} onOpenChange={setShowHowDoIEarnDialog}>
                  <DialogTrigger asChild>
                    <LiquidButton size="sm" variant="ghost" className="rounded-lg">
                      How do I earn?
                    </LiquidButton>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>How do referrals work?</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <p className="text-muted-foreground text-sm">
                        Earn MOR rewards by referring people to deposit assets. Your rewards are based on a tier system where you earn a percentage of MOR emissions from the virtual staked assets of your referrals.
                      </p>
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="tiers" className="border-0">
                          <AccordionTrigger className="text-sm font-medium justify-start p-0 hover:no-underline">
                            See Referral Tiers
                          </AccordionTrigger>
                          <AccordionContent className="text-sm text-muted-foreground space-y-1 pb-0">
                            <div>• 1 stETH = 3%</div>
                            <div>• 2.5 stETH = 5%</div>
                            <div>• 25 stETH = 10%</div>
                            <div>• 62.5 stETH = 15%</div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>
                    <DialogFooter>
                      <DialogClose className="bg-white text-black px-4 py-2 rounded-md font-medium hover:bg-gray-100 transition-colors">
                        I understand
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <button
                className={`copy-button-secondary font-medium px-4 py-2 rounded-lg transition-all duration-200 ${
                  !userAddress || !hasClaimableRewards || referralData.isLoadingReferralData || isProcessingReferralClaim
                    ? ''
                    : 'hover:copy-button'
                }`}
                onClick={handleClaimReferralRewards}
                disabled={!userAddress || !hasClaimableRewards || referralData.isLoadingReferralData || isProcessingReferralClaim}
              >
                {isProcessingReferralClaim ? "Claiming..." : referralData.isLoadingReferralData ? "Loading..." : "Claim Rewards"}
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
                  <div className="text-sm text-gray-400 mb-2 flex items-center justify-between">
                    <span>My Referral Link</span>
                    {userAddress && (
                      <button
                        type="button"
                        onClick={() => setShowHowToReferDialog(true)}
                        className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors underline underline-offset-2"
                      >
                        How to refer
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {userAddress ? (
                      <>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={referralLink}
                            className="text-gray-200 flex-1 font-mono text-xs bg-white/[0.05] border border-white/[0.1] rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400/50 cursor-text"
                            onClick={(e) => e.currentTarget.select()}
                          />
                          <button
                            type="button"
                            onClick={handleCopyReferralLink}
                            disabled={isCopying}
                            className="text-emerald-400 hover:text-emerald-300 transition-colors text-sm font-medium whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isCopying ? "Copying..." : "Copy"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="text-gray-400 text-sm">Connect wallet to generate link</div>
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
              • You&apos;ll need a small amount of ETH (~0.001 ETH) for cross-chain gas fees
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

      {/* How to Refer Dialog */}
      <Dialog open={showHowToReferDialog} onOpenChange={setShowHowToReferDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>How do referrals work?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Earn MOR rewards by referring people to deposit assets. Your rewards are based on a tier system where you earn a percentage of MOR emissions from the virtual staked assets of your referrals.
            </p>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="tiers" className="border-0">
                <AccordionTrigger className="text-sm font-medium justify-start p-0 hover:no-underline">
                  See Referral Tiers
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-1 pb-0">
                  <div>• 1 stETH = 3%</div>
                  <div>• 2.5 stETH = 5%</div>
                  <div>• 25 stETH = 10%</div>
                  <div>• 62.5 stETH = 15%</div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
          <DialogFooter>
            <DialogClose className="bg-white text-black px-4 py-2 rounded-md font-medium hover:bg-gray-100 transition-colors">
              I understand
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

// Add display name for React DevTools debugging
ReferralPanel.displayName = 'ReferralPanel'; 
