"use client";

import { useState, useEffect } from "react";
import { DepositStethChart } from "@/components/capital/deposit-steth-chart";
import { CumulativeDepositsChart } from "@/components/capital/cumulative-deposits-chart";
import { MetricCardMinimal } from "@/components/metric-card-minimal";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { useCapitalChartData } from "@/app/hooks/useCapitalChartData";
import { useCapitalMetrics } from "@/app/hooks/useCapitalMetrics";
import { useCumulativeDeposits } from "@/hooks/use-cumulative-deposits";

// Morlord APR cache management
const MORLORD_APR_CACHE_KEY = 'morpheus_morlord_apr_cache';
const MORLORD_CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

interface MorlordAPRCache {
  apr: number;
  timestamp: number;
}

const getCachedMorlordAPR = (): number | null => {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(MORLORD_APR_CACHE_KEY);
    if (!cached) return null;

    const parsedCache: MorlordAPRCache = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is still valid (not expired)
    if (now - parsedCache.timestamp > MORLORD_CACHE_EXPIRY_MS) {
      localStorage.removeItem(MORLORD_APR_CACHE_KEY);
      return null;
    }

    console.log(`📦 Using cached Morlord APR: ${parsedCache.apr}% (${Math.round((now - parsedCache.timestamp) / 1000 / 60 / 60)} hours old)`);
    return parsedCache.apr;
  } catch (error) {
    console.warn('Error reading Morlord APR cache:', error);
    return null;
  }
};

const setCachedMorlordAPR = (apr: number): void => {
  if (typeof window === 'undefined') return;
  try {
    const cache: MorlordAPRCache = {
      apr,
      timestamp: Date.now()
    };
    localStorage.setItem(MORLORD_APR_CACHE_KEY, JSON.stringify(cache));
    console.log(`💾 Cached Morlord APR: ${apr}%`);
  } catch (error) {
    console.warn('Error saving Morlord APR cache:', error);
  }
};

// Mock data for indexing animation
const mockChartData = [
  { date: "2024-01-01T00:00:00Z", deposits: 1000000 },
  { date: "2024-01-15T00:00:00Z", deposits: 1200000 },
  { date: "2024-02-01T00:00:00Z", deposits: 1400000 },
  { date: "2024-02-15T00:00:00Z", deposits: 1600000 },
  { date: "2024-03-01T00:00:00Z", deposits: 1800000 },
  { date: "2024-03-15T00:00:00Z", deposits: 2000000 },
  { date: "2024-04-01T00:00:00Z", deposits: 2200000 },
  { date: "2024-04-15T00:00:00Z", deposits: 2400000 },
  { date: "2024-05-01T00:00:00Z", deposits: 2600000 },
  { date: "2024-05-15T00:00:00Z", deposits: 2800000 },
  { date: "2024-06-01T00:00:00Z", deposits: 3000000 },
  { date: "2024-06-15T00:00:00Z", deposits: 3200000 },
];

interface ChartSectionProps {
  isMorlordData?: boolean;
  chartType?: 'deposits' | 'cumulative';
  manual_formula?: boolean;
}

export function ChartSection({ isMorlordData = true, chartType = 'cumulative', manual_formula = true }: ChartSectionProps) {
  // Temporary flag to show indexing animation
  const showIndexingAnimation = false; // Temporarily disabled to see actual chart

  // Morlord data state - initialize with cached data if available
  const [morlordApr, setMorlordApr] = useState<number | null>(() =>
    isMorlordData ? getCachedMorlordAPR() : null
  );
  const [morlordLoading, setMorlordLoading] = useState(false);
  const [morlordError, setMorlordError] = useState<string | null>(null);

  // Fetch Morlord data when flag is enabled
  useEffect(() => {
    if (!isMorlordData) return;

    const fetchMorlordData = async () => {
      setMorlordLoading(true);
      setMorlordError(null);
      try {
        const response = await fetch('/api/morlord');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.success && typeof data.apr === 'number') {
          setMorlordApr(data.apr);
          setCachedMorlordAPR(data.apr); // Cache the result
        } else {
          throw new Error(data.error || 'Invalid APR data format');
        }
      } catch (error) {
        console.error('Failed to fetch Morlord data:', error);
        setMorlordError(error instanceof Error ? error.message : 'Failed to fetch data');
        
        // On error, fall back to cached data if available
        const cachedAPR = getCachedMorlordAPR();
        if (cachedAPR !== null) {
          console.log('Using cached Morlord APR due to API error');
          setMorlordApr(cachedAPR);
        }
      } finally {
        setMorlordLoading(false);
      }
    };

    // Always fetch fresh data on page load, cache is only used for initial state and error fallback
    fetchMorlordData();
  }, [isMorlordData]);

  // Get chart data for historical deposits chart
  const {
    chartData,
    chartLoading,
    chartError,
    isLoadingHistorical,
    selectedAsset,
    setSelectedAsset,
    // Dynamic asset switching support
    availableAssets,
  } = useCapitalChartData();

  // Get cumulative deposits data when chartType is 'cumulative'
  const {
    data: cumulativeDepositsData,
    loading: cumulativeDepositsLoading,
    error: cumulativeDepositsError,
  } = useCumulativeDeposits();

  // Get live metrics data from pool contracts (includes token prices, TVL, and daily emissions)
  const {
    totalValueLockedUSD,
    currentDailyRewardMOR,
    avgAprRate, // Weighted average APR across all assets
    activeStakers,
    isLoading: metricsLoading,
    error: metricsError,
    // Get all token prices from DefiLlama via useCapitalMetrics - single source of truth
    morPrice,
    stethPrice,
    linkPrice,
    wbtcPrice,
    wethPrice,
  } = useCapitalMetrics();

  // Calculate APR using manual formula when flag is enabled
  // This ensures proper sequencing: prices loaded -> TVL calculated -> daily emissions fetched -> APR calculated
  const manualApr = (() => {
    if (!manual_formula) {
      return null;
    }

    // Wait for all data to be loaded (metrics hook handles price loading internally)
    if (metricsLoading) {
      console.log('⏳ Waiting for metrics data to load...', {
        metricsLoading,
        totalValueLockedUSD,
        currentDailyRewardMOR,
        morPrice
      });
      return null;
    }

    console.log('🔢 Manual APR calculation debug:', {
      totalValueLockedUSD,
      currentDailyRewardMOR,
      morPrice,
      stethPrice,
      linkPrice,
      wbtcPrice,
      wethPrice
    });

    // Check for required values - all must be available
    if (!totalValueLockedUSD || !currentDailyRewardMOR || !morPrice) {
      console.log('❌ Missing required values for APR calculation', {
        hasTVL: !!totalValueLockedUSD,
        hasDailyEmissions: !!currentDailyRewardMOR,
        hasMorPrice: !!morPrice
      });
      return null;
    }

    // Skip calculation if currentDailyRewardMOR is a loading or error state
    if (currentDailyRewardMOR === 'N/A' || currentDailyRewardMOR === '...' || currentDailyRewardMOR === 'Error') {
      console.log('⏳ Daily emissions data not ready:', currentDailyRewardMOR);
      return null;
    }

    // Skip calculation if totalValueLockedUSD is a loading or error state
    if (totalValueLockedUSD === '...' || totalValueLockedUSD === 'Error' || totalValueLockedUSD === 'Calculating...') {
      console.log('⏳ TVL data not ready:', totalValueLockedUSD);
      return null;
    }

    // Ensure all values are numbers - handle formatted strings with commas
    const tvl = typeof totalValueLockedUSD === 'number'
      ? totalValueLockedUSD
      : parseFloat(typeof totalValueLockedUSD === 'string' ? totalValueLockedUSD.replace(/,/g, '') : String(totalValueLockedUSD));
    const dailyEmissions = typeof currentDailyRewardMOR === 'number'
      ? currentDailyRewardMOR
      : parseFloat(typeof currentDailyRewardMOR === 'string' ? currentDailyRewardMOR.replace(/,/g, '') : String(currentDailyRewardMOR));
    const morPriceNum = typeof morPrice === 'number' ? morPrice : parseFloat(String(morPrice));

    console.log('🔢 Parsed values:', { tvl, dailyEmissions, morPriceNum });

    if (isNaN(tvl) || isNaN(dailyEmissions) || isNaN(morPriceNum) || tvl <= 0 || morPriceNum <= 0) {
      console.log('❌ Invalid values for APR calculation', {
        tvl,
        dailyEmissions,
        morPriceNum,
        tvlValid: !isNaN(tvl) && tvl > 0,
        emissionsValid: !isNaN(dailyEmissions),
        priceValid: !isNaN(morPriceNum) && morPriceNum > 0
      });
      return null;
    }

    // Manual formula: apr = (daily_rewards_usd * 365) / tvl_usd * 100
    // where daily_rewards_usd = mor_daily_emissions * mor_price
    const dailyRewardsUsd = dailyEmissions * morPriceNum;
    const apr = (dailyRewardsUsd * 365) / tvl * 100;

    console.log('✅ APR calculation result:', {
      dailyRewardsUsd,
      apr,
      apr_formatted: apr.toFixed(2)
    });

    return apr.toFixed(2);
  })();

  // Use manual formula, Morlord data, or default approach based on flags
  const displayAprRate = manual_formula
    ? (manualApr !== null ? `${manualApr}%` : undefined)
    : (isMorlordData
        ? (morlordApr !== null ? `${morlordApr.toFixed(2)}%` : undefined)
        : avgAprRate);

  const metricCards = [
    {
      title: "Total Value Locked",
      value: totalValueLockedUSD,
      isUSD: true,
      autoFormatNumbers: true,
      className: "",
      disableGlow: true,
      isGreen: true,
    },
    {
      title: "Daily Emissions",
      value: currentDailyRewardMOR,
      label: "MOR",
      autoFormatNumbers: true,
      className: "",
      disableGlow: true,
      isGreen: true,
    },
    // Weighted average APR across all assets
    {
      title: "Avg. APR Rate",
      value: displayAprRate,
      label: "%",
      autoFormatNumbers: false,
      className: "",
      disableGlow: true,
      isGreen: true,
    },
    {
      title: "Active Depositors",
      value: activeStakers,
      autoFormatNumbers: true,
      className: "",
      disableGlow: true,
      isGreen: true,
    },
  ];

  return (
    <>
        {/* Mobile: 2x2 metric grid + chart below, Desktop: 1x3 metric row + chart below */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-2 sm:gap-x-4 gap-y-2 h-full grid-rows-[90px_90px_1fr] sm:grid-rows-[100px_1fr]">
          {/* 3 Metric Cards */}
          {metricCards.map((card, index) => (
            <div key={index} className="col-span-1 h-full">
              <MetricCardMinimal {...card} />
            </div>
          ))}

          {/* Deposit Chart (spans all columns, remaining height) */}
          <div className="col-span-2 sm:col-span-4 relative h-full">
            <GlowingEffect 
                spread={40}
                glow={true}
                disabled={false}
                proximity={64}
                inactiveZone={0.01}
                borderWidth={2}
                borderRadius="rounded-xl"
            />
            {/* Chart content container - positioned absolutely to not affect glow effect */}
            <div className="absolute inset-0 rounded-xl">
              {/* Show indexing animation */}
              {showIndexingAnimation && (
                <>
                  {/* Chart with reduced opacity */}
                  <div className="relative h-full overflow-hidden rounded-xl opacity-30">
                    <DepositStethChart
                      data={mockChartData}
                      selectedAsset={selectedAsset}
                      onAssetChange={setSelectedAsset}
                      showAssetSwitcher={true}
                      availableAssets={availableAssets}
                    />
                  </div>

                  {/* Traveling line animation */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-blue-400 to-transparent animate-pulse"
                         style={{
                           left: '10%',
                           animation: 'travel 4s linear infinite',
                         }} />
                    <div className="absolute top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-green-400 to-transparent animate-pulse"
                         style={{
                           left: '30%',
                           animation: 'travel 4s linear infinite',
                           animationDelay: '1s',
                         }} />
                    <div className="absolute top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-purple-400 to-transparent animate-pulse"
                         style={{
                           left: '70%',
                           animation: 'travel 4s linear infinite',
                           animationDelay: '2s',
                         }} />
                  </div>

                  {/* Add CSS animation */}
                  <style dangerouslySetInnerHTML={{
                    __html: `
                      @keyframes travel {
                        0% { transform: translateX(-100%); opacity: 0; }
                        10% { opacity: 1; }
                        90% { opacity: 1; }
                        100% { transform: translateX(100vw); opacity: 0; }
                      }
                    `
                  }} />

                  {/* Indexing overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl">
                    <div className="flex items-center space-x-3 bg-black/50 px-6 py-4 rounded-lg border border-emerald-500/20">
                      {/* <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-400 border-t-transparent"></div> */}
                      <span className="text-emerald-400 font-light text-lg">To be available soon.</span>
                    </div>
                  </div>
                </>
              )}

              {/* Normal chart rendering when not showing indexing animation */}
              {!showIndexingAnimation && (
                <>
                  {((chartType === 'deposits' && (chartLoading || metricsLoading || (isMorlordData && morlordLoading))) ||
                    (chartType === 'cumulative' && (cumulativeDepositsLoading || metricsLoading || (isMorlordData && morlordLoading)))) && (
                    <div className="flex justify-center items-center h-full">
                      <p>Loading Chart...</p>
                    </div>
                  )}
                  {((chartType === 'deposits' && (chartError || metricsError || morlordError)) ||
                    (chartType === 'cumulative' && (cumulativeDepositsError || metricsError || morlordError))) && (
                    <div className="flex flex-col justify-center items-center h-full text-amber-500/80">
                      <p className="text-lg font-medium mb-2">Chart data temporarily unavailable</p>
                      <p className="text-sm text-gray-400">
                        {chartType === 'cumulative' && cumulativeDepositsError
                          ? 'Historical cumulative deposits data is being updated. Please try again later.'
                          : 'Please try again later or refresh the page.'}
                      </p>
                    </div>
                  )}
                  {((chartType === 'deposits' && !chartLoading && !metricsLoading && !(isMorlordData && morlordLoading) && !chartError && !metricsError && !morlordError) ||
                    (chartType === 'cumulative' && !cumulativeDepositsLoading && !metricsLoading && !(isMorlordData && morlordLoading) && !cumulativeDepositsError && !metricsError && !morlordError)) && (
                    <div className="relative h-full overflow-hidden rounded-xl">
                      {chartType === 'deposits' ? (
                        <DepositStethChart
                          data={chartData}
                          selectedAsset={selectedAsset}
                          onAssetChange={setSelectedAsset}
                          showAssetSwitcher={true} // Always show asset switcher
                          availableAssets={availableAssets} // Always pass live assets from API
                          isLoading={chartLoading}
                        />
                      ) : (
                        <CumulativeDepositsChart
                          data={cumulativeDepositsData}
                          isLoading={cumulativeDepositsLoading}
                        />
                      )}
                      {chartType === 'deposits' && isLoadingHistorical && (
                        <div className="absolute top-2 right-2 text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded z-5">
                          Loading historical data...
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
    </>
  );
} 