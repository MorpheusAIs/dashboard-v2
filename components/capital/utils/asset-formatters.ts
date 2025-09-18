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

  if (!unlockDate ||
      unlockDate === "--- --, ----" ||
      unlockDate === "Never" ||
      unlockDate === "Invalid Date" ||
      unlockDate === "No lock set" ||
      unlockDate === "Assets unlocked" ||
      unlockDate === "N/A") {
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
 * Format unlock date for display - handles null dates gracefully
 */
export const formatUnlockDate = (unlockDate: string | null, assetSymbol: string): string => {
  if (!unlockDate) {
    // For LINK assets with no lock set, show user-friendly message
    if (assetSymbol === 'LINK') {
      return "Assets unlocked";
    }
    return "N/A";
  }

  // Return the formatted date as-is
  return unlockDate;
};

/**
 * Check if user has any staked assets - Now dynamic for all assets!
 */
export const hasStakedAssets = (assets: Record<AssetSymbol, MinimalAssetData>): boolean => {
  // Check all available assets dynamically instead of hardcoded stETH/LINK
  return Object.values(assets).some(asset => {
    const deposited = parseDepositAmount(asset.userDepositedFormatted);
    return deposited > 0;
  });
};

/**
 * Get unlock date for specific asset - Now dynamic for all assets!
 * @deprecated This function has hardcoded logic. Use dynamic asset data from context instead.
 * TODO: Remove this function once components are migrated to use assets[symbol] data directly
 */
export const getAssetUnlockDate = (
  assetSymbol: AssetSymbol, // Now accepts any asset
  stETHV2ClaimUnlockTimestampFormatted?: string, // Made optional for backward compatibility
  linkV2ClaimUnlockTimestampFormatted?: string   // Made optional for backward compatibility
): string | null => {
  // Legacy logic for backward compatibility with existing components
  // TODO: This should be replaced with dynamic timestamp data from assets structure
  
  if (assetSymbol === 'stETH' && stETHV2ClaimUnlockTimestampFormatted) {
    return stETHV2ClaimUnlockTimestampFormatted !== "--- --, ----" 
      ? stETHV2ClaimUnlockTimestampFormatted 
      : null;
  }

  if (assetSymbol === 'LINK' && linkV2ClaimUnlockTimestampFormatted) {
    // For LINK, if no lock is set (shows as "--- --, ----"), treat as unlocked
    return linkV2ClaimUnlockTimestampFormatted !== "--- --, ----" 
      ? linkV2ClaimUnlockTimestampFormatted 
      : null;
  }

  // For other assets (USDC, USDT, wBTC, wETH), return null for now
  // TODO: Implement dynamic unlock date calculation when these assets have proper contract integration
  console.log(`⚠️ getAssetUnlockDate: No unlock date logic implemented for ${assetSymbol} yet`);
  return null;
};
