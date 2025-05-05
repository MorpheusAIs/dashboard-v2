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

// Fallback MOR token address on Arbitrum Sepolia
export const FALLBACK_TOKEN_ADDRESS = "0x6a7487a0ba53cCD6911a1150a33038b1a75B9Dc4" as Address;

// Helper for UI messages
export const DEFAULT_TOKEN_SYMBOL = 'MOR'; 