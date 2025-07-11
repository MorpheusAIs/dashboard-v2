"use client";

import { useState } from "react";
import { MetricCardMinimal } from "@/components/metric-card-minimal";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { useCapitalContext } from "@/context/CapitalPageContext";
import { toast } from "sonner";

export function ReferralPanel() {
  const { userAddress } = useCapitalContext();
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

  // Mock data - in a real app, this would come from context/API
  const referralData = {
    totalReferrals: "14",
    rewardsEarned: "67.34",
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
        <div className="section-content group relative">
          <div className="section-content-gradient group-hover:bg-gradient-to-bl group-hover:from-emerald-400/10 group-hover:to-transparent" />
          <div className="p-4 md:p-6">
            {/* Header */}
            <h2 className="text-2xl font-bold text-white mb-6">Referrals</h2>

            {/* Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Total Referrals */}
              <div className="col-span-1">
                <MetricCardMinimal
                  title="Total Referrals"
                  value={referralData.totalReferrals}
                  disableGlow={true}
                  className="h-full"
                />
              </div>

              {/* Referral Rewards Earned */}
              <div className="col-span-1">
                <MetricCardMinimal
                  title="Referral Rewards Earned"
                  value={referralData.rewardsEarned}
                  label="MOR"
                  disableGlow={true}
                  autoFormatNumbers={true}
                  className="h-full"
                />
              </div>

              {/* Referral Link */}
              <div className="col-span-1">
                <div className="card-minimal group relative p-4 h-full flex flex-col">
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