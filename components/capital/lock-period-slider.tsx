"use client";

import { useMemo } from "react";
import { HelpCircle } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  POWER_FACTOR_CONSTANTS,
  formatLockDurationFromDays,
  getMaxLockSliderDays,
} from "@/lib/utils/power-factor-utils";

interface LockPeriodSliderProps {
  lockDays: number;
  onLockDaysChange: (days: number) => void;
  disabled?: boolean;
  className?: string;
  /** Dynamic max power factor achievable at max slider position (e.g. "x9.7") */
  maxPowerFactor?: string;
}

export function LockPeriodSlider({
  lockDays,
  onLockDaysChange,
  disabled = false,
  className = "",
  maxPowerFactor,
}: LockPeriodSliderProps) {
  const minDays = POWER_FACTOR_CONSTANTS.MIN_DEPOSIT_LOCK_DAYS;
  const maxDays = useMemo(() => getMaxLockSliderDays(), []);
  const maxDurationLabel = useMemo(() => formatLockDurationFromDays(maxDays), [maxDays]);

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{minDays} days</span>
        <span className="text-emerald-400 font-medium">
          {formatLockDurationFromDays(lockDays)}
        </span>
        <span>~{maxDurationLabel} ({maxPowerFactor ?? "..."})</span>
      </div>

      <Slider
        min={minDays}
        max={maxDays}
        step={1}
        value={[lockDays]}
        onValueChange={(values) => onLockDaysChange(values[0] ?? minDays)}
        disabled={disabled}
        showTooltip
        tooltipContent={(value) => formatLockDurationFromDays(value)}
        className="py-2"
      />

      <div className="flex justify-between text-[10px] text-gray-500 uppercase tracking-wide">
        <span>Min lock</span>
        <span>Max achievable today</span>
      </div>

      <div className="flex items-start gap-1 text-[10px] text-gray-500 leading-relaxed">
        <span>Multiplier growth slows near the contract ceiling.</span>
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="shrink-0 mt-[1px] text-gray-400 hover:text-gray-200 transition-colors"
                aria-label="Why does the power factor flatten?"
              >
                <HelpCircle className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="bg-black/90 text-white border-emerald-500/20 rounded-xl max-w-xs"
            >
              <p className="text-xs leading-relaxed">
                Power factor follows a tanh dilution curve (MRC42) that saturates near the contract&apos;s ~x10.7 ceiling. Two consequences:
              </p>
              <ul className="text-xs leading-relaxed mt-2 space-y-1 list-disc list-inside">
                <li>The same lock length yields a lower power factor over time as MOR emissions grow.</li>
                <li>Beyond ~10 years from today, extra lock time adds almost nothing — diminishing returns.</li>
              </ul>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
