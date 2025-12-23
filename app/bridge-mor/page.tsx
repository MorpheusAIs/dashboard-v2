"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccount, useChainId, useReadContract } from "wagmi";
import { arbitrum, base } from "wagmi/chains";
import { morTokenContracts } from "@/lib/contracts";
import { formatEther, parseUnits, type Address } from "viem";
import { ArbitrumIcon, BaseIcon } from "@/components/network-icons";
import { BridgeFormCard } from "@/components/bridge/bridge-form-card";
import { useNetwork } from "@/context/network-context";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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
  const { switchToChain } = useNetwork();

  // Default to Arbitrum -> Base
  const [fromChain, setFromChain] = useState<"arbitrum" | "base">("arbitrum");
  const [toChain, setToChain] = useState<"arbitrum" | "base">("base");
  const [bridgeAmount, setBridgeAmount] = useState<string>("");
  const [recipientAddress, setRecipientAddress] = useState<string>("");

  // Get source chain ID
  const sourceChainId = fromChain === "arbitrum" ? arbitrum.id : base.id;
  const destinationChainId = toChain === "arbitrum" ? arbitrum.id : base.id;

  // Get LayerZero endpoint ID for destination
  const destinationEid = useMemo(() => {
    return toChain === "arbitrum" ? LAYERZERO_ENDPOINTS.ARBITRUM : LAYERZERO_ENDPOINTS.BASE;
  }, [toChain]);

  // Fetch balances from both networks
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

  const { data: baseBalance, refetch: refetchBase } = useReadContract({
    address: morTokenContracts[8453] as `0x${string}`,
    abi: MOR_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: 8453,
    query: {
      enabled: !!address,
    },
  });

  // Get current balance for source chain
  const sourceBalance = useMemo(() => {
    if (fromChain === "arbitrum") {
      return arbitrumBalance;
    } else {
      return baseBalance;
    }
  }, [fromChain, arbitrumBalance, baseBalance]);

  // Format balance for display
  const formattedBalance = useMemo(() => {
    if (!sourceBalance) return 0;
    return parseFloat(formatEther(sourceBalance));
  }, [sourceBalance]);

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
    // Refetch balances after a delay
    setTimeout(() => {
      refetchArbitrum();
      refetchBase();
    }, 3000);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Bridge MOR Tokens</h1>
        <p className="text-gray-400">
          Transfer MOR tokens between Arbitrum One and Base using LayerZero
        </p>
      </div>

      {/* Network Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Select Networks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {/* From Chain */}
            <div className="space-y-2">
              <label className="text-sm text-gray-400">From</label>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setFromChain("arbitrum");
                    setToChain("base");
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
                    fromChain === "arbitrum"
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-gray-700 hover:border-gray-600"
                  }`}
                >
                  <ArbitrumIcon size={20} />
                  <span>Arbitrum One</span>
                </button>
                <button
                  onClick={() => {
                    setFromChain("base");
                    setToChain("arbitrum");
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
                    fromChain === "base"
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-gray-700 hover:border-gray-600"
                  }`}
                >
                  <BaseIcon size={20} />
                  <span>Base</span>
                </button>
              </div>
            </div>

            {/* To Chain */}
            <div className="space-y-2">
              <label className="text-sm text-gray-400">To</label>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setToChain("arbitrum");
                    setFromChain("base");
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
                    toChain === "arbitrum"
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-gray-700 hover:border-gray-600"
                  }`}
                >
                  <ArbitrumIcon size={20} />
                  <span>Arbitrum One</span>
                </button>
                <button
                  onClick={() => {
                    setToChain("base");
                    setFromChain("arbitrum");
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
                    toChain === "base"
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-gray-700 hover:border-gray-600"
                  }`}
                >
                  <BaseIcon size={20} />
                  <span>Base</span>
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
        destinationChainId={destinationChainId}
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
            • Bridge transfers typically complete in 5-15 minutes
          </p>
          <p>
            • Tokens are burned on the source chain and minted on the destination chain
          </p>
          <p>
            • You need a small amount of native ETH for LayerZero gas fees
          </p>
          <p>
            • Make sure you&apos;re connected to the source network before bridging
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
