/**
 * Hook to dynamically detect available assets with positive balances
 * 
 * This hook provides the same functionality for live data that getAvailableAssets()
 * provides for mock data - it determines which pools have positive balances and
 * should show asset switcher buttons.
 */

import { useMemo } from 'react';
import { useCapitalPoolData } from '@/hooks/use-capital-pool-data';
import { getSupportedAssetSymbols, type AssetSymbol } from '@/components/capital/constants/asset-config';
import type { TokenType } from '@/mock-data';

// Map AssetSymbol to TokenType for compatibility
const ASSET_SYMBOL_TO_TOKEN_TYPE: Record<AssetSymbol, TokenType> = {
  'stETH': 'stETH',
  'LINK': 'LINK',
  'USDC': 'USDC',
  'USDT': 'USDT',
  'wBTC': 'wBTC',
  'wETH': 'wETH',
};

export interface AvailableAsset {
  token: TokenType;
  symbol: AssetSymbol;
  deposits: number;
  hasPositiveBalance: boolean;
}

/**
 * Custom hook to get available assets with positive balances for live data
 * Only returns assets that have actual deposits > 0 in their pools
 */
export function useAvailableAssets() {
  const poolData = useCapitalPoolData();
  
  // Get supported assets for the current network
  const supportedAssets = useMemo(() => {
    return getSupportedAssetSymbols(poolData.networkEnvironment);
  }, [poolData.networkEnvironment]);

  // Parse deposit amounts safely
  const parseDeposits = (amountStr: string): number => {
    try {
      if (!amountStr || typeof amountStr !== 'string') return 0;
      const cleanedValue = amountStr.replace(/,/g, '');
      const parsed = parseFloat(cleanedValue);
      return isNaN(parsed) ? 0 : parsed;
    } catch (error) {
      console.error('Error parsing deposits:', error);
      return 0;
    }
  };

  // Calculate available assets based on live pool data
  const availableAssets = useMemo(() => {
    const assets: AvailableAsset[] = [];

    // Check each supported asset for positive deposits
    for (const assetSymbol of supportedAssets) {
      const tokenType = ASSET_SYMBOL_TO_TOKEN_TYPE[assetSymbol];
      let deposits = 0;
      let isLoading = false;
      let hasError = false;

      // Get deposit amount based on asset type
      switch (assetSymbol) {
        case 'stETH':
          deposits = parseDeposits(poolData.stETH.totalStaked);
          isLoading = poolData.stETH.isLoading;
          hasError = !!poolData.stETH.error;
          break;
        case 'LINK':
          deposits = parseDeposits(poolData.LINK.totalStaked);
          isLoading = poolData.LINK.isLoading;
          hasError = !!poolData.LINK.error;
          break;
        // Add other assets when they become available
        default:
          deposits = 0;
          break;
      }

      // Only include assets with positive deposits (and not still loading)
      if (deposits > 0 && !isLoading && !hasError) {
        assets.push({
          token: tokenType,
          symbol: assetSymbol,
          deposits,
          hasPositiveBalance: true,
        });
      }
    }

    // Sort by deposits descending (similar to mock data)
    return assets.sort((a, b) => b.deposits - a.deposits);
  }, [supportedAssets, poolData, parseDeposits]);

  // Additional derived data
  const hasMultipleAssets = availableAssets.length > 1;
  const isLoading = poolData.stETH.isLoading || poolData.LINK.isLoading;
  const hasErrors = !!poolData.stETH.error || !!poolData.LINK.error;
  const primaryAsset = availableAssets[0]?.token || 'stETH'; // Default to stETH

  return {
    availableAssets,
    hasMultipleAssets,
    isLoading,
    hasErrors,
    primaryAsset,
    networkEnvironment: poolData.networkEnvironment,
    // For backward compatibility - return just the token types
    availableTokens: availableAssets.map(asset => asset.token),
  };
}
