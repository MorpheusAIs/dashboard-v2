"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { print } from "graphql";
import { ethers } from "ethers";
import { useCapitalContext } from "@/context/CapitalPageContext";
import { useNetwork } from "@/context/network-context";
import { getEndOfDayTimestamps, buildDepositsQuery } from "@/app/graphql/queries/capital";
import { getTokenPrice } from "@/app/services/token-price.service";
import { shouldUseMockData, getFormattedMockData, getMockMetrics, type TokenType } from "@/mock-data";
import { useAvailableAssets } from "@/hooks/use-available-assets";

export interface DataPoint {
  date: string;
  deposits: number;
  timestamp: number; // Keep timestamp for sorting/merging logic
}

export function useCapitalChartData() {
  const { networkEnv, poolInfo } = useCapitalContext();
  const { switchToChain, isNetworkSwitching } = useNetwork();
  
  // Get available assets with positive balances for live data
  const { 
    availableAssets, 
    hasMultipleAssets, 
    primaryAsset, 
    availableTokens 
  } = useAvailableAssets();

  // State for chart data, loading, and error
  const [chartData, setChartData] = useState<DataPoint[]>([]);
  const [chartLoading, setChartLoading] = useState<boolean>(true);
  const [chartError, setChartError] = useState<string | null>(null);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState<boolean>(false);
  const [stethPrice, setStethPrice] = useState<number | null>(null);
  
  // State for selected asset and data cache
  const [selectedAsset, setSelectedAsset] = useState<TokenType>(primaryAsset);
  const [assetDataCache, setAssetDataCache] = useState<Record<TokenType, DataPoint[]>>({} as Record<TokenType, DataPoint[]>);
  const [isLoadingNewAsset, setIsLoadingNewAsset] = useState<boolean>(false);
  
  // Determine if we should use mock data
  const useMockData = shouldUseMockData();
  
  // Update selected asset if primary asset changes (for live data)
  useEffect(() => {
    if (!useMockData && primaryAsset !== selectedAsset && primaryAsset) {
      setSelectedAsset(primaryAsset);
    }
  }, [primaryAsset, selectedAsset, useMockData]);

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

  // Optimized asset switching with caching and background loading
  const loadAssetData = useCallback(async (asset: TokenType) => {
    if (!useMockData) return null;

    // Check if data is already cached
    if (assetDataCache[asset]) {
      console.log(`📦 Using cached data for ${asset}`);
      return assetDataCache[asset];
    }

    try {
      const mockData = getFormattedMockData(asset);
      const chartDataWithTimestamp = mockData.map((item) => ({
        ...item,
        timestamp: Math.floor(new Date(item.date).getTime() / 1000)
      }));

      // Cache the data
      setAssetDataCache(prev => ({
        ...prev,
        [asset]: chartDataWithTimestamp
      }));

      console.log(`📊 Loaded and cached ${mockData.length} data points for ${asset}`);
      return chartDataWithTimestamp;
    } catch (error) {
      console.error(`Error loading mock data for ${asset}:`, error);
      return null;
    }
  }, [useMockData, assetDataCache]);

  // Effect to handle asset changes with smooth transitions
  useEffect(() => {
    if (!useMockData) return;

    const handleAssetChange = async () => {
      // Don't show global loading for asset switches
      setIsLoadingNewAsset(true);
      setChartError(null);

      try {
        const newData = await loadAssetData(selectedAsset);
        if (newData) {
          // Update chart data immediately from cache/new load
          setChartData(newData);
        }
      } catch (error) {
        console.error('Error switching asset:', error);
        setChartError(`Failed to load ${selectedAsset} data`);
      } finally {
        setIsLoadingNewAsset(false);
      }
    };

    handleAssetChange();
  }, [selectedAsset, useMockData, loadAssetData]);

  // Initial data loading effect
  useEffect(() => {
    // Handle mock data case
    if (useMockData) {
      console.log('🔧 Using mock data for chart visualization');
      setChartLoading(true);
      setChartError(null);
      
      // Pre-load all asset data in background for smooth switching
      const preloadAllAssets = async () => {
        try {
          // Load initial asset first
          const initialData = await loadAssetData(selectedAsset);
          if (initialData) {
            setChartData(initialData);
            setChartLoading(false);
          }

          // Pre-load other assets in background
          const availableAssets: TokenType[] = ['stETH', 'LINK', 'wETH', 'USDC', 'USDT', 'wBTC'];
          const otherAssets = availableAssets.filter(asset => asset !== selectedAsset);
          
          // Load other assets without blocking UI
          setTimeout(async () => {
            for (const asset of otherAssets) {
              await loadAssetData(asset);
              // Small delay between loads to avoid blocking
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            console.log('🚀 All asset data pre-loaded for smooth switching');
          }, 100);

        } catch (error) {
          console.error('Error in initial data loading:', error);
          setChartError('Failed to load chart data');
          setChartData([]);
          setChartLoading(false);
        }
      };

      preloadAllAssets();
      return;
    }

    // Original real data fetching logic
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
  }, [useMockData, selectedAsset, loadAssetData, networkEnv, recentTimestamps, fetchRecentData, processDataPoints]);

  // Effect to load historical data in background after recent data loads
  useEffect(() => {
    // Skip historical data loading for mock data
    if (useMockData) {
      setIsLoadingHistorical(false);
      return;
    }

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
  }, [hasHistoricalData, chartLoading, networkEnv, fetchHistoricalData, processDataPoints, useMockData]);

  // Use mock metrics if mock data is enabled
  const mockMetrics = useMockData ? getMockMetrics(selectedAsset) : null;

  // Mock data for metric cards (will be moved to the hook's return)
  const totalDepositsMOR = useMemo(() => {
    if (chartData.length === 0) return "0";
    const lastDeposit = chartData[chartData.length - 1]?.deposits || 0;
    return Math.floor(lastDeposit).toLocaleString();
  }, [chartData]);

  const totalValueLockedUSD = useMemo(() => {
    // Use mock metrics if available
    if (useMockData && mockMetrics) {
      return mockMetrics.totalValueLockedUSD;
    }
    
    if (!stethPrice || chartData.length === 0) return "0";
    const lastDeposit = chartData[chartData.length - 1]?.deposits || 0;
    const usdValue = lastDeposit * stethPrice;
    return Math.floor(usdValue).toLocaleString();
  }, [chartData, stethPrice, useMockData, mockMetrics]);
  const currentDailyRewardMOR = mockMetrics?.currentDailyRewardMOR || "N/A";
  const avgApyRate = mockMetrics?.avgApyRate || "N/A";
  const activeStakers = mockMetrics?.activeStakers || "N/A";

  // Safeguard: Always return empty data for testnet (unless using mock data)
  const safeChartData = (networkEnv === 'testnet' && !useMockData) ? [] : chartData;
  const safeChartLoading = (networkEnv === 'testnet' && !useMockData) ? false : chartLoading;
  const safeIsLoadingHistorical = (networkEnv === 'testnet' && !useMockData) ? false : isLoadingHistorical;

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
    selectedAsset,
    setSelectedAsset,
    useMockData,
    isLoadingNewAsset,
    // Dynamic asset detection for live data
    availableAssets,
    hasMultipleAssets,
    availableTokens,
    // Always show asset switcher, but dynamic buttons based on available assets
    showAssetSwitcher: true,
  };
} 