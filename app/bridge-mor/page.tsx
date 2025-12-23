"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccount, useChainId, useReadContract } from "wagmi";
import { arbitrum, base } from "wagmi/chains";
import { morTokenContracts } from "@/lib/contracts";
import { formatEther } from "viem";
import { ArbitrumIcon, BaseIcon } from "@/components/network-icons";
import { BridgeFormCard } from "@/components/bridge/bridge-form-card";
import { useNetwork } from "@/context/network-context";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

// MOR Token ABI for balance checking and bridging
const MOR_ABI = [
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// LayerZero Endpoint IDs (from morlord.com chains.js)
const LAYERZERO_ENDPOINTS = {
  ARBITRUM: 30110,
  BASE: 30184,
} as const;

export default function BridgeMorPage() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { switchToChain, isNetworkSwitching } = useNetwork();
  const networkSwitchAttempted = useRef(false);

  // Fixed: Only Arbitrum -> Base bridging
  const fromChain = "arbitrum" as const;
  const toChain = "base" as const;
  const [bridgeAmount, setBridgeAmount] = useState<string>("");
  const [recipientAddress, setRecipientAddress] = useState<string>("");

  // Get source chain ID (always Arbitrum)
  const sourceChainId = arbitrum.id;
  const destinationEid = LAYERZERO_ENDPOINTS.BASE;

  // Auto-switch to Arbitrum One when page loads
  useEffect(() => {
    // Only switch if:
    // 1. Wallet is connected
    // 2. Not already on Arbitrum One
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
          console.error("Failed to auto-switch to Arbitrum One:", error);
          networkSwitchAttempted.current = false; // Reset on error so user can try again
        });
      }, 500);

      return () => clearTimeout(timer);
    }
    
    // Reset the flag when successfully on Arbitrum One
    if (chainId === sourceChainId) {
      networkSwitchAttempted.current = false;
    }
  }, [address, chainId, sourceChainId, switchToChain, isNetworkSwitching]);

  // Fetch Arbitrum balance (source chain)
  const { data: arbitrumBalance, refetch: refetchArbitrum } = useReadContract({
    address: morTokenContracts[42161] as `0x${string}`,
    abi: MOR_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: 42161,
    query: {
      enabled: !!address,
    },
  });

  // Format balance for display
  const formattedBalance = useMemo(() => {
    if (!arbitrumBalance) return 0;
    return parseFloat(formatEther(arbitrumBalance));
  }, [arbitrumBalance]);

  // Update recipient address when wallet connects
  useEffect(() => {
    if (address && !recipientAddress) {
      setRecipientAddress(address);
    }
  }, [address, recipientAddress]);

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
    // Refetch Arbitrum balance after a delay
    setTimeout(() => {
      refetchArbitrum();
    }, 3000);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Bridge MOR Tokens</h1>
        <p className="text-gray-400">
          Transfer MOR tokens from Arbitrum One to Base using LayerZero
        </p>
      </div>

      {/* Network Switch Alert */}
      {address && !isCorrectNetwork && (
        <Alert className="mb-6 border-yellow-500/50 bg-yellow-500/10">
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          <AlertDescription className="text-yellow-400">
            Please switch to Arbitrum One network to bridge tokens.
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
        onRecipientChange={setRecipientAddress}
        onBridgeSuccess={handleBridgeSuccess}
        isCorrectNetwork={isCorrectNetwork}
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
            • Tokens are burned on Arbitrum One and minted on Base
          </p>
          <p>
            • You need a small amount of Arbitrum ETH for LayerZero gas fees - not Ethereum mainnet ETH
          </p>
          <p>
            • Make sure you&apos;re connected to Arbitrum One network before bridging
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
