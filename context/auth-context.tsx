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
  const { address } = useAccount();
  
  // Check if the connected account is an admin
  const isAdmin = walletAddress ? ADMIN_WALLETS.includes(walletAddress.toLowerCase()) : false;
  
  // Update wallet address when the account changes
  useEffect(() => {
    setWalletAddress(address || null);
  }, [address]);

  // Create user object when wallet address changes
  const user = walletAddress ? { address: walletAddress } : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!walletAddress,
        isLoading: false,
        isAdmin,
        userAddress: walletAddress,
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