import { arbitrumSepolia, arbitrum, base } from 'wagmi/chains';
import { testnetChains, mainnetChains, ChainConfig } from '@/config/networks';
import { Address } from 'viem';
import React from 'react';

// Placeholder Icon
export const ArbitrumSepoliaIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <title>Arbitrum Sepolia</title>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2"/>
  </svg>
);

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