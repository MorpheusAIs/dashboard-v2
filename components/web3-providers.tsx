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
    // CRITICAL: Disable aggressive cleanup to prevent IndexedDB errors
    // WalletConnect manages its own storage lifecycle
    // Any localStorage manipulation can cause IndexedDB connection closure
    
    // Only run minimal cleanup on initial load, with a delay to avoid race conditions
    const clearExpiredWalletData = () => {
      // Add a delay to ensure WalletConnect has initialized
      setTimeout(() => {
        try {
          // Only clear obviously corrupt/empty entries
          // DO NOT touch any WalletConnect data that might be active
          const keysToCheck = Object.keys(localStorage);
          let clearedCount = 0;
          
          keysToCheck.forEach(key => {
            // Only target keys that are clearly safe to remove
            if (key.toLowerCase().includes('walletconnect') || 
                key.includes('wc@2') ||
                key.includes('@walletconnect') ||
                key.includes('wcm-') ||
                key.includes('appkit-')) {
              try {
                const data = localStorage.getItem(key);
                
                // ONLY remove if completely empty/null
                if (!data || data === 'null' || data === 'undefined') {
                  console.log('🧹 Removing empty wallet data:', key);
                  localStorage.removeItem(key);
                  clearedCount++;
                }
                // DO NOT parse or check expiry - too risky during active operations
                // Let WalletConnect manage its own lifecycle
              } catch {
                // Silently skip - don't interfere
              }
            }
          });
          
          if (clearedCount > 0) {
            console.log(`✅ Removed ${clearedCount} empty wallet data entries`);
          }
        } catch {
          // Silently fail - don't break the app
          console.warn('Cleanup skipped to avoid IndexedDB conflicts');
        }
      }, 2000); // 2 second delay to let WalletConnect initialize
    };

    // Only run minimal cleanup on app start, with delay
    clearExpiredWalletData();
    
    // REMOVED: Visibility change cleanup handler
    // This was causing IndexedDB errors when user switched tabs during transactions
    // WalletConnect manages its own storage lifecycle - we shouldn't interfere

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
        'Failed to execute \'transaction\' on \'IDBDatabase\'',
        'The database connection is closing',
        'InvalidStateError',
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
        'connection request reset',
        'idbdatabase',
        'database connection is closing',
        'invalidstateerror',
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
      
      // DO NOT clear any WalletConnect data on unmount
      // This causes IndexedDB errors during active transactions
      // WalletConnect manages its own lifecycle
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