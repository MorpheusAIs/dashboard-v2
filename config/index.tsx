import { defaultWagmiConfig } from '@web3modal/wagmi/react/config';
import { cookieStorage, createStorage } from 'wagmi';
import { mainnet, arbitrum, base, arbitrumSepolia } from 'wagmi/chains';
import { defineChain } from 'viem';
// import { NetworkEnvironment } from './networks';

export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID;

if (!projectId) throw new Error('Project ID is not defined');

const metadata = {
  name: 'Morpheus Dashboard',
  description: 'Morpheus Dashboard',
  url: 'https://morpheus.reown.com',
  icons: ['https://morpheus.reown.com/favicon.ico']
};

// Define local test chains for Anvil forks
const localArbitrum = defineChain({
  id: 42161,
  name: 'Arbitrum (Local Fork)',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['http://127.0.0.1:8545'],
    },
  },
  blockExplorers: {
    default: { name: 'Arbiscan', url: 'https://arbiscan.io' },
  },
  testnet: false,
});

const localBase = defineChain({
  id: 8453,
  name: 'Base (Local Fork)',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['http://127.0.0.1:8546'],
    },
  },
  blockExplorers: {
    default: { name: 'BaseScan', url: 'https://basescan.org' },
  },
  testnet: false,
});

// Create a function to get the config for a specific environment
export const getWagmiConfig = () => {
  // Include all chains Wagmi needs to be aware of, including local test chains
  const chains = [mainnet, arbitrum, base, arbitrumSepolia, localArbitrum, localBase] as const;

  return defaultWagmiConfig({
    chains,
    projectId,
    metadata,
    ssr: true,
    storage: createStorage({
      storage: cookieStorage
    }),
    enableCoinbase: true,
    auth: {
      showWallets: true,
      walletFeatures: true,
      email: false,
      socials: [],
    },
    // Add some additional options to reduce aggressive polling and improve error handling
    enableWalletConnect: true,
    enableInjected: true,
    enableEIP6963: true,
    // Reduce polling to avoid overwhelming RPC endpoints
    pollingInterval: 4000, // 4 seconds instead of default 1 second
  });
};

// Default config using mainnet to match NetworkProvider default
export const config = getWagmiConfig();
