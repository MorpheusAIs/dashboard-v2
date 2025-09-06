import { formatNumber } from "@/lib/utils";
import type { AssetSymbol } from "@/context/CapitalPageContext";

interface MinimalAssetData {
  userDepositedFormatted: string;
}

/**
 * Safely parse deposit amount from formatted string
 */
export const parseDepositAmount = (depositValue: string | undefined): number => {
  try {
    if (!depositValue || typeof depositValue !== 'string') {
      return 0;
    }
    const cleanedValue = depositValue.replace(/,/g, '');
    const parsed = parseFloat(cleanedValue);
    return isNaN(parsed) ? 0 : parsed;
  } catch (error) {
    console.error('Error parsing deposit amount:', error);
    return 0;
  }
};

/**
 * Format asset amounts with 2 decimals for small numbers
 */
export const formatAssetAmount = (amount: number): string => {
  if (amount < 1 && amount > 0) {
    return amount.toFixed(2);
  }
  return formatNumber(amount);
};

/**
 * Format staked amounts with 1 decimal place
 */
export const formatStakedAmount = (amount: number): string => {
  return amount.toFixed(1);
};

/**
 * Check if unlock date has passed (for withdraw functionality)
 */
export const isUnlockDateReached = (unlockDate: string | null, hasStakedAssets: boolean): boolean => {
  console.log('🔍 isUnlockDateReached called with:', unlockDate);

  if (!unlockDate || unlockDate === "--- --, ----" || unlockDate === "Never" || unlockDate === "Invalid Date") {
    console.log('❌ Unlock date check failed - invalid/null date:', unlockDate);
    // Fallback: If we have no unlock date but user has staked assets, allow withdrawal
    // This handles cases where timestamp data is missing but user should still be able to withdraw
    console.log('🔄 Fallback check for staked assets:', hasStakedAssets);
    if (hasStakedAssets) {
      console.log('✅ Allowing withdrawal due to fallback - user has staked assets');
      return true;
    }
    return false; // No unlock date set, invalid, or never unlocks
  }

  try {
    // Parse the unlock date string (format: "Aug 16, 2025, 5:30 PM" from toLocaleString)
    const unlockDateTime = new Date(unlockDate);
    const currentDate = new Date();

    console.log('📅 Date parsing details:', {
      unlockDateString: unlockDate,
      unlockDateTime: unlockDateTime,
      unlockDateTimeParsed: unlockDateTime.toISOString(),
      currentDate: currentDate.toISOString(),
      unlockDateTimeValid: !isNaN(unlockDateTime.getTime())
    });

    // Validate that the date was parsed correctly
    if (isNaN(unlockDateTime.getTime())) {
      console.error('❌ Invalid unlock date parsed:', unlockDate, '- Date object:', unlockDateTime);
      return false;
    }

    // Compare dates including time
    const unlockReached = currentDate >= unlockDateTime;

    console.log('✅ Unlock date comparison result:', {
      unlockDate: unlockDate,
      unlockDateTime: unlockDateTime.toISOString(),
      currentDate: currentDate.toISOString(),
      timeDifferenceMs: currentDate.getTime() - unlockDateTime.getTime(),
      timeDifferenceHours: (currentDate.getTime() - unlockDateTime.getTime()) / (1000 * 60 * 60),
      unlockReached,
      shouldAllowWithdraw: unlockReached
    });

    return unlockReached;
  } catch (error) {
    console.error('❌ Error parsing unlock date:', unlockDate, error);
    return false; // If parsing fails, assume not unlocked
  }
};

/**
 * Check if user has any staked assets
 */
export const hasStakedAssets = (assets: Record<AssetSymbol, MinimalAssetData>): boolean => {
  const stethDeposited = parseDepositAmount(assets.stETH?.userDepositedFormatted);
  const linkDeposited = parseDepositAmount(assets.LINK?.userDepositedFormatted);
  return stethDeposited > 0 || linkDeposited > 0;
};

/**
 * Get unlock date for specific asset
 */
export const getAssetUnlockDate = (
  assetSymbol: 'stETH' | 'LINK',
  stETHV2ClaimUnlockTimestampFormatted: string,
  linkV2ClaimUnlockTimestampFormatted: string
): string | null => {
  let unlockDate: string | null = null;

  // Get raw data for debugging
  const rawFormatted = assetSymbol === 'stETH'
    ? stETHV2ClaimUnlockTimestampFormatted
    : linkV2ClaimUnlockTimestampFormatted;

  // Use V2-specific unlock timestamps
  if (assetSymbol === 'stETH') {
    unlockDate = stETHV2ClaimUnlockTimestampFormatted && stETHV2ClaimUnlockTimestampFormatted !== "--- --, ----"
      ? stETHV2ClaimUnlockTimestampFormatted
      : null;
  }

  if (assetSymbol === 'LINK') {
    unlockDate = linkV2ClaimUnlockTimestampFormatted && linkV2ClaimUnlockTimestampFormatted !== "--- --, ----"
      ? linkV2ClaimUnlockTimestampFormatted
      : null;
  }

  // Log unlock date for debugging
  console.log(`🔓 getAssetUnlockDate for ${assetSymbol}:`, {
    rawFormatted,
    processedDate: unlockDate,
    isValid: unlockDate !== null,
    conditionCheck: rawFormatted && rawFormatted !== "--- --, ----",
    assetSymbol
  });

  return unlockDate;
};
