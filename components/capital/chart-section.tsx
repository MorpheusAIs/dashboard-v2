"use client";

import { DepositStethChart } from "@/components/capital/deposit-steth-chart";
import { MetricCardMinimal } from "@/components/metric-card-minimal";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { useCapitalChartData } from "@/app/hooks/useCapitalChartData";
import { useCapitalMetrics } from "@/app/hooks/useCapitalMetrics";
import { mainnet } from "wagmi/chains";

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

export function ChartSection() {
  // Temporary flag to show indexing animation
  const showIndexingAnimation = true;

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
    // Dynamic asset switching support
    availableAssets,
  } = useCapitalChartData();

  // Get live metrics data from pool contracts
  const {
    totalValueLockedUSD,
    currentDailyRewardMOR,
    // avgApyRate, // Temporarily commented out with APR metric card
    activeStakers,
    isLoading: metricsLoading,
    error: metricsError,
  } = useCapitalMetrics();

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
    // Temporarily commented out - Avg. APR Rate metric card
    // {
    //   title: "Avg. APR Rate",
    //   value: avgApyRate,
    //   label: "%",
    //   autoFormatNumbers: false,
    //   className: "",
    //   disableGlow: true,
    //   isGreen: true,
    // },
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
                        availableAssets={availableAssets} // Always pass live assets from API
                      />
                      {isLoadingHistorical && (
                        <div className="absolute top-2 right-2 text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded z-5">
                          Loading historical data...
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
                </>
              )}
            </div>
          </div>
        </div>
    </>
  );
} 