import { formatUnits, parseUnits } from "viem";

// Reward calculation constants based on documentation
export const REWARD_CONSTANTS = {
  DECIMAL_SCALE: 25, // Contract uses 10^25 for calculations
  MOR_DECIMALS: 18, // MOR token has 18 decimals
} as const;

/**
 * Interface for pool rate data from poolsData contract function
 */
export interface PoolRateData {
  lastUpdate: bigint; // uint128
  rate: bigint; // uint256 - This is the current pool rate we need
  totalVirtualDeposited: bigint; // uint256
}

/**
 * Interface for user rate data from usersData contract function
 */
export interface UserRateData {
  lastStake: bigint;
  deposited: bigint; // Current deposited amount
  rate: bigint; // User's rate when they deposited - key for calculation
  pendingRewards: bigint;
  claimLockStart: bigint;
  claimLockEnd: bigint;
  virtualDeposited: bigint;
  lastClaim: bigint;
  referrer: `0x${string}`;
}

/**
 * Calculate base rewards using the rate-based formula from documentation
 * @param depositAmount - New deposit amount (in token decimals, e.g., "1.5" for 1.5 stETH)
 * @param currentPoolRate - Current pool rate from poolsData
 * @param userRate - User's rate when they deposited (0 for new deposits)
 * @returns Base rewards as BigInt (before power factor)
 */
export function calculateBaseRewards(
  depositAmount: string,
  currentPoolRate: bigint,
  userRate: bigint = BigInt(0) // 0 for new deposits
): bigint {
  try {
    if (process.env.NODE_ENV !== 'production') {
      console.group('💰 [Rewards Debug] Base Rewards Calculation');
      console.log('Deposit Amount (string):', depositAmount);
      console.log('Current Pool Rate:', currentPoolRate.toString());
      console.log('User Rate:', userRate.toString());
    }

    // Parse deposit amount to wei (18 decimals)
    const depositAmountWei = parseUnits(depositAmount, 18);
    
    // Calculate rate difference (currentPoolRate - userRate)
    const rateDiff = currentPoolRate - userRate;
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('Deposit Amount (wei):', depositAmountWei.toString());
      console.log('Rate Difference:', rateDiff.toString());
    }

    // Apply the documented formula: depositedAmount * (currentPoolRate - userRate) / 10^25
    const baseRewards = (depositAmountWei * rateDiff) / (BigInt(10) ** BigInt(REWARD_CONSTANTS.DECIMAL_SCALE));
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('Decimal Scale (10^25):', (BigInt(10) ** BigInt(REWARD_CONSTANTS.DECIMAL_SCALE)).toString());
      console.log('Base Rewards (wei):', baseRewards.toString());
      console.log('Base Rewards (formatted):', formatUnits(baseRewards, 18));
      console.groupEnd();
    }

    return baseRewards;
  } catch (error) {
    console.error("Error calculating base rewards:", error);
    return BigInt(0);
  }
}

/**
 * Apply power factor to base rewards
 * @param baseRewards - Base rewards as BigInt
 * @param powerFactorString - Power factor string (e.g., "x2.5")
 * @returns Final rewards with power factor applied
 */
export function applyPowerFactor(baseRewards: bigint, powerFactorString: string): bigint {
  try {
    if (process.env.NODE_ENV !== 'production') {
      console.group('⚡ [Rewards Debug] Power Factor Application');
      console.log('Base Rewards (wei):', baseRewards.toString());
      console.log('Power Factor String:', powerFactorString);
    }

    // Parse power factor (remove 'x' and convert to number)
    const powerFactorStr = powerFactorString.replace('x', '');
    const powerFactor = parseFloat(powerFactorStr);
    
    if (isNaN(powerFactor) || powerFactor <= 0) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Invalid power factor, using 1.0');
        console.groupEnd();
      }
      return baseRewards; // No multiplier if invalid
    }

    // Apply power factor (multiply by decimal factor for precision)
    const powerFactorScaled = Math.floor(powerFactor * 1000); // Scale to 3 decimal places
    const finalRewards = (baseRewards * BigInt(powerFactorScaled)) / BigInt(1000);
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('Power Factor (number):', powerFactor);
      console.log('Power Factor (scaled):', powerFactorScaled);
      console.log('Final Rewards (wei):', finalRewards.toString());
      console.log('Final Rewards (formatted):', formatUnits(finalRewards, 18));
      console.groupEnd();
    }

    return finalRewards;
  } catch (error) {
    console.error("Error applying power factor:", error);
    return baseRewards; // Return base rewards if power factor fails
  }
}

/**
 * Calculate estimated rewards for a new deposit with lock period
 * @param depositAmount - Deposit amount as string (e.g., "1.5")
 * @param currentPoolRate - Current pool rate from poolsData
 * @param powerFactorString - Power factor string (e.g., "x2.5")
 * @param lockDurationYears - Lock duration in years for projection
 * @returns Estimated rewards calculation result
 */
export function calculateEstimatedRewards(
  depositAmount: string,
  currentPoolRate: bigint,
  powerFactorString: string,
  lockDurationYears: number = 1
): {
  baseRewards: bigint;
  finalRewards: bigint;
  formattedRewards: string;
  isValid: boolean;
  error?: string;
} {
  try {
    if (process.env.NODE_ENV !== 'production') {
      console.group('🎯 [Rewards Debug] Full Estimated Rewards Calculation');
      console.log('Input Parameters:', {
        depositAmount,
        currentPoolRate: currentPoolRate.toString(),
        powerFactorString,
        lockDurationYears
      });
    }

    // Validate inputs
    const depositNum = parseFloat(depositAmount);
    if (isNaN(depositNum) || depositNum <= 0) {
      return {
        baseRewards: BigInt(0),
        finalRewards: BigInt(0),
        formattedRewards: "0.00",
        isValid: false,
        error: "Invalid deposit amount"
      };
    }

    if (currentPoolRate <= BigInt(0)) {
      return {
        baseRewards: BigInt(0),
        finalRewards: BigInt(0),
        formattedRewards: "0.00",
        isValid: false,
        error: "Invalid pool rate"
      };
    }

    // Step 1: Calculate base rewards (for new deposits, userRate = 0)
    const baseRewards = calculateBaseRewards(depositAmount, currentPoolRate, BigInt(0));
    
    // Step 2: Apply power factor
    const finalRewards = applyPowerFactor(baseRewards, powerFactorString);

    // Step 3: Project over lock duration (simple projection)
    // Note: This is a simplified projection - actual rewards depend on future pool rate changes
    const projectedRewards = lockDurationYears > 0 
      ? (finalRewards * BigInt(Math.floor(lockDurationYears * 100))) / BigInt(100)
      : finalRewards;

    // Format for display
    const formattedRewards = formatRewardsForDisplay(projectedRewards);

    if (process.env.NODE_ENV !== 'production') {
      console.log('Calculation Results:', {
        baseRewards: baseRewards.toString(),
        finalRewards: finalRewards.toString(),
        projectedRewards: projectedRewards.toString(),
        formattedRewards
      });
      console.groupEnd();
    }

    return {
      baseRewards,
      finalRewards: projectedRewards,
      formattedRewards,
      isValid: true
    };
  } catch (error) {
    console.error("Error calculating estimated rewards:", error);
    return {
      baseRewards: BigInt(0),
      finalRewards: BigInt(0),
      formattedRewards: "0.00",
      isValid: false,
      error: error instanceof Error ? error.message : "Calculation failed"
    };
  }
}

/**
 * Format rewards for display with appropriate units
 * @param rewardsWei - Rewards amount in wei
 * @returns Formatted string with MOR unit
 */
export function formatRewardsForDisplay(rewardsWei: bigint): string {
  try {
    const rewardsFormatted = formatUnits(rewardsWei, REWARD_CONSTANTS.MOR_DECIMALS);
    const rewardsNum = parseFloat(rewardsFormatted);
    
    if (isNaN(rewardsNum) || rewardsNum <= 0) {
      return "0.00";
    }

    if (rewardsNum < 0.01) {
      return "< 0.01";
    } else if (rewardsNum >= 1000000) {
      return `${(rewardsNum / 1000000).toFixed(2)}M`;
    } else if (rewardsNum >= 1000) {
      return `${(rewardsNum / 1000).toFixed(2)}K`;
    } else {
      return rewardsNum.toFixed(2);
    }
  } catch (error) {
    console.error("Error formatting rewards:", error);
    return "0.00";
  }
}

/**
 * Get lock duration in years for rewards projection
 * @param value - Duration value as string
 * @param unit - Time unit
 * @returns Duration in years as number
 */
export function getLockDurationInYears(value: string, unit: "minutes" | "days" | "months" | "years"): number {
  const numValue = parseInt(value, 10);
  if (isNaN(numValue) || numValue <= 0) return 0;

  switch (unit) {
    case "minutes":
      return numValue / (365.25 * 24 * 60); // Convert minutes to years
    case "days":
      return numValue / 365.25; // Account for leap years
    case "months":
      return numValue / 12;
    case "years":
      return numValue;
    default:
      return 0;
  }
}

/**
 * Estimate future pool rate growth (simplified projection)
 * This is a basic implementation - actual growth depends on many factors
 * @param currentRate - Current pool rate
 * @param projectionYears - Years to project forward
 * @param annualGrowthRate - Estimated annual growth rate (default 10%)
 * @returns Estimated future pool rate
 */
export function estimateFuturePoolRate(
  currentRate: bigint,
  projectionYears: number,
  annualGrowthRate: number = 0.1
): bigint {
  if (projectionYears <= 0) return currentRate;
  
  // Simple compound growth: rate * (1 + growth)^years
  const growthMultiplier = Math.pow(1 + annualGrowthRate, projectionYears);
  const scaledMultiplier = BigInt(Math.floor(growthMultiplier * 1000));
  
  return (currentRate * scaledMultiplier) / BigInt(1000);
}
