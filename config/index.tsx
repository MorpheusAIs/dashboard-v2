import { defaultWagmiConfig } from '@web3modal/wagmi/react/config';
import { cookieStorage, createStorage, http } from 'wagmi';
import { mainnet, arbitrum, base, baseSepolia, arbitrumSepolia, sepolia } from 'wagmi/chains';

export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID;

if (!projectId) throw new Error('Project ID is not defined');

// Alchemy RPC URLs (Primary provider)
const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

if (!ALCHEMY_API_KEY) {
  console.warn('NEXT_PUBLIC_ALCHEMY_API_KEY is not defined. Alchemy RPC URLs will not work.');
}

const alchemyMainnetRpcUrl = `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
const alchemySepoliaRpcUrl = `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
const alchemyBaseMainnetRpcUrl = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
const alchemyBaseSepoliaRpcUrl = `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
const alchemyArbitrumMainnetRpcUrl = `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
const alchemyArbitrumSepoliaRpcUrl = `https://arb-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

// Infura RPC URLs (Fallback)
const INFURA_API_KEY = process.env.NEXT_PUBLIC_INFURA_API_KEY || '576b08e5b218455993d05be4710a9dbf';

if (!INFURA_API_KEY) {
  console.warn('NEXT_PUBLIC_INFURA_API_KEY is not defined. Using default Infura endpoint.');
}

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
    // ✅ CRITICAL: Explicitly configure transports to use Alchemy RPC URLs (primary) with Infura as fallback
    transports: {
      [mainnet.id]: http(alchemyMainnetRpcUrl),
      [arbitrum.id]: http(alchemyArbitrumMainnetRpcUrl),
      [base.id]: http(alchemyBaseMainnetRpcUrl),
      [baseSepolia.id]: http(alchemyBaseSepoliaRpcUrl), // Base Sepolia testnet
      [arbitrumSepolia.id]: http(alchemyArbitrumSepoliaRpcUrl), // @deprecated - kept for backward compatibility
      [sepolia.id]: http(alchemySepoliaRpcUrl),
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
    pollingInterval: 30000, // 30 seconds instead of default 1 second - significantly reduces RPC calls
  });
};

// Default config using mainnet to match NetworkProvider default
export const config = getWagmiConfig();
