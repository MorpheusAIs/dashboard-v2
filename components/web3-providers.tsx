'use client'

import { useEffect } from 'react'
import Web3ModalProvider from "@/context"
import type { State } from "wagmi"
import WalletErrorBoundary from './WalletErrorBoundary'
import { NetworkProvider } from '@/context/network-context'
import { NetworkEnvironment } from '@/config/networks'

export function Web3Providers({ 
  children,
  initialState
}: { 
  children: React.ReactNode
  initialState?: State
}) {
  // Default environment is mainnet for safety
  const defaultEnvironment: NetworkEnvironment = 'mainnet';

  useEffect(() => {
    // Clear expired WalletConnect data on app initialization to prevent "Proposal expired" errors
    const clearExpiredWalletData = () => {
      try {
        const keysToCheck = Object.keys(localStorage);
        keysToCheck.forEach(key => {
          if (key.toLowerCase().includes('walletconnect') || 
              key.includes('wc@2') ||
              key.includes('@walletconnect') ||
              key.includes('wcm-') ||
              key.includes('appkit-')) {
            try {
              const data = localStorage.getItem(key);
              const trimmedData = data?.trim();
              if (trimmedData?.startsWith('{') || trimmedData?.startsWith('[')) {
                const parsed = JSON.parse(trimmedData);
                if (parsed) {
                  const now = Date.now();
                  const expiry = Number(parsed.expiry || parsed.proposal?.expiry || parsed.session?.expiry);
                  const expiryMs = expiry < 1_000_000_000_000 ? expiry * 1000 : expiry;
                  if (Number.isFinite(expiryMs) && expiryMs < now) {
                    console.log('🧹 Clearing expired wallet data:', key);
                    localStorage.removeItem(key);
                  }
                }
              }
            } catch (error) {
              console.warn('Unable to inspect wallet storage entry:', key, error);
            }
          }
        });
      } catch (error) {
        console.warn('Error clearing expired wallet data:', error);
      }
    };

    // Clear expired data immediately on app start
    clearExpiredWalletData();

    // Override console.error to suppress specific Ethereum-related errors
    const originalConsoleError = console.error;
    console.error = (...args) => {
      const errorMessage = args.join(' ');
      
      // Suppress these specific errors that come from conflicting wallet extensions and connection issues
      const suppressPatterns = [
        'Cannot redefine property: ethereum',
        'Cannot set property ethereum',
        'Cannot read properties of undefined (reading \'id\')',
        'Unchecked runtime.lastError',
        'Proposal expired',
        'Session expired',
        'Connection proposal expired',
        'WalletConnect proposal expired',
      ];
      
      const shouldSuppress = suppressPatterns.some(pattern => 
        errorMessage.includes(pattern)
      );
      
      if (!shouldSuppress) {
        originalConsoleError(...args);
      }
    };

    // Enhanced global error handler to catch unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;
      const errorMessage = error?.message?.toLowerCase() || '';
      
      // Suppress wallet connection related errors including proposal expired
      const walletErrorPatterns = [
        'ethereum',
        'proposal expired',
        'session expired',
        'connection expired',
        'walletconnect',
        'user rejected',
        'connection request reset'
      ];
      
      const shouldSuppress = walletErrorPatterns.some(pattern => 
        errorMessage.includes(pattern)
      );
      
      if (shouldSuppress) {
        console.log('🤫 Suppressing wallet connection error:', errorMessage);
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
