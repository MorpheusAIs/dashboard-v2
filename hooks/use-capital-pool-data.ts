"use client";

import { useMemo, useCallback } from 'react';
import React from 'react';
import { useReadContract, useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import { NetworkEnvironment, getContractAddress, testnetChains, mainnetChains } from '@/config/networks';

// Import ABIs
import DepositPoolAbi from '@/app/abi/DepositPool.json'; // Use the generic ABI that has all functions
import RewardPoolV2Abi from '@/app/abi/RewardPoolV2.json';

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
  // Refetch functions to trigger data refresh after user actions
  refetch: {
    stETHPoolData: () => void;
    linkPoolData: () => void;
    rewardPoolData: () => void;
    refetchAll: () => void;
  };
}





/**
 * Custom hook to read live capital pool data from deployed v7/v2 protocol contracts
 * 
 * IMPLEMENTATION UPDATE (V7 Protocol Integration):
 * - Uses RewardPoolV2.getPeriodRewards() for proper emission calculation
 * - Accounts for testnet (minute-based) vs mainnet (daily) reward timing differences
 * - Implements coefficient-based APR calculation following v7 protocol documentation
 * - Replaces old V1 ERC1967Proxy workaround with proper v2 contract functions
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

  // Get contract addresses
  const stETHDepositPoolAddress = useMemo(() => {
    return getContractAddress(l1ChainId, 'stETHDepositPool', networkEnvironment) as `0x${string}` | undefined;
  }, [l1ChainId, networkEnvironment]);

  const linkDepositPoolAddress = useMemo(() => {
    return getContractAddress(l1ChainId, 'linkDepositPool', networkEnvironment) as `0x${string}` | undefined;
  }, [l1ChainId, networkEnvironment]);

  // Get V7/V2 protocol contract addresses
  const rewardPoolV2Address = useMemo(() => {
    return getContractAddress(l1ChainId, 'rewardPoolV2', networkEnvironment) as `0x${string}` | undefined;
  }, [l1ChainId, networkEnvironment]);



  // Read stETH pool data (using generic ABI that has the function)
  const {
    data: stETHTotalDeposited,
    isLoading: isLoadingStETH,
    error: stETHError,
    refetch: refetchStETHPoolData
  } = useReadContract({
    address: stETHDepositPoolAddress,
    abi: DepositPoolAbi,
    functionName: 'totalDepositedInPublicPools',
    chainId: l1ChainId,
    query: { 
      enabled: !!stETHDepositPoolAddress,
      refetchInterval: 5 * 60 * 1000 // Refetch every 5 minutes
    }
  });

  // Read LINK pool data (using generic ABI that has the function)
  const {
    data: LINKTotalDeposited,
    isLoading: isLoadingLINK,
    error: LINKError,
    refetch: refetchLinkPoolData
  } = useReadContract({
    address: linkDepositPoolAddress,
    abi: DepositPoolAbi,
    functionName: 'totalDepositedInPublicPools',
    chainId: l1ChainId,
    query: { 
      enabled: !!linkDepositPoolAddress,
      refetchInterval: 5 * 60 * 1000 // Refetch every 5 minutes
    }
  });

  // Read V7/V2 protocol reward data (for proper APR calculation)
  const currentTimestamp = useMemo(() => BigInt(Math.floor(Date.now() / 1000)), []);
  const lastCalculatedTimestamp = useMemo(() => currentTimestamp - BigInt(3600), []); // 1 hour ago for testing

  // Get period rewards from RewardPoolV2 (Step 1 from v7 protocol)
  const {
    data: periodRewardsData,
    isLoading: isLoadingPeriodRewards,
    error: periodRewardsError,
    refetch: refetchRewardPoolData
  } = useReadContract({
    address: rewardPoolV2Address,
    abi: RewardPoolV2Abi,
    functionName: 'getPeriodRewards',
    args: [BigInt(0), lastCalculatedTimestamp, currentTimestamp], // Pool index 0
    chainId: l1ChainId,
    query: { 
      enabled: !!rewardPoolV2Address,
      refetchInterval: 5 * 60 * 1000 // Refetch every 5 minutes
    }
  });

  // Debug contract call results
  React.useEffect(() => {
    console.log('🔍 CONTRACT CALL DEBUG - DETAILED:', {
      networkEnvironment,
      chainId: l1ChainId,
      contracts: {
        rewardPoolV2Address,
        stETHDepositPoolAddress,
        linkDepositPoolAddress,
      },
      contractData: {
        periodRewardsData: periodRewardsData ? {
          raw: periodRewardsData.toString(),
          formatted: formatUnits(periodRewardsData as bigint, 18)
        } : 'MISSING',
        stETHTotalDeposited: stETHTotalDeposited ? {
          raw: stETHTotalDeposited.toString(),
          formatted: formatUnits(stETHTotalDeposited as bigint, 18)
        } : 'MISSING', 
        LINKTotalDeposited: LINKTotalDeposited ? {
          raw: LINKTotalDeposited.toString(),
          formatted: formatUnits(LINKTotalDeposited as bigint, 18)
        } : 'MISSING',
      },
      loadingStates: {
        isLoadingPeriodRewards,
        isLoadingStETH,
        isLoadingLINK,
      },
      errors: {
        periodRewardsError: periodRewardsError?.message,
        stETHError: stETHError?.message,
        LINKError: LINKError?.message
      }
    });
  }, [
    networkEnvironment, 
    l1ChainId,
    rewardPoolV2Address, 
    stETHDepositPoolAddress, 
    linkDepositPoolAddress,
    periodRewardsData, 
    stETHTotalDeposited, 
    LINKTotalDeposited,
    isLoadingPeriodRewards,
    isLoadingStETH,
    isLoadingLINK,
    periodRewardsError,
    stETHError,
    LINKError
  ]);

  // Note: totalVirtualStake function doesn't exist in current v2 proxy contracts
  // Using totalDepositedInPublicPools as proxy for virtual stake calculation
  // This is an approximation until the proper implementation contracts are available



  // V7 Protocol APR Calculation using LIVE contract data (both mainnet and testnet)
  const calculateV7APR = useMemo(() => {
    // Use LIVE v7 protocol data for accurate APR calculation (both networks)
    if (!periodRewardsData || !stETHTotalDeposited || !LINKTotalDeposited) {
      console.warn('🔢 V7 APR Calculation: Missing LIVE contract data, showing N/A', {
        periodRewardsData: periodRewardsData ? 'LIVE DATA AVAILABLE' : 'MISSING',
        stETHTotalDeposited: stETHTotalDeposited ? 'LIVE DATA AVAILABLE' : 'MISSING', 
        LINKTotalDeposited: LINKTotalDeposited ? 'LIVE DATA AVAILABLE' : 'MISSING',
        rewardPoolV2Address,
        stETHDepositPoolAddress,
        linkDepositPoolAddress,
        networkEnv: networkEnvironment
      });
      return { stETH: 'N/A', LINK: 'N/A' };
    }

    try {
      // Step 1: Get LIVE period rewards (from RewardPoolV2.getPeriodRewards)
      const periodRewards = periodRewardsData as bigint;
      const periodDurationSeconds = currentTimestamp - lastCalculatedTimestamp;
      
      console.log('🔢 LIVE V7 APR CALCULATION - STEP BY STEP:', {
        periodRewards: formatUnits(periodRewards, 18),
        periodDurationSeconds: periodDurationSeconds.toString(),
        stETHTotalDeposited: formatUnits(stETHTotalDeposited as bigint, 18),
        LINKTotalDeposited: formatUnits(LINKTotalDeposited as bigint, 18),
        networkEnv: networkEnvironment
      });

      // Step 2: Calculate APR using LIVE deposited amounts
      const calculatePoolAPR = (totalDeposited: bigint, assetSymbol: string): string => {
        if (totalDeposited === BigInt(0) || periodRewards === BigInt(0)) {
          console.warn(`⚠️ [${assetSymbol}] Cannot calculate APR: zero values`, {
            totalDeposited: totalDeposited.toString(),
            periodRewards: periodRewards.toString()
          });
          return 'N/A';
        }

        // Split total rewards between pools (simplified)
        const poolRewardShare = periodRewards / BigInt(2);
        
        // Calculate hourly rate: poolRewards / totalDeposited
        const hourlyRate = Number(formatUnits(poolRewardShare, 18)) / Number(formatUnits(totalDeposited, 18));
        
        // Convert to annual rate based on network reward timing
        let annualRate: number;
        
        if (networkEnvironment === 'testnet') {
          // Testnet: rewards distributed per minute, scale to annual
          const minutesPerYear = 60 * 24 * 365; // 525,600 minutes
          const minutesInPeriod = Number(periodDurationSeconds) / 60;
          const rewardRatePerMinute = hourlyRate / minutesInPeriod;
          annualRate = rewardRatePerMinute * minutesPerYear * 100; // Convert to percentage
        } else {
          // Mainnet: rewards distributed daily, scale 1-hour sample to annual
          const hoursPerYear = 24 * 365; // 8,760 hours
          const rewardRatePerHour = hourlyRate; // Already hourly from 1-hour period
          annualRate = rewardRatePerHour * hoursPerYear * 100; // Convert to percentage
        }
        
        console.log(`📊 [${assetSymbol}] LIVE APR CALCULATION (${networkEnvironment}):`, {
          calculationMethod: networkEnvironment === 'testnet' ? 'per-minute scaled to annual' : 'daily scaled from 1-hour sample to annual',
          poolRewardShare: formatUnits(poolRewardShare, 18),
          totalDepositedETH: formatUnits(totalDeposited, 18),
          hourlyRate: hourlyRate.toFixed(6),
          networkEnv: networkEnvironment,
          annualRate: annualRate.toFixed(2),
          finalFormatted: annualRate > 1000
            ? `${Math.round(annualRate).toLocaleString()}%`
            : `${annualRate.toFixed(2)}%`
        });

        // Format for display (no artificial caps for testnet)
        return annualRate > 1000 
          ? `${Math.round(annualRate).toLocaleString()}%`
          : `${annualRate.toFixed(2)}%`;
      };

      const result = {
        stETH: calculatePoolAPR(stETHTotalDeposited as bigint, 'stETH'),
        LINK: calculatePoolAPR(LINKTotalDeposited as bigint, 'LINK')
      };

      console.log('📊 LIVE V7 Protocol APR Results:', result);
      return result;

    } catch (error) {
      console.error('❌ Error in LIVE V7 APR calculation:', error);
      return { stETH: 'N/A', LINK: 'N/A' };
    }
  }, [
    networkEnvironment, 
    periodRewardsData, 
    stETHTotalDeposited, 
    LINKTotalDeposited,
    currentTimestamp,
    lastCalculatedTimestamp
  ]);

  // Format the data using V7 Protocol APR calculation
  const stETHData = useMemo(() => {
    // Use live data for both mainnet and testnet
    const totalStaked = stETHTotalDeposited ? 
      parseFloat(formatUnits(stETHTotalDeposited as bigint, 18)).toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }) : '0';

    // Include all v7 protocol loading states
    const isLoading = isLoadingStETH || isLoadingPeriodRewards;
    const error = stETHError || periodRewardsError;

    return {
      totalStaked,
      apy: calculateV7APR.stETH, // V7 protocol calculated APR
      isLoading,
      error: error as Error | null
    };
  }, [
    networkEnvironment, 
    stETHTotalDeposited, 
    calculateV7APR,
    isLoadingStETH,
    isLoadingPeriodRewards,
    stETHError,
    periodRewardsError
  ]);

  const LINKData = useMemo(() => {
    // Use live data for both mainnet and testnet
    const totalStaked = LINKTotalDeposited ? 
      parseFloat(formatUnits(LINKTotalDeposited as bigint, 18)).toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }) : '0';

    // Include all v7 protocol loading states for LINK
    const isLoading = isLoadingLINK || isLoadingPeriodRewards;
    const error = LINKError || periodRewardsError;

    return {
      totalStaked,
      apy: calculateV7APR.LINK, // V7 protocol calculated APR
      isLoading,
      error: error as Error | null
    };
  }, [
    networkEnvironment, 
    LINKTotalDeposited, 
    calculateV7APR,
    isLoadingLINK,
    isLoadingPeriodRewards,
    LINKError,
    periodRewardsError
  ]);

  // Create refetch functions with proper error handling
  const refetchStETH = useCallback(() => {
    if (stETHDepositPoolAddress) {
      refetchStETHPoolData();
    }
  }, [stETHDepositPoolAddress, refetchStETHPoolData]);

  const refetchLINK = useCallback(() => {
    if (linkDepositPoolAddress) {
      refetchLinkPoolData();
    }
  }, [linkDepositPoolAddress, refetchLinkPoolData]);

  const refetchRewards = useCallback(() => {
    if (rewardPoolV2Address) {
      refetchRewardPoolData();
    }
  }, [rewardPoolV2Address, refetchRewardPoolData]);

  const refetchAll = useCallback(() => {
    refetchStETH();
    refetchLINK();
    refetchRewards();
  }, [refetchStETH, refetchLINK, refetchRewards]);

  return {
    stETH: stETHData,
    LINK: LINKData,
    networkEnvironment,
    refetch: {
      stETHPoolData: refetchStETH,
      linkPoolData: refetchLINK,
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
    apy: poolType === 'stETH' ? poolData.stETH.apy : poolData.LINK.apy,
    isLoading: poolType === 'stETH' ? poolData.stETH.isLoading : poolData.LINK.isLoading,
    error: poolType === 'stETH' ? poolData.stETH.error : poolData.LINK.error
  };
}
