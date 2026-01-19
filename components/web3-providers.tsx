'use client'

import { useEffect } from 'react'
import Web3ModalProvider from "@/context"
import { cookieToInitialState } from "wagmi"
import WalletErrorBoundary from './WalletErrorBoundary'
import { NetworkProvider } from '@/context/network-context'
import { NetworkEnvironment } from '@/config/networks'
import {
  shouldSuppressConsoleError,
  shouldSuppressRejection,
  clearExpiredWalletData,
  clearAllWalletData,
} from '@/lib/utils/error-suppression'

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
    // Clear expired WalletConnect data on app initialization to prevent "Proposal expired" errors
    clearExpiredWalletData();

    // Override console.error to suppress specific Ethereum-related errors
    const originalConsoleError = console.error;
    console.error = (...args) => {
      const errorMessage = args.join(' ');
      if (!shouldSuppressConsoleError(errorMessage)) {
        originalConsoleError(...args);
      }
    };

    // Enhanced global error handler to catch unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;
      const errorMessage = error?.message || '';

      if (shouldSuppressRejection(errorMessage)) {
        console.log('Suppressing wallet connection error:', errorMessage);
        event.preventDefault();
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Cleanup function to handle proper disconnection
    return () => {
      console.error = originalConsoleError;
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      clearAllWalletData();
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