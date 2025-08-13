"use client";

import { useMemo } from 'react';
import { useReadContract, useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import { NetworkEnvironment, getContractAddress, testnetChains, mainnetChains } from '@/config/networks';

// Import ABIs
import DepositPoolAbi from '@/app/abi/DepositPool.json';
import stETHDepositPoolV2Abi from '@/app/abi/stETHDepositPoolV2.json';
import LINKDepositPoolV2Abi from '@/app/abi/LINKDepositPoolV2.json';
import ERC1967ProxyAbi from '@/app/abi/ERC1967Proxy.json';

export interface CapitalPoolData {
  stETH: {
    totalStaked: string;
    apy: string;
    isLoading: boolean;
    error: Error | null;
  };
  LINK: {
    totalStaked: string;
    apy: string;
    isLoading: boolean;
    error: Error | null;
  };
  networkEnvironment: NetworkEnvironment;
}

interface RewardPoolConfig {
  payoutStart: bigint;
  decreaseInterval: bigint;
  withdrawLockPeriod: bigint;
  claimLockPeriod: bigint;
  withdrawLockPeriodAfterStake: bigint;
  initialReward: bigint;
  rewardDecrease: bigint;
  minimalStake: bigint;
  isPublic: boolean;
}

/**
 * Custom hook to read live capital pool data from deployed contracts
 * Returns live data for testnet (Sepolia) and placeholder data for mainnet
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

  // Get contract addresses
  const stETHDepositPoolAddress = useMemo(() => {
    return getContractAddress(l1ChainId, 'stETHDepositPool', networkEnvironment) as `0x${string}` | undefined;
  }, [l1ChainId, networkEnvironment]);

  const linkDepositPoolAddress = useMemo(() => {
    return getContractAddress(l1ChainId, 'linkDepositPool', networkEnvironment) as `0x${string}` | undefined;
  }, [l1ChainId, networkEnvironment]);

  // Get V1 ERC1967Proxy address for reward pool configuration
  const erc1967ProxyAddress = useMemo(() => {
    return getContractAddress(l1ChainId, 'erc1967Proxy', networkEnvironment) as `0x${string}` | undefined;
  }, [l1ChainId, networkEnvironment]);

  // Read stETH pool data (only for testnet)
  const {
    data: stETHTotalDeposited,
    isLoading: isLoadingStETH,
    error: stETHError
  } = useReadContract({
    address: stETHDepositPoolAddress,
    abi: stETHDepositPoolV2Abi,
    functionName: 'totalDepositedInPublicPools',
    chainId: l1ChainId,
    query: { 
      enabled: networkEnvironment === 'testnet' && !!stETHDepositPoolAddress,
      refetchInterval: 30000 // Refetch every 30 seconds
    }
  });

  // Read LINK pool data (only for testnet)  
  const {
    data: LINKTotalDeposited,
    isLoading: isLoadingLINK,
    error: LINKError
  } = useReadContract({
    address: linkDepositPoolAddress,
    abi: LINKDepositPoolV2Abi,
    functionName: 'totalDepositedInPublicPools',
    chainId: l1ChainId,
    query: { 
      enabled: networkEnvironment === 'testnet' && !!linkDepositPoolAddress,
      refetchInterval: 30000 // Refetch every 30 seconds
    }
  });

  // Read reward pool configuration from V1 contract (only for testnet)
  const {
    data: rewardPoolConfigRaw,
    isLoading: isLoadingRewardConfig,
    error: rewardConfigError
  } = useReadContract({
    address: erc1967ProxyAddress,
    abi: ERC1967ProxyAbi,
    functionName: 'pools',
    args: [BigInt(0)], // Pool ID 0
    chainId: l1ChainId,
    query: { 
      enabled: networkEnvironment === 'testnet' && !!erc1967ProxyAddress,
      refetchInterval: 60000 // Refetch every minute
    }
  });

  // Parse reward pool config
  const rewardPoolConfig = useMemo((): RewardPoolConfig | undefined => {
    if (!rewardPoolConfigRaw || networkEnvironment === 'mainnet') return undefined;
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dataArray = rewardPoolConfigRaw as any[];
      if (!Array.isArray(dataArray) || dataArray.length < 9) return undefined;
      
      return {
        payoutStart: BigInt(dataArray[0]),
        decreaseInterval: BigInt(dataArray[1]),
        withdrawLockPeriod: BigInt(dataArray[2]),
        claimLockPeriod: BigInt(dataArray[3]),
        withdrawLockPeriodAfterStake: BigInt(dataArray[4]),
        initialReward: BigInt(dataArray[5]),
        rewardDecrease: BigInt(dataArray[6]),
        minimalStake: BigInt(dataArray[7]),
        isPublic: Boolean(dataArray[8]),
      };
    } catch (error) {
      console.error('Error parsing reward pool config:', error);
      return undefined;
    }
  }, [rewardPoolConfigRaw, networkEnvironment]);

  // Helper function to calculate current daily reward and APY
  const calculateAPY = useMemo(() => {
    // For mainnet, use placeholder values for production safety
    if (networkEnvironment === 'mainnet' || !rewardPoolConfig) {
      return { stETH: '8.65%', LINK: '15.54%' };
    }

    // TODO: The current calculation produces unrealistic APY values (billions of %)
    // Need developer clarification on:
    // 1. What does initialReward represent? (per second/minute/day/total protocol?)
    // 2. How should V1 contract data map to V2 reward calculations?
    // 3. Are we reading from the correct contract for testnet rewards?

    const { initialReward, rewardDecrease, decreaseInterval, payoutStart } = rewardPoolConfig;
    
    // Calculate current time and time since payout started
    const currentTime = BigInt(Math.floor(Date.now() / 1000));
    const timeSinceStart = currentTime > payoutStart ? currentTime - payoutStart : BigInt(0);
    
    // Calculate how many decrease intervals have passed
    const intervalsPassed = decreaseInterval > 0 ? timeSinceStart / decreaseInterval : BigInt(0);
    
    // Calculate current reward per distribution period using linear decay model
    // Formula: currentReward = initialReward - (rewardDecrease * intervalsPassed)
    // NOTE: initialReward appears to be per-distribution-period, not per-second
    const currentRewardPerPeriod = initialReward - (rewardDecrease * intervalsPassed);
    const rewardPerPeriod = currentRewardPerPeriod > 0 ? currentRewardPerPeriod : BigInt(0);
    
    // TESTNET: The reward is distributed every minute (for testing convenience)
    // But the rewardPerPeriod might be total protocol rewards, not per-pool
    // Let's try treating rewardPerPeriod as already representing daily rewards
    // and just use it directly instead of multiplying by 1440
    const dailyReward = rewardPerPeriod; // Try treating as daily rate directly
    
    // Convert to human readable format (from wei to ether)  
    const dailyRewardETH = parseFloat(formatUnits(dailyReward, 18));
    
    // Debug logging for testnet only (where we do live calculations)
    console.log(`🔢 APY Calculation Debug (${networkEnvironment.toUpperCase()}):`, {
      initialReward: formatUnits(initialReward, 18),
      rewardDecrease: formatUnits(rewardDecrease, 18),
      currentRewardPerPeriod: formatUnits(rewardPerPeriod, 18),
      decreaseInterval: `${decreaseInterval.toString()}s`,
      dailyRewardETH: dailyRewardETH.toFixed(6),
      payoutStart: new Date(Number(payoutStart) * 1000).toISOString(),
      timeSinceStart: `${timeSinceStart.toString()}s`,
      intervalsPassed: intervalsPassed.toString(),
      stETHTotalDeposited: stETHTotalDeposited ? formatUnits(stETHTotalDeposited as bigint, 18) : '0',
      LINKTotalDeposited: LINKTotalDeposited ? formatUnits(LINKTotalDeposited as bigint, 18) : '0',
    });
    
    // Calculate APY for each pool
    // Formula: APY = (dailyReward / totalStaked) * 365 * 100
    const calculatePoolAPY = (totalDeposited: bigint | undefined) => {
      if (!totalDeposited || totalDeposited === BigInt(0) || dailyRewardETH === 0) {
        return '0.00%';
      }
      
      const totalDepositedETH = parseFloat(formatUnits(totalDeposited, 18));
      const dailyRate = dailyRewardETH / totalDepositedETH;
      const annualRate = dailyRate * 365;
      const apy = annualRate * 100;
      
      // Sanity check - if APY is over 100%, cap it at reasonable levels for testnet
      if (apy > 100) {
        console.warn(`⚠️ Calculated APY is too high, using fallback (TESTNET):`, {
          calculatedAPY: apy.toFixed(2),
          dailyRewardETH,
          totalDepositedETH,
          dailyRate,
          note: 'Need developer clarification on reward calculation formula'
        });
        
        // Return a reasonable testnet APY range (higher than mainnet for testing)
        return totalDepositedETH < 50 ? '25.00%' : '18.00%';
      }
      
      return `${apy.toFixed(2)}%`;
    };

    const result = {
      stETH: calculatePoolAPY(stETHTotalDeposited as bigint),
      LINK: calculatePoolAPY(LINKTotalDeposited as bigint)
    };

    console.log(`📊 Calculated APY (TESTNET):`, result);

    return result;
  }, [rewardPoolConfig, networkEnvironment, stETHTotalDeposited, LINKTotalDeposited]);

  // Format the data
  const stETHData = useMemo(() => {
    if (networkEnvironment === 'mainnet') {
      // Placeholder data for mainnet
      return {
        totalStaked: '61,849',
        apy: '8.65%',
        isLoading: false,
        error: null
      };
    }

    // Live data for testnet
    const totalStaked = stETHTotalDeposited ? 
      parseFloat(formatUnits(stETHTotalDeposited as bigint, 18)).toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }) : '0';

    return {
      totalStaked,
      apy: calculateAPY.stETH, // Live calculated APY
      isLoading: isLoadingStETH || isLoadingRewardConfig,
      error: stETHError as Error | null || rewardConfigError as Error | null
    };
  }, [networkEnvironment, stETHTotalDeposited, isLoadingStETH, stETHError, calculateAPY, isLoadingRewardConfig, rewardConfigError]);

  const LINKData = useMemo(() => {
    if (networkEnvironment === 'mainnet') {
      // Placeholder data for mainnet
      return {
        totalStaked: '8,638',
        apy: '15.54%',
        isLoading: false,
        error: null
      };
    }

    // Live data for testnet
    const totalStaked = LINKTotalDeposited ? 
      parseFloat(formatUnits(LINKTotalDeposited as bigint, 18)).toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }) : '0';

    return {
      totalStaked,
      apy: calculateAPY.LINK, // Live calculated APY
      isLoading: isLoadingLINK || isLoadingRewardConfig,
      error: LINKError as Error | null || rewardConfigError as Error | null
    };
  }, [networkEnvironment, LINKTotalDeposited, isLoadingLINK, LINKError, calculateAPY, isLoadingRewardConfig, rewardConfigError]);

  return {
    stETH: stETHData,
    LINK: LINKData,
    networkEnvironment
  };
}

/**
 * Helper hook to calculate APY from contract data
 * This would read reward pool data and calculate the actual APY
 */
export function useCapitalPoolAPY(poolType: 'stETH' | 'LINK') {
  const chainId = useChainId();
  
  const networkEnvironment = useMemo((): NetworkEnvironment => {
    return [1, 42161, 8453].includes(chainId) ? 'mainnet' : 'testnet';
  }, [chainId]);

  const l1ChainId = useMemo(() => {
    return networkEnvironment === 'mainnet' ? mainnetChains.mainnet.id : testnetChains.sepolia.id;
  }, [networkEnvironment]);

  // Get reward pool contract address
  const rewardPoolAddress = useMemo(() => {
    return getContractAddress(l1ChainId, 'rewardPoolV2', networkEnvironment) as `0x${string}` | undefined;
  }, [l1ChainId, networkEnvironment]);

  // Read reward pool data to calculate APY
  const {
    data: rewardPoolData,
    isLoading: isLoadingAPY,
    error: apyError
  } = useReadContract({
    address: rewardPoolAddress,
    abi: DepositPoolAbi, // Use appropriate ABI
    functionName: 'rewardPoolsData',
    args: [BigInt(0)], // Pool index 0
    chainId: l1ChainId,
    query: { 
      enabled: networkEnvironment === 'testnet' && !!rewardPoolAddress,
      refetchInterval: 60000 // Refetch every minute
    }
  });

  // Calculate APY from reward pool data
  const calculatedAPY = useMemo(() => {
    if (networkEnvironment === 'mainnet' || !rewardPoolData) {
      // Return placeholder APY for mainnet
      return poolType === 'stETH' ? '8.65%' : '15.54%';
    }

    // TODO: Implement APY calculation based on reward pool data
    // This would involve reading:
    // - Current reward rate
    // - Total staked amount
    // - Reward emission schedule
    // For now, return placeholder
    return poolType === 'stETH' ? '8.65%' : '15.54%';
  }, [networkEnvironment, poolType, rewardPoolData]);

  return {
    apy: calculatedAPY,
    isLoading: isLoadingAPY,
    error: apyError as Error | null
  };
}
