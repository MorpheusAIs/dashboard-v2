"use client";

import { DepositStethChart } from "@/components/capital/deposit-steth-chart";
import { MetricCardMinimal } from "@/components/metric-card-minimal";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { useCapitalChartData } from "@/app/hooks/useCapitalChartData";
import { useCapitalMetrics } from "@/app/hooks/useCapitalMetrics";
import { mainnet } from "wagmi/chains";

export function ChartSection() {
  // Get chart data for historical deposits chart
  const {
    chartData,
    chartLoading,
    chartError,
    isLoadingHistorical,
    networkEnv,
    switchToChain,
    isNetworkSwitching,
    selectedAsset,
    setSelectedAsset,
    useMockData,
    totalValueLockedUSD: mockTotalValueLockedUSD,
    currentDailyRewardMOR: mockCurrentDailyRewardMOR,
    avgApyRate: mockAvgApyRate,
    activeStakers: mockActiveStakers,
    // Dynamic asset switching support
    availableAssets,
    hasMultipleAssets,
  } = useCapitalChartData();

  // Get live metrics data from pool contracts
  const {
    totalValueLockedUSD: liveValueLockedUSD,
    currentDailyRewardMOR: liveDailyRewardMOR,
    avgApyRate: liveAvgApyRate,
    activeStakers: liveActiveStakers,
    isLoading: metricsLoading,
    error: metricsError,
  } = useCapitalMetrics();

  // Use mock or live metrics based on useMockData
  const totalValueLockedUSD = useMockData ? mockTotalValueLockedUSD : liveValueLockedUSD;
  const currentDailyRewardMOR = useMockData ? mockCurrentDailyRewardMOR : liveDailyRewardMOR;
  const avgApyRate = useMockData ? mockAvgApyRate : liveAvgApyRate;
  const activeStakers = useMockData ? mockActiveStakers : liveActiveStakers;

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
    {
      title: "Avg. APR Rate",
      value: avgApyRate,
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
        {/* Mobile: 2x2 metric grid + chart below, Desktop: 1x4 metric row + chart below */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-2 sm:gap-x-4 gap-y-2 h-full grid-rows-[90px_90px_1fr] sm:grid-rows-[100px_1fr]">
          {/* 4 Metric Cards */}
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
              {/* Conditional Rendering for Chart */}
              {(chartLoading || metricsLoading) && (
                <div className="flex justify-center items-center h-full">
                  <p>Loading Chart...</p>
                </div>
              )}
              {(chartError || metricsError) && (
                <div className="flex justify-center items-center h-full text-red-500">
                  <p>{chartError || metricsError}</p>
                </div>
              )}
              {!chartLoading && !metricsLoading && !chartError && !metricsError && chartData.length > 0 && (
                <div className="relative h-full overflow-hidden rounded-xl">
                  <DepositStethChart 
                    data={chartData}
                    selectedAsset={selectedAsset}
                    onAssetChange={setSelectedAsset}
                    showAssetSwitcher={true} // Always show asset switcher
                    availableAssets={useMockData ? undefined : availableAssets} // Pass live assets when not using mock data
                  />
                  {isLoadingHistorical && (
                    <div className="absolute top-2 right-2 text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded z-5">
                      Loading historical data...
                    </div>
                  )}
                  {!useMockData && hasMultipleAssets && (
                    <div className="absolute top-2 left-2 text-xs text-green-400 bg-gray-800 px-2 py-1 rounded z-5">
                      {availableAssets?.length || 0} pools with deposits
                    </div>
                  )}
                </div>
              )}
              {!chartLoading && !metricsLoading && !chartError && !metricsError && chartData.length === 0 && (
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
        </div>
    </>
  );
} 