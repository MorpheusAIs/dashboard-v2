"use client";

/**
 * Hook for simulating power factor/multiplier changes
 * Handles lock duration to multiplier estimation
 */

import { useState, useCallback, useMemo } from "react";
import { useSimulateContract } from "wagmi";
import type { TimeUnit } from "@/context/capital/types";
import { PUBLIC_POOL_ID } from "@/context/capital/constants";
import { durationToSeconds } from "@/lib/utils/capital-helpers";
import { formatBigInt } from "@/lib/utils/formatters";

// Import ABI
import ERC1967ProxyAbi from "@/app/abi/ERC1967Proxy.json";

export interface MultiplierSimulationOptions {
  distributorV2Address?: `0x${string}`;
  l1ChainId: number;
}

export interface MultiplierSimulationResult {
  multiplierSimArgs: { value: string; unit: TimeUnit } | null;
  triggerMultiplierEstimation: (lockValue: string, lockUnit: TimeUnit) => void;
  estimatedMultiplierValue: string;
  isSimulatingMultiplier: boolean;
}

export function useMultiplierSimulation(options: MultiplierSimulationOptions): MultiplierSimulationResult {
  const { distributorV2Address, l1ChainId } = options;

  const [multiplierSimArgs, setMultiplierSimArgs] = useState<{ value: string; unit: TimeUnit } | null>(null);

  // Build simulation args
  const simulationArgs = useMemo(() => {
    if (!multiplierSimArgs) return undefined;
    const durationSeconds = durationToSeconds(multiplierSimArgs.value, multiplierSimArgs.unit);
    if (durationSeconds <= BigInt(0)) return undefined;
    const estimatedLockStartTimestamp = BigInt(Math.floor(Date.now() / 1000));
    const estimatedLockEndTimestamp = estimatedLockStartTimestamp + durationSeconds;
    return [PUBLIC_POOL_ID, estimatedLockStartTimestamp, estimatedLockEndTimestamp];
  }, [multiplierSimArgs]);

  const {
    data: simulatedMultiplierResult,
    error: simulateMultiplierError,
    isLoading: isSimulatingMultiplier,
  } = useSimulateContract({
    address: distributorV2Address,
    abi: ERC1967ProxyAbi,
    functionName: "getClaimLockPeriodMultiplier",
    args: simulationArgs,
    chainId: l1ChainId,
    query: {
      enabled: !!multiplierSimArgs && !!distributorV2Address && !!l1ChainId,
    },
  });

  const triggerMultiplierEstimation = useCallback((lockValue: string, lockUnit: TimeUnit) => {
    if (lockValue && parseInt(lockValue, 10) > 0) {
      setMultiplierSimArgs({ value: lockValue, unit: lockUnit });
    } else {
      setMultiplierSimArgs(null);
    }
  }, []);

  const estimatedMultiplierValue = useMemo(() => {
    if (isSimulatingMultiplier) return "Loading...";
    if (simulateMultiplierError) return "Error";
    if (simulatedMultiplierResult?.result) {
      // Use 21 decimals as per documentation
      const rawFormatted = formatBigInt(simulatedMultiplierResult.result as bigint, 21, 1);
      const numValue = parseFloat(rawFormatted);
      // Cap at actual contract maximum of 9.7x
      const cappedValue = Math.min(numValue, 9.7);
      return cappedValue.toFixed(1) + "x";
    }
    return "---x";
  }, [simulatedMultiplierResult, simulateMultiplierError, isSimulatingMultiplier]);

  return {
    multiplierSimArgs,
    triggerMultiplierEstimation,
    estimatedMultiplierValue,
    isSimulatingMultiplier,
  };
}
