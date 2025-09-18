"use client"

import { useState } from "react"
import { CowSwapWidget } from '@cowprotocol/widget-react'
import { CowSwapWidgetParams, TradeType, TokenInfo } from '@cowprotocol/widget-lib'
import { useWalletClient, useAccount } from 'wagmi'

const customTokens: TokenInfo[] = [
  {
    chainId: 1, // Ethereum
    address: '0xcbb8f1bda10b9696c57e13bc128fe674769dcec0',
    name: 'MorpheusAI',
    decimals: 18,
    symbol: 'MOR',
    logoURI: 'https://assets.coingecko.com/coins/images/37969/standard/MOR200X200.png?1716327119',
  },
  {
    chainId: 1, // Ethereum
    address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
    name: 'Lido Staked Ether',
    decimals: 18,
    symbol: 'stETH',
    logoURI: 'https://assets.coingecko.com/coins/images/13442/standard/steth_logo.png?1696513206',
  },
  {
    chainId: 42161, // Arbitrum
    address: '0x092baadb7def4c3981454dd9c0a0d7ff07bcfc86',
    name: 'MorpheusAI',
    decimals: 18,
    symbol: 'MOR',
    logoURI: 'https://assets.coingecko.com/coins/images/37969/standard/MOR200X200.png?1716327119',
  },
  {
    chainId: 8453, // Base
    address: '0x7431ada8a591c955a994a21710752ef9b882b8e3',
    name: 'MorpheusAI',
    decimals: 18,
    symbol: 'MOR',
    logoURI: 'https://assets.coingecko.com/coins/images/37969/standard/MOR200X200.png?1716327119',
  },
]

const params: CowSwapWidgetParams = {
  "appCode": "Morpheus Dashboard", // Name of your app (max 50 characters)
  "width": "100%", // Width in pixels (or 100% to use all available space)
  "height": "640px",
  "chainId": 1, // 1 (Mainnet), 100 (Gnosis), 11155111 (Sepolia)
  "tokenLists": [ // All default enabled token lists. Also see https://tokenlists.org
    "https://files.cow.fi/tokens/CoinGecko.json",
    "https://files.cow.fi/tokens/CowSwap.json"
  ],
  "tradeType": TradeType.SWAP, // TradeType.SWAP, TradeType.LIMIT or TradeType.ADVANCED
  "sell": { // Sell token. Optionally add amount for sell orders
    "asset": "USDC",
    "amount": "10000"
  },
  "buy": { // Buy token. Optionally add amount for buy orders
    "asset": "MOR",
    "amount": "0"
  },
  "enabledTradeTypes": [ // TradeType.SWAP, TradeType.LIMIT and/or TradeType.ADVANCED
    TradeType.SWAP,
    TradeType.LIMIT,
    TradeType.ADVANCED
  ],
  "theme": {
    "baseTheme": "dark",
    "primary": "#09ce9e",
    "background": "#0f0f0f", 
    "paper": "#1a1a1a",
    "text": "#defaeb",
    "danger": "#ff4444",
    "warning": "#ffaa00", 
    "alert": "#facc15",
    "info": "#6c757d",
    "success": "#09ce9e"
  },
  "standaloneMode": true,
  "disableToastMessages": false,
  "disableProgressBar": false,
  "hideBridgeInfo": false,
  "hideOrdersTable": false,
  "images": {},
  "sounds": {},
  "customTokens": customTokens
}

export function CowSwapModal() {
  const [isOpen, setIsOpen] = useState(false)
  const { data: walletClient } = useWalletClient()
  const { isConnected } = useAccount()

  // Get the EIP-1193 provider with better fallback logic
  const provider = (() => {
    // If no wallet is connected, use standalone mode
    if (!isConnected || !walletClient) {
      return undefined;
    }

    try {
      // Try to get provider from transport
      if (walletClient.transport && 'provider' in walletClient.transport) {
        return (walletClient.transport as unknown as { provider: unknown }).provider;
      }
      
      // Fallback to window.ethereum if available
      if (typeof window !== 'undefined' && (window as { ethereum?: unknown }).ethereum) {
        return (window as { ethereum?: unknown }).ethereum;
      }
    } catch (error) {
      console.warn('Failed to get provider from wallet client:', error);
    }

    return undefined;
  })();

  // Dynamic params based on provider availability
  const widgetParams = {
    ...params,
    standaloneMode: !provider // Use standalone mode if no provider available
  };

  return (
    <>
      <button 
        className="copy-button-base text-sm px-4 py-1 hover:shadow-lg hover:shadow-emerald-500/20 hover:scale-105 transition-all duration-300"
        onClick={() => setIsOpen(true)}
      >
        Buy MOR
      </button>
      
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Modal content - just the widget */}
          <div className="relative z-10 w-[450px] max-w-[90vw] max-h-[90vh] overflow-y-auto custom-scrollbar"> 
            <CowSwapWidget params={widgetParams} provider={provider} />
          </div>
        </div>
      )}
    </>
  )
} 