import { arbitrumSepolia, arbitrum, base } from 'wagmi/chains';
import { testnetChains, mainnetChains, ChainConfig } from '@/config/networks';
import { Address } from 'viem';

// Update SUPPORTED_CHAINS to include all networks
export const SUPPORTED_CHAINS: Record<number, ChainConfig> = {
  [arbitrumSepolia.id]: testnetChains.arbitrumSepolia,
  [arbitrum.id]: mainnetChains.arbitrum,
  [base.id]: mainnetChains.base
};

// Lowercase fallback token address to bypass checksum validation while remaining valid
export const FALLBACK_TOKEN_ADDRESS = "0x34a285A1B1C166420Df5b6630132542923B5b27E" as Address;

// Helper for UI messages
export const DEFAULT_TOKEN_SYMBOL = 'MOR';
