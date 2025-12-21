import { baseSepolia, base } from 'wagmi/chains';
import { testnetChains, mainnetChains, ChainConfig } from '@/config/networks';
import { Address } from 'viem';

// Update SUPPORTED_CHAINS - only Base and Base Sepolia supported (both use V4 contracts)
export const SUPPORTED_CHAINS: Record<number, ChainConfig> = {
  [baseSepolia.id]: testnetChains.baseSepolia,
  [base.id]: mainnetChains.base
};

// Lowercase fallback token address to bypass checksum validation while remaining valid
export const FALLBACK_TOKEN_ADDRESS = "0x34a285A1B1C166420Df5b6630132542923B5b27E" as Address;

// Helper for UI messages
export const DEFAULT_TOKEN_SYMBOL = 'MOR';
