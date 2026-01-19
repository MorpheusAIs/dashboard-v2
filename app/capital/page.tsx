"use client"

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useNetwork } from "@/context/network-context";
import { useChainId, useSwitchChain, useAccount, useConnectorClient } from "wagmi";
import { mainnet } from "wagmi/chains";

// Import Modals dynamically to reduce initial bundle size (~40-60KB)
const DepositModal = dynamic(
  () => import("@/components/capital/deposit-modal").then(mod => ({ default: mod.DepositModal })),
  { ssr: false }
);
const WithdrawModal = dynamic(
  () => import("@/components/capital/withdraw-modal").then(mod => ({ default: mod.WithdrawModal })),
  { ssr: false }
);
const ClaimMorRewardsModal = dynamic(
  () => import("@/components/capital/claim-mor-rewards-modal").then(mod => ({ default: mod.ClaimMorRewardsModal })),
  { ssr: false }
);
const ChangeLockModal = dynamic(
  () => import("@/components/capital/change-lock-modal").then(mod => ({ default: mod.ChangeLockModal })),
  { ssr: false }
);

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
import { NetworkSwitchNotification } from "@/components/network-switch-notification";

// Import Context and Config - Using new focused contexts
import {
  CapitalProvider,
  useCapitalModal,
  usePreReferrer,
  useSelectedAsset,
  useCapitalAssets,
} from "@/context/capital";

// --- Capital Page Content Component ---

function CapitalPageContent() {
  const { setActiveModal } = useCapitalModal();
  const { setPreReferrerAddress } = usePreReferrer();
  const { selectedAsset } = useSelectedAsset();
  const { assetContractData } = useCapitalAssets();

  // Get selected asset data for ChangeLockModal
  const selectedAssetData = assetContractData[selectedAsset];

  const { switchToChain: contextSwitchToChain, isNetworkSwitching } = useNetwork();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { isConnected, isConnecting, isReconnecting } = useAccount();
  const { data: connectorClient } = useConnectorClient();
  const searchParams = useSearchParams();
  const [showNetworkSwitchNotice, setShowNetworkSwitchNotice] = useState(false);
  const networkSwitchAttempted = useRef(false);
  const userManuallyLeftMainnet = useRef(false);
  const referrerProcessed = useRef(false);

  useEffect(() => {
    console.log('Auto-switch useEffect running:', {
      chainId,
      mainnetId: mainnet.id,
      isConnected,
      isConnecting,
      isReconnecting,
      connectorClient: !!connectorClient,
      isNetworkSwitching,
      networkSwitchAttempted: networkSwitchAttempted.current,
      userManuallyLeftMainnet: userManuallyLeftMainnet.current
    });

    // Only attempt network switch when wallet is fully connected and ready
    // Wait for wallet connection to stabilize (not connecting/reconnecting)
    const isWalletReady = isConnected && !isConnecting && !isReconnecting && connectorClient;
    
    // We want to be on mainnet for the capital page.
    const shouldSwitch = chainId !== mainnet.id && chainId !== undefined && isWalletReady;

    console.log('Should switch:', shouldSwitch);

    if (shouldSwitch && !networkSwitchAttempted.current && !isNetworkSwitching && !userManuallyLeftMainnet.current) {
      console.log(`Auto-switching network to Ethereum Mainnet (chainId: ${mainnet.id}) for Capital page.`);

      networkSwitchAttempted.current = true;
      setShowNetworkSwitchNotice(true);

      const timer = setTimeout(() => {
        console.log('Attempting to switch to mainnet...');
        switchChain({ chainId: mainnet.id });
        setTimeout(() => {
          setShowNetworkSwitchNotice(false);
          networkSwitchAttempted.current = false; // Reset so it can work again on refresh
        }, 3000);
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [chainId, contextSwitchToChain, isNetworkSwitching, isConnected, isConnecting, isReconnecting, connectorClient, switchChain]);

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
      <ReferralPanel />

      {/* Render Modals */}
      <DepositModal />
      <WithdrawModal />
      <ClaimMorRewardsModal />
      <ChangeLockModal
        currentUserMultiplierData={selectedAssetData?.userMultiplier}
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
