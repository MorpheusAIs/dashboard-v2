"use client";

import { useMemo } from 'react';
import { useAccount, useBalance, useReadContract, useChainId } from 'wagmi';
import { zeroAddress } from 'viem';
import { 
  getContractAddress, 
  type NetworkEnvironment,
  type ContractAddresses 
} from '@/config/networks';
import { 
  type AssetSymbol, 
  getAssetConfig
} from '@/components/capital/constants/asset-config';
import { formatBigInt, formatTimestamp } from '@/lib/utils/formatters';
import { formatPowerFactorPrecise } from '@/lib/utils/power-factor-utils';

// Import ABIs
import ERC20Abi from '@/app/abi/ERC20.json';
import DepositPoolAbi from '@/app/abi/DepositPool.json';
import ERC1967ProxyAbi from '@/app/abi/ERC1967Proxy.json';

const V2_REWARD_POOL_INDEX = BigInt(0);

export interface AssetContractData {
  // Raw contract data
  userBalance: bigint;
  userDeposited: bigint;
  userAllowance: bigint;
  claimableAmount: bigint;
  userMultiplier: bigint;
  totalDeposited: bigint;
  claimUnlockTimestamp?: bigint;
  withdrawUnlockTimestamp?: bigint;
  
  // Formatted data
  userBalanceFormatted: string;
  userDepositedFormatted: string;
  claimableAmountFormatted: string;
  userMultiplierFormatted: string;
  totalDepositedFormatted: string;
  claimUnlockTimestampFormatted: string;
  withdrawUnlockTimestampFormatted: string;
  
  // Eligibility flags
  canClaim: boolean;
  canWithdraw: boolean;
  
  // Loading states
  isLoading: boolean;
  
  // Contract addresses for this asset
  tokenAddress: `0x${string}`;
  depositPoolAddress: `0x${string}`;
  
  // Refetch functions for dynamic data refresh
  refetch: {
    balance: () => void;
    allowance: () => void;
    userData: () => void;
    rewards: () => void;
    multiplier: () => void;
    totalDeposited: () => void;
    all: () => void;
  };
}

/**
 * Dynamic hook to read contract data for a single asset
 * This eliminates hardcoded asset-specific variables
 */
export function useAssetContractData(assetSymbol: AssetSymbol): AssetContractData {
  const { address: userAddress } = useAccount();
  const chainId = useChainId();
  
  // Determine network environment
  const networkEnv = useMemo((): NetworkEnvironment => {
    return [1, 42161, 8453].includes(chainId) ? 'mainnet' : 'testnet';
  }, [chainId]);
  
  const l1ChainId = useMemo(() => {
    return networkEnv === 'mainnet' ? 1 : 11155111; // mainnet : sepolia
  }, [networkEnv]);
  
  // Get asset configuration
  const assetConfig = useMemo(() => {
    return getAssetConfig(assetSymbol, networkEnv);
  }, [assetSymbol, networkEnv]);
  
  // Get contract addresses dynamically
  const { tokenAddress, depositPoolAddress, distributorV2Address } = useMemo(() => {
    if (!assetConfig) {
      return {
        tokenAddress: zeroAddress,
        depositPoolAddress: zeroAddress,
        distributorV2Address: zeroAddress,
      };
    }
    
    // Map asset symbol to deposit pool contract name
    const depositPoolMapping: Record<AssetSymbol, keyof ContractAddresses> = {
      'stETH': 'stETHDepositPool',
      'LINK': 'linkDepositPool',
      'USDC': 'usdcDepositPool',
      'USDT': 'usdtDepositPool',
      'wBTC': 'wbtcDepositPool',
      'wETH': 'wethDepositPool',
    };
    
    const depositPoolContractName = depositPoolMapping[assetSymbol];
    const depositPoolAddr = depositPoolContractName 
      ? getContractAddress(l1ChainId, depositPoolContractName, networkEnv)
      : '';
    
    const distributorAddr = getContractAddress(l1ChainId, 'distributorV2', networkEnv);
    
    return {
      tokenAddress: assetConfig.address,
      depositPoolAddress: (depositPoolAddr || zeroAddress) as `0x${string}`,
      distributorV2Address: (distributorAddr || zeroAddress) as `0x${string}`,
    };
  }, [assetConfig, assetSymbol, l1ChainId, networkEnv]);
  
  // Contract reads - only enabled if contracts are deployed (not zero address)
  const contractsEnabled = tokenAddress !== zeroAddress && depositPoolAddress !== zeroAddress;
  
  // User balance
  const { data: balanceData, isLoading: isLoadingBalance, refetch: refetchBalance } = useBalance({
    address: userAddress,
    token: tokenAddress,
    chainId: l1ChainId,
    query: { enabled: !!userAddress && contractsEnabled }
  });
  
  // User allowance
  const { data: allowanceData, isLoading: isLoadingAllowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress,
    abi: ERC20Abi,
    functionName: 'allowance',
    args: [userAddress || zeroAddress, distributorV2Address],
    chainId: l1ChainId,
    query: { enabled: !!userAddress && contractsEnabled }
  });
  
  // User deposit pool data
  const { data: userPoolData, isLoading: isLoadingUserData, refetch: refetchUserData } = useReadContract({
    address: depositPoolAddress,
    abi: DepositPoolAbi,
    functionName: 'usersData',
    args: [userAddress || zeroAddress, V2_REWARD_POOL_INDEX],
    chainId: l1ChainId,
    query: { enabled: !!userAddress && contractsEnabled }
  });
  
  // Total deposited in pool
  const { data: totalDepositedData, isLoading: isLoadingTotal, refetch: refetchTotalDeposited } = useReadContract({
    address: depositPoolAddress,
    abi: DepositPoolAbi,
    functionName: 'totalDepositedInPublicPools',
    chainId: l1ChainId,
    query: { enabled: contractsEnabled }
  });
  
  // User rewards
  const { data: userRewardData, isLoading: isLoadingReward, refetch: refetchRewards } = useReadContract({
    address: depositPoolAddress,
    abi: DepositPoolAbi,
    functionName: 'getLatestUserReward',
    args: [V2_REWARD_POOL_INDEX, userAddress || zeroAddress],
    chainId: l1ChainId,
    query: { enabled: !!userAddress && contractsEnabled }
  });
  
  // User multiplier
  const { data: userMultiplierData, isLoading: isLoadingMultiplier, refetch: refetchMultiplier } = useReadContract({
    address: distributorV2Address,
    abi: ERC1967ProxyAbi,
    functionName: 'getCurrentUserMultiplier',
    args: [V2_REWARD_POOL_INDEX, userAddress || zeroAddress],
    chainId: l1ChainId,
    query: { enabled: !!userAddress && contractsEnabled }
  });
  
  // Parse contract data
  const parsedData = useMemo(() => {
    const userBalance = balanceData?.value || BigInt(0);
    const userAllowance = allowanceData as bigint || BigInt(0);
    const totalDeposited = totalDepositedData as bigint || BigInt(0);
    const claimableAmount = userRewardData as bigint || BigInt(0);
    const userMultiplier = userMultiplierData as bigint || BigInt(0);
    
    // Parse user pool data
    let userDeposited = BigInt(0);
    let claimUnlockTimestamp: bigint | undefined;
    
    if (userPoolData && Array.isArray(userPoolData)) {
      try {
        userDeposited = BigInt(userPoolData[1] || 0); // deposited amount is index 1
        claimUnlockTimestamp = BigInt(userPoolData[5] || 0); // claimLockEnd is index 5
      } catch (e) {
        console.error(`Error parsing user pool data for ${assetSymbol}:`, e);
      }
    }
    
    // Calculate eligibility
    const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
    const canClaim = claimableAmount > BigInt(0) && 
                    (!claimUnlockTimestamp || currentTimestamp >= claimUnlockTimestamp);
    const canWithdraw = userDeposited > BigInt(0); // Simplified for now - TODO: Add withdraw unlock logic
    
    return {
      userBalance,
      userDeposited,
      userAllowance,
      claimableAmount,
      userMultiplier,
      totalDeposited,
      claimUnlockTimestamp: claimUnlockTimestamp && claimUnlockTimestamp > BigInt(0) ? claimUnlockTimestamp : undefined,
      withdrawUnlockTimestamp: undefined, // TODO: Add withdraw unlock timestamp calculation
      canClaim,
      canWithdraw,
    };
  }, [balanceData, allowanceData, userPoolData, totalDepositedData, userRewardData, userMultiplierData, assetSymbol]);
  
  // Format data for display
  const formattedData = useMemo(() => {
    const decimals = assetConfig?.metadata.decimals || 18;
    
    return {
      userBalanceFormatted: formatBigInt(parsedData.userBalance, decimals, 4),
      userDepositedFormatted: formatBigInt(parsedData.userDeposited, decimals, 2),
      claimableAmountFormatted: formatBigInt(parsedData.claimableAmount, 18, 2), // MOR rewards always 18 decimals
      userMultiplierFormatted: parsedData.userMultiplier ? 
        formatPowerFactorPrecise(parsedData.userMultiplier) : 
        (parsedData.userDeposited > BigInt(0) ? "x1.0" : "---"),
      totalDepositedFormatted: formatBigInt(parsedData.totalDeposited, decimals, 2),
      claimUnlockTimestampFormatted: formatTimestamp(parsedData.claimUnlockTimestamp),
      withdrawUnlockTimestampFormatted: formatTimestamp(parsedData.withdrawUnlockTimestamp),
    };
  }, [parsedData, assetConfig]);
  
  // Loading state
  const isLoading = isLoadingBalance || isLoadingAllowance || isLoadingUserData || 
                   isLoadingTotal || isLoadingReward || isLoadingMultiplier;
  
  return {
    ...parsedData,
    ...formattedData,
    isLoading,
    tokenAddress,
    depositPoolAddress,
    // Dynamic refetch functions for this asset
    refetch: {
      balance: () => refetchBalance(),
      allowance: () => refetchAllowance(),
      userData: () => refetchUserData(),
      rewards: () => refetchRewards(),
      multiplier: () => refetchMultiplier(),
      totalDeposited: () => refetchTotalDeposited(),
      all: () => {
        refetchBalance();
        refetchAllowance();
        refetchUserData();
        refetchRewards();
        refetchMultiplier();
        refetchTotalDeposited();
      },
    },
  };
}
