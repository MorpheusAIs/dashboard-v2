"use client"

// Import Modals (updated to kebab-case)
import { DepositModal } from "@/components/capital/deposit-modal";
import { WithdrawModal } from "@/components/capital/withdraw-modal";
import { ClaimModal } from "@/components/capital/claim-modal";
import { ChangeLockModal } from "@/components/capital/change-lock-modal";

// Import new components
import { CapitalInfoPanel } from "@/components/capital/capital-info-panel";
import { ChartSection } from "@/components/capital/chart-section";
import { UserAssetsPanel } from "@/components/capital/user-assets-panel";

// Import Context and Config
import { CapitalProvider, useCapitalContext } from "@/context/CapitalPageContext";

// --- Capital Page Content Component ---

function CapitalPageContent() {
  const {
    // Formatted Data for UI
    userDepositFormatted,
    claimableAmountFormatted,
    // Raw data needed by modals
    userData,
    currentUserMultiplierData,
    poolInfo,
  } = useCapitalContext();

  return (
    <div className="page-container">
      {/* --- New Top Row: Grid Layout --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8"> 
        
        {/* --- Column 1: Capital Info (1/3 width) --- */}
        <CapitalInfoPanel />

        {/* --- Column 2: Deposit Chart (2/3 width) --- */}
        <div className="lg:col-span-2 relative h-[500px] overflow-hidden"> {/* Chart container with fixed height and overflow hidden */}
          <ChartSection />
        </div>

      </div> {/* End of Top Row Grid */}

      {/* User Assets Panel */}
      <UserAssetsPanel />

      {/* Render Modals */}
      <DepositModal minimalStake={poolInfo?.minimalStake} />
      <WithdrawModal depositedAmount={userDepositFormatted !== "---" ? userDepositFormatted : "0"} />
      <ClaimModal claimableAmount={claimableAmountFormatted !== "---" ? claimableAmountFormatted : "0"} />
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
      <CapitalPageContent />
    </CapitalProvider>
  );
}