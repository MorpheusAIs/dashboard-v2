"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type TimeUnit } from "@/lib/utils/power-factor-utils";
import { LockPeriodSlider } from "./lock-period-slider";

interface TimeLockPeriodSelectorProps {
  lockValue: string;
  lockUnit: TimeUnit;
  onLockValueChange: (value: string) => void;
  onLockUnitChange: (unit: TimeUnit) => void;
  minLockPeriodError?: string | null;
  maxLockPeriodError?: string | null;
  disabled?: boolean;
  className?: string;
  lockPeriodError?: string | null;
  onValueChangeExtra?: (value: string) => void;
  onUnitChangeExtra?: (unit: TimeUnit) => void;
  variant?: "input" | "slider";
  lockDays?: number;
  onLockDaysChange?: (days: number) => void;
}

export function TimeLockPeriodSelector({
  lockValue,
  lockUnit,
  onLockValueChange,
  onLockUnitChange,
  minLockPeriodError,
  maxLockPeriodError,
  lockPeriodError,
  disabled = false,
  className = "",
  onValueChangeExtra,
  onUnitChangeExtra,
  variant = "input",
  lockDays,
  onLockDaysChange,
}: TimeLockPeriodSelectorProps) {
  const handleValueChange = (value: string) => {
    onLockValueChange(value);
    onValueChangeExtra?.(value);
  };

  const handleUnitChange = (unit: TimeUnit) => {
    onLockUnitChange(unit);
    onUnitChangeExtra?.(unit);
  };

  const validationMessages = (
    <>
      {minLockPeriodError && (
        <div className="text-xs text-yellow-600 bg-yellow-500/10 border border-yellow-500/20 rounded p-2">
          ⚠️ {minLockPeriodError}
        </div>
      )}
      {maxLockPeriodError && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2">
          {maxLockPeriodError}
        </div>
      )}
      {lockPeriodError && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2">
          {lockPeriodError}
        </div>
      )}
    </>
  );

  if (variant === "slider") {
    const sliderDays = lockDays ?? (parseInt(lockValue, 10) || 7);

    return (
      <div className={`space-y-3 ${className}`}>
        <Label className="text-sm font-medium text-white">MOR Claims Lock Period</Label>
        <LockPeriodSlider
          lockDays={sliderDays}
          onLockDaysChange={(days) => {
            onLockDaysChange?.(days);
            handleValueChange(String(days));
            handleUnitChange("days");
          }}
          disabled={disabled}
        />
        {validationMessages}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="text-sm font-medium text-white">MOR Claims Lock Period</Label>
      <p className="text-xs text-gray-400">
        Minimum 7 days required.
      </p>

      <div className="flex gap-2">
        <Input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="0"
          value={lockValue}
          onChange={(e) => handleValueChange(e.target.value)}
          className={`flex-1 bg-background text-white ${
            lockPeriodError || maxLockPeriodError ? "!border-red-500 border-2" :
            minLockPeriodError ? "border-yellow-500 border" : "border-gray-700 border"
          }`}
          disabled={disabled}
        />
        <Select value={lockUnit} onValueChange={handleUnitChange} disabled={disabled}>
          <SelectTrigger className="w-32 bg-background border-gray-700 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="days">Days</SelectItem>
            <SelectItem value="months">Months</SelectItem>
            <SelectItem value="years">Years</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {validationMessages}
    </div>
  );
}
