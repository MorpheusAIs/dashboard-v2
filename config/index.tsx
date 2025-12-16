import { defaultWagmiConfig } from '@web3modal/wagmi/react/config';
import { cookieStorage, createStorage, http, reconnect } from 'wagmi';
import { mainnet, arbitrum, base, arbitrumSepolia, sepolia } from 'wagmi/chains';
// import { NetworkEnvironment } from './networks';

export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID;

if (!projectId) throw new Error('Project ID is not defined');

const alchemyMainnetRpcUrl = process.env.NEXT_PUBLIC_ALCHEMY_MAINNET_RPC_URL;

if (!alchemyMainnetRpcUrl) throw new Error('Alchemy Mainnet RPC URL is not defined');

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
      [mainnet.id]: http(alchemyMainnetRpcUrl),
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
    // Improve wallet detection for injected wallets like Rabby
    multiInjectedProviderDiscovery: true,
    // Increase connection timeout for slower wallets
    connectors: [],
  });
};

// Default config using mainnet to match NetworkProvider default
export const config = getWagmiConfig();

// Attempt to reconnect on app load to restore WalletConnect sessions (e.g., Safe wallet)
if (typeof window !== 'undefined') {
  // Check if there's an existing WalletConnect session
  const hasWCSession = Object.keys(localStorage).some(key => 
    (key.includes('wc@2') || key.includes('@walletconnect') || key.includes('appkit')) &&
    !key.includes('expired')
  );
  
  if (hasWCSession) {
    console.log('🔄 WalletConnect session detected on load - attempting reconnection...');
    // Attempt reconnection after a short delay to allow providers to initialize
    setTimeout(() => {
      reconnect(config).catch(error => {
        console.warn('Failed to auto-reconnect WalletConnect session:', error);
      });
    }, 500);
  }
}
