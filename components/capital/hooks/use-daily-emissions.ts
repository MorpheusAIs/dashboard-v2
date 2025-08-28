import { useMemo } from "react";
import { useChainId, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { 
  testnetChains, 
  mainnetChains, 
  getContractAddress, 
  type NetworkEnvironment 
} from "@/config/networks"; 

// Import the proper ABIs that the working APR code uses
import RewardPoolV2Abi from "@/app/abi/RewardPoolV2.json";
import DepositPoolAbi from "@/app/abi/DepositPool.json";

/**
 * Hook for calculating daily emissions based on V7 protocol reward distribution
 * 
 * APPROACH: Similar to APR calculation but focuses on user's daily reward share
 * - Uses RewardPoolV2.getPeriodRewards() for actual reward rate
 * - Calculates user's share based on their stake vs total pool stake
 * - Accounts for testnet (per-minute) vs mainnet (daily) reward timing
 * 
 * @param currentReward User's current claimable rewards (unused - kept for compatibility)
 * @param userDeposited User's deposited/staked amount in the pool
 * @param assetSymbol Asset symbol ('stETH' or 'LINK')
 * @param networkEnv Network environment (unused - determined from chainId, kept for compatibility)
 * @returns Object with daily emissions value and loading state
 */
export function useDailyEmissions(
  currentReward: bigint | undefined, 
  userDeposited: bigint | undefined,
  assetSymbol: string,
  networkEnv: string // eslint-disable-line @typescript-eslint/no-unused-vars
): { emissions: number; isLoading: boolean } {
  const chainId = useChainId();
  
  // Determine network environment and L1 chain ID
  const networkEnvironment = useMemo((): NetworkEnvironment => {
    return [1, 42161, 8453].includes(chainId) ? 'mainnet' : 'testnet';
  }, [chainId]);

  const l1ChainId = useMemo(() => {
    return networkEnvironment === 'mainnet' ? mainnetChains.mainnet.id : testnetChains.sepolia.id;
  }, [networkEnvironment]);

  // Get contract addresses
  const rewardPoolV2Address = useMemo(() => {
    return getContractAddress(l1ChainId, 'rewardPoolV2', networkEnvironment) as `0x${string}` | undefined;
  }, [l1ChainId, networkEnvironment]);

  const depositPoolAddress = useMemo(() => {
    const contractKey = assetSymbol === 'stETH' ? 'stETHDepositPool' : 'linkDepositPool';
    return getContractAddress(l1ChainId, contractKey, networkEnvironment) as `0x${string}` | undefined;
  }, [l1ChainId, networkEnvironment, assetSymbol]);

  // Calculate timestamps (same pattern as working APR code)
  // Round to nearest minute to prevent constant recalculations
  const currentTimestamp = useMemo(() => {
    const now = Date.now();
    const roundedToMinute = Math.floor(now / (60 * 1000)) * (60 * 1000);
    return BigInt(Math.floor(roundedToMinute / 1000));
  }, []);
  const lastCalculatedTimestamp = useMemo(() => currentTimestamp - BigInt(3600), [currentTimestamp]); // 1 hour ago

  // Read period rewards from RewardPoolV2 (with proper arguments like APR code)
  const { 
    data: periodRewardsData, 
    isLoading: isPeriodRewardsLoading,
    isFetching: isPeriodRewardsFetching
  } = useReadContract({
    address: rewardPoolV2Address,
    abi: RewardPoolV2Abi,
    functionName: 'getPeriodRewards',
    args: [BigInt(0), lastCalculatedTimestamp, currentTimestamp], // Pool index 0, same as APR code
    chainId: l1ChainId,
    query: { 
      enabled: Boolean(rewardPoolV2Address && networkEnvironment === 'testnet'),
      refetchInterval: 5 * 60 * 1000 // Refetch every 5 minutes instead of every minute
    }
  });

  // Read total deposited from the specific deposit pool (same as working APR code)
  const { 
    data: totalVirtualStakeData, 
    isLoading: isTotalStakeLoading,
    isFetching: isTotalStakeFetching
  } = useReadContract({
    address: depositPoolAddress,
    abi: DepositPoolAbi,
    functionName: 'totalDepositedInPublicPools',
    chainId: l1ChainId,
    query: { 
      enabled: Boolean(depositPoolAddress && networkEnvironment === 'testnet'),
      refetchInterval: 5 * 60 * 1000 // Refetch every 5 minutes instead of every 30 seconds
    }
  });

  // Determine overall loading state
  const isLoading = useMemo(() => {
    // For testnet: loading if either contract call is loading or fetching
    if (networkEnvironment === 'testnet') {
      return isPeriodRewardsLoading || isTotalStakeLoading || isPeriodRewardsFetching || isTotalStakeFetching;
    }
    // For mainnet: no network calls, so never loading
    return false;
  }, [networkEnvironment, isPeriodRewardsLoading, isTotalStakeLoading, isPeriodRewardsFetching, isTotalStakeFetching]);

  // Calculate daily emissions
  const dailyEmissions = useMemo(() => {
    // Early return if user data hasn't loaded yet
    if (!userDeposited || userDeposited === BigInt(0)) {
      console.log(`⏳ [${assetSymbol}] Waiting for user data to load...`);
      return 0;
    }
    
    // For mainnet, return placeholder until V7 contracts are deployed
    if (networkEnvironment === 'mainnet') {
      // Use simplified calculation based on typical MOR emission rates
      // This is a placeholder - actual mainnet calculation will use live contract data
      
      const userStakedEth = Number(formatUnits(userDeposited, 18));
      // Placeholder: ~8-12% APR = ~0.02-0.03% daily rate
      const placeholderDailyRate = userStakedEth * 0.0003; // 0.03% daily
      
      console.log(`📊 [${assetSymbol}] Mainnet placeholder daily emissions:`, {
        userStakedEth,
        placeholderDailyRate,
        note: 'Using placeholder until V7 contracts deploy to mainnet'
      });
      
      return placeholderDailyRate;
    }

    // For testnet, use live contract data
    console.log(`📊 [${assetSymbol}] Contract data check:`, {
      periodRewardsData: periodRewardsData?.toString(),
      totalDepositedData: totalVirtualStakeData?.toString(),
      hasPeriodRewards: Boolean(periodRewardsData),
      hasTotalDeposited: Boolean(totalVirtualStakeData),
      networkEnv: networkEnvironment,
      lastCalculatedTimestamp: lastCalculatedTimestamp.toString(),
      currentTimestamp: currentTimestamp.toString(),
      periodDurationHours: Number(currentTimestamp - lastCalculatedTimestamp) / 3600
    });

    if (!periodRewardsData || !totalVirtualStakeData) {
      console.log(`❌ [${assetSymbol}] INSUFFICIENT CONTRACT DATA - Daily emissions = 0`);
      return 0;
    }

    try {
      const periodRewards = periodRewardsData as bigint;
      const totalDeposited = totalVirtualStakeData as bigint; // Total deposited in the pool
      
      // Calculate period duration (we know it's 1 hour since we set it above)
      const periodDurationSeconds = currentTimestamp - lastCalculatedTimestamp;
      
      if (periodDurationSeconds <= 0 || totalDeposited === BigInt(0)) {
        console.warn(`📊 [${assetSymbol}] Invalid calculation parameters:`, {
          periodDurationSeconds: periodDurationSeconds.toString(),
          totalDeposited: totalDeposited.toString()
        });
        return 0;
      }

      // Split total rewards between pools (simplified - assumes 50/50 split)
      // In reality, this should be based on pool weights from the protocol
      const poolRewardShare = periodRewards / BigInt(2);
      
      // Calculate user's share of pool rewards
      const userShareOfPool = Number(formatUnits(userDeposited, 18)) / Number(formatUnits(totalDeposited, 18));
      const userPeriodRewards = Number(formatUnits(poolRewardShare, 18)) * userShareOfPool;
      
      // Convert to daily rate based on network environment
      let dailyRate: number;
      const periodDurationMinutes = Number(periodDurationSeconds) / 60;
      
      if (networkEnvironment === 'testnet') {
        // Testnet: rewards every minute, so scale to daily (1440 minutes per day)
        const rewardsPerMinute = userPeriodRewards / periodDurationMinutes;
        dailyRate = rewardsPerMinute * (24 * 60); // 1440 minutes per day
      } else {
        // Mainnet: rewards daily (this branch shouldn't execute but included for completeness)
        const periodDurationDays = Number(periodDurationSeconds) / (24 * 60 * 60);
        dailyRate = userPeriodRewards / periodDurationDays;
      }
      
      console.log(`📊 [${assetSymbol}] Daily emissions calculated:`, {
        userDeposited: Number(formatUnits(userDeposited, 18)),
        totalDeposited: Number(formatUnits(totalDeposited, 18)),
        userShareOfPool: (userShareOfPool * 100).toFixed(4) + '%',
        periodRewards: Number(formatUnits(periodRewards, 18)),
        poolRewardShare: Number(formatUnits(poolRewardShare, 18)),
        userPeriodRewards,
        periodDurationMinutes,
        dailyRate,
        networkEnv: networkEnvironment
      });
      
      return Math.max(0, dailyRate); // Ensure non-negative
      
    } catch (error) {
      console.error(`📊 [${assetSymbol}] Error calculating daily emissions:`, error);
      return 0;
    }
  }, [
    periodRewardsData,
    totalVirtualStakeData,
    userDeposited,
    assetSymbol,
    networkEnvironment,
    currentTimestamp,
    lastCalculatedTimestamp
  ]);

  return { 
    emissions: dailyEmissions, 
    isLoading 
  };
}