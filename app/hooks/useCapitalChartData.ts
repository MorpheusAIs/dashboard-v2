"use client";

import { useState, useEffect, useMemo } from "react";
import { print } from "graphql";
import { ethers } from "ethers";
import { useCapitalContext } from "@/context/CapitalPageContext";
import { useNetwork } from "@/context/network-context";
import { getEndOfDayTimestamps, buildDepositsQuery } from "@/app/graphql/queries/capital";
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
    // Fixed start date: February 10th, 2024 as requested
    const targetStartDate = new Date('2024-02-10T00:00:00Z');
    
    const poolStartDate = new Date(Number(poolInfo.payoutStart) * 1000);
    
    // Use the later of: target start date (Feb 10, 2024) or actual pool start
    const recentStartDate = targetStartDate > poolStartDate ? targetStartDate : poolStartDate;
    const recentTimestamps = getEndOfDayTimestamps(recentStartDate, now);
    
    console.log('⏰ Generated BATCHED timestamps:', {
      recentCount: recentTimestamps.length,
      startDate: recentStartDate.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0],
      totalDays: Math.round((now.getTime() - recentStartDate.getTime()) / (24 * 60 * 60 * 1000))
    });
    console.log('=== END TIMESTAMP GENERATION ===\n');
    
    return { recentTimestamps };
  }, [poolInfo]);

  // Split large timestamp arrays into safe 60-day batches to avoid 500 errors
  const BATCH_QUERIES = useMemo(() => {
    console.log('=== SAFE BATCHED QUERY CONSTRUCTION ===');
    console.log('⏰ Total timestamps for safe batching:', recentTimestamps.length);
    
    if (recentTimestamps.length === 0) {
      return [];
    }
    
    // Split into 60-day chunks to avoid API limits while getting complete data
    const batchSize = 60;
    const batches = [];
    
    for (let i = 0; i < recentTimestamps.length; i += batchSize) {
      const chunk = recentTimestamps.slice(i, i + batchSize);
      const query = buildDepositsQuery(chunk);
      batches.push({
        query,
        timestamps: chunk,
        startDate: new Date(chunk[0] * 1000).toISOString().split('T')[0],
        endDate: new Date(chunk[chunk.length - 1] * 1000).toISOString().split('T')[0],
        batchIndex: Math.floor(i / batchSize)
      });
    }
    
    console.log(`✅ Created ${batches.length} safe batches covering ${recentTimestamps.length} days total (Feb 10, 2024 to present)`);
    batches.forEach((batch, idx) => {
      console.log(`   Batch ${idx + 1}: ${batch.timestamps.length} days (${batch.startDate} to ${batch.endDate})`);
    });
    console.log('=== END SAFE BATCHED QUERY CONSTRUCTION ===\n');
    
    return batches;
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

  // RESTORED: Batched data loading with original sophisticated approach
  useEffect(() => {
    console.log('=== RESTORED BATCHED DATA LOADING EFFECT ===');
    console.log('🌍 Network Environment:', networkEnv);
    console.log('🎯 Selected Asset:', selectedAsset);
    console.log('⏰ Total Timestamps Available:', recentTimestamps.length);
    console.log('🔍 Safe Batch Queries Available:', BATCH_QUERIES.length);
    
    // Only fetch for mainnet with valid batch queries
    if (!networkEnv || networkEnv === 'testnet' || BATCH_QUERIES.length === 0) {
      console.log('❌ Skipping safe batched data load:', {
        networkEnv,
        isTestnet: networkEnv === 'testnet',
        batchQueriesLength: BATCH_QUERIES.length
      });
      setChartLoading(false);
      return;
    }

    console.log('🚀 Starting SAFE BATCHED data load for staked', selectedAsset);
    console.log(`📞 Making ${BATCH_QUERIES.length} sequential API calls to get complete data from Feb 10, 2024`);
    setChartLoading(true);
    setChartError(null);

    // SAFE BATCHED: Fetch data in multiple safe batches to get complete historical data
    const fetchSafeBatchedData = async () => {
      console.log('🔧 Starting SAFE BATCHED data fetch with', BATCH_QUERIES.length, 'batches');
      
      const allDataPoints: DataPoint[] = [];
      let batchCount = 0;
      
      try {
        // Process batches sequentially with delay to avoid overwhelming API
        for (const batchQuery of BATCH_QUERIES) {
          batchCount++;
          console.log(`📡 Processing batch ${batchCount}/${BATCH_QUERIES.length} (${batchQuery.startDate} to ${batchQuery.endDate})`);
          
          const queryString = print(batchQuery.query);
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
            console.log(`❌ HTTP error in batch ${batchCount}:`, response.status, response.statusText);
            throw new Error(`HTTP error in batch ${batchCount}! status: ${response.status}`);
          }

          const result = await response.json();
          if (result.errors) {
            throw new Error(result.errors[0]?.message || `GraphQL error in batch ${batchCount}`);
          }

          // Process this batch's data using the d0, d1, d2... structure
          if (result.data) {
            const dayKeys = Object.keys(result.data).filter(key => key.startsWith('d'));
            console.log(`✅ Batch ${batchCount} received ${dayKeys.length} day snapshots`);
            
            let lastTotalStakedWei = allDataPoints.length > 0 
              ? ethers.utils.parseEther(allDataPoints[allDataPoints.length - 1].deposits.toString())
              : ethers.BigNumber.from(0);
            
            batchQuery.timestamps.forEach((timestampSec: number, index: number) => {
              const dayKey = `d${index}`;
              const interactionData = result.data[dayKey]?.[0];
              let currentTotalStakedWei = lastTotalStakedWei;

              if (interactionData?.totalStaked) {
                try {
                  currentTotalStakedWei = ethers.BigNumber.from(interactionData.totalStaked);
                } catch (error) {
                  console.warn(`⚠️ Error parsing totalStaked in batch ${batchCount}, day ${index}:`, error);
                  if (allDataPoints.length === 0) currentTotalStakedWei = ethers.BigNumber.from(0);
                }
              } else if (allDataPoints.length === 0) {
                currentTotalStakedWei = ethers.BigNumber.from(0);
              }
              
              lastTotalStakedWei = currentTotalStakedWei;
              const depositValue = parseFloat(ethers.utils.formatEther(currentTotalStakedWei));
              
              allDataPoints.push({
                date: new Date(timestampSec * 1000).toISOString(),
                deposits: depositValue,
                timestamp: timestampSec,
              });
            });
          }
          
          // Add small delay between batches to be respectful to API
          if (batchCount < BATCH_QUERIES.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
        console.log(`✅ SAFE BATCHED fetch completed: ${allDataPoints.length} total data points from ${batchCount} batches`);
        return allDataPoints;
      } catch (error) {
        console.error(`❌ Error in safe batched fetch at batch ${batchCount}:`, error);
        throw error;
      }
    };

    console.log('🔧 About to call fetchSafeBatchedData()...');
    fetchSafeBatchedData()
      .then((allDataPoints) => {
        console.log('✅ fetchSafeBatchedData completed, result:', allDataPoints ? `${allDataPoints.length} data points` : 'no data');
        if (allDataPoints && allDataPoints.length > 0) {
          try {
            // Sort data points by timestamp to ensure proper chronological order
            const sortedData = allDataPoints.sort((a, b) => a.timestamp - b.timestamp);
            
            console.log('✅ SAFE BATCHED data processing completed:', sortedData.length, 'data points');
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
          console.log('❌ No safe batched data received');
          setChartData([]);
        }
        setChartLoading(false);
      })
      .catch((error) => {
        console.error('❌ Error in fetchSafeBatchedData:', error);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack);
        setChartError(`Failed to load chart data: ${error.message}`);
        setChartData([]);
        setChartLoading(false);
      });
  }, [selectedAsset, networkEnv, BATCH_QUERIES]); // Updated dependencies for safe batching

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