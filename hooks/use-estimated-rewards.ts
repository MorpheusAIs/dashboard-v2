import { useMemo } from "react";
import { useReadContract } from "wagmi";
import { 
  calculateEstimatedRewards,
  getLockDurationInYears,
  type PoolRateData,
  type UserRateData 
} from "@/lib/utils/reward-calculation-utils";

// Import ABI for contract calls
import ERC1967ProxyAbi from "@/app/abi/ERC1967Proxy.json";

export interface EstimatedRewardsResult {
  estimatedRewards: string;
  isLoading: boolean;
  isValid: boolean;
  error?: string;
  debug?: {
    depositAmount: string;
    currentPoolRate: string;
    userRate: string;
    powerFactor: string;
    lockDurationYears: number;
    baseRewards: string;
    finalRewards: string;
  };
}

export interface UseEstimatedRewardsParams {
  // Contract details
  contractAddress?: `0x${string}`;
  chainId?: number;
  poolId?: bigint;
  
  // Calculation inputs
  depositAmount: string; // Amount user wants to deposit
  powerFactorString: string; // Power factor from power factor hook (e.g., "x2.5")
  lockValue: string; // Lock duration value
  lockUnit: "days" | "months" | "years"; // Lock duration unit
  
  // Optional existing user data (for existing users vs new deposits)
  existingUserData?: UserRateData;
  
  // Control
  enabled?: boolean;
}

/**
 * Hook for calculating estimated rewards for deposits with lock periods
 * Uses the documented rate-based formula with power factor multiplication
 */
export function useEstimatedRewards({
  contractAddress,
  chainId,
  poolId = BigInt(0),
  depositAmount,
  powerFactorString,
  lockValue,
  lockUnit,
  existingUserData,
  enabled = true,
}: UseEstimatedRewardsParams): EstimatedRewardsResult {
  
  // Fetch current pool rate data
  const {
    data: poolRateDataRaw,
    isLoading: isLoadingPoolRate,
    error: poolRateError,
  } = useReadContract({
    address: contractAddress,
    abi: ERC1967ProxyAbi,
    functionName: 'poolsData',
    args: [poolId],
    chainId,
    query: {
      enabled: enabled && !!contractAddress && !!chainId,
      retry: 3,
      retryDelay: 1000,
      refetchInterval: 30000, // Refresh every 30 seconds
    }
  });

  // Parse pool rate data
  const poolRateData = useMemo((): PoolRateData | null => {
    if (!poolRateDataRaw) return null;
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dataArray = poolRateDataRaw as any[];
      if (!Array.isArray(dataArray) || dataArray.length < 3) return null;
      
      return {
        lastUpdate: BigInt(dataArray[0]),
        rate: BigInt(dataArray[1]), // This is the current pool rate we need
        totalVirtualDeposited: BigInt(dataArray[2]),
      };
    } catch (error) {
      console.error("Error parsing pool rate data:", error);
      return null;
    }
  }, [poolRateDataRaw]);

  // Calculate estimated rewards
  const calculation = useMemo((): EstimatedRewardsResult => {
    if (process.env.NODE_ENV !== 'production') {
      console.group('🎯 [Estimated Rewards] Calculation Update');
      console.log('Inputs:', {
        depositAmount,
        powerFactorString,
        lockValue,
        lockUnit,
        hasPoolData: !!poolRateData,
        hasExistingUser: !!existingUserData
      });
    }

    // Validation checks
    if (!enabled) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Hook disabled');
        console.groupEnd();
      }
      return {
        estimatedRewards: "---",
        isLoading: false,
        isValid: false,
        error: "Calculation disabled"
      };
    }

    if (isLoadingPoolRate) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Pool rate loading...');
        console.groupEnd();
      }
      return {
        estimatedRewards: "Loading...",
        isLoading: true,
        isValid: false
      };
    }

    if (poolRateError) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Pool rate error:', poolRateError);
        console.groupEnd();
      }
      return {
        estimatedRewards: "Error",
        isLoading: false,
        isValid: false,
        error: "Failed to fetch pool data"
      };
    }

    if (!poolRateData) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('No pool rate data available');
        console.groupEnd();
      }
      return {
        estimatedRewards: "---",
        isLoading: false,
        isValid: false,
        error: "No pool data"
      };
    }

    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Invalid deposit amount');
        console.groupEnd();
      }
      return {
        estimatedRewards: "---",
        isLoading: false,
        isValid: false,
        error: "Invalid deposit amount"
      };
    }

    if (powerFactorString === "Loading..." || powerFactorString.includes("Error")) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Power factor not ready:', powerFactorString);
        console.groupEnd();
      }
      return {
        estimatedRewards: "---",
        isLoading: false,
        isValid: false,
        error: "Power factor not ready"
      };
    }

    // Get lock duration in years for projection
    const lockDurationYears = getLockDurationInYears(lockValue, lockUnit);
    
    // Calculate estimated rewards
    const result = calculateEstimatedRewards(
      depositAmount,
      poolRateData.rate, // Current pool rate
      powerFactorString,
      lockDurationYears
    );

    const finalResult = {
      estimatedRewards: result.formattedRewards + " MOR",
      isLoading: false,
      isValid: result.isValid,
      error: result.error,
      debug: process.env.NODE_ENV !== 'production' ? {
        depositAmount,
        currentPoolRate: poolRateData.rate.toString(),
        userRate: existingUserData?.rate.toString() || "0",
        powerFactor: powerFactorString,
        lockDurationYears,
        baseRewards: result.baseRewards.toString(),
        finalRewards: result.finalRewards.toString(),
      } : undefined
    };

    if (process.env.NODE_ENV !== 'production') {
      console.log('Final Result:', finalResult);
      console.groupEnd();
    }

    return finalResult;
  }, [
    enabled,
    isLoadingPoolRate,
    poolRateError,
    poolRateData,
    depositAmount,
    powerFactorString,
    lockValue,
    lockUnit,
    existingUserData
  ]);

  return calculation;
}

/**
 * Simplified hook for getting just the formatted estimated rewards
 * @param params - Same parameters as useEstimatedRewards
 * @returns Just the formatted rewards string
 */
export function useEstimatedRewardsDisplay(params: UseEstimatedRewardsParams): string {
  const result = useEstimatedRewards(params);
  return result.estimatedRewards;
}

/**
 * Hook for getting current pool rate data (useful for other components)
 * @param contractAddress - Contract address
 * @param chainId - Chain ID  
 * @param poolId - Pool ID (default 0)
 * @returns Current pool rate data
 */
export function usePoolRateData(
  contractAddress?: `0x${string}`,
  chainId?: number,
  poolId: bigint = BigInt(0)
) {
  const {
    data: poolRateDataRaw,
    isLoading,
    error,
    refetch,
  } = useReadContract({
    address: contractAddress,
    abi: ERC1967ProxyAbi,
    functionName: 'poolsData',
    args: [poolId],
    chainId,
    query: {
      enabled: !!contractAddress && !!chainId,
      retry: 3,
      retryDelay: 1000,
      refetchInterval: 30000,
    }
  });

  const poolRateData = useMemo((): PoolRateData | null => {
    if (!poolRateDataRaw) return null;
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dataArray = poolRateDataRaw as any[];
      if (!Array.isArray(dataArray) || dataArray.length < 3) return null;
      
      return {
        lastUpdate: BigInt(dataArray[0]),
        rate: BigInt(dataArray[1]),
        totalVirtualDeposited: BigInt(dataArray[2]),
      };
    } catch (error) {
      console.error("Error parsing pool rate data:", error);
      return null;
    }
  }, [poolRateDataRaw]);

  return {
    poolRateData,
    isLoading,
    error,
    refetch,
  };
}
