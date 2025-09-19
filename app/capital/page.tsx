"use client"

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
// import { useNetwork } from "@/context/network-context";
import { useChainId } from "wagmi";
import { mainnet } from "wagmi/chains";

// Import Modals (updated to kebab-case)
import { DepositModal } from "@/components/capital/deposit-modal";
import { WithdrawModal } from "@/components/capital/withdraw-modal";
import { ClaimMorRewardsModal } from "@/components/capital/claim-mor-rewards-modal";
import { ChangeLockModal } from "@/components/capital/change-lock-modal";

// Import new components
import { CapitalInfoPanel } from "@/components/capital/capital-info-panel";
import { ChartSection } from "@/components/capital/chart-section";
import { UserAssetsPanel } from "@/components/capital/user-assets-panel";
import { ReferralPanel } from "@/components/capital/referral-panel";
import { NetworkSwitchNotification } from "@/components/network-switch-notification";

// Import Context and Config
import { CapitalProvider, useCapitalContext } from "@/context/CapitalPageContext";

// --- Capital Page Content Component ---

function CapitalPageContent() {
  const {
    // Raw data needed by modals
    userData,
    currentUserMultiplierData,
    // isLoadingUserData,
    // Modal controls
    setActiveModal,
    setPreReferrerAddress,
  } = useCapitalContext();

  // const { switchToChain, isNetworkSwitching } = useNetwork();
  const chainId = useChainId();
  const searchParams = useSearchParams();
  const [showNetworkSwitchNotice, setShowNetworkSwitchNotice] = useState(false);
  // const networkSwitchAttempted = useRef(false);
  const userManuallyLeftMainnet = useRef(false);
  const referrerProcessed = useRef(false);

  // useEffect(() => {
  //   // We want to be on mainnet for the capital page.
  //   const shouldSwitch = chainId !== mainnet.id;

  //   if (shouldSwitch && !isLoadingUserData && !networkSwitchAttempted.current && !isNetworkSwitching && !userManuallyLeftMainnet.current) {
  //     console.log(`Auto-switching network to Ethereum Mainnet (chainId: ${mainnet.id}) for Capital page.`);
      
  //     networkSwitchAttempted.current = true;
  //     setShowNetworkSwitchNotice(true);
      
  //     const timer = setTimeout(() => {
  //       switchToChain(mainnet.id);
  //       setTimeout(() => {
  //         setShowNetworkSwitchNotice(false);
  //         networkSwitchAttempted.current = false; // Reset so it can work again on refresh
  //       }, 3000);
  //     }, 1500);
      
  //     return () => clearTimeout(timer);
  //   }
  // }, [chainId, switchToChain, isNetworkSwitching, isLoadingUserData]);

  // Separate effect to handle manual network changes and hide notification
  useEffect(() => {
    // If user manually switches away from mainnet, hide the notification and mark as manual switch
    if (chainId !== mainnet.id && showNetworkSwitchNotice) {
      console.log('User switched away from mainnet, hiding network notification');
      setShowNetworkSwitchNotice(false);
      userManuallyLeftMainnet.current = true; // Prevent auto-switch back
    }
    // If user switches back to mainnet manually, also hide notification
    else if (chainId === mainnet.id && showNetworkSwitchNotice) {
      console.log('User is now on mainnet, hiding network notification');
      setShowNetworkSwitchNotice(false);
    }
  }, [chainId, showNetworkSwitchNotice]);

  // Reset manual flag on component mount (page refresh/reload)
  useEffect(() => {
    userManuallyLeftMainnet.current = false;
  }, []);

  // Handle referrer URL parameter to auto-open deposit modal
  useEffect(() => {
    if (referrerProcessed.current) return;
    
    const referrerParam = searchParams.get('referrer');
    if (referrerParam) {
      console.log('Referrer detected in URL:', referrerParam);
      
      // Set the pre-populated referrer address
      setPreReferrerAddress(referrerParam);
      
      // Small delay to ensure the modal opens after any network switching
      const timer = setTimeout(() => {
        setActiveModal('deposit');
        referrerProcessed.current = true;
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [searchParams, setActiveModal, setPreReferrerAddress]);

  return (
    <div className="page-container">
      <NetworkSwitchNotification 
        show={showNetworkSwitchNotice}
        networkName="Ethereum Mainnet"
      />
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

      {/* Referral Panel */}
      {/* <ReferralPanel /> */}

      {/* Render Modals */}
      <DepositModal />
      <WithdrawModal />
      <ClaimMorRewardsModal />
      <ChangeLockModal 
        currentUserMultiplierData={currentUserMultiplierData}
        userData={userData}
      />

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