"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccount } from "wagmi";
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
  // Use the wallet's actual chain (not the wagmi config default) so the
  // network check reflects what the user is really connected to
  const { address, chainId } = useAccount();
  const { switchToChain } = useNetwork();

  // Bidirectional bridging: Arbitrum ↔ Base
  const [fromChain, setFromChain] = useState<"arbitrum" | "base">("arbitrum");
  const [toChain, setToChain] = useState<"arbitrum" | "base">("base");
  const [bridgeAmount, setBridgeAmount] = useState<string>("");
  const [fromAddress, setFromAddress] = useState<string>("");
  const [recipientAddress, setRecipientAddress] = useState<string>("");
  const [isFromAutoSet, setIsFromAutoSet] = useState<boolean>(false); // Track if from was auto-set to the connected wallet
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

  // Network switching is user-initiated only (via the alert banner below).
  // Firing wallet_switchEthereumChain automatically on page load caused some
  // wallet extensions to crash the tab (Chrome "Aw, Snap!"
  // RESULT_CODE_KILLED_BAD_MESSAGE) while the page was still hydrating.

  // Use shared hook to get balances (prevents duplicate RPC calls)
  // Balances follow the from address (the source of funds), falling back to
  // the connected wallet while the from address is empty or invalid
  const isFromAddressValid = /^0x[a-fA-F0-9]{40}$/.test(fromAddress);
  const balanceAddress = (isFromAddressValid ? fromAddress : address) as `0x${string}` | undefined;
  const { arbitrumBalance, baseBalance } = useMORBalances(balanceAddress);

  // Get balance for source chain (Arbitrum or Base)
  const sourceBalance = sourceChainId === arbitrum.id ? arbitrumBalance : baseBalance;

  // Format balance for display
  const formattedBalance = useMemo(() => {
    if (!sourceBalance) return 0;
    return parseFloat(formatEther(sourceBalance));
  }, [sourceBalance]);

  // Initialize the from address from the connected wallet (only when empty)
  useEffect(() => {
    if (address && !fromAddress) {
      setFromAddress(address);
      setIsFromAutoSet(true);
    }
  }, [address, fromAddress]);

  // The recipient defaults to the from address (the source of funds), not the
  // signing wallet, so Safe flows keep the vault as the default destination
  useEffect(() => {
    if (!recipientAddress && (fromAddress || address)) {
      setRecipientAddress((fromAddress || address) as string);
      setIsRecipientAutoSet(true);
    }
  }, [address, fromAddress, recipientAddress]);

  // Recipient tracks the from address while it was never manually edited
  useEffect(() => {
    if (fromAddress && isRecipientAutoSet && recipientAddress && recipientAddress !== fromAddress) {
      setRecipientAddress(fromAddress);
    }
  }, [fromAddress, isRecipientAutoSet, recipientAddress]);

  // Handle account changes: auto-set addresses follow the new account, manual entries are kept
  useEffect(() => {
    if (address && fromAddress && isFromAutoSet && fromAddress !== address) {
      setFromAddress(address);
    }
  }, [address, fromAddress, isFromAutoSet]);

  // Reset auto-set flags when wallet disconnects (but keep manual addresses)
  useEffect(() => {
    if (!address) {
      setIsFromAutoSet(false);
      setIsRecipientAutoSet(false);
    }
  }, [address]);

  // Track when the user manually changes the from address (not auto-set)
  const handleFromChange = (newAddress: string) => {
    setFromAddress(newAddress);
    setIsFromAutoSet(false); // Mark as manually set
  };

  // Track when user manually changes recipient address (not auto-set)
  const handleRecipientChange = (newAddress: string) => {
    setRecipientAddress(newAddress);
    setIsRecipientAutoSet(false); // Mark as manually set
  };

  // Handle chain switching
  const handleChainSwitch = async () => {
    if (chainId !== sourceChainId) {
      try {
        await switchToChain(sourceChainId);
      } catch (error) {
        console.error(`Failed to switch to ${fromChain === "arbitrum" ? "Arbitrum One" : "Base"}:`, error);
      }
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
        fromAddress={fromAddress}
        onFromChange={handleFromChange}
        signerAddress={address ?? ""}
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
