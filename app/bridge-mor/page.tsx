'use client'

import { LiFiWidgetComponent } from '@/components/lifi'

export default function BridgeMorPage() {
  return (
    <div className="page-container">
      <div className="space-y-8 py-8">
        {/* Header Section */}
        <div className="space-y-4 text-center max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold text-white">
            Bridge MOR
          </h1>
          <p className="text-lg text-gray-300">
            Swap tokens for MOR or bridge MOR across multiple networks including Ethereum, Arbitrum,
            and Base. Powered by LI.FI for the best rates and seamless cross-chain experience.
          </p>
        </div>

        {/* Widget Container */}
        <div className="w-full max-w-4xl mx-auto min-h-[686px]">
          <LiFiWidgetComponent />
        </div>

        {/* Token Addresses Reference */}
        <div className="space-y-2 text-center max-w-2xl mx-auto pt-4">
          <p className="text-sm text-gray-400">
            MOR Token Addresses:
          </p>
          <div className="space-y-1 text-xs text-gray-500">
            <p>
              Ethereum: <span className="font-mono">0xcbb8f1bda10b9696c57e13bc128fe674769dcec0</span>
            </p>
            <p>
              Arbitrum: <span className="font-mono">0x092baadb7def4c3981454dd9c0a0d7ff07bcfc86</span>
            </p>
            <p>
              Base: <span className="font-mono">0x7431ada8a591c955a994a21710752ef9b882b8e3</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

