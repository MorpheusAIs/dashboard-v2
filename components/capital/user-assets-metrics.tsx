"use client";

import { MetricCardMinimal } from "@/components/metric-card-minimal";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

interface MetricsData {
  stakedValue: string;
  dailyEmissionsEarned: string;
  totalAvailableToClaim: string;
  averageApr: string;
}

interface UserAssetsMetricsProps {
  metricsData: MetricsData;
  isLoading: boolean;
}

export function UserAssetsMetrics({ metricsData, isLoading }: UserAssetsMetricsProps) {
  const averageAprDisplay =
    metricsData.averageApr === "N/A"
      ? metricsData.averageApr
      : metricsData.averageApr.replace("%", "");

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-x-2 sm:gap-x-4 gap-y-2 mb-6">
      <MetricCardMinimal
        title="Deposits Value"
        value={metricsData.stakedValue}
        isUSD={true}
        disableGlow={true}
        className="col-span-1"
        isLoading={isLoading}
      />
      <MetricCardMinimal
        title={
          <div className="flex items-center gap-1">
            Current Daily Rewards
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3 w-3 text-gray-400 hover:text-gray-300 cursor-help" />
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  avoidCollisions={false}
                  className="bg-black/90 text-white border-emerald-500/20 z-50 rounded-xl max-w-xs"
                >
                  <p className="text-sm">
                    Projection of what you&apos;ll earn per day going forward based on your current deposit
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        }
        value={metricsData.dailyEmissionsEarned}
        label="MOR"
        disableGlow={true}
        autoFormatNumbers={false}
        className="col-span-1"
        isLoading={isLoading}
      />
      <MetricCardMinimal
        title={
          <div className="flex items-center gap-1">
            Total Earned
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3 w-3 text-gray-400 hover:text-gray-300 cursor-help" />
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  avoidCollisions={false}
                  className="bg-black/90 text-white border-emerald-500/20 z-50 rounded-xl max-w-xs"
                >
                  <p className="text-sm">
                    Total MOR rewards accrued across your positions, including amounts not yet claimable
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        }
        value={metricsData.totalAvailableToClaim}
        label="MOR"
        disableGlow={true}
        autoFormatNumbers={true}
        className="col-span-1"
        isLoading={isLoading}
      />
      <MetricCardMinimal
        title={
          <div className="flex items-center gap-1">
            Average APR
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3 w-3 text-gray-400 hover:text-gray-300 cursor-help" />
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  avoidCollisions={false}
                  className="bg-black/90 text-white border-emerald-500/20 z-50 rounded-xl max-w-xs"
                >
                  <p className="text-sm">
                    Deposit-weighted average estimated APR across your positions, including each asset&apos;s power factor
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        }
        value={averageAprDisplay}
        label={metricsData.averageApr !== "N/A" ? "%" : undefined}
        disableGlow={true}
        autoFormatNumbers={false}
        className="col-span-1"
        isLoading={isLoading}
      />
    </div>
  );
}
