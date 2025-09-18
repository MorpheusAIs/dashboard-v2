import { useState, useEffect, useMemo } from 'react';
import { getEndpointForNetwork, fetchGraphQL } from '@/app/graphql/client';
import { GET_REFERRALS_BY_REFERRER } from '@/app/graphql/queries/capital';
import { CapitalReferralGraphQLResponse } from '@/app/graphql/types';

interface UseReferralDataProps {
  userAddress?: `0x${string}`;
  networkEnvironment: 'testnet' | 'mainnet';
}

export function useReferralData({ userAddress, networkEnvironment }: UseReferralDataProps) {
  const isDev = process.env.NODE_ENV !== 'production';
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawData, setRawData] = useState<CapitalReferralGraphQLResponse | null>(null);

  useEffect(() => {
    if (!userAddress) {
      if (isDev) {
        console.log('[useReferralData] No user address provided; skipping fetch.');
      }
      setRawData(null);
      setError(null);
      return;
    }

    const fetchReferralData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // For testnet, use Ethereum Sepolia endpoint; for mainnet, use Ethereum mainnet endpoint
        // Based on the apollo-client.ts, we should use CapitalV2Sepolia for testnet and Base for mainnet
        const endpoint = networkEnvironment === 'testnet' 
          ? 'https://api.studio.thegraph.com/query/73688/morpheus-ethereum-sepolia/version/latest'
          : getEndpointForNetwork('Ethereum'); // Use Ethereum mainnet

        if (isDev) {
          console.log('[useReferralData] Fetching referrals', {
            userAddress,
            networkEnvironment,
            endpoint,
          });
        }

        const response = await fetchGraphQL<CapitalReferralGraphQLResponse>(
          endpoint,
          'getReferralsByReferrer',
          GET_REFERRALS_BY_REFERRER,
          { referrerAddress: userAddress.toLowerCase() }
        );

        if (response.errors && response.errors.length > 0) {
          throw new Error(response.errors[0].message);
        }

        if (isDev) {
          console.log('[useReferralData] GraphQL response received', response);
        }

        setRawData(response);
      } catch (err) {
        console.error('Error fetching referral data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch referral data');
        setRawData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReferralData();
  }, [userAddress, networkEnvironment]);

  const referralMetrics = useMemo(() => {
    if (!rawData?.data?.referrers || rawData.data.referrers.length === 0) {
      if (isDev) {
        console.log('[useReferralData] No referrals returned from GraphQL.');
      }
      return {
        totalReferrals: 0,
        totalReferralAmount: BigInt(0),
        uniqueReferrals: new Set<string>()
      };
    }

    // Aggregate all referrals across all referrer entries
    const allReferrals = rawData.data.referrers.flatMap(referrer => referrer.referrals);
    
    // Count unique referral addresses (excluding the referrer themselves)
    const uniqueReferralAddresses = new Set(
      allReferrals
        .map(ref => ref.referralAddress.toLowerCase())
        .filter(addr => addr !== userAddress?.toLowerCase())
    );

    // Calculate total referral amount
    const totalAmount = allReferrals.reduce((sum, ref) => {
      try {
        return sum + BigInt(ref.amount);
      } catch {
        return sum;
      }
    }, BigInt(0));

    const metrics = {
      totalReferrals: uniqueReferralAddresses.size,
      totalReferralAmount: totalAmount,
      uniqueReferrals: uniqueReferralAddresses
    };

    if (isDev) {
      console.log('[useReferralData] Computed referral metrics', {
        totalReferrals: metrics.totalReferrals,
        totalReferralAmount: metrics.totalReferralAmount.toString(),
        uniqueReferralAddresses: Array.from(metrics.uniqueReferrals),
      });
    }

    return metrics;
  }, [rawData, userAddress]);

  return {
    isLoading,
    error,
    totalReferrals: referralMetrics.totalReferrals,
    totalReferralAmount: referralMetrics.totalReferralAmount,
    uniqueReferrals: referralMetrics.uniqueReferrals,
    rawData: rawData?.data
  };
}
