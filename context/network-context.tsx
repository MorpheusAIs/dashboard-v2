import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useConfig, useAccount, useConnect, useSwitchChain, usePublicClient } from 'wagmi';
import { arbitrumSepolia, mainnet, arbitrum, base } from 'wagmi/chains';
import { NetworkEnvironment, apiUrls, getChains, getChainById, getL1Chains, getL2Chains, getEnvironmentForChainAndRpc } from '../config/networks';
import { getWagmiConfig } from '../config';

interface NetworkContextType {
  environment: NetworkEnvironment;
  setEnvironment: (env: NetworkEnvironment) => void;
  isMainnet: boolean;
  isTestnet: boolean;
  isLocalTest: boolean;
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
  autoDetectedEnvironment?: NetworkEnvironment;
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
  const publicClient = usePublicClient();
  
  const currentChainId = chainId;
  const isMainnet = environment === 'mainnet';
  const isTestnet = environment === 'testnet';
  const isLocalTest = environment === 'local_test';

  // Auto-detect environment based on current RPC connection
  const rpcUrl = publicClient?.transport?.url;
  const autoDetectedEnvironment = currentChainId ? getEnvironmentForChainAndRpc(currentChainId, rpcUrl) : undefined;

  // Auto-switch environment when local RPC is detected
  useEffect(() => {
    if (autoDetectedEnvironment && autoDetectedEnvironment !== environment) {
      console.log(`🔄 Auto-detected environment change: ${environment} → ${autoDetectedEnvironment}`);
      console.log(`🔗 Connected to RPC: ${rpcUrl}`);
      console.log(`🏷️  Chain ID: ${currentChainId}`);
      
      // Only auto-switch to local_test, not away from it (to avoid conflicts)
      if (autoDetectedEnvironment === 'local_test') {
        setEnvironment(autoDetectedEnvironment);
      }
    }
  }, [autoDetectedEnvironment, currentChainId, rpcUrl, environment]);

  const switchToEnvironment = async (newEnvironment: NetworkEnvironment) => {
    try {
      setIsNetworkSwitching(true);
      
      // If switching to testnet, switch to Arbitrum Sepolia
      if (newEnvironment === 'testnet') {
        await switchChain({ chainId: arbitrumSepolia.id });
      }
      // If switching to local_test, try to switch to local Arbitrum first
      else if (newEnvironment === 'local_test') {
        await switchChain({ chainId: arbitrum.id }); // The chainId is the same, but RPC will be local
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
        isLocalTest,
        currentChainId,
        switchToEnvironment,
        switchToChain,
        isNetworkSwitching,
        isL1Chain: (chainId: number) => getL1Chains(environment).some(chain => chain.id === chainId),
        isL2Chain: (chainId: number) => getL2Chains(environment).some(chain => chain.id === chainId),
        graphqlApiUrl: apiUrls[environment].graphql,
        l1Chains: getL1Chains(environment),
        l2Chains: getL2Chains(environment),
        supportedChains: getChains(environment),
        autoDetectedEnvironment,
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