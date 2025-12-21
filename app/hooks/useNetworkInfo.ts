import { useChainId } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';

export interface NetworkInfo {
  chainId: number | undefined;
  isTestnet: boolean;
  isBaseSepolia: boolean;
}

export const useNetworkInfo = (): NetworkInfo => {
  const chainId = useChainId();
  const isBaseSepolia = chainId === baseSepolia.id;
  const isTestnet = isBaseSepolia; // Testnet is Base Sepolia

  return {
    chainId,
    isTestnet,
    isBaseSepolia,
  };
}; 