"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useAccount } from "wagmi";

interface AuthContextType {
  walletAddress: string | null;
  isConnected: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  walletAddress: null,
  isConnected: false,
  isAdmin: false,
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

  return (
    <AuthContext.Provider
      value={{
        walletAddress,
        isConnected: !!walletAddress,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext); 