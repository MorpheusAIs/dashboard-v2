import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import type { Connector } from 'wagmi';
import { baseSepolia, mainnet, arbitrum, base, arbitrumSepolia, sepolia } from 'wagmi/chains';
import { toast } from 'sonner';
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

const CHAIN_NAMES: Record<number, string> = {
  [mainnet.id]: 'Ethereum',
  [arbitrum.id]: 'Arbitrum',
  [base.id]: 'Base',
  [baseSepolia.id]: 'Base Sepolia',
  [arbitrumSepolia.id]: 'Arbitrum Sepolia',
  [sepolia.id]: 'Sepolia',
};

/**
 * Thrown instead of asking a Safe to change networks. A Safe account exists on one
 * chain; Safe{Wallet} cannot switch it the way an EOA wallet switches, so a
 * switch request either fails or pushes the user toward a Safe on another chain.
 */
export class SafeChainSwitchError extends Error {
  constructor(public readonly targetChainId: number) {
    const name = CHAIN_NAMES[targetChainId] ?? `chain ${targetChainId}`;
    super(`This action runs on ${name}. Safe accounts can't switch networks — open your ${name} Safe in Safe{Wallet} and connect it here.`);
    this.name = 'SafeChainSwitchError';
  }
}

/** True when the connected account is a Safe: Safe Apps iframe, or Safe{Wallet} over WalletConnect. */
async function isSafeConnection(connector: Connector | undefined): Promise<boolean> {
  if (!connector) return false;
  if (connector.id === 'safe' || connector.type === 'safe') return true;
  if (connector.id === 'walletConnect' || connector.type === 'walletConnect') {
    try {
      const provider = (await connector.getProvider()) as
        | { session?: { peer?: { metadata?: { name?: string } } } }
        | undefined;
      return /safe/i.test(provider?.session?.peer?.metadata?.name ?? '');
    } catch {
      return false;
    }
  }
  return false;
}

export function NetworkProvider({ 
  children, 
  defaultEnvironment = 'mainnet' 
}: { 
  children: ReactNode;
  defaultEnvironment?: NetworkEnvironment;
}) {
  const [environment, setEnvironment] = useState<NetworkEnvironment>(defaultEnvironment);
  const [isNetworkSwitching, setIsNetworkSwitching] = useState(false);
  
  const { chainId, connector } = useAccount();
  // switchChainAsync (not switchChain) so awaiting actually waits for the
  // wallet's response and rejections are catchable by callers
  const { switchChainAsync } = useSwitchChain();
  
  const currentChainId = chainId;
  const isMainnet = environment === 'mainnet';
  const isTestnet = environment === 'testnet';

  // Never ask a Safe to change networks; tell the user which Safe to open instead.
  const guardSafeSwitch = async (targetChainId: number) => {
    if (currentChainId === targetChainId) return;
    if (await isSafeConnection(connector)) {
      const error = new SafeChainSwitchError(targetChainId);
      toast.error(error.message);
      throw error;
    }
  };

  const switchToEnvironment = async (newEnvironment: NetworkEnvironment) => {
    try {
      setIsNetworkSwitching(true);
      
      // If switching to testnet, switch to Base Sepolia
      if (newEnvironment === 'testnet') {
        await guardSafeSwitch(baseSepolia.id);
        await switchChainAsync({ chainId: baseSepolia.id });
      }
      // If switching to mainnet, keep current chain if it's a mainnet chain, otherwise switch to Arbitrum
      else if (newEnvironment === 'mainnet') {
        const mainnetChainIds = [mainnet.id, arbitrum.id, base.id] as const;
        const currentChainIsMainnet = mainnetChainIds.includes(currentChainId as typeof mainnetChainIds[number]);
        if (!currentChainIsMainnet) {
          await guardSafeSwitch(arbitrum.id);
          await switchChainAsync({ chainId: arbitrum.id });
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
      await guardSafeSwitch(chainId);
      await switchChainAsync({ chainId });
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