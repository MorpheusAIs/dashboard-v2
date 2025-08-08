"use client";

import NumberFlow from '@number-flow/react';
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { useCapitalContext } from "@/context/CapitalPageContext";
import { TokenIcon } from '@web3icons/react';

interface Asset {
  symbol: string;
  apy: string;
  totalStaked: string;
  icon: string;
  disabled?: boolean;
}

export function CapitalInfoPanel() {
  const {
    userAddress,
    setActiveModal,
    // For now, we'll use placeholder data until we implement real data
    selectedAssetTotalStakedFormatted,
  } = useCapitalContext();

  // Helper function to safely parse totalStaked for NumberFlow
  const parseStakedAmount = (totalStaked: string): number => {
    try {
      if (!totalStaked || typeof totalStaked !== 'string') {
        return 0;
      }
      const cleanedValue = totalStaked.replace(/,/g, '');
      const parsed = parseFloat(cleanedValue);
      return isNaN(parsed) ? 0 : Math.floor(parsed);
    } catch (error) {
      console.error('Error parsing staked amount:', error);
      return 0;
    }
  };

  // Mock data for the assets table
  const assets: Asset[] = [
    {
      symbol: "stETH",
      apy: "8.65%",
      totalStaked: (selectedAssetTotalStakedFormatted && selectedAssetTotalStakedFormatted !== "---" && selectedAssetTotalStakedFormatted !== "Error") ? selectedAssetTotalStakedFormatted : "61,849",
      icon: "eth"
    },
    {
      symbol: "LINK",
      apy: "15.54%",
      totalStaked: "8,638",
      icon: "link"
    },
    {
      symbol: "wBTC",
      apy: "11.25%",
      totalStaked: "849",
      icon: "btc",
      disabled: true
    },
    {
      symbol: "USDC",
      apy: "10.67%",
      totalStaked: "15,267",
      icon: "usdc",
      disabled: true
    },
  ];

  const handleStakeClick = () => {
    // For now, all assets open the deposit modal
    // In the future, we might have different modals for different assets
    setActiveModal('deposit');
  };

  return (
    <div className="lg:col-span-1 relative">
      <GlowingEffect 
        spread={40}
        glow={true}
        disabled={false}
        proximity={64}
        inactiveZone={0.01}
        borderWidth={2}
        borderRadius="rounded-xl"
      /> 
      <div className="section-content group relative h-full">
        <div className="section-content-gradient group-hover:bg-gradient-to-bl group-hover:from-emerald-400/10 group-hover:to-transparent px-2" />
        <div className="p-2 md:p-3 flex flex-col h-full">
          {/* Title & Subtitle */} 
          <div className="mb-6"> 
            <h1 className="text-3xl font-bold text-white">Capital</h1>
            <p className="text-gray-400 text-sm mt-1">
              Stake one of the assets below to contribute to the Morpheus public liquidity pool. By staking you will help secure the future of decentralized personal AI and earn a share of MOR token rewards, emitted daily.
            </p>
          </div>

          {/* Assets Table */}
          <div className="flex-1 overflow-hidden">
            <div className="space-y-1">
              {/* Header */}
              <div className="grid grid-cols-4 gap-2 text-xs font-medium text-gray-400 px-2 py-1 border-b border-gray-800">
                <div>Asset</div>
                <div className="text-center">APY</div>
                <div className="text-center">Total Staked</div>
                <div className="text-center">Action</div>
              </div>

              {/* Asset Rows */}
              {assets.map((asset) => {
                const AssetRow = (
                  <div key={asset.symbol} className={`grid grid-cols-4 gap-2 items-center px-2 py-3 rounded-lg transition-colors ${
                    asset.disabled 
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'hover:bg-gray-800/30'
                  }`}>
                    {/* Asset Name & Symbol */}
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center">
                        <TokenIcon symbol={asset.icon} variant="background" size="24" />
                      </div>
                      <div>
                        <div className={`text-sm font-medium ${
                          asset.disabled ? 'text-gray-500' : 'text-white'
                        }`}>{asset.symbol}</div>
                      </div>
                    </div>

                    {/* APY */}
                    <div className={`text-center text-sm font-semibold ${
                      asset.disabled ? 'text-gray-500' : 'text-white'
                    }`}>
                      {asset.apy}
                    </div>

                    {/* Total Staked */}
                    <div className={`text-right text-sm font-semibold ${
                      asset.disabled ? 'text-gray-500' : 'text-white'
                    }`}>
                      <NumberFlow value={parseStakedAmount(asset.totalStaked)} />
                    </div>

                    {/* Stake Button */}
                    <div className="text-center">
                      <button
                        onClick={asset.disabled ? undefined : handleStakeClick}
                        className={`text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          asset.disabled 
                            ? 'text-gray-600 cursor-not-allowed' 
                            : 'text-emerald-400 hover:text-emerald-300'
                        }`}
                        disabled={!userAddress || asset.disabled}
                      >
                        {asset.disabled ? 'Soon' : 'Stake'}
                      </button>
                    </div>
                  </div>
                );

                // // Wrap disabled assets with tooltip
                // if (asset.disabled) {
                //   return (
                //     <Tooltip key={asset.symbol}>
                //       <TooltipTrigger asChild>
                //         {AssetRow}
                //       </TooltipTrigger>
                //       <TooltipContent className="bg-black text-white border-black rounded-lg">
                //         <p>Coming Soon</p>
                //       </TooltipContent>
                //     </Tooltip>
                //   );
                // }

                return AssetRow;
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 