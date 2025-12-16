'use client'

import { useEffect } from 'react'
import Web3ModalProvider from "@/context"
import { cookieToInitialState } from "wagmi"
import WalletErrorBoundary from './WalletErrorBoundary'
import { NetworkProvider } from '@/context/network-context'
import { NetworkEnvironment } from '@/config/networks'

// Type for wallet detection properties (extends the existing ethereum provider)
interface WalletFlags {
  isRabby?: boolean;
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isTrust?: boolean;
  providers?: WalletFlags[];
}

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
    // Detect and log Rabby wallet presence for debugging
    const detectWallets = () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        const provider = window.ethereum as typeof window.ethereum & WalletFlags;
        console.log('🦊 Wallet detection:', {
          isRabby: provider.isRabby || false,
          isMetaMask: provider.isMetaMask || false,
          isCoinbaseWallet: provider.isCoinbaseWallet || false,
          isTrust: provider.isTrust || false,
          providerInfo: provider.providers ? `Multiple providers (${provider.providers.length})` : 'Single provider'
        });

        // If Rabby is detected, ensure it's the active provider
        if (provider.isRabby) {
          console.log('✅ Rabby wallet detected and active');
        } else if (provider.providers?.some((p) => (p as WalletFlags).isRabby)) {
          console.log('⚠️ Rabby wallet detected but not active. Multiple wallet providers found.');
          console.log('💡 Tip: Disable other wallet extensions or select Rabby in Web3Modal');
        }
      }
    };

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
              if (data) {
                // Try to parse and check for expired proposals/sessions
                const parsed = JSON.parse(data);
                if (parsed) {
                  const now = Date.now();
                  const expiry = parsed.expiry || parsed.proposal?.expiry || parsed.session?.expiry;
                  if (expiry && expiry < now) {
                    console.log('🧹 Clearing expired wallet data:', key);
                    localStorage.removeItem(key);
                  } else if (parsed.topic && !expiry) {
                    // Clear sessions without expiry info as they might be stale
                    console.log('🧹 Clearing stale wallet data (no expiry):', key);
                    localStorage.removeItem(key);
                  }
                }
              }
            } catch {
              // If we can't parse it, it's likely corrupt, so remove it
              console.log('🧹 Clearing corrupt wallet data:', key);
              localStorage.removeItem(key);
            }
          }
        });
      } catch (error) {
        console.warn('Error clearing expired wallet data:', error);
      }
    };

    // Detect wallets first
    detectWallets();
    
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