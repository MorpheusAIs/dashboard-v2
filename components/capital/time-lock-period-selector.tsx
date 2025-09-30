"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type TimeUnit } from "@/lib/utils/power-factor-utils";

interface TimeLockPeriodSelectorProps {
  lockValue: string;
  lockUnit: TimeUnit;
  onLockValueChange: (value: string) => void;
  onLockUnitChange: (unit: TimeUnit) => void;
  minLockPeriodError?: string | null;
  maxLockPeriodError?: string | null;
  disabled?: boolean;
  className?: string;
  lockPeriodError?: string | null; // Additional error type for deposit modal
  onValueChangeExtra?: (value: string) => void; // Extra callback for deposit modal form error clearing
  onUnitChangeExtra?: (unit: TimeUnit) => void; // Extra callback for deposit modal form error clearing
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
}: TimeLockPeriodSelectorProps) {
  const handleValueChange = (value: string) => {
    onLockValueChange(value);
    onValueChangeExtra?.(value);
  };

  const handleUnitChange = (unit: TimeUnit) => {
    onLockUnitChange(unit);
    onUnitChangeExtra?.(unit);
  };
  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="text-sm font-medium text-white">MOR Claims Lock Period</Label>
      <p className="text-xs text-gray-400">
        Minimum 7 days required. Locking MOR claims increases your power factor for future rewards but delays claiming. Power Factor activates after ~7-8 months, scales up to x10.7 at ~7 years, and remains capped at x10.7 for longer periods
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
            lockPeriodError || maxLockPeriodError ? '!border-red-500 border-2' :
            minLockPeriodError ? 'border-yellow-500 border' : 'border-gray-700 border'
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

      {/* Lock period validation error messages */}
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
    </div>
  );
}
