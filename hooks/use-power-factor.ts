import { useState, useCallback, useMemo, useEffect } from "react";
import { useReadContract } from "wagmi";
import {
  durationToSeconds,
  formatPowerFactorPrecise,
  validateLockDuration,
  willActivatePowerFactor,
  calculateUnlockDate,
  // calculatePowerFactorFromDuration, // No longer needed - removed client-side calculation
  type TimeUnit
} from "@/lib/utils/power-factor-utils";
import { getContractAddress } from "@/config/networks";
import { useNetwork } from "@/context/network-context";

// Import ABI for the contract
import LockMultiplierMathAbi from "@/app/abi/LockMultiplierMath.json";

export interface PowerFactorResult {
  powerFactor: string;
  isValid: boolean;
  isLoading: boolean;
  error?: string;
  warning?: string;
  unlockDate?: Date;
  willActivate: boolean;
}

export interface UsePowerFactorParams {
  contractAddress?: `0x${string}`;
  chainId?: number;
  enabled?: boolean;
}

// DEPRECATED: Mainnet StETH specific hook - COMMENTED OUT
// We now use contract calls for all networks for consistency and accuracy
/*
function useMainnetStETHPowerFactor() {
  console.log('🧮 [Power Factor] Using client-side calculation for mainnet');

  const [lockValue, setLockValue] = useState<string>("");
  const [lockUnit, setLockUnit] = useState<TimeUnit>("months");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationWarning, setValidationWarning] = useState<string | null>(null);

  // Calculate power factor using client-side MRC42 formula
  const calculatePowerFactor = useCallback((
    value: string,
    unit: TimeUnit
  ): PowerFactorResult => {
    // Validate the input
    const validation = validateLockDuration(value, unit);

    if (!validation.isValid) {
      setValidationError(validation.errorMessage || null);
      setValidationWarning(null);
      return {
        powerFactor: "x1.0",
        isValid: false,
        isLoading: false,
        error: validation.errorMessage,
        willActivate: false,
      };
    }

    setValidationError(null);
    setValidationWarning(validation.warningMessage || null);

    // Check if this period will activate power factor
    const willActivate = willActivatePowerFactor(value, unit);

    // Calculate unlock date
    const unlockDate = calculateUnlockDate(value, unit);

    // Use client-side calculation
    const powerFactorString = calculatePowerFactorFromDuration(value, unit);

    return {
      powerFactor: powerFactorString,
      isValid: true,
      isLoading: false,
      warning: validation.warningMessage,
      unlockDate: unlockDate || undefined,
      willActivate,
    };
  }, []);

  // Set lock parameters and trigger calculation
  const setLockPeriod = useCallback((value: string, unit: TimeUnit) => {
    setLockValue(value);
    setLockUnit(unit);
  }, []);

  // Get current power factor result
  const currentResult = useMemo((): PowerFactorResult => {
    if (!lockValue) {
      return {
        powerFactor: "x1.0",
        isValid: true,
        isLoading: false,
        willActivate: false,
      };
    }

    return calculatePowerFactor(lockValue, lockUnit);
  }, [lockValue, lockUnit, calculatePowerFactor]);

  const clear = useCallback(() => {
    setLockValue("");
    setLockUnit("months");
    setValidationError(null);
    setValidationWarning(null);
  }, []);

  return {
    lockValue,
    lockUnit,
    validationError,
    validationWarning,
    isLoading: false,
    contractError: null,
    calculatePowerFactor,
    setLockPeriod,
    currentResult,
    retry: () => {}, // No retry needed for client-side calculation
    clear,
    rawMultiplier: undefined,
    contractArgs: undefined,
  };
}
*/

// Contract-based hook for all networks - authoritative power factor calculations
function useContractPowerFactor({
  contractAddress,
  chainId,
  enabled = true,
}: UsePowerFactorParams) {
  const { environment } = useNetwork();
  const [lockValue, setLockValue] = useState<string>("");
  const [lockUnit, setLockUnit] = useState<TimeUnit>("months");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationWarning, setValidationWarning] = useState<string | null>(null);

  // Get the LockMultiplierMath contract address
  const lockMultiplierMathAddress = useMemo(() => {
    if (!chainId) return undefined;
    return getContractAddress(chainId, 'lockMultiplierMath', environment);
  }, [chainId, environment]);

  // Calculate lock timestamps for contract call
  const contractArgs = useMemo(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.group('⚙️ [Power Factor Debug] Contract Args Calculation');
      console.log('Lock Value:', lockValue);
      console.log('Lock Unit:', lockUnit);
      console.log('Enabled:', enabled);
      console.log('Chain ID:', chainId);
      console.log('LockMultiplierMath Address:', lockMultiplierMathAddress);
    }

    if (!lockValue || !enabled || !lockMultiplierMathAddress) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Early return: No lock value, not enabled, or no contract address');
        console.groupEnd();
      }
      return undefined;
    }

    const validation = validateLockDuration(lockValue, lockUnit);
    if (!validation.isValid) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Early return: Validation failed:', validation);
        console.groupEnd();
      }
      return undefined;
    }

    const durationSeconds = durationToSeconds(lockValue, lockUnit);
    if (durationSeconds <= BigInt(0)) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Early return: Invalid duration seconds:', durationSeconds.toString());
        console.groupEnd();
      }
      return undefined;
    }

    const lockStart = BigInt(Math.floor(Date.now() / 1000)); // Current timestamp
    const lockEnd = lockStart + durationSeconds;
    const args = [lockStart, lockEnd];

    if (process.env.NODE_ENV !== 'production') {
      console.log('Duration Seconds:', durationSeconds.toString());
      console.log('Lock Start Timestamp:', lockStart.toString());
      console.log('Lock End Timestamp:', lockEnd.toString());
      console.log('Final Contract Args:', args.map(arg => arg.toString()));

      // Special debugging for maximum lock periods
      const durationYears = Number(durationSeconds) / (365.25 * 24 * 60 * 60);
      if (durationYears >= 5.5) {
        console.log('🎯 [MAX LOCK DEBUG] Detected maximum lock period');
        console.log('Duration in years:', durationYears.toFixed(2));
        console.log('Expected max power factor: x9.7 (actual contract maximum)');
        console.log('Lock period details:', { lockValue, lockUnit });
      }

      console.groupEnd();
    }

    return args;
  }, [lockValue, lockUnit, enabled, lockMultiplierMathAddress]);

  // Contract call to get the multiplier
  const {
    data: rawMultiplier,
    isLoading,
    error: contractError,
    refetch,
  } = useReadContract({
    address: lockMultiplierMathAddress as `0x${string}`,
    abi: LockMultiplierMathAbi,
    functionName: 'getLockPeriodMultiplier',
    args: contractArgs,
    chainId,
    query: {
      enabled: !!contractArgs && !!lockMultiplierMathAddress && !!chainId && enabled,
      retry: 3,
      retryDelay: 1000,
    }
  });

  // Debug logging for contract calls
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      // Debug for maximum lock periods
      if (contractArgs && lockValue === '6' && lockUnit === 'years' && rawMultiplier) {
        console.log('🎯 [Max Lock] Contract returned:', rawMultiplier.toString());
        const manualCalculation = Number(rawMultiplier) / Math.pow(10, 21) / 10000;
        console.log('🎯 [Max Lock] Power Factor:', manualCalculation.toFixed(1) + 'x (contract maximum)');
      }
    }
  }, [contractAddress, chainId, contractArgs, isLoading, rawMultiplier, contractError, enabled, lockValue, lockUnit]);

  /**
   * Calculate power factor for given lock parameters
   * @param value Duration value
   * @param unit Time unit
   * @returns Power factor calculation result
   */
  const calculatePowerFactor = useCallback((
    value: string,
    unit: TimeUnit
  ): PowerFactorResult => {
    // Validate the input
    const validation = validateLockDuration(value, unit);

    // Set validation states
    if (!validation.isValid) {
      setValidationError(validation.errorMessage || null);
      setValidationWarning(null);
      return {
        powerFactor: "x1.0",
        isValid: false,
        isLoading: false,
        error: validation.errorMessage,
        willActivate: false,
      };
    }

    setValidationError(null);
    setValidationWarning(validation.warningMessage || null);

    // Check if this period will activate power factor
    const willActivate = willActivatePowerFactor(value, unit);

    // Calculate unlock date
    const unlockDate = calculateUnlockDate(value, unit);

    // If we're currently loading a contract call, return loading state
    if (isLoading && lockValue === value && lockUnit === unit) {
      return {
        powerFactor: "Loading...",
        isValid: true,
        isLoading: true,
        warning: validation.warningMessage,
        unlockDate: unlockDate || undefined,
        willActivate,
      };
    }

    // If we have contract error, return error state
    if (contractError && lockValue === value && lockUnit === unit) {
      console.error("Power factor contract error:", contractError);
      return {
        powerFactor: "x1.0",
        isValid: true,
        isLoading: false,
        error: "Failed to calculate power factor",
        warning: validation.warningMessage,
        unlockDate: unlockDate || undefined,
        willActivate,
      };
    }

    // If we have a result from the contract and it matches current params
    if (rawMultiplier && lockValue === value && lockUnit === unit) {
      const formattedPowerFactor = formatPowerFactorPrecise(rawMultiplier as bigint);

      return {
        powerFactor: formattedPowerFactor,
        isValid: true,
        isLoading: false,
        warning: validation.warningMessage,
        unlockDate: unlockDate || undefined,
        willActivate,
      };
    }

    // Default case - return base multiplier
    return {
      powerFactor: "x1.0",
      isValid: true,
      isLoading: false,
      warning: validation.warningMessage,
      unlockDate: unlockDate || undefined,
      willActivate,
    };
  }, [rawMultiplier, contractError, isLoading, lockValue, lockUnit, contractArgs, contractAddress, chainId]);

  /**
   * Set lock parameters and trigger calculation
   * @param value Duration value
   * @param unit Time unit
   */
  const setLockPeriod = useCallback((value: string, unit: TimeUnit) => {
    setLockValue(value);
    setLockUnit(unit);
  }, []);

  /**
   * Get current power factor result
   */
  const currentResult = useMemo((): PowerFactorResult => {
    if (!lockValue) {
      const defaultResult = {
        powerFactor: "x1.0",
        isValid: true,
        isLoading: false,
        willActivate: false,
      };

      return defaultResult;
    }

    const result = calculatePowerFactor(lockValue, lockUnit);

    if (process.env.NODE_ENV !== 'production') {
      console.log('Calculated Result:', result);
    }

    return result;
  }, [lockValue, lockUnit, calculatePowerFactor]);

  /**
   * Retry the contract call if it failed
   */
  const retry = useCallback(() => {
    if (contractError) {
      refetch();
    }
  }, [contractError, refetch]);

  /**
   * Clear current lock period
   */
  const clear = useCallback(() => {
    setLockValue("");
    setLockUnit("months");
    setValidationError(null);
    setValidationWarning(null);
  }, []);

  return {
    // Current state
    lockValue,
    lockUnit,
    validationError,
    validationWarning,

    // Contract state
    isLoading,
    contractError,

    // Calculation functions
    calculatePowerFactor,
    setLockPeriod,

    // Current result
    currentResult,

    // Utility functions
    retry,
    clear,

    // Raw data for debugging
    rawMultiplier,
    contractArgs,
  };
}

/**
 * Hook for calculating and managing power factor for lock periods
 * Uses contract calls to LockMultiplierMath for authoritative power factor calculations
 * @param params Configuration parameters
 * @returns Power factor calculation functions and state
 */
export function usePowerFactor(params: UsePowerFactorParams) {
  // Always use contract-based calculations for consistency and accuracy
  return useContractPowerFactor(params);
}

/**
 * Simplified hook for one-off power factor calculations
 * @param params Configuration parameters
 * @returns Calculation function only
 */
export function usePowerFactorCalculation({
  contractAddress,
  chainId,
}: Pick<UsePowerFactorParams, 'contractAddress' | 'chainId'>) {
  const { environment } = useNetwork();
  const [tempArgs, setTempArgs] = useState<[bigint, bigint] | undefined>();

  // Get the LockMultiplierMath contract address
  const lockMultiplierMathAddress = useMemo(() => {
    if (!chainId) return undefined;
    return getContractAddress(chainId, 'lockMultiplierMath', environment);
  }, [chainId, environment]);

  const {
    data: rawMultiplier,
    isLoading,
    error: contractError,
  } = useReadContract({
    address: lockMultiplierMathAddress as `0x${string}`,
    abi: LockMultiplierMathAbi,
    functionName: 'getLockPeriodMultiplier',
    args: tempArgs,
    chainId,
    query: {
      enabled: !!tempArgs && !!lockMultiplierMathAddress && !!chainId,
      retry: 2,
      retryDelay: 1000,
    }
  });

  /**
   * Calculate power factor for specific parameters
   * @param value Duration value
   * @param unit Time unit
   * @returns Promise with power factor result
   */
  const calculate = useCallback(async (
    value: string, 
    unit: TimeUnit
  ): Promise<PowerFactorResult> => {
    const validation = validateLockDuration(value, unit);
    
    if (!validation.isValid) {
      return {
        powerFactor: "x1.0",
        isValid: false,
        isLoading: false,
        error: validation.errorMessage,
        willActivate: false,
      };
    }

    const durationSeconds = durationToSeconds(value, unit);
    if (durationSeconds <= BigInt(0)) {
      return {
        powerFactor: "x1.0",
        isValid: false,
        isLoading: false,
        error: "Invalid duration",
        willActivate: false,
      };
    }

    const lockStart = BigInt(Math.floor(Date.now() / 1000));
    const lockEnd = lockStart + durationSeconds;
    const willActivate = willActivatePowerFactor(value, unit);
    const unlockDate = calculateUnlockDate(value, unit);

    // Set args to trigger the contract call
    setTempArgs([lockStart, lockEnd]);

    // Wait for the result (this is a simplified approach)
    // In a real implementation, you might want to use a more sophisticated polling mechanism
    return new Promise((resolve) => {
      const checkResult = () => {
        if (isLoading) {
          setTimeout(checkResult, 100);
          return;
        }

        if (contractError) {
          resolve({
            powerFactor: "x1.0",
            isValid: true,
            isLoading: false,
            error: "Failed to calculate power factor",
            warning: validation.warningMessage,
            unlockDate: unlockDate || undefined,
            willActivate,
          });
          return;
        }

        if (rawMultiplier) {
          const formattedPowerFactor = formatPowerFactorPrecise(rawMultiplier as bigint);
          resolve({
            powerFactor: formattedPowerFactor,
            isValid: true,
            isLoading: false,
            warning: validation.warningMessage,
            unlockDate: unlockDate || undefined,
            willActivate,
          });
          return;
        }

        // Fallback
        resolve({
          powerFactor: "x1.0",
          isValid: true,
          isLoading: false,
          warning: validation.warningMessage,
          unlockDate: unlockDate || undefined,
          willActivate,
        });
      };

      checkResult();
    });
  }, [contractAddress, chainId, isLoading, contractError, rawMultiplier]);

  return {
    calculate,
    isLoading,
    error: contractError,
  };
}
