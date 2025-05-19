import { useChainId } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';

export interface NetworkInfo {
  chainId: number | undefined;
  isTestnet: boolean;
  isArbitrumSepolia: boolean;
}

export const useNetworkInfo = (): NetworkInfo => {
  const chainId = useChainId();
  const isArbitrumSepolia = chainId === arbitrumSepolia.id;
  const isTestnet = isArbitrumSepolia; // Currently, testnet is only Arbitrum Sepolia

  return {
    chainId,
    isTestnet,
    isArbitrumSepolia,
  };
}; 