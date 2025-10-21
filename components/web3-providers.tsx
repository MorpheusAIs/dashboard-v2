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
    // Bail out if running on server
    if (typeof window === 'undefined') return;

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

    // Clear expired data immediately on app start (one-time)
    clearExpiredWalletData();

    // Only override console.error once
    const originalConsoleError = console.error;
    const patchedFlag = '__morpheus_console_patched__';
    const g = window as unknown as Record<string, unknown>;
    if (!g[patchedFlag]) {
      g[patchedFlag] = true;
      console.error = (...args) => {
        const errorMessage = args.join(' ');
        const suppressPatterns = [
          'Cannot redefine property: ethereum',
          'Cannot set property ethereum',
          "Cannot read properties of undefined (reading 'id')",
          'Unchecked runtime.lastError',
          'Proposal expired',
          'Session expired',
          'Connection proposal expired',
          'WalletConnect proposal expired',
        ];
        const shouldSuppress = suppressPatterns.some(pattern => errorMessage.includes(pattern));
        if (!shouldSuppress) {
          originalConsoleError(...args);
        }
      };
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;
      const errorMessage = error?.message?.toLowerCase() || '';
      const walletErrorPatterns = [
        'ethereum',
        'proposal expired',
        'session expired',
        'connection expired',
        'walletconnect',
        'user rejected',
        'connection request reset'
      ];
      const shouldSuppress = walletErrorPatterns.some(pattern => errorMessage.includes(pattern));
      if (shouldSuppress) {
        console.log('🤫 Suppressing wallet connection error:', errorMessage);
        event.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      // Restore original console.error on unmount of provider tree
      console.error = originalConsoleError;
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