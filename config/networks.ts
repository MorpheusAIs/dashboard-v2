import { arbitrum, arbitrumSepolia, base, mainnet, sepolia } from 'wagmi/chains';
import type { Chain, ChainContract } from 'viem';
import { tenderlyVirtualTestnetConfig, isTenderlyEnabled } from './tenderly';

// Network environment types
export type NetworkEnvironment = 'mainnet' | 'testnet';

// Contract addresses by network type
export interface ContractAddresses {
  erc1967Proxy: ChainContract;
  stETH: ChainContract;
  morToken: ChainContract;
  layerZeroEndpoint: ChainContract;
  l1Factory: ChainContract;
  l2Factory: ChainContract;
  subnetFactory: ChainContract;
  builders: ChainContract;
  // V2 Contracts
  stETHDepositPool?: ChainContract;
  linkDepositPool?: ChainContract;
  usdcDepositPool?: ChainContract;
  usdtDepositPool?: ChainContract;
  wbtcDepositPool?: ChainContract;
  wethDepositPool?: ChainContract;
  distributorV2?: ChainContract;
  rewardPoolV2?: ChainContract;
  l1SenderV2?: ChainContract;
  linkToken?: ChainContract;
  lockMultiplierMath?: ChainContract;
}

// RPC configuration for better reliability
export interface RPCConfig {
  url: string;
  weight?: number; // For weighted load balancing
  stallTimeout?: number;
  priority?: number;
}

// Chain configuration with extended information
export interface ChainConfig extends Omit<Chain, 'rpcUrls'> {
  id: number;
  rpcUrls: {
    default: {
      http: string[];
    };
    public?: {
      http: string[];
    };
  };
  blockExplorers: {
    default: {
      name: string;
      url: string;
    };
  };
  contracts: Partial<ContractAddresses>;
  isL1?: boolean;
  isL2?: boolean;
  layerZeroEndpointId?: number;
}

// Mainnet RPC configurations for better reliability
const mainnetRpcUrls = [
  'https://eth-mainnet.g.alchemy.com/v2/ZuAAStm6GwtaIo5vTSy9a'
];

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

// Helper to convert address to ChainContract
const toContract = (address: string): ChainContract => ({ address: address as `0x${string}` });

// Base testnet chains configuration
const baseTestnetChains: Record<string, ChainConfig> = {
  sepolia: {
    ...sepolia,
    rpcUrls: {
      default: {
        http: ensureStringArray(sepolia.rpcUrls.default.http)
      },
      public: {
        http: ensureStringArray(sepolia.rpcUrls.default.http)
      }
    },
    contracts: {
      // Existing V1 contracts
      erc1967Proxy: toContract('0x7c46d6bebf3dcd902eb431054e59908a02aba524'),
      stETH: toContract('0xa878ad6ff38d6fae81fbb048384ce91979d448da'), // Lowercase to avoid checksum validation issues
      layerZeroEndpoint: toContract('0xae92d5aD7583AD66E49A0c67BAd18F6ba52dDDc1'),
      l1Factory: toContract('0xB791b1B02A8f7A32f370200c05EeeE12B9Bba10A'),

      // V2 Contracts (Proxies)
      stETHDepositPool: toContract('0xFea33A23F97d785236F22693eDca564782ae98d0'),
      linkDepositPool: toContract('0x7f4f17be21219D7DA4C8E0d0B9be6a778354E5A5'),
      distributorV2: toContract('0x65b8676392432B1cBac1BE4792a5867A8CA2f375'),
      rewardPoolV2: toContract('0xbFDbe9c7E6c8bBda228c6314E24E9043faeEfB32'),
      l1SenderV2: toContract('0x85e398705d7D77F1703b61DD422869A67B3B409d'),
      linkToken: toContract('0xf8Fb3713D459D7C1018BD0A49D19b4C44290EBE5'),
      lockMultiplierMath: toContract('0x345b8b23c38f70f1d77560c60493bb583f012cb0'),
    },
    isL1: true,
    layerZeroEndpointId: 10161,
  },
  arbitrumSepolia: {
    ...arbitrumSepolia,
    rpcUrls: {
      default: {
        http: ['https://sepolia-rollup.arbitrum.io/rpc']
      },
      public: {
        http: ['https://sepolia-rollup.arbitrum.io/rpc']
      }
    },
    contracts: {
      morToken: toContract('0x34a285A1B1C166420Df5b6630132542923B5b27E'),
      l2Factory: toContract('0x3199555a4552848D522cf3D04bb1fE4C512a5d3B'),
      subnetFactory: toContract('0xa41178368f393a224b990779baa9b5855759d45d'),
      builders: toContract('0x5271b2fe76303ca7ddcb8fb6fa77906e2b4f03c7')
    },
    isL2: true,
    layerZeroEndpointId: 10231,
  }
};

// Testnets Configuration - dynamically includes Tenderly if enabled
export const testnetChains: Record<string, ChainConfig> = {
  ...baseTestnetChains,
  ...(isTenderlyEnabled() ? { 
    tenderlyVirtual: {
      ...tenderlyVirtualTestnetConfig,
      rpcUrls: {
        default: {
          http: [...tenderlyVirtualTestnetConfig.rpcUrls.default.http]
        },
        public: {
          http: [...tenderlyVirtualTestnetConfig.rpcUrls.default.http]
        }
      }
    } as ChainConfig
  } : {})
};

// Mainnets Configuration
export const mainnetChains: Record<string, ChainConfig> = {
  mainnet: {
    ...mainnet,
    rpcUrls: {
      default: {
        http: mainnetRpcUrls
      },
      public: {
        http: mainnetRpcUrls
      }
    },
    contracts: {
      // Legacy V1 contracts
      erc1967Proxy: toContract('0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790'),
      stETH: toContract('0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84'),
      layerZeroEndpoint: toContract('0x66A71Dcef29A0fFBDBE3c6a460a3B5BC225Cd675'),
      l1Factory: toContract('0x969C0F87623dc33010b4069Fea48316Ba2e45382'),

      // V2 Contracts (Newly Deployed)
      stETHDepositPool: toContract('0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790'),
      // V2 Mainnet Deposit Pools
      usdcDepositPool: toContract('0x6cCE082851Add4c535352f596662521B4De4750E'),
      usdtDepositPool: toContract('0x3B51989212BEdaB926794D6bf8e9E991218cf116'),
      wbtcDepositPool: toContract('0xdE283F8309Fd1AA46c95d299f6B8310716277A42'),
      wethDepositPool: toContract('0x9380d72aBbD6e0Cc45095A2Ef8c2CA87d77Cb384'),
      distributorV2: toContract('0xDf1AC1AC255d91F5f4B1E3B4Aef57c5350F64C7A'),
      rewardPoolV2: toContract('0xb7994dE339AEe515C9b2792831CD83f3C9D8df87'),
      l1SenderV2: toContract('0x2Efd4430489e1a05A89c2f51811aC661B7E5FF84'),
      lockMultiplierMath: toContract('0x345b8b23c38f70f1d77560c60493bb583f012cb0'),
    },
    isL1: true,
    layerZeroEndpointId: 101,
  },
  arbitrum: {
    ...arbitrum,
    rpcUrls: {
      default: {
        http: ['https://arbitrum-one.publicnode.com']
      },
      public: {
        http: ['https://arbitrum-one.publicnode.com']
      }
    },
    contracts: {
      morToken: toContract('0x092baadb7def4c3981454dd9c0a0d7ff07bcfc86'),
      l2Factory: toContract('0x890bfa255e6ee8db5c67ab32dc600b14ebc4546c'),
      subnetFactory: toContract('0x37b94bd80b6012fb214bb6790b31a5c40d6eb7a5'),
      builders: toContract('0xc0ed68f163d44b6e9985f0041fdf6f67c6bcff3f')
    },
    isL2: true,
    layerZeroEndpointId: 110,
  },
  base: {
    ...base,
    rpcUrls: {
      default: {
        http: ensureStringArray(base.rpcUrls.default.http)
      },
      public: {
        http: ensureStringArray(base.rpcUrls.default.http)
      }
    },
    contracts: {
      morToken: toContract('0x7431ada8a591c955a994a21710752ef9b882b8e3'),
      builders: toContract('0x42bb446eae6dca7723a9ebdb81ea88afe77ef4b9')
    }
  }
};

// =====================================================
// GraphQL Endpoint Fallback Configuration
// =====================================================
// The new mainnet subgraph is currently indexing. If it fails or returns errors,
// you can quickly switch to the legacy endpoint by changing the flag below.
//
// USAGE:
//   - Set to `false` (default): Uses new morpheus-mainnet-v-2 subgraph
//   - Set to `true`: Uses legacy morpheus-dashboard subgraph  
//
// This affects ONLY the capital page (/capital) historical chart data.
// Builder pages continue using their separate Apollo Client endpoints.
//
// To switch back to legacy endpoint in case of issues:
//   1. Change USE_FALLBACK_MAINNET_GRAPHQL to `true`
//   2. Restart the development server
//   3. Capital page charts will use the old stable endpoint
// =====================================================
const USE_FALLBACK_MAINNET_GRAPHQL = false;

// GraphQL endpoint URLs
const MAINNET_GRAPHQL_ENDPOINTS = {
  // New subgraph (currently indexing)
  primary: 'https://api.studio.thegraph.com/query/73688/morpheus-mainnet-v-2/version/latest',
  // Legacy fallback subgraph
  fallback: 'https://api.studio.thegraph.com/query/67225/morpheus-dashboard/version/latest'
};

// API URLs by environment
export const apiUrls = {
  mainnet: {
    graphql: USE_FALLBACK_MAINNET_GRAPHQL 
      ? MAINNET_GRAPHQL_ENDPOINTS.fallback 
      : MAINNET_GRAPHQL_ENDPOINTS.primary
  },
  testnet: {
    graphql: 'https://api.studio.thegraph.com/query/73688/kkk/version/latest'
  }
};

// Get all chains for an environment
export const getChains = (environment: NetworkEnvironment) => {
  return environment === 'mainnet' ? Object.values(mainnetChains) : Object.values(testnetChains);
};

// Get a specific chain by id
export const getChainById = (chainId: number, environment: NetworkEnvironment) => {
  const chains = environment === 'mainnet' ? mainnetChains : testnetChains;
  return Object.values(chains).find(chain => chain.id === chainId);
};

// Get contract address for a specific chain
export const getContractAddress = (
  chainId: number, 
  contractName: keyof ContractAddresses, 
  environment: NetworkEnvironment
): string => {
  const chain = getChainById(chainId, environment);
  return chain?.contracts?.[contractName]?.address || '';
};

// Get the LayerZero endpoint ID for a chain
export const getLayerZeroEndpointId = (chainId: number, environment: NetworkEnvironment) => {
  const chain = getChainById(chainId, environment);
  return chain?.layerZeroEndpointId;
};

// Get all L1 chains
export const getL1Chains = (environment: NetworkEnvironment) => {
  const chains = environment === 'mainnet' ? mainnetChains : testnetChains;
  return Object.values(chains).filter(chain => chain.isL1);
};

// Get all L2 chains
export const getL2Chains = (environment: NetworkEnvironment) => {
  const chains = environment === 'mainnet' ? mainnetChains : testnetChains;
  return Object.values(chains).filter(chain => chain.isL2);
};

// Get GraphQL API URL for the environment
export const getGraphQLApiUrl = (environment: NetworkEnvironment) => {
  return apiUrls[environment].graphql;
};

// Export GraphQL endpoint configuration for monitoring/debugging
export const getGraphQLEndpointInfo = (environment: NetworkEnvironment) => {
  if (environment === 'mainnet') {
    return {
      current: apiUrls.mainnet.graphql,
      primary: MAINNET_GRAPHQL_ENDPOINTS.primary,
      fallback: MAINNET_GRAPHQL_ENDPOINTS.fallback,
      isFallback: USE_FALLBACK_MAINNET_GRAPHQL,
      canToggle: true
    };
  }
  
  return {
    current: apiUrls.testnet.graphql,
    primary: apiUrls.testnet.graphql,
    fallback: null,
    isFallback: false,
    canToggle: false
  };
}; 