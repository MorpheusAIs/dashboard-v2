"use client";

import { DepositStethChart, type DataPoint } from "@/components/capital/deposit-steth-chart";
import { MetricCardMinimal } from "@/components/metric-card-minimal";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { useCapitalContext } from "@/context/CapitalPageContext";
import { useNetwork } from "@/context/network-context";
import { mainnet } from "wagmi/chains";
import { useMemo, useState, useEffect, useCallback } from "react";
import { gql, DocumentNode } from "@apollo/client";
import { print } from "graphql";
import { ethers } from "ethers";

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
  // Handle empty timestamps array to avoid empty GraphQL query
  if (!timestamps || timestamps.length === 0) {
    return gql`
      query GetEndOfDayDeposits {
        # Placeholder query when no timestamps available
        _meta {
          block {
            number
          }
        }
      }
    `;
  }

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

export function ChartSection() {
  const { networkEnv, poolInfo } = useCapitalContext();
  const { switchToChain, isNetworkSwitching } = useNetwork();

  // State for chart data, loading, and error
  const [chartData, setChartData] = useState<DataPoint[]>([]);
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

  const RECENT_DEPOSITS_QUERY = useMemo(() => 
    recentTimestamps.length > 0 ? buildDepositsQuery(recentTimestamps) : null, 
    [recentTimestamps]
  );
  const HISTORICAL_DEPOSITS_QUERY = useMemo(() => 
    historicalTimestamps.length > 0 ? buildDepositsQuery(historicalTimestamps) : null, 
    [historicalTimestamps]
  );

  // Fetch recent chart data
  const fetchRecentData = useCallback(async () => {
    if (!networkEnv || networkEnv === 'testnet' || recentTimestamps.length === 0 || !RECENT_DEPOSITS_QUERY) {
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

      // Check if this is a placeholder query response (no actual data)
      if (result.data && result.data._meta && !Object.keys(result.data).some(key => key.startsWith('d'))) {
        return null;
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

      // Check if this is a placeholder query response (no actual data)
      if (result.data && result.data._meta && !Object.keys(result.data).some(key => key.startsWith('d'))) {
        return null;
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

  // Mock data for metric cards
  const totalDepositsMOR = useMemo(() => {
    if (chartData.length === 0) return "0";
    const lastDeposit = chartData[chartData.length - 1]?.deposits || 0;
    return Math.floor(lastDeposit).toLocaleString();
  }, [chartData]);
  const currentDailyRewardMOR = "2,836"; // Placeholder for Current Daily Reward in MOR
  const avgApyRate = "15.37%"; // Placeholder for Average APY Rate
  const activeStakers = "240"; // Placeholder for Active Stakers

  return (
    <>
        {/* 4x4 Grid Layout */}
        <div className="grid grid-cols-4 gap-4 h-full" style={{ gridTemplateRows: '120px 1fr' }}>
          {/* Row 1: 4 Metric Cards */}
          <div className="col-span-1 h-full">
            <MetricCardMinimal
              title="Total Deposits"
              value={totalDepositsMOR}
              label="MOR"
              autoFormatNumbers={true}
              className=""
              disableGlow={true}
            />
          </div>
          <div className="col-span-1 h-full">
            <MetricCardMinimal
              title="Current Daily Reward"
              value={currentDailyRewardMOR}
              label="MOR"
              autoFormatNumbers={true}
              className=""
              disableGlow={true}
            />
          </div>
          <div className="col-span-1 h-full">
            <MetricCardMinimal
              title="Avg. APY Rate"
              value={avgApyRate}
              autoFormatNumbers={false}
              className=""
              disableGlow={true}
            />
          </div>
          <div className="col-span-1 h-full">
            <MetricCardMinimal
              title="Active Stakers"
              value={activeStakers}
              autoFormatNumbers={true}
              className=""
              disableGlow={true}
            />
          </div>

          {/* Row 2: Deposit Chart (4 columns, remaining height) */}
          <div className="col-span-4 relative h-full overflow-hidden">
            <GlowingEffect 
                spread={40}
                glow={true}
                disabled={false}
                proximity={64}
                inactiveZone={0.01}
                borderWidth={2}
                borderRadius="rounded-xl"
            />
            {/* Conditional Rendering for Chart */}
            {chartLoading && (
              <div className="flex justify-center items-center h-full">
                <p>Loading Chart...</p>
              </div>
            )}
            {chartError && (
              <div className="flex justify-center items-center h-full text-red-500">
                <p>{chartError}</p>
              </div>
            )}
            {!chartLoading && !chartError && chartData.length > 0 && (
              <div className="relative h-full overflow-hidden">
                <DepositStethChart data={chartData} />
                {isLoadingHistorical && (
                  <div className="absolute top-2 right-2 text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded z-5">
                    Loading historical data...
                  </div>
                )}
              </div>
            )}
            {!chartLoading && !chartError && chartData.length === 0 && (
              <div className="flex flex-col justify-center items-center h-full text-center">
                <p className="text-gray-400 mb-4">
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
        </div>
    </>
  );
} 