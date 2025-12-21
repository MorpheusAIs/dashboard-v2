// Shared GraphQL subgraph endpoint configuration
// Single source of truth for all subgraph URLs across the application
//
// NOTE: When Ponder index endpoints are available, update Base and Arbitrum endpoints below.
// The queries have been migrated to support Ponder's schema (items wrapper, limit pagination, etc.)

export const SUBGRAPH_ENDPOINTS = {
  // Ponder V4 endpoints (production)
  Base: 'https://ponder-builders-v4-base.up.railway.app',
  Arbitrum: 'https://ponder-builders-v4-arbitrum.up.railway.app',
  
  // Goldsky V1 endpoints (temporary bridge solution)
  GoldskyBase: 'https://api.goldsky.com/api/public/project_cmgzm6igw009l5np264iw7obk/subgraphs/morpheus-mainnet-base/v0.0.2/gn',
  GoldskyArbitrum: 'https://api.goldsky.com/api/public/project_cmgzm6igw009l5np264iw7obk/subgraphs/morpheus-mainnet-arbitrum/v0.0.2/gn',
  
  // Testnet endpoints
  ArbitrumSepolia: 'https://subgraph.satsuma-prod.com/8675f21b07ed/9iqb9f4qcmhosiruyg763--465704/morpheus-arbitrum-sepolia/api',
  BaseSepolia: 'https://builders-base-sepolia.up.railway.app/graphql',
  
  // Capital v2 subgraph endpoints
  Ethereum: 'https://api.studio.thegraph.com/query/73688/morpheus-mainnet-v-2/version/latest',
  CapitalV2Sepolia: 'https://api.studio.thegraph.com/query/73688/morpheus-ethereum-sepolia/version/latest',
} as const;

// Type helper for network keys
export type NetworkKey = keyof typeof SUBGRAPH_ENDPOINTS;

// Feature flag to use Goldsky V1 data via API routes instead of direct GraphQL queries
// Set to true to use server-side extracted Goldsky data (temporary bridge solution)
// Set to false to use direct Ponder V4 GraphQL queries
export const USE_GOLDSKY_V1_DATA = true;
