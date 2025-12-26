"use client";

import React, { ReactNode, useEffect } from "react";
import { config, projectId } from "@/config";
import { createWeb3Modal } from "@web3modal/wagmi/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { State, WagmiProvider } from "wagmi";
import { mainnet } from "wagmi/chains";

// Configure QueryClient with conservative refetch intervals to reduce RPC calls
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 60 seconds - data is fresh for 60s
      refetchInterval: false, // Disable automatic refetching by default
      refetchOnWindowFocus: false, // Don't refetch when window regains focus
      refetchOnReconnect: false, // Don't refetch on reconnect
      retry: 2, // Reduce retries to avoid overwhelming RPC
    },
  },
});

if (!projectId) throw new Error("Project ID is not defined");

// Initialize Web3Modal only on client side to prevent SSR issues
let web3ModalInitialized = false;

function initializeWeb3Modal() {
  if (typeof window !== 'undefined' && !web3ModalInitialized) {
    try {
      createWeb3Modal({
        wagmiConfig: config,
        projectId: projectId!,
        enableAnalytics: true,
        enableOnramp: true,
        themeMode: "dark",
        defaultChain: mainnet,
        excludeWalletIds: [
          'a797aa35c0fadbfc1a53e7f675162ed5226968b44a19ee3d24385c64d1d3c393', // Phantom wallet
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
      web3ModalInitialized = true;
    } catch (error) {
      console.warn('Failed to initialize Web3Modal:', error);
    }
  }
}

export default function Web3ModalProvider({ children, initialState }: { children: ReactNode; initialState?: State }) {
  useEffect(() => {
    initializeWeb3Modal();
  }, []);

  return (
    <WagmiProvider config={config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}