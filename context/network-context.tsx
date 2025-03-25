import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useConfig, useAccount, useConnect, useSwitchChain } from 'wagmi';
import { arbitrumSepolia, mainnet, arbitrum, base } from 'wagmi/chains';
import { NetworkEnvironment, apiUrls, getChains, getChainById, getL1Chains, getL2Chains } from '../config/networks';
import { getWagmiConfig } from '../config';

interface NetworkContextType {
  environment: NetworkEnvironment;
  setEnvironment: (env: NetworkEnvironment) => void;
  isMainnet: boolean;
  isTestnet: boolean;
  currentChainId: number | undefined;
  switchToEnvironment: (env: NetworkEnvironment) => Promise<void>;
  switchToChain: (chainId: number) => Promise<void>;
  isL1Chain: (chainId: number) => boolean;
  isL2Chain: (chainId: number) => boolean;
  graphqlApiUrl: string;
  l1Chains: ReturnType<typeof getL1Chains>;
  l2Chains: ReturnType<typeof getL2Chains>;
  supportedChains: ReturnType<typeof getChains>;
  isNetworkSwitching: boolean;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ 
  children, 
  defaultEnvironment = 'mainnet' 
}: { 
  children: ReactNode;
  defaultEnvironment?: NetworkEnvironment;
}) {
  const [environment, setEnvironment] = useState<NetworkEnvironment>(defaultEnvironment);
  const [isNetworkSwitching, setIsNetworkSwitching] = useState(false);
  
  const { chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  
  const currentChainId = chainId;
  const isMainnet = environment === 'mainnet';
  const isTestnet = environment === 'testnet';

  const switchToEnvironment = async (newEnvironment: NetworkEnvironment) => {
    try {
      setIsNetworkSwitching(true);
      
      // If switching to testnet, switch to Arbitrum Sepolia
      if (newEnvironment === 'testnet') {
        await switchChain({ chainId: arbitrumSepolia.id });
      }
      // If switching to mainnet, keep current chain if it's a mainnet chain, otherwise switch to Arbitrum
      else if (newEnvironment === 'mainnet') {
        const mainnetChainIds = [mainnet.id, arbitrum.id, base.id] as const;
        const currentChainIsMainnet = mainnetChainIds.includes(currentChainId as typeof mainnetChainIds[number]);
        if (!currentChainIsMainnet) {
          await switchChain({ chainId: arbitrum.id });
        }
      }
      
      setEnvironment(newEnvironment);
    } catch (error) {
      console.error('Failed to switch environment:', error);
      throw error;
    } finally {
      setIsNetworkSwitching(false);
    }
  };

  const switchToChain = async (chainId: number) => {
    try {
      setIsNetworkSwitching(true);
      await switchChain({ chainId });
    } catch (error) {
      console.error('Failed to switch chain:', error);
      throw error;
    } finally {
      setIsNetworkSwitching(false);
    }
  };

  return (
    <NetworkContext.Provider
      value={{
        environment,
        setEnvironment,
        isMainnet,
        isTestnet,
        currentChainId,
        switchToEnvironment,
        switchToChain,
        isNetworkSwitching,
        isL1Chain: (chainId: number) => getL1Chains(environment).some(chain => chain.id === chainId),
        isL2Chain: (chainId: number) => getL2Chains(environment).some(chain => chain.id === chainId),
        graphqlApiUrl: apiUrls[environment].graphql,
        l1Chains: getL1Chains(environment),
        l2Chains: getL2Chains(environment),
        supportedChains: getChains(environment)
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}

export default NetworkContext; 