import { useMemo } from "react";
import { useChainId, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { 
  testnetChains, 
  mainnetChains, 
  getContractAddress, 
  type NetworkEnvironment,
  type ContractAddresses
} from "@/config/networks"; 
import { type AssetSymbol } from "@/components/capital/constants/asset-config";

// Import the correct ABIs for proper v7 protocol approach
import RewardPoolV2Abi from "@/app/abi/RewardPoolV2.json";
import DepositPoolAbi from "@/app/abi/DepositPool.json";

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

  // Get RewardPoolV2 contract address (the main emission contract)
  const rewardPoolAddress = useMemo(() => {
    return getContractAddress(l1ChainId, 'rewardPoolV2', networkEnvironment) as `0x${string}` | undefined;
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

  // Get total daily rewards for Capital pool (index 0) using correct RewardPoolV2 contract
  const { 
    data: dailyPoolRewards, 
    isLoading: isLoadingPoolRewards 
  } = useReadContract({
    address: rewardPoolAddress,
    abi: RewardPoolV2Abi,
    functionName: 'getPeriodRewards',
    args: [BigInt(0), startTime, endTime], // Pool index 0 (Capital), 24-hour period
    chainId: l1ChainId,
    query: { 
      enabled: !!rewardPoolAddress,
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

  // Calculate daily emissions using CORRECT RewardPool approach
  const dailyEmissions = useMemo(() => {
    // Early return if user has no stake
    if (!userDeposited || userDeposited === BigInt(0)) {
      return 0;
    }

    // Early return if contract data not available
    const isLoading = isLoadingPoolRewards || isLoadingTotalStaked;
    if (!dailyPoolRewards || !totalStaked || isLoading || typeof dailyPoolRewards !== 'bigint' || typeof totalStaked !== 'bigint') {
      return 0;
    }

    try {
      // Parse values correctly
      const totalDailyRewards = Number(formatUnits(dailyPoolRewards, 18)); // Total MOR rewards for 24h period
      const totalStake = Number(formatUnits(totalStaked, 18)); // Total staked in this pool
      const userStake = Number(formatUnits(userDeposited, 18)); // User's stake
      
      if (totalStake <= 0 || totalDailyRewards <= 0) {
        return 0;
      }

      // Calculate user's proportional share of daily pool rewards
      // This is the CORRECT formula: (userStake / totalStake) * totalDailyPoolRewards
      const userShareOfPool = userStake / totalStake;
      const userDailyEmissions = totalDailyRewards * userShareOfPool;
      
      console.log(`📊 [${assetSymbol}] CORRECT Daily emissions (v7 RewardPool):`, {
        userStake,
        totalStakeInPool: totalStake,
        userShareOfPool: (userShareOfPool * 100).toFixed(8) + '%',
        totalDailyRewards,
        userDailyEmissions,
        period: '24 hours',
        rewardPoolAddress,
        depositPoolAddress,
        note: 'Using correct RewardPool.getPeriodRewards() - should be much lower!',
        networkEnv: networkEnvironment
      });
      
      return Math.max(0, userDailyEmissions);
      
    } catch (error) {
      console.error(`📊 [${assetSymbol}] Error calculating daily emissions:`, error);
      return 0;
    }
  }, [
    dailyPoolRewards,
    totalStaked,
    userDeposited,
    assetSymbol,
    isLoadingPoolRewards,
    isLoadingTotalStaked,
    rewardPoolAddress,
    depositPoolAddress,
    networkEnvironment
  ]);

  return { 
    emissions: dailyEmissions, 
    isLoading: isLoadingPoolRewards || isLoadingTotalStaked 
  };
}