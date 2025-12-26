"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccount, useChainId } from "wagmi";
import { arbitrum, base } from "wagmi/chains";
import { formatEther } from "viem";
import { BridgeFormCard } from "@/components/bridge/bridge-form-card";
import { useNetwork } from "@/context/network-context";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useMORBalances } from "@/hooks/use-mor-balances";

// LayerZero Endpoint IDs (testnet - from morlord.com original implementation)
const LAYERZERO_ENDPOINTS = {
  ARBITRUM: 30110,
  BASE: 30184,
} as const;

export default function BridgeMorPage() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { switchToChain, isNetworkSwitching } = useNetwork();
  const networkSwitchAttempted = useRef(false);

  // Bidirectional bridging: Arbitrum ↔ Base
  const [fromChain, setFromChain] = useState<"arbitrum" | "base">("arbitrum");
  const [toChain, setToChain] = useState<"arbitrum" | "base">("base");
  const [bridgeAmount, setBridgeAmount] = useState<string>("");
  const [recipientAddress, setRecipientAddress] = useState<string>("");
  const [isRecipientAutoSet, setIsRecipientAutoSet] = useState<boolean>(false); // Track if recipient was auto-set

  // Handle switching bridge direction
  const handleSwitchDirection = () => {
    setFromChain((prev) => prev === "arbitrum" ? "base" : "arbitrum");
    setToChain((prev) => prev === "arbitrum" ? "base" : "arbitrum");
    setBridgeAmount(""); // Clear amount when switching
  };

  // Get source chain ID and destination EID based on direction
  const sourceChainId = fromChain === "arbitrum" ? arbitrum.id : base.id;
  const destinationEid = toChain === "base" ? LAYERZERO_ENDPOINTS.BASE : LAYERZERO_ENDPOINTS.ARBITRUM;

  // Auto-switch to source chain when page loads or direction changes
  useEffect(() => {
    // Only switch if:
    // 1. Wallet is connected
    // 2. Not already on source chain
    // 3. Haven't attempted switch yet
    // 4. Not currently switching
    if (
      address &&
      chainId !== undefined &&
      chainId !== sourceChainId &&
      !networkSwitchAttempted.current &&
      !isNetworkSwitching
    ) {
      networkSwitchAttempted.current = true;
      
      // Small delay to ensure page is loaded
      const timer = setTimeout(() => {
        switchToChain(sourceChainId).catch((error) => {
          console.error(`Failed to auto-switch to ${fromChain === "arbitrum" ? "Arbitrum One" : "Base"}:`, error);
          networkSwitchAttempted.current = false; // Reset on error so user can try again
        });
      }, 500);

      return () => clearTimeout(timer);
    }
    
    // Reset the flag when successfully on source chain
    if (chainId === sourceChainId) {
      networkSwitchAttempted.current = false;
    }
  }, [address, chainId, sourceChainId, switchToChain, isNetworkSwitching, fromChain]);

  // Use shared hook to get balances (prevents duplicate RPC calls)
  const { arbitrumBalance, baseBalance } = useMORBalances(address);

  // Get balance for source chain (Arbitrum or Base)
  const sourceBalance = sourceChainId === arbitrum.id ? arbitrumBalance : baseBalance;

  // Format balance for display
  const formattedBalance = useMemo(() => {
    if (!sourceBalance) return 0;
    return parseFloat(formatEther(sourceBalance));
  }, [sourceBalance]);

  // Update recipient address when wallet connects (only when empty)
  useEffect(() => {
    if (address && !recipientAddress) {
      setRecipientAddress(address);
      setIsRecipientAutoSet(true);
    }
  }, [address, recipientAddress]);

  // Handle account changes: update recipient if it was auto-set to a previous account
  useEffect(() => {
    if (address && recipientAddress && isRecipientAutoSet && recipientAddress !== address) {
      // If recipient was auto-set and doesn't match current address, update it
      // This handles the case where user switches between multiple connected accounts
      // Only updates if it was auto-set to prevent overwriting manually entered addresses
      setRecipientAddress(address);
    }
  }, [address, recipientAddress, isRecipientAutoSet]);

  // Reset auto-set flag when wallet disconnects (but keep manual addresses)
  useEffect(() => {
    if (!address) {
      setIsRecipientAutoSet(false);
    }
  }, [address]);

  // Track when user manually changes recipient address (not auto-set)
  const handleRecipientChange = (newAddress: string) => {
    setRecipientAddress(newAddress);
    setIsRecipientAutoSet(false); // Mark as manually set
  };

  // Handle chain switching
  const handleChainSwitch = async () => {
    if (chainId !== sourceChainId) {
      await switchToChain(sourceChainId);
    }
  };

  const isCorrectNetwork = chainId === sourceChainId;

  // Handle successful bridge
  const handleBridgeSuccess = () => {
    setBridgeAmount("");

    // Trigger immediate global MOR balance refresh
    if (typeof window !== 'undefined' && window.refreshMORBalances) {
      window.refreshMORBalances();
    }

    // Trigger additional refreshes to ensure balances are updated
    // This provides more aggressive polling after bridge transaction
    const refreshIntervals = [3000, 8000, 15000]; // 3s, 8s, 15s after transaction

    refreshIntervals.forEach(delay => {
      setTimeout(() => {
        if (typeof window !== 'undefined' && window.refreshMORBalances) {
          window.refreshMORBalances();
        }
      }, delay);
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Bridge MOR Tokens</h1>
        <p className="text-gray-400">
          Transfer MOR tokens between Arbitrum One and Base using LayerZero
        </p>
      </div>

      {/* Network Switch Alert */}
      {address && !isCorrectNetwork && (
        <Alert className="mb-6 border-yellow-500/50 bg-yellow-500/10">
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          <AlertDescription className="text-yellow-400">
            Please switch to {fromChain === "arbitrum" ? "Arbitrum One" : "Base"} network to bridge tokens.
            <button
              onClick={handleChainSwitch}
              className="ml-2 underline hover:no-underline"
            >
              Switch Network
            </button>
          </AlertDescription>
        </Alert>
      )}

      {/* Bridge Form */}
      <BridgeFormCard
        fromChain={fromChain}
        toChain={toChain}
        sourceChainId={sourceChainId}
        destinationEid={destinationEid}
        balance={formattedBalance}
        bridgeAmount={bridgeAmount}
        onAmountChange={setBridgeAmount}
        recipientAddress={recipientAddress}
        onRecipientChange={handleRecipientChange}
        onBridgeSuccess={handleBridgeSuccess}
        isCorrectNetwork={isCorrectNetwork}
        onSwitchDirection={handleSwitchDirection}
      />

      {/* Info Card */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Bridge Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-400">
          <p>
            • Bridge transfers typically complete in 2-5 minutes
          </p>
          <p>
            • Tokens are burned on the source chain and minted on the destination chain
          </p>
          <p>
            • You need a small amount of native ETH (Arbitrum ETH or Base ETH) for LayerZero gas fees - not Ethereum mainnet ETH
          </p>
          <p>
            • Make sure you&apos;re connected to the source network before bridging
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
