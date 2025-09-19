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
    }
    _meta {
      block {
        number
      }
    }
  }
`;

// RESTORED: Batched query system with CORRECT schema
export const buildDepositsQuery = (timestamps: number[]): ReturnType<typeof gql> => { 
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

  console.log('✅ Building BATCHED GraphQL query with CORRECT schema for', timestamps.length, 'days');
  console.log('🔍 Using schema: depositPool, blockTimestamp_lte, totalStaked, rate');

  // RESTORE original batched approach with CORRECT schema fields
  let queryBody = '';
  timestamps.forEach((ts, index) => {
    queryBody += `
      d${index}: poolInteractions(
        first: 1
        orderDirection: desc
        where: { 
          depositPool: "0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790",
          blockTimestamp_lte: "${ts}"
        }
        orderBy: blockTimestamp
      ) {
        blockTimestamp
        totalStaked
        rate
        __typename
      }
    `;
  });
  
  const query = gql`
    query GetEndOfDayDeposits {
      ${queryBody}
    }
  `;
  
  console.log('📋 Generated BATCHED GraphQL query for', timestamps.length, 'days');
  return query;
};

// ===== REFERRAL QUERIES =====

export const GET_REFERRALS_BY_REFERRER = `
  query getReferralsByReferrer($referrerAddress: String!) {
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
  query getReferrerStats($referrerAddress: String!) {
    referrers(where: { referrerAddress: $referrerAddress }) {
      referrerAddress
      referrals {
        referralAddress
        amount
      }
    }
  }
`;