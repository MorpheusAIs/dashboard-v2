import { EthIcon } from './eth-icon';
import { WbtcIcon } from './wbtc-icon';
import { UsdcIcon } from './usdc-icon';
import { UsdtIcon } from './usdt-icon';
import { LinkIcon } from './link-icon';
import type { AssetSymbol } from '@/components/capital/constants/asset-config';

// Export all icon components
export { EthIcon, WbtcIcon, UsdcIcon, UsdtIcon, LinkIcon };

// Icon component props interface
export interface AssetIconProps {
  className?: string;
  size?: number | string;
}

// Asset icon mapping
const assetIconMap = {
  'stETH': EthIcon,     // stETH uses ETH icon
  'wETH': EthIcon,      // wETH uses ETH icon  
  'wBTC': WbtcIcon,     // wBTC uses Bitcoin icon
  'USDC': UsdcIcon,     // USDC uses USDC icon
  'USDT': UsdtIcon,     // USDT uses USDT icon
  'LINK': LinkIcon,     // LINK uses Link icon
} as const;

/**
 * Get the appropriate icon component for an asset
 * @param symbol - The asset symbol
 * @returns The corresponding icon component
 */
export function getAssetIcon(symbol: AssetSymbol) {
  return assetIconMap[symbol] || EthIcon; // fallback to ETH icon
}

/**
 * Asset Icon component that renders the appropriate icon for a given asset
 * @param symbol - The asset symbol to render icon for
 * @param props - Icon component props (className, size)
 * @returns The rendered asset icon component
 */
export function AssetIcon({ 
  symbol, 
  className = "rounded-lg", 
  size = 24 
}: AssetIconProps & { symbol: AssetSymbol }) {
  const IconComponent = getAssetIcon(symbol);
  
  return <IconComponent className={className} size={size} />;
}
