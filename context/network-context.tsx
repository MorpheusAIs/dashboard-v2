import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { baseSepolia, mainnet, arbitrum, base } from 'wagmi/chains';
import { NetworkEnvironment, apiUrls, getChains, getL1Chains, getL2Chains } from '../config/networks';

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

  const switchToEnvironment = useCallback(async (newEnvironment: NetworkEnvironment) => {
    try {
      setIsNetworkSwitching(true);

      // If switching to testnet, switch to Base Sepolia
      if (newEnvironment === 'testnet') {
        await switchChain({ chainId: baseSepolia.id });
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
  }, [switchChain, currentChainId]);

  const switchToChain = useCallback(async (targetChainId: number) => {
    try {
      setIsNetworkSwitching(true);
      await switchChain({ chainId: targetChainId });
    } catch (error) {
      console.error('Failed to switch chain:', error);
      throw error;
    } finally {
      setIsNetworkSwitching(false);
    }
  }, [switchChain]);

  // Performance optimization: memoize chain arrays to prevent new references on every render
  const l1Chains = useMemo(() => getL1Chains(environment), [environment]);
  const l2Chains = useMemo(() => getL2Chains(environment), [environment]);
  const supportedChains = useMemo(() => getChains(environment), [environment]);
  const graphqlApiUrl = useMemo(() => apiUrls[environment].graphql, [environment]);

  // Performance optimization: memoize chain check functions
  const isL1Chain = useCallback((checkChainId: number) => l1Chains.some(chain => chain.id === checkChainId), [l1Chains]);
  const isL2Chain = useCallback((checkChainId: number) => l2Chains.some(chain => chain.id === checkChainId), [l2Chains]);

  const contextValue = useMemo(() => ({
    environment,
    setEnvironment,
    isMainnet,
    isTestnet,
    currentChainId,
    switchToEnvironment,
    switchToChain,
    isNetworkSwitching,
    isL1Chain,
    isL2Chain,
    graphqlApiUrl,
    l1Chains,
    l2Chains,
    supportedChains
  }), [
    environment,
    isMainnet,
    isTestnet,
    currentChainId,
    switchToEnvironment,
    switchToChain,
    isNetworkSwitching,
    isL1Chain,
    isL2Chain,
    graphqlApiUrl,
    l1Chains,
    l2Chains,
    supportedChains
  ]);

  return (
    <NetworkContext.Provider value={contextValue}>
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
