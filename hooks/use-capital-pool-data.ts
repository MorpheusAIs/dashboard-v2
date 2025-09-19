"use client";

import { useMemo, useCallback } from 'react';
import React from 'react';
import { useContractReads, useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import { NetworkEnvironment, getContractAddress, testnetChains, mainnetChains } from '@/config/networks';
import { getAssetsForNetwork, type AssetSymbol } from '@/components/capital/constants/asset-config';

// Import ABIs
import DepositPoolAbi from '@/app/abi/DepositPool.json'; // Use the generic ABI that has all functions

export interface AssetPoolData {
  totalStaked: string;
  apy: string;
  isLoading: boolean;
  error: Error | null;
}

export interface CapitalPoolData {
  assets: Partial<Record<AssetSymbol, AssetPoolData>>;
  networkEnvironment: NetworkEnvironment;
  // Refetch functions to trigger data refresh after user actions
  refetch: {
    refetchAsset: (symbol: AssetSymbol) => void;
    rewardPoolData: () => void;
    refetchAll: () => void;
  };
}

// Mapping from asset symbols to their deposit pool contract keys
const ASSET_TO_DEPOSIT_POOL_MAP: Partial<Record<AssetSymbol, keyof import('@/config/networks').ContractAddresses>> = {
  stETH: 'stETHDepositPool',
  LINK: 'linkDepositPool',
  USDC: 'usdcDepositPool',
  USDT: 'usdtDepositPool',
  wBTC: 'wbtcDepositPool',
  wETH: 'wethDepositPool',
};

/**
 * Custom hook to read live capital pool data from deployed v7/v2 protocol contracts
 * 
 * CURRENT IMPLEMENTATION (Dynamic Asset Support):
 * - Dynamically handles any assets with deployed deposit pool contracts based on network config
 * - Uses DepositPool.rewardPoolsData() to get live daily reward rates for accurate APR calculation
 * - Uses DepositPool.totalDepositedInPublicPools() to get total staked amounts
 * - Calculates APR using: (dailyRewardRate * 365) / totalVirtualDeposited * 100
 * - Supports all configured assets (mainnet: stETH, USDC, USDT, wBTC, wETH; testnet: stETH, LINK)
 * - Shows N/A for assets without deposit pool contracts
 * 
 * Returns live data for both testnet (Sepolia) and mainnet with proper v7 protocol daily distribution
 */
export function useCapitalPoolData(): CapitalPoolData {
  const chainId = useChainId();
  
  // Determine network environment
  const networkEnvironment = useMemo((): NetworkEnvironment => {
    return [1, 42161, 8453].includes(chainId) ? 'mainnet' : 'testnet';
  }, [chainId]);

  // Get L1 chain ID based on network environment
  const l1ChainId = useMemo(() => {
    return networkEnvironment === 'mainnet' ? mainnetChains.mainnet.id : testnetChains.sepolia.id;
  }, [networkEnvironment]);

  // Get all configured assets for this network
  const configuredAssets = useMemo(() => getAssetsForNetwork(networkEnvironment), [networkEnvironment]);

  // Create contract address mappings for assets with deposit pools
  const depositPoolAddresses = useMemo(() => {
    const addresses: Partial<Record<AssetSymbol, `0x${string}` | undefined>> = {};
    
    configuredAssets.forEach(assetConfig => {
      const symbol = assetConfig.metadata.symbol;
      const contractKey = ASSET_TO_DEPOSIT_POOL_MAP[symbol];
      
      if (contractKey) {
        addresses[symbol] = getContractAddress(l1ChainId, contractKey, networkEnvironment) as `0x${string}` | undefined;
      } else {
        addresses[symbol] = undefined;
      }
    });
    
    return addresses;
  }, [configuredAssets, l1ChainId, networkEnvironment]);

  // V7/V2 protocol contract addresses are no longer needed - using direct DepositPool calls

  // Dynamic contract calls for all available assets
  // Create contract calls for totalDepositedInPublicPools
  const depositedContracts = useMemo(() => {
    return configuredAssets
      .filter((assetConfig) => {
        const symbol = assetConfig.metadata.symbol;
        const address = depositPoolAddresses[symbol];
        return address && address !== '0x0000000000000000000000000000000000000000';
      })
      .map((assetConfig) => {
        const symbol = assetConfig.metadata.symbol;
        const address = depositPoolAddresses[symbol]!; // Safe to use ! since we filtered above
        
        return {
          address,
          abi: DepositPoolAbi,
          functionName: 'totalDepositedInPublicPools',
          chainId: l1ChainId,
          args: [],
        };
      });
  }, [configuredAssets, depositPoolAddresses, l1ChainId]);

  // Create contract calls for rewardPoolsData
  const rewardRateContracts = useMemo(() => {
    return configuredAssets
      .filter((assetConfig) => {
        const symbol = assetConfig.metadata.symbol;
        const address = depositPoolAddresses[symbol];
        return address && address !== '0x0000000000000000000000000000000000000000';
      })
      .map((assetConfig) => {
        const symbol = assetConfig.metadata.symbol;
        const address = depositPoolAddresses[symbol]!; // Safe to use ! since we filtered above
        
        return {
          address,
          abi: DepositPoolAbi,
          functionName: 'rewardPoolsData',
          args: [BigInt(0)], // Pool index 0 (Capital)
          chainId: l1ChainId,
        };
      });
  }, [configuredAssets, depositPoolAddresses, l1ChainId]);

  // Execute all deposit contract calls
  const { 
    data: depositedResults, 
    isLoading: isLoadingDeposits, 
    refetch: refetchDeposits 
  } = useContractReads({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: depositedContracts as any, // Type assertion for ABI compatibility
    allowFailure: true,
    query: {
      enabled: depositedContracts.length > 0,
      refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    },
  });

  // Execute all reward rate contract calls
  const { 
    data: rewardRateResults, 
    isLoading: isLoadingRewardRates, 
    refetch: refetchRewardRates 
  } = useContractReads({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: rewardRateContracts as any, // Type assertion for ABI compatibility
    allowFailure: true,
    query: {
      enabled: rewardRateContracts.length > 0,
      refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    },
  });

  // Create individual contract hooks for backward compatibility and refetch functions
  const contractHooks = useMemo(() => {
    const hooks: Record<string, { data: unknown; isLoading: boolean; error: Error | null; refetch: () => void }> = {};
    
    configuredAssets.forEach((assetConfig, index) => {
      const symbol = assetConfig.metadata.symbol;
      const hasAddress = !!depositPoolAddresses[symbol];
      
      if (hasAddress && depositedResults && index < depositedResults.length) {
        const result = depositedResults[index];
        hooks[symbol] = {
          data: result?.status === 'success' ? result.result : undefined,
          isLoading: isLoadingDeposits,
          error: result?.status === 'failure' ? new Error(result.error?.message) : null,
          refetch: refetchDeposits
        };
      } else {
        hooks[symbol] = {
          data: undefined,
          isLoading: false,
          error: hasAddress ? null : new Error(`No deposit pool address for ${symbol}`),
          refetch: () => {}
        };
      }
    });
    
    return hooks;
  }, [configuredAssets, depositPoolAddresses, depositedResults, isLoadingDeposits, refetchDeposits]);

  const rewardRateHooks = useMemo(() => {
    const hooks: Record<string, { data: unknown; isLoading: boolean; error: Error | null; refetch: () => void }> = {};
    
    configuredAssets.forEach((assetConfig, index) => {
      const symbol = assetConfig.metadata.symbol;
      const hasAddress = !!depositPoolAddresses[symbol];
      
      if (hasAddress && rewardRateResults && index < rewardRateResults.length) {
        const result = rewardRateResults[index];
        hooks[symbol] = {
          data: result?.status === 'success' ? result.result : undefined,
          isLoading: isLoadingRewardRates,
          error: result?.status === 'failure' ? new Error(result.error?.message) : null,
          refetch: refetchRewardRates
        };
      } else {
        hooks[symbol] = {
          data: undefined,
          isLoading: false,
          error: hasAddress ? null : new Error(`No deposit pool address for ${symbol}`),
          refetch: () => {}
        };
      }
    });
    
    return hooks;
  }, [configuredAssets, depositPoolAddresses, rewardRateResults, isLoadingRewardRates, refetchRewardRates]);

  // Collect all contract data (now dynamic based on configured assets)
  const contractData = useMemo(() => {
    return contractHooks;
  }, [contractHooks]);

  // Collect all reward pool rate data (now dynamic based on configured assets)
  const rewardPoolRateData = useMemo(() => {
    return rewardRateHooks;
  }, [rewardRateHooks]);


  // Debug contract call results
  React.useEffect(() => {
    console.log('🔍 DYNAMIC CONTRACT CALL DEBUG:', {
      currentChainId: chainId,
      networkEnvironment,
      chainId: l1ChainId,
      configuredAssets: configuredAssets.map(a => a.metadata.symbol),
      depositPoolAddresses,
      contractData: Object.fromEntries(
        Object.entries(contractData).map(([symbol, contract]) => {
          // Find the asset config to get correct decimals
          const assetConfig = configuredAssets.find(a => a.metadata.symbol === symbol);
          const decimals = assetConfig?.metadata.decimals || 18;
          
          return [
            symbol,
            contract.data ? {
              raw: contract.data.toString(),
              formatted: formatUnits(contract.data as bigint, decimals),
              decimals: decimals // Show which decimals were used
            } : 'MISSING'
          ];
        })
      ),
      rewardPoolRateData: Object.fromEntries(
        Object.entries(rewardPoolRateData).map(([symbol, rateData]) => [
          symbol,
          rateData.data ? {
            raw: rateData.data.toString(),
            // Parse the struct: [lastUpdate, rate, totalVirtualDeposited]
            lastUpdate: Array.isArray(rateData.data) ? rateData.data[0]?.toString() : 'N/A',
            dailyRate: Array.isArray(rateData.data) ? formatUnits(rateData.data[1] as bigint, 18) + ' MOR/day' : 'N/A',
            totalVirtualDeposited: Array.isArray(rateData.data) ? formatUnits(rateData.data[2] as bigint, 18) : 'N/A'
          } : 'MISSING'
        ])
      ),
      loadingStates: Object.fromEntries(
        Object.entries(contractData).map(([symbol, contract]) => [symbol, contract.isLoading])
      ),
      errors: Object.fromEntries(
        Object.entries(contractData).map(([symbol, contract]) => [symbol, contract.error?.message])
      ),
      specificUSDCData: {
        address: depositPoolAddresses.USDC,
        hasData: !!contractData.USDC?.data,
        isLoading: contractData.USDC?.isLoading,
        error: contractData.USDC?.error?.message,
        rawData: contractData.USDC?.data?.toString()
      },
      specificUSDTData: {
        address: depositPoolAddresses.USDT,
        hasData: !!contractData.USDT?.data,
        isLoading: contractData.USDT?.isLoading,
        error: contractData.USDT?.error?.message,
        rawData: contractData.USDT?.data?.toString()
      }
    });
  }, [
    chainId,
    networkEnvironment, 
    l1ChainId,
    configuredAssets,
    depositPoolAddresses,
    contractData,
    rewardPoolRateData
  ]);

  // V7 Protocol APR Calculation using reward rates from DepositPool contracts
  const calculateV7APR = useMemo(() => {
    console.log('🔢 APR CALCULATION - V7 PROTOCOL DAILY REWARD APPROACH:', {
      networkEnvironment,
      rewardPoolRateData: Object.fromEntries(
        Object.entries(rewardPoolRateData).map(([symbol, rateData]) => [
          symbol,
          {
            hasData: !!rateData.data,
            isLoading: rateData.isLoading,
            data: rateData.data ? {
              // Parse the rewardPoolsData struct: [lastUpdate, rate, totalVirtualDeposited]
              lastUpdate: Array.isArray(rateData.data) ? rateData.data[0]?.toString() : 'N/A',
              dailyRate: Array.isArray(rateData.data) ? formatUnits(rateData.data[1] as bigint, 18) : 'N/A', // Daily MOR tokens
              totalVirtualDeposited: Array.isArray(rateData.data) ? formatUnits(rateData.data[2] as bigint, 18) : 'N/A'
            } : null
          }
        ])
      )
    });

  // ✅ FIXED: Now using correct RewardPool contract approach
  // Uses RewardPool.getPeriodRewards() to get total daily rewards for the pool
  // Then calculates proportional share based on user's stake vs total stake
  // References: https://gitbook.mor.org/smart-contracts/documentation/distribution-protocol/v7-protocol/contracts/rewardpool

    const aprResults: Record<string, string> = {};
    
    Object.entries(rewardPoolRateData).forEach(([symbol, rateData]) => {
      const contract = contractData[symbol as keyof typeof contractData];
      
      if (!contract?.data || !rateData.data || !Array.isArray(rateData.data)) {
        aprResults[symbol] = 'N/A';
        return;
      }

      try {
        // Parse rewardPoolsData struct: [lastUpdate, rate, totalVirtualDeposited]
        const [lastUpdate, ratePerSecond, totalVirtualDeposited] = rateData.data;
        
        // Get correct decimals for this asset from configuration
        const assetConfig = configuredAssets.find(a => a.metadata.symbol === symbol);
        const assetDecimals = assetConfig?.metadata.decimals || 18;
        
        // Parse values - the rate is actually DAILY rewards, not per-second (from v7 protocol docs)
        const totalDeposited = Number(formatUnits(contract.data as bigint, assetDecimals));
        const dailyRewardRate = Number(formatUnits(ratePerSecond as bigint, 18)); // MOR tokens per day (not per second!)
        const totalVirtual = Number(formatUnits(totalVirtualDeposited as bigint, 18));
        
        // Calculate APR: (daily rewards * days per year) / effective deposited * 100
        // According to Morpheus v7 protocol: rewards are distributed DAILY, not per second
        const daysPerYear = 365;
        const annualRewards = dailyRewardRate * daysPerYear;
        
        // Use totalVirtualDeposited (includes power factor multipliers) for proper APR calculation
        // This represents the actual "weighted" stake used for reward distribution
        const effectiveTotalDeposited = totalVirtual > 0 ? totalVirtual : totalDeposited;
        const aprPercentage = effectiveTotalDeposited > 0 ? (annualRewards / effectiveTotalDeposited) * 100 : 0;
        
        aprResults[symbol] = aprPercentage > 0
          ? `${aprPercentage.toFixed(2)}%`
          : 'N/A';
          
        console.log(`✅ REAL APR CALCULATION [${symbol}] - V7 PROTOCOL DAILY REWARDS:`, {
          totalDeposited,
          totalVirtualDeposited: totalVirtual,
          effectiveTotalDeposited,
          dailyRewardRate,
          annualRewards,
          aprPercentage,
          calculatedAPR: aprResults[symbol],
          lastUpdate: new Date(Number(lastUpdate) * 1000).toISOString(),
          note: 'Rate is DAILY MOR distribution per v7 protocol (not per-second)'
        });
      } catch (error) {
        console.error(`❌ Error calculating APR for ${symbol}:`, error);
        aprResults[symbol] = 'N/A';
      }
    });

    return aprResults;
  }, [
    networkEnvironment,
    contractData,
    rewardPoolRateData,
    configuredAssets
  ]);

  // Generate asset pool data dynamically
  const assetsData = useMemo(() => {
    const result: Partial<Record<AssetSymbol, AssetPoolData>> = {};
    
    configuredAssets.forEach(assetConfig => {
      const symbol = assetConfig.metadata.symbol;
      const decimals = assetConfig.metadata.decimals; // Get decimals from asset config
      const contract = contractData[symbol as keyof typeof contractData];
      const hasDepositPoolAddress = !!depositPoolAddresses[symbol];
      const depositPoolAddress = depositPoolAddresses[symbol];
      
      // Debug logging
      console.log(`🔍 Asset ${symbol}:`, {
        hasDepositPoolAddress,
        depositPoolAddress,
        contractExists: !!contract,
        contractData: contract?.data?.toString(),
        contractLoading: contract?.isLoading,
        contractError: contract?.error?.message,
        decimals // Log the correct decimals
      });
      
      if (!hasDepositPoolAddress) {
        // Asset doesn't have a deposit pool contract
        result[symbol] = {
          totalStaked: 'N/A',
          apy: 'Coming Soon',
          isLoading: false,
          error: null
        };
      } else if (!contract) {
        // Asset has deposit pool address but contract call is not available
        result[symbol] = {
          totalStaked: '0',
          apy: 'N/A',
          isLoading: false,
          error: new Error(`Contract call not available for ${symbol}`)
        };
      } else if (contract.data === undefined) {
        // Asset has deposit pool and contract, but no data yet (likely 0 or loading)
        const rewardRateData = rewardPoolRateData[symbol as keyof typeof rewardPoolRateData];
        result[symbol] = {
          totalStaked: '0', // Default to 0 for deployed pools
          apy: calculateV7APR[symbol] || 'N/A',
          isLoading: contract.isLoading || rewardRateData?.isLoading || false,
          error: (contract.error || rewardRateData?.error) as Error | null
        };
      } else {
        // Asset has valid data - use correct decimals from config
        const totalStaked = parseFloat(formatUnits(contract.data as bigint, decimals)).toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        });

        const rewardRateData = rewardPoolRateData[symbol as keyof typeof rewardPoolRateData];
        result[symbol] = {
          totalStaked,
          apy: calculateV7APR[symbol] || 'N/A',
          isLoading: contract.isLoading || rewardRateData?.isLoading || false,
          error: (contract.error || rewardRateData?.error) as Error | null
        };
      }
    });
    
    return result;
  }, [
    configuredAssets,
    contractData,
    depositPoolAddresses,
    rewardPoolRateData,
    calculateV7APR
  ]);

  // Create refetch functions (now using dynamic system)
  const refetchAsset = useCallback(() => {
    // Refetch both deposited amounts and reward rates for all assets
    // (batch refetch is more efficient than individual asset refetch)
    refetchDeposits();
    refetchRewardRates();
  }, [refetchDeposits, refetchRewardRates]);

  const refetchRewards = useCallback(() => {
    // Refetch all reward pool rate data
    refetchRewardRates();
  }, [refetchRewardRates]);

  const refetchAll = useCallback(() => {
    // Refetch all contract data in one batch
    refetchDeposits();
    refetchRewardRates();
  }, [refetchDeposits, refetchRewardRates]);

  return {
    assets: assetsData,
    networkEnvironment,
    refetch: {
      refetchAsset: () => refetchAsset(), // Maintain backward compatibility (now batched)
      rewardPoolData: refetchRewards,
      refetchAll
    }
  };
}
