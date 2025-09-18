// Example integration file showing how to use the subgraph in your React components
// This file demonstrates the frontend integration patterns

import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import { formatUnits } from 'viem';
import { useMemo } from 'react';

// GraphQL query for user's lifetime claims
const GET_USER_LIFETIME_CLAIMS = gql`
  query GetUserLifetimeClaims($userAddress: String!) {
    userGlobalStats(id: $userAddress) {
      id
      totalClaimedAmount
      totalClaimCount
      firstClaimTimestamp
      lastClaimTimestamp
      stETHPoolStats {
        id
        totalClaimedAmount
        claimCount
        firstClaimTimestamp
        lastClaimTimestamp
      }
      linkPoolStats {
        id
        totalClaimedAmount
        claimCount
        firstClaimTimestamp
        lastClaimTimestamp
      }
    }
  }
`;

// Hook to get user's lifetime claims data
export function useUserLifetimeClaims(userAddress?: string) {
  const { data, loading, error, refetch } = useQuery(GET_USER_LIFETIME_CLAIMS, {
    variables: { 
      userAddress: userAddress?.toLowerCase() || '' 
    },
    skip: !userAddress,
    pollInterval: 30000, // Refetch every 30 seconds
    errorPolicy: 'all',
  });

  const processedData = useMemo(() => {
    if (!data?.userGlobalStats) {
      return {
        totalClaimedAmount: '0',
        totalClaimedFormatted: '0',
        totalClaimCount: 0,
        stETHClaimed: '0',
        stETHClaimedFormatted: '0',
        linkClaimed: '0', 
        linkClaimedFormatted: '0',
        firstClaimDate: null,
        lastClaimDate: null,
        hasClaimedBefore: false,
      };
    }

    const stats = data.userGlobalStats;
    
    // Format amounts from wei to readable format
    const totalClaimedFormatted = formatUnits(BigInt(stats.totalClaimedAmount || '0'), 18);
    const stETHClaimedFormatted = stats.stETHPoolStats 
      ? formatUnits(BigInt(stats.stETHPoolStats.totalClaimedAmount || '0'), 18)
      : '0';
    const linkClaimedFormatted = stats.linkPoolStats
      ? formatUnits(BigInt(stats.linkPoolStats.totalClaimedAmount || '0'), 18)
      : '0';

    return {
      totalClaimedAmount: stats.totalClaimedAmount || '0',
      totalClaimedFormatted: parseFloat(totalClaimedFormatted).toFixed(2),
      totalClaimCount: parseInt(stats.totalClaimCount || '0'),
      stETHClaimed: stats.stETHPoolStats?.totalClaimedAmount || '0',
      stETHClaimedFormatted: parseFloat(stETHClaimedFormatted).toFixed(2),
      linkClaimed: stats.linkPoolStats?.totalClaimedAmount || '0',
      linkClaimedFormatted: parseFloat(linkClaimedFormatted).toFixed(2),
      firstClaimDate: stats.firstClaimTimestamp 
        ? new Date(parseInt(stats.firstClaimTimestamp) * 1000)
        : null,
      lastClaimDate: stats.lastClaimTimestamp
        ? new Date(parseInt(stats.lastClaimTimestamp) * 1000)
        : null,
      hasClaimedBefore: parseInt(stats.totalClaimCount || '0') > 0,
    };
  }, [data]);

  return {
    ...processedData,
    loading,
    error,
    refetch,
  };
}

// Hook to calculate true lifetime earned (claimed + current claimable)
export function useLifetimeEarned(userAddress?: string, currentClaimable = 0) {
  const { totalClaimedFormatted, loading, error } = useUserLifetimeClaims(userAddress);
  
  const lifetimeEarned = useMemo(() => {
    const claimed = parseFloat(totalClaimedFormatted);
    return claimed + currentClaimable;
  }, [totalClaimedFormatted, currentClaimable]);

  return {
    lifetimeEarned: lifetimeEarned.toFixed(2),
    claimed: totalClaimedFormatted,
    currentClaimable: currentClaimable.toFixed(2),
    loading,
    error,
  };
}

// Example usage in UserAssetsPanel component
export function ExampleUsageInUserAssetsPanel() {
  /*
  // In your actual UserAssetsPanel component, you would use it like this:
  
  const {
    userAddress,
    assets,
  } = useCapitalContext();

  // Get lifetime claims from subgraph
  const {
    totalClaimedFormatted,
    stETHClaimedFormatted,
    linkClaimedFormatted,
    hasClaimedBefore,
    loading: lifetimeLoading,
    error: lifetimeError,
  } = useUserLifetimeClaims(userAddress);

  // Calculate current claimable amounts
  const stethClaimable = parseDepositAmount(assets.stETH?.claimableAmountFormatted);
  const linkClaimable = parseDepositAmount(assets.LINK?.claimableAmountFormatted);
  const currentClaimable = stethClaimable + linkClaimable;

  // Calculate true lifetime earned
  const { lifetimeEarned } = useLifetimeEarned(userAddress, currentClaimable);

  // Update your metrics data calculation
  const metricsData = useMemo(() => {
    // ... existing logic ...
    
    return {
      stakedValue: Math.floor(totalStakedValue).toLocaleString(),
      totalMorStaked: "0",
      dailyEmissionsEarned: "0",
      lifetimeEarned: lifetimeError ? "Error" : lifetimeEarned, // Real lifetime data!
      referralRewards: "0",
    };
  }, [hasStakedAssets, assets, stethPrice, linkPrice, lifetimeEarned, lifetimeError]);

  // Then in your JSX:
  <MetricCardMinimal
    title="Lifetime Earned"
    value={metricsData.lifetimeEarned}
    label="MOR"
    isLoading={lifetimeLoading}
    disableGlow={true}
    autoFormatNumbers={true}
    className="col-span-1"
  />
  */
}

// GraphQL query for recent claims (useful for activity feed)
export const GET_RECENT_CLAIMS = gql`
  query GetRecentClaims($userAddress: String!, $first: Int = 10) {
    userClaimEvents(
      where: { user: $userAddress }
      orderBy: blockTimestamp
      orderDirection: desc
      first: $first
    ) {
      id
      amount
      poolType
      blockTimestamp
      transactionHash
      blockNumber
    }
  }
`;

// Hook to get user's recent claims
export function useUserRecentClaims(userAddress?: string, count = 10) {
  const { data, loading, error } = useQuery(GET_RECENT_CLAIMS, {
    variables: {
      userAddress: userAddress?.toLowerCase() || '',
      first: count,
    },
    skip: !userAddress,
  });

  const recentClaims = useMemo(() => {
    if (!data?.userClaimEvents) return [];
    
    return data.userClaimEvents.map((claim: any) => ({
      id: claim.id,
      amount: formatUnits(BigInt(claim.amount), 18),
      poolType: claim.poolType,
      date: new Date(parseInt(claim.blockTimestamp) * 1000),
      transactionHash: claim.transactionHash,
      blockNumber: parseInt(claim.blockNumber),
    }));
  }, [data]);

  return {
    recentClaims,
    loading,
    error,
  };
}

// Example Apollo Client setup (add to your existing setup)
export const apolloClientConfig = {
  uri: 'https://api.studio.thegraph.com/query/YOUR-SUBGRAPH-ID/morpheus-capital-claims/version/latest',
  cache: {
    // Add any cache configuration
  },
};
