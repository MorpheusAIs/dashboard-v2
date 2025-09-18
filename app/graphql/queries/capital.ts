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

// Constructs the multi-alias GraphQL query string
export const buildDepositsQuery = (timestamps: number[], depositPoolAddress?: string): ReturnType<typeof gql> => { 
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

  let queryBody = '';
  const normalizedDepositPool = depositPoolAddress?.toLowerCase();
  timestamps.forEach((ts, index) => {
    const whereClause = normalizedDepositPool
      ? `where: { timestamp_lte: "${ts}", depositPool: "${normalizedDepositPool}" }`
      : `where: { timestamp_lte: "${ts}", pool: "0x00" }`;
    queryBody += `
      d${index}: poolInteractions(
        first: 1
        orderDirection: desc
        ${whereClause}
        orderBy: timestamp
      ) {
        totalStaked
        timestamp 
        __typename
      }
    `;
  });
  return gql`
    query GetEndOfDayDeposits {
      ${queryBody}
    }
  `;
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
