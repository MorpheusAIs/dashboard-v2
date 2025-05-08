import { arbitrum, arbitrumSepolia, base, mainnet, sepolia } from 'wagmi/chains';
import type { Chain, ChainContract } from 'viem';

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
      builders: toContract('0x5271B2FE76303ca7DDCB8Fb6fA77906E2B4f03C7')
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
      l2Factory: toContract('0x890BfA255E6EE8DB5c67aB32dc600B14EBc4546c'),
      subnetFactory: toContract('0x37B94Bd80b6012FB214bB6790B31A5C40d6Eb7A5'),
      builders: toContract('0xC0eD68f163d44B6e9985F0041fDf6f67c6BCFF3f')
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
      builders: toContract('0x42BB446eAE6dca7723a9eBdb81EA88aFe77eF4B9')
    }
  }
};

// API URLs by environment
export const apiUrls = {
  mainnet: {
    graphql: 'https://api.studio.thegraph.com/query/67225/morpheus-dashboard/version/latest'
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