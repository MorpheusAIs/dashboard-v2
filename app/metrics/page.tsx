"use client";

import { Suspense, useEffect, useState } from "react";
import DebugGraphQL from "@/components/metrics/DebugGraphQL";
import { LiquidityPoolsChart } from "@/components/metrics/LiquidityPoolsChart";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

export default function MetricsPage() {
  const [ethError, setEthError] = useState<boolean>(false);
  
  // Check for Ethereum provider and handle errors
  useEffect(() => {
    // Safely suppress Ethereum provider errors
    const originalConsoleError = console.error;
    console.error = (...args) => {
      const errorMessage = args.join(' ');
      
      // Suppress these specific Ethereum-related errors
      const suppressPatterns = [
        'Cannot redefine property: ethereum',
        'Cannot set property ethereum',
        'Cannot read properties of undefined (reading \'id\')',
        'ethereum.js',
        'evmAsk.js',
        'inpage.js'
      ];
      
      if (suppressPatterns.some(pattern => errorMessage.includes(pattern))) {
        // Log a sanitized warning instead of the full error
        console.warn("Suppressed Ethereum-related error. Some wallet features may be limited.");
        setEthError(true);
        return;
      }
      
      // For other errors, log normally
      originalConsoleError(...args);
    };
    
    const checkEthereumProvider = () => {
      if (typeof window !== 'undefined') {
        // Wait a bit for ethereum to be injected
        setTimeout(() => {
          try {
            if (!window.ethereum) {
              console.warn("No Ethereum provider detected. Some features may not work correctly.");
              setEthError(true);
            } else {
              console.log("Ethereum provider detected:", window.ethereum);
            }
          } catch (error) {
            console.error("Error checking for Ethereum provider:", error);
            setEthError(true);
          }
        }, 500);
      }
    };
    
    checkEthereumProvider();
    
    // Handle ethereum errors
    const handleErrorEvent = (error: ErrorEvent) => {
      if (error.message && (
        error.message.includes('ethereum') || 
        error.message.includes('web3') || 
        error.message.includes('Cannot read properties of undefined')
      )) {
        console.warn("Ethereum-related error detected:", error.message);
        setEthError(true);
        // Prevent the error from propagating further
        error.preventDefault();
        return true;
      }
      return false;
    };
    
    window.addEventListener('error', handleErrorEvent);
    
    return () => {
      // Restore original console behavior
      console.error = originalConsoleError;
      window.removeEventListener('error', handleErrorEvent);
    };
  }, []);
  
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Metrics</h1>
      
      {ethError && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Web3 Provider Warning</AlertTitle>
          <AlertDescription>
            Some browser errors were detected related to Ethereum connectivity. This may affect some features.
            Please make sure your wallet is connected properly or try disabling conflicting wallet extensions.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Debug tools */}
      <div className="mb-8 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Troubleshooting Tools</h2>
        <DebugGraphQL />
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Suspense fallback={<div className="h-64 bg-card animate-pulse rounded-lg" />}>
            <LiquidityPoolsChart data={{poolsToken0: [], poolsToken1: []}} />
          </Suspense>
        </div>
        
        {/* Additional metrics could be added here */}
      </div>
    </div>
  );
} 