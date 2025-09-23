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
  lifetimeEmissionsEarned: string;
}

interface UserAssetsMetricsProps {
  metricsData: MetricsData;
  isLoading: boolean;
}

export function UserAssetsMetrics({ metricsData, isLoading }: UserAssetsMetricsProps) {
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
                    Projection of what you&apos;ll earn per day going forward based on your current stake
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
            Claimable Rewards
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
                    Actual rewards that have already accrued and can be withdrawn at unlock date
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
            Total MOR Earned
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
                    Historical total of MOR rewards earned from staking.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        }
        value={metricsData.lifetimeEmissionsEarned}
        label="MOR"
        disableGlow={true}
        autoFormatNumbers={true}
        className="col-span-1"
        isLoading={isLoading}
      />
    </div>
  );
}
