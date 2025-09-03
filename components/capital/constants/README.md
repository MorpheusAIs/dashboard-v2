# Capital Constants Directory

## Overview

This directory contains centralized configuration constants for the Capital project, providing a single source of truth for asset configurations and other constants.

## Files

### `asset-config.ts` 🔧
**Main asset configuration file** - Contains all token/asset configurations including:

#### Features
- **Centralized Asset Management**: All asset metadata in one place
- **Network-Aware**: Separate configs for testnet vs mainnet
- **Type-Safe**: Full TypeScript interfaces and type checking
- **Easy Maintenance**: Single file to update when adding new assets
- **Consistent Icons**: Standardized icon references for @web3icons/react

#### Asset Data Structure
```typescript
interface AssetMetadata {
  symbol: AssetSymbol;           // 'stETH', 'LINK', etc.
  name: string;                  // Human-readable name
  icon: string;                  // Icon ID for @web3icons/react
  decimals: number;              // Token decimals (18, 6, 8, etc.)
  coinGeckoId: string;          // For price API calls
  disabled?: boolean;            // If not yet supported
}
```

#### Networks Supported

**Testnet (Sepolia):**
- ✅ stETH: `0xa878ad6ff38d6fae81fbb048384ce91979d448da`
- ✅ LINK: `0xf8Fb3713D459D7C1018BD0A49D19b4C44290EBE5`

**Mainnet (Ethereum):**
- ✅ stETH: `0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84`
- ✅ LINK: `0x514910771af9ca656af840dff83e8264ecf986ca`
- ✅ USDC: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
- ✅ USDT: `0xdAC17F958D2ee523a2206206994597C13D831ec7`
- ✅ wBTC: `0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599`
- ✅ wETH: `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`

#### Helper Functions
- `getAssetsForNetwork()` - Get all assets for a network
- `getAssetConfig()` - Get specific asset config
- `getSupportedAssetSymbols()` - Get supported symbols
- `isAssetSupported()` - Check if asset is supported
- `getEnabledAssets()` - Get only enabled (non-disabled) assets

#### Usage Examples
```typescript
import { getAssetConfig, getEnabledAssets } from './asset-config';

// Get specific asset
const stethConfig = getAssetConfig('stETH', 'mainnet');

// Get all enabled assets for network
const enabledAssets = getEnabledAssets('testnet');

// Get price token ID
const coinGeckoId = stethConfig?.metadata.coinGeckoId;
```

### `deposit-modal-constants.ts` ↻
**Legacy compatibility layer** - Re-exports from asset-config.ts to maintain backward compatibility with existing components.

## Migration Benefits

### Before ❌
- Asset lists scattered across multiple files
- Hardcoded contract addresses repeated everywhere  
- Manual maintenance of icons, names, decimals
- Inconsistent token configurations
- CoinGecko IDs hardcoded in price calls

### After ✅
- **Single source of truth** for all asset data
- **Network-aware** configuration (testnet vs mainnet)
- **Type-safe** asset management
- **Easy to maintain** - add new assets in one place
- **Consistent** icons and metadata across components
- **Backward compatible** with existing imports

## Updated Components

- ✅ `capital-info-panel.tsx` - Now uses `getAssetsForNetwork()`
- ✅ `user-assets-panel.tsx` - Updated asset creation and price fetching
- ✅ `deposit-modal-constants.ts` - Re-exports for compatibility

## Adding New Assets

To add a new asset (e.g., DAI):

1. Add to `AssetSymbol` type
2. Add metadata to `assetMetadata` object  
3. Add contract addresses to `assetConfig` for each network
4. Components automatically pick up the new asset!

```typescript
// 1. Add to type
export type AssetSymbol = 'stETH' | 'LINK' | 'USDC' | 'USDT' | 'wBTC' | 'wETH' | 'DAI';

// 2. Add metadata
export const assetMetadata: Record<AssetSymbol, AssetMetadata> = {
  // ... existing assets
  DAI: {
    symbol: 'DAI',
    name: 'Dai Stablecoin', 
    icon: 'dai',
    decimals: 18,
    coinGeckoId: 'dai',
  }
};

// 3. Add addresses
export const assetConfig: AssetConfig = {
  mainnet: {
    // ... existing assets
    DAI: {
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      metadata: assetMetadata.DAI,
    },
  }
};
```

That's it! The components will automatically render the new asset.
