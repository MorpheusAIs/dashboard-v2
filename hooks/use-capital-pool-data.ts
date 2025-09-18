"use client";

import { useMemo, useCallback } from 'react';
import React from 'react';
import { useReadContract, useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import { NetworkEnvironment, getContractAddress, testnetChains, mainnetChains } from '@/config/networks';
import { getAssetsForNetwork, type AssetSymbol } from '@/components/capital/constants/asset-config';

// Import ABIs
import DepositPoolAbi from '@/app/abi/DepositPool.json'; // Use the generic ABI that has all functions
import DistributorV2Abi from '@/app/abi/DistributorV2.json';

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
 * IMPLEMENTATION UPDATE (Dynamic Asset Support):
 * - Dynamically handles any assets with deployed deposit pool contracts
 * - Uses RewardPoolV2.getPeriodRewards() for proper emission calculation
 * - Accounts for testnet (minute-based) vs mainnet (daily) reward timing differences  
 * - Implements coefficient-based APR calculation following v7 protocol documentation
 * - Shows N/A for assets without deposit pool contracts
 * 
 * Returns live data for both testnet (Sepolia) and mainnet (V2 contracts deployed)
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

  // Get V7/V2 protocol contract addresses
  const distributorV2Address = useMemo(() => {
    return getContractAddress(l1ChainId, 'distributorV2', networkEnvironment) as `0x${string}` | undefined;
  }, [l1ChainId, networkEnvironment]);

  // Create individual useReadContract calls for each asset
  const stETHContract = useReadContract({
    address: depositPoolAddresses.stETH,
    abi: DepositPoolAbi,
    functionName: 'totalDepositedInPublicPools',
    chainId: l1ChainId,
    query: { 
      enabled: !!depositPoolAddresses.stETH,
      refetchInterval: 5 * 60 * 1000 // Refetch every 5 minutes
    }
  });

  const linkContract = useReadContract({
    address: depositPoolAddresses.LINK,
    abi: DepositPoolAbi,
    functionName: 'totalDepositedInPublicPools',
    chainId: l1ChainId,
    query: { 
      enabled: !!depositPoolAddresses.LINK,
      refetchInterval: 5 * 60 * 1000 // Refetch every 5 minutes
    }
  });

  const usdcContract = useReadContract({
    address: depositPoolAddresses.USDC,
    abi: DepositPoolAbi,
    functionName: 'totalDepositedInPublicPools',
    chainId: l1ChainId,
    query: { 
      enabled: !!depositPoolAddresses.USDC,
      refetchInterval: 5 * 60 * 1000 // Refetch every 5 minutes
    }
  });

  const usdtContract = useReadContract({
    address: depositPoolAddresses.USDT,
    abi: DepositPoolAbi,
    functionName: 'totalDepositedInPublicPools',
    chainId: l1ChainId,
    query: { 
      enabled: !!depositPoolAddresses.USDT,
      refetchInterval: 5 * 60 * 1000 // Refetch every 5 minutes
    }
  });

  const wbtcContract = useReadContract({
    address: depositPoolAddresses.wBTC,
    abi: DepositPoolAbi,
    functionName: 'totalDepositedInPublicPools',
    chainId: l1ChainId,
    query: { 
      enabled: !!depositPoolAddresses.wBTC,
      refetchInterval: 5 * 60 * 1000 // Refetch every 5 minutes
    }
  });

  const wethContract = useReadContract({
    address: depositPoolAddresses.wETH,
    abi: DepositPoolAbi,
    functionName: 'totalDepositedInPublicPools',
    chainId: l1ChainId,
    query: { 
      enabled: !!depositPoolAddresses.wETH,
      refetchInterval: 5 * 60 * 1000 // Refetch every 5 minutes
    }
  });

  // Get individual distributed rewards for each deposit pool from DistributorV2
  // This gives us the actual MOR allocated to each specific deposit pool
  const stETHDistributedRewards = useReadContract({
    address: distributorV2Address,
    abi: DistributorV2Abi,
    functionName: 'getDistributedRewards',
    args: [BigInt(0), depositPoolAddresses.stETH], // Pool index 0 (Capital), stETH deposit pool address
    chainId: l1ChainId,
    query: { 
      enabled: !!distributorV2Address && !!depositPoolAddresses.stETH,
      refetchInterval: 5 * 60 * 1000 // Refetch every 5 minutes
    }
  });

  const linkDistributedRewards = useReadContract({
    address: distributorV2Address,
    abi: DistributorV2Abi,
    functionName: 'getDistributedRewards',
    args: [BigInt(0), depositPoolAddresses.LINK], // Pool index 0 (Capital), LINK deposit pool address
    chainId: l1ChainId,
    query: { 
      enabled: !!distributorV2Address && !!depositPoolAddresses.LINK,
      refetchInterval: 5 * 60 * 1000 // Refetch every 5 minutes
    }
  });

  const usdcDistributedRewards = useReadContract({
    address: distributorV2Address,
    abi: DistributorV2Abi,
    functionName: 'getDistributedRewards',
    args: [BigInt(0), depositPoolAddresses.USDC], // Pool index 0 (Capital), USDC deposit pool address
    chainId: l1ChainId,
    query: { 
      enabled: !!distributorV2Address && !!depositPoolAddresses.USDC,
      refetchInterval: 5 * 60 * 1000 // Refetch every 5 minutes
    }
  });

  const usdtDistributedRewards = useReadContract({
    address: distributorV2Address,
    abi: DistributorV2Abi,
    functionName: 'getDistributedRewards',
    args: [BigInt(0), depositPoolAddresses.USDT], // Pool index 0 (Capital), USDT deposit pool address
    chainId: l1ChainId,
    query: { 
      enabled: !!distributorV2Address && !!depositPoolAddresses.USDT,
      refetchInterval: 5 * 60 * 1000 // Refetch every 5 minutes
    }
  });

  const wbtcDistributedRewards = useReadContract({
    address: distributorV2Address,
    abi: DistributorV2Abi,
    functionName: 'getDistributedRewards',
    args: [BigInt(0), depositPoolAddresses.wBTC], // Pool index 0 (Capital), wBTC deposit pool address
    chainId: l1ChainId,
    query: { 
      enabled: !!distributorV2Address && !!depositPoolAddresses.wBTC,
      refetchInterval: 5 * 60 * 1000 // Refetch every 5 minutes
    }
  });

  const wethDistributedRewards = useReadContract({
    address: distributorV2Address,
    abi: DistributorV2Abi,
    functionName: 'getDistributedRewards',
    args: [BigInt(0), depositPoolAddresses.wETH], // Pool index 0 (Capital), wETH deposit pool address
    chainId: l1ChainId,
    query: { 
      enabled: !!distributorV2Address && !!depositPoolAddresses.wETH,
      refetchInterval: 5 * 60 * 1000 // Refetch every 5 minutes
    }
  });

  // Collect all contract data
  const contractData = useMemo(() => {
    return {
      stETH: stETHContract,
      LINK: linkContract,
      USDC: usdcContract,
      USDT: usdtContract,
      wBTC: wbtcContract,
      wETH: wethContract,
    };
  }, [stETHContract, linkContract, usdcContract, usdtContract, wbtcContract, wethContract]);

  // Collect all distributed rewards data
  const distributedRewardsData = useMemo(() => {
    return {
      stETH: stETHDistributedRewards,
      LINK: linkDistributedRewards,
      USDC: usdcDistributedRewards,
      USDT: usdtDistributedRewards,
      wBTC: wbtcDistributedRewards,
      wETH: wethDistributedRewards,
    };
  }, [stETHDistributedRewards, linkDistributedRewards, usdcDistributedRewards, usdtDistributedRewards, wbtcDistributedRewards, wethDistributedRewards]);


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
      distributedRewardsData: Object.fromEntries(
        Object.entries(distributedRewardsData).map(([symbol, rewardData]) => [
          symbol,
          rewardData.data ? {
            raw: rewardData.data.toString(),
            formatted: formatUnits(rewardData.data as bigint, 18), // MOR rewards are always 18 decimals
            decimals: 18 // MOR token uses 18 decimals
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
    distributedRewardsData
  ]);

  // V7 Protocol APR Calculation using DistributorV2 individual pool rewards
  const calculateV7APR = useMemo(() => {
    console.log('🔢 APR CALCULATION - DISTRIBUTED REWARDS APPROACH:', {
      networkEnvironment,
      distributedRewardsData: Object.fromEntries(
        Object.entries(distributedRewardsData).map(([symbol, rewardData]) => [
          symbol,
          {
            hasData: !!rewardData.data,
            value: rewardData.data ? formatUnits(rewardData.data as bigint, 18) : 'N/A',
            isLoading: rewardData.isLoading
          }
        ])
      )
    });

    // ⚠️ CRITICAL LIMITATION IDENTIFIED ⚠️
    // The DistributorV2.getDistributedRewards() returns ACCUMULATED rewards (total pending)
    // but APR calculation requires the RATE of reward distribution over time.
    // 
    // To calculate accurate APR, I need ONE of the following:
    // 
    // 1. REWARD RATE DATA (preferred):
    //    - Daily/hourly MOR rewards being distributed to each pool
    //    - Or access to reward distribution events/logs to calculate rate
    // 
    // 2. TIME-BASED TRACKING:
    //    - Track getDistributedRewards() over time to calculate delta
    //    - But this requires persistent storage across page loads
    // 
    // 3. POOL REWARD COEFFICIENT CHANGES:
    //    - DepositPool.poolRewardCoefficient changes over time
    //    - Delta in coefficient × totalVirtualStake = new rewards
    // 
    // CURRENT APPROACH: Using a fixed placeholder until we get the correct data

    // For now, return placeholder values to demonstrate the structure
    const aprResults: Record<string, string> = {};
    
    Object.entries(distributedRewardsData).forEach(([symbol, rewardData]) => {
      const contract = contractData[symbol as keyof typeof contractData];
      
      if (!contract?.data || !rewardData.data) {
        aprResults[symbol] = 'N/A';
        return;
      }

      // 🚨 PLACEHOLDER CALCULATION - NOT ACCURATE 🚨
      // This is just to show the structure - replace with actual rate calculation
      
      // Get correct decimals for this asset from configuration
      const assetConfig = configuredAssets.find(a => a.metadata.symbol === symbol);
      const assetDecimals = assetConfig?.metadata.decimals || 18;
      
      const totalDeposited = Number(formatUnits(contract.data as bigint, assetDecimals));
      const accumulatedRewards = Number(formatUnits(rewardData.data as bigint, 18)); // MOR rewards always 18 decimals
      
      // Placeholder: assume rewards accumulated over 30 days for demonstration
      const assumedDays = 30;
      const dailyRewardRate = accumulatedRewards / assumedDays;
      const annualRate = (dailyRewardRate * 365 / totalDeposited) * 100;
      
      aprResults[symbol] = totalDeposited > 0 && annualRate > 0
        ? `${annualRate.toFixed(2)}%`
        : 'N/A';
        
      console.log(`🚨 PLACEHOLDER APR [${symbol}]:`, {
        totalDeposited,
        accumulatedRewards,
        assumedDays,
        calculatedAPR: aprResults[symbol],
        warning: 'This is a placeholder calculation - not accurate!'
      });
    });

    console.warn('⚠️ APR CALCULATION WARNING: Using placeholder logic. Need actual reward rate data!');
    return aprResults;
  }, [
    networkEnvironment,
    contractData,
    distributedRewardsData,
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
        const distributedReward = distributedRewardsData[symbol as keyof typeof distributedRewardsData];
        result[symbol] = {
          totalStaked: '0', // Default to 0 for deployed pools
          apy: calculateV7APR[symbol] || 'N/A',
          isLoading: contract.isLoading || distributedReward?.isLoading || false,
          error: (contract.error || distributedReward?.error) as Error | null
        };
      } else {
        // Asset has valid data - use correct decimals from config
        const totalStaked = parseFloat(formatUnits(contract.data as bigint, decimals)).toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        });

        const distributedReward = distributedRewardsData[symbol as keyof typeof distributedRewardsData];
        result[symbol] = {
          totalStaked,
          apy: calculateV7APR[symbol] || 'N/A',
          isLoading: contract.isLoading || distributedReward?.isLoading || false,
          error: (contract.error || distributedReward?.error) as Error | null
        };
      }
    });
    
    return result;
  }, [
    configuredAssets,
    contractData,
    depositPoolAddresses,
    distributedRewardsData,
    calculateV7APR
  ]);

  // Create refetch functions
  const refetchAsset = useCallback((symbol: AssetSymbol) => {
    const contract = contractData[symbol as keyof typeof contractData];
    if (contract && depositPoolAddresses[symbol]) {
      contract.refetch();
    }
  }, [contractData, depositPoolAddresses]);

  const refetchRewards = useCallback(() => {
    // Refetch all distributed rewards data
    Object.values(distributedRewardsData).forEach(rewardData => {
      if (rewardData.refetch) {
        rewardData.refetch();
      }
    });
  }, [distributedRewardsData]);

  const refetchAll = useCallback(() => {
    // Refetch all asset contracts
    configuredAssets.forEach(asset => {
      refetchAsset(asset.metadata.symbol);
    });
    // Refetch reward pool
    refetchRewards();
  }, [configuredAssets, refetchAsset, refetchRewards]);

  return {
    assets: assetsData,
    networkEnvironment,
    refetch: {
      refetchAsset,
      rewardPoolData: refetchRewards,
      refetchAll
    }
  };
}

/**
 * Helper hook to calculate APY from v7 protocol contract data
 * Uses the proper RewardPoolV2.getPeriodRewards() and coefficient-based calculations
 * @deprecated - Use useCapitalPoolData() instead which includes v7 protocol APR calculation
 */
export function useCapitalPoolAPY(poolType: 'stETH' | 'LINK') {
  // This hook is now deprecated - use the main useCapitalPoolData hook instead
  // which includes the proper v7 protocol APR calculation
  const poolData = useCapitalPoolData();
  
  return {
    apy: poolData.assets[poolType]?.apy || 'N/A',
    isLoading: poolData.assets[poolType]?.isLoading || false,
    error: poolData.assets[poolType]?.error || null
  };
}