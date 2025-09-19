"use client";

import { useState, useEffect, useMemo } from 'react';
import { apolloClients } from '@/lib/apollo-client';
import { gql } from '@apollo/client';
import { getChainById } from '@/config/networks';

// Generic GraphQL query to get pool interactions for any asset pool
const GET_POOL_INTERACTIONS = gql`
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
`;

interface PoolInteraction {
  blockTimestamp: string;
  rate: string;
  totalStaked: string;
  user: {
    address: string;
  };
}

interface PoolInteractionsData {
  [assetSymbol: string]: PoolInteraction[];
}

export interface AssetEarnings {
  [assetSymbol: string]: number;
}

export interface TotalMorEarnedData {
  totalEarned: number;
  assetEarnings: AssetEarnings;
  // Legacy fields for backward compatibility
  stETHEarned: number;
  linkEarned: number;
  isLoading: boolean;
  error: string | null;
}

/**
 * Get all deposit pool addresses for Capital v2 by network from network configuration
 * Automatically discovers all deposit pools by scanning for contracts ending with "DepositPool"
 */
function getCapitalV2Pools(networkEnv: 'mainnet' | 'testnet') {
  // Get network chain configuration (using sepolia for testnet, mainnet for mainnet)
  const chainId = networkEnv === 'testnet' ? 11155111 : 1; // Sepolia : Ethereum mainnet
  const chainConfig = getChainById(chainId, networkEnv);
  
  if (!chainConfig?.contracts) {
    console.warn(`No chain config found for ${networkEnv}`);
    return {};
  }
  
  const pools: Record<string, string> = {};
  
  // Dynamically discover all deposit pools by scanning contract names
  Object.entries(chainConfig.contracts).forEach(([contractName, contract]) => {
    if (contractName.endsWith('DepositPool') && contract?.address) {
      // Extract asset symbol from contract name (e.g., "stETHDepositPool" -> "stETH")
      const assetSymbol = contractName.replace('DepositPool', '');
      pools[assetSymbol] = contract.address;
    }
  });
  
  console.log(`🏗️ Built pool configuration for ${networkEnv}:`, {
    discoveredPools: Object.keys(pools),
    pools,
    totalPoolsFound: Object.keys(pools).length
  });
  
  return pools;
}

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
  const [data, setData] = useState<PoolInteractionsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch data for users with addresses on both networks
  const shouldFetch = userAddress && (networkEnv === 'testnet' || networkEnv === 'mainnet');

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

        // Select GraphQL client based on network environment
        const client = networkEnv === 'testnet' ? apolloClients.CapitalV2Sepolia : apolloClients.CapitalV2Sepolia; // TODO: Add mainnet capital endpoint when available
        console.log('📡 Client check:', {
          networkEnv,
          clientExists: !!client,
          clientType: typeof client,
          apolloClientsKeys: Object.keys(apolloClients),
          note: networkEnv === 'mainnet' ? 'Using testnet endpoint temporarily for mainnet (TODO: Add mainnet capital GraphQL endpoint)' : 'Using testnet endpoint'
        });
        const currentPools = getCapitalV2Pools(networkEnv);
        console.log('📡 Using pools:', {
          networkEnv,
          availablePools: Object.keys(currentPools),
          pools: currentPools,
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

        // Execute queries for all discovered pools dynamically
        const queryPromises = Object.entries(currentPools).map(([assetSymbol, poolAddress]) =>
          client.query({
            query: GET_POOL_INTERACTIONS,
            variables: {
              userAddress: finalAddress,
              poolAddress: poolAddress.toLowerCase(),
            },
            fetchPolicy: 'no-cache', // Force fresh data to avoid caching issues
            errorPolicy: 'all',
          }).then(result => ({ assetSymbol, result }))
        );

        // Execute all available queries
        const results = await Promise.all(queryPromises);
        
        if (!isCancelled) {
          // Check for errors and process results
          const poolInteractionsData: PoolInteractionsData = {};
          
          for (const { assetSymbol, result } of results) {
            if (result.error) {
              throw new Error(`${assetSymbol} pool query error: ${result.error.message}`);
            }
            
            poolInteractionsData[assetSymbol] = result.data?.poolInteractions || [];
          }
          
          setData(poolInteractionsData);
          console.log('📊 Pool interactions fetched:', {
            discoveredAssets: Object.keys(poolInteractionsData),
            interactionCounts: Object.fromEntries(
              Object.entries(poolInteractionsData).map(([asset, interactions]) => [
                asset, interactions.length
              ])
            ),
            userAddress,
            sampleData: Object.fromEntries(
              Object.entries(poolInteractionsData).map(([asset, interactions]) => [
                asset, interactions[0] || null
              ])
            ),
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
      assetCounts: data ? Object.fromEntries(
        Object.entries(data).map(([asset, interactions]) => [asset, interactions.length])
      ) : null,
    });

    if (!data) {
      console.log('❌ No data available for earnings calculation');
      return {
        totalEarned: 0,
        assetEarnings: {},
        stETHEarned: 0,
        linkEarned: 0,
      };
    }

    // Calculate earnings for each discovered asset
    const assetEarnings: AssetEarnings = {};
    let totalEarned = 0;

    Object.entries(data).forEach(([assetSymbol, interactions]) => {
      const earned = calculateTotalEarned(interactions || [], assetSymbol);
      assetEarnings[assetSymbol] = earned;
      totalEarned += earned;
    });

    // Maintain backward compatibility with legacy fields
    const stETHEarned = assetEarnings.stETH || 0;
    const linkEarned = assetEarnings.LINK || 0;

    console.log('🚨 CRITICAL DEBUG - Final calculated MOR earnings:', {
      assetEarnings,
      totalEarned,
      discoveredAssets: Object.keys(assetEarnings),
      // Legacy compatibility debug
      stETHEarned,
      linkEarned,
      ISSUE_CHECK: `Total from ${Object.keys(assetEarnings).length} assets: ${totalEarned.toFixed(2)}`,
      detailedBreakdown: Object.fromEntries(
        Object.entries(assetEarnings).map(([asset, earned]) => [
          asset, `${earned.toFixed(2)} MOR`
        ])
      ),
    });

    return {
      totalEarned,
      assetEarnings,
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
    assetEarnings: finalResult.assetEarnings,
    discoveredAssets: Object.keys(finalResult.assetEarnings),
    // Legacy compatibility
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
