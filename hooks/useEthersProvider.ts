import { type Account, type Chain, type Client, type Transport, type WalletClient } from 'viem'
import { usePublicClient, useWalletClient } from 'wagmi'
import { providers } from 'ethers'
import React from 'react'

// Function to convert a Viem PublicClient to an ethers.js v5 JsonRpcProvider
export function publicClientToProvider(client: Client<Transport, Chain>) {
  const { chain, transport } = client
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  }
  if (transport.type === 'fallback') {
    // Correctly handle array of providers for FallbackProvider
    const providersArray = (transport.transports as { value?: { url: string } }[]).map( // Added type assertion for transport.transports
      ({ value }) => new providers.JsonRpcProvider(value?.url, network),
    );
    if (providersArray.length === 1) return providersArray[0]; // No need for unknown cast
    return new providers.FallbackProvider(providersArray); // No need for unknown cast
  }
  // Ensure transport.url exists before creating JsonRpcProvider
  if (!transport.url) {
      console.error("Transport URL is missing for JsonRpcProvider");
      // Decide how to handle this: return undefined, throw error, or use a default URL?
      // Returning undefined might be safest if it can be handled upstream.
      return undefined;
  }
  return new providers.JsonRpcProvider(transport.url, network);
}

// --- Combined Hook ---
// Returns the appropriate ethers v5 Provider object:
// - If wallet connected: returns Web3Provider (includes signer capabilities)
// - If wallet not connected: returns JsonRpcProvider (read-only)

export function useEthersV5Provider({ chainId }: { chainId?: number } = {}) {
  const publicClient = usePublicClient({ chainId });
  const { data: walletClient } = useWalletClient({ chainId });

  return React.useMemo(() => {
    if (walletClient) {
      // Wallet connected: Use Web3Provider derived from WalletClient
      const { chain, transport } = walletClient;
      const network = {
        chainId: chain.id,
        name: chain.name,
        ensAddress: chain.contracts?.ensRegistry?.address,
      };
      // The Web3Provider wraps the EIP-1193 compliant transport
      const provider = new providers.Web3Provider(transport, network);
      return provider;
    } else if (publicClient) {
      // Wallet not connected: Use JsonRpcProvider for read-only access
      const provider = publicClientToProvider(publicClient);
      // Return the provider only if it was successfully created (had a URL)
      return provider;
    }
    return undefined; // No client available or provider creation failed
  }, [publicClient, walletClient]);
}

// --- Optional: Keep separate signer hook if needed elsewhere ---
// Function to convert a Viem WalletClient to an ethers.js v5 Signer
export function walletClientToSigner(walletClient: WalletClient<Transport, Chain, Account>) {
  const { account, chain, transport } = walletClient
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  }
  const provider = new providers.Web3Provider(transport, network)
  const signer = provider.getSigner(account.address)
  return signer
}

/** Hook to convert a Viem WalletClient to an ethers.js v5 Signer. */
export function useEthersSigner({ chainId }: { chainId?: number } = {}) {
  const { data: walletClient } = useWalletClient({ chainId })

  return React.useMemo(
    () => (walletClient ? walletClientToSigner(walletClient) : undefined),
    [walletClient],
  )
} 