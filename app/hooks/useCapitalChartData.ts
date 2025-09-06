"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { print } from "graphql";
import { ethers } from "ethers";
import { useCapitalContext } from "@/context/CapitalPageContext";
import { useNetwork } from "@/context/network-context";
import { getEndOfDayTimestamps, buildDepositsQuery } from "@/app/graphql/queries/capital";
import { getTokenPrice } from "@/app/services/token-price.service";

export interface DataPoint {
  date: string;
  deposits: number;
  timestamp: number; // Keep timestamp for sorting/merging logic
}

export function useCapitalChartData() {
  const { networkEnv, poolInfo } = useCapitalContext();
  const { switchToChain, isNetworkSwitching } = useNetwork();

  // State for chart data, loading, and error
  const [chartData, setChartData] = useState<DataPoint[]>([]);
  const [chartLoading, setChartLoading] = useState<boolean>(true);
  const [chartError, setChartError] = useState<string | null>(null);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState<boolean>(false);
  const [stethPrice, setStethPrice] = useState<number | null>(null);

  useEffect(() => {
    async function fetchPrice() {
      const price = await getTokenPrice('staked-ether', 'usd');
      setStethPrice(price);
    }
    fetchPrice();
  }, []);

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

  // Effect to clear chart data when switching to testnet
  useEffect(() => {
    // console.log('🔄 Network change detected:', { networkEnv, chartDataLength: chartData.length });
    
    if (networkEnv === 'testnet') {
      console.log('🧹 Clearing chart data for testnet');
      setChartData([]);
      setChartLoading(false);
      setChartError(null);
      setIsLoadingHistorical(false);
    }
  }, [networkEnv, chartData.length]);

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
              deposits: item.deposits,
              timestamp: item.timestamp, // Keep timestamp for now, will remove later if not needed
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
              const allDataPoints = [...historicalDataPoints, ...currentData];
              
              // Sort by timestamp and remove duplicates
              allDataPoints.sort((a, b) => a.timestamp - b.timestamp);
              const uniqueDataPoints = allDataPoints.filter((point, index, arr) => 
                index === 0 || point.timestamp !== arr[index - 1].timestamp
              );
              
              return uniqueDataPoints.map((item) => ({ 
                date: item.date, 
                deposits: item.deposits,
                timestamp: item.timestamp,
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
  }, [hasHistoricalData, chartLoading, networkEnv, fetchHistoricalData, processDataPoints]);

  // Mock data for metric cards (will be moved to the hook's return)
  const totalDepositsMOR = useMemo(() => {
    if (chartData.length === 0) return "0";
    const lastDeposit = chartData[chartData.length - 1]?.deposits || 0;
    return Math.floor(lastDeposit).toLocaleString();
  }, [chartData]);

  const totalValueLockedUSD = useMemo(() => {
    if (!stethPrice || chartData.length === 0) return "0";
    const lastDeposit = chartData[chartData.length - 1]?.deposits || 0;
    const usdValue = lastDeposit * stethPrice;
    return Math.floor(usdValue).toLocaleString();
  }, [chartData, stethPrice]);

  const currentDailyRewardMOR = "N/A"; // Use N/A instead of fake placeholder
  const avgApyRate = "N/A"; // Use N/A instead of fake placeholder
  const activeStakers = "N/A"; // Use N/A instead of fake placeholder

  // Safeguard: Always return empty data for testnet
  const safeChartData = networkEnv === 'testnet' ? [] : chartData;
  const safeChartLoading = networkEnv === 'testnet' ? false : chartLoading;
  const safeIsLoadingHistorical = networkEnv === 'testnet' ? false : isLoadingHistorical;

  return {
    chartData: safeChartData,
    chartLoading: safeChartLoading,
    chartError,
    isLoadingHistorical: safeIsLoadingHistorical,
    totalDepositsMOR,
    totalValueLockedUSD,
    currentDailyRewardMOR,
    avgApyRate,
    activeStakers,
    networkEnv,
    switchToChain,
    isNetworkSwitching,
  };
} 