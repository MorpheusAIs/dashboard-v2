"use client";

import { MetricCardMinimal } from "@/components/metric-card-minimal";

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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-2 sm:gap-x-4 gap-y-2 mb-6">
      <MetricCardMinimal
        title="Deposits Value"
        value={metricsData.stakedValue}
        isUSD={true}
        disableGlow={true}
        className="col-span-1"
        isLoading={isLoading}
      />
      <MetricCardMinimal
        title="Current Daily Rewards"
        value={metricsData.dailyEmissionsEarned}
        label="MOR"
        disableGlow={true}
        autoFormatNumbers={true}
        className="col-span-1"
        isLoading={isLoading}
      />
      <MetricCardMinimal
        title="Claimable Rewards"
        value={metricsData.totalAvailableToClaim}
        label="MOR"
        disableGlow={true}
        autoFormatNumbers={true}
        className="col-span-1"
        isLoading={isLoading}
      />
      <MetricCardMinimal
        title="Total MOR Earned"
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
