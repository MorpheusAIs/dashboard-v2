'use client'

import type { WidgetConfig } from '@lifi/widget'
import { ChainType, LiFiWidget, WidgetSkeleton } from '@lifi/widget'
import { createConfig } from '@lifi/sdk'
import { useMemo } from 'react'
import { projectId } from '@/config'

import { ClientOnly } from './ClientOnly'

export function LiFiWidgetComponent() {
  // Initialize LiFi SDK globally with fee: 0 BEFORE creating widget config
  // This ensures the SDK is configured before the widget makes any API calls
  useMemo(() => {
    if (typeof window !== 'undefined') {
      try {
        createConfig({
          integrator: 'Morpheus-NoFee',
          routeOptions: {
            fee: 0, // Explicitly disable integrator fees at global SDK level
          },
        })
      } catch (error) {
        // SDK might already be initialized, that's okay
        console.warn('LiFi SDK initialization:', error)
      }
    }
  }, [])

  const widgetConfig: WidgetConfig = useMemo(
    () => ({
      variant: 'wide',
      appearance: 'dark',
      integrator: 'Morpheus-NoFee',
      // Hide integrator fee UI since we're not charging fees
      hiddenUI: ['integratorStepDetails'],
      // Default bridge: MOR on Arbitrum -> MOR on Base
      fromChain: 42161, // Arbitrum One
      toChain: 8453, // Base
      fromToken: '0x092baadb7def4c3981454dd9c0a0d7ff07bcfc86', // MOR on Arbitrum
      toToken: '0x7431ada8a591c955a994a21710752ef9b882b8e3', // MOR on Base
      buildUrl: true, // keep URL in sync with initialized values
      // Restrict to only EVM chains - Ethereum, Arbitrum, and Base
      // This configuration ensures only EVM wallets are shown
      chains: {
        allow: [1, 42161, 8453], // Ethereum Mainnet, Arbitrum One, Base
      },
      theme: {
        colorSchemes: {
          light: {
            palette: {
              primary: {
                main: '#5C67FF',
              },
              secondary: {
                main: '#F7C2FF',
              },
            },
          },
          dark: {
            palette: {
              primary: {
                main: '#20dc8e',
              },
              secondary: {
                main: '#179c65',
              },
              success: {
                main: '#20dc8e',
              },
              info: {
                main: '#29ffc9',
              },
            },
          },
        },
        typography: {
          fontFamily: 'Inter, sans-serif',
        },
        container: {
          boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.08)',
          borderRadius: '16px',
        },
        shape: {
          borderRadius: 8,
        },
      },
      // Add custom tokens for MOR across networks - ensure they are featured prominently
      tokens: {
        featured: [
          {
            address: '0x092baadb7def4c3981454dd9c0a0d7ff07bcfc86',
            chainId: 42161,
            name: 'MorpheusAI',
            symbol: 'MOR',
            decimals: 18,
            logoURI:
              'https://assets.coingecko.com/coins/images/37969/standard/MOR200X200.png?1716327119',
          },
          {
            address: '0x7431ada8a591c955a994a21710752ef9b882b8e3',
            chainId: 8453,
            name: 'MorpheusAI',
            symbol: 'MOR',
            decimals: 18,
            logoURI:
              'https://assets.coingecko.com/coins/images/37969/standard/MOR200X200.png?1716327119',
          },
          {
            address: '0xcbb8f1bda10b9696c57e13bc128fe674769dcec0',
            chainId: 1,
            name: 'MorpheusAI',
            symbol: 'MOR',
            decimals: 18,
            logoURI:
              'https://assets.coingecko.com/coins/images/37969/standard/MOR200X200.png?1716327119',
          },
        ],
      },
      // Wallet configuration for EVM chains ONLY
      walletConfig: {
        // Explicitly configure wallet ecosystem order to prevent Solana prompts
        // This tells MetaMask and other multi-chain wallets to ONLY use EVM
        walletEcosystemsOrder: {
          MetaMask: [ChainType.EVM], // Only EVM, explicitly omit SVM (Solana)
          'Coinbase Wallet': [ChainType.EVM],
          Phantom: [ChainType.EVM], // If Phantom is detected, use only EVM mode
          Trust: [ChainType.EVM],
          'Rabby Wallet': [ChainType.EVM],
          Brave: [ChainType.EVM],
        },
        // Force using EVM connect flow by delegating to injected provider
        // This bypasses any internal multi-ecosystem prompts
        async onConnect() {
          try {
            if (typeof window !== 'undefined') {
              const eth = (window as unknown as { ethereum?: { request: (args: { method: string }) => Promise<unknown> } }).ethereum
              if (eth?.request) {
                await eth.request({ method: 'eth_requestAccounts' })
              }
            }
          } catch {
            // no-op; widget will still show its menu if this fails
          }
        },
        walletConnect: {
          projectId:
            process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || projectId || '0000000000000000000000000000000',
        },
      },
    }),
    [],
  )

  return (
    <ClientOnly fallback={<WidgetSkeleton config={widgetConfig} />}>
      <LiFiWidget config={widgetConfig} integrator='Morpheus-NoFee' />
    </ClientOnly>
  )
}

