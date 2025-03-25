import { useNetwork } from '@/context/network-context';
import { ContractAddresses, getContractAddress } from '@/config/networks';

/**
 * Hook to get contract addresses based on the current network environment and chain
 * @returns Object with functions to get contract addresses
 */
export function useContractAddress() {
  const { currentChainId, environment } = useNetwork();

  /**
   * Get a contract address for the current chain and environment
   * @param contractName The name of the contract to get the address for
   * @returns The contract address or an empty string if not found
   */
  const getAddress = (contractName: keyof ContractAddresses): string => {
    if (!currentChainId) return '';
    return getContractAddress(currentChainId, contractName, environment);
  };

  /**
   * Get a contract address for a specific chain in the current environment
   * @param chainId The chain ID to get the contract address for
   * @param contractName The name of the contract to get the address for
   * @returns The contract address or an empty string if not found
   */
  const getAddressForChain = (chainId: number, contractName: keyof ContractAddresses): string => {
    return getContractAddress(chainId, contractName, environment);
  };

  // Return common contract addresses for convenience
  return {
    getAddress,
    getAddressForChain,
    // Convenience getters for commonly used contracts
    erc1967Proxy: getAddress('erc1967Proxy'),
    stETH: getAddress('stETH'),
    morToken: getAddress('morToken'),
    layerZeroEndpoint: getAddress('layerZeroEndpoint'),
    l1Factory: getAddress('l1Factory'),
    l2Factory: getAddress('l2Factory'),
    subnetFactory: getAddress('subnetFactory'),
    builders: getAddress('builders'),
  };
} 