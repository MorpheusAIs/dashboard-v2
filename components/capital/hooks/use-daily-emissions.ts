import { useMemo } from "react";
import { useChainId, useReadContract } from "wagmi";
import { formatUnits, zeroAddress } from "viem";
import {
  testnetChains,
  mainnetChains,
  getContractAddress,
  type NetworkEnvironment,
  type ContractAddresses
} from "@/config/networks";
import { type AssetSymbol, getAssetConfig } from "@/components/capital/constants/asset-config";

// Import the correct ABIs for proper v7 protocol approach
import RewardPoolV2Abi from "@/app/abi/RewardPoolV2.json";
import DepositPoolAbi from "@/app/abi/DepositPool.json";
import DistributorV2Abi from "@/app/abi/DistributorV2.json";

/**
 * Hook for calculating daily emissions based on V7 protocol reward distribution
 * 
 * CORRECT APPROACH: Uses proper RewardPoolV2 contract as per documentation
 * - Uses RewardPoolV2.getPeriodRewards() to get total daily pool rewards (24-hour period)
 * - Uses DepositPool.totalDepositedInPublicPools() to get total stake
 * - Calculates user's proportional share: (userStake / totalStake) * dailyPoolRewards
 * - Aligns with Morpheus tokenomics: ~3,456 MOR/day total for all capital providers
 * - References: https://gitbook.mor.org/smart-contracts/documentation/distribution-protocol/v7-protocol/contracts/rewardpool
 * 
 * @param currentReward User's current claimable rewards (unused - kept for compatibility)
 * @param userDeposited User's deposited/staked amount in the pool
 * @param assetSymbol Asset symbol (any AssetSymbol from configuration)
 * @param networkEnv Network environment (unused - determined from chainId, kept for compatibility)
 * @returns Object with daily emissions value and loading state
 */
export function useDailyEmissions(
  currentReward: bigint | undefined,
  userDeposited: bigint | undefined,
  assetSymbol: AssetSymbol,
  networkEnv: string, // eslint-disable-line @typescript-eslint/no-unused-vars
  poolIndex?: number // Optional pool index override
): { emissions: number; isLoading: boolean } {
  const chainId = useChainId();

  // Determine network environment and L1 chain ID
  const networkEnvironment = useMemo((): NetworkEnvironment => {
    return [1, 42161, 8453].includes(chainId) ? 'mainnet' : 'testnet';
  }, [chainId]);

  // Get asset configuration for correct decimal handling
  const assetConfig = useMemo(() => getAssetConfig(assetSymbol, networkEnvironment), [assetSymbol, networkEnvironment]);
  const assetDecimals = assetConfig?.metadata.decimals || 18;

  const l1ChainId = useMemo(() => {
    return networkEnvironment === 'mainnet' ? mainnetChains.mainnet.id : testnetChains.sepolia.id;
  }, [networkEnvironment]);

  // Get RewardPoolV2 contract address (the main emission contract)
  const rewardPoolAddress = useMemo(() => {
    return getContractAddress(l1ChainId, 'rewardPoolV2', networkEnvironment) as `0x${string}` | undefined;
  }, [l1ChainId, networkEnvironment]);

  // Get DistributorV2 contract address (for yield-based reward allocation)
  const distributorV2Address = useMemo(() => {
    return getContractAddress(l1ChainId, 'distributorV2', networkEnvironment) as `0x${string}` | undefined;
  }, [l1ChainId, networkEnvironment]);

  // Get DepositPool contract address for total stake calculation
  const getDepositPoolContractKey = (symbol: AssetSymbol): keyof ContractAddresses | null => {
    const mapping: Record<AssetSymbol, keyof ContractAddresses> = {
      'stETH': 'stETHDepositPool',
      'LINK': 'linkDepositPool',
      'USDC': 'usdcDepositPool',
      'USDT': 'usdtDepositPool',
      'wBTC': 'wbtcDepositPool',
      'wETH': 'wethDepositPool',
    };
    return mapping[symbol] || null;
  };

  const depositPoolAddress = useMemo(() => {
    const contractKey = getDepositPoolContractKey(assetSymbol);
    if (!contractKey) return undefined;
    return getContractAddress(l1ChainId, contractKey, networkEnvironment) as `0x${string}` | undefined;
  }, [l1ChainId, networkEnvironment, assetSymbol]);

  // Calculate timestamps for 24-hour period
  const { startTime, endTime } = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    const twentyFourHoursAgo = now - (24 * 60 * 60);
    return {
      startTime: BigInt(twentyFourHoursAgo),
      endTime: BigInt(now)
    };
  }, []);

  // Use provided pool index or default to 0 for Capital pool
  const rewardPoolIndex = BigInt(poolIndex ?? 0);

  // Check if the reward pool exists before querying rewards
  const {
    data: poolExists,
    isLoading: isLoadingPoolExists
  } = useReadContract({
    address: rewardPoolAddress,
    abi: RewardPoolV2Abi,
    functionName: 'isRewardPoolExist',
    args: [rewardPoolIndex],
    chainId: l1ChainId,
    query: {
      enabled: !!rewardPoolAddress,
    }
  });

  // Get total daily rewards for the specified pool using correct RewardPoolV2 contract
  const {
    data: dailyPoolRewards,
    isLoading: isLoadingPoolRewards
  } = useReadContract({
    address: rewardPoolAddress,
    abi: RewardPoolV2Abi,
    functionName: 'getPeriodRewards',
    args: [rewardPoolIndex, startTime, endTime], // Dynamic pool index, 24-hour period
    chainId: l1ChainId,
    query: {
      enabled: !!rewardPoolAddress && !!poolExists,
      refetchInterval: 5 * 60 * 1000 // Refetch every 5 minutes
    }
  });

  // Get total staked amount in this specific deposit pool
  const {
    data: totalStaked,
    isLoading: isLoadingTotalStaked
  } = useReadContract({
    address: depositPoolAddress,
    abi: DepositPoolAbi,
    functionName: 'totalDepositedInPublicPools',
    chainId: l1ChainId,
    query: {
      enabled: !!depositPoolAddress,
      refetchInterval: 5 * 60 * 1000 // Refetch every 5 minutes
    }
  });

  // Get MOR rewards allocated to this deposit pool from DistributorV2
  // This gives us the yield-based allocation from the last distributeRewards() call
  const {
    data: allocatedRewards,
    isLoading: isLoadingAllocatedRewards
  } = useReadContract({
    address: distributorV2Address,
    abi: DistributorV2Abi,
    functionName: 'distributedRewards',
    args: [rewardPoolIndex, depositPoolAddress || zeroAddress],
    chainId: l1ChainId,
    query: {
      enabled: !!distributorV2Address && !!depositPoolAddress,
      refetchInterval: 5 * 60 * 1000 // Refetch every 5 minutes
    }
  });

  // Calculate daily emissions using CORRECT RewardPool approach
  const dailyEmissions = useMemo(() => {
    // Early return if user has no stake
    if (!userDeposited || userDeposited === BigInt(0)) {
      return 0;
    }

    // Early return if contract data not available
    const isLoading = isLoadingPoolRewards || isLoadingTotalStaked || isLoadingPoolExists || isLoadingAllocatedRewards;
    if (!dailyPoolRewards || !totalStaked || !poolExists || isLoading || typeof dailyPoolRewards !== 'bigint' || typeof totalStaked !== 'bigint') {
      console.log(`📊 [${assetSymbol}] Missing data - poolExists: ${poolExists}, dailyPoolRewards: ${dailyPoolRewards}, totalStaked: ${totalStaked}, allocatedRewards: ${allocatedRewards}, isLoading: ${isLoading}`);
      return 0;
    }

    try {
      // Parse values correctly
      const totalDailyRewards = Number(formatUnits(dailyPoolRewards, 18)); // Total MOR rewards for 24h period (MOR always 18 decimals)
      const totalStake = Number(formatUnits(totalStaked, assetDecimals)); // Total staked in this pool
      const userStake = Number(formatUnits(userDeposited, assetDecimals)); // User's stake
      const poolAllocatedRewards = allocatedRewards && typeof allocatedRewards === 'bigint' ? Number(formatUnits(allocatedRewards, 18)) : 0; // Historical MOR allocation to this pool (MOR always 18 decimals)

      if (totalStake <= 0 || totalDailyRewards <= 0) {
        return 0;
      }

      // CORRECT YIELD-BASED FORMULA (per MOR Distribution Step #1 documentation):
      // 1. Total MOR rewards are allocated proportionally to YIELD GENERATION (not stake amounts)
      // 2. Within each pool, users get rewards proportional to their virtual stake

      // For projection: estimate pool's yield share based on historical allocation patterns
      // If pool has no historical data, assume it gets proportional share based on size
      let poolYieldShare = 1.0; // Default for pools with no competition

      // Estimate pool's yield share based on historical allocation patterns
      const estimatedTotalHistoricalRewards = Math.max(totalDailyRewards * 30, 1000);

      if (poolAllocatedRewards > 0) {
        // Use historical allocation as proxy for yield generation capability
        // Scale based on recent daily rewards to estimate yield share
        poolYieldShare = Math.min(poolAllocatedRewards / estimatedTotalHistoricalRewards, 1.0);

        // Ensure minimum reasonable share for active pools
        poolYieldShare = Math.max(poolYieldShare, 0.000001); // Minimum 0.0001% share
      }

      // User's share within the pool (stake-based)
      const userShareOfPool = userStake / totalStake;

      // Final calculation: user's stake share × pool's estimated yield share × total rewards
      const userDailyEmissions = totalDailyRewards * poolYieldShare * userShareOfPool;

      console.log(`📊 [${assetSymbol}] YIELD-BASED Daily emissions:`, {
        userStake,
        totalStakeInPool: totalStake,
        userShareOfPool: (userShareOfPool * 100).toFixed(6) + '%',
        poolHistoricalAllocation: poolAllocatedRewards.toFixed(2),
        estimatedTotalHistoricalRewards: estimatedTotalHistoricalRewards.toFixed(2),
        rawYieldShare: (poolAllocatedRewards / estimatedTotalHistoricalRewards).toFixed(8),
        finalPoolYieldShare: (poolYieldShare * 100).toFixed(6) + '%',
        totalDailyRewards: totalDailyRewards.toFixed(2),
        userDailyEmissions: userDailyEmissions.toFixed(6),
        period: '24 hours',
        rewardPoolIndex: rewardPoolIndex.toString(),
        calculation: 'Yield-based: (userStake/totalStake) × poolYieldShare × totalRewards',
        note: poolYieldShare < 0.0001
          ? '📉 VERY LOW YIELD POOL: Minimal historical allocation'
          : poolYieldShare < 0.01
          ? '📉 LOW YIELD POOL: Few MOR rewards expected'
          : poolYieldShare > 0.5
          ? '📈 HIGH YIELD POOL: Major MOR share'
          : '⚖️ MODERATE POOL: Balanced yield generation'
      });

      return Math.max(0, userDailyEmissions);

    } catch (error) {
      console.error(`📊 [${assetSymbol}] Error calculating yield-based daily emissions:`, error);
      return 0;
    }
  }, [
    dailyPoolRewards,
    totalStaked,
    allocatedRewards,
    userDeposited,
    assetSymbol,
    assetDecimals,
    isLoadingPoolRewards,
    isLoadingTotalStaked,
    isLoadingPoolExists,
    isLoadingAllocatedRewards,
    rewardPoolIndex,
    rewardPoolAddress,
    depositPoolAddress,
    networkEnvironment
  ]);

  return {
    emissions: dailyEmissions,
    isLoading: isLoadingPoolRewards || isLoadingTotalStaked || isLoadingPoolExists || isLoadingAllocatedRewards
  };
}