import { defaultWagmiConfig } from '@web3modal/wagmi/react/config';
import { cookieStorage, createStorage } from 'wagmi';
import { mainnet, arbitrum, base, arbitrumSepolia } from 'wagmi/chains';
// import { NetworkEnvironment } from './networks';

export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID;

if (!projectId) throw new Error('Project ID is not defined');

const metadata = {
  name: 'Morpheus Dashboard',
  description: 'Morpheus Dashboard',
  url: 'https://morpheus.reown.com',
  icons: ['https://morpheus.reown.com/favicon.ico']
};

// Helper to ensure string arrays for RPC URLs
const ensureStringArray = (urlOrUrls: string | readonly string[] | unknown): string[] => {
  if (typeof urlOrUrls === 'string') {
    return [urlOrUrls];
  }
  if (Array.isArray(urlOrUrls)) {
    return [...urlOrUrls] as string[];
  }
  return [];
};

// Create a function to get the config for a specific environment
export const getWagmiConfig = () => {
  // Single chain definition per ID - extend with local RPC URLs
  const arbitrumWithLocal = {
    ...arbitrum,
    rpcUrls: {
      default: {
        http: [
          'https://arbitrum-one.publicnode.com',  // Production RPC first
          'http://127.0.0.1:8545'                 // Local fork RPC as fallback
        ]
      },
      public: {
        http: ['https://arbitrum-one.publicnode.com']
      }
    }
  } as const;

  const baseWithLocal = {
    ...base,
    rpcUrls: {
      default: {
        http: [
          ...ensureStringArray(base.rpcUrls.default.http),  // Production RPCs first
          'http://127.0.0.1:8546'                           // Local fork RPC as fallback
        ]
      },
      public: {
        http: ensureStringArray(base.rpcUrls.default.http)
      }
    }
  } as const;

  // Single chain array with no duplicates
  const chains = [mainnet, arbitrumWithLocal, baseWithLocal, arbitrumSepolia] as const;

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
