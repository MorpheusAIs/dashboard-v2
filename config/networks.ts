import { arbitrum, arbitrumSepolia, base, mainnet, sepolia } from 'wagmi/chains';
import type { Chain, ChainContract } from 'viem';

// Network environment types - now includes local_test for Anvil forks
export type NetworkEnvironment = 'mainnet' | 'testnet' | 'local_test';

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
  'https://rpc.mevblocker.io',
  'https://eth-pokt.nodies.app',
  'https://eth.drpc.org',
  'https://rpc.payload.de',
  'https://eth.merkle.io'
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

// Testnets Configuration
export const testnetChains: Record<string, ChainConfig> = {
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
      erc1967Proxy: toContract('0x7c46d6bebf3dcd902eb431054e59908a02aba524'),
      stETH: toContract('0xa878Ad6fF38d6fAE81FBb048384cE91979d448DA'),
      layerZeroEndpoint: toContract('0xae92d5aD7583AD66E49A0c67BAd18F6ba52dDDc1'),
      l1Factory: toContract('0xB791b1B02A8f7A32f370200c05EeeE12B9Bba10A')
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
      erc1967Proxy: toContract('0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790'),
      stETH: toContract('0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84'),
      layerZeroEndpoint: toContract('0x66A71Dcef29A0fFBDBE3c6a460a3B5BC225Cd675'),
      l1Factory: toContract('0x969C0F87623dc33010b4069Fea48316Ba2e45382')
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

// Local Test Configuration for Anvil Forks
export const localTestChains: Record<string, ChainConfig> = {
  arbitrum: {
    ...arbitrum,
    name: 'Arbitrum (Local Fork)',
    rpcUrls: {
      default: {
        http: ['http://127.0.0.1:8545']
      },
      public: {
        http: ['http://127.0.0.1:8545']
      }
    },
    contracts: {
      morToken: toContract('0x36fE2E7a1c19F7Be268272540E9A4aB306686506'),
      builders: toContract('0xEA02B7528F2f07B0F6Eb485C56d182B311B80284'),
      // Add other contracts as needed
    },
    isL2: true,
    layerZeroEndpointId: 110,
  },
  base: {
    ...base,
    name: 'Base (Local Fork)',
    rpcUrls: {
      default: {
        http: ['http://127.0.0.1:8546']
      },
      public: {
        http: ['http://127.0.0.1:8546']
      }
    },
    contracts: {
      morToken: toContract('0x7511fAE41153Fad8A569d7Ebdcc76c120D3d5AAb'),
      builders: toContract('0x17073Da1E92008eAE64cd5D3e8129F7928D3b362'),
    },
    isL2: true,
  }
};

// API URLs by environment - add local_test
export const apiUrls = {
  mainnet: {
    graphql: 'https://api.studio.thegraph.com/query/67225/morpheus-dashboard/version/latest'
  },
  testnet: {
    graphql: 'https://api.studio.thegraph.com/query/73688/kkk/version/latest'
  },
  local_test: {
    // For local testing, we can use the testnet GraphQL endpoint or mock data
    graphql: 'https://api.studio.thegraph.com/query/73688/kkk/version/latest'
  }
};

// Get all chains for an environment
export const getChains = (environment: NetworkEnvironment) => {
  switch (environment) {
    case 'mainnet':
      return Object.values(mainnetChains);
    case 'testnet':
      return Object.values(testnetChains);
    case 'local_test':
      return Object.values(localTestChains);
    default:
      return Object.values(mainnetChains);
  }
};

// Get a specific chain by id
export const getChainById = (chainId: number, environment: NetworkEnvironment) => {
  const chains = getChains(environment);
  return chains.find(chain => chain.id === chainId);
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
  const chains = getChains(environment);
  return chains.filter(chain => chain.isL1);
};

// Get all L2 chains
export const getL2Chains = (environment: NetworkEnvironment) => {
  const chains = getChains(environment);
  return chains.filter(chain => chain.isL2);
};

// Get GraphQL API URL for the environment
export const getGraphQLApiUrl = (environment: NetworkEnvironment) => {
  return apiUrls[environment].graphql;
};

// Auto-detect environment based on RPC URL
export const detectEnvironmentFromRpcUrl = (rpcUrl?: string): NetworkEnvironment => {
  if (!rpcUrl) return 'mainnet';
  
  // Check for local/localhost URLs
  if (rpcUrl.includes('localhost') || rpcUrl.includes('127.0.0.1')) {
    return 'local_test';
  }
  
  // Check for known testnet RPC URLs
  if (rpcUrl.includes('sepolia') || rpcUrl.includes('goerli')) {
    return 'testnet';
  }
  
  // Default to mainnet
  return 'mainnet';
};

// Helper to detect if we're connected to a local RPC
export const isLocalRpc = (rpcUrl?: string): boolean => {
  if (!rpcUrl) return false;
  return rpcUrl.includes('localhost') || rpcUrl.includes('127.0.0.1');
};

// Get environment-appropriate chain for a given chain ID
export const getEnvironmentForChainAndRpc = (chainId: number, rpcUrl?: string): NetworkEnvironment => {
  // First check if it's a local RPC
  if (isLocalRpc(rpcUrl)) {
    // For local RPCs, check if we have a local configuration for this chain ID
    const localChain = Object.values(localTestChains).find(chain => chain.id === chainId);
    if (localChain) {
      return 'local_test';
    }
  }
  
  // Check testnet chains
  const testnetChain = Object.values(testnetChains).find(chain => chain.id === chainId);
  if (testnetChain) {
    return 'testnet';
  }
  
  // Default to mainnet
  return 'mainnet';
}; 