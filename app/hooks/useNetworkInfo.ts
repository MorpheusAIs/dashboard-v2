import { useChainId } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';
import { mainnetChains, testnetChains } from '@/config/networks';

export interface NetworkInfo {
  chainId: number | undefined;
  isTestnet: boolean;
  isArbitrumSepolia: boolean;
  isMainnet: boolean;
  currentNetwork: string;
  contractAddress?: `0x${string}`;
}

/**
 * Hook to get current network information and related configuration
 * @returns NetworkInfo object containing network state and configuration
 */
export const useNetworkInfo = (): NetworkInfo => {
  const chainId = useChainId();
  const isArbitrumSepolia = chainId === arbitrumSepolia.id;
  const isTestnet = isArbitrumSepolia; // Currently, testnet is only Arbitrum Sepolia

  // Determine if we're on a mainnet network
  const isMainnet = !isTestnet && (
    chainId === mainnetChains.arbitrum.id ||
    chainId === mainnetChains.base.id
  );

  // Get current network name
  const currentNetwork = isArbitrumSepolia 
    ? 'Arbitrum Sepolia'
    : chainId === mainnetChains.arbitrum.id
    ? 'Arbitrum'
    : chainId === mainnetChains.base.id
    ? 'Base'
    : 'Unknown';

  // Get contract address based on network
  const contractAddress = isTestnet
    ? testnetChains.arbitrumSepolia.contracts?.builders?.address
    : chainId === mainnetChains.arbitrum.id
    ? mainnetChains.arbitrum.contracts?.builders?.address
    : mainnetChains.base.contracts?.builders?.address;

  return {
    chainId,
    isTestnet,
    isArbitrumSepolia,
    isMainnet,
    currentNetwork,
    contractAddress: contractAddress as `0x${string}` | undefined,
  };
}; 