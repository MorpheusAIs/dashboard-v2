/**
 * Safe Wallet Detection Utilities
 * 
 * This module provides utilities to detect if a wallet address is a Gnosis Safe
 * and generate appropriate Safe wallet URLs for transaction management.
 */

import { sepolia, mainnet } from 'wagmi/chains';

/**
 * Check if an address is likely a Gnosis Safe wallet.
 * 
 * This uses a heuristic approach since there's no foolproof way to detect
 * Safe wallets without making contract calls. We check common Safe deployment
 * patterns and characteristics.
 * 
 * @param address - The wallet address to check
 * @returns Promise<boolean> - True if likely a Safe wallet
 */
export async function isSafeWallet(address: string): Promise<boolean> {
  if (!address || !address.startsWith('0x')) {
    return false;
  }

  try {
    // Method 1: Check if the address has code (is a contract)
    // Safe wallets are smart contracts, so they should have bytecode
    const rpcUrls = {
      [mainnet.id]: 'https://eth.llamarpc.com',
      [sepolia.id]: 'https://ethereum-sepolia.publicnode.com'
    };

    const checkCodeOnChain = async (chainId: number): Promise<boolean> => {
      try {
        const rpcUrl = rpcUrls[chainId as keyof typeof rpcUrls];
        if (!rpcUrl) return false;

        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getCode',
            params: [address, 'latest'],
            id: 1,
          }),
        });

        const data = await response.json();
        const code = data.result;

        // If the address has code and it's not just the empty code '0x', it's a contract
        return code && code !== '0x' && code.length > 2;
      } catch (error) {
        console.warn(`Failed to check code for address ${address} on chain ${chainId}:`, error);
        return false;
      }
    };

    // Check on both mainnet and sepolia
    const [isMainnetContract, isSepoliaContract] = await Promise.all([
      checkCodeOnChain(mainnet.id),
      checkCodeOnChain(sepolia.id)
    ]);

    // If it's a contract on either chain, it might be a Safe
    if (isMainnetContract || isSepoliaContract) {
      // Additional heuristics could be added here, such as:
      // - Checking for Safe-specific storage patterns
      // - Querying Safe API endpoints
      // - Checking for known Safe factory deployment patterns
      
      // For now, we'll assume contract wallets are likely Safe wallets
      // since Safe is the most common multisig solution
      return true;
    }

    return false;
  } catch (error) {
    console.warn(`Error checking if address ${address} is a Safe wallet:`, error);
    // If we can't determine, assume it's not a Safe to avoid false positives
    return false;
  }
}

/**
 * Generate the Safe wallet URL for a given address and network
 * 
 * @param address - The Safe wallet address
 * @param chainId - The chain ID where the Safe is deployed
 * @returns The Safe wallet URL
 */
export function getSafeWalletUrl(address: string, chainId: number): string {
  // Map chain IDs to Safe's network identifiers
  const chainMappings: Record<number, string> = {
    [mainnet.id]: 'eth', // Ethereum mainnet
    [sepolia.id]: 'sep', // Sepolia testnet
    // Add other networks as needed
    42161: 'arb1', // Arbitrum One
    421614: 'arb-sep', // Arbitrum Sepolia
    8453: 'base', // Base
    84532: 'base-sep', // Base Sepolia
  };

  const networkPrefix = chainMappings[chainId];
  
  if (!networkPrefix) {
    console.warn(`Unknown chain ID ${chainId} for Safe wallet URL generation`);
    // Default to mainnet if unknown
    return `https://app.safe.global/home?safe=eth:${address}`;
  }

  return `https://app.safe.global/home?safe=${networkPrefix}:${address}`;
}

/**
 * Get the appropriate Safe wallet URL for the current transaction context
 * 
 * @param address - The wallet address
 * @param chainId - The chain ID for the transaction
 * @returns The Safe wallet URL or null if not a Safe wallet
 */
export async function getSafeWalletUrlIfApplicable(
  address: string, 
  chainId: number
): Promise<string | null> {
  const isSafe = await isSafeWallet(address);
  
  if (!isSafe) {
    return null;
  }
  
  return getSafeWalletUrl(address, chainId);
}

/**
 * Cache for Safe wallet detection results to avoid repeated API calls
 */
const safeWalletCache = new Map<string, { isSafe: boolean; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Cached version of isSafeWallet to improve performance
 * 
 * @param address - The wallet address to check
 * @returns Promise<boolean> - True if likely a Safe wallet
 */
export async function isSafeWalletCached(address: string): Promise<boolean> {
  const cacheKey = address.toLowerCase();
  const cached = safeWalletCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.isSafe;
  }
  
  const isSafe = await isSafeWallet(address);
  safeWalletCache.set(cacheKey, { isSafe, timestamp: Date.now() });
  
  return isSafe;
}
