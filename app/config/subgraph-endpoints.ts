// Shared GraphQL subgraph endpoint configuration
// Single source of truth for all subgraph URLs across the application
//
// NOTE: When Ponder index endpoints are available, update Base and Arbitrum endpoints below.
// The queries have been migrated to support Ponder's schema (items wrapper, limit pagination, etc.)

export const SUBGRAPH_ENDPOINTS = {
  Base: 'https://ponder-builders-v1-base-production.up.railway.app/',
  Arbitrum: 'https://ponder-builders-v1-arbitrum-production.up.railway.app/',
  Arbitrum_Sepolia: 'https://subgraph.satsuma-prod.com/8675f21b07ed/9iqb9f4qcmhosiruyg763--465704/morpheus-arbitrum-sepolia/api',
  Ethereum: 'https://api.studio.thegraph.com/query/73688/morpheus-mainnet-v-2/version/latest',
  CapitalV2Sepolia: 'https://api.studio.thegraph.com/query/73688/morpheus-ethereum-sepolia/version/latest',
} as const;

// Type helper for network keys
export type NetworkKey = keyof typeof SUBGRAPH_ENDPOINTS;

