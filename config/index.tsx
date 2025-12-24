import { defaultWagmiConfig } from '@web3modal/wagmi/react/config';
import { cookieStorage, createStorage, http } from 'wagmi';
import { mainnet, arbitrum, base, baseSepolia, arbitrumSepolia, sepolia } from 'wagmi/chains';
// import { NetworkEnvironment } from './networks';

export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID;

if (!projectId) throw new Error('Project ID is not defined');

// Infura RPC URLs
const INFURA_API_KEY = process.env.NEXT_PUBLIC_INFURA_API_KEY || '576b08e5b218455993d05be4710a9dbf';

if (!INFURA_API_KEY) {
  console.warn('NEXT_PUBLIC_INFURA_API_KEY is not defined. Using default Infura endpoint.');
}

const infuraMainnetRpcUrl = `https://mainnet.infura.io/v3/${INFURA_API_KEY}`;
const infuraSepoliaRpcUrl = `https://sepolia.infura.io/v3/${INFURA_API_KEY}`;
const infuraBaseMainnetRpcUrl = `https://base-mainnet.infura.io/v3/${INFURA_API_KEY}`;
const infuraBaseSepoliaRpcUrl = `https://base-sepolia.infura.io/v3/${INFURA_API_KEY}`;
const infuraArbitrumMainnetRpcUrl = `https://arbitrum-mainnet.infura.io/v3/${INFURA_API_KEY}`;
const infuraArbitrumSepoliaRpcUrl = `https://arbitrum-sepolia.infura.io/v3/${INFURA_API_KEY}`;

const metadata = {
  name: 'Morpheus Dashboard',
  description: 'Morpheus Dashboard',
  url: 'https://morpheus.reown.com',
  icons: ['https://morpheus.reown.com/favicon.ico']
};

// Create a function to get the config for a specific environment
export const getWagmiConfig = () => {
  // Always include all chains Wagmi needs to be aware of
  const chains = [mainnet, arbitrum, base, baseSepolia, arbitrumSepolia, sepolia] as const;

  return defaultWagmiConfig({
    chains,
    projectId,
    metadata,
    ssr: true,
    storage: createStorage({
      storage: cookieStorage
    }),
    // ✅ CRITICAL: Explicitly configure transports to use Infura RPC URLs
    transports: {
      [mainnet.id]: http(infuraMainnetRpcUrl),
      [arbitrum.id]: http(infuraArbitrumMainnetRpcUrl),
      [base.id]: http(infuraBaseMainnetRpcUrl),
      [baseSepolia.id]: http(infuraBaseSepoliaRpcUrl), // Base Sepolia testnet
      [arbitrumSepolia.id]: http(infuraArbitrumSepoliaRpcUrl), // @deprecated - kept for backward compatibility
      [sepolia.id]: http(infuraSepoliaRpcUrl),
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
