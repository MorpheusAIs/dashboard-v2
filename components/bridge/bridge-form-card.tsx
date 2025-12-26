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
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient, useBalance } from "wagmi";
import { parseUnits, formatEther } from "viem";
import { morTokenContracts } from "@/lib/contracts";
import MOR20_ABI from "@/app/abi/MOR20.json";
import { toast } from "sonner";
import { ArbitrumIcon, BaseIcon } from "@/components/network-icons";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BridgeFormCardProps {
  fromChain: "arbitrum" | "base";
  toChain: "arbitrum" | "base";
  sourceChainId: number;
  destinationEid: number;
  balance: number;
  bridgeAmount: string;
  onAmountChange: (amount: string) => void;
  recipientAddress: string;
  onRecipientChange: (address: string) => void;
  onBridgeSuccess: () => void;
  isCorrectNetwork: boolean;
  onSwitchDirection: () => void;
}

export function BridgeFormCard({
  fromChain,
  toChain,
  sourceChainId,
  destinationEid,
  balance,
  bridgeAmount,
  onAmountChange,
  recipientAddress,
  onRecipientChange,
  onBridgeSuccess,
  isCorrectNetwork,
  onSwitchDirection,
}: BridgeFormCardProps) {
  const { address } = useAccount();
  const destinationChainId = (toChain === "base" ? 8453 : 42161) as 8453 | 42161;
  const destinationPublicClient = usePublicClient({ chainId: destinationChainId });
  const [quoteFee, setQuoteFee] = useState<{ nativeFee: bigint; lzTokenFee: bigint } | null>(null);
  const [expectedOutput, setExpectedOutput] = useState<number | null>(null);
  const [initialDestinationBalance, setInitialDestinationBalance] = useState<bigint | null>(null);
  const [isMonitoringDestination, setIsMonitoringDestination] = useState(false);

  // Check ETH balance for gas and LayerZero fees
  const { data: ethBalance } = useBalance({
    address,
    chainId: sourceChainId,
    query: {
      refetchInterval: false, // Disable automatic polling - only fetch when needed
    }
  });

  // Validate recipient address
  const isRecipientValid = useMemo(() => {
    if (!recipientAddress) return false;
    // Basic Ethereum address validation
    return /^0x[a-fA-F0-9]{40}$/.test(recipientAddress);
  }, [recipientAddress]);

  // Get MOR token address for source chain
  const morTokenAddress = useMemo(() => {
    const address = morTokenContracts[sourceChainId as keyof typeof morTokenContracts] as `0x${string}` | undefined;
    if (!address) {
      console.error(`MOR token contract not found for chain ID ${sourceChainId} (${fromChain})`);
    }
    return address;
  }, [sourceChainId, fromChain]);

  // Monitor destination network balance to detect when funds arrive
  const destinationMorTokenAddress = morTokenContracts[destinationChainId as keyof typeof morTokenContracts] as `0x${string}` | undefined;
  
  const { data: destinationBalance } = useReadContract({
    address: destinationMorTokenAddress,
    abi: [
      {
        inputs: [{ internalType: "address", name: "account", type: "address" }],
        name: "balanceOf",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
    ] as const,
    functionName: "balanceOf",
    args: recipientAddress && isRecipientValid ? [recipientAddress as `0x${string}`] : undefined,
    chainId: destinationChainId,
    query: {
      enabled: !!destinationMorTokenAddress && !!recipientAddress && isRecipientValid && isMonitoringDestination,
      refetchInterval: isMonitoringDestination ? 30000 : false, // Poll every 30 seconds when monitoring (reduced from 5s to minimize RPC calls)
    },
  });

  // Quote the bridge fee
  const { data: quoteData, isLoading: isQuoteLoading, error: quoteError } = useReadContract({
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
      refetchInterval: false, // Disable automatic polling for quotes - only refetch when inputs change
    },
  });

  // Update quote fee when quote data changes
  useEffect(() => {
    if (quoteData) {
      // Handle both possible return structures from viem
      // Could be { nativeFee, lzTokenFee } or { msgFee: { nativeFee, lzTokenFee } }
      const quoteDataTyped = quoteData as { msgFee?: { nativeFee: bigint | string | number; lzTokenFee: bigint | string | number }; nativeFee?: bigint | string | number; lzTokenFee?: bigint | string | number };
      const feeData = quoteDataTyped.msgFee || quoteDataTyped;
      if (feeData && typeof feeData === 'object' && 'nativeFee' in feeData && 'lzTokenFee' in feeData && feeData.nativeFee !== undefined && feeData.lzTokenFee !== undefined) {
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

  // Store expected output amount for monitoring
  const [monitoredAmount, setMonitoredAmount] = useState<number | null>(null);

  // Handle successful transaction - start monitoring destination balance
  useEffect(() => {
    if (isSuccess && expectedOutput) {
      // Capture the expected output before clearing
      setMonitoredAmount(expectedOutput);
      
      // Get initial destination balance - fetch it first, then start monitoring
      const fetchInitialBalance = async () => {
        if (destinationMorTokenAddress && recipientAddress && isRecipientValid && destinationPublicClient) {
          try {
            const balance = await destinationPublicClient.readContract({
              address: destinationMorTokenAddress,
              abi: [
                {
                  inputs: [{ internalType: "address", name: "account", type: "address" }],
                  name: "balanceOf",
                  outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
                  stateMutability: "view",
                  type: "function",
                },
              ] as const,
              functionName: "balanceOf",
              args: [recipientAddress as `0x${string}`],
            });
            setInitialDestinationBalance(balance);
          } catch (error) {
            console.warn(`Failed to fetch initial ${toChain === "base" ? "Base" : "Arbitrum"} balance:`, error);
          }
        }
        // Start monitoring after a short delay
        setTimeout(() => {
          setIsMonitoringDestination(true);
        }, 2000);
      };
      
      fetchInitialBalance();
      
      const destinationNetworkName = toChain === "base" ? "Base" : "Arbitrum One";
      toast.success(`Bridge transaction submitted! Monitoring ${destinationNetworkName} network for arrival...`, {
        duration: 5000,
      });
      onBridgeSuccess();
      setQuoteFee(null);
      setExpectedOutput(null);
    }
  }, [isSuccess, expectedOutput, destinationMorTokenAddress, recipientAddress, isRecipientValid, destinationPublicClient, destinationChainId, onBridgeSuccess, toChain]);

  // Detect when funds arrive on destination network
  useEffect(() => {
    if (
      isMonitoringDestination &&
      destinationBalance !== undefined &&
      initialDestinationBalance !== null &&
      monitoredAmount !== null
    ) {
      const currentBalance = destinationBalance;
      const expectedIncrease = parseUnits(monitoredAmount.toString(), 18);
      
      // Check if balance increased by approximately the expected amount (within 1% tolerance)
      const balanceIncrease = currentBalance - initialDestinationBalance;
      const tolerance = expectedIncrease / BigInt(100); // 1% tolerance
      
      if (balanceIncrease >= expectedIncrease - tolerance) {
        setIsMonitoringDestination(false);
        setInitialDestinationBalance(null);
        const formattedAmount = monitoredAmount >= 1 ? Math.floor(monitoredAmount) : monitoredAmount.toFixed(1);
        const destinationNetworkName = toChain === "base" ? "Base" : "Arbitrum One";
        
        // Immediately refresh MOR balances in navbar
        if (typeof window !== 'undefined' && window.refreshMORBalances) {
          window.refreshMORBalances();
        }
        
        toast.success(
          `🎉 Bridge complete! ${formattedAmount} MOR tokens have arrived on ${destinationNetworkName}!`,
          {
            duration: 5000,
            className: "bridge-success-toast",
          }
        );
        setMonitoredAmount(null);
      }
    }
  }, [destinationBalance, initialDestinationBalance, isMonitoringDestination, monitoredAmount, toChain]);

  // Stop monitoring after 10 minutes to avoid infinite polling
  useEffect(() => {
    if (isMonitoringDestination) {
      const timeout = setTimeout(() => {
        setIsMonitoringDestination(false);
        setInitialDestinationBalance(null);
        const destinationNetworkName = toChain === "base" ? "Base" : "Arbitrum One";
        toast.info(`Bridge monitoring stopped. Please check your ${destinationNetworkName} network balance manually.`, {
          duration: 5000,
        });
      }, 10 * 60 * 1000); // 10 minutes

      return () => clearTimeout(timeout);
    }
  }, [isMonitoringDestination, toChain]);

  // Format error message to show only first 2 lines
  const formatErrorMessage = useCallback((error: Error) => {
    const message = error.message || String(error);
    
    // Check if it's a user rejection - show simple message
    if (message.toLowerCase().includes("user rejected") || message.toLowerCase().includes("rejected the request")) {
      return {
        short: "Bridge failed: Transaction was cancelled",
        full: message,
        hasMore: false,
      };
    }
    
    // Split message by newlines and get first 2 lines
    const lines = message.split("\n");
    if (lines.length <= 2) {
      return {
        short: message,
        full: message,
        hasMore: false,
      };
    }
    
    // Show first 2 lines
    const firstTwoLines = lines.slice(0, 2).join("\n");
    return {
      short: firstTwoLines,
      full: message,
      hasMore: true,
    };
  }, []);

  // Handle quote errors
  useEffect(() => {
    if (quoteError && bridgeAmount && parseFloat(bridgeAmount) > 0 && isRecipientValid && isCorrectNetwork) {
      const errorMessage = quoteError instanceof Error ? quoteError.message : String(quoteError);
      console.error("Quote error details:", quoteError);
      
      // Check for common error patterns
      if (errorMessage.toLowerCase().includes("insufficient") || errorMessage.toLowerCase().includes("balance")) {
        toast.error("Insufficient balance or invalid amount for bridging", { duration: 5000 });
      } else if (errorMessage.toLowerCase().includes("endpoint") || errorMessage.toLowerCase().includes("layerzero")) {
        toast.error(`Bridge configuration error: ${fromChain === "base" ? "Base" : "Arbitrum"} to ${toChain === "base" ? "Base" : "Arbitrum"} may not be supported`, { duration: 8000 });
      } else {
        toast.error(`Failed to get bridge quote: ${errorMessage.substring(0, 100)}`, { duration: 8000 });
      }
    }
  }, [quoteError, bridgeAmount, isRecipientValid, isCorrectNetwork, fromChain, toChain]);

  // Handle transaction errors
  useEffect(() => {
    if (error) {
      const formatted = formatErrorMessage(error as Error);
      
      // Log full error to console for debugging
      console.error("Bridge transaction error details:", error);
      
      // Show short message in toast with action button to view full details
      toast.error(formatted.short, {
        duration: 5000,
        ...(formatted.hasMore && {
          action: {
            label: "View Details",
            onClick: () => {
              // Show full error in a new toast
              toast.error(formatted.full, {
                duration: 10000,
              });
            },
          },
        }),
      });
    }
  }, [error, formatErrorMessage]);

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

  // Note: Quote is automatically refetched by useReadContract when args change
  // No need for manual refetch on keystroke to avoid excessive RPC calls

  // Handle bridge
  const handleBridge = async () => {
    if (!isAmountValid || !isRecipientValid || !morTokenAddress || !quoteFee || !address) {
      if (!morTokenAddress) {
        toast.error(`MOR token contract not found on ${fromChain === "arbitrum" ? "Arbitrum One" : "Base"}. Please check your network connection.`, { duration: 8000 });
      }
      return;
    }

    // Check if user has enough ETH balance for LayerZero fee + gas
    if (ethBalance) {
      // LayerZero fee + estimated gas (roughly 0.0001 ETH for gas on Arbitrum)
      const estimatedGasCost = parseUnits("0.0001", 18); // Rough estimate for gas
      const totalRequired = quoteFee.nativeFee + estimatedGasCost;
      
      if (ethBalance.value < totalRequired) {
        const requiredEth = formatEther(totalRequired);
        const currentEth = formatEther(ethBalance.value);
        const networkName = fromChain === "arbitrum" ? "Arbitrum" : "Base";
        toast.error(
          `Insufficient ${networkName} ETH balance. You need at least ${parseFloat(requiredEth).toFixed(6)} ${networkName} ETH for LayerZero fees and gas, but you only have ${parseFloat(currentEth).toFixed(6)} ${networkName} ETH. Please add ${networkName} ETH to your wallet (not Ethereum mainnet ETH).`,
          { duration: 10000 }
        );
        return;
      }
    }

    try {
      const amountWei = parseUnits(bridgeAmount, 18);
      const recipientBytes32 = `0x000000000000000000000000${recipientAddress.replace("0x", "").toLowerCase()}` as `0x${string}`;

      const transactionArgs = [
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
        address,
      ] as const;

      // Let the wallet handle gas estimation - don't pre-estimate to avoid errors
      writeContract({
        address: morTokenAddress,
        abi: MOR20_ABI,
        functionName: "send",
        args: transactionArgs,
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
        <CardDescription className="flex items-center gap-2">
          {fromChain === "arbitrum" ? (
            <>
              <ArbitrumIcon size={16} className="text-gray-400" />
              <span>Arbitrum One</span>
            </>
          ) : (
            <>
              <BaseIcon size={16} className="text-gray-400" />
              <span>Base</span>
            </>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onSwitchDirection}
            className="h-8 w-8 p-0 hover:bg-gray-800 rounded-full"
            aria-label="Switch bridge direction"
          >
            <ArrowLeftRight className="h-4 w-4 text-gray-400" />
          </Button>
          {toChain === "base" ? (
            <>
              <BaseIcon size={16} className="text-gray-400" />
              <span className="border-b-2 border-emerald-500 pb-0.5">Base</span>
            </>
          ) : (
            <>
              <ArbitrumIcon size={16} className="text-gray-400" />
              <span className="border-b-2 border-emerald-500 pb-0.5">Arbitrum One</span>
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-1 px-6 pb-3">
        <div className="space-y-4">
          {/* Balance Display */}
          {address && (
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-black/50 rounded-lg">
                <div className="flex items-center gap-2">
                  {fromChain === "arbitrum" ? (
                    <ArbitrumIcon size={18} className="text-gray-400" />
                  ) : (
                    <BaseIcon size={18} className="text-gray-400" />
                  )}
                  <span className="text-sm text-gray-400">
                    MOR Balance on {fromChain === "arbitrum" ? "Arbitrum One" : "Base"}:
                  </span>
                </div>
                <span className="text-sm font-medium text-gray-200">
                  {balance >= 1 ? Math.floor(balance) : balance.toFixed(1)} MOR
                </span>
              </div>
              {ethBalance && (
                <div className="flex items-center justify-between p-3 bg-black/50 rounded-lg">
                  <span className="text-sm text-gray-400">
                    {fromChain === "arbitrum" ? "Arbitrum" : "Base"} ETH Balance (for fees):
                  </span>
                  <span className={`text-sm font-medium ${
                    ethBalance.value < (quoteFee?.nativeFee || BigInt(0)) + parseUnits("0.0001", 18)
                      ? "text-yellow-400"
                      : "text-gray-200"
                  }`}>
                    {parseFloat(formatEther(ethBalance.value)).toFixed(6)} {fromChain === "arbitrum" ? "ETH" : "ETH"}
                  </span>
                </div>
              )}
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
          {quoteError && bridgeAmount && parseFloat(bridgeAmount) > 0 && isRecipientValid && isCorrectNetwork && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="text-sm text-red-400">
                Failed to get bridge quote. Please check:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>You have sufficient MOR balance on {fromChain === "arbitrum" ? "Arbitrum One" : "Base"}</li>
                  <li>The recipient address is valid</li>
                  <li>Bridge direction is supported</li>
                </ul>
              </div>
            </div>
          )}
          {expectedOutput !== null && quoteFee && !isQuoteLoading && !quoteError && (
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
