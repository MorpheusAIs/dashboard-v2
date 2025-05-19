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

// Create a function to get the config for a specific environment
export const getWagmiConfig = () => {
  // Always include all chains Wagmi needs to be aware of
  const chains = [mainnet, arbitrum, base, arbitrumSepolia] as const;

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
  });
};

// Default config using mainnet to match NetworkProvider default
export const config = getWagmiConfig();
