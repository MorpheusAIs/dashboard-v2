"use client";

import { useMemo } from "react";
import { Slider } from "@/components/ui/slider";
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

      <p className="text-[10px] text-gray-500 leading-relaxed">
        Power factor for a given lock length decreases over time as total MOR emissions grow.
      </p>
    </div>
  );
}
