"use client";

import { useState } from "react";
import { MetricCardMinimal } from "@/components/metric-card-minimal";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { useCapitalContext } from "@/context/CapitalPageContext";
import { toast } from "sonner";

export function ReferralPanel() {
  const { userAddress, referralData, claimReferralRewards } = useCapitalContext();
  const [isCopying, setIsCopying] = useState(false);

  // Generate referral link
  const referralLink = userAddress 
    ? `builders.mor.org/capital?refer=${userAddress}`
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

  // Handle referral rewards claim - aggregate claim from both pools
  const handleClaimReferralRewards = async () => {
    if (!userAddress) return;
    
    try {
      // Claim from both stETH and LINK pools if rewards are available
      if (referralData.stETHReferralRewards > BigInt(0)) {
        await claimReferralRewards('stETH');
      }
      if (referralData.linkReferralRewards > BigInt(0)) {
        await claimReferralRewards('LINK');
      }
    } catch (error) {
      console.error('Error claiming referral rewards:', error);
      // Error handling is done in the context via toast notifications
    }
  };

  // Check if user has any claimable referral rewards
  const hasClaimableRewards = parseFloat(referralData.claimableRewards) > 0;

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
        <div className="section-content group relative">
          <div className="section-content-gradient group-hover:bg-gradient-to-bl group-hover:from-emerald-400/10 group-hover:to-transparent" />
          <div className="p-4 md:p-6">
            {/* Header with button */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Referrals</h2>
              <button
                className="copy-button-secondary font-medium px-4 py-2 rounded-lg"
                onClick={handleClaimReferralRewards}
                disabled={!userAddress || !hasClaimableRewards || referralData.isLoadingReferralData}
              >
                {referralData.isLoadingReferralData ? "Loading..." : "Claim Rewards"}
              </button>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Total Referrals */}
              <div className="col-span-1">
                <MetricCardMinimal
                  title="Total Referrals"
                  value={referralData.isLoadingReferralData ? "---" : referralData.totalReferrals}
                  disableGlow={true}
                  className="h-full"
                />
              </div>

              {/* Lifetime Value Generated */}
              <div className="col-span-1">
                <MetricCardMinimal
                  title="Lifetime Value Generated"
                  value={referralData.isLoadingReferralData ? "---" : referralData.lifetimeRewards}
                  label={referralData.isLoadingReferralData ? "" : "ETH"}
                  disableGlow={true}
                  autoFormatNumbers={true}
                  className="h-full"
                />
              </div>

              {/* Claimable Rewards */}
              <div className="col-span-1">
                <MetricCardMinimal
                  title="Claimable Rewards"
                  value={referralData.isLoadingReferralData ? "---" : referralData.claimableRewards}
                  label={referralData.isLoadingReferralData ? "" : "MOR"}
                  disableGlow={true}
                  autoFormatNumbers={true}
                  className={`h-full ${hasClaimableRewards ? 'ring-2 ring-emerald-400/20' : ''}`}
                />
              </div>

              {/* Referral Link */}
              <div className="col-span-1">
                <div className="card-minimal group relative p-4 h-full flex flex-col justify-center">
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
    </div>
  );
} 