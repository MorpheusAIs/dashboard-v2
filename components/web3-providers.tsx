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
    // Override console.error to suppress specific Ethereum-related errors
    const originalConsoleError = console.error;
    console.error = (...args) => {
      const errorMessage = args.join(' ');
      
      // Suppress these specific errors that come from conflicting wallet extensions
      const suppressPatterns = [
        'Cannot redefine property: ethereum',
        'Cannot set property ethereum',
        'Cannot read properties of undefined (reading \'id\')',
        'Unchecked runtime.lastError',
      ];
      
      const shouldSuppress = suppressPatterns.some(pattern => 
        errorMessage.includes(pattern)
      );
      
      if (!shouldSuppress) {
        originalConsoleError(...args);
      }
    };

    // Also add a global error handler to catch unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason && typeof event.reason.message === 'string' && 
          event.reason.message.includes('ethereum')) {
        event.preventDefault();
      }
    };
    
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Cleanup function to handle proper disconnection
    return () => {
      // Restore original console.error
      console.error = originalConsoleError;
      
      // Remove error handler
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      
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