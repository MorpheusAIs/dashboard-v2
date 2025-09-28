import { defineChain } from 'viem';
import type { ChainContract } from 'viem';

// Helper to convert address to ChainContract
const toContract = (address: string): ChainContract => ({ address: address as `0x${string}` });

// Tenderly Virtual TestNet configuration
// Chain ID: 112121212121212
// RPC URL: https://virtual.mainnet.us-east.rpc.tenderly.co/47e606bb-267c-4bc3-bda1-ea9ee54d2d0b
export const tenderlyVirtualTestnet = defineChain({
  id: 112121212121212, // Actual Virtual TestNet chain ID
  name: 'Tenderly Virtual Testnet',
  nativeCurrency: { 
    name: 'Virtual Ethereum', 
    symbol: 'vETH', 
    decimals: 18 
  },
  rpcUrls: {
    default: {
      http: [process.env.TENDERLY_VIRTUAL_TESTNET_RPC || 'https://virtual.mainnet.us-east.rpc.tenderly.co/47e606bb-267c-4bc3-bda1-ea9ee54d2d0b'],
    },
    public: {
      http: [process.env.TENDERLY_VIRTUAL_TESTNET_RPC || 'https://virtual.mainnet.us-east.rpc.tenderly.co/47e606bb-267c-4bc3-bda1-ea9ee54d2d0b'],
    }
  },
  blockExplorers: {
    default: {
      name: 'Tenderly Explorer',
      url: 'https://dashboard.tenderly.co/explorer/vnet/47e606bb-267c-4bc3-bda1-ea9ee54d2d0b',
    }
  },
  contracts: {
    ensRegistry: {
      address: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'
    },
    ensUniversalResolver: {
      address: '0xE4Acdd618deED4e6d2f03b9bf62dc6118FC9A4da',
      blockCreated: 16773775
    },
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11',
      blockCreated: 14353601
    }
  },
  testnet: true,
});

// Extended chain configuration with Morpheus contracts for Virtual TestNet
export const tenderlyVirtualTestnetConfig = {
  ...tenderlyVirtualTestnet,
  contracts: {
    // Required contracts (placeholders for non-deployed contracts)
    erc1967Proxy: toContract('0x0000000000000000000000000000000000000000'), // Not deployed on Virtual TestNet
    stETH: toContract('0x0000000000000000000000000000000000000000'), // Not deployed on Virtual TestNet
    morToken: toContract('0x0000000000000000000000000000000000000000'), // Not deployed on Virtual TestNet
    layerZeroEndpoint: toContract('0x0000000000000000000000000000000000000000'), // Not deployed on Virtual TestNet
    l1Factory: toContract('0x0000000000000000000000000000000000000000'), // Not deployed on Virtual TestNet
    l2Factory: toContract('0x0000000000000000000000000000000000000000'), // Not deployed on Virtual TestNet
    subnetFactory: toContract('0x0000000000000000000000000000000000000000'), // Not deployed on Virtual TestNet
    builders: toContract('0x0000000000000000000000000000000000000000'), // Not deployed on Virtual TestNet

    // V2 Protocol Contracts (Actually deployed)
    distributorV2: toContract('0x417596F7453fB2d07abF0B3afD15e111b6D56A02'),
    rewardPoolV2: toContract('0x76410BC3C45f7805103aCD8032894947FcDc8cE6'),
    l1SenderV2: toContract('0xFca822Eb89067d44e60538125A850861D791720c'),
    
    // Deposit Pool Contracts (Actually deployed)
    stETHDepositPool: toContract('0x32f3F70Ec63cd1b7b5cc3Db4017f0a831bcFFFA0'),
    wethDepositPool: toContract('0x9305E8508B8004362282B7D9227b3b4a84D42F06'),
    wbtcDepositPool: toContract('0x91410DF473Ed15Fc66E29FcA0e9c480694DfcEf0'),
    usdcDepositPool: toContract('0x4ebbD77Ab4BBdB94922A705a02FfcDf5E4597889'),
    usdtDepositPool: toContract('0x57EC92E53135D16eBa9d661713Bd7863983ff02C'),
    
    // Library Contracts (Actually deployed)
    lockMultiplierMath: toContract('0x7b82E807A322af106fE4DeFc8a17C5bF6C4d0de4'),
    
    // ENS contracts (inherited from base chain)
    ensRegistry: {
      address: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'
    },
    ensUniversalResolver: {
      address: '0xE4Acdd618deED4e6d2f03b9bf62dc6118FC9A4da',
      blockCreated: 16773775
    },
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11',
      blockCreated: 14353601
    }
  },
  isL1: true, // Virtual testnet simulates L1
  layerZeroEndpointId: undefined, // LayerZero not deployed on this Virtual TestNet
};

// Type guard to check if Tenderly Virtual Testnets are enabled
export const isTenderlyEnabled = (): boolean => {
  return process.env.NEXT_PUBLIC_TENDERLY_VNETS_ENABLED === 'true' && 
         Boolean(process.env.TENDERLY_VIRTUAL_TESTNET_RPC);
};
