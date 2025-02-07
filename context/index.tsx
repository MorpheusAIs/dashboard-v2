"use client";

import React, { ReactNode } from "react";
import { config, projectId } from "@/config";
import { createWeb3Modal } from "@web3modal/wagmi/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { State, WagmiProvider } from "wagmi";
import { mainnet } from "wagmi/chains";

const queryClient = new QueryClient();

if (!projectId) throw new Error("Project ID is not defined");

createWeb3Modal({
  wagmiConfig: config,
  projectId,
  enableAnalytics: true,
  enableOnramp: true,
  themeMode: "dark",
  defaultChain: mainnet,
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