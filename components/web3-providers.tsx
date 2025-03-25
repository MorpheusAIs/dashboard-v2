'use client'

import { useEffect } from 'react'
import Web3ModalProvider from "@/context"
import { cookieToInitialState } from "wagmi"
import WalletErrorBoundary from './WalletErrorBoundary'
import { NetworkProvider } from '@/context/network-context'
import { NetworkEnvironment } from '@/config/networks'

export function Web3Providers({ 
  children,
  initialState
}: { 
  children: React.ReactNode
  initialState: ReturnType<typeof cookieToInitialState>
}) {
  // Default environment is mainnet for safety
  const defaultEnvironment: NetworkEnvironment = 'mainnet';

  useEffect(() => {
    // Cleanup function to handle proper disconnection
    return () => {
      // Clear any stored WalletConnect data from localStorage
      Object.keys(localStorage).forEach(key => {
        if (key.toLowerCase().includes('walletconnect')) {
          localStorage.removeItem(key)
        }
      })

      // Clear any stored session data
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('wagmi.connected')
        window.localStorage.removeItem('wagmi.wallet')
      }
    }
  }, [])

  return (
    <WalletErrorBoundary>
      <Web3ModalProvider initialState={initialState}>
        <NetworkProvider defaultEnvironment={defaultEnvironment}>
          {children}
        </NetworkProvider>
      </Web3ModalProvider>
    </WalletErrorBoundary>
  )
} 