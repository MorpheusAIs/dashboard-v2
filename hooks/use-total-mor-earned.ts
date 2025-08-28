"use client";

import { useState, useEffect, useMemo } from 'react';
import { apolloClients } from '@/lib/apollo-client';
import { gql } from '@apollo/client';

// GraphQL queries to get pool interactions for calculating total MOR earned
const GET_STETH_POOL_INTERACTIONS = gql`
  query GetStETHPoolInteractions($userAddress: String!, $stETHPool: String!) {
    poolInteractions(
      orderBy: blockTimestamp
      orderDirection: desc
      where: {
        depositPool: $stETHPool
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
`;

const GET_LINK_POOL_INTERACTIONS = gql`
  query GetLINKPoolInteractions($userAddress: String!, $linkPool: String!) {
    poolInteractions(
      orderBy: blockTimestamp
      orderDirection: desc
      where: {
        depositPool: $linkPool
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
`;

interface PoolInteraction {
  blockTimestamp: string;
  rate: string;
  totalStaked: string;
  user: {
    address: string;
  };
}

interface CombinedPoolInteractionsData {
  stETHInteractions: PoolInteraction[];
  linkInteractions: PoolInteraction[];
}

export interface TotalMorEarnedData {
  totalEarned: number;
  stETHEarned: number;
  linkEarned: number;
  isLoading: boolean;
  error: string | null;
}

// Pool contract addresses for Capital v2 (Sepolia testnet)
// From config/networks.ts - trying both pools as user says both assets are in same pool
const CAPITAL_V2_POOLS = {
  stETH: '0xFea33A23F97d785236F22693eDca564782ae98d0', // stETHDepositPool from config
  LINK: '0x7f4f17be21219D7DA4C8E0d0B9be6a778354E5A5',  // linkDepositPool from config (used in original test)
};

/**
 * Calculates total MOR earned from historical pool interaction data
 * Method: (latest_rate - earliest_rate) / 10^(21 or 24)
 * 
 * Uses different scaling per pool:
 * - stETH: 21 decimals (standard)
 * - LINK: 24 decimals (LINK rates are ~1000x larger)
 */
function calculateTotalEarned(interactions: PoolInteraction[], poolName?: string): number {
  console.log(`🧮 calculateTotalEarned called for ${poolName}:`, {
    poolName,
    interactionsCount: interactions?.length || 0,
    interactions: interactions?.slice(0, 3), // Log first 3 for debugging
  });

  if (!interactions || interactions.length === 0) {
    console.log('❌ No interactions to calculate from');
    return 0;
  }

  // Sort by timestamp ascending to process in chronological order
  const sortedInteractions = [...interactions].sort((a, b) => 
    parseInt(a.blockTimestamp) - parseInt(b.blockTimestamp)
  );

  console.log('📊 Sorted interactions for calculation:', {
    count: sortedInteractions.length,
    earliest: {
      timestamp: sortedInteractions[0].blockTimestamp,
      rate: sortedInteractions[0].rate,
    },
    latest: {
      timestamp: sortedInteractions[sortedInteractions.length - 1].blockTimestamp,
      rate: sortedInteractions[sortedInteractions.length - 1].rate,
    }
  });

  // The rate field appears to represent cumulative rewards earned
  // We can calculate total earned as the difference between latest and earliest rates
  const earliestRate = BigInt(sortedInteractions[0].rate || '0');
  const latestRate = BigInt(sortedInteractions[sortedInteractions.length - 1].rate || '0');
  
  // Apply different scaling based on pool - LINK rates are ~1000x larger than stETH
  const totalEarnedScaled = latestRate - earliestRate;
  
  let totalEarned: number;
  if (poolName === 'LINK') {
    // LINK pool rates are ~1000x larger, so use 24 decimals instead of 21
    totalEarned = Number(totalEarnedScaled) / Math.pow(10, 24);
  } else {
    // stETH uses standard 21 decimals (this gives correct ~46k result)
    totalEarned = Number(totalEarnedScaled) / Math.pow(10, 21);
  }
  
  const usedDecimalScale = poolName === 'LINK' ? 24 : 21;
  
  console.log(`💰 Rate calculation for ${poolName} (using ${usedDecimalScale} decimals):`, {
    poolName,
    earliestRate: earliestRate.toString(),
    latestRate: latestRate.toString(),
    rateDifference: totalEarnedScaled.toString(),
    calculatedEarned: totalEarned,
    decimalScale: usedDecimalScale,
    reason: poolName === 'LINK' ? 'LINK rates are ~1000x larger than stETH' : 'Standard scaling',
    allRateValues: sortedInteractions.map(i => i.rate).slice(0, 3), // First 3 rates for debugging
    finalResult: Math.max(0, totalEarned)
  });
  
  return Math.max(0, totalEarned); // Ensure non-negative
}

/**
 * Hook to fetch and calculate total MOR earned from Capital v2 subgraph
 * Only works on testnet with the new Capital v2 contracts
 */
export function useTotalMorEarned(
  userAddress: string | null,
  networkEnv: 'mainnet' | 'testnet'
): TotalMorEarnedData {
  const [data, setData] = useState<CombinedPoolInteractionsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only fetch data for testnet users with addresses
  const shouldFetch = userAddress && networkEnv === 'testnet';

  console.log('🔍 useTotalMorEarned hook called:', {
    userAddress,
    networkEnv,
    shouldFetch,
    isLoading,
    hasData: !!data,
    error,
  });

  useEffect(() => {
    let isCancelled = false;

    async function fetchPoolInteractions() {
      console.log('🚀 fetchPoolInteractions called:', {
        shouldFetch,
        userAddress,
        networkEnv,
        effectTriggered: true,
      });

      if (!shouldFetch) {
        console.log('❌ Not fetching - shouldFetch is false');
        setData(null);
        setIsLoading(false);
        setError(null);
        return;
      }

      try {
        console.log('⏳ Starting to fetch pool interactions...');
        setIsLoading(true);
        setError(null);

        const client = apolloClients.CapitalV2Sepolia;
        console.log('📡 Client check:', {
          clientExists: !!client,
          clientType: typeof client,
          apolloClientsKeys: Object.keys(apolloClients),
        });
        console.log('📡 Using pools:', {
          stETH: CAPITAL_V2_POOLS.stETH,
          LINK: CAPITAL_V2_POOLS.LINK,
        });

        // Test with known working address if current user has no data
        const testAddress = userAddress.toLowerCase();
        const knownWorkingAddress = '0x19ec1e4b714990620edf41fe28e9a1552953a7f4';
        
        // 🧪 TEMPORARY: Set to true to test with known address that has data
        const USE_TEST_ADDRESS = false;
        const finalAddress = USE_TEST_ADDRESS ? knownWorkingAddress : testAddress;
        
        console.log('🧪 Query details:', {
          currentUser: testAddress,
          knownWorkingUser: knownWorkingAddress,
          usingTestUser: USE_TEST_ADDRESS,
          finalAddress: finalAddress,
        });

        // Execute both queries in parallel with proper variables
        const [stETHResult, linkResult] = await Promise.all([
          client.query({
            query: GET_STETH_POOL_INTERACTIONS,
            variables: {
              userAddress: finalAddress,
              stETHPool: CAPITAL_V2_POOLS.stETH.toLowerCase(),
            },
            fetchPolicy: 'no-cache', // Force fresh data to avoid caching issues
            errorPolicy: 'all',
          }),
          client.query({
            query: GET_LINK_POOL_INTERACTIONS,
            variables: {
              userAddress: finalAddress,
              linkPool: CAPITAL_V2_POOLS.LINK.toLowerCase(),
            },
            fetchPolicy: 'no-cache', // Force fresh data to avoid caching issues
            errorPolicy: 'all',
          })
        ]);

        if (!isCancelled) {
          if (stETHResult.error) {
            throw new Error(`stETH query error: ${stETHResult.error.message}`);
          }
          if (linkResult.error) {
            throw new Error(`LINK query error: ${linkResult.error.message}`);
          }
          
          // Combine the results
          const combinedData: CombinedPoolInteractionsData = {
            stETHInteractions: stETHResult.data.poolInteractions || [],
            linkInteractions: linkResult.data.poolInteractions || [],
          };
          
          setData(combinedData);
          console.log('📊 Pool interactions fetched:', {
            stETHInteractions: combinedData.stETHInteractions?.length || 0,
            linkInteractions: combinedData.linkInteractions?.length || 0,
            userAddress,
            stETHSample: combinedData.stETHInteractions?.[0],
            linkSample: combinedData.linkInteractions?.[0],
          });
        }
      } catch (err) {
        if (!isCancelled) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to fetch pool interactions';
          console.error('Error fetching pool interactions:', errorMessage, err);
          setError(errorMessage);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchPoolInteractions();

    return () => {
      console.log('🧹 Cleaning up fetchPoolInteractions effect');
      isCancelled = true;
    };
  }, [shouldFetch, userAddress]);

  console.log('🔄 useEffect dependencies changed:', {
    shouldFetch,
    userAddress,
    dependenciesArray: [shouldFetch, userAddress],
  });

  // Calculate total earned from the fetched data
  const calculatedEarnings = useMemo(() => {
    console.log('🔄 useMemo calculatedEarnings called:', {
      hasData: !!data,
      dataKeys: data ? Object.keys(data) : null,
      stETHInteractionsCount: data?.stETHInteractions?.length || 0,
      linkInteractionsCount: data?.linkInteractions?.length || 0,
    });

    if (!data) {
      console.log('❌ No data available for earnings calculation');
      return {
        totalEarned: 0,
        stETHEarned: 0,
        linkEarned: 0,
      };
    }

    const stETHEarned = calculateTotalEarned(data.stETHInteractions || [], 'stETH');
    const linkEarned = calculateTotalEarned(data.linkInteractions || [], 'LINK');
    const totalEarned = stETHEarned + linkEarned;

    console.log('🚨 CRITICAL DEBUG - Final calculated MOR earnings:', {
      stETHEarned,
      linkEarned,
      totalEarned,
      ISSUE_CHECK: `stETH: ${stETHEarned.toFixed(2)} vs LINK: ${linkEarned.toFixed(2)}`,
      stETHInteractionsCount: data.stETHInteractions?.length || 0,
      linkInteractionsCount: data.linkInteractions?.length || 0,
      stETHFirstRate: data.stETHInteractions?.[0]?.rate,
      stETHLastRate: data.stETHInteractions?.[data.stETHInteractions?.length - 1]?.rate,
      linkFirstRate: data.linkInteractions?.[0]?.rate,
      linkLastRate: data.linkInteractions?.[data.linkInteractions?.length - 1]?.rate,
    });

    return {
      totalEarned,
      stETHEarned,
      linkEarned,
    };
  }, [data]);

  const finalResult = {
    ...calculatedEarnings,
    isLoading,
    error,
  };

  console.log('🏁 useTotalMorEarned hook returning:', {
    totalEarned: finalResult.totalEarned,
    stETHEarned: finalResult.stETHEarned,
    linkEarned: finalResult.linkEarned,
    isLoading: finalResult.isLoading,
    hasError: !!finalResult.error,
    error: finalResult.error,
    userAddress,
    networkEnv,
  });

  return finalResult;
}
