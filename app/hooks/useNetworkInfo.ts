import { useChainId, usePublicClient } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';
import { NetworkEnvironment, getEnvironmentForChainAndRpc } from '@/config/networks';

export interface NetworkInfo {
  chainId: number | undefined;
  isTestnet: boolean;
  isArbitrumSepolia: boolean;
  isLocalTest: boolean;
  detectedEnvironment: NetworkEnvironment;
  rpcUrl?: string;
}

export const useNetworkInfo = (): NetworkInfo => {
  const chainId = useChainId();
  const publicClient = usePublicClient();
  
  // Extract RPC URL from the public client
  const rpcUrl = publicClient?.transport?.url;
  
  // Auto-detect environment based on chain ID and RPC URL
  const detectedEnvironment = chainId ? getEnvironmentForChainAndRpc(chainId, rpcUrl) : 'mainnet';
  
  const isArbitrumSepolia = chainId === arbitrumSepolia.id;
  const isTestnet = detectedEnvironment === 'testnet' || isArbitrumSepolia;
  const isLocalTest = detectedEnvironment === 'local_test';

  return {
    chainId,
    isTestnet,
    isArbitrumSepolia,
    isLocalTest,
    detectedEnvironment,
    rpcUrl,
  };
}; 