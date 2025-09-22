"use client";

import { useState, useEffect, useMemo } from "react";
import { print } from "graphql";
import { ethers } from "ethers";
import { useCapitalContext } from "@/context/CapitalPageContext";
import { useNetwork } from "@/context/network-context";
import { getEndOfDayTimestamps, buildRangeDepositsQuery } from "@/app/graphql/queries/capital";
import { getTokenPrice } from "@/app/services/token-price.service";
import { type TokenType } from "@/mock-data";
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
  
  // State for selected asset
  const [selectedAsset, setSelectedAsset] = useState<TokenType>(primaryAsset);
  
  // Always use live data from actual API endpoints
  
  // Update selected asset if primary asset changes (for live data)
  useEffect(() => {
    if (primaryAsset !== selectedAsset && primaryAsset) {
      setSelectedAsset(primaryAsset);
    }
  }, [primaryAsset, selectedAsset]);

  useEffect(() => {
    async function fetchPrice() {
      const price = await getTokenPrice('staked-ether', 'usd');
      setStethPrice(price);
    }
    fetchPrice();
  }, []);

  // RESTORED: Timestamp generation for batched monthly queries
  const { recentTimestamps } = useMemo(() => {
    console.log('=== TIMESTAMP GENERATION (RESTORED) ===');
    console.log('🏊 Pool Info:', poolInfo);
    console.log('🏊 Pool Info payout start:', poolInfo?.payoutStart);
    
    if (!poolInfo?.payoutStart) {
      console.log('❌ No payout start found, returning empty timestamps');
      return { recentTimestamps: [] };
    }
    
    console.log('✅ Pool Info has payoutStart:', poolInfo.payoutStart.toString());
    console.log('📅 PayoutStart as date:', new Date(Number(poolInfo.payoutStart) * 1000).toISOString());

    const now = new Date();
    const fifteenMonthsAgo = new Date();
    fifteenMonthsAgo.setMonth(fifteenMonthsAgo.getMonth() - 15);
    
    const poolStartDate = new Date(Number(poolInfo.payoutStart) * 1000);
    
    // Recent data: last 15 months or from pool start if less than 15 months old
    const recentStartDate = fifteenMonthsAgo > poolStartDate ? fifteenMonthsAgo : poolStartDate;
    const recentTimestamps = getEndOfDayTimestamps(recentStartDate, now);
    
    console.log('⏰ Generated BATCHED timestamps:', {
      recentCount: recentTimestamps.length,
    });
    console.log('=== END TIMESTAMP GENERATION ===\n');
    
    return { recentTimestamps };
  }, [poolInfo]);

  // Progressive loading: Create range queries for different time periods
  const RANGE_QUERIES = useMemo(() => {
    console.log('=== PROGRESSIVE RANGE QUERY CONSTRUCTION ===');
    console.log('⏰ Total timestamps for range batching:', recentTimestamps.length);
    
    if (recentTimestamps.length === 0) {
      return [];
    }
    
    // Split into 90-day chunks using range queries for better coverage
    const chunkSizeDays = 90;
    const chunkSizeSeconds = chunkSizeDays * 24 * 60 * 60;
    const queries = [];
    
    const startTimestamp = recentTimestamps[0];
    const endTimestamp = recentTimestamps[recentTimestamps.length - 1];
    
    for (let currentStart = startTimestamp; currentStart < endTimestamp; currentStart += chunkSizeSeconds) {
      const currentEnd = Math.min(currentStart + chunkSizeSeconds, endTimestamp);
      const query = buildRangeDepositsQuery(currentStart, currentEnd);
      
      queries.push({
        query,
        startTimestamp: currentStart,
        endTimestamp: currentEnd,
        startDate: new Date(currentStart * 1000).toISOString().split('T')[0],
        endDate: new Date(currentEnd * 1000).toISOString().split('T')[0],
        batchIndex: queries.length
      });
    }
    
    console.log(`✅ Created ${queries.length} range queries covering ${Math.round((endTimestamp - startTimestamp) / (24 * 60 * 60))} days total`);
    queries.forEach((q, idx) => {
      console.log(`   Range ${idx + 1}: ${q.startDate} to ${q.endDate}`);
    });
    console.log('=== END PROGRESSIVE RANGE QUERY CONSTRUCTION ===\n');
    
    return queries;
  }, [recentTimestamps]);
  
  // Historical data loading removed - focusing on recent data only for now

  // Removed fetchRecentData - now inlined to avoid dependency issues

  // Removed fetchHistoricalData - now inlined to avoid dependency issues

  // Removed processDataPoints - now inlined to avoid dependency issues

  // Effect to clear chart data when switching to testnet
  useEffect(() => {
    console.log('=== NETWORK CHANGE EFFECT TRIGGERED ===');
    console.log('🔄 Network Environment:', networkEnv);
    console.log('📊 Current Chart Data Length:', chartData.length);
    
    if (networkEnv === 'testnet') {
      console.log('🧹 Clearing chart data for testnet');
      setChartData([]);
      setChartLoading(false);
      setChartError(null);
      setIsLoadingHistorical(false);
    } else {
      console.log('✅ Not testnet, keeping chart data');
    }
    console.log('=== END NETWORK CHANGE EFFECT ===\n');
  }, [networkEnv, chartData.length]);

  // Live data will be handled by the existing fetchRecentData and fetchHistoricalData functions

  // Asset switching for live data will be handled by the chart component

  // PROGRESSIVE: Multi-batch data loading to get complete historical data
  useEffect(() => {
    console.log('=== PROGRESSIVE BATCHED DATA LOADING EFFECT ===');
    console.log('🌍 Network Environment:', networkEnv);
    console.log('🎯 Selected Asset:', selectedAsset);
    console.log('⏰ Total Timestamps Available:', recentTimestamps.length);
    console.log('🔍 Range Queries Available:', RANGE_QUERIES.length);
    
    // Only fetch for mainnet with valid queries
    if (!networkEnv || networkEnv === 'testnet' || RANGE_QUERIES.length === 0) {
      console.log('❌ Skipping progressive data load:', {
        networkEnv,
        isTestnet: networkEnv === 'testnet',
        rangeQueriesLength: RANGE_QUERIES.length
      });
      setChartLoading(false);
      return;
    }

    console.log('🚀 Starting PROGRESSIVE RANGE data load for', selectedAsset);
    console.log(`📞 Making ${RANGE_QUERIES.length} sequential range API calls to get complete data`);
    setChartLoading(true);
    setChartError(null);
    setIsLoadingHistorical(true);

    // PROGRESSIVE: Fetch data in multiple batches to avoid API limits
    const fetchProgressiveRangeData = async () => {
      console.log('🔧 Starting PROGRESSIVE RANGE data fetch with', RANGE_QUERIES.length, 'ranges');
      
      const allInteractions: Array<{blockTimestamp: number, totalStaked: string}> = [];
      let rangeCount = 0;
      
      try {
        // Process ranges sequentially with delay to avoid overwhelming API
        for (const rangeQuery of RANGE_QUERIES) {
          rangeCount++;
          console.log(`📡 Processing range ${rangeCount}/${RANGE_QUERIES.length} (${rangeQuery.startDate} to ${rangeQuery.endDate})`);
          
          const queryString = print(rangeQuery.query);
          const requestBody = {
            query: queryString,
            variables: {},
            networkEnv,
          };
          
          const response = await fetch('/api/capital', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            console.log(`❌ HTTP error in range ${rangeCount}:`, response.status, response.statusText);
            throw new Error(`HTTP error in range ${rangeCount}! status: ${response.status}`);
          }

          const result = await response.json();
          if (result.errors) {
            throw new Error(result.errors[0]?.message || `GraphQL error in range ${rangeCount}`);
          }

          // Process this range's interactions
          if (result.data?.poolInteractions) {
            const interactions = result.data.poolInteractions;
            console.log(`✅ Range ${rangeCount} received ${interactions.length} interactions`);
            
            // Add all interactions from this range
            interactions.forEach((interaction: {blockTimestamp?: string, totalStaked?: string}) => {
              if (interaction.blockTimestamp && interaction.totalStaked) {
                allInteractions.push({
                  blockTimestamp: parseInt(interaction.blockTimestamp),
                  totalStaked: interaction.totalStaked
                });
              }
            });
          }
          
          // Add small delay between ranges to be respectful to API
          if (rangeCount < RANGE_QUERIES.length) {
            await new Promise(resolve => setTimeout(resolve, 150));
          }
        }
        
        console.log(`✅ PROGRESSIVE RANGE fetch completed: ${allInteractions.length} total interactions from ${rangeCount} ranges`);
        
        // Now interpolate data points from interactions
        if (allInteractions.length === 0) {
          return [];
        }
        
        // Sort interactions by timestamp
        allInteractions.sort((a, b) => a.blockTimestamp - b.blockTimestamp);
        
        // Create daily data points by interpolating between interactions
        const dataPoints: DataPoint[] = [];
        
        let interactionIndex = 0;
        let currentTotalStaked = "0";
        
        for (const timestamp of recentTimestamps) {
          // Find the most recent interaction before or at this timestamp
          while (interactionIndex < allInteractions.length && 
                 allInteractions[interactionIndex].blockTimestamp <= timestamp) {
            currentTotalStaked = allInteractions[interactionIndex].totalStaked;
            interactionIndex++;
          }
          
          try {
            const totalStakedWei = ethers.BigNumber.from(currentTotalStaked);
            const depositValue = parseFloat(ethers.utils.formatEther(totalStakedWei));
            
            dataPoints.push({
              date: new Date(timestamp * 1000).toISOString(),
              deposits: depositValue,
              timestamp: timestamp,
            });
          } catch (error) {
            console.warn(`⚠️ Error processing timestamp ${timestamp}:`, error);
          }
        }
        
        console.log(`✅ Interpolated ${dataPoints.length} data points from ${allInteractions.length} interactions`);
        return dataPoints;
      } catch (error) {
        console.error(`❌ Error in progressive range fetch at range ${rangeCount}:`, error);
        throw error;
      }
    };

    console.log('🔧 About to call fetchProgressiveRangeData()...');
    fetchProgressiveRangeData()
      .then((allDataPoints) => {
        console.log('✅ fetchProgressiveRangeData completed, result:', allDataPoints ? `${allDataPoints.length} data points` : 'no data');
        if (allDataPoints && allDataPoints.length > 0) {
          try {
            // Sort data points by timestamp to ensure proper chronological order
            const sortedData = allDataPoints.sort((a, b) => a.timestamp - b.timestamp);
            
            console.log('✅ PROGRESSIVE data processing completed:', sortedData.length, 'data points');
            console.log('📊 First data point:', sortedData[0]);
            console.log('📊 Last data point:', sortedData[sortedData.length - 1]);
            console.log('📊 Date range:', {
              from: sortedData[0]?.date?.split('T')[0],
              to: sortedData[sortedData.length - 1]?.date?.split('T')[0]
            });

            setChartData(sortedData);
            setChartError(null);
          } catch (processingError: unknown) {
            const errorMessage = (processingError instanceof Error) ? processingError.message : String(processingError);
            console.error("Error processing batched chart data:", processingError);
            setChartError(`Failed to process chart data: ${errorMessage}`);
            setChartData([]);
          }
        } else {
          console.log('❌ No progressive data received');
          setChartData([]);
        }
        setChartLoading(false);
        setIsLoadingHistorical(false);
      })
      .catch((error) => {
        console.error('❌ Error in fetchProgressiveRangeData:', error);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack);
        setChartError(`Failed to load chart data: ${error.message}`);
        setChartData([]);
        setChartLoading(false);
        setIsLoadingHistorical(false);
      });
  }, [selectedAsset, networkEnv, RANGE_QUERIES]); // Updated dependencies for range loading

  // DISABLED: Historical data loading - simple query gets all data at once
  useEffect(() => {
    console.log('=== HISTORICAL DATA EFFECT DISABLED ===');
    console.log('ℹ️  Simple query returns all historical data in one request');
    // No historical loading needed - the simple query gets everything
  }, []);

  // Always use live data - no mock metrics
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
  
  // These values should come from useCapitalMetrics hook in the component
  const currentDailyRewardMOR = "N/A";
  const avgApyRate = "N/A";
  const activeStakers = "N/A";

  // Safeguard: Always return empty data for testnet since we're using live data
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
    selectedAsset,
    setSelectedAsset,
    // Dynamic asset detection for live data
    availableAssets,
    hasMultipleAssets,
    availableTokens,
    // Always show asset switcher, but dynamic buttons based on available assets
    showAssetSwitcher: true,
  };
} 