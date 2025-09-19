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

  const RECENT_DEPOSITS_QUERY = useMemo(() => {
    console.log('=== BATCHED QUERY CONSTRUCTION ===');
    console.log('⏰ Recent timestamps for batched query:', recentTimestamps.length);
    
    const query = recentTimestamps.length > 0 ? buildDepositsQuery(recentTimestamps) : null;
    if (query) {
      console.log('✅ BATCHED query constructed for', recentTimestamps.length, 'days');
    } else {
      console.log('❌ No batched query created - no timestamps available');
    }
    console.log('=== END BATCHED QUERY CONSTRUCTION ===\n');
    return query;
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
    console.log('⏰ Recent Timestamps Available:', recentTimestamps.length);
    console.log('🔍 RECENT_DEPOSITS_QUERY exists:', !!RECENT_DEPOSITS_QUERY);
    
    // Only fetch for mainnet with valid timestamps (original logic)
    if (!networkEnv || networkEnv === 'testnet' || recentTimestamps.length === 0 || !RECENT_DEPOSITS_QUERY) {
      console.log('❌ Skipping batched data load:', {
        networkEnv,
        isTestnet: networkEnv === 'testnet',
        timestampsLength: recentTimestamps.length,
        hasQuery: !!RECENT_DEPOSITS_QUERY
      });
      setChartLoading(false);
      return;
    }

    console.log('🚀 Starting BATCHED data load for staked', selectedAsset);
    console.log('📞 Making batched GraphQL call with', recentTimestamps.length, 'day snapshots');
    setChartLoading(true);
    setChartError(null);

    // RESTORED: Batched fetch with original d0, d1, d2... structure
    const fetchBatchedData = async () => {
      console.log('🔧 Making BATCHED API call with', recentTimestamps.length, 'timestamps');
      console.log('🚀 Using RESTORED batched query for staked', selectedAsset);

      try {
        console.log('📡 Sending POST request to /api/capital with BATCHED query...');
        
        const queryString = print(RECENT_DEPOSITS_QUERY);
        console.log('🔍 Batched query length:', queryString.length);
        console.log('🌍 Network environment:', networkEnv);
        
        const requestBody = {
          query: queryString,
          variables: {},
          networkEnv,
        };
        
        console.log('📦 Batched request body prepared (', Object.keys(requestBody).length, 'keys)');
        
        const response = await fetch('/api/capital', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        console.log('📡 Batched fetch request sent successfully');
        console.log('📊 Response status:', response.status);
        console.log('📊 Response ok:', response.ok);

        if (!response.ok) {
          console.log('❌ HTTP error response:', response.status, response.statusText);
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        console.log('✅ Parsing batched JSON response...');
        const result = await response.json();
        console.log('📊 Received BATCHED result from API with keys:', Object.keys(result.data || {}));
        if (result.errors) {
          throw new Error(result.errors[0]?.message || 'GraphQL error');
        }

        // RESTORED: Batched response format with d0, d1, d2... structure
        if (!result.data || Object.keys(result.data).filter(key => key.startsWith('d')).length === 0) {
          console.log('❌ No batched day data (d0, d1, d2...) in response');
          return null;
        }

        const dayKeys = Object.keys(result.data).filter(key => key.startsWith('d'));
        console.log('✅ Found', dayKeys.length, 'day snapshots:', dayKeys.slice(0, 5), '...');
        return { data: result.data, timestamps: recentTimestamps };
      } catch (error) {
        console.error('Error fetching recent chart data:', error);
        throw error;
      }
    };

    console.log('🔧 About to call fetchBatchedData()...');
    fetchBatchedData()
      .then((result) => {
        console.log('✅ fetchBatchedData completed, result:', result ? 'data received' : 'no data');
        if (result?.data && result.timestamps.length > 0) {
          try {
            // RESTORED: Process batched data with d0, d1, d2... structure
            console.log('📊 Processing BATCHED data format (d0, d1, d2...)');
            
            let lastTotalStakedWei = ethers.BigNumber.from(0);
            const processedData = result.timestamps.map((timestampSec: number, index: number) => {
              const dayKey = `d${index}`;
              const interactionData = result.data[dayKey]?.[0];
              let currentTotalStakedWei = lastTotalStakedWei;

              console.log(`📅 Day ${index} (${dayKey}):`, {
                expectedTimestamp: timestampSec,
                hasData: !!interactionData,
                actualTimestamp: interactionData?.blockTimestamp,
                totalStaked: interactionData?.totalStaked,
                rate: interactionData?.rate
              });

              if (interactionData?.totalStaked) {
                try {
                  currentTotalStakedWei = ethers.BigNumber.from(interactionData.totalStaked);
                } catch (error) {
                  console.warn(`⚠️ Error parsing totalStaked for day ${index}:`, error);
                  if (index === 0) currentTotalStakedWei = ethers.BigNumber.from(0);
                }
              } else if (index === 0) {
                currentTotalStakedWei = ethers.BigNumber.from(0);
              }
              
              lastTotalStakedWei = currentTotalStakedWei;
              const depositValue = parseFloat(ethers.utils.formatEther(currentTotalStakedWei));
              
              return {
                date: new Date(timestampSec * 1000).toISOString(),
                deposits: depositValue,
                timestamp: timestampSec,
              };
            });
            
            console.log('✅ BATCHED data processing completed:', processedData.length, 'data points');
            console.log('📊 First data point:', processedData[0]);
            console.log('📊 Last data point:', processedData[processedData.length - 1]);

            setChartData(processedData);
            setChartError(null);
          } catch (processingError: unknown) {
            const errorMessage = (processingError instanceof Error) ? processingError.message : String(processingError);
            console.error("Error processing batched chart data:", processingError);
            setChartError(`Failed to process chart data: ${errorMessage}`);
            setChartData([]);
          }
        } else {
          console.log('❌ No batched data received');
          setChartData([]);
        }
        setChartLoading(false);
      })
      .catch((error) => {
        console.error('❌ Error in fetchBatchedData:', error);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack);
        setChartError(`Failed to load chart data: ${error.message}`);
        setChartData([]);
        setChartLoading(false);
      });
  }, [selectedAsset, networkEnv, recentTimestamps, RECENT_DEPOSITS_QUERY]); // RESTORED dependencies

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