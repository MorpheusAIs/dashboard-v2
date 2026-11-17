"use client"

import { useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

// Import Modals (updated to kebab-case)
import { DepositModal } from "@/components/capital/deposit-modal";
import { WithdrawModal } from "@/components/capital/withdraw-modal";
import { ClaimMorRewardsModal } from "@/components/capital/claim-mor-rewards-modal";

// Import new components
import { CapitalInfoPanel } from "@/components/capital/capital-info-panel";
// Import ChartSection dynamically to prevent hydration mismatch due to localStorage usage
const ChartSection = dynamic(() => import("@/components/capital/chart-section").then(mod => ({ default: mod.ChartSection })), {
  ssr: false,
  loading: () => (
    <div className="lg:col-span-2 relative h-[500px] flex items-center justify-center">
      <div className="text-gray-400">Loading chart...</div>
    </div>
  )
});
// Import UserAssetsPanel dynamically to prevent hydration mismatch due to localStorage usage in hooks
const UserAssetsPanel = dynamic(() => import("@/components/capital/user-assets-panel").then(mod => ({ default: mod.UserAssetsPanel })), {
  ssr: false,
  loading: () => (
    <div className="page-section mt-8">
      <div className="relative">
        <div className="section-content group relative px-1 py-4 sm:p-6">
          <div className="p-4 md:p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Your Assets</h2>
              <div className="text-gray-400">Loading...</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
});
// Import ReferralPanel dynamically to prevent hydration mismatch
const ReferralPanel = dynamic(() => import("@/components/capital/referral-panel").then(mod => ({ default: mod.ReferralPanel })), {
  ssr: false,
  loading: () => (
    <div className="page-section mt-8">
      <div className="relative">
        <div className="section-content group relative px-1 py-4 sm:p-6">
          <div className="p-4 md:p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Referrals</h2>
              <div className="text-gray-400">Loading...</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
});
// Import LockMultiplierPreview dynamically: it reads the current time to build on-chain lock args
const LockMultiplierPreview = dynamic(() => import("@/components/capital/lock-multiplier-preview").then(mod => ({ default: mod.LockMultiplierPreview })), {
  ssr: false,
  loading: () => (
    <div className="page-section mt-8">
      <div className="relative">
        <div className="section-content group relative px-1 py-4 sm:p-6">
          <div className="p-4 md:p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Lock Multiplier Preview</h2>
              <div className="text-gray-400">Loading...</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
});

// Import Context and Config
import { CapitalProvider, useCapitalContext } from "@/context/CapitalPageContext";

// --- Capital Page Content Component ---

function CapitalPageContent() {
  const {
    // isLoadingUserData,
    // Modal controls
    setActiveModal,
    setPreReferrerAddress,
  } = useCapitalContext();

  const searchParams = useSearchParams();
  const referrerProcessed = useRef(false);

  // Handle referrer URL parameter to auto-open deposit modal
  useEffect(() => {
    if (referrerProcessed.current) return;
    
    const referrerParam = searchParams.get('referrer');
    if (referrerParam) {
      console.log('Referrer detected in URL:', referrerParam);
      
      // Set the pre-populated referrer address
      setPreReferrerAddress(referrerParam);
      
      // Small delay so the modal opens after the page has settled
      const timer = setTimeout(() => {
        setActiveModal('deposit');
        referrerProcessed.current = true;
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [searchParams, setActiveModal, setPreReferrerAddress]);

  return (
    <div className="page-container">
      {/* --- New Top Row: Grid Layout --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8"> 
        
        {/* --- Column 1: Capital Info (1/3 width) --- */}
        <CapitalInfoPanel />

        {/* --- Column 2: Deposit Chart (2/3 width) --- */}
        <div className="lg:col-span-2 relative h-[500px]"> {/* Chart container with fixed height */}
          <ChartSection />
        </div>

      </div> 

      {/* User Assets Panel */}
      <UserAssetsPanel />

      {/* Lock Multiplier Preview */}
      <LockMultiplierPreview />

      {/* Referral Panel */}
      <ReferralPanel />

      {/* Render Modals */}
      <DepositModal />
      <WithdrawModal />
      <ClaimMorRewardsModal />

      {/* Placeholder for Assets to Deposit Section */}
      {/* The original 'Assets to Deposit' section seems misplaced. Keeping it commented out for now. */}
      {/*
      <div className="page-section mt-8">
        <h2 className="section-title">Assets to Deposit</h2>
        <div className="section-content group">
          <div className="section-content-gradient group-hover:bg-gradient-to-bl group-hover:from-emerald-400/10 group-hover:to-transparent" />
          <div className="section-body"></div>
        </div>
      </div>
      */}
    </div>
  )
}

// Default export wraps content with Provider
export default function CapitalPage() {
  return (
    // No ApolloProvider needed here if client is passed directly to useQuery
    <CapitalProvider>
      <Suspense fallback={<div className="page-container flex items-center justify-center min-h-96">
        <div className="text-gray-400">Loading...</div>
      </div>}>
        <CapitalPageContent />
      </Suspense>
    </CapitalProvider>
  );
}
