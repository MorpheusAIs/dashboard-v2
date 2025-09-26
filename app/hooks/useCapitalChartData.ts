"use client";

import { useState, useEffect, useMemo } from "react";
import { print } from "graphql";
import { ethers } from "ethers";
import { useCapitalContext } from "@/context/CapitalPageContext";
import { useNetwork } from "@/context/network-context";
import { 
  getEndOfDayTimestamps, 
  buildDepositsQuery, 
  getDepositPoolAddress,
  getAssetStartDate
} from "@/app/graphql/queries/capital";
import { getTokenPrice } from "@/app/services/token-price.service";
import { type TokenType } from "@/mock-data";
import { useAvailableAssets } from "@/hooks/use-available-assets";

// Local storage utilities for chart data caching
const CHART_DATA_CACHE_KEY = 'morpheus-chart-data-cache-v2'; // Updated version for better cache management
const CACHE_EXPIRY_HOURS = 2; // Cache expires after 2 hours (increased for better persistence)

interface CachedChartData {
  [assetNetworkKey: string]: { // Use combined key for better isolation
    data: DataPoint[];
    timestamp: number;
    networkEnv: string;
    asset: string;
  };
}

// Generate cache key for specific asset-network combination
const getCacheKey = (asset: TokenType, networkEnv: string): string => {
  return `${asset}_${networkEnv}`;
};

const getChartDataFromCache = (asset: TokenType, networkEnv: string): DataPoint[] | null => {
  if (typeof window === 'undefined') return null; // SSR safety
  
  try {
    const cached = localStorage.getItem(CHART_DATA_CACHE_KEY);
    if (!cached) return null;
    
    const parsedCache: CachedChartData = JSON.parse(cached);
    const cacheKey = getCacheKey(asset, networkEnv);
    const assetCache = parsedCache[cacheKey];
    
    if (!assetCache || assetCache.networkEnv !== networkEnv || assetCache.asset !== asset) {
      console.log(`📦 No valid cache found for ${asset} on ${networkEnv}`);
      return null;
    }
    
    // Check if cache is expired
    const now = Date.now();
    const cacheAge = now - assetCache.timestamp;
    const maxAge = CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
    
    if (cacheAge > maxAge) {
      console.log(`📦 Cache expired for ${asset} (${Math.round(cacheAge / 1000 / 60)} minutes old)`);
      // Remove expired cache entry
      delete parsedCache[cacheKey];
      localStorage.setItem(CHART_DATA_CACHE_KEY, JSON.stringify(parsedCache));
      return null;
    }
    
    console.log(`📦 ✅ Using cached data for ${asset} on ${networkEnv} (${Math.round(cacheAge / 1000 / 60)} minutes old, ${assetCache.data.length} points)`);
    return assetCache.data;
  } catch (error) {
    console.warn('Error reading chart data from cache:', error);
    return null;
  }
};

const saveChartDataToCache = (asset: TokenType, data: DataPoint[], networkEnv: string): void => {
  if (typeof window === 'undefined') return; // SSR safety
  
  try {
    const cached = localStorage.getItem(CHART_DATA_CACHE_KEY);
    const parsedCache: CachedChartData = cached ? JSON.parse(cached) : {};
    
    const cacheKey = getCacheKey(asset, networkEnv);
    parsedCache[cacheKey] = {
      data,
      timestamp: Date.now(),
      networkEnv,
      asset
    };
    
    localStorage.setItem(CHART_DATA_CACHE_KEY, JSON.stringify(parsedCache));
    console.log(`📦 ✅ Cached ${data.length} data points for ${asset} on ${networkEnv}`);
  } catch (error) {
    console.warn('Error saving chart data to cache:', error);
  }
};

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
  
  // Cache management
  const [isCacheLoaded, setIsCacheLoaded] = useState<boolean>(false);
  
  // Reset cache loaded state when asset or network changes
  useEffect(() => {
    setIsCacheLoaded(false);
  }, [selectedAsset, networkEnv]);
  
  // Always use live data from actual API endpoints
  
  // Initialize selected asset only once when primary asset is first available
  useEffect(() => {
    if (primaryAsset && selectedAsset === primaryAsset) {
      // Only initialize if we're starting with the same asset
      console.log('🎯 Initializing selectedAsset with primaryAsset:', primaryAsset);
    }
  }, [primaryAsset]); // Don't reset selectedAsset when user manually changes it

  // Load cached data immediately when asset changes (instant switching)
  useEffect(() => {
    if (!networkEnv || !selectedAsset) return;
    
    console.log(`📦 Checking cache for ${selectedAsset} on ${networkEnv}`);
    const cachedData = getChartDataFromCache(selectedAsset, networkEnv);
    
    if (cachedData && cachedData.length > 0) {
      console.log(`📦 Loading cached data for ${selectedAsset}: ${cachedData.length} points`);
      setChartData(cachedData);
      setChartError(null);
      setChartLoading(false);
      setIsCacheLoaded(true);
    } else {
      console.log(`📦 No valid cache found for ${selectedAsset}, will fetch fresh data`);
      setIsCacheLoaded(false);
      setChartLoading(true); // Set loading when no cache found
    }
  }, [selectedAsset, networkEnv]);

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
    // Asset-specific start dates: stETH from Feb 10, 2024, others from Sep 18, 2025
    const assetStartDate = getAssetStartDate(selectedAsset);
    const targetStartDate = new Date(assetStartDate);
    
    const poolStartDate = new Date(Number(poolInfo.payoutStart) * 1000);
    
    // Use the later of: asset-specific start date or actual pool start
    const recentStartDate = targetStartDate > poolStartDate ? targetStartDate : poolStartDate;
    const recentTimestamps = getEndOfDayTimestamps(recentStartDate, now);
    
    console.log('⏰ Generated ASSET-SPECIFIC timestamps for', selectedAsset, ':', {
      recentCount: recentTimestamps.length,
      startDate: recentStartDate.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0],
      totalDays: Math.round((now.getTime() - recentStartDate.getTime()) / (24 * 60 * 60 * 1000)),
      assetStartDate: assetStartDate
    });
    console.log('=== END TIMESTAMP GENERATION ===\n');
    
    return { recentTimestamps };
  }, [poolInfo, selectedAsset]);

  // Split large timestamp arrays into safe 60-day batches to avoid 500 errors
  const BATCH_QUERIES = useMemo(() => {
  console.log('=== ASSET-SPECIFIC BATCHED QUERY CONSTRUCTION ===');
  console.log('🎯 Selected Asset:', selectedAsset);
  console.log('🎯 Asset from context:', primaryAsset);
  console.log('⏰ Total timestamps for safe batching:', recentTimestamps.length);
  console.log('🌍 Network Environment:', networkEnv);
    
    if (recentTimestamps.length === 0) {
      return [];
    }
    
    // Get asset-specific deposit pool address
    const depositPoolAddress = networkEnv ? getDepositPoolAddress(selectedAsset, networkEnv) : undefined;
    
    if (!depositPoolAddress) {
      console.log('❌ No deposit pool address found for asset:', selectedAsset, 'on network:', networkEnv);
      return [];
    }
    
    console.log('🔍 Using deposit pool address:', depositPoolAddress);
    
    // Split into 60-day chunks to avoid API limits while getting complete data
    const batchSize = 60;
    const batches = [];
    
    for (let i = 0; i < recentTimestamps.length; i += batchSize) {
      const chunk = recentTimestamps.slice(i, i + batchSize);
      const query = buildDepositsQuery(chunk, depositPoolAddress);
      batches.push({
        query,
        timestamps: chunk,
        startDate: new Date(chunk[0] * 1000).toISOString().split('T')[0],
        endDate: new Date(chunk[chunk.length - 1] * 1000).toISOString().split('T')[0],
        batchIndex: Math.floor(i / batchSize),
        asset: selectedAsset,
        depositPoolAddress
      });
    }
    
    console.log(`✅ Created ${batches.length} asset-specific batches for ${selectedAsset} covering ${recentTimestamps.length} days total`);
    batches.forEach((batch, idx) => {
      console.log(`   Batch ${idx + 1}: ${batch.timestamps.length} days (${batch.startDate} to ${batch.endDate})`);
    });
    console.log('=== END ASSET-SPECIFIC BATCHED QUERY CONSTRUCTION ===\n');
    
    return batches;
  }, [recentTimestamps, selectedAsset, networkEnv]);
  
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

  // CACHED: Batched data loading with caching support
  useEffect(() => {
    console.log('=== 🚀 DATA LOADING EFFECT TRIGGERED ===');
    console.log('🌍 Network Environment:', networkEnv);
    console.log('🎯 Selected Asset:', selectedAsset);
    console.log('⏰ Total Timestamps Available:', recentTimestamps.length);
    console.log('🔍 Safe Batch Queries Available:', BATCH_QUERIES.length);
    console.log('📊 Current Chart Data Length:', chartData.length);
    console.log('📦 Cache Loaded:', isCacheLoaded);
    
    // Skip if we already have valid cached data for this asset
    if (isCacheLoaded && chartData.length > 0) {
      console.log('📦 Using cached data, skipping API fetch');
      return;
    }
    
    // Only fetch for mainnet with valid batch queries
    if (!networkEnv || networkEnv === 'testnet' || BATCH_QUERIES.length === 0) {
      console.log('❌ Skipping safe batched data load:', {
        networkEnv,
        isTestnet: networkEnv === 'testnet',
        batchQueriesLength: BATCH_QUERIES.length,
        hasNetworkEnv: !!networkEnv,
        networkEnvType: typeof networkEnv
      });
      setChartLoading(false);
      return;
    }

    console.log('🚀 Starting ASSET-SPECIFIC BATCHED data load for', selectedAsset);
    console.log(`📞 Making ${BATCH_QUERIES.length} sequential API calls for ${selectedAsset} pool`);
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
          console.log(`📡 Processing ${batchQuery.asset} batch ${batchCount}/${BATCH_QUERIES.length} (${batchQuery.startDate} to ${batchQuery.endDate})`);
          console.log(`🔍 Using deposit pool address: ${batchQuery.depositPoolAddress}`);
          
          const queryString = print(batchQuery.query);
          console.log(`📝 GraphQL Query (first 500 chars): ${queryString.substring(0, 500)}...`);
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
          console.log(`📊 Raw API response for ${batchQuery.asset} batch ${batchCount}:`, {
            hasData: !!result.data,
            hasErrors: !!result.errors,
            dataKeys: result.data ? Object.keys(result.data) : [],
            errors: result.errors
          });
          
          if (result.errors) {
            console.error(`❌ GraphQL errors in batch ${batchCount}:`, result.errors);
            throw new Error(result.errors[0]?.message || `GraphQL error in batch ${batchCount}`);
          }

          // Process this batch's data using the d0, d1, d2... structure
          if (result.data) {
            const dayKeys = Object.keys(result.data).filter(key => key.startsWith('d'));
            console.log(`✅ ${batchQuery.asset} batch ${batchCount} received ${dayKeys.length} day snapshots`);
            
            let lastTotalStakedWei = allDataPoints.length > 0 
              ? ethers.utils.parseEther(allDataPoints[allDataPoints.length - 1].deposits.toString())
              : ethers.BigNumber.from(0);
            
            let hasAnyData = false;
            
            batchQuery.timestamps.forEach((timestampSec: number, index: number) => {
              const dayKey = `d${index}`;
              const interactionData = result.data[dayKey]?.[0];
              let currentTotalStakedWei = lastTotalStakedWei;

              console.log(`🔍 ${batchQuery.asset} day ${index} (${dayKey}):`, {
                hasInteractionData: !!interactionData,
                totalStaked: interactionData?.totalStaked,
                blockTimestamp: interactionData?.blockTimestamp
              });

              if (interactionData?.totalStaked) {
                try {
                  currentTotalStakedWei = ethers.BigNumber.from(interactionData.totalStaked);
                  hasAnyData = true;
                  console.log(`✅ ${batchQuery.asset} day ${index}: Found data, totalStaked = ${ethers.utils.formatEther(currentTotalStakedWei)} ETH`);
                } catch (error) {
                  console.warn(`⚠️ Error parsing totalStaked in batch ${batchCount}, day ${index}:`, error);
                  if (allDataPoints.length === 0) currentTotalStakedWei = ethers.BigNumber.from(0);
                }
              } else {
                console.log(`ℹ️ ${batchQuery.asset} day ${index}: No data, using last value = ${ethers.utils.formatEther(currentTotalStakedWei)} ETH`);
                if (allDataPoints.length === 0) {
                  currentTotalStakedWei = ethers.BigNumber.from(0);
                }
              }
              
              lastTotalStakedWei = currentTotalStakedWei;
              const depositValue = parseFloat(ethers.utils.formatEther(currentTotalStakedWei));
              
              console.log(`📊 ${batchQuery.asset} day ${index}: Final depositValue = ${depositValue}`);
              
              allDataPoints.push({
                date: new Date(timestampSec * 1000).toISOString(),
                deposits: depositValue,
                timestamp: timestampSec,
              });
            });
            
            if (!hasAnyData && batchCount === 1) {
              console.log(`ℹ️ No historical data found for ${batchQuery.asset} - this is expected for new assets`);
            }
            
            console.log(`📊 Batch ${batchCount} summary: hasAnyData=${hasAnyData}, added ${batchQuery.timestamps.length} data points`);
          }
          
          // Add small delay between batches to be respectful to API
          if (batchCount < BATCH_QUERIES.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
        console.log(`✅ ${selectedAsset} BATCHED fetch completed: ${allDataPoints.length} total data points from ${batchCount} batches`);
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
            
            console.log(`✅ ${selectedAsset} BATCHED data processing completed:`, sortedData.length, 'data points');
            console.log('📊 First data point:', sortedData[0]);
            console.log('📊 Last data point:', sortedData[sortedData.length - 1]);
            console.log('📊 Date range:', {
              from: sortedData[0]?.date?.split('T')[0],
              to: sortedData[sortedData.length - 1]?.date?.split('T')[0]
            });
            console.log('📊 Sample of all data points:', sortedData.map(p => ({ date: p.date.split('T')[0], deposits: p.deposits })));

            setChartData(sortedData);
            setChartError(null);
            
            // Save to cache for future use
            saveChartDataToCache(selectedAsset, sortedData, networkEnv);
            setIsCacheLoaded(true);
          } catch (processingError: unknown) {
            const errorMessage = (processingError instanceof Error) ? processingError.message : String(processingError);
            console.error("Error processing batched chart data:", processingError);
            setChartError(`Failed to process chart data: ${errorMessage}`);
            setChartData([]);
          }
        } else {
          console.log('❌ No safe batched data received for', selectedAsset);
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
  }, [selectedAsset, networkEnv, BATCH_QUERIES, isCacheLoaded]); // Updated dependencies for cached batching

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
    setSelectedAsset: (asset: TokenType) => {
      console.log('🎯 setSelectedAsset called with:', asset, 'current:', selectedAsset);
      setSelectedAsset(asset);
    },
    // Cache utilities
    clearCache: () => {
      try {
        localStorage.removeItem(CHART_DATA_CACHE_KEY);
        console.log('📦 Chart data cache cleared');
      } catch (error) {
        console.warn('Error clearing cache:', error);
      }
    },
    // Dynamic asset detection for live data
    availableAssets,
    hasMultipleAssets,
    availableTokens,
    // Always show asset switcher, but dynamic buttons based on available assets
    showAssetSwitcher: true,
  };
} 