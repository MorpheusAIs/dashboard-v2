"use client"

// import { Info } from "lucide-react" // Removed unused import
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip" // Import Tooltip components
import { Info } from "lucide-react" // Import Info icon
import NumberFlow from '@number-flow/react' // Import NumberFlow
import { GlowingEffect } from "@/components/ui/glowing-effect" // Import GlowingEffect
import { useMemo, useState, useEffect, useCallback } from "react"
import { gql, DocumentNode } from "@apollo/client" // Added DocumentNode
import { print } from "graphql" // Import print to convert DocumentNode to string
import { ethers } from "ethers" // Import ethers for BigNumber formatting

// Import Modals
import { DepositModal } from "@/components/capital/DepositModal";
import { WithdrawModal } from "@/components/capital/WithdrawModal";
import { ClaimModal } from "@/components/capital/ClaimModal";
import { ChangeLockModal } from "@/components/capital/ChangeLockModal";
// Import Chart Component and Type
import { DepositStethChart, type DataPoint } from "@/components/capital/DepositStethChart"; // Imported DataPoint type

// Import Context and Config
import { CapitalProvider, useCapitalContext } from "@/context/CapitalPageContext";
import { useNetwork } from "@/context/network-context"; // <-- Import useNetwork
import { mainnet } from "wagmi/chains"; // <-- Import mainnet

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
const buildDepositsQuery = (timestamps: number[]): DocumentNode => { 
  let queryBody = '';
  timestamps.forEach((ts, index) => {
    queryBody += `
      d${index}: poolInteractions(
        first: 1
        orderDirection: desc
        where: { timestamp_lte: "${ts}", pool: "0x00" }
        orderBy: timestamp
      ) {
        totalStaked
        timestamp 
        __typename
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
  const [isLoadingHistorical, setIsLoadingHistorical] = useState<boolean>(false);

    // Generate timestamps for recent data (last 15 months) and historical data
  const { recentTimestamps, historicalTimestamps, hasHistoricalData } = useMemo(() => {
    if (!poolInfo?.payoutStart) {
      return { recentTimestamps: [], historicalTimestamps: [], hasHistoricalData: false };
    }

    const now = new Date();
    const fifteenMonthsAgo = new Date();
    fifteenMonthsAgo.setMonth(fifteenMonthsAgo.getMonth() - 15);
    
    const poolStartDate = new Date(Number(poolInfo.payoutStart) * 1000);
    
    // Recent data: last 15 months or from pool start if less than 15 months old
    const recentStartDate = fifteenMonthsAgo > poolStartDate ? fifteenMonthsAgo : poolStartDate;
    const recentTimestamps = getEndOfDayTimestamps(recentStartDate, now);
    
    // Historical data: from pool start to 15 months ago (if there's a gap)
    const historicalTimestamps = fifteenMonthsAgo > poolStartDate 
      ? getEndOfDayTimestamps(poolStartDate, fifteenMonthsAgo)
      : [];
    
    return {
      recentTimestamps,
      historicalTimestamps,
      hasHistoricalData: historicalTimestamps.length > 0
    };
  }, [poolInfo?.payoutStart]);

  const RECENT_DEPOSITS_QUERY = useMemo(() => buildDepositsQuery(recentTimestamps), [recentTimestamps]);
  const HISTORICAL_DEPOSITS_QUERY = useMemo(() => 
    historicalTimestamps.length > 0 ? buildDepositsQuery(historicalTimestamps) : null, 
    [historicalTimestamps]
  );

  // Fetch recent chart data
  const fetchRecentData = useCallback(async () => {
    if (!networkEnv || networkEnv === 'testnet' || recentTimestamps.length === 0) {
      return null;
    }

    try {
      const response = await fetch('/api/capital', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: print(RECENT_DEPOSITS_QUERY),
          variables: {},
          networkEnv,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.errors) {
        throw new Error(result.errors[0]?.message || 'GraphQL error');
      }

      return { data: result.data, timestamps: recentTimestamps };
    } catch (error) {
      console.error('Error fetching recent chart data:', error);
      throw error;
    }
  }, [networkEnv, recentTimestamps, RECENT_DEPOSITS_QUERY]);

  // Fetch historical chart data
  const fetchHistoricalData = useCallback(async () => {
    if (!networkEnv || networkEnv === 'testnet' || !HISTORICAL_DEPOSITS_QUERY || historicalTimestamps.length === 0) {
      return null;
    }

    try {
      const response = await fetch('/api/capital', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: print(HISTORICAL_DEPOSITS_QUERY),
          variables: {},
          networkEnv,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.errors) {
        throw new Error(result.errors[0]?.message || 'GraphQL error');
      }

      return { data: result.data, timestamps: historicalTimestamps };
    } catch (error) {
      console.error('Error fetching historical chart data:', error);
      throw error;
    }
  }, [networkEnv, historicalTimestamps, HISTORICAL_DEPOSITS_QUERY]);

  // Process data into chart format
  const processDataPoints = useCallback((data: Record<string, Array<{ totalStaked: string }>>, timestamps: number[]) => {
    let lastTotalStakedWei = ethers.BigNumber.from(0);
    
    return timestamps.map((timestampSec: number, index: number) => {
      const dayKey = `d${index}`;
      const interactionData = data[dayKey]?.[0];
      let currentTotalStakedWei = lastTotalStakedWei;

      if (interactionData && interactionData.totalStaked != null && interactionData.totalStaked !== '') {
        const rawValue = interactionData.totalStaked;
        try {
          currentTotalStakedWei = ethers.BigNumber.from(rawValue);
        } catch (parseError: unknown) {
          const errorMessage = (parseError instanceof Error) ? parseError.message : String(parseError);
          console.warn(
            `Error parsing totalStaked for day ${index} (timestamp ${timestampSec}): Value='${rawValue}'. Error: ${errorMessage}. Using previous value.`
          );
          if (index === 0) {
            currentTotalStakedWei = ethers.BigNumber.from(0);
          }
        }
      } else {
        if (index === 0) {
          currentTotalStakedWei = ethers.BigNumber.from(0);
        }
      }
      
      lastTotalStakedWei = currentTotalStakedWei;
      const depositValue = parseFloat(ethers.utils.formatEther(currentTotalStakedWei));
      
      return {
        date: new Date(timestampSec * 1000).toISOString(), 
        deposits: depositValue,
        timestamp: timestampSec,
      };
    });
  }, []);

  // Main effect to handle recent data loading
  useEffect(() => {
    if (!networkEnv || networkEnv === 'testnet' || recentTimestamps.length === 0) {
      setChartLoading(false);
      return;
    }

    setChartLoading(true);
    setChartError(null);

    fetchRecentData()
      .then((result) => {
        if (result?.data && result.timestamps.length > 0) {
          try {
            const processedData = processDataPoints(result.data, result.timestamps);
            // Remove timestamp property for chart display
            const chartData = processedData.map((item) => ({ 
              date: item.date, 
              deposits: item.deposits 
            }));
            setChartData(chartData);
            setChartError(null);
          } catch (processingError: unknown) {
            const errorMessage = (processingError instanceof Error) ? processingError.message : String(processingError);
            console.error("Error processing recent chart data:", processingError);
            setChartError(`Failed to process chart data: ${errorMessage}`);
            setChartData([]);
          }
        } else {
          setChartData([]);
        }
        setChartLoading(false);
      })
      .catch((error) => {
        console.error('Error fetching recent chart data:', error);
        setChartError(`Failed to load chart data: ${error.message}`);
        setChartData([]);
        setChartLoading(false);
      });
  }, [networkEnv, recentTimestamps, fetchRecentData, processDataPoints]);

  // Effect to load historical data in background after recent data loads
  useEffect(() => {
    if (!hasHistoricalData || chartLoading || networkEnv === 'testnet') {
      return;
    }

    setIsLoadingHistorical(true);

    fetchHistoricalData()
      .then((result) => {
        if (result?.data && result.timestamps.length > 0) {
          try {
            const historicalDataPoints = processDataPoints(result.data, result.timestamps);
            
            // Merge with existing data
            setChartData(currentData => {
              const allDataPoints = [...historicalDataPoints, ...currentData.map((item, index) => ({
                ...item,
                timestamp: recentTimestamps[index]
              }))];
              
              // Sort by timestamp and remove duplicates
              allDataPoints.sort((a, b) => a.timestamp - b.timestamp);
              const uniqueDataPoints = allDataPoints.filter((point, index, arr) => 
                index === 0 || point.timestamp !== arr[index - 1].timestamp
              );
              
                             // Return chart data without timestamp property  
               return uniqueDataPoints.map((item) => ({ 
                 date: item.date, 
                 deposits: item.deposits 
               }));
            });
          } catch (processingError: unknown) {
            console.error("Error processing historical chart data:", processingError);
          }
        }
        setIsLoadingHistorical(false);
      })
      .catch((error) => {
        console.error('Error fetching historical chart data:', error);
        setIsLoadingHistorical(false);
      });
  }, [hasHistoricalData, chartLoading, networkEnv, fetchHistoricalData, processDataPoints, recentTimestamps]);



  const isUserSectionLoading = isLoadingUserData;

  // Helper to safely parse formatted number strings, handling "---"
  const safeParseFloat = (value: string): number => {
    if (value === "---" || value === undefined) return 0; // Return 0 for non-numeric/loading states for NumberFlow
    return parseFloat(value.replace(/,/g, ''));
  }

  const { switchToChain, isNetworkSwitching } = useNetwork();

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
                  Contribute stETH to the public liquidity pool and get MOR rewards.
                </p>
              </div>

              {/* Deposit Button - Aligned Left */} 
              <div className="mb-6"> {/* Wrapper div for button */} 
                 <button
                   onClick={() => setActiveModal('deposit')}
                   className="copy-button flex-shrink-0" // Removed ml-4 
                   disabled={!userAddress}
                 >
                   Deposit stETH
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
               <div className="relative h-full">
                 <DepositStethChart 
                    data={chartData} 
                 />
                 {isLoadingHistorical && (
                   <div className="absolute top-2 right-2 text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">
                     Loading historical data...
                   </div>
                 )}
               </div>
             )}
             {!chartLoading && !chartError && chartData.length === 0 && (
                <div className="flex flex-col justify-center items-center h-[400px] lg:h-full text-center"> {/* Use flex-col and text-center */} 
                  <p className="text-gray-400 mb-4"> {/* Add margin-bottom */} 
                    {networkEnv === 'testnet' 
                       ? "You are viewing testnet. No historical deposit data available." 
                       : "No deposit data available."} 
                  </p>
                  {networkEnv === 'testnet' && (
                     <button 
                       className="copy-button-secondary px-4 py-2 rounded-lg"
                       onClick={() => switchToChain(mainnet.id)}
                       disabled={isNetworkSwitching}
                     >
                       {isNetworkSwitching ? "Switching..." : "Switch to Mainnet"}
                     </button>
                  )}
                </div>
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
                  Withdraw stETH
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