// GraphQL queries for Capital module

import { gql } from "@apollo/client";

// Generates end-of-day timestamps (seconds) for a range
export const getEndOfDayTimestamps = (startDate: Date, endDate: Date): number[] => {
  const timestamps = [];
  const currentDate = new Date(startDate);
  currentDate.setUTCHours(0, 0, 0, 0); // Start at the beginning of the start day

  while (currentDate <= endDate) {
    const endOfDay = new Date(currentDate);
    endOfDay.setUTCHours(23, 59, 59, 999);
    timestamps.push(Math.floor(endOfDay.getTime() / 1000));
    currentDate.setDate(currentDate.getDate() + 1); // Move to the next day
  }
  return timestamps;
};

// Schema exploration query to understand available fields
export const SCHEMA_EXPLORATION_QUERY = gql`
  query ExploreSchema {
    # Try different entity names that might exist
    poolInteractions(first: 1) {
      id
      __typename
    }
    # Try alternative entity names
    interactions(first: 1) {
      id
      __typename
    }
    deposits(first: 1) {
      id
      __typename  
    }
    poolEvents(first: 1) {
      id
      __typename
    }
    _meta {
      block {
        number
        timestamp
      }
    }
  }
`;

// Minimal query without any filtering to test basic connectivity
export const MINIMAL_QUERY = gql`
  query MinimalTest {
    poolInteractions(first: 5) {
      id
      blockTimestamp
      totalStaked
      depositPool
    }
    _meta {
      block {
        number
      }
    }
  }
`;

// Test query for the specific stETH pool
export const TEST_STETH_POOL_QUERY = gql`
  query TestStETHPool {
    poolInteractions(
      first: 5
      where: { 
        depositPool: "0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790"
      }
      orderBy: blockTimestamp
      orderDirection: desc
    ) {
      id
      blockTimestamp
      totalStaked
      rate
      depositPool
      user {
        address
        rewardPoolId
      }
    }
    
    depositPools(
      where: { 
        depositPool: "0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790"
      }
    ) {
      id
      rewardPoolId
      totalStaked
      depositPool
    }
  }
`;

import { type AssetSymbol } from "@/components/capital/constants/asset-config";

// Asset to deposit pool address mapping
export const ASSET_DEPOSIT_POOL_ADDRESSES: Record<'mainnet' | 'testnet', Partial<Record<AssetSymbol, string>>> = {
  mainnet: {
    stETH: '0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790',
    USDC: '0x6cCE082851Add4c535352f596662521B4De4750E',
    USDT: '0x3B51989212BEdaB926794D6bf8e9E991218cf116',
    wBTC: '0xdE283F8309Fd1AA46c95d299f6B8310716277A42',
    wETH: '0x9380d72aBbD6e0Cc45095A2Ef8c2CA87d77Cb384',
  },
  testnet: {
    stETH: '0xFea33A23F97d785236F22693eDca564782ae98d0',
    LINK: '0x7f4f17be21219D7DA4C8E0d0B9be6a778354E5A5',
  }
} as const;

// Asset-specific start dates
export const ASSET_START_DATES: Record<AssetSymbol, string> = {
  stETH: '2024-02-07T00:00:00Z', // Historical data from Feb 7, 2024
  USDC: '2025-09-18T00:00:00Z', // New pools start from Sep 18, 2025
  USDT: '2025-09-18T00:00:00Z',
  wBTC: '2025-09-18T00:00:00Z', 
  wETH: '2025-09-18T00:00:00Z',
  LINK: '2025-09-18T00:00:00Z',
} as const;

// Helper function to get deposit pool address for an asset
export function getDepositPoolAddress(
  asset: string, 
  networkEnv: 'mainnet' | 'testnet'
): string | undefined {
  return ASSET_DEPOSIT_POOL_ADDRESSES[networkEnv]?.[asset as AssetSymbol];
}

// Helper function to get asset start date
export function getAssetStartDate(asset: string): string {
  return ASSET_START_DATES[asset as AssetSymbol] || ASSET_START_DATES.stETH;
}

// DYNAMIC: Batched query system with asset-specific deposit pool addresses
export const buildDepositsQuery = (
  timestamps: number[], 
  depositPoolAddress: string,
  rewardPoolId: string = "0"
): ReturnType<typeof gql> => { 
  // Handle empty timestamps array to avoid empty GraphQL query
  if (!timestamps || timestamps.length === 0) {
    return gql`
      query GetEndOfDayDeposits {
        # Placeholder query when no timestamps available
        _meta {
          block {
            number
          }
        }
      }
    `;
  }

  console.log('✅ Building DYNAMIC GraphQL query for', timestamps.length, 'days');
  console.log('🔍 Using deposit pool:', depositPoolAddress);
  console.log('🔍 Using schema: depositPool + rewardPoolId, blockTimestamp_lte, totalStaked, rate');

  // Dynamic batched approach with asset-specific depositPool address
  let queryBody = '';
  timestamps.forEach((ts, index) => {
    queryBody += `
      d${index}: poolInteractions(
        first: 1
        orderDirection: desc
        where: { 
          depositPool: "${depositPoolAddress}",
          user_: { rewardPoolId: "${rewardPoolId}" },
          blockTimestamp_lte: ${ts}
        }
        orderBy: blockTimestamp
      ) {
        blockTimestamp
        totalStaked
        rate
        user {
          rewardPoolId
          depositPool
        }
        __typename
      }
    `;
  });
  
  const query = gql`
    query GetEndOfDayDeposits {
      ${queryBody}
    }
  `;
  
  console.log('📋 Generated DYNAMIC GraphQL query for', timestamps.length, 'days for pool:', depositPoolAddress);
  return query;
};

// Alternative approach: Query DepositPool entity directly for total staked amounts
export const buildDepositPoolQuery = (rewardPoolId: string = "0"): ReturnType<typeof gql> => {
  console.log('✅ Building DepositPool query for rewardPoolId:', rewardPoolId);
  
  const query = gql`
    query GetDepositPoolData {
      depositPools(
        where: { 
          depositPool: "0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790",
          rewardPoolId: "${rewardPoolId}"
        }
      ) {
        id
        rewardPoolId
        depositPool
        totalStaked
      }
    }
  `;
  
  return query;
};

// Enhanced query that gets both current state and historical interactions
export const buildEnhancedDepositsQuery = (timestamps: number[], rewardPoolId: string = "0"): ReturnType<typeof gql> => {
  if (!timestamps || timestamps.length === 0) {
    return gql`
      query GetEnhancedDeposits {
        _meta {
          block {
            number
          }
        }
      }
    `;
  }

  // Split timestamps into smaller batches to avoid API limits
  const batchSize = 90; // Increased from 30 to get more data without 500 error
  const batches = [];
  for (let i = 0; i < timestamps.length; i += batchSize) {
    batches.push(timestamps.slice(i, i + batchSize));
  }

  console.log(`✅ Building ENHANCED query with ${batches.length} batches of max ${batchSize} days each`);

  // Use first batch only to avoid 500 errors, but make it larger
  const currentBatch = batches[0] || [];
  
  let queryBody = '';
  currentBatch.forEach((ts, index) => {
    queryBody += `
      d${index}: poolInteractions(
        first: 1
        orderDirection: desc
        where: { 
          depositPool: "0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790",
          blockTimestamp_lte: ${ts}
        }
        orderBy: blockTimestamp
      ) {
        blockTimestamp
        totalStaked
        rate
        depositPool
        __typename
      }
    `;
  });

  // Also get current deposit pool state
  queryBody += `
    currentPool: depositPools(
      where: { 
        depositPool: "0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790",
        rewardPoolId: "${rewardPoolId}"
      }
    ) {
      totalStaked
      rewardPoolId
      depositPool
    }
  `;
  
  const query = gql`
    query GetEnhancedDeposits {
      ${queryBody}
    }
  `;
  
  console.log(`📋 Generated ENHANCED query for ${currentBatch.length} days with rewardPoolId:`, rewardPoolId);
  return query;
};

// Alternative: Range-based query to get all interactions in a time period
export const buildRangeDepositsQuery = (startTimestamp: number, endTimestamp: number): ReturnType<typeof gql> => {
  console.log(`✅ Building RANGE query from ${new Date(startTimestamp * 1000).toISOString().split('T')[0]} to ${new Date(endTimestamp * 1000).toISOString().split('T')[0]}`);
  
  const query = gql`
    query GetRangeDeposits {
      poolInteractions(
        first: 1000
        orderBy: blockTimestamp
        orderDirection: asc
        where: { 
          depositPool: "0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790",
          blockTimestamp_gte: ${startTimestamp},
          blockTimestamp_lte: ${endTimestamp}
        }
      ) {
        blockTimestamp
        totalStaked
        rate
        depositPool
        __typename
      }
      
      currentPool: depositPools(
        where: { 
          depositPool: "0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790",
          rewardPoolId: "0"
        }
      ) {
        totalStaked
        rewardPoolId
        depositPool
      }
    }
  `;
  
  return query;
};

// Multi-batch query system for handling large datasets
export const buildMultiBatchDepositsQuery = (timestamps: number[], batchSize: number = 30): Array<ReturnType<typeof gql>> => {
  if (!timestamps || timestamps.length === 0) {
    return [];
  }

  // Split timestamps into batches
  const batches = [];
  for (let i = 0; i < timestamps.length; i += batchSize) {
    batches.push(timestamps.slice(i, i + batchSize));
  }

  console.log(`✅ Creating ${batches.length} separate queries for ${timestamps.length} total days`);

  // Create separate queries for each batch
  return batches.map((batch, batchIndex) => {
    let queryBody = '';
    batch.forEach((ts, index) => {
      queryBody += `
        d${index}: poolInteractions(
          first: 1
          orderDirection: desc
          where: { 
            depositPool: "0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790",
            blockTimestamp_lte: ${ts}
          }
          orderBy: blockTimestamp
        ) {
          blockTimestamp
          totalStaked
          rate
          depositPool
          __typename
        }
      `;
    });

    const query = gql`
      query GetBatchDeposits${batchIndex} {
        ${queryBody}
      }
    `;

    console.log(`📋 Generated batch ${batchIndex + 1}/${batches.length} with ${batch.length} days`);
    return query;
  });
};

// ===== REFERRAL QUERIES =====

export const GET_REFERRALS_BY_REFERRER = `
  query getReferralsByReferrer($referrerAddress: Bytes!) {
    referrers(where: { referrerAddress_contains: $referrerAddress }) {
      referrerAddress
      referrals {
        referralAddress
        amount
      }
    }
  }
`;

export const GET_REFERRER_STATS = `
  query getReferrerStats($referrerAddress: Bytes!) {
    referrers(where: { referrerAddress: $referrerAddress }) {
      referrerAddress
      referrals {
        referralAddress
        amount
      }
    }
  }
`;