
/**
 * Get the block explorer URL for a transaction hash on a specific chain
 * @param chainId - The chain ID
 * @param txHash - The transaction hash
 * @returns The full URL to the transaction on the block explorer, or null if not supported
 */
export function getTransactionUrl(chainId: number, txHash: string): string | null {
  const explorers: Record<number, string> = {
    // Ethereum Mainnet
    1: `https://etherscan.io/tx/${txHash}`,
    // Arbitrum One
    42161: `https://arbiscan.io/tx/${txHash}`,
    // Base
    8453: `https://basescan.org/tx/${txHash}`,
    // Sepolia (testnet)
    11155111: `https://sepolia.etherscan.io/tx/${txHash}`,
    // Arbitrum Sepolia (testnet)
    421614: `https://sepolia.arbiscan.io/tx/${txHash}`,
    // Base Sepolia (testnet)
    84532: `https://sepolia.basescan.org/tx/${txHash}`,
  };

  return explorers[chainId] || null;
}

/**
 * Check if a chain is a mainnet (production) chain
 * @param chainId - The chain ID to check
 * @returns True if the chain is a mainnet chain
 */
export function isMainnetChain(chainId: number): boolean {
  const mainnetChains = [1, 42161, 8453]; // Ethereum, Arbitrum, Base mainnets
  return mainnetChains.includes(chainId);
}
