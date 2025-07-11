"use client";

import { DepositStethChart } from "@/components/capital/deposit-steth-chart";
import { MetricCardMinimal } from "@/components/metric-card-minimal";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { useCapitalChartData } from "@/app/hooks/useCapitalChartData";
import { mainnet } from "wagmi/chains";

export function ChartSection() {
  const {
    chartData,
    chartLoading,
    chartError,
    isLoadingHistorical,
    totalDepositsMOR,
    totalValueLockedUSD,
    currentDailyRewardMOR,
    avgApyRate,
    activeStakers,
    networkEnv,
    switchToChain,
    isNetworkSwitching,
  } = useCapitalChartData();

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
      title: "Current Daily Reward",
      value: currentDailyRewardMOR,
      label: "MOR",
      autoFormatNumbers: true,
      className: "",
      disableGlow: true,
      isGreen: true,
    },
    {
      title: "Avg. APY Rate",
      value: avgApyRate,
      autoFormatNumbers: false,
      className: "",
      disableGlow: true,
      isGreen: true,
    },
    {
      title: "Active Stakers",
      value: activeStakers,
      autoFormatNumbers: true,
      className: "",
      disableGlow: true,
      isGreen: true,
    },
  ];

  return (
    <>
        {/* 4x4 Grid Layout */}
        <div className="grid grid-cols-4 gap-x-4 gap-y-2 h-full" style={{ gridTemplateRows: '120px 1fr' }}>
          {/* Row 1: 4 Metric Cards */}
          {metricCards.map((card, index) => (
            <div key={index} className="col-span-1">
              <MetricCardMinimal {...card} />
            </div>
          ))}

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