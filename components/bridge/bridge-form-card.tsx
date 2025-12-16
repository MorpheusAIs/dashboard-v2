"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { parseUnits, formatEther, type Address } from "viem";
import { morTokenContracts } from "@/lib/contracts";
import MOR20_ABI from "@/app/abi/MOR20.json";
import { toast } from "sonner";
import { ArbitrumIcon, BaseIcon } from "@/components/network-icons";

interface BridgeFormCardProps {
  fromChain: "arbitrum" | "base";
  toChain: "arbitrum" | "base";
  sourceChainId: number;
  destinationChainId: number;
  destinationEid: number;
  balance: number;
  bridgeAmount: string;
  onAmountChange: (amount: string) => void;
  recipientAddress: string;
  onRecipientChange: (address: string) => void;
  onBridgeSuccess: () => void;
  isCorrectNetwork: boolean;
}

export function BridgeFormCard({
  fromChain,
  toChain,
  sourceChainId,
  destinationChainId,
  destinationEid,
  balance,
  bridgeAmount,
  onAmountChange,
  recipientAddress,
  onRecipientChange,
  onBridgeSuccess,
  isCorrectNetwork,
}: BridgeFormCardProps) {
  const { address } = useAccount();
  const [isQuoting, setIsQuoting] = useState(false);
  const [quoteFee, setQuoteFee] = useState<{ nativeFee: bigint; lzTokenFee: bigint } | null>(null);
  const [expectedOutput, setExpectedOutput] = useState<number | null>(null);

  // Get MOR token address for source chain
  const morTokenAddress = useMemo(() => {
    return morTokenContracts[sourceChainId] as `0x${string}` | undefined;
  }, [sourceChainId]);

  // Quote the bridge fee
  const { data: quoteData, refetch: refetchQuote, isLoading: isQuoteLoading } = useReadContract({
    address: morTokenAddress,
    abi: MOR20_ABI,
    functionName: "quoteSend",
    args: bridgeAmount && recipientAddress && parseFloat(bridgeAmount) > 0 && isRecipientValid
      ? [
          {
            dstEid: destinationEid,
            to: `0x000000000000000000000000${recipientAddress.replace("0x", "").toLowerCase()}` as `0x${string}`,
            amountLD: parseUnits(bridgeAmount, 18),
            minAmountLD: parseUnits(bridgeAmount, 18),
            extraOptions: "0x" as `0x${string}`,
            composeMsg: "0x" as `0x${string}`,
            oftCmd: "0x" as `0x${string}`,
          },
          false, // payInLzToken
        ]
      : undefined,
    chainId: sourceChainId,
    query: {
      enabled: !!morTokenAddress && !!bridgeAmount && parseFloat(bridgeAmount) > 0 && !!recipientAddress && isRecipientValid && isCorrectNetwork,
    },
  });

  // Update quote fee when quote data changes
  useEffect(() => {
    if (quoteData) {
      // Handle both possible return structures from viem
      // Could be { nativeFee, lzTokenFee } or { msgFee: { nativeFee, lzTokenFee } }
      const feeData = (quoteData as any).msgFee || quoteData;
      if (feeData && feeData.nativeFee !== undefined && feeData.lzTokenFee !== undefined) {
        setQuoteFee({
          nativeFee: BigInt(feeData.nativeFee.toString()),
          lzTokenFee: BigInt(feeData.lzTokenFee.toString()),
        });
        // Expected output is the same as input (1:1 bridge)
        if (bridgeAmount) {
          setExpectedOutput(parseFloat(bridgeAmount));
        }
      }
    } else {
      setQuoteFee(null);
      setExpectedOutput(null);
    }
  }, [quoteData, bridgeAmount]);

  // Write contract for bridge
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    chainId: sourceChainId,
  });

  // Handle successful transaction
  useEffect(() => {
    if (isSuccess) {
      toast.success("Bridge transaction submitted! Tokens will arrive in 5-15 minutes.");
      onBridgeSuccess();
      setQuoteFee(null);
      setExpectedOutput(null);
    }
  }, [isSuccess, onBridgeSuccess]);

  // Handle errors
  useEffect(() => {
    if (error) {
      toast.error(`Bridge failed: ${error.message}`);
    }
  }, [error]);

  // Format amount to one decimal place
  const formatToOneDecimal = useCallback((value: number): string => {
    return (Math.floor(value * 10) / 10).toString();
  }, []);

  // Handle max button click
  const handleMaxClick = () => {
    if (balance > 0) {
      const formattedMaxAmount = formatToOneDecimal(balance);
      onAmountChange(formattedMaxAmount);
    }
  };

  // Validate amount
  const isAmountValid = useMemo(() => {
    const amount = parseFloat(bridgeAmount);
    if (isNaN(amount) || amount <= 0) return false;
    if (amount > balance) return false;
    return true;
  }, [bridgeAmount, balance]);

  // Validate recipient address
  const isRecipientValid = useMemo(() => {
    if (!recipientAddress) return false;
    // Basic Ethereum address validation
    return /^0x[a-fA-F0-9]{40}$/.test(recipientAddress);
  }, [recipientAddress]);

  // Update quote when amount or recipient changes (debounced)
  useEffect(() => {
    if (bridgeAmount && parseFloat(bridgeAmount) > 0 && isRecipientValid && isCorrectNetwork) {
      const timer = setTimeout(() => {
        refetchQuote();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [bridgeAmount, recipientAddress, isRecipientValid, isCorrectNetwork, refetchQuote]);

  // Handle bridge
  const handleBridge = async () => {
    if (!isAmountValid || !isRecipientValid || !morTokenAddress || !quoteFee) {
      return;
    }

    try {
      const amountWei = parseUnits(bridgeAmount, 18);
      const recipientBytes32 = `0x000000000000000000000000${recipientAddress.replace("0x", "").toLowerCase()}` as `0x${string}`;

      writeContract({
        address: morTokenAddress,
        abi: MOR20_ABI,
        functionName: "send",
        args: [
          {
            dstEid: destinationEid,
            to: recipientBytes32,
            amountLD: amountWei,
            minAmountLD: amountWei,
            extraOptions: "0x" as `0x${string}`,
            composeMsg: "0x" as `0x${string}`,
            oftCmd: "0x" as `0x${string}`,
          },
          {
            nativeFee: quoteFee.nativeFee,
            lzTokenFee: quoteFee.lzTokenFee,
          },
          address || ("0x0000000000000000000000000000000000000000" as `0x${string}`),
        ],
        value: quoteFee.nativeFee,
        chainId: sourceChainId,
      });
    } catch (err) {
      console.error("Bridge error:", err);
      toast.error("Failed to initiate bridge transaction");
    }
  };

  const isProcessing = isPending || isConfirming;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-bold">Bridge MOR Tokens</CardTitle>
        <CardDescription>
          Transfer from {fromChain === "arbitrum" ? "Arbitrum One" : "Base"} to{" "}
          {toChain === "arbitrum" ? "Arbitrum One" : "Base"}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-1 px-6 pb-3">
        <div className="space-y-4">
          {/* Balance Display */}
          {address && (
            <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
              <div className="flex items-center gap-2">
                {fromChain === "arbitrum" ? (
                  <ArbitrumIcon size={18} className="text-gray-400" />
                ) : (
                  <BaseIcon size={18} className="text-gray-400" />
                )}
                <span className="text-sm text-gray-400">
                  Balance on {fromChain === "arbitrum" ? "Arbitrum One" : "Base"}:
                </span>
              </div>
              <span className="text-sm font-medium text-gray-200">
                {balance >= 1 ? Math.floor(balance) : balance.toFixed(1)} MOR
              </span>
            </div>
          )}

          {/* Amount Input */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="bridge-amount">Amount to Bridge</Label>
            </div>
            <div className="relative">
              <Input
                id="bridge-amount"
                type="number"
                min="0"
                step="0.1"
                placeholder="Enter MOR amount"
                value={bridgeAmount}
                onChange={(e) => onAmountChange(e.target.value)}
                className="pr-32"
                disabled={!address || !isCorrectNetwork || isProcessing}
              />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {balance > 0 && (
                  <span className="text-xs text-gray-400">
                    {balance >= 1 ? Math.floor(balance) : balance.toFixed(1)} MOR
                  </span>
                )}
                <button
                  type="button"
                  className="h-8 px-2 text-xs copy-button-secondary"
                  onClick={handleMaxClick}
                  disabled={!address || balance <= 0 || !isCorrectNetwork || isProcessing}
                >
                  Max
                </button>
              </div>
            </div>
            {bridgeAmount && parseFloat(bridgeAmount) > balance && (
              <div className="text-yellow-400 text-sm">
                Amount exceeds your balance
              </div>
            )}
          </div>

          {/* Recipient Address */}
          <div className="space-y-2">
            <Label htmlFor="recipient-address">Recipient Address</Label>
            <Input
              id="recipient-address"
              type="text"
              placeholder="0x..."
              value={recipientAddress}
              onChange={(e) => onRecipientChange(e.target.value)}
              disabled={!address || !isCorrectNetwork || isProcessing}
            />
            {recipientAddress && !isRecipientValid && (
              <div className="text-yellow-400 text-sm">
                Invalid Ethereum address
              </div>
            )}
          </div>

          {/* Expected Output */}
          {isQuoteLoading && bridgeAmount && parseFloat(bridgeAmount) > 0 && (
            <div className="p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
              <div className="text-sm text-gray-400">Calculating fees...</div>
            </div>
          )}
          {expectedOutput !== null && quoteFee && !isQuoteLoading && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Expected Output:</span>
                <span className="text-sm font-medium text-emerald-400">
                  {expectedOutput >= 1 ? Math.floor(expectedOutput) : expectedOutput.toFixed(1)} MOR
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-500">Gas Fee:</span>
                <span className="text-xs text-gray-400">
                  {parseFloat(formatEther(quoteFee.nativeFee)) < 0.001
                    ? "< 0.001"
                    : parseFloat(formatEther(quoteFee.nativeFee)).toFixed(4)}{" "}
                  ETH
                </span>
              </div>
            </div>
          )}

          {/* Bridge Button */}
          {!address ? (
            <div className="text-center text-gray-400 text-sm py-4">
              Please connect your wallet to bridge tokens
            </div>
          ) : !isCorrectNetwork ? (
            <div className="text-center text-yellow-400 text-sm py-4">
              Please switch to {fromChain === "arbitrum" ? "Arbitrum One" : "Base"} network
            </div>
          ) : (
            <button
              onClick={handleBridge}
              className="w-full copy-button-base copy-button"
              disabled={
                !isAmountValid ||
                !isRecipientValid ||
                !quoteFee ||
                isProcessing ||
                !isCorrectNetwork ||
                isQuoteLoading
              }
            >
              {isProcessing
                ? isPending
                  ? "Confirming..."
                  : "Processing..."
                : "Bridge MOR"}
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
