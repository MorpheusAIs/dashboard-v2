"use client";

import NumberFlow from '@number-flow/react';
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { useCapitalContext } from "@/context/CapitalPageContext";
import { useCapitalPoolData } from "@/hooks/use-capital-pool-data";
import { TokenIcon } from '@web3icons/react';
import { Skeleton } from "@/components/ui/skeleton";

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
  } = useCapitalContext();

  // Get live contract data
  const poolData = useCapitalPoolData();

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
      console.error('Error parsing deposited amount:', error);
      return 0;
    }
  };

  // Dynamic assets data based on network environment
  const assets: Asset[] = [
    {
      symbol: "stETH",
      apy: poolData.stETH.apy,
      totalStaked: poolData.stETH.totalStaked,
      icon: "eth"
    },
    {
      symbol: "LINK",
      apy: poolData.LINK.apy,
      totalStaked: poolData.LINK.totalStaked,
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
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-white">Capital</h1>
              {poolData.networkEnvironment === 'testnet' && (
                <span className="px-2 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-emerald-400 text-xs font-medium">
                  Live Data
                </span>
              )}
              {poolData.networkEnvironment === 'mainnet' && (
                <span className="px-2 py-1 bg-orange-500/20 border border-orange-500/30 rounded-full text-orange-400 text-xs font-medium">
                  Preview
                </span>
              )}
            </div>
            <p className="text-gray-400 text-sm mt-1">
              Deposit one of the assets below to contribute to the Morpheus public liquidity pool. By staking you will help secure the future of decentralized personal AI and earn a share of MOR token rewards, emitted daily.
            </p>
          </div>

          {/* Assets Table */}
          <div className="flex-1 overflow-hidden">
            <div className="space-y-1">
              {/* Header */}
              <div className="grid grid-cols-4 gap-2 text-xs font-medium text-gray-400 px-2 py-1 border-b border-gray-800">
                <div>Asset</div>
                <div className="text-center">APY</div>
                <div className="text-center">Total Deposited</div>
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
                      {(asset.symbol === 'stETH' && poolData.stETH.isLoading) || 
                       (asset.symbol === 'LINK' && poolData.LINK.isLoading) ? (
                        <Skeleton className="h-4 w-12 bg-gray-700" />
                      ) : poolData.networkEnvironment === 'testnet' && 
                          ((asset.symbol === 'stETH' && poolData.stETH.error) || 
                           (asset.symbol === 'LINK' && poolData.LINK.error)) ? (
                        <span className="text-red-400 text-xs">Error</span>
                      ) : (
                        <NumberFlow value={parseStakedAmount(asset.totalStaked)} />
                      )}
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
                        {asset.disabled ? 'Soon' : 'Deposit'}
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