"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useAccount, useChainId, usePublicClient, useReadContract } from "wagmi";
import { getContract } from "viem";
import {
  testnetChains,
  mainnetChains,
  getContractAddress,
  type NetworkEnvironment,
} from "@/config/networks";
import ERC20Abi from "@/app/abi/ERC20.json";
import DepositPoolAbi from "@/app/abi/DepositPool.json";
import { type DynamicContract, type PoolInfoData } from "./types";

const PUBLIC_POOL_ID = BigInt(0);

// ============================================================================
// Context State Interface
// ============================================================================

interface CapitalNetworkState {
  // Network info
  networkEnv: NetworkEnvironment;
  l1ChainId?: number;
  l2ChainId?: number;
  userAddress?: `0x${string}`;

  // V2 Contract Addresses
  distributorV2Address?: `0x${string}`;
  rewardPoolV2Address?: `0x${string}`;
  l1SenderV2Address?: `0x${string}`;

  // Asset-specific addresses
  stETHDepositPoolAddress?: `0x${string}`;
  stEthContractAddress?: `0x${string}`;
  linkDepositPoolAddress?: `0x${string}`;
  linkTokenAddress?: `0x${string}`;
  morContractAddress?: `0x${string}`;

  // Pool info (from stETH deposit pool - shared for chart timestamp generation)
  poolInfo?: PoolInfoData;
  isLoadingPoolInfo: boolean;

  // Dynamic contract instances
  dynamicContracts: {
    stETHToken?: DynamicContract;
    linkToken?: DynamicContract;
    stETHDepositPool?: DynamicContract;
    linkDepositPool?: DynamicContract;
  };
}

// ============================================================================
// Context Creation
// ============================================================================

const CapitalNetworkContext = createContext<CapitalNetworkState | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

interface CapitalNetworkProviderProps {
  children: React.ReactNode;
}

export function CapitalNetworkProvider({ children }: CapitalNetworkProviderProps) {
  // Get wallet and chain info
  const { address: userAddress } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();

  // Determine network environment from chain ID
  const networkEnv = useMemo((): NetworkEnvironment => {
    const isMainnet = chainId === mainnetChains.mainnet.id || chainId === mainnetChains.arbitrum.id;
    return isMainnet ? "mainnet" : "testnet";
  }, [chainId]);

  // Determine L1 and L2 chain IDs
  const l1ChainId = useMemo(() => {
    return networkEnv === "mainnet" ? mainnetChains.mainnet.id : testnetChains.sepolia.id;
  }, [networkEnv]);

  const l2ChainId = useMemo(() => {
    return networkEnv === "mainnet" ? mainnetChains.arbitrum.id : testnetChains.baseSepolia.id;
  }, [networkEnv]);

  // Contract addresses - memoized based on chain and network
  const stETHDepositPoolAddress = useMemo(
    () => getContractAddress(l1ChainId, "stETHDepositPool", networkEnv) as `0x${string}` | undefined,
    [l1ChainId, networkEnv]
  );

  const stEthContractAddress = useMemo(() => {
    const address = getContractAddress(l1ChainId, "stETH", networkEnv) as `0x${string}` | undefined;
    if (networkEnv === "testnet" && process.env.NODE_ENV !== "production") {
      console.log("🔍 stETH Contract Address:", { l1ChainId, networkEnv, address });
    }
    return address;
  }, [l1ChainId, networkEnv]);

  const morContractAddress = useMemo(
    () => getContractAddress(l2ChainId, "morToken", networkEnv) as `0x${string}` | undefined,
    [l2ChainId, networkEnv]
  );

  const linkDepositPoolAddress = useMemo(
    () => getContractAddress(l1ChainId, "linkDepositPool", networkEnv) as `0x${string}` | undefined,
    [l1ChainId, networkEnv]
  );

  const linkTokenAddress = useMemo(() => {
    const address = getContractAddress(l1ChainId, "linkToken", networkEnv) as `0x${string}` | undefined;
    if (networkEnv === "testnet" && process.env.NODE_ENV !== "production") {
      console.log("🔍 LINK Token Address:", { l1ChainId, networkEnv, address });
    }
    return address;
  }, [l1ChainId, networkEnv]);

  const distributorV2Address = useMemo(
    () => getContractAddress(l1ChainId, "distributorV2", networkEnv) as `0x${string}` | undefined,
    [l1ChainId, networkEnv]
  );

  const rewardPoolV2Address = useMemo(
    () => getContractAddress(l1ChainId, "rewardPoolV2", networkEnv) as `0x${string}` | undefined,
    [l1ChainId, networkEnv]
  );

  const l1SenderV2Address = useMemo(
    () => getContractAddress(l1ChainId, "l1SenderV2", networkEnv) as `0x${string}` | undefined,
    [l1ChainId, networkEnv]
  );

  // Pool info read (used for chart timestamp generation)
  const { data: poolInfoResult, isLoading: isLoadingPoolInfo } = useReadContract({
    address: stETHDepositPoolAddress,
    abi: DepositPoolAbi,
    functionName: 'unusedStorage1',
    args: [PUBLIC_POOL_ID],
    chainId: l1ChainId,
    query: { enabled: !!stETHDepositPoolAddress && !!l1ChainId }
  });

  // Parse pool info from contract result
  const poolInfo = useMemo((): PoolInfoData | undefined => {
    if (!poolInfoResult) return undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dataArray = poolInfoResult as any[];
    if (!Array.isArray(dataArray) || dataArray.length < 9) return undefined;

    try {
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
    } catch {
      console.error("Error parsing poolInfo data");
      return undefined;
    }
  }, [poolInfoResult]);

  // Dynamic contract instances
  const dynamicContracts = useMemo(() => {
    const contracts: CapitalNetworkState["dynamicContracts"] = {};

    if (publicClient) {
      if (stEthContractAddress) {
        contracts.stETHToken = getContract({
          address: stEthContractAddress,
          abi: ERC20Abi,
          client: publicClient,
        });
      }
      if (linkTokenAddress) {
        contracts.linkToken = getContract({
          address: linkTokenAddress,
          abi: ERC20Abi,
          client: publicClient,
        });
      }
      if (stETHDepositPoolAddress) {
        contracts.stETHDepositPool = getContract({
          address: stETHDepositPoolAddress,
          abi: DepositPoolAbi,
          client: publicClient,
        });
      }
      if (linkDepositPoolAddress) {
        contracts.linkDepositPool = getContract({
          address: linkDepositPoolAddress,
          abi: DepositPoolAbi,
          client: publicClient,
        });
      }
    }

    return contracts;
  }, [publicClient, stEthContractAddress, linkTokenAddress, stETHDepositPoolAddress, linkDepositPoolAddress]);

  // Memoized context value
  const value = useMemo<CapitalNetworkState>(
    () => ({
      networkEnv,
      l1ChainId,
      l2ChainId,
      userAddress,
      distributorV2Address,
      rewardPoolV2Address,
      l1SenderV2Address,
      stETHDepositPoolAddress,
      stEthContractAddress,
      linkDepositPoolAddress,
      linkTokenAddress,
      morContractAddress,
      poolInfo,
      isLoadingPoolInfo,
      dynamicContracts,
    }),
    [
      networkEnv,
      l1ChainId,
      l2ChainId,
      userAddress,
      distributorV2Address,
      rewardPoolV2Address,
      l1SenderV2Address,
      stETHDepositPoolAddress,
      stEthContractAddress,
      linkDepositPoolAddress,
      linkTokenAddress,
      morContractAddress,
      poolInfo,
      isLoadingPoolInfo,
      dynamicContracts,
    ]
  );

  return (
    <CapitalNetworkContext.Provider value={value}>
      {children}
    </CapitalNetworkContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useCapitalNetwork(): CapitalNetworkState {
  const context = useContext(CapitalNetworkContext);
  if (!context) {
    throw new Error("useCapitalNetwork must be used within a CapitalNetworkProvider");
  }
  return context;
}

// ============================================================================
// Selective Hooks
// ============================================================================

/**
 * Get only the network environment
 */
export function useCapitalNetworkEnv() {
  const { networkEnv, l1ChainId, l2ChainId } = useCapitalNetwork();
  return { networkEnv, l1ChainId, l2ChainId };
}

/**
 * Get only the user address
 */
export function useCapitalUserAddress() {
  const { userAddress } = useCapitalNetwork();
  return userAddress;
}

/**
 * Get V2 contract addresses
 */
export function useCapitalV2Addresses() {
  const { distributorV2Address, rewardPoolV2Address, l1SenderV2Address } = useCapitalNetwork();
  return { distributorV2Address, rewardPoolV2Address, l1SenderV2Address };
}

/**
 * Get deposit pool addresses
 */
export function useCapitalDepositPoolAddresses() {
  const { stETHDepositPoolAddress, linkDepositPoolAddress } = useCapitalNetwork();
  return { stETHDepositPoolAddress, linkDepositPoolAddress };
}

/**
 * Get token addresses
 */
export function useCapitalTokenAddresses() {
  const { stEthContractAddress, linkTokenAddress, morContractAddress } = useCapitalNetwork();
  return { stEthContractAddress, linkTokenAddress, morContractAddress };
}
