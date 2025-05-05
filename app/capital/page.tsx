"use client"

// import { Info } from "lucide-react" // Removed unused import
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip" // Import Tooltip components
import { Info } from "lucide-react" // Import Info icon
import NumberFlow from '@number-flow/react' // Import NumberFlow
import { GlowingEffect } from "@/components/ui/glowing-effect" // Import GlowingEffect
import { useMemo, useState, useEffect } from "react"
import { gql, useQuery, DocumentNode } from "@apollo/client" // Added DocumentNode
import { ethers } from "ethers" // Import ethers for BigNumber formatting
import { ApolloClient, InMemoryCache } from '@apollo/client' // Added ApolloClient, InMemoryCache

// Import Modals
import { DepositModal } from "@/components/capital/DepositModal";
import { WithdrawModal } from "@/components/capital/WithdrawModal";
import { ClaimModal } from "@/components/capital/ClaimModal";
import { ChangeLockModal } from "@/components/capital/ChangeLockModal";
// Import Chart Component and Type
import { DepositStethChart, type DataPoint } from "@/components/capital/DepositStethChart"; // Imported DataPoint type

// Import Context and Config
import { CapitalProvider, useCapitalContext } from "@/context/CapitalPageContext";
import { getGraphQLApiUrl, NetworkEnvironment } from "@/config/networks"; // Import config helper

// --- Helper Functions for GraphQL Query ---

// Generates end-of-day timestamps (seconds) for a range
const getEndOfDayTimestamps = (startDate: Date, endDate: Date): number[] => {
  const timestamps = [];
  const currentDate = new Date(startDate);
  currentDate.setUTCHours(0, 0, 0, 0); // Start at the beginning of the start day

  while (currentDate <= endDate) {
    const endOfDay = new Date(currentDate);
    endOfDay.setUTCHours(23, 59, 59, 999);
    timestamps.push(Math.floor(endOfDay.getTime() / 1000));
    currentDate.setDate(currentDate.getDate() + 1); // Move to the next day
  }
  return timestamps;
};

// Constructs the multi-alias GraphQL query string
const buildDepositsQuery = (/* poolId: string, - No longer needed */ timestamps: number[]): DocumentNode => { 
  let queryBody = '';
  timestamps.forEach((ts, index) => {
    queryBody += `
      d${index}: poolInteractions(
        first: 1
        orderDirection: desc
        where: { timestamp_lte: "${ts}", pool: "0x00" } # Changed pool ID format
        orderBy: timestamp
      ) {
        totalStaked
        timestamp 
        # __typename # Optionally add if needed later
      }
    `;
  });
  return gql`
    query GetEndOfDayDeposits {
      ${queryBody}
    }
  `;
};

// --- Capital Page Content Component ---

function CapitalPageContent() {
  console.log("Capital page content rendering"); // <-- ADD BASIC LOG
  const {
    userAddress,
    setActiveModal, // Get setActiveModal from context
    // Formatted Data for UI
    totalDepositedFormatted,
    userDepositFormatted,
    claimableAmountFormatted,
    userMultiplierFormatted,
    poolStartTimeFormatted,
    currentDailyRewardFormatted,
    withdrawUnlockTimestampFormatted,
    claimUnlockTimestampFormatted,
    // Eligibility Flags
    canWithdraw,
    canClaim,
    // Loading States
    isLoadingGlobalData,
    isLoadingUserData,
    // Raw data needed by modals
    userData,
    currentUserMultiplierData,
    poolInfo,
    networkEnv, // Get network environment from context
  } = useCapitalContext();

  // State for chart data, loading, and error
  const [chartData, setChartData] = useState<DataPoint[]>([]); // Use imported DataPoint type
  const [chartLoading, setChartLoading] = useState<boolean>(true);
  const [chartError, setChartError] = useState<string | null>(null);

  // Determine Subgraph URL based on environment
  const subgraphUrl = useMemo(() => {
    // Use a default if networkEnv isn't ready? Or rely on skip in useQuery.
    return networkEnv ? getGraphQLApiUrl(networkEnv as NetworkEnvironment) : undefined; 
  }, [networkEnv]);

  // Create Apollo Client instance based on the subgraph URL
  const apolloClient = useMemo(() => {
    if (!subgraphUrl) return null; // Return null if URL isn't available
    console.log("Creating Apollo Client for URL:", subgraphUrl); // Debug log
    try {
      return new ApolloClient({
        uri: subgraphUrl,
        cache: new InMemoryCache(),
      });
    } catch (e) {
        console.error("Failed to create Apollo Client:", e);
        return null;
    }
  }, [subgraphUrl]);

  // Define query variables - poolId variable is no longer passed to buildDepositsQuery
  // const poolId = "0"; 
  const startDate = useMemo(() => poolInfo?.payoutStart ? new Date(Number(poolInfo.payoutStart) * 1000) : new Date(0), [poolInfo?.payoutStart]);
  const endDate = useMemo(() => new Date(), []); 

  // Generate timestamps and the query document
  const endOfDayTimestamps = useMemo(() => getEndOfDayTimestamps(startDate, endDate), [startDate, endDate]);
  const DEPOSITS_QUERY = useMemo(() => buildDepositsQuery(/* poolId, */ endOfDayTimestamps), [endOfDayTimestamps]); // Removed poolId dependency

  // Fetch data using Apollo useQuery
  const { loading: apolloLoading, error: apolloError, data: apolloData } = useQuery(DEPOSITS_QUERY, {
     client: apolloClient ?? undefined, 
     skip: !apolloClient || endOfDayTimestamps.length === 0, 
     fetchPolicy: "cache-and-network", 
  });

  // Effect to process fetched data
  useEffect(() => {
    setChartLoading(apolloLoading);
    if (apolloError) {
      console.error("Error fetching chart data:", apolloError);
      setChartError(`Failed to load chart data: ${apolloError.message}`);
      setChartData([]);
    } else if (apolloData && endOfDayTimestamps.length > 0) {
      try {
        let lastTotalStakedWei = ethers.BigNumber.from(0); // Track the last valid BigNumber value
        const processedData = endOfDayTimestamps.map((timestampSec, index) => {
          const dayKey = `d${index}`;
          const interactionData = apolloData[dayKey]?.[0];
          let currentTotalStakedWei = lastTotalStakedWei; // Default to previous day's value

          if (interactionData && interactionData.totalStaked != null && interactionData.totalStaked !== '') {
            const rawValue = interactionData.totalStaked;
            try {
              currentTotalStakedWei = ethers.BigNumber.from(rawValue);
            } catch (parseError: unknown) { // Use unknown or Error
              // Log the error message
              const errorMessage = (parseError instanceof Error) ? parseError.message : String(parseError);
              console.warn(
                `Error parsing totalStaked for day ${index} (timestamp ${timestampSec}): Value='${rawValue}'. Error: ${errorMessage}. Using previous value.`
              );
              // Keep currentTotalStakedWei as lastTotalStakedWei (already set as default)
              if (index === 0) {
                currentTotalStakedWei = ethers.BigNumber.from(0);
              }
            }
          } else {
            // Handle cases where interactionData or totalStaked is missing/null/empty
            // Use the previous day's value (already default), log if needed
            // console.log(`Using previous value for day ${index} due to missing/empty totalStaked`);
            if (index === 0) { // Ensure first day defaults to 0 if data is missing
                 currentTotalStakedWei = ethers.BigNumber.from(0);
            }
          }
          
          lastTotalStakedWei = currentTotalStakedWei; 

          const depositValue = parseFloat(ethers.utils.formatEther(currentTotalStakedWei));
          
          return {
            date: new Date(timestampSec * 1000).toISOString(), 
            deposits: depositValue,
          };
        });
        setChartData(processedData);
        setChartError(null);
      } catch (processingError: unknown) { // Use unknown or Error
         const errorMessage = (processingError instanceof Error) ? processingError.message : String(processingError);
         console.error("Error processing chart data:", processingError); // Keep original object for full context
         setChartError(`Failed to process chart data: ${errorMessage}`);
         setChartData([]);
      }
    } else if (!apolloLoading) {
       // Handle case where data is null/undefined but not loading/error
       setChartData([]); 
    }
  }, [apolloData, apolloLoading, apolloError, endOfDayTimestamps]);

  // Handle case where client couldn't be created (e.g., bad URL)
  useEffect(() => {
     if (!apolloClient && subgraphUrl) { // If URL exists but client failed
        setChartError("Failed to initialize data connection.");
        setChartLoading(false);
     }
  }, [apolloClient, subgraphUrl]);

  const isUserSectionLoading = isLoadingUserData;

  // Helper to safely parse formatted number strings, handling "---"
  const safeParseFloat = (value: string): number => {
    if (value === "---" || value === undefined) return 0; // Return 0 for non-numeric/loading states for NumberFlow
    return parseFloat(value.replace(/,/g, ''));
  }

  return (
    <div className="page-container">
      {/* --- New Top Row: Grid Layout --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8"> 
        
        {/* --- Column 1: Capital Info (1/3 width) --- */}
        <div className="lg:col-span-1 relative"> {/* Ensure relative positioning for effect */}
          <GlowingEffect 
            spread={40}
            glow={true}
            disabled={false}
            proximity={64}
            inactiveZone={0.01}
            borderWidth={2}
            borderRadius="rounded-xl"
          /> 
          <div className="section-content group relative h-full"> {/* Added h-full */}
            <div className="section-content-gradient group-hover:bg-gradient-to-bl group-hover:from-emerald-400/10 group-hover:to-transparent" />
            <div className="p-4 md:p-6 flex flex-col h-full"> {/* Use flex-col for vertical stacking */} 
              {/* Title & Subtitle */} 
              <div className="mb-6"> 
                <h1 className="text-3xl font-bold text-white">Capital</h1>
                <p className="text-gray-400 mt-1">
                  Contribute stETH/wstETH to the public liquidity pool and manage your position.
                </p>
              </div>

              {/* Deposit Button - Aligned Left */} 
              <div className="mb-6"> {/* Wrapper div for button */} 
                 <button
                   onClick={() => setActiveModal('deposit')}
                   className="copy-button flex-shrink-0" // Removed ml-4 
                   disabled={!userAddress}
                 >
                   Deposit stETH/wstETH
                 </button>
              </div>

              {/* Global Stats - Stacked Vertically */} 
              <div className="flex flex-col gap-4 mt-auto"> {/* Use flex-col, gap, mt-auto to push to bottom */} 
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-1">Total Deposits</h4>
                  <div className="text-2xl font-semibold text-white">
                    {isLoadingGlobalData ? "--- " : <NumberFlow value={safeParseFloat(totalDepositedFormatted)} />} stETH
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-1">Current Daily Reward</h4>
                  <div className="text-2xl font-semibold text-white">
                    {isLoadingGlobalData ? "--- " : <NumberFlow value={safeParseFloat(currentDailyRewardFormatted)} />} MOR
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-1">Pool Start Time</h4>
                  <div className="text-2xl font-semibold text-white">{isLoadingGlobalData ? "--- " : poolStartTimeFormatted}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* --- Column 2: Deposit Chart (2/3 width) --- */}
        <div className="lg:col-span-2 relative"> {/* Chart container, relative for effect */} 
           <div className="section-content group relative p-0 h-full"> {/* Added h-full, kept p-0 */} 
             {/* Conditional Rendering for Chart */} 
             {chartLoading && <div className="flex justify-center items-center h-[400px] lg:h-full"><p>Loading Chart...</p></div>}
             {chartError && <div className="flex justify-center items-center h-[400px] lg:h-full text-red-500"><p>{chartError}</p></div>}
             {!chartLoading && !chartError && chartData.length > 0 && (
               <DepositStethChart data={chartData} />
             )}
             {!chartLoading && !chartError && chartData.length === 0 && (
                <div className="flex justify-center items-center h-[400px] lg:h-full"><p>No deposit data available.</p></div>
             )}
           </div>
           {/* Optional Glowing effect for chart column */} 
           <GlowingEffect 
             spread={40}
             glow={true}
             disabled={false}
             proximity={64}
             inactiveZone={0.01}
             borderWidth={2}
             borderRadius="rounded-xl"
           /> 
        </div>

      </div> {/* End of Top Row Grid */} 

      {/* Info Dashboard / User-Specific Section */}
      <div className="page-section mt-8">
        <h2 className="section-title">Your Position</h2>
        <div className="relative">
          <div className="section-content group relative">
            <div className="section-content-gradient group-hover:bg-gradient-to-bl group-hover:from-emerald-400/10 group-hover:to-transparent" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 md:p-6">
              {/* Column 1: Your Deposit & Withdraw */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-medium text-gray-400">Your Deposit</h4>
                </div>
                <div className="text-2xl font-semibold text-white">
                  {isUserSectionLoading ? "--- " : <NumberFlow value={safeParseFloat(userDepositFormatted)} />} stETH
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full md:w-auto"
                  onClick={() => setActiveModal('withdraw')}
                  disabled={!userAddress || isUserSectionLoading || !canWithdraw}
                >
                  Withdraw stETH/wstETH
                </Button>
                <p className="text-xs text-gray-500 mt-1">
                  {canWithdraw ? "Withdrawal available" : `Unlock: ${isLoadingGlobalData || isLoadingUserData ? "--- " : withdrawUnlockTimestampFormatted}`}
                </p>
              </div>

              {/* Column 2: Available to Claim & Claim Button */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-medium text-gray-400">Available to Claim</h4>
                </div>
                <div className="text-2xl font-semibold text-white">
                  {isUserSectionLoading ? "--- " : <NumberFlow value={safeParseFloat(claimableAmountFormatted)} />} MOR
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full md:w-auto"
                  onClick={() => setActiveModal('claim')}
                  disabled={!userAddress || isUserSectionLoading || !canClaim}
                >
                  Claim MOR
                </Button>
                <p className="text-xs text-gray-500 mt-1">
                  {canClaim ? "Claim available" : `Unlock: ${isLoadingGlobalData || isLoadingUserData ? "--- " : claimUnlockTimestampFormatted}`}
                </p>
              </div>

              {/* Column 3: Power Factor & Stake Rewards Button */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-medium text-gray-400">Your Power Factor</h4>
                  <TooltipProvider>
                    <Tooltip delayDuration={100}>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-gray-500 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Your reward multiplier based on factors like lock duration. Stake MOR Rewards to increase it.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="text-2xl font-semibold text-white">{isUserSectionLoading ? "---x" : userMultiplierFormatted}</div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full md:w-auto"
                  onClick={() => {
                    setActiveModal('changeLock'); // Restore original action
                  }}
                  disabled={!userAddress || isUserSectionLoading}
                >
                  Stake MOR Rewards
                </Button>
              </div>
            </div>

            {/* Notes Section */}
            <div className="col-span-1 md:col-span-3 border-t border-gray-800 px-4 md:px-6 py-3">
              <p className="text-xs text-gray-500">
                Note: Claims mint MOR on Arbitrum One. Withdrawals/deposits occur on Ethereum. Lock periods apply.
              </p>
            </div>
          </div>
          {/* Temporarily comment out GlowingEffect to test button clicks */}
          {/* <GlowingEffect 
            spread={40}
            glow={true}
            disabled={false}
            proximity={64}
            inactiveZone={0.01}
            borderWidth={2}
            borderRadius="rounded-xl"
          /> */}
        </div>
      </div>

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