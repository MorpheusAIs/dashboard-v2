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
 * Format asset amounts with conditional decimals based on asset type and remove trailing zeros
 * USDC, USDT: always 2 decimals (but trailing zeros removed)
 * wETH, wBTC, stETH: 3 decimals if < 1, 2 decimals if >= 1 (trailing zeros removed)
 */
export const formatAssetAmount = (amount: number, assetSymbol?: AssetSymbol): string => {
  let formatted: string;

  if (assetSymbol === 'USDC' || assetSymbol === 'USDT') {
    formatted = amount.toFixed(2);
  } else if (assetSymbol === 'wETH' || assetSymbol === 'wBTC' || assetSymbol === 'stETH') {
    formatted = amount < 1 ? amount.toFixed(3) : amount.toFixed(2);
  } else {
    // Default behavior for other assets: 2 decimals for small numbers
    if (amount < 1 && amount > 0) {
      formatted = amount.toFixed(2);
    } else {
      formatted = formatNumber(amount);
    }
  }

  // Remove trailing zeros and decimal point if no decimals remain
  return formatted.replace(/\.?0+$/, '');
};

/**
 * Format staked amounts with conditional decimals based on asset type
 * USDC, USDT: always 2 decimals
 * wETH, wBTC, stETH: 4 decimals if < 0.01, 2 decimals if >= 0.01
 */
export const formatStakedAmount = (amount: number, assetSymbol?: AssetSymbol): string => {
  if (assetSymbol === 'USDC' || assetSymbol === 'USDT') {
    return amount.toFixed(2);
  }

  if (assetSymbol === 'wETH' || assetSymbol === 'wBTC' || assetSymbol === 'stETH') {
    return amount < 0.01 ? amount.toFixed(4) : amount.toFixed(2);
  }

  // Default to 1 decimal for other assets
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

    // Validate that the date was parsed correctly
    if (isNaN(unlockDateTime.getTime())) {
      console.error('❌ Invalid unlock date parsed:', unlockDate, '- Date object:', unlockDateTime);
      return false;
    }

    // Compare dates including time
    const unlockReached = currentDate >= unlockDateTime;

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
    // Handle very small amounts (like 0.0001 wBTC) by checking if formatted value is not just "0" or "0.00"
    return deposited > 0 || asset.userDepositedFormatted !== "0" && asset.userDepositedFormatted !== "0.00";
  });
};

// Deprecated getAssetUnlockDate function removed - components now use dynamic asset data from context
