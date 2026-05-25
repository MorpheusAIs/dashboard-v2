"use client";

import type { ReactNode } from "react";
import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { parsePowerFactorValue } from "@/lib/utils/power-factor-utils";
import type { AssetSymbol } from "@/context/CapitalPageContext";

function InfoLabel({
  label,
  tooltip,
}: {
  label: string;
  tooltip: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-gray-300">{label}</span>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <HelpCircle className="h-3 w-3 text-gray-400 hover:text-gray-300 cursor-help shrink-0" />
          </TooltipTrigger>
          <TooltipContent
            side="top"
            avoidCollisions={false}
            className="bg-black/90 text-white border-emerald-500/20 z-50 rounded-xl max-w-xs"
          >
            <p className="text-sm">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

function MetricRow({
  label,
  value,
  delta,
  isLoading,
}: {
  label: ReactNode;
  value: ReactNode;
  delta?: string | null;
  isLoading?: boolean;
}) {
  return (
    <div className="flex justify-between items-start gap-3">
      <div className="min-w-0">{label}</div>
      <div className="text-right shrink-0">
        <div className="text-white font-medium">
          {isLoading ? "Loading..." : value}
        </div>
        {delta && !isLoading && (
          <div className="text-xs text-emerald-400 mt-0.5">{delta}</div>
        )}
      </div>
    </div>
  );
}

function formatDelta(current: number, baseline: number, suffix: string, decimals = 2): string | null {
  const diff = current - baseline;
  if (Math.abs(diff) < 0.0001) return null;
  const sign = diff > 0 ? "+" : "";
  return `${sign}${diff.toFixed(decimals)}${suffix}`;
}

function formatMorDelta(current: number, baseline: number): string | null {
  const diff = current - baseline;
  if (Math.abs(diff) < 0.000001) return null;
  const sign = diff > 0 ? "+" : "";
  return `${sign}${diff.toFixed(4)} MOR/day`;
}

interface DepositModalResultsPanelProps {
  amount: string;
  selectedAsset: AssetSymbol;
  unlockDate: Date | null;
  powerFactor: string;
  baselinePowerFactor: string;
  baseApr: string;
  dailyMorReward: number;
  baselineDailyMorReward: number;
  isPowerFactorLoading?: boolean;
  isMetricsLoading?: boolean;
  powerFactorError?: string;
  powerFactorWarning?: string;
}

export function DepositModalResultsPanel({
  amount,
  selectedAsset,
  unlockDate,
  powerFactor,
  baselinePowerFactor,
  baseApr,
  dailyMorReward,
  baselineDailyMorReward,
  isPowerFactorLoading,
  isMetricsLoading,
  powerFactorError,
  powerFactorWarning,
}: DepositModalResultsPanelProps) {
  const hasAmount = !!amount && parseFloat(amount) > 0;
  const currentPf = parsePowerFactorValue(powerFactor);
  const baselinePf = parsePowerFactorValue(baselinePowerFactor);

  const baseAprNumeric = baseApr !== "N/A" && baseApr !== "Coming Soon"
    ? parseFloat(baseApr.replace("%", ""))
    : null;

  const effectiveApr = baseAprNumeric !== null ? baseAprNumeric * currentPf : null;
  const baselineEffectiveApr = baseAprNumeric !== null ? baseAprNumeric * baselinePf : null;

  const pfDelta = formatDelta(currentPf, baselinePf, "×", 1);
  const aprDelta =
    effectiveApr !== null && baselineEffectiveApr !== null
      ? formatDelta(effectiveApr, baselineEffectiveApr, "%", 2)
      : null;
  const dailyMorDelta = hasAmount ? formatMorDelta(dailyMorReward, baselineDailyMorReward) : null;

  return (
    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 h-full flex flex-col">
      <h3 className="text-sm font-semibold text-emerald-400 mb-4">Estimated Results</h3>

      <div className="space-y-3 text-sm flex-1">
        {hasAmount && (
          <MetricRow
            label="Deposit Amount"
            value={`${amount} ${selectedAsset}`}
          />
        )}

        <MetricRow
          label="Available to claim on"
          value={
            unlockDate
              ? unlockDate.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "—"
          }
          isLoading={isPowerFactorLoading}
        />

        <MetricRow
          label="Power Factor"
          value={powerFactor}
          delta={pfDelta ? `${pfDelta} vs min lock` : null}
          isLoading={isPowerFactorLoading}
        />

        <MetricRow
          label={
            <InfoLabel
              label="APR"
              tooltip="Annual Percentage Rate based on current pool yield, your deposit share, and MOR price. Effective APR = base pool APR × your power factor."
            />
          }
          value={
            effectiveApr !== null
              ? `${effectiveApr.toFixed(2)}%`
              : baseApr
          }
          delta={aprDelta ? `${aprDelta} vs min lock` : null}
          isLoading={isMetricsLoading}
        />

        <MetricRow
          label={
            <InfoLabel
              label="MOR Daily Reward"
              tooltip="Estimated daily MOR based on current emission rate, pool share, deposit size, power factor, and token prices. Values change as pool TVL, emissions, and market prices shift."
            />
          }
          value={
            hasAmount
              ? `${dailyMorReward.toFixed(4)} MOR`
              : "Enter amount"
          }
          delta={dailyMorDelta ? `${dailyMorDelta} vs min lock` : null}
          isLoading={isMetricsLoading && hasAmount}
        />
      </div>

      {powerFactorWarning && (
        <p className="text-xs text-yellow-500/90 mt-3">* {powerFactorWarning}</p>
      )}
      {powerFactorError && (
        <p className="text-xs text-red-400 mt-3">{powerFactorError}</p>
      )}

      <p className="text-[11px] text-gray-500 mt-4 leading-relaxed">
        Drag the lock slider to compare claim timing against reward multipliers. Longer locks increase power factor up to x10.7.
      </p>
    </div>
  );
}
