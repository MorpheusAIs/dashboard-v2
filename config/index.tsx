import { defaultWagmiConfig } from '@web3modal/wagmi/react/config';
import { cookieStorage, createStorage, http } from 'wagmi';
import { mainnet, arbitrum, base, arbitrumSepolia, sepolia } from 'wagmi/chains';
// import { NetworkEnvironment } from './networks';

export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID;

if (!projectId) throw new Error('Project ID is not defined');

const metadata = {
  name: 'Morpheus Dashboard',
  description: 'Morpheus Dashboard',
  url: 'https://morpheus.reown.com',
  icons: ['https://morpheus.reown.com/favicon.ico']
};

// Create a function to get the config for a specific environment
export const getWagmiConfig = () => {
  // Always include all chains Wagmi needs to be aware of
  const chains = [mainnet, arbitrum, base, arbitrumSepolia, sepolia] as const;

  return defaultWagmiConfig({
    chains,
    projectId,
    metadata,
    ssr: true,
    storage: createStorage({
      storage: cookieStorage
    }),
    // ✅ CRITICAL: Explicitly configure transports to use Alchemy for mainnet (archive RPC)
    transports: {
      [mainnet.id]: http('https://eth-mainnet.g.alchemy.com/v2/ZuAAStm6GwtaIo5vTSy9a'),
      [arbitrum.id]: http(), // Use default for other chains
      [base.id]: http(),
      [arbitrumSepolia.id]: http(),
      [sepolia.id]: http(),
    },
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
