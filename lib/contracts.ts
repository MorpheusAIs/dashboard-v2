// Builder contract ABI (simplified for our needs)
export const buildersAbi = [
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "string",
            "name": "name",
            "type": "string"
          },
          {
            "internalType": "address",
            "name": "admin",
            "type": "address"
          },
          {
            "internalType": "uint128",
            "name": "poolStart",
            "type": "uint128"
          },
          {
            "internalType": "uint128",
            "name": "withdrawLockPeriodAfterDeposit",
            "type": "uint128"
          },
          {
            "internalType": "uint128",
            "name": "claimLockEnd",
            "type": "uint128"
          },
          {
            "internalType": "uint256",
            "name": "minimalDeposit",
            "type": "uint256"
          }
        ],
        "internalType": "struct Builders.BuilderPool",
        "name": "pool",
        "type": "tuple"
      }
    ],
    "name": "createBuilderPool",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// Contract addresses by chain ID
export const builderContracts = {
  // Arbitrum
  42161: '0xC0eD68f163d44B6e9985F0041fDf6f67c6BCFF3f',
  // Base
  8453: '0x42BB446eAE6dca7723a9eBdb81EA88aFe77eF4B9',
  // Arbitrum Sepolia (testnet)
  421614: '0x649B24D0b6F5A4c3852fD4C0dD91308902E5fe8a',
};

// Helper to convert days to seconds
export const daysToSeconds = (days: number): number => {
  return days * 86400; // 86400 seconds in a day
};

// Chain ID mapping
export const networkNameToChainId: Record<string, number> = {
  "Arbitrum": 42161,
  "Base": 8453,
};

// Helper to get contract instance for a chain
export const getBuilderContract = (chainId: number) => {
  const contractAddress = builderContracts[chainId as keyof typeof builderContracts];
  
  if (!contractAddress) {
    throw new Error(`No contract address for chain ID ${chainId}`);
  }
  
  return {
    address: contractAddress as `0x${string}`,
    abi: buildersAbi,
  };
};

// Interface for pool parameters
export interface BuilderPoolParams {
  name: string;
  admin: `0x${string}`;
  poolStart: bigint;
  withdrawLockPeriodAfterDeposit: bigint;
  claimLockEnd: bigint;
  minimalDeposit: bigint;
}

// Create a pool on the contract
export const createBuilderPool = async (
  walletClient: { 
    writeContract: (params: { 
      address: `0x${string}`, 
      abi: typeof buildersAbi, 
      functionName: string, 
      args: unknown[] 
    }) => Promise<string> 
  },
  chainId: number,
  poolParams: BuilderPoolParams
) => {
  const contract = getBuilderContract(chainId);
  
  try {
    const hash = await walletClient.writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName: 'createBuilderPool',
      args: [poolParams],
    });
    
    return { success: true, hash };
  } catch (error) {
    console.error('Error creating builder pool:', error);
    return { success: false, error };
  }
}; 