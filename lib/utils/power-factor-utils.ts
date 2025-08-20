import { formatUnits } from "viem";

// Time unit types
export type TimeUnit = "days" | "months" | "years";

// Power factor constants based on ACTUAL contract behavior
export const POWER_FACTOR_CONSTANTS = {
  MULTIPLIER_SCALE: 21, // Contract returns values scaled by 10^21
  REWARDS_DIVIDER: 10000, // Final division factor
  MAX_POWER_FACTOR: 9.7, // ✅ ACTUAL contract maximum (verified through testing)
  MIN_ACTIVATION_PERIOD_MONTHS: 6, // Minimum period before power factor activates
  MAX_LOCK_PERIOD_YEARS: 6, // Maximum lock period allowed
  SECONDS_PER_DAY: 86400,
  // Note: We now use real calendar calculations instead of these approximations
  SECONDS_PER_YEAR: Math.floor(86400 * 365.25), // 31,557,600 seconds (kept for reference)
  SECONDS_PER_MONTH: Math.floor((86400 * 365.25) / 12), // 2,629,800 seconds (kept for reference)
} as const;

// Debug constants and real calendar calculations on load
if (process.env.NODE_ENV !== 'production') {
  console.log('🔢 [Power Factor Debug] Constants loaded:', POWER_FACTOR_CONSTANTS);
  
  // Test REAL calendar conversion consistency
  console.group('🧪 [Power Factor Debug] REAL Calendar Time Consistency Test');
  
  const now = new Date();
  
  // Calculate 1 year from now
  const oneYearFromNow = new Date(now);
  oneYearFromNow.setFullYear(now.getFullYear() + 1);
  const oneYearSeconds = Math.floor((oneYearFromNow.getTime() - now.getTime()) / 1000);
  
  // Calculate 12 months from now
  const twelveMonthsFromNow = new Date(now);
  twelveMonthsFromNow.setMonth(now.getMonth() + 12);
  const twelveMonthsSeconds = Math.floor((twelveMonthsFromNow.getTime() - now.getTime()) / 1000);
  
  // Calculate 6 years from now (for max power factor test)
  const sixYearsFromNow = new Date(now);
  sixYearsFromNow.setFullYear(now.getFullYear() + 6);
  const sixYearsSeconds = Math.floor((sixYearsFromNow.getTime() - now.getTime()) / 1000);
  const sixYearsDays = sixYearsSeconds / 86400;
  
  console.log('📅 Real Calendar Results:');
  console.log('  1 year from now (seconds):', oneYearSeconds);
  console.log('  12 months from now (seconds):', twelveMonthsSeconds);
  console.log('  Difference (should be 0):', oneYearSeconds - twelveMonthsSeconds);
  console.log('  6 years from now (seconds):', sixYearsSeconds);
  console.log('  6 years from now (days):', sixYearsDays.toFixed(2));
  console.log('  vs approximation (365.25 * 6):', (365.25 * 6).toFixed(2));
  console.log('  Difference (days):', (sixYearsDays - (365.25 * 6)).toFixed(2));
  
  console.log('🎯 Contract maximum is x9.7 for 6 years (actual implementation, not theoretical)!');
  console.groupEnd();
}

/**
 * Convert duration value and unit to seconds using CONTRACT-EXPECTED calculations
 * @param value - Duration value as string
 * @param unit - Time unit (days, months, years)
 * @param fromDate - Start date (defaults to now) - used for display only
 * @returns Duration in seconds as BigInt, or BigInt(0) if invalid
 */
export function durationToSeconds(value: string, unit: TimeUnit, fromDate?: Date): bigint {
  const numValue = parseInt(value, 10);
  if (isNaN(numValue) || numValue <= 0) return BigInt(0);
  
  if (process.env.NODE_ENV !== 'production') {
    console.group('📅 [Contract Duration] Contract-Expected Calculation');
    console.log('Input:', { value, unit, numValue });
  }
  
  let diffSeconds: number;
  
  // Use contract-expected calculations to match exactly what the contract expects
  switch (unit) {
    case "days":
      diffSeconds = numValue * 86400; // 24 * 60 * 60
      break;
    case "months":
      diffSeconds = numValue * 30 * 86400; // 30 days per month (contract expectation)
      break;
    case "years":
      // Special case: For 6 years, use the EXACT value the contract expects for maximum power factor
      if (numValue === 6) {
        diffSeconds = 189216000; // Exact value from documentation: 6 * 365 * 24 * 60 * 60
        if (process.env.NODE_ENV !== 'production') {
          console.log('🎯 [6-YEAR SPECIAL] Using exact contract-expected seconds for maximum power factor');
          console.log('  Using hardcoded 189,216,000 seconds (from documentation)');
          console.log('  This is exactly 2190 days (6 * 365) → x9.7 maximum');
        }
      } else {
        // For other year values, use standard 365 days per year
        diffSeconds = numValue * 365 * 86400; 
        if (process.env.NODE_ENV !== 'production' && numValue >= 5) {
          console.log(`🔍 [${numValue}-YEAR DEBUG] Using standard calculation:`);
          console.log(`  ${numValue} years = ${diffSeconds} seconds = ${diffSeconds / 86400} days`);
        }
      }
      break;
    default:
      return BigInt(0);
  }
  
  if (process.env.NODE_ENV !== 'production') {
    console.log('Duration (seconds):', diffSeconds);
    console.log('Duration (days):', diffSeconds / 86400);
    
    // Special debug for maximum lock
    if (unit === 'years' && numValue === 6) {
      console.log('🎯 [MAX LOCK DEBUG]');
      console.log('  Contract expects exactly 189,216,000 seconds for maximum power factor');
      console.log('  This equals exactly:', diffSeconds / 86400, 'days');
      console.log('  Should now achieve x9.7 maximum (actual contract implementation)!');
    }
    
    console.groupEnd();
  }
  
  return BigInt(diffSeconds);
}

/**
 * Format raw contract multiplier to human-readable power factor
 * @param rawMultiplier - Raw BigInt from contract
 * @returns Formatted power factor string (e.g., "x1.5", "x10.7")
 */
export function formatPowerFactor(rawMultiplier: bigint): string {
  try {
    if (process.env.NODE_ENV !== 'production') {
      console.group('🔢 [Power Factor Debug] Formatting');
      console.log('Raw Multiplier (BigInt):', rawMultiplier.toString());
    }
    
    // Convert raw contract value to display value according to documentation
    const scaleFactor = BigInt(10) ** BigInt(POWER_FACTOR_CONSTANTS.MULTIPLIER_SCALE);
    const scaledNumber = Number(rawMultiplier) / Number(scaleFactor);
    const powerFactor = scaledNumber / POWER_FACTOR_CONSTANTS.REWARDS_DIVIDER;
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('Scale Factor (10^21):', scaleFactor.toString());
      console.log('Scaled Number:', scaledNumber);
      console.log('Power Factor (before cap):', powerFactor);
      console.log('Max Power Factor:', POWER_FACTOR_CONSTANTS.MAX_POWER_FACTOR);
    }
    
    // Cap at theoretical maximum
    const cappedPowerFactor = Math.min(powerFactor, POWER_FACTOR_CONSTANTS.MAX_POWER_FACTOR);
    const formatted = `x${cappedPowerFactor.toFixed(1)}`;
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('Capped Power Factor:', cappedPowerFactor);
      console.log('Final Formatted:', formatted);
      console.groupEnd();
    }
    
    // Format to 1 decimal place as requested (x_._ format)
    return formatted;
  } catch (error) {
    console.error("Error formatting power factor:", error);
    return "x1.0";
  }
}

/**
 * Alternative formatting using viem's formatUnits for more precision
 * @param rawMultiplier - Raw BigInt from contract
 * @returns Formatted power factor string
 */
export function formatPowerFactorPrecise(rawMultiplier: bigint): string {
  try {
    // Use viem's formatUnits for better precision handling
    const scaledValue = formatUnits(rawMultiplier, POWER_FACTOR_CONSTANTS.MULTIPLIER_SCALE);
    const powerFactor = parseFloat(scaledValue) / POWER_FACTOR_CONSTANTS.REWARDS_DIVIDER;
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔢 [Power Factor] Raw:', rawMultiplier.toString());
      console.log('🔢 [Power Factor] Calculated:', powerFactor.toFixed(4) + 'x');
    }
    
    // Cap at actual contract maximum (9.7x)
    const cappedPowerFactor = Math.min(powerFactor, POWER_FACTOR_CONSTANTS.MAX_POWER_FACTOR);
    
    // Format to 1 decimal place
    const formatted = `x${cappedPowerFactor.toFixed(1)}`;
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔢 [Power Factor] Final:', formatted);
    }
    
    return formatted;
  } catch (error) {
    console.error("Error formatting power factor (precise):", error);
    return "x1.0";
  }
}

/**
 * Validate lock duration parameters
 * @param value - Duration value as string
 * @param unit - Time unit
 * @returns Validation result with error message if invalid
 */
export function validateLockDuration(value: string, unit: TimeUnit): {
  isValid: boolean;
  errorMessage?: string;
  warningMessage?: string;
} {
  const numValue = parseInt(value, 10);
  
  // Basic validation
  if (isNaN(numValue) || numValue <= 0) {
    return {
      isValid: false,
      errorMessage: "Please enter a valid positive number"
    };
  }
  
  // Maximum period validation
  if (unit === "years" && numValue > POWER_FACTOR_CONSTANTS.MAX_LOCK_PERIOD_YEARS) {
    return {
      isValid: false,
      errorMessage: `Maximum lock period is ${POWER_FACTOR_CONSTANTS.MAX_LOCK_PERIOD_YEARS} years`
    };
  }
  
  // Convert to total months for easier comparison
  let totalMonths: number;
  switch (unit) {
    case "days":
      totalMonths = numValue / 30; // Approximate
      break;
    case "months":
      totalMonths = numValue;
      break;
    case "years":
      totalMonths = numValue * 12;
      break;
  }
  
  // Maximum period validation (convert max years to months)
  const maxMonths = POWER_FACTOR_CONSTANTS.MAX_LOCK_PERIOD_YEARS * 12;
  if (totalMonths > maxMonths) {
    return {
      isValid: false,
      errorMessage: `Maximum lock period is ${POWER_FACTOR_CONSTANTS.MAX_LOCK_PERIOD_YEARS} years`
    };
  }
  
  // Minimum period warning (power factor doesn't activate until 6 months)
  if (totalMonths < POWER_FACTOR_CONSTANTS.MIN_ACTIVATION_PERIOD_MONTHS) {
    return {
      isValid: true,
      warningMessage: `Power factor starts after ${POWER_FACTOR_CONSTANTS.MIN_ACTIVATION_PERIOD_MONTHS} months. This period will have 1.0x multiplier.`
    };
  }
  
  return { isValid: true };
}

/**
 * Check if a lock duration will activate power factor benefits
 * @param value - Duration value as string
 * @param unit - Time unit
 * @returns True if the period is long enough to activate power factor
 */
export function willActivatePowerFactor(value: string, unit: TimeUnit): boolean {
  const numValue = parseInt(value, 10);
  if (isNaN(numValue) || numValue <= 0) return false;
  
  // Convert to total months for comparison
  let totalMonths: number;
  switch (unit) {
    case "days":
      totalMonths = numValue / 30; // Approximate
      break;
    case "months":
      totalMonths = numValue;
      break;
    case "years":
      totalMonths = numValue * 12;
      break;
  }
  
  return totalMonths >= POWER_FACTOR_CONSTANTS.MIN_ACTIVATION_PERIOD_MONTHS;
}

/**
 * Get recommended lock periods with their expected power factor ranges
 * @returns Array of recommended periods with descriptions
 */
export function getRecommendedLockPeriods(): Array<{
  value: string;
  unit: TimeUnit;
  description: string;
  powerFactorRange: string;
}> {
  return [
    {
      value: "6",
      unit: "months",
      description: "Minimum for power factor activation",
      powerFactorRange: "~x1.0-1.2"
    },
    {
      value: "1",
      unit: "years",
      description: "Balanced commitment with good benefits",
      powerFactorRange: "~x1.5-2.5"
    },
    {
      value: "2",
      unit: "years",
      description: "High commitment with strong benefits",
      powerFactorRange: "~x3.0-5.0"
    },
    {
      value: "6",
      unit: "years",
      description: "Maximum benefits (contract maximum x9.7)",
      powerFactorRange: "x9.7"
    }
  ];
}

/**
 * Calculate estimated unlock date using REAL calendar calculations for accurate display
 * @param value - Duration value as string
 * @param unit - Time unit
 * @param startDate - Optional start date (defaults to now)
 * @returns Calculated unlock date or null if invalid
 * 
 * Note: This uses real calendar math for user display, while durationToSeconds() 
 * uses contract-expected values for power factor calculations
 */
export function calculateUnlockDate(
  value: string, 
  unit: TimeUnit, 
  startDate: Date = new Date()
): Date | null {
  const numValue = parseInt(value, 10);
  if (isNaN(numValue) || numValue <= 0) return null;
  
  const unlockDate = new Date(startDate);
  
  if (process.env.NODE_ENV !== 'production') {
    console.log('📅 [Unlock Date] Calculating with REAL calendar for display:', { value, unit, startDate: startDate.toISOString() });
  }
  
  // Use REAL calendar math for accurate user display
  // (Different from durationToSeconds which uses contract-expected values)
  switch (unit) {
    case "days":
      unlockDate.setDate(startDate.getDate() + numValue);
      break;
    case "months":
      // Real calendar months (handles 28, 29, 30, 31 days automatically)
      unlockDate.setMonth(startDate.getMonth() + numValue);
      break;
    case "years":
      // Real calendar years (handles leap years automatically)
      unlockDate.setFullYear(startDate.getFullYear() + numValue);
      break;
    default:
      return null;
  }
  
  if (process.env.NODE_ENV !== 'production') {
    console.log('📅 [Unlock Date] Real calendar result:', unlockDate.toISOString());
    const daysDiff = (unlockDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    console.log('📅 [Unlock Date] Real calendar days:', daysDiff.toFixed(2));
    
    // Show difference between display date and contract calculation
    if (unit === 'years' && numValue === 6) {
      console.log('📅 [Unlock Date] Note: Display uses real calendar, power factor uses contract-expected 2190 days → x9.7');
    }
  }
  
  return unlockDate;
}

/**
 * Helper to format unlock date for display
 * @param unlockDate - Date object
 * @returns Formatted date string
 */
export function formatUnlockDate(unlockDate: Date): string {
  return unlockDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
}

/**
 * Validate that years input doesn't exceed maximum
 * @param value - Years value as string
 * @returns True if valid, false if exceeds maximum
 */
export function validateMaxYears(value: string): boolean {
  const numValue = parseInt(value, 10);
  if (isNaN(numValue) || numValue <= 0) return true; // Let other validation handle this
  return numValue <= POWER_FACTOR_CONSTANTS.MAX_LOCK_PERIOD_YEARS;
}

/**
 * Get the maximum allowed value for a given time unit using real calendar calculations
 * @param unit - Time unit
 * @returns Maximum allowed value as number
 */
export function getMaxAllowedValue(unit: TimeUnit): number {
  switch (unit) {
    case "years":
      return POWER_FACTOR_CONSTANTS.MAX_LOCK_PERIOD_YEARS;
    case "months":
      return POWER_FACTOR_CONSTANTS.MAX_LOCK_PERIOD_YEARS * 12;
    case "days":
      // Calculate actual days for 6 years from current date using real calendar
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setFullYear(startDate.getFullYear() + POWER_FACTOR_CONSTANTS.MAX_LOCK_PERIOD_YEARS);
      const diffMs = endDate.getTime() - startDate.getTime();
      const actualDaysFor6Years = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('📅 [Max Days Calculation] Real calendar days for 6 years from now:', actualDaysFor6Years);
        console.log('📅 [Max Days Calculation] vs approximation (365.25 * 6):', Math.floor(365.25 * 6));
      }
      
      return actualDaysFor6Years;
    default:
      return 0;
  }
}
