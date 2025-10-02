"use client";

import { useState, useEffect, useMemo } from 'react';
import { gql } from '@apollo/client';
import { print } from 'graphql';
import { getChainById } from '@/config/networks';

// Query to get user claim events from PoolInteractions
// Since User.claimed may not exist in the current subgraph, we'll sum claim events
const GET_USER_ALL_CLAIM_EVENTS = gql`
  query GetUserAllClaimEvents($userAddress: Bytes!) {
    poolInteractions(
      where: {
        user_: { address: $userAddress }
        type: 2  # Claim events
        depositPool_in: [
          "0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790",  # stETH
          "0xdE283F8309Fd1AA46c95d299f6B8310716277A42",  # wBTC
          "0x9380d72aBbD6e0Cc45095A2Ef8c2CA87d77Cb384",  # wETH
          "0x6cCE082851Add4c535352f596662521B4De4750E",  # USDC
          "0x3B51989212BEdaB926794D6bf8e9E991218cf116"   # USDT
        ]
      }
      orderBy: blockTimestamp
      orderDirection: desc
    ) {
      id
      amount
      blockTimestamp
      blockNumber
      transactionHash
      type
      user {
        address
        rewardPoolId
      }
      depositPool
      totalStaked
      rate
    }
  }
`;

interface ClaimEventData {
  id: string;
  amount: string;
  blockTimestamp: string;
  blockNumber: string;
  transactionHash: string;
  type: string;
  user: {
    address: string;
    rewardPoolId: string;
  };
  depositPool: string;
  totalStaked: string;
  rate: string;
}

interface UserClaimEventsData {
  [assetSymbol: string]: ClaimEventData[];
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
function calculateTotalEarned(claimEvents: ClaimEventData[], poolName?: string): number {
  console.log(`🧮 calculateTotalEarned called for ${poolName}:`, {
    poolName,
    claimEventsCount: claimEvents?.length || 0,
    claimEvents: claimEvents?.slice(0, 3), // Log first 3 claim events for debugging
  });

  if (!claimEvents || claimEvents.length === 0) {
    console.log('❌ No claim events to calculate from');
    return 0;
  }

  // Sum all claim amounts (each claim event represents MOR claimed)
  const totalClaimedWei = claimEvents.reduce((sum, event) => {
    return sum + BigInt(event.amount || '0');
  }, BigInt(0));

  // Convert from wei (18 decimals) to MOR tokens
  const totalEarned = Number(totalClaimedWei) / Math.pow(10, 18);

  console.log(`💰 Claimed calculation for ${poolName}:`, {
    poolName,
    claimEventsCount: claimEvents.length,
    totalClaimedWei: totalClaimedWei.toString(),
    calculatedEarned: totalEarned,
    decimalScale: 18,
    reason: 'Sum of all claim event amounts in wei (18 decimals)',
    individualClaims: claimEvents.map(event => ({
      amount: event.amount,
      timestamp: event.blockTimestamp,
      morAmount: Number(BigInt(event.amount || '0')) / Math.pow(10, 18)
    })),
    finalResult: Math.max(0, totalEarned)
  });

  return Math.max(0, totalEarned);
}

/**
 * Hook to fetch and calculate total MOR earned from Capital v2 subgraph
 * Works on both mainnet and testnet using the same /api/capital endpoint as the chart
 */
export function useTotalMorEarned(
  userAddress: string | null,
  networkEnv: 'mainnet' | 'testnet'
): TotalMorEarnedData {
  const [data, setData] = useState<UserClaimEventsData | null>(null);
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

        // Execute single query to get all claim events across all pools
        const queryString = print(GET_USER_ALL_CLAIM_EVENTS);
        const response = await fetch('/api/capital', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: queryString,
            variables: {
              userAddress: finalAddress,
            },
            networkEnv,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error: ${response.status} ${errorText}`);
        }

        const result = await response.json();

        if (!isCancelled) {
          if (result.errors) {
            throw new Error(`Claim events query error: ${result.errors[0]?.message}`);
          }

          // Process the single response with all claim events
          const allClaimEvents = result.data?.poolInteractions || [];

          // Group events by deposit pool for backward compatibility with existing data structure
          const userClaimEventsData: UserClaimEventsData = {};

          // Initialize with empty arrays for all known pools
          const poolAddresses = [
            "0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790", // stETH
            "0xdE283F8309Fd1AA46c95d299f6B8310716277A42", // wBTC
            "0x9380d72aBbD6e0Cc45095A2Ef8c2CA87d77Cb384", // wETH
            "0x6cCE082851Add4c535352f596662521B4De4750E", // USDC
            "0x3B51989212BEdaB926794D6bf8e9E991218cf116"  // USDT
          ];

          poolAddresses.forEach(poolAddress => {
            userClaimEventsData[poolAddress] = allClaimEvents.filter(event => event.depositPool === poolAddress);
          });

          setData(userClaimEventsData);
          console.log('📊 User claim events fetched:', {
            totalEvents: allClaimEvents.length,
            eventsByPool: Object.fromEntries(
              Object.entries(userClaimEventsData).map(([pool, events]) => [
                pool, events.length
              ])
            ),
            userAddress,
            sampleEvent: allClaimEvents[0] || null,
          });
        }
      } catch (err) {
        if (!isCancelled) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to fetch user claimed rewards';
          console.error('Error fetching user claimed rewards:', errorMessage, err);
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
  }, [shouldFetch, userAddress, networkEnv]);

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
        Object.entries(data).map(([asset, events]) => [asset, events.length])
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

    // Sum all claim events across all pools
    const allClaimEvents = Object.values(data).flat();
    console.log('📊 Total claim events across all pools:', allClaimEvents.length);

    if (allClaimEvents.length === 0) {
      console.log('❌ No claim events found');
      return {
        totalEarned: 0,
        assetEarnings: {},
        stETHEarned: 0,
        linkEarned: 0,
      };
    }

    // Sum all claim amounts (each claim event represents MOR claimed)
    const totalClaimedWei = allClaimEvents.reduce((sum, event) => {
      return sum + BigInt(event.amount || '0');
    }, BigInt(0));

    // Convert from wei (18 decimals) to MOR tokens
    const totalEarned = Number(totalClaimedWei) / Math.pow(10, 18);

    // Calculate earnings per pool for backward compatibility
    const assetEarnings: AssetEarnings = {};
    Object.entries(data).forEach(([poolAddress, claimEvents]) => {
      if (claimEvents && claimEvents.length > 0) {
        const poolEarned = calculateTotalEarned(claimEvents, poolAddress);
        // Map pool address to asset symbol for backward compatibility
        if (poolAddress === "0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790") {
          assetEarnings.stETH = poolEarned;
        } else if (poolAddress === "0xdE283F8309Fd1AA46c95d299f6B8310716277A42") {
          assetEarnings.wBTC = poolEarned;
        } else if (poolAddress === "0x9380d72aBbD6e0Cc45095A2Ef8c2CA87d77Cb384") {
          assetEarnings.wETH = poolEarned;
        } else if (poolAddress === "0x6cCE082851Add4c535352f596662521B4De4750E") {
          assetEarnings.USDC = poolEarned;
        } else if (poolAddress === "0x3B51989212BEdaB926794D6bf8e9E991218cf116") {
          assetEarnings.USDT = poolEarned;
        }
      }
    });

    // Maintain backward compatibility with legacy fields
    const stETHEarned = assetEarnings.stETH || 0;
    const linkEarned = assetEarnings.LINK || 0; // Note: LINK not included in current pools

    console.log('🚨 CRITICAL DEBUG - Final calculated MOR earnings:', {
      totalClaimedWei: totalClaimedWei.toString(),
      totalEarned,
      totalEvents: allClaimEvents.length,
      assetEarnings,
      discoveredAssets: Object.keys(assetEarnings),
      // Legacy compatibility debug
      stETHEarned,
      linkEarned,
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
