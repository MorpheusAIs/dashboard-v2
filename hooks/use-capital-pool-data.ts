"use client";

import { useMemo, useCallback } from 'react';
import React from 'react';
import { useContractReads, useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import { NetworkEnvironment, getContractAddress, testnetChains, mainnetChains } from '@/config/networks';
import { getAssetsForNetwork, type AssetSymbol } from '@/components/capital/constants/asset-config';

// Import ABIs
import DepositPoolAbi from '@/app/abi/DepositPool.json'; // Use the generic ABI that has all functions
import RewardPoolV2Abi from '@/app/abi/RewardPoolV2.json'; // For proper emission rate calculation
import DistributorV2Abi from '@/app/abi/DistributorV2.json'; // For yield tracking
import ERC20Abi from '@/app/abi/ERC20.json'; // For aToken balance calls

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

  // Get RewardPoolV2 and DistributorV2 contract addresses
  const rewardPoolV2Address = useMemo(() => {
    return getContractAddress(l1ChainId, 'rewardPoolV2', networkEnvironment) as `0x${string}` | undefined;
  }, [l1ChainId, networkEnvironment]);

  const distributorV2Address = useMemo(() => {
    return getContractAddress(l1ChainId, 'distributorV2', networkEnvironment) as `0x${string}` | undefined;
  }, [l1ChainId, networkEnvironment]);

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
    if (!distributorV2Address || !distributorPoolResults) return [];
    
    return configuredAssets
      .map((assetConfig, index) => {
        const distributorPoolResult = distributorPoolResults[index];
        
        // Check if this is an AAVE strategy with valid aToken address
        if (distributorPoolResult?.status === 'success' && Array.isArray(distributorPoolResult.result)) {
          const [, , , , , strategy, aToken] = distributorPoolResult.result;
          
          // Strategy: 0 = NONE, 1 = NO_YIELD, 2 = AAVE
          if (strategy === 2 && aToken && aToken !== '0x0000000000000000000000000000000000000000') {
            return {
              address: aToken as `0x${string}`,
              abi: ERC20Abi,
              functionName: 'balanceOf',
              args: [distributorV2Address], // Get aToken balance held by Distributor
              chainId: l1ChainId,
            };
          }
        }
        return null;
      })
      .filter(Boolean);
  }, [configuredAssets, distributorPoolResults, distributorV2Address, l1ChainId]);

  const { 
    data: aTokenBalanceResults, 
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

    // Note: Daily emissions are now fetched server-side via API endpoint
    // This calculation now focuses only on APR calculation, not total emissions
    const totalDailyEmissions = 0; // Placeholder - emissions fetched via API

    console.log('🔢 COMPREHENSIVE DEBUG - V7 APR CALCULATION:', {
      networkEnvironment,
      totalDailyEmissions,
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
        dailyEmissions: {
          note: 'Daily emissions now fetched via server-side API endpoint',
          parsedValue: totalDailyEmissions
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

    // Step 2: Choose distribution method based on yield data reliability
    const useYieldBasedDistribution = totalYieldUSD > 100; // Only use yield-based if total yield > $100
    
    console.log(`🔄 DISTRIBUTION METHOD SELECTED:`, {
      method: useYieldBasedDistribution ? 'Yield-based' : 'Stake-weighted fallback',
      totalYieldUSD,
      threshold: 100,
      reason: useYieldBasedDistribution ? 'Sufficient yield data' : 'Yield data too small/unreliable'
    });

    if (useYieldBasedDistribution) {
      // ✅ YIELD-BASED DISTRIBUTION (V7 Protocol Standard)
      Object.entries(assetYields).forEach(([symbol, assetYieldUSD]) => {
        const rateData = rewardPoolRateData[symbol as keyof typeof rewardPoolRateData];
        
        if (!rateData?.data || !Array.isArray(rateData.data) || assetYieldUSD <= 0) {
          aprResults[symbol] = 'N/A';
          return;
        }

        try {
          const [, , totalVirtualDeposited] = rateData.data;
          const assetConfig = configuredAssets.find(config => config.metadata.symbol === symbol);
          const decimals = assetConfig?.metadata.decimals || 18;
          const totalVirtual = Number(formatUnits(totalVirtualDeposited as bigint, decimals));
          
          if (totalVirtual > 0 && totalDailyEmissions > 0) {
            const assetRewardShare = (assetYieldUSD / totalYieldUSD) * totalDailyEmissions;
            const annualRewards = assetRewardShare * 365;
            const aprPercentage = Math.min((annualRewards / totalVirtual) * 100, 1000);
            
            aprResults[symbol] = aprPercentage > 0.01 ? `${aprPercentage.toFixed(2)}%` : 'N/A';
            
            console.log(`✅ YIELD-BASED APR [${symbol}]:`, {
              yieldShare: (assetYieldUSD / totalYieldUSD * 100).toFixed(2) + '%',
              dailyRewards: assetRewardShare.toFixed(2),
              finalAPR: aprResults[symbol]
            });
          } else {
            aprResults[symbol] = 'N/A';
          }
        } catch (error) {
          console.error(`❌ Error in yield-based calculation for ${symbol}:`, error);
          aprResults[symbol] = 'N/A';
        }
      });
    } else {
      // 🔄 STAKE-WEIGHTED FALLBACK DISTRIBUTION
      // Calculate total virtual stake across all pools for proportional distribution
      let totalVirtualStakeAcrossPools = 0;
      const localVirtualStakeByAsset: Record<string, number> = {};

      configuredAssets.forEach((assetConfig) => {
        const symbol = assetConfig.metadata.symbol;
        const decimals = assetConfig.metadata.decimals;
        const rateData = rewardPoolRateData[symbol as keyof typeof rewardPoolRateData];

        if (rateData?.data && Array.isArray(rateData.data)) {
          const [, , totalVirtualDeposited] = rateData.data;
          const totalVirtual = Number(formatUnits(totalVirtualDeposited as bigint, decimals));
          localVirtualStakeByAsset[symbol] = totalVirtual;
          totalVirtualStakeAcrossPools += totalVirtual;
        } else {
          localVirtualStakeByAsset[symbol] = 0;
        }
      });

      console.log(`📊 STAKE-WEIGHTED DISTRIBUTION DATA:`, {
        totalVirtualStakeAcrossPools,
        localVirtualStakeByAsset,
        totalDailyEmissions
      });

      // Distribute rewards proportionally based on virtual stake
      Object.entries(localVirtualStakeByAsset).forEach(([symbol, virtualStake]) => {
        try {
          if (virtualStake > 0 && totalVirtualStakeAcrossPools > 0 && totalDailyEmissions > 0) {
            const stakeShare = virtualStake / totalVirtualStakeAcrossPools;
            const assetDailyRewards = stakeShare * totalDailyEmissions;
            const annualRewards = assetDailyRewards * 365;
            const aprPercentage = (annualRewards / virtualStake) * 100;

            // Apply reasonable caps for this fallback method
            const cappedAPR = Math.min(aprPercentage, 50); // Lower cap for fallback method

            aprResults[symbol] = cappedAPR > 0.01 ? `${cappedAPR.toFixed(2)}%` : 'N/A';

            console.log(`✅ STAKE-WEIGHTED APR [${symbol}]:`, {
              virtualStake,
              stakeShare: (stakeShare * 100).toFixed(2) + '%',
              dailyRewards: assetDailyRewards.toFixed(2),
              rawAPR: aprPercentage.toFixed(2) + '%',
              cappedAPR: aprResults[symbol],
              method: 'Stake-weighted fallback'
            });
          } else {
            aprResults[symbol] = 'N/A';
            console.log(`❌ NO STAKE DATA [${symbol}]:`, { virtualStake, totalVirtualStakeAcrossPools });
          }
        } catch (error) {
          console.error(`❌ Error in stake-weighted calculation for ${symbol}:`, error);
          aprResults[symbol] = 'N/A';
        }
      });
    }

    return aprResults;
  }, [
    networkEnvironment,
    contractData,
    rewardPoolRateData,
    configuredAssets,
    rewardPoolV2Address,
    distributorV2Address,
    distributorPoolResults,
    aTokenBalanceResults,
    aTokenBalanceContracts
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
        console.debug(`🐋 WBTC DEBUG:`, {
          symbol,
          rawContractData: contract?.data,
          virtualStake: virtualStakeByAsset?.[symbol] || 0,
          hasDepositPool: hasDepositPoolAddress,
          contractError: contract?.error?.message,
          isLoading: contract?.isLoading
        });
      }
      
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
        // Try to use virtual stake data as fallback if available
        const virtualStake = virtualStakeByAsset?.[symbol] || 0;
        const rewardRateData = rewardPoolRateData[symbol as keyof typeof rewardPoolRateData];
        result[symbol] = {
          totalStaked: virtualStake > 0 ? virtualStake.toString() : '0', // Use virtual stake if available
          apy: calculateV7APR[symbol] || 'N/A',
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
          maximumFractionDigits: displayValue < 0.01 ? 6 : 2
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
