"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAccount, useConfig, useReconnect } from "wagmi";
import { watchAccount } from '@wagmi/core';
import { toast } from 'sonner';

// Define a User type to replace 'any'
interface User {
  address: string | null;
  displayName?: string;
}

interface AuthContextType {
  user: User | null; // Replaced 'any' with User type
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  userAddress: string | null;
  isWalletInitialized: boolean; // New: Track wallet initialization state
  login: () => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isAdmin: false,
  userAddress: null,
  isWalletInitialized: false,
  login: async () => {},
  logout: async () => {},
  checkAuth: async () => {},
});

// List of admin wallet addresses
const ADMIN_WALLETS = [
  '0x76CC9bCcDaf5cD6b6738c706F0611a2fF1EfB13e'
].map(addr => addr.toLowerCase());

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isWalletInitialized, setIsWalletInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionTimeout, setConnectionTimeout] = useState<NodeJS.Timeout | null>(null);
  
  const { address, isConnected, isConnecting, isReconnecting, connector } = useAccount();
  const config = useConfig();
  const { reconnect } = useReconnect();
  
  // Check if the connected account is an admin
  const isAdmin = walletAddress ? ADMIN_WALLETS.includes(walletAddress.toLowerCase()) : false;
  
  // Update wallet address when the account changes
  useEffect(() => {
    setWalletAddress(address || null);
  }, [address]);

  // Track wallet initialization state
  useEffect(() => {
    // Consider wallet initialized when it's not in connecting/reconnecting state
    // This includes both connected and disconnected states (but not pending states)
    const initialized = !isConnecting && !isReconnecting;
    
    if (initialized !== isWalletInitialized) {
      console.log('🔐 Wallet initialization state changed:', {
        isConnected,
        isConnecting,
        isReconnecting,
        initialized,
        address: address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null
      });
      setIsWalletInitialized(initialized);
      
      // Clear any connection timeout when initialized
      if (initialized && connectionTimeout) {
        clearTimeout(connectionTimeout);
        setConnectionTimeout(null);
      }
    }
    
    // Set a safety timeout if we're stuck in connecting state
    if ((isConnecting || isReconnecting) && !connectionTimeout) {
      console.log('⏱️ Starting connection timeout (5 minutes)...');
      const timeout = setTimeout(() => {
        console.warn('⚠️ Connection timeout - forcing initialization');
        setIsWalletInitialized(true);
        setIsLoading(false);
        
        // Clean up any stale WalletConnect data
        try {
          Object.keys(localStorage).forEach(key => {
            if (key.includes('wc@2') || key.includes('@walletconnect') || key.includes('appkit-')) {
              localStorage.removeItem(key);
            }
          });
        } catch (err) {
          console.warn('Failed to clean up after timeout:', err);
        }
      }, 5 * 60 * 1000); // 5 minutes - matches WalletConnect proposal timeout
      
      setConnectionTimeout(timeout);
    }
    
    // Cleanup timeout on unmount
    return () => {
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
      }
    };
  }, [isConnected, isConnecting, isReconnecting, isWalletInitialized, address, connectionTimeout]);

  // Update loading state based on wallet initialization
  useEffect(() => {
    // Loading is done when wallet is initialized (whether connected or not)
    const loading = !isWalletInitialized;
    
    if (loading !== isLoading) {
      console.log('🔄 Auth loading state changed:', { loading, isWalletInitialized });
      setIsLoading(loading);
    }
  }, [isWalletInitialized, isLoading]);

  // Watch for account changes using wagmi core
  useEffect(() => {
    const unwatch = watchAccount(config, {
      onChange(account) {
        console.log('👀 Account changed detected:', {
          address: account.address ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}` : null,
          status: account.status,
          connector: account.connector?.name,
          isConnected: account.status === 'connected'
        });
        
        // Update wallet address immediately when account changes
        if (account.address && account.status === 'connected') {
          setWalletAddress(account.address);
        } else if (account.status === 'disconnected') {
          setWalletAddress(null);
        }
      },
    });

    return () => unwatch();
  }, [config]);

  // Handle window focus - check connection state when user returns from Safe tab
  const handleWindowFocus = useCallback(() => {
    // Only attempt reconnection if we're not already connected or connecting
    if (!isConnected && !isConnecting && !isReconnecting) {
      console.log('🔄 Window focused - checking for pending connections...');
      
      // Check if there's WalletConnect data in localStorage
      const hasWCData = Object.keys(localStorage).some(key => 
        key.includes('wc@2') || 
        key.includes('@walletconnect') ||
        key.includes('appkit')
      );
      
      if (hasWCData) {
        console.log('📱 WalletConnect session detected - attempting reconnection...');
        // Attempt to reconnect to restore the session
        reconnect();
      }
    }
  }, [isConnected, isConnecting, isReconnecting, reconnect]);

  useEffect(() => {
    window.addEventListener('focus', handleWindowFocus);
    
    return () => {
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [handleWindowFocus]);

  // Listen for connector events (particularly useful for WalletConnect/Safe)
  useEffect(() => {
    if (!connector) return;

    const handleConnect = (data: { address?: string }) => {
      console.log('✅ Connector connected:', {
        connector: connector.name,
        address: data.address ? `${data.address.slice(0, 6)}...${data.address.slice(-4)}` : null
      });
    };

    const handleChange = (data: { accounts?: readonly string[] }) => {
      console.log('🔄 Connector accounts changed:', {
        connector: connector.name,
        accounts: data.accounts?.map(addr => `${addr.slice(0, 6)}...${addr.slice(-4)}`)
      });
    };

    const handleDisconnect = () => {
      console.log('❌ Connector disconnected:', connector.name);
      // Reset wallet address when disconnected
      setWalletAddress(null);
    };

    const handleError = (error: Error) => {
      console.error('❌ Connector error:', {
        connector: connector.name,
        error: error.message
      });
      
      // If it's a proposal expired error, ensure we're not stuck in loading
      if (error.message?.toLowerCase().includes('proposal expired') || 
          error.message?.toLowerCase().includes('expired')) {
        console.log('⏰ Proposal expired - resetting connection state');
        setWalletAddress(null);
        setIsWalletInitialized(true); // Force initialization to exit loading state
        setIsLoading(false); // Explicitly exit loading state
        
        // Clear WalletConnect data
        try {
          Object.keys(localStorage).forEach(key => {
            if (key.includes('wc@2') || key.includes('@walletconnect') || key.includes('appkit-')) {
              localStorage.removeItem(key);
            }
          });
          
          // Show user-friendly notification
          toast.error('Connection Timeout', {
            description: 'The wallet connection request timed out. Please try again and approve more quickly.',
            duration: 6000,
          });
        } catch (err) {
          console.warn('Failed to clean up after proposal expiration:', err);
        }
      }
    };

    // Subscribe to connector events
    const connectUnsub = connector.emitter?.on?.('connect', handleConnect);
    const changeUnsub = connector.emitter?.on?.('change', handleChange);
    const disconnectUnsub = connector.emitter?.on?.('disconnect', handleDisconnect);
    const errorUnsub = connector.emitter?.on?.('error', handleError);

    return () => {
      connectUnsub?.();
      changeUnsub?.();
      disconnectUnsub?.();
      errorUnsub?.();
    };
  }, [connector]);

  // Create user object when wallet address changes
  const user = walletAddress ? { address: walletAddress } : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!walletAddress,
        isLoading,
        isAdmin,
        userAddress: walletAddress,
        isWalletInitialized,
        login: async () => {},
        logout: async () => {},
        checkAuth: async () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext); 