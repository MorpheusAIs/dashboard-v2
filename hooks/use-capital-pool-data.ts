"use client";

import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import React from 'react';
import { useContractReads, useChainId, usePublicClient } from 'wagmi';
import { formatUnits } from 'viem';
import { NetworkEnvironment, getContractAddress, testnetChains, mainnetChains } from '@/config/networks';
import { getAssetsForNetwork, type AssetSymbol } from '@/components/capital/constants/asset-config';

// Import ABIs
import DepositPoolAbi from '@/app/abi/DepositPool.json'; // Use the generic ABI that has all functions
import DistributorV2Abi from '@/app/abi/DistributorV2.json'; // For yield tracking
import RewardPoolV2Abi from '@/app/abi/RewardPoolV2.json';
import ERC20Abi from '@/app/abi/ERC20.json'; // For aToken balance calls

export interface AssetPoolData {
  totalStaked: string;
  apr: string; // Renamed from 'apy' - we calculate APR (no compounding), not APY
  isLoading: boolean;
  error: Error | null;
  aprLoading?: boolean; // Separate loading state for APR calculation
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

export interface CapitalPoolDataOptions {
  morPrice?: number | null; // MOR price for APR calculation in USD terms
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
 * - Calculates APR using: ((dailyRewardRate * morPrice) * 365) / (totalVirtualDeposited * assetPrice) * 100
 * - Supports all configured assets (mainnet: stETH, USDC, USDT, wBTC, wETH; testnet: stETH, LINK)
 * - Shows N/A for assets without deposit pool contracts
 * 
 * Returns live data for both testnet (Sepolia) and mainnet with proper v7 protocol daily distribution
 */
export function useCapitalPoolData(options?: CapitalPoolDataOptions): CapitalPoolData {
  const { morPrice: morPriceOption } = options || {};
  
  // Debug log to verify MOR price is being passed
  console.log('🔍 [useCapitalPoolData] Received options:', {
    morPrice: morPriceOption,
    hasOptions: !!options,
    optionsKeys: options ? Object.keys(options) : []
  });
  
  const chainId = useChainId();
  
  // Determine network environment
  const networkEnvironment = useMemo((): NetworkEnvironment => {
    return [1, 42161, 8453].includes(chainId) ? 'mainnet' : 'testnet';
  }, [chainId]);

  // Historical window (7 days) for stable yield deltas
  const WINDOW_DAYS = 7;
  const [pastBlockNumber, setPastBlockNumber] = useState<bigint | null>(null);
  const [pastBlockTimestamp, setPastBlockTimestamp] = useState<number | null>(null);

  // Decay-aware annual emissions (computed from RewardPoolV2 schedule)
  const [annualEmissions, setAnnualEmissions] = useState<number | null>(null);
  const [isLoadingAnnualEmissions, setIsLoadingAnnualEmissions] = useState<boolean>(false);
  const [annualEmissionsError, setAnnualEmissionsError] = useState<string | null>(null);

  // getPeriodReward TS helper (linear decrease per interval)
  const getPeriodReward = useCallback((
    initialAmount: bigint,
    decreaseAmount: bigint,
    payoutStart: bigint,
    interval: bigint,
    startTime: bigint,
    endTime: bigint,
  ): bigint => {
    if (endTime <= startTime) return BigInt(0);
    if (endTime <= payoutStart) return BigInt(0);

    const one = BigInt(1);
    const i0 = payoutStart;
    const intv = interval === BigInt(0) ? BigInt(1) : interval;

    const startIdx = startTime > i0 ? (startTime - i0) / intv : BigInt(0);
    const endIdxRaw = (endTime - i0 - one) / intv; // inclusive index of last interval touching endTime
    if (endIdxRaw < BigInt(0)) return BigInt(0);

    let first = initialAmount - decreaseAmount * startIdx;
    if (first <= BigInt(0)) return BigInt(0);

    let last = initialAmount - decreaseAmount * endIdxRaw;
    if (last < BigInt(0)) {
      // clamp end index to last non-negative term
      const maxIdx = initialAmount / (decreaseAmount === BigInt(0) ? BigInt(1) : decreaseAmount);
      const clampedEndIdx = maxIdx > BigInt(0) ? maxIdx - BigInt(1) : BigInt(0);
      last = initialAmount - decreaseAmount * clampedEndIdx;
      // adjust start if it exceeds clamped end
      if (clampedEndIdx < startIdx) return BigInt(0);
      // recompute first to be safe
      first = initialAmount - decreaseAmount * startIdx;
    }

    const n = (endIdxRaw - startIdx + BigInt(1));
    // Sum of arithmetic series: n * (first + last) / 2
    return n * (first + last) / BigInt(2);
  }, []);

  // Get L1 chain ID based on network environment
  const l1ChainId = useMemo(() => {
    return networkEnvironment === 'mainnet' ? mainnetChains.mainnet.id : testnetChains.sepolia.id;
  }, [networkEnvironment]);

  // Get all configured assets for this network
  const configuredAssets = useMemo(() => getAssetsForNetwork(networkEnvironment), [networkEnvironment]);

  // Discover a block ~7 days ago (archive RPC needed)
  const publicClient = usePublicClient({ chainId: useMemo(() => (networkEnvironment === 'mainnet' ? 1 : 11155111), [networkEnvironment]) });
  const pastBlockLoadedRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!publicClient || pastBlockLoadedRef.current) return;
        const latest = await publicClient.getBlock();
        const latestNum = BigInt(latest.number);
        const targetTs = Math.floor(Date.now() / 1000) - WINDOW_DAYS * 24 * 60 * 60;
        const est = latestNum - BigInt(Math.floor((WINDOW_DAYS * 24 * 60 * 60) / 12));
        let low = est > BigInt(0) ? est : BigInt(0);
        let high = latestNum;
        for (let i = 0; i < 18; i++) {
          const mid = (low + high) / BigInt(2);
          const blk = await publicClient.getBlock({ blockNumber: mid });
          if (Number(blk.timestamp) >= targetTs) high = mid; else low = mid;
        }
        if (cancelled) return;
        const past = await publicClient.getBlock({ blockNumber: high });
        // Only update if changed
        setPastBlockNumber(prev => (prev !== high ? high : prev));
        setPastBlockTimestamp(prev => (prev !== Number(past.timestamp) ? Number(past.timestamp) : prev));
        pastBlockLoadedRef.current = true;
        console.log('🕰️ [HIST] Past block (≈7d):', { block: high.toString(), ts: Number(past.timestamp) });
      } catch (e) {
        console.warn('⚠️ [HIST] Unable to fetch past block (archive RPC required)', (e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [publicClient, WINDOW_DAYS]);

  // Get RewardPoolV2 and DistributorV2 contract addresses
  const rewardPoolV2Address = useMemo(() => {
    return getContractAddress(l1ChainId, 'rewardPoolV2', networkEnvironment) as `0x${string}` | undefined;
  }, [l1ChainId, networkEnvironment]);

  const distributorV2Address = useMemo(() => {
    return getContractAddress(l1ChainId, 'distributorV2', networkEnvironment) as `0x${string}` | undefined;
  }, [l1ChainId, networkEnvironment]);

  // Wire schedule read now that addresses/chainId are defined
  const rewardPoolContracts = useMemo(() => {
    if (!rewardPoolV2Address) return [];
    return [{
      address: rewardPoolV2Address,
      abi: RewardPoolV2Abi,
      functionName: 'rewardPools',
      args: [BigInt(0)], // Capital pool index = 0
      chainId: l1ChainId,
    }];
  }, [rewardPoolV2Address, l1ChainId]);

  const { data: scheduleResults } = useContractReads({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: rewardPoolContracts as any,
    allowFailure: true,
    query: {
      enabled: rewardPoolContracts.length > 0,
      refetchInterval: 10 * 60 * 1000,
    },
  });

  // Compute annual emissions when schedule is fetched
  useEffect(() => {
    try {
      if (!scheduleResults || scheduleResults.length === 0) return;
      const res = scheduleResults[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!res || (res as any).status !== 'success' || !Array.isArray((res as any).result)) return;
      type RewardPoolTuple = readonly [bigint, bigint, bigint, bigint, boolean];
      const tuple = (res as { result: RewardPoolTuple }).result;
      const payoutStart = tuple[0];
      const decreaseInterval = tuple[1];
      const initialReward = tuple[2];
      const rewardDecrease = tuple[3];

      setIsLoadingAnnualEmissions(true);
      const now = BigInt(Math.floor(Date.now() / 1000));
      const oneYear = BigInt(365 * 24 * 60 * 60);
      const end = now + oneYear;
      const periodReward = getPeriodReward(initialReward, rewardDecrease, payoutStart, decreaseInterval, now, end);
      const annual = Number(formatUnits(periodReward, 18));
      setAnnualEmissions(annual);
      setAnnualEmissionsError(null);
      setIsLoadingAnnualEmissions(false);

      console.log('📆 [EMISSIONS] Annual emissions (decay-aware):', {
        payoutStart: Number(payoutStart),
        decreaseInterval: Number(decreaseInterval),
        initialReward: Number(formatUnits(initialReward, 18)),
        rewardDecrease: Number(formatUnits(rewardDecrease, 18)),
        now: Number(now),
        end: Number(end),
        annualEmissionsMOR: annual,
      });
    } catch (e) {
      console.error('❌ [EMISSIONS] Failed to compute annual emissions:', e);
      setAnnualEmissionsError((e as Error).message);
      setIsLoadingAnnualEmissions(false);
    }
  }, [scheduleResults, getPeriodReward]);

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

  // ✅ HISTORICAL DISTRIBUTOR SNAPSHOTS (~7d ago)
  const distributorPoolContractsPast = useMemo(() => {
    if (!distributorV2Address || pastBlockNumber == null) return [];
    return configuredAssets
      .filter((assetConfig) => {
        const symbol = assetConfig.metadata.symbol;
        const address = depositPoolAddresses[symbol];
        return address && address !== '0x0000000000000000000000000000000000000000';
      })
      .map((assetConfig) => {
        const symbol = assetConfig.metadata.symbol;
        const depositPoolAddress = depositPoolAddresses[symbol]!;
        return {
          address: distributorV2Address,
          abi: DistributorV2Abi,
          functionName: 'depositPools',
          args: [BigInt(0), depositPoolAddress],
          chainId: l1ChainId,
        };
      });
  }, [configuredAssets, depositPoolAddresses, distributorV2Address, l1ChainId, pastBlockNumber]);

  const { data: distributorPoolResultsPast } = useContractReads({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: distributorPoolContractsPast as any,
    allowFailure: true,
    blockNumber: pastBlockNumber ?? undefined,
    query: { enabled: distributorPoolContractsPast.length > 0 && !!pastBlockNumber },
  });

  // --- DISTRIBUTED REWARDS (protocol-truth pool shares) ---
  const distributedRewardsContracts = useMemo(() => {
    if (!distributorV2Address) return [];
    return configuredAssets
      .filter((assetConfig) => depositPoolAddresses[assetConfig.metadata.symbol])
      .map((assetConfig) => ({
        address: distributorV2Address,
        abi: DistributorV2Abi,
        functionName: 'distributedRewards',
        args: [BigInt(0), depositPoolAddresses[assetConfig.metadata.symbol]!],
        chainId: l1ChainId,
      }));
  }, [configuredAssets, depositPoolAddresses, distributorV2Address, l1ChainId]);

  const { data: distributedRewardsNow } = useContractReads({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: distributedRewardsContracts as any,
    allowFailure: true,
    query: { enabled: distributedRewardsContracts.length > 0 },
  });

  const distributedRewardsContractsPast = useMemo(() => {
    if (!distributorV2Address || pastBlockNumber == null) return [];
    return configuredAssets
      .filter((assetConfig) => depositPoolAddresses[assetConfig.metadata.symbol])
      .map((assetConfig) => ({
        address: distributorV2Address,
        abi: DistributorV2Abi,
        functionName: 'distributedRewards',
        args: [BigInt(0), depositPoolAddresses[assetConfig.metadata.symbol]!],
        chainId: l1ChainId,
      }));
  }, [configuredAssets, depositPoolAddresses, distributorV2Address, l1ChainId, pastBlockNumber]);

  const { data: distributedRewardsPast } = useContractReads({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: distributedRewardsContractsPast as any,
    allowFailure: true,
    blockNumber: pastBlockNumber ?? undefined,
    query: { enabled: distributedRewardsContractsPast.length > 0 && !!pastBlockNumber },
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

  // ✅ REAL YIELD TRACKING: Get Distributor.depositPools() data for yield calculation
  const distributorPoolContracts = useMemo(() => {
    if (!distributorV2Address) return [];
    
    return configuredAssets
      .filter((assetConfig) => {
        const symbol = assetConfig.metadata.symbol;
        const address = depositPoolAddresses[symbol];
        return address && address !== '0x0000000000000000000000000000000000000000';
      })
      .map((assetConfig) => {
        const symbol = assetConfig.metadata.symbol;
        const depositPoolAddress = depositPoolAddresses[symbol]!;
        
        return {
          address: distributorV2Address,
          abi: DistributorV2Abi,
          functionName: 'depositPools',
          args: [BigInt(0), depositPoolAddress], // Pool index 0 (Capital), deposit pool address
          chainId: l1ChainId,
        };
      });
  }, [configuredAssets, depositPoolAddresses, distributorV2Address, l1ChainId]);

  const { 
    data: distributorPoolResults, 
    refetch: refetchDistributorPools 
  } = useContractReads({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: distributorPoolContracts as any,
    allowFailure: true,
    query: {
      enabled: distributorPoolContracts.length > 0,
      refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    },
  });

  // ✅ ATOKEN BALANCE CALLS: For AAVE assets, get current aToken balance to calculate yield
  const aTokenBalanceContracts = useMemo(() => {
    if (!distributorV2Address || !distributorPoolResults) {
      console.log('⚠️ [ATOKEN SETUP] Cannot create aToken contracts:', {
        hasDistributorAddress: !!distributorV2Address,
        hasDistributorResults: !!distributorPoolResults
      });
      return [];
    }
    
    const contracts = configuredAssets
      .map((assetConfig, index) => {
        const distributorPoolResult = distributorPoolResults[index];
        const symbol = assetConfig.metadata.symbol;
        
        console.log(`🔍 [ATOKEN SETUP] Checking ${symbol}:`, {
          hasResult: !!distributorPoolResult,
          status: distributorPoolResult?.status,
          isArray: Array.isArray(distributorPoolResult?.result)
        });
        
        // Check if this is an AAVE strategy with valid aToken address
        if (distributorPoolResult?.status === 'success' && Array.isArray(distributorPoolResult.result)) {
          const [, , , , , strategy, aToken] = distributorPoolResult.result;
          
          console.log(`📋 [ATOKEN SETUP] ${symbol} pool data:`, {
            strategy: strategy === 0 ? 'NO_YIELD' : strategy === 1 ? 'NONE' : strategy === 2 ? 'AAVE' : 'UNKNOWN',
            strategyNum: strategy,
            aToken,
            isAAVE: strategy === 2
          });
          
          // Strategy: 0 = NO_YIELD (rebasing, e.g. stETH), 1 = NONE (disabled), 2 = AAVE (yield-generating)
          if (strategy === 2 && aToken && aToken !== '0x0000000000000000000000000000000000000000') {
            const contract = {
              address: aToken as `0x${string}`,
              abi: ERC20Abi,
              functionName: 'balanceOf',
              args: [depositPoolAddresses[assetConfig.metadata.symbol]!],
              chainId: l1ChainId,
            };
            
            console.log(`✅ [ATOKEN SETUP] Created contract for ${symbol}:`, {
              aToken,
              depositPool: depositPoolAddresses[assetConfig.metadata.symbol],
              chainId: l1ChainId
            });
            
            return contract;
          }
        }
        return null;
      })
      .filter(Boolean);
    
    console.log(`📊 [ATOKEN SETUP] Total aToken contracts created: ${contracts.length}`, {
      contracts: contracts.map((c) => ({
        address: c && 'address' in c ? c.address : 'unknown',
        function: c && 'functionName' in c ? c.functionName : 'unknown'
      }))
    });
    
    return contracts;
  }, [configuredAssets, distributorPoolResults, depositPoolAddresses, distributorV2Address, l1ChainId]);

  const { 
    data: aTokenBalanceResults, 
    isLoading: isLoadingATokenBalances,
    error: aTokenBalanceError,
    refetch: refetchATokenBalances 
  } = useContractReads({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: aTokenBalanceContracts as any,
    allowFailure: true,
    query: {
      enabled: aTokenBalanceContracts.length > 0,
      refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    },
  });

  // ✅ HISTORICAL ATOKEN BALANCES (~7d ago)
  const aTokenBalanceContractsPast = useMemo(() => {
    if (!distributorV2Address || !distributorPoolResults || pastBlockNumber == null) return [];
    const contracts = configuredAssets.map((assetConfig, index) => {
      const distributorPoolResult = distributorPoolResults[index];
      if (!distributorPoolResult || distributorPoolResult.status !== 'success') return null;
      const tuple = distributorPoolResult.result as readonly [string, string, bigint, bigint, bigint, number, string, boolean];
      const aToken = tuple[6];
      const depositPoolAddress = depositPoolAddresses[assetConfig.metadata.symbol];
      if (!depositPoolAddress || aToken === '0x0000000000000000000000000000000000000000') return null;
      return {
        address: aToken as `0x${string}`,
        abi: ERC20Abi,
        functionName: 'balanceOf',
        args: [depositPoolAddress],
        chainId: l1ChainId,
      };
    }).filter(Boolean) as unknown[];
    return contracts;
  }, [configuredAssets, distributorPoolResults, depositPoolAddresses, distributorV2Address, l1ChainId, pastBlockNumber]);

  const { data: aTokenBalanceResultsPast } = useContractReads({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: aTokenBalanceContractsPast as any,
    allowFailure: true,
    blockNumber: pastBlockNumber ?? undefined,
    query: { enabled: aTokenBalanceContractsPast.length > 0 && !!pastBlockNumber },
  });

  // Debug aToken balance results
  React.useEffect(() => {
    console.log('🔄 [ATOKEN RESULTS] Balance call status:', {
      isLoading: isLoadingATokenBalances,
      hasResults: !!aTokenBalanceResults,
      resultsLength: aTokenBalanceResults?.length || 0,
      contractsLength: aTokenBalanceContracts.length,
      error: aTokenBalanceError,
      results: aTokenBalanceResults?.map((r, i) => ({
        index: i,
        status: r?.status,
        hasResult: !!r?.result,
        result: r?.result?.toString(),
        error: r?.status === 'failure' ? r?.error?.message : null
      }))
    });
  }, [aTokenBalanceResults, isLoadingATokenBalances, aTokenBalanceContracts.length, aTokenBalanceError]);


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

  // ✅ REAL V7 Protocol APR Calculation using actual yield data from Distributor contract
  const calculateV7APR = useMemo(() => {
    // ⏳ CHECK #1: Wait for historical data
    if (pastBlockNumber == null || pastBlockTimestamp == null) {
      console.log('⏳ [APR CALC] Waiting for past block discovery (7d window)');
      return null;
    }
    if (!distributorPoolResultsPast || distributorPoolResultsPast.length === 0) {
      console.log('⏳ [APR CALC] Waiting for distributor past snapshots...');
      return null;
    }
    if (!distributedRewardsNow || !distributedRewardsPast) {
      console.log('⏳ [APR CALC] Waiting for distributed rewards data...');
      return null;
    }
    if (!annualEmissions || isLoadingAnnualEmissions) {
      console.log('⏳ [APR CALC] Waiting for annual emissions...', {
        annualEmissions,
        isLoadingAnnualEmissions,
        error: annualEmissionsError
      });
      return null;
    }

    const annualEmissionsMOR = annualEmissions;

    console.log('🔢 [APR CALC] COMPREHENSIVE DEBUG - V7 APR CALCULATION:', {
      networkEnvironment,
      annualEmissionsMOR,
      distributorV2Address,
      rewardPoolV2Address,
      contractAddresses: {
        distributorV2: distributorV2Address,
        rewardPoolV2: rewardPoolV2Address,
        depositPools: Object.fromEntries(
          configuredAssets.map(asset => [
            asset.metadata.symbol,
            depositPoolAddresses[asset.metadata.symbol]
          ])
        )
      },
      contractCallResults: {
        distributorPools: distributorPoolResults?.map((r, i) => ({
          asset: configuredAssets[i]?.metadata.symbol,
          status: r?.status,
          hasResult: !!r?.result,
          resultLength: Array.isArray(r?.result) ? r.result.length : 'not array',
          error: r?.status === 'failure' ? r.error?.message : null
        })),
        aTokenBalances: aTokenBalanceResults?.map((r, i) => ({
          index: i,
          status: r?.status,
          hasResult: !!r?.result,
          error: r?.status === 'failure' ? r.error?.message : null
        })),
        annualEmissions: {
          value: annualEmissionsMOR,
          isLoading: isLoadingAnnualEmissions,
          error: annualEmissionsError
        }
      },
      contractCounts: {
        configured: configuredAssets.length,
        distributorContracts: distributorPoolContracts.length,
        aTokenContracts: aTokenBalanceContracts.length,
        distributorResults: distributorPoolResults?.length || 0,
        aTokenResults: aTokenBalanceResults?.length || 0
      }
    });

    const aprResults: Record<string, string> = {};
    const assetYields: Record<string, number> = {}; // USD-denominated yields
    let totalYieldUSD = 0;
    
    // Step 1: Calculate USD yield for each asset using REAL Distributor data
    configuredAssets.forEach((assetConfig, index) => {
      const symbol = assetConfig.metadata.symbol;
      const contract = contractData[symbol as keyof typeof contractData];
      const distributorPoolResult = distributorPoolResults?.[index];
      
      console.log(`🔍 ASSET YIELD DEBUG [${symbol}] - STEP 1:`, {
        hasContractData: !!contract?.data,
        contractDataRaw: contract?.data?.toString(),
        hasDistributorResult: !!distributorPoolResult,
        distributorStatus: distributorPoolResult?.status,
        distributorError: distributorPoolResult?.status === 'failure' ? distributorPoolResult.error?.message : null,
        assetConfig: {
          symbol,
          decimals: assetConfig.metadata.decimals,
          disabled: assetConfig.metadata.disabled
        }
      });

      if (!contract?.data || distributorPoolResult?.status !== 'success') {
        console.log(`❌ SKIPPING ASSET [${symbol}]:`, {
          reason: !contract?.data ? 'No contract data' : 'Distributor call failed',
          contractData: !!contract?.data,
          distributorStatus: distributorPoolResult?.status
        });
        assetYields[symbol] = 0;
        return;
      }

      try {
        // Parse Distributor.depositPools() result - the REAL v7 protocol data!
        const distributorResult = distributorPoolResult.result as readonly [string, string, bigint, bigint, bigint, number, string, boolean];
        const [token, chainLinkPath, tokenPrice, deposited, lastUnderlyingBalance, strategy, aToken, isExist] = distributorResult;
        
        console.log(`🔍 ASSET YIELD DEBUG [${symbol}] - STEP 2 PARSED DATA:`, {
          token,
          chainLinkPath,
          tokenPriceRaw: tokenPrice.toString(),
          depositedRaw: deposited.toString(),
          lastUnderlyingBalanceRaw: lastUnderlyingBalance.toString(),
          strategy,
          strategyName: strategy === 0 ? 'NONE' : strategy === 1 ? 'NO_YIELD' : strategy === 2 ? 'AAVE' : 'UNKNOWN',
          aToken,
          isExist
        });
        
        const assetDecimals = assetConfig.metadata.decimals;
        const priceUSD = Number(formatUnits(tokenPrice as bigint, 18)); // Price from Distributor is normalized to 18 decimals
        
        let currentBalance = 0;
        const lastBalance = Number(formatUnits(lastUnderlyingBalance as bigint, assetDecimals));
        
        console.log(`🔍 ASSET YIELD DEBUG [${symbol}] - STEP 3 PARSED VALUES:`, {
          assetDecimals,
          priceUSD,
          lastBalance,
          lastUnderlyingBalanceWei: lastUnderlyingBalance.toString()
        });
        
        if (strategy === 2 && aToken && aToken !== '0x0000000000000000000000000000000000000000') {
          // AAVE strategy: get current aToken balance
          const aTokenIndex = aTokenBalanceContracts.findIndex(contract => 
            contract && 'address' in contract && contract.address.toLowerCase() === aToken.toLowerCase()
          );
          
          console.log(`🔍 AAVE STRATEGY DEBUG [${symbol}]:`, {
            aToken,
            aTokenIndex,
            aTokenContractsLength: aTokenBalanceContracts.length,
            aTokenBalanceResultsLength: aTokenBalanceResults?.length || 0,
            aTokenResult: aTokenIndex >= 0 ? {
              status: aTokenBalanceResults?.[aTokenIndex]?.status,
              hasResult: !!aTokenBalanceResults?.[aTokenIndex]?.result,
              rawResult: aTokenBalanceResults?.[aTokenIndex]?.result?.toString(),
              error: aTokenBalanceResults?.[aTokenIndex]?.status === 'failure' ? aTokenBalanceResults[aTokenIndex].error?.message : null
            } : 'aToken not found in contracts'
          });
          
          if (aTokenIndex >= 0 && aTokenBalanceResults?.[aTokenIndex]?.status === 'success') {
            currentBalance = Number(formatUnits(aTokenBalanceResults[aTokenIndex].result as bigint, assetDecimals));
            console.log(`✅ AAVE BALANCE FOUND [${symbol}]:`, {
              rawBalance: aTokenBalanceResults[aTokenIndex].result?.toString(),
              formattedBalance: currentBalance
            });
          } else {
            console.log(`❌ AAVE BALANCE NOT FOUND [${symbol}]:`, {
              aTokenIndex,
              indexFound: aTokenIndex >= 0,
              hasResults: !!aTokenBalanceResults,
              resultStatus: aTokenIndex >= 0 ? aTokenBalanceResults?.[aTokenIndex]?.status : 'N/A'
            });
          }
        } else {
          // NO_YIELD strategy (stETH): use current deposited balance
          currentBalance = Number(formatUnits(contract.data as bigint, assetDecimals));
          console.log(`📊 NO_YIELD STRATEGY [${symbol}]:`, {
            rawContractData: contract.data.toString(),
            formattedBalance: currentBalance,
            strategy: strategy === 1 ? 'NO_YIELD' : strategy === 0 ? 'NONE' : 'UNKNOWN'
          });
        }
        
        // Calculate yield: current balance - last recorded balance (this is the key insight!)
        const yieldTokens = Math.max(0, currentBalance - lastBalance);
        const yieldUSD = yieldTokens * priceUSD;
        
        console.log(`🧮 YIELD CALCULATION [${symbol}]:`, {
          currentBalance,
          lastBalance,
          yieldTokens,
          yieldIsPositive: yieldTokens > 0,
          priceUSD,
          yieldUSD,
          calculationFormula: `max(0, ${currentBalance} - ${lastBalance}) * ${priceUSD}`,
          strategy: strategy === 2 ? 'AAVE' : strategy === 1 ? 'NO_YIELD' : strategy === 0 ? 'NONE' : 'UNKNOWN',
          aToken: strategy === 2 ? aToken : 'N/A'
        });
        
        assetYields[symbol] = yieldUSD;
        totalYieldUSD += yieldUSD;
        
      } catch (error) {
        console.error(`❌ Error calculating yield for ${symbol}:`, error);
        assetYields[symbol] = 0;
      }
    });

    // Summary after yield calculation
    console.log(`📊 YIELD CALCULATION SUMMARY:`, {
      totalYieldUSD,
      assetYields,
      hasAnyYield: totalYieldUSD > 0,
      assetsWithYield: Object.entries(assetYields).filter(([, yieldValue]) => yieldValue > 0).map(([symbol]) => symbol),
      yieldDataReliable: totalYieldUSD > 100, // Reliable if total yield > $100
      fallbackReason: totalYieldUSD <= 100 ? 'Yield too small for reliable calculation' : 'Yield-based calculation'
    });

    // Step 2: Compute protocol-truth shares from distributedRewards deltas (7d window)
    let rewardsShareByAsset: Record<string, number> | null = null;
    if (distributedRewardsNow && distributedRewardsPast && distributedRewardsNow.length === configuredAssets.length) {
      const deltas: number[] = configuredAssets.map((assetConfig, i) => {
        const nowVal = distributedRewardsNow?.[i]?.status === 'success' 
          ? Number(formatUnits(distributedRewardsNow[i].result as bigint, 18)) 
          : 0;
        const pastVal = distributedRewardsPast?.[i]?.status === 'success' 
          ? Number(formatUnits(distributedRewardsPast[i].result as bigint, 18)) 
          : 0;
        return Math.max(0, nowVal - pastVal);
      });
      
      const totalDelta = deltas.reduce((a, b) => a + b, 0);
      
      if (totalDelta > 0) {
        rewardsShareByAsset = {};
        configuredAssets.forEach((assetConfig, i) => {
          rewardsShareByAsset![assetConfig.metadata.symbol] = deltas[i] / totalDelta;
        });
        console.log('✅ [APR CALC] Using distributedRewards-based distribution');
      }
    }

    const useRewardsShares = !!rewardsShareByAsset;
    
    // Step 3: Calculate APR for each asset using protocol shares and annual emissions
    Object.entries(assetYields).forEach(([symbol, assetYieldUSD]) => {
      const rateData = rewardPoolRateData[symbol as keyof typeof rewardPoolRateData];
      
      if (!rateData?.data || !Array.isArray(rateData.data)) {
        aprResults[symbol] = 'N/A';
        return;
      }

      const [, , totalVirtualDeposited] = rateData.data;
      const assetConfig = configuredAssets.find(config => config.metadata.symbol === symbol);
      const decimals = assetConfig?.metadata.decimals || 18;
      
      // Get actual deposited amount (not virtual)
      const contract = contractData[symbol as keyof typeof contractData];
      const totalActualDeposited = contract?.data 
        ? Number(formatUnits(contract.data as bigint, decimals))
        : 0;
      
      const totalVirtual = Number(formatUnits(totalVirtualDeposited as bigint, decimals));
      const tvlForAPR = totalActualDeposited > 0 ? totalActualDeposited : totalVirtual;
      
      // Get asset price from Distributor
      const distributorPoolResult = distributorPoolResults?.find((_, idx) => 
        configuredAssets[idx]?.metadata.symbol === symbol
      );
      const assetPriceUSD = distributorPoolResult?.status === 'success' && Array.isArray(distributorPoolResult.result)
        ? Number(formatUnits(distributorPoolResult.result[2] as bigint, 18))
        : 1.0;
      
      if (tvlForAPR > 0 && annualEmissionsMOR && annualEmissionsMOR > 0) {
        // Use distributedRewards share if available, otherwise fall back to yield share
        const share = useRewardsShares 
          ? (rewardsShareByAsset![symbol] ?? 0) 
          : (totalYieldUSD > 0 ? assetYieldUSD / totalYieldUSD : 0);
        
        const assetAnnualShareMOR = share * annualEmissionsMOR;
        
        // Calculate APR in USD terms with MOR price
        let aprPercentage: number;
        if (morPriceOption && morPriceOption > 0) {
          const annualRewardsUSD = assetAnnualShareMOR * morPriceOption;
          const tvlUSD = tvlForAPR * assetPriceUSD;
          aprPercentage = tvlUSD > 0 ? (annualRewardsUSD / tvlUSD) * 100 : 0;
        } else {
          // Fallback: APR in MOR terms
          aprPercentage = (assetAnnualShareMOR / tvlForAPR) * 100;
        }
        
        // Special case for wBTC: If APR is extremely low or 0 due to minimal/no AAVE yield activity,
        // show 0.01% instead of N/A since the pool is still active and earning rewards.
        // wBTC on AAVE generates very low yield, so 7-day windows may show 0 yield even though rewards are distributed.
        if (symbol === 'wBTC' && aprPercentage >= 0 && aprPercentage < 0.01 && tvlForAPR > 0) {
          aprResults[symbol] = '0.01%';
          console.log(`📊 [APR CALC] wBTC - Applied minimum APR floor (0.01%) due to low/zero AAVE yield in 7-day window`, {
            calculatedAPR: aprPercentage,
            tvl: tvlForAPR,
            reason: 'wBTC AAVE yield is too low to show meaningful change in 7 days'
          });
        } else {
          aprResults[symbol] = aprPercentage > 0.01 ? `${aprPercentage.toFixed(2)}%` : 'N/A';
        }
        
        console.log(`✅ [APR CALC] ${symbol} - REAL YIELD-BASED APR:`, {
          poolShare: (share * 100).toFixed(2) + '%',
          annualRewardsMOR: assetAnnualShareMOR.toFixed(2) + ' MOR/year',
          morPrice: morPriceOption || 'not provided',
          tvlUSD: (tvlForAPR * assetPriceUSD).toFixed(2),
          finalAPR: aprResults[symbol],
          calculationMethod: morPriceOption ? 'USD-based (actual capital)' : 'MOR-based fallback'
        });
      } else {
        aprResults[symbol] = 'N/A';
      }
    });

    return aprResults;
  }, [
    networkEnvironment,
    contractData,
    rewardPoolRateData,
    configuredAssets,
    rewardPoolV2Address,
    distributorV2Address,
    distributorPoolResults,
    distributorPoolResultsPast,
    aTokenBalanceResults,
    aTokenBalanceResultsPast,
    aTokenBalanceContracts,
    distributedRewardsNow,
    distributedRewardsPast,
    annualEmissions,
    isLoadingAnnualEmissions,
    annualEmissionsError,
    pastBlockNumber,
    pastBlockTimestamp,
    depositPoolAddresses,
    morPriceOption
  ]);

  // Calculate virtual stake data for fallback use (available to both APR calc and asset data)
  const virtualStakeByAsset = useMemo(() => {
    const stakeData: Record<string, number> = {};
    configuredAssets.forEach((assetConfig) => {
      const symbol = assetConfig.metadata.symbol;
      const decimals = assetConfig.metadata.decimals;
      const rateData = rewardPoolRateData[symbol as keyof typeof rewardPoolRateData];

      if (rateData?.data && Array.isArray(rateData.data)) {
        const [, , totalVirtualDeposited] = rateData.data;
        const totalVirtual = Number(formatUnits(totalVirtualDeposited as bigint, decimals));
        stakeData[symbol] = totalVirtual;

        // Special WBTC virtual stake logging
        if (symbol === 'wBTC') {
          console.log(`🐋 WBTC VIRTUAL STAKE:`, {
            rawTotalVirtualDeposited: totalVirtualDeposited?.toString(),
            formattedTotalVirtual: totalVirtual,
            decimals
          });
        }
      } else {
        stakeData[symbol] = 0;

        // Special WBTC logging when no data
        if (symbol === 'wBTC') {
          console.log(`🐋 WBTC NO VIRTUAL STAKE DATA:`, {
            rateDataExists: !!rateData,
            rateDataIsArray: Array.isArray(rateData?.data),
            rateData
          });
        }
      }
    });
    return stakeData;
  }, [configuredAssets, rewardPoolRateData]);

  // Generate asset pool data dynamically
  const assetsData = useMemo(() => {
    const result: Partial<Record<AssetSymbol, AssetPoolData>> = {};

    console.log('🔧 ASSET DATA GENERATION - START:', {
      totalAssets: configuredAssets.length,
      assetSymbols: configuredAssets.map(a => a.metadata.symbol),
      calculateV7APR: calculateV7APR ? Object.keys(calculateV7APR) : 'null (still loading dependencies)'
    });

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

      // Special logging for WBTC
      if (symbol === 'wBTC') {
        const rewardRateData = rewardPoolRateData[symbol as keyof typeof rewardPoolRateData];
        console.log(`🐋 WBTC COMPLETE DEBUG:`, {
          symbol,
          rawContractData: contract?.data,
          rawContractDataFormatted: contract?.data ? parseFloat(formatUnits(contract.data as bigint, decimals)) : 'N/A',
          virtualStake: virtualStakeByAsset?.[symbol] || 0,
          hasDepositPool: hasDepositPoolAddress,
          contractStatus: {
            exists: !!contract,
            hasData: !!contract?.data,
            isLoading: contract?.isLoading,
            error: contract?.error?.message || null
          },
          rewardRateStatus: {
            exists: !!rewardRateData,
            hasData: !!rewardRateData?.data,
            isLoading: rewardRateData?.isLoading,
            error: rewardRateData?.error?.message || null
          },
          aprCalculation: {
            calculateV7APRExists: !!calculateV7APR,
            hasWBTCInAPR: calculateV7APR ? 'wBTC' in calculateV7APR : false,
            aprValue: calculateV7APR?.['wBTC'] || 'not calculated'
          },
          finalLoadingState: contract?.isLoading || rewardRateData?.isLoading || false,
          decimals
        });
      }
      
      if (!hasDepositPoolAddress) {
        // Asset doesn't have a deposit pool contract
        result[symbol] = {
          totalStaked: 'N/A',
          apr: 'Coming Soon',
          isLoading: false,
          error: null
        };
      } else if (!contract) {
        // Asset has deposit pool address but contract call is not available
        result[symbol] = {
          totalStaked: '0',
          apr: 'N/A',
          isLoading: false,
          error: new Error(`Contract call not available for ${symbol}`)
        };
      } else if (contract.data === undefined) {
        // Asset has deposit pool and contract, but no data yet (likely 0 or loading)
        // Try to use virtual stake data as fallback if available
        const virtualStake = virtualStakeByAsset?.[symbol] || 0;
        const rewardRateData = rewardPoolRateData[symbol as keyof typeof rewardPoolRateData];
        result[symbol] = {
          totalStaked: virtualStake > 0 ? virtualStake.toString() : '0', // Use virtual stake if available
          apr: (calculateV7APR && calculateV7APR[symbol]) || 'N/A',
          isLoading: contract.isLoading || rewardRateData?.isLoading || false,
          error: (contract.error || rewardRateData?.error) as Error | null
        };
      } else {
        // Asset has valid data - use correct decimals from config
        const rawValue = parseFloat(formatUnits(contract.data as bigint, decimals));

        // Use virtual stake data if contract value is 0 or very small
        const virtualStake = virtualStakeByAsset?.[symbol] || 0;
        const useVirtualStake = rawValue === 0 && virtualStake > 0;
        const displayValue = useVirtualStake ? virtualStake : rawValue;

        const totalStaked = displayValue.toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: displayValue < 0.01 ? 4 : 2
        });

        const rewardRateData = rewardPoolRateData[symbol as keyof typeof rewardPoolRateData];

        // Special WBTC final value logging
        if (symbol === 'wBTC') {
          console.log(`🐋 WBTC FINAL VALUE:`, {
            rawValue,
            virtualStake,
            useVirtualStake,
            displayValue,
            totalStaked,
            decimals
          });
        }

        result[symbol] = {
          totalStaked,
          apr: (calculateV7APR && calculateV7APR[symbol]) || 'N/A',
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

  // Create refetch functions (now using dynamic system with yield tracking)
  const refetchAsset = useCallback(() => {
    // Refetch all contract data needed for proper APR calculation
    refetchDeposits();
    refetchRewardRates();
    refetchDistributorPools();
    refetchATokenBalances();
  }, [refetchDeposits, refetchRewardRates, refetchDistributorPools, refetchATokenBalances]);

  const refetchRewards = useCallback(() => {
    // Refetch all reward-related data including yield tracking
    refetchRewardRates();
    refetchDistributorPools();
    refetchATokenBalances();
  }, [refetchRewardRates, refetchDistributorPools, refetchATokenBalances]);

  const refetchAll = useCallback(() => {
    // Refetch all contract data in one batch
    refetchDeposits();
    refetchRewardRates();
    refetchDistributorPools();
    refetchATokenBalances();
  }, [refetchDeposits, refetchRewardRates, refetchDistributorPools, refetchATokenBalances]);

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
