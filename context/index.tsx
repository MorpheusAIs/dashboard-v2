"use client";

import React, { ReactNode, useEffect } from "react";
import { config, projectId } from "@/config";
import { createWeb3Modal } from "@web3modal/wagmi/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { State, WagmiProvider } from "wagmi";
import { mainnet } from "wagmi/chains";

const queryClient = new QueryClient();

if (!projectId) throw new Error("Project ID is not defined");

// Configure Web3Modal with mainnet as the default chain
const modal = createWeb3Modal({
  wagmiConfig: config,
  projectId,
  enableAnalytics: true,
  enableOnramp: true,
  themeMode: "dark",
  defaultChain: mainnet,
  excludeWalletIds: [
    'a797aa35c0fadbfc1a53e7f675162ed5226968b44a19ee3d24385c64d1d3c393', // Phantom wallet
  ],
  // Feature commonly used wallets at the top, but allow all others
  featuredWalletIds: [
    'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
    'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa', // Coinbase Wallet
    '225affb176778569276e484e1b92637ad061b01e13a048b35a9d280c3b58970f', // Safe
    '163d2cf19babf05eb8962e9748f9ebe613ed52ebf9c8107c9a0f104bfcf161b3', // Rabby Wallet
    '19177a98252e07ddfc9af2083ba8e07ef627cb6103467ffebb3f8f4205fd7927', // Ledger Live
    '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0', // Trust Wallet
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

function Web3ModalEventListener({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Subscribe to modal state changes
    const unsubscribeState = modal.subscribeState((state) => {
      console.log('📱 Web3Modal state changed:', {
        open: state.open,
        selectedNetworkId: state.selectedNetworkId,
        loading: state.loading
      });
      
      // If modal is not open and not loading, ensure we've cleaned up any expired proposals
      if (!state.open && !state.loading) {
        // Check for expired proposals and clean them up
        const hasExpiredProposals = Object.keys(localStorage).some(key => {
          if (key.includes('wc@2') || key.includes('@walletconnect') || key.includes('appkit-')) {
            try {
              const data = localStorage.getItem(key);
              if (data) {
                const parsed = JSON.parse(data);
                const now = Date.now();
                const expiry = parsed.expiry || parsed.proposal?.expiry;
                return expiry && expiry < now;
              }
            } catch {}
          }
          return false;
        });
        
        if (hasExpiredProposals) {
          console.log('🧹 Cleaning up expired proposals after modal close...');
          Object.keys(localStorage).forEach(key => {
            if (key.includes('wc@2') || key.includes('@walletconnect') || key.includes('appkit-')) {
              try {
                const data = localStorage.getItem(key);
                if (data) {
                  const parsed = JSON.parse(data);
                  const now = Date.now();
                  const expiry = parsed.expiry || parsed.proposal?.expiry;
                  if (expiry && expiry < now) {
                    localStorage.removeItem(key);
                  }
                }
              } catch {
                // If we can't parse it, it might be corrupt - remove it
                localStorage.removeItem(key);
              }
            }
          });
        }
      }
    });

    // Subscribe to events
    const unsubscribeEvents = modal.subscribeEvents((event) => {
      console.log('🎉 Web3Modal event:', event);
      
      // When modal closes, check if connection was successful
      if (event.data.event === 'MODAL_CLOSE') {
        console.log('🚪 Modal closed - checking connection status...');
      }
      
      // Track connection events
      if (event.data.event === 'CONNECT_SUCCESS') {
        console.log('✅ Connection successful via Web3Modal');
      }
      
      if (event.data.event === 'CONNECT_ERROR') {
        console.error('❌ Connection error via Web3Modal:', event.data.properties);
        
        // If it's a proposal expired error, clean up
        const errorMessage = event.data.properties?.message?.toLowerCase() || '';
        if (errorMessage.includes('proposal expired') || errorMessage.includes('expired')) {
          console.log('⏰ Detected proposal expiration - cleaning up...');
          Object.keys(localStorage).forEach(key => {
            if (key.includes('wc@2') || key.includes('@walletconnect') || key.includes('appkit-')) {
              localStorage.removeItem(key);
            }
          });
        }
      }
    });

    return () => {
      unsubscribeState();
      unsubscribeEvents();
    };
  }, []);

  return <>{children}</>;
}

export default function Web3ModalProvider({ children, initialState }: { children: ReactNode; initialState?: State }) {
  return (
    <WagmiProvider config={config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <Web3ModalEventListener>
          {children}
        </Web3ModalEventListener>
      </QueryClientProvider>
    </WagmiProvider>
  );
}