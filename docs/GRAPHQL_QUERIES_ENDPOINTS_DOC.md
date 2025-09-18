# GraphQL Queries and Endpoints Documentation

This document outlines all GraphQL queries and endpoints used to populate metrics across the Capital dashboard components.

## Overview

The Capital dashboard uses multiple data sources to populate its metrics:
1. **The Graph Protocol** subgraphs for historical and real-time blockchain data
2. **Dune Analytics** API for aggregated metrics (active stakers)
3. **CoinGecko** API for token price data

## 1. Chart Section (`components/capital/chart-section.tsx`)

### Purpose
Displays historical deposit charts and key metrics (TVL, Daily Emissions, APR, Active Stakers).

### GraphQL Queries and Endpoints

#### Chart Data Query
- **Query Location**: `app/graphql/queries/capital.ts`
- **Query Function**: `buildDepositsQuery()`
- **Query Type**: Dynamic multi-alias query for end-of-day deposit snapshots
- **API Endpoint Route**: `/api/capital` (Next.js API route)
- **GraphQL Endpoint Resolution**:
  - **Mainnet**: `https://api.studio.thegraph.com/query/73688/morpheus-mainnet-v-2/version/latest`
  - **Testnet**: `https://api.studio.thegraph.com/query/73688/kkk/version/latest`
- **Resolution Logic**: `getGraphQLApiUrl()` from `config/networks.ts`

#### Query Structure
```graphql
query GetEndOfDayDeposits {
  d0: poolInteractions(
    first: 1
    orderDirection: desc
    where: { timestamp_lte: "1704067200", depositPool: "0x47176b2af9885dc6c4575d4efd63895f7aaa4790" }
    orderBy: timestamp
  ) {
    totalStaked
    timestamp
    __typename
  }
  d1: poolInteractions(
    # ... additional day queries
  )
  # ... continues for each timestamp
}
```

#### Data Flow
1. `useCapitalChartData` hook generates timestamps for the last 15 months
2. `buildDepositsQuery()` creates multi-alias GraphQL query
3. Query sent to `/api/capital` API route
4. API route forwards to appropriate GraphQL endpoint based on network
5. Response processed into chart data points

#### Additional Metrics Sources
- **Active Stakers**: Fetched via Dune Analytics API (`/api/dune/active-stakers-*`)
- **Token Prices**: CoinGecko API for stETH/USD conversion
- **Pool Data**: Live contract data via `useCapitalPoolData` hook

## 2. User Assets Panel (`components/capital/user-assets-panel.tsx`)

### Purpose
Shows user's staked assets, earnings, and position metrics.

### GraphQL Queries and Endpoints

#### Total MOR Earned Query
- **Query Location**: `hooks/use-total-mor-earned.ts`
- **Query Name**: `GET_POOL_INTERACTIONS`
- **GraphQL Endpoint**: `https://api.studio.thegraph.com/query/73688/morpheus-ethereum-sepolia/version/latest`
- **Client**: Apollo Client (`apolloClients.CapitalV2Sepolia`)
- **Purpose**: Fetches historical pool interactions to calculate lifetime MOR earnings

#### Query Structure
```graphql
query GetPoolInteractions($userAddress: String!, $poolAddress: String!) {
  poolInteractions(
    orderBy: blockTimestamp
    orderDirection: desc
    where: {
      depositPool: $poolAddress
      user_contains: $userAddress
    }
  ) {
    blockTimestamp
    rate
    totalStaked
    user {
      address
    }
  }
}
```

#### Data Flow
1. `useTotalMorEarned` hook discovers all deposit pool addresses dynamically
2. Queries executed for each pool (stETH, LINK, etc.) using Apollo Client
3. Data processed to calculate MOR earnings: `(latest_rate - earliest_rate) / 10^(21 or 24)`
4. Different decimal scaling applied per pool:
   - **stETH**: 21 decimals
   - **LINK**: 24 decimals (rates are ~1000x larger)

#### Additional Data Sources
- **Token Prices**: Shared `useTokenPrices` hook (CoinGecko API)
- **Daily Emissions**: Calculated from live contract APR data
- **User Balances**: Direct contract reads via `useCapitalContext`

## 3. Referral Panel (`components/capital/referral-panel.tsx`)

### Purpose
Displays referral statistics and claimable rewards.

### GraphQL Queries and Endpoints

#### Referral Data Query
- **Query Location**: `app/graphql/queries/capital.ts`
- **Query Name**: `GET_REFERRALS_BY_REFERRER`
- **API Utility**: `fetchGraphQL` from `app/graphql/client.ts`
- **GraphQL Endpoint Resolution**:
  - **Testnet**: `https://api.studio.thegraph.com/query/73688/morpheus-ethereum-sepolia/version/latest`
  - **Mainnet**: `getEndpointForNetwork('Ethereum')` → `https://api.studio.thegraph.com/query/73688/morpheus-ethereum-sepolia/version/latest`

#### Query Structure
```graphql
query getReferralsByReferrer($referrerAddress: String!) {
  referrers(where: { referrerAddress_contains: $referrerAddress }) {
    referrerAddress
    referrals {
      referralAddress
      amount
    }
  }
}
```

#### Data Flow
1. `useReferralData` hook fetches referral data using `fetchGraphQL` utility
2. Query executed with debouncing (2-second cache) and retry logic
3. Response aggregated to calculate:
   - **Total Referrals**: Count of unique referral addresses
   - **Total MOR Earned**: Sum of all referral amounts
   - **Unique Referrals**: Set of referral addresses (excluding referrer)

#### Additional Metrics
- **Claimable Rewards**: Calculated from live contract data via `useCapitalContext`
- **Lifetime Rewards**: Historical earnings from subgraph data

## 4. Shared Infrastructure

### Apollo Client Configuration
- **Location**: `lib/apollo-client.ts`
- **Clients Available**:
  - `CapitalV2Sepolia`: For Capital v2 subgraph queries
  - `Base`: For mainnet queries
  - `Arbitrum`, `ArbitrumSepolia`: For Arbitrum network queries
- **Features**: Error handling, retry logic, query deduplication

### GraphQL Client Utilities
- **Location**: `app/graphql/client.ts`
- **Key Functions**:
  - `fetchGraphQL()`: Main GraphQL API caller with retry logic
  - `getEndpointForNetwork()`: Network-specific endpoint resolution
- **Features**: Request debouncing, rate limiting handling, caching

### Network Configuration
- **Location**: `config/networks.ts`
- **Endpoint Mapping**:
  ```typescript
  export const apiUrls = {
    mainnet: {
      graphql: 'https://api.studio.thegraph.com/query/73688/morpheus-mainnet-v-2/version/latest'
    },
    testnet: {
      graphql: 'https://api.studio.thegraph.com/query/73688/kkk/version/latest'
    }
  };
  ```

## 5. Data Processing Patterns

### Metric Calculations

#### Total Value Locked (TVL)
```typescript
// From useCapitalMetrics.ts
const stethUSDValue = stethAmount * stethPrice;
const linkUSDValue = linkAmount * linkPrice;
const totalValueLockedUSD = Math.floor(stethUSDValue + linkUSDValue);
```

#### Daily MOR Emissions
```typescript
// From live contract data
const stETHDailyRewards = (stETHAPR / 100 / 365) * stETHDeposited;
const linkDailyRewards = (linkAPR / 100 / 365) * linkDeposited;
const totalDailyEmissions = stETHDailyRewards + linkDailyRewards;
```

#### Average APR (Weighted)
```typescript
const stethWeight = stethUSDValue / totalValueLockedUSD;
const linkWeight = linkUSDValue / totalValueLockedUSD;
const avgApy = (stethApyNum * stethWeight) + (linkApyNum * linkWeight);
```

### Caching Strategy

#### Local Storage Caching
- **TVL Data**: 30-minute cache (`morpheus_tvl_cache`)
- **Active Stakers**: 30-minute cache (`morpheus_active_stakers_cache`)
- **Token Prices**: 5-minute cache with retry logic

#### Request Deduplication
- GraphQL requests deduplicated for 2 seconds
- Prevents duplicate API calls for same data

## 6. Error Handling and Resilience

### Retry Logic
- **GraphQL Requests**: 3 retry attempts with exponential backoff
- **Dune API**: 3 retry attempts with exponential backoff
- **Rate Limiting**: Automatic retry on HTTP 429 responses

### Fallback Mechanisms
- **Cached Data**: Used when live data unavailable
- **Partial Data**: Calculations continue with available data
- **Graceful Degradation**: Shows "Loading..." or "N/A" for missing data

### Network Switching
- Chart data cleared when switching to testnet
- Different endpoints used per network environment
- Contract addresses dynamically resolved per network

## 7. Performance Optimizations

### Query Optimization
- Multi-alias queries for historical data
- Paginated requests where needed
- Background loading for non-critical data

### Caching Layers
- Browser localStorage for expensive calculations
- Apollo Client cache for GraphQL responses
- Request deduplication to prevent redundant calls

### Lazy Loading
- Historical data loaded after recent data
- Asset-specific data loaded on demand
- Background pre-loading for smooth UX

This comprehensive GraphQL infrastructure ensures reliable, performant data delivery across the Capital dashboard while maintaining data consistency and user experience quality.
