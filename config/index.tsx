import { defaultWagmiConfig } from '@web3modal/wagmi/react/config';
import { cookieStorage, createStorage, http, webSocket, fallback } from 'wagmi';
import { mainnet, arbitrum, base, arbitrumSepolia, sepolia } from 'wagmi/chains';
// import { NetworkEnvironment } from './networks';

export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID;

if (!projectId) throw new Error('Project ID is not defined');

// HTTP RPC URLs
const alchemyMainnetRpcUrl = process.env.NEXT_PUBLIC_ALCHEMY_MAINNET_RPC_URL;
if (!alchemyMainnetRpcUrl) throw new Error('Alchemy Mainnet RPC URL is not defined');

// WebSocket URLs for real-time updates (approvals, balance changes, etc.)
const alchemyMainnetWsUrl = process.env.NEXT_PUBLIC_ALCHEMY_MAINNET_WS_URL;
const alchemyArbitrumWsUrl = process.env.NEXT_PUBLIC_ALCHEMY_ARBITRUM_WS_URL;
const alchemyBaseWsUrl = process.env.NEXT_PUBLIC_ALCHEMY_BASE_WS_URL;
const alchemySepoliaWsUrl = process.env.NEXT_PUBLIC_ALCHEMY_SEPOLIA_WS_URL;
const alchemyArbitrumSepoliaWsUrl = process.env.NEXT_PUBLIC_ALCHEMY_ARBITRUM_SEPOLIA_WS_URL;

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
    // ✅ CRITICAL: WebSocket transports for real-time updates with HTTP fallback
    // WebSockets provide instant updates for approvals, balance changes, etc.
    // HTTP fallback ensures reliability if WebSocket connection fails
    transports: {
      // Mainnet: WebSocket primary, HTTP fallback
      [mainnet.id]: alchemyMainnetWsUrl 
        ? fallback([
            webSocket(alchemyMainnetWsUrl, {
              keepAlive: true,
              retryCount: 3,
              retryDelay: 1000,
            }),
            http(alchemyMainnetRpcUrl, {
              timeout: 60_000,
              retryCount: 3,
              retryDelay: 1000,
            }),
          ])
        : http(alchemyMainnetRpcUrl, {
            timeout: 60_000,
            retryCount: 3,
            retryDelay: 1000,
          }),
      
      // Arbitrum: WebSocket primary, HTTP fallback
      [arbitrum.id]: alchemyArbitrumWsUrl
        ? fallback([
            webSocket(alchemyArbitrumWsUrl, {
              keepAlive: true,
              retryCount: 3,
            }),
            http(undefined, {
              timeout: 60_000,
              retryCount: 3,
            }),
          ])
        : http(undefined, {
            timeout: 60_000,
            retryCount: 3,
          }),
      
      // Base: WebSocket primary, HTTP fallback
      [base.id]: alchemyBaseWsUrl
        ? fallback([
            webSocket(alchemyBaseWsUrl, {
              keepAlive: true,
              retryCount: 3,
            }),
            http(undefined, {
              timeout: 60_000,
              retryCount: 3,
            }),
          ])
        : http(undefined, {
            timeout: 60_000,
            retryCount: 3,
          }),
      
      // Arbitrum Sepolia: WebSocket primary, HTTP fallback
      [arbitrumSepolia.id]: alchemyArbitrumSepoliaWsUrl
        ? fallback([
            webSocket(alchemyArbitrumSepoliaWsUrl, {
              keepAlive: true,
              retryCount: 3,
            }),
            http(undefined, {
              timeout: 60_000,
              retryCount: 3,
            }),
          ])
        : http(undefined, {
            timeout: 60_000,
            retryCount: 3,
          }),
      
      // Sepolia: WebSocket primary, HTTP fallback
      [sepolia.id]: alchemySepoliaWsUrl
        ? fallback([
            webSocket(alchemySepoliaWsUrl, {
              keepAlive: true,
              retryCount: 3,
            }),
            http(undefined, {
              timeout: 60_000,
              retryCount: 3,
            }),
          ])
        : http(undefined, {
            timeout: 60_000,
            retryCount: 3,
          }),
    },
    enableCoinbase: true,
    auth: {
      showWallets: true,
      walletFeatures: true,
      email: false,
      socials: [],
    },
    // Enhanced WalletConnect configuration for Safe wallet support
    enableWalletConnect: true,
    enableInjected: true,
    enableEIP6963: true,
    // With WebSockets, we can increase polling interval significantly
    // WebSockets push updates in real-time, polling is only a fallback
    pollingInterval: 10_000, // 10 seconds (was 4s) - WebSockets provide real-time updates
    // Add batch configuration to reduce RPC calls
    batch: {
      multicall: {
        batchSize: 1024,
        wait: 50,
      },
    },
    // Increase connection timeout for Safe wallet
    connectors: undefined, // Let Web3Modal handle connectors with proper Safe support
  });
};

// Default config using mainnet to match NetworkProvider default
export const config = getWagmiConfig();
