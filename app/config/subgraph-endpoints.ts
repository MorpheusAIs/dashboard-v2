// Shared GraphQL subgraph endpoint configuration
// Single source of truth for all subgraph URLs across the application
//
// NOTE: V4 Goldsky endpoints are now available and use standard mainnet schema
// The queries have been migrated to support v4 schema (buildersProjects, buildersUsers, first/skip pagination)

export const SUBGRAPH_ENDPOINTS = {
  // Ponder V4 endpoints (deprecated - kept for reference)
  Base: 'https://ponder-builders-v4-base.up.railway.app',
  Arbitrum: 'https://ponder-builders-v4-arbitrum.up.railway.app',
  
  // Goldsky V1 endpoints (deprecated - old schema with testnet-style naming)
  GoldskyBase: 'https://api.goldsky.com/api/public/project_cmgzm6igw009l5np264iw7obk/subgraphs/morpheus-mainnet-base/v0.0.2/gn',
  GoldskyArbitrum: 'https://api.goldsky.com/api/public/project_cmgzm6igw009l5np264iw7obk/subgraphs/morpheus-mainnet-arbitrum/v0.0.2/gn',
  
  // Goldsky V4 endpoints (ACTIVE - standard mainnet schema)
  GoldskyBaseV4: 'https://api.goldsky.com/api/public/project_cmgzm6igw009l5np264iw7obk/subgraphs/morpheus-mainnet-base-compatible/v0.0.1/gn',
  GoldskyArbitrumV4: 'https://api.goldsky.com/api/public/project_cmgzm6igw009l5np264iw7obk/subgraphs/morpheus-mainnet-arbitrum-compatible/v0.0.1/gn',
  
  // Testnet endpoints
  ArbitrumSepolia: 'https://subgraph.satsuma-prod.com/8675f21b07ed/9iqb9f4qcmhosiruyg763--465704/morpheus-arbitrum-sepolia/api',
  BaseSepolia: 'https://builders-base-sepolia.up.railway.app/graphql',
  
  // Capital v2 subgraph endpoints
  Ethereum: 'https://api.studio.thegraph.com/query/73688/morpheus-mainnet-v-2/version/latest',
  CapitalV2Sepolia: 'https://api.studio.thegraph.com/query/73688/morpheus-ethereum-sepolia/version/latest',
} as const;

// Type helper for network keys
export type NetworkKey = keyof typeof SUBGRAPH_ENDPOINTS;

// Feature flag to use Goldsky API routes for mainnet data fetching
// API routes now use Goldsky V4 endpoints and transform data for the frontend
// Set to true to use API routes (recommended - includes pagination and caching)
// Set to false to use direct GraphQL queries (requires Ponder-style nested queries)
export const USE_GOLDSKY_V1_DATA = true;

// Feature flag to use Goldsky V4 endpoints
// Set to true to use v4 endpoints with standard mainnet schema
export const USE_GOLDSKY_V4_DATA = true;
