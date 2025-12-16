"use client";

import React, { ReactNode } from "react";
import { config, projectId } from "@/config";
import { createWeb3Modal } from "@web3modal/wagmi/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { State, WagmiProvider } from "wagmi";
import { mainnet } from "wagmi/chains";

const queryClient = new QueryClient();

if (!projectId) throw new Error("Project ID is not defined");

// Configure Web3Modal with mainnet as the default chain
createWeb3Modal({
  wagmiConfig: config,
  projectId,
  enableAnalytics: true,
  enableOnramp: true,
  themeMode: "dark",
  defaultChain: mainnet,
  excludeWalletIds: [
    'a797aa35c0fadbfc1a53e7f675162ed5226968b44a19ee3d24385c64d1d3c393', // Phantom wallet
  ],
  // Improve Rabby and other injected wallet detection
  featuredWalletIds: [
    'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
    'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa', // Coinbase Wallet  
    '19177a98252e07ddfc9af2083ba8e07ef627cb6103467ffebb3f8f4205fd7927', // Ledger Live
    '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0', // Trust Wallet
  ],
  includeWalletIds: [
    'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
    'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa', // Coinbase Wallet
    '19177a98252e07ddfc9af2083ba8e07ef627cb6103467ffebb3f8f4205fd7927', // Ledger Live
    '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0', // Trust Wallet
    '163d2cf19babf05eb8962e9748f9ebe613ed52ebf9c8107c9a0f104bfcf161b3', // Rabby Wallet - explicitly include
  ],
  themeVariables: {
    '--w3m-accent': '#34d399',
    '--w3m-border-radius-master': '1px',
    '--w3m-font-family': 'var(--font-geist-sans)',
  },
  tokens: {
    "eip155:8453": {
      address: '0x7431aDa8a591C955a994a21710752EF9b882b8e3',
      image: 'https://assets.coingecko.com/coins/images/37969/standard/MOR200X200.png?1716327119'
    },
    "eip155:42161": {
      address: '0x092baadb7def4c3981454dd9c0a0d7ff07bcfc86',
      image: 'https://assets.coingecko.com/coins/images/37969/standard/MOR200X200.png?1716327119'
    },
    "eip155:1": {
      address: '0x7431aDa8a591C955a994a21710752EF9b882b8e3',
      image: 'https://assets.coingecko.com/coins/images/279/standard/ethereum.png?1696501628'
    }
  }
});

export default function Web3ModalProvider({ children, initialState }: { children: ReactNode; initialState?: State }) {
  return (
    <WagmiProvider config={config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}