/**
 * Centralized Asset Configuration
 * 
 * This file contains all asset configurations for the Capital project,
 * including contract addresses, metadata, and network-specific settings.
 * 
 * Benefits:
 * - Single source of truth for all asset data
 * - Easy to maintain and update
 * - Consistent across all components
 * - Type-safe configuration
 */

export type NetworkEnvironment = 'mainnet' | 'testnet';
export type AssetSymbol = 'stETH' | 'LINK' | 'USDC' | 'USDT' | 'wBTC' | 'wETH';

// Asset metadata interface
export interface AssetMetadata {
  symbol: AssetSymbol;
  name: string;
  icon: string; // Icon identifier for @web3icons/react
  decimals: number;
  coinGeckoId: string; // For price fetching
  disabled?: boolean; // For assets not yet supported
}

// Contract address interface
export interface AssetContractInfo {
  address: `0x${string}`;
  metadata: AssetMetadata;
}

// Network-specific asset configuration
export interface NetworkAssetConfig {
  [key: string]: AssetContractInfo;
}

// Complete asset configuration
export interface AssetConfig {
  testnet: NetworkAssetConfig;
  mainnet: NetworkAssetConfig;
}

// Asset metadata definitions
export const assetMetadata: Record<AssetSymbol, AssetMetadata> = {
  stETH: {
    symbol: 'stETH',
    name: 'Liquid Staked Ethereum',
    icon: 'eth',
    decimals: 18,
    coinGeckoId: 'staked-ether',
  },
  LINK: {
    symbol: 'LINK',
    name: 'Chainlink',
    icon: 'link',
    decimals: 18,
    coinGeckoId: 'chainlink',
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    icon: 'usdc',
    decimals: 6,
    coinGeckoId: 'usd-coin',
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    icon: 'usdt',
    decimals: 6,
    coinGeckoId: 'tether',
  },
  wBTC: {
    symbol: 'wBTC',
    name: 'Wrapped Bitcoin',
    icon: 'btc',
    decimals: 8,
    coinGeckoId: 'wrapped-bitcoin',
    disabled: true,
  },
  wETH: {
    symbol: 'wETH',
    name: 'Wrapped Ethereum',
    icon: 'eth',
    decimals: 18,
    coinGeckoId: 'weth',
  },
};

// Complete asset configuration
export const assetConfig: AssetConfig = {
  testnet: {
    // Only stETH and LINK supported on testnet (Sepolia)
    stETH: {
      address: '0xa878ad6ff38d6fae81fbb048384ce91979d448da',
      metadata: assetMetadata.stETH,
    },
    LINK: {
      address: '0xf8Fb3713D459D7C1018BD0A49D19b4C44290EBE5', 
      metadata: assetMetadata.LINK,
    },
  },
  mainnet: {
    // All assets supported on mainnet (Ethereum)
    stETH: {
      address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
      metadata: assetMetadata.stETH,
    },
    USDC: {
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      metadata: assetMetadata.USDC,
    },
    USDT: {
      address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      metadata: assetMetadata.USDT,
    },
    wBTC: {
      address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
      metadata: assetMetadata.wBTC,
    },
    wETH: {
      address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      metadata: assetMetadata.wETH,
    },
  },
};

/**
 * Get assets for a specific network environment
 * @param environment - The network environment (mainnet/testnet)
 * @returns Array of asset configurations for the environment
 */
export function getAssetsForNetwork(environment: NetworkEnvironment): AssetContractInfo[] {
  return Object.values(assetConfig[environment]);
}

/**
 * Get a specific asset configuration
 * @param symbol - The asset symbol
 * @param environment - The network environment
 * @returns Asset configuration or undefined if not found
 */
export function getAssetConfig(symbol: AssetSymbol, environment: NetworkEnvironment): AssetContractInfo | undefined {
  return assetConfig[environment][symbol];
}

/**
 * Get all supported asset symbols for a network
 * @param environment - The network environment
 * @returns Array of supported asset symbols
 */
export function getSupportedAssetSymbols(environment: NetworkEnvironment): AssetSymbol[] {
  return Object.keys(assetConfig[environment]) as AssetSymbol[];
}

/**
 * Check if an asset is supported on a network
 * @param symbol - The asset symbol  
 * @param environment - The network environment
 * @returns Boolean indicating if the asset is supported
 */
export function isAssetSupported(symbol: AssetSymbol, environment: NetworkEnvironment): boolean {
  return symbol in assetConfig[environment];
}

/**
 * Get enabled (non-disabled) assets for a network
 * @param environment - The network environment
 * @returns Array of enabled asset configurations
 */
export function getEnabledAssets(environment: NetworkEnvironment): AssetContractInfo[] {
  return getAssetsForNetwork(environment).filter(asset => !asset.metadata.disabled);
}

// Legacy exports for backward compatibility with existing deposit modal
export const assetOptions = [
  { value: "stETH", label: "stETH", symbol: "eth" },
  { value: "LINK", label: "LINK", symbol: "link" },
];

export const timeLockOptions = [
  { value: "days", label: "Days" },
  { value: "months", label: "Months" },
  { value: "years", label: "Years" },
];

// Regular expression for Ethereum addresses (kept for backward compatibility)
export const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
