"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useAccount } from "wagmi";

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

// List of admin wallet addresses - use Set for O(1) lookup instead of O(n) array includes
const ADMIN_WALLETS_SET = new Set([
  '0x76CC9bCcDaf5cD6b6738c706F0611a2fF1EfB13e'
].map(addr => addr.toLowerCase()));

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isWalletInitialized, setIsWalletInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();
  
  // Check if the connected account is an admin (O(1) Set lookup)
  const isAdmin = walletAddress ? ADMIN_WALLETS_SET.has(walletAddress.toLowerCase()) : false;
  
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
    }
  }, [isConnected, isConnecting, isReconnecting, isWalletInitialized, address]);

  // Update loading state based on wallet initialization
  useEffect(() => {
    // Loading is done when wallet is initialized (whether connected or not)
    const loading = !isWalletInitialized;
    
    if (loading !== isLoading) {
      console.log('🔄 Auth loading state changed:', { loading, isWalletInitialized });
      setIsLoading(loading);
    }
  }, [isWalletInitialized, isLoading]);

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