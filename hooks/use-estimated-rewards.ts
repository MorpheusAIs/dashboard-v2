import { useMemo } from "react";
import { useReadContract } from "wagmi";
import { 
  calculateEstimatedRewards,
  getLockDurationInYears,
  type PoolRateData,
  type UserRateData 
} from "@/lib/utils/reward-calculation-utils";

// Import ABI for contract calls
import DistributorV2Abi from "@/app/abi/DistributorV2.json";
import RewardPoolV2Abi from "@/app/abi/RewardPoolV2.json";
import { getContractAddress, type NetworkEnvironment } from "@/config/networks";
import { REFETCH_INTERVALS } from "@/lib/constants/refetch-intervals";

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
  // Refetch function to trigger pool rate data refresh after user actions
  refetch: () => void;
}

export interface UseEstimatedRewardsParams {
  // Contract details
  contractAddress?: `0x${string}`; // DistributorV2 contract address
  chainId?: number;
  poolId?: bigint;
  
  // V7 specific: Asset-specific deposit pool address
  depositPoolAddress?: `0x${string}`; // Address of the specific asset's deposit pool contract
  
  // Network configuration for RewardPoolV2 contract lookup
  networkEnv?: NetworkEnvironment; // 'mainnet' or 'testnet'
  
  // Calculation inputs
  depositAmount: string; // Amount user wants to deposit
  powerFactorString: string; // Power factor from power factor hook (e.g., "x2.5")
  lockValue: string; // Lock duration value
  lockUnit: "days" | "months" | "years"; // Lock duration unit
  
  // Token details - decimals for proper token conversion
  tokenDecimals?: number; // Token decimals (e.g., 8 for wBTC, 18 for stETH)
  
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
  poolId = BigInt(0), // eslint-disable-line @typescript-eslint/no-unused-vars
  depositPoolAddress, // V7: Asset-specific deposit pool address
  networkEnv, // Network environment for RewardPoolV2 contract lookup
  depositAmount,
  powerFactorString,
  lockValue,
  lockUnit,
  tokenDecimals = 18, // Default to 18 for backward compatibility
  existingUserData,
  enabled = true,
}: UseEstimatedRewardsParams): EstimatedRewardsResult {
  
  // Fetch current pool rate data
  // V7 Protocol: Get pool data using correct DistributorV2 and RewardPoolV2 functions
  const rewardPoolIndex = BigInt(0); // Main reward pool index
  
  // Get RewardPoolV2 contract address for actual emission curve data
  const rewardPoolV2Address = useMemo(() => {
    if (!chainId || !networkEnv) return undefined;
    try {
      return getContractAddress(chainId, 'rewardPoolV2', networkEnv) as `0x${string}` | undefined;
    } catch (error) {
      console.warn('RewardPoolV2 contract not found for network:', chainId, networkEnv, error);
      return undefined;
    }
  }, [chainId, networkEnv]);

  // Get actual MOR emission for a 1-year period using RewardPoolV2
  const currentTime = Math.floor(Date.now() / 1000);
  const oneYearLater = currentTime + (365 * 24 * 60 * 60); // 1 year from now
  
  const {
    data: yearlyEmissionData,
    isLoading: isLoadingYearlyEmission,
    error: yearlyEmissionError,
  } = useReadContract({
    address: rewardPoolV2Address,
    abi: RewardPoolV2Abi,
    functionName: 'getPeriodRewards',
    args: [rewardPoolIndex, BigInt(currentTime), BigInt(oneYearLater)],
    chainId,
    query: {
      enabled: enabled && !!rewardPoolV2Address && !!chainId,
      retry: 3,
      retryDelay: 1000,
      refetchInterval: REFETCH_INTERVALS.SLOW,
    }
  });
  
  // Get total undistributed rewards available in the system (fallback)
  const {
    data: undistributedRewardsData,
    isLoading: isLoadingUndistributed,
    error: undistributedError,
  } = useReadContract({
    address: contractAddress,
    abi: DistributorV2Abi,
    functionName: 'undistributedRewards',
    args: [],
    chainId,
    query: {
      enabled: enabled && !!contractAddress && !!chainId,
      retry: 3,
      retryDelay: 1000,
    }
  });

  // Get deposit pool information to calculate user's share
  // V7: Use the specific deposit pool address for the asset
  const {
    data: depositPoolData,
    isLoading: isLoadingDepositPool,
    error: depositPoolError,
    refetch: refetchPoolRateData,
  } = useReadContract({
    address: contractAddress,
    abi: DistributorV2Abi,
    functionName: 'depositPools',
    args: [rewardPoolIndex, depositPoolAddress || contractAddress], // Use depositPoolAddress if provided, fallback to contractAddress
    chainId,
    query: {
      enabled: enabled && !!contractAddress && !!chainId,
      retry: 3,
      retryDelay: 1000,
      refetchInterval: REFETCH_INTERVALS.SLOW,
    }
  });

  // Aggregate loading states
  const isLoadingPoolRate = isLoadingUndistributed || isLoadingDepositPool;
  const poolRateError = undistributedError || depositPoolError;

  // Parse V7 pool rate data from undistributed rewards and deposit pool data
  const poolRateData = useMemo((): PoolRateData | null => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔍 [V7 Contract Debug] Raw Data Check:', {
        contractAddress,
        chainId,
        depositPoolAddress,
        undistributedRewardsData: undistributedRewardsData?.toString(),
        depositPoolData: depositPoolData ? 'Has data' : 'No data',
        undistributedError: undistributedError?.message,
        depositPoolError: depositPoolError?.message,
        isLoadingUndistributed: isLoadingUndistributed,
        isLoadingDepositPool: isLoadingDepositPool
      });
    }
    
    // More resilient approach - try to calculate with available data
    if (!undistributedRewardsData && !depositPoolData) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('🚨 [V7 Contract] No data from either contract call');
      }
      return null;
    }
    
    try {
      // V7 data structure parsing - handle missing data gracefully
      const undistributedRewards = undistributedRewardsData ? BigInt(undistributedRewardsData.toString()) : BigInt(0);
      
      let totalDeposited = BigInt(0);
      let tokenPrice = BigInt(1); // Default to 1 if no price data
      
      if (depositPoolData) {
        // Parse deposit pool struct: [token, chainLinkPath, tokenPrice, deposited, lastUnderlyingBalance, strategy, aToken, isExist]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const poolStruct = depositPoolData as any[];
        if (Array.isArray(poolStruct) && poolStruct.length >= 8) {
          totalDeposited = BigInt(poolStruct[3]); // deposited amount is at index 3
          tokenPrice = BigInt(poolStruct[2] || 1); // tokenPrice at index 2, fallback to 1
        } else {
          console.warn("Invalid deposit pool data structure, using fallback values");
        }
      }
      
      // V7 Emission-Based Rate Calculation using RewardPoolV2
      let rate: bigint;
      
      if (yearlyEmissionData && totalDeposited > BigInt(0)) {
        // ✨ REAL EMISSION CURVE: Use actual MOR emission data from RewardPoolV2
        const yearlyEmission = BigInt(yearlyEmissionData.toString());
        
        // Calculate rate: (yearly MOR emission / total staked) * scale factor
        // This gives us MOR per staked token per year
        rate = (yearlyEmission * BigInt(1e25)) / totalDeposited; // Use 1e25 scale for precision
        
        if (process.env.NODE_ENV !== 'production') {
          console.log('🎯 [Real Emission] Using actual MOR emission curve:', {
            yearlyEmissionMOR: (Number(yearlyEmission) / 1e18).toFixed(2) + ' MOR/year',
            totalDepositedETH: (Number(totalDeposited) / 1e18).toFixed(2) + ' ETH',
            calculatedAPR: ((Number(rate) / 1e25) * 100).toFixed(2) + '%',
            source: 'RewardPoolV2.getPeriodRewards()'
          });
        }
        
      } else if (totalDeposited > BigInt(0) && undistributedRewards > BigInt(0)) {
        // Secondary: Use DistributorV2 undistributed rewards (less accurate than emission curve)
        rate = (undistributedRewards * BigInt(1e25)) / totalDeposited;
        
        if (process.env.NODE_ENV !== 'production') {
          console.log('🔄 [Secondary] Using undistributed rewards:', {
            reason: !yearlyEmissionData ? 'No RewardPoolV2 emission data available' : 'No total deposits',
            calculatedAPR: ((Number(rate) / 1e25) * 100).toFixed(2) + '%',
            source: 'DistributorV2.undistributedRewards()',
            warning: 'This is less accurate than RewardPoolV2 emission curve'
          });
        }
        
      } else {
        // No fallbacks - return null to indicate insufficient data
        console.error('❌ [V7 Rewards] Insufficient contract data for reward estimation:', {
          hasYearlyEmission: !!yearlyEmissionData,
          hasTotalDeposited: totalDeposited > BigInt(0),
          hasUndistributedRewards: undistributedRewards > BigInt(0),
          rewardPoolV2Address,
          yearlyEmissionError: yearlyEmissionError?.message,
          depositPoolError: depositPoolError?.message,
          undistributedError: undistributedError?.message
        });
        return null; // Fail explicitly instead of using fake rates
      }
      
      if (process.env.NODE_ENV !== 'production') {
        let rateType: string;
        if (totalDeposited > BigInt(0)) {
          rateType = 'calculated from deposits';
        } else if (undistributedRewards > BigInt(0)) {
          rateType = 'fallback (no deposits, has rewards)';
        } else {
          rateType = 'development fallback (no data)';
        }
        
        console.log('🎯 [V7 Pool Data] Parsed:', {
          undistributedRewards: undistributedRewards.toString(),
          undistributedRewardsETH: (Number(undistributedRewards) / 1e18).toFixed(6) + ' MOR',
          totalDeposited: totalDeposited.toString(),
          totalDepositedETH: (Number(totalDeposited) / 1e18).toFixed(2) + ' ETH',
          tokenPrice: tokenPrice.toString(),
          calculatedRate: rate.toString(),
          rateAPR: ((Number(rate) / 1e25) * 100).toFixed(2) + '%',
          rateType: rateType,
          isValidRate: rate > BigInt(0),
          hasYearlyEmission: !!yearlyEmissionData,
          yearlyEmissionStatus: !yearlyEmissionData ? (yearlyEmissionError ? 'error' : 'loading') : 'success',
          // Show what 1 ETH deposit would get at this rate (before power factor)
          estimatedFor1ETH: ((Number(rate) / 1e25) * 1).toFixed(6) + ' MOR/year base (before power factor)'
        });
      }
      
      return {
        lastUpdate: BigInt(Math.floor(Date.now() / 1000)), // Use current timestamp
        rate: rate, // Calculated reward rate
        totalVirtualDeposited: totalDeposited, // Use actual deposited amount
      };
    } catch (error) {
      console.error("Error parsing V7 pool data:", error);
      return null;
    }
  }, [undistributedRewardsData, depositPoolData, yearlyEmissionData, contractAddress, chainId, depositPoolAddress, undistributedError, depositPoolError, yearlyEmissionError, isLoadingUndistributed, isLoadingDepositPool, isLoadingYearlyEmission]);

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
        error: "Calculation disabled",
        refetch: refetchPoolRateData
      };
    }

    // V7 Protocol: Proceed with actual calculation using new data structure

    // Include RewardPoolV2 loading state - we're loading if any critical contract call is loading
    const isLoading = isLoadingPoolRate || isLoadingYearlyEmission;
    
    if (isLoading) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Pool rate loading...');
        console.groupEnd();
      }
      return {
        estimatedRewards: "Loading...",
        isLoading: true,
        isValid: false,
        refetch: refetchPoolRateData
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
        error: "Failed to fetch pool data",
        refetch: refetchPoolRateData
      };
    }

    if (!poolRateData) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('No pool rate data available - debugging info:', {
          contractAddress,
          chainId,
          depositPoolAddress,
          rewardPoolV2Address,
          undistributedRewardsData: !!undistributedRewardsData,
          depositPoolData: !!depositPoolData,
          yearlyEmissionData: !!yearlyEmissionData,
          undistributedError: undistributedError ? String(undistributedError) : null,
          depositPoolError: depositPoolError ? String(depositPoolError) : null,
          yearlyEmissionError: yearlyEmissionError ? String(yearlyEmissionError) : null,
          isLoadingYearlyEmission
        });
        console.groupEnd();
      }
      
      // Clear error message about why real contract data isn't available
      let errorMessage = "Unable to fetch real contract data";
      
      if (!rewardPoolV2Address) {
        errorMessage = "RewardPoolV2 contract not configured for this network";
      } else if (yearlyEmissionError) {
        const emissionErrorMsg = String(yearlyEmissionError).slice(0, 100);
        errorMessage = `RewardPoolV2.getPeriodRewards() failed: ${emissionErrorMsg}`;
      } else if (undistributedError && depositPoolError) {
        errorMessage = "Both DistributorV2 contract calls failed - check network connection";
      } else if (undistributedError) {
        const undistributedErrorMsg = String(undistributedError).slice(0, 100);
        errorMessage = `DistributorV2.undistributedRewards() failed: ${undistributedErrorMsg}`;
      } else if (depositPoolError) {
        const depositPoolErrorMsg = String(depositPoolError).slice(0, 100);
        errorMessage = `DistributorV2.depositPools() failed: ${depositPoolErrorMsg}`;
      } else if (!contractAddress) {
        errorMessage = "DistributorV2 contract address not provided";
      } else if (!chainId) {
        errorMessage = "Chain ID not provided for contract calls";
      } else if (!networkEnv) {
        errorMessage = "Network environment not specified for RewardPoolV2 lookup";
      } else {
        errorMessage = "Contract data unavailable - no fallback estimates provided";
      }
      
      return {
        estimatedRewards: "Debug Mode",
        isLoading: false,
        isValid: false,
        error: errorMessage,
        refetch: refetchPoolRateData
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
        error: "Invalid deposit amount",
        refetch: refetchPoolRateData
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
        error: "Power factor not ready",
        refetch: refetchPoolRateData
      };
    }

    // Get lock duration in years for projection
    const lockDurationYears = getLockDurationInYears(lockValue, lockUnit);
    
    // Calculate estimated rewards - Add null check for poolRateData
    if (!poolRateData) {
      return {
        estimatedRewards: "---",
        isLoading: false,
        isValid: false,
        error: "No pool data available",
        refetch: refetchPoolRateData
      };
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('🧮 [Reward Calculation] Input Parameters:', {
        depositAmount,
        depositAmountNum: parseFloat(depositAmount),
        poolRate: poolRateData!.rate.toString(),
        poolRateDecimal: (Number(poolRateData!.rate) / 1e18).toFixed(6),
        powerFactorString,
        lockDurationYears,
        tokenDecimals,
        // Calculate expected base reward manually for verification
        expectedBaseReward: (parseFloat(depositAmount) * (Number(poolRateData!.rate) / 1e18) * lockDurationYears).toFixed(6) + ' MOR'
      });
    }

    const result = calculateEstimatedRewards(
      depositAmount,
      poolRateData!.rate, // Current pool rate - non-null assertion since we checked above
      powerFactorString,
      lockDurationYears,
      tokenDecimals // Pass correct token decimals
    );

    const finalResult = {
      estimatedRewards: result.formattedRewards + " MOR",
      isLoading: false,
      isValid: result.isValid,
      error: result.error,
      debug: process.env.NODE_ENV !== 'production' ? {
        depositAmount,
        currentPoolRate: poolRateData!.rate.toString(), // non-null assertion since we checked above
        userRate: existingUserData?.rate.toString() || "0",
        powerFactor: powerFactorString,
        lockDurationYears,
        baseRewards: result.baseRewards.toString(),
        finalRewards: result.finalRewards.toString(),
      } : undefined,
      refetch: refetchPoolRateData
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
    tokenDecimals,
    existingUserData,
    refetchPoolRateData
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
  poolId: bigint = BigInt(0) // eslint-disable-line @typescript-eslint/no-unused-vars
) {
  // Second contract call also disabled for v7 compatibility
  const {
    data: poolRateDataRaw,
    isLoading,
    error,
    refetch: refetchPoolData,
  } = useReadContract({
    address: contractAddress,
    abi: DistributorV2Abi,
    functionName: 'undistributedRewards',
    args: [],
    chainId,
    query: {
      enabled: false, // Disabled for v7 compatibility
      retry: 3,
      retryDelay: 1000,
      refetchInterval: REFETCH_INTERVALS.SLOW,
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
    refetch: refetchPoolData,
  };
}
