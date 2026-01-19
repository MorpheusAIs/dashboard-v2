"use client";

import { useMemo } from "react";
import { useReadContract } from "wagmi";
import { parseEther, encodeAbiParameters, parseAbiParameters } from "viem";
import { getContractAddress, type NetworkEnvironment } from "@/config/networks";
import { REFETCH_INTERVALS, STALE_TIMES } from "@/lib/constants/refetch-intervals";

const LAYER_ZERO_ENDPOINT_ABI = [
  {
    inputs: [
      { name: "_dstChainId", type: "uint16" },
      { name: "_userApplication", type: "address" },
      { name: "_payload", type: "bytes" },
      { name: "_payInZRO", type: "bool" },
      { name: "_adapterParams", type: "bytes" }
    ],
    name: "estimateFees",
    outputs: [
      { name: "nativeFee", type: "uint256" },
      { name: "zroFee", type: "uint256" }
    ],
    stateMutability: "view",
    type: "function"
  }
] as const;

const L1_SENDER_V2_ABI = [
  {
    inputs: [],
    name: "layerZeroConfig",
    outputs: [
      { name: "gateway", type: "address" },
      { name: "receiver", type: "address" },
      { name: "receiverChainId", type: "uint16" },
      { name: "zroPaymentAddress", type: "address" },
      { name: "adapterParams", type: "bytes" }
    ],
    stateMutability: "view",
    type: "function"
  }
] as const;

const DEFAULT_ADAPTER_PARAMS = "0x00010000000000000000000000000000000000000000000000000000000000030d40";
const MINIMUM_FEE_BUFFER = parseEther("0.001");
const DEFAULT_FALLBACK_FEE = parseEther("0.001");
const MAXIMUM_FEE_CAP = parseEther("0.01");

interface UseLayerZeroFeeOptions {
  l1ChainId?: number;
  networkEnv: NetworkEnvironment;
  enabled?: boolean;
}

interface LayerZeroFeeResult {
  estimatedFee: bigint;
  isLoading: boolean;
  error: string | null;
  isFallback: boolean;
  refetch: () => Promise<void>;
}

export function useLayerZeroFee(options: UseLayerZeroFeeOptions): LayerZeroFeeResult {
  const { l1ChainId, networkEnv, enabled = true } = options;

  const l1SenderAddress = useMemo(() => {
    if (!l1ChainId) return undefined;
    return getContractAddress(l1ChainId, 'l1SenderV2', networkEnv) as `0x${string}` | undefined;
  }, [l1ChainId, networkEnv]);

  const lzEndpointAddress = useMemo(() => {
    if (!l1ChainId) return undefined;
    return getContractAddress(l1ChainId, 'layerZeroEndpoint', networkEnv) as `0x${string}` | undefined;
  }, [l1ChainId, networkEnv]);

  const { data: lzConfig, isLoading: isLoadingConfig, error: configError } = useReadContract({
    address: l1SenderAddress,
    abi: L1_SENDER_V2_ABI,
    functionName: 'layerZeroConfig',
    chainId: l1ChainId,
    query: {
      enabled: enabled && !!l1SenderAddress && !!l1ChainId,
      staleTime: STALE_TIMES.LONG,
    }
  });

  const destinationChainId = lzConfig?.[2];
  const adapterParams = lzConfig?.[4] || DEFAULT_ADAPTER_PARAMS;

  const samplePayload = useMemo(() => {
    try {
      return encodeAbiParameters(
        parseAbiParameters('address, uint256'),
        ['0x0000000000000000000000000000000000000001', BigInt(1e18)]
      );
    } catch {
      return '0x';
    }
  }, []);

  const { 
    data: feeData, 
    isLoading: isLoadingFee, 
    error: feeError,
    refetch: refetchFee 
  } = useReadContract({
    address: lzEndpointAddress,
    abi: LAYER_ZERO_ENDPOINT_ABI,
    functionName: 'estimateFees',
    args: destinationChainId && l1SenderAddress ? [
      destinationChainId,
      l1SenderAddress,
      samplePayload as `0x${string}`,
      false,
      adapterParams as `0x${string}`
    ] : undefined,
    chainId: l1ChainId,
    query: {
      enabled: enabled && !!lzEndpointAddress && !!destinationChainId && !!l1SenderAddress && !!l1ChainId,
      staleTime: STALE_TIMES.SHORT,
      refetchInterval: REFETCH_INTERVALS.MODERATE,
    }
  });

  const result = useMemo((): LayerZeroFeeResult => {
    const isLoading = isLoadingConfig || isLoadingFee;

    if (feeData && feeData[0]) {
      const nativeFee = feeData[0];
      const feeWithBuffer = (nativeFee * BigInt(120)) / BigInt(100);
      const finalFee = feeWithBuffer > MINIMUM_FEE_BUFFER ? feeWithBuffer : MINIMUM_FEE_BUFFER;
      const cappedFee = finalFee > MAXIMUM_FEE_CAP ? MAXIMUM_FEE_CAP : finalFee;

      return {
        estimatedFee: cappedFee,
        isLoading: false,
        error: null,
        isFallback: false,
        refetch: async () => { await refetchFee(); }
      };
    }

    if (isLoading) {
      return {
        estimatedFee: DEFAULT_FALLBACK_FEE,
        isLoading: true,
        error: null,
        isFallback: true,
        refetch: async () => { await refetchFee(); }
      };
    }

    if (configError || feeError) {
      const errorMsg = configError?.message || feeError?.message || 'Fee estimation failed';
      console.warn('[useLayerZeroFee] Fee estimation failed, using fallback:', errorMsg);
      
      return {
        estimatedFee: DEFAULT_FALLBACK_FEE,
        isLoading: false,
        error: errorMsg,
        isFallback: true,
        refetch: async () => { await refetchFee(); }
      };
    }

    return {
      estimatedFee: DEFAULT_FALLBACK_FEE,
      isLoading: false,
      error: null,
      isFallback: true,
      refetch: async () => { await refetchFee(); }
    };
  }, [feeData, isLoadingConfig, isLoadingFee, configError, feeError, refetchFee]);

  return result;
}

export function getStaticLayerZeroFee(networkEnv: NetworkEnvironment): bigint {
  return networkEnv === 'mainnet' 
    ? parseEther("0.001")
    : parseEther("0.001");
}
