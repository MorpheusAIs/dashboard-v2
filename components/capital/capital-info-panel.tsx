"use client";

import NumberFlow from '@number-flow/react';
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { useCapitalContext } from "@/context/CapitalPageContext";
import { useCapitalPoolData } from "@/hooks/use-capital-pool-data";
import { TokenIcon } from '@web3icons/react';
import { Skeleton } from "@/components/ui/skeleton";
import type { Asset } from "./types/asset";
import { parseStakedAmount } from "./utils/parse-staked-amount";
import type { AssetSymbol } from "@/context/CapitalPageContext";
import { getAssetsForNetwork, type NetworkEnvironment } from "./constants/asset-config";
import { getContractAddress } from "@/config/networks";

export function CapitalInfoPanel() {
  const {
    userAddress,
    setActiveModal,
    setSelectedAsset,
  } = useCapitalContext();

  // Get live contract data
  const poolData = useCapitalPoolData();



  // Get network environment from pool data
  const networkEnvironment: NetworkEnvironment = poolData.networkEnvironment as NetworkEnvironment;
  
  // Dynamic assets data based on network environment and centralized config
  const configuredAssets = getAssetsForNetwork(networkEnvironment);
  
  const assets: Asset[] = configuredAssets.map(assetConfig => {
    const { symbol } = assetConfig.metadata;
    
    // Get data from the dynamic hook
    const assetData = poolData.assets[symbol];
    
    // Check if this asset has a deposit pool configured in networks.ts
    // Use the same mapping logic as use-capital-pool-data.ts
    const depositPoolMapping: Partial<Record<AssetSymbol, keyof import('@/config/networks').ContractAddresses>> = {
      stETH: 'stETHDepositPool',
      LINK: 'linkDepositPool', 
      USDC: 'usdcDepositPool',
      USDT: 'usdtDepositPool',
      wBTC: 'wbtcDepositPool',
      wETH: 'wethDepositPool',
    };
    
    const contractKey = depositPoolMapping[symbol];
    const l1ChainId = networkEnvironment === 'mainnet' ? 1 : 11155111; // mainnet : sepolia
    const hasDepositPool = contractKey && getContractAddress(l1ChainId, contractKey, networkEnvironment);
    
    return {
      symbol: assetConfig.metadata.symbol,
      apy: assetData?.apy || (hasDepositPool ? 'N/A' : 'Coming Soon'),
      totalStaked: assetData?.totalStaked || (hasDepositPool ? '0' : 'N/A'),
      icon: assetConfig.metadata.icon,
      disabled: assetConfig.metadata.disabled || (!hasDepositPool),
    };
  });

  const handleStakeClick = (assetSymbol: AssetSymbol) => {
    // Set the selected asset in the context before opening the modal
    setSelectedAsset(assetSymbol);
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
      <div className="section-content group relative h-full px-1 py-4 sm:p-6">
        <div className="section-content-gradient group-hover:bg-gradient-to-bl group-hover:from-emerald-400/10 group-hover:to-transparent px-2" />
        <div className="p-2 md:p-3 flex flex-col h-full">
          {/* Title & Subtitle */} 
          <div className="mb-6"> 
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-white">Capital</h1>
              {poolData.networkEnvironment === 'testnet' && (
                <div className="flex gap-2">
                  <span className="px-2 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-emerald-400 text-xs font-medium">
                    Live Data
                  </span>
                  {Object.values(poolData.assets).some(asset => asset.apy === 'N/A') ? (
                    <span className="px-2 py-1 bg-red-500/20 border border-red-500/30 rounded-full text-red-400 text-xs font-medium">
                      Contract Debug
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full text-blue-400 text-xs font-medium">
                      Accelerated Rewards
                    </span>
                  )}
                </div>
              )}
            </div>
            <p className="text-gray-400 text-sm mt-1">
            Deposit one of the assets below to generate yield for the Morpheus protocol and earn daily MOR rewards in return
            </p>
          </div>

          {/* Assets Table */}
          <div className="flex-1 flex flex-col">
            {/* Fixed Header */}
            <div className="grid grid-cols-4 gap-2 text-xs font-medium text-gray-400 px-2 py-1 border-b border-gray-800 bg-black-900/90 backdrop-blur-sm sticky top-0 z-10">
              <div>Asset</div>
              <div className="text-center">APR</div>
              <div className="text-center">Total Deposited</div>
              <div className="text-center">Action</div>
            </div>
            
            {/* Scrollable Asset Rows */}
            <div className="relative flex-1 max-h-[240px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
              <div className="space-y-1 py-1">
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
                      <div className="w-6 h-6 flex items-center justify-center">
                        <TokenIcon symbol={asset.icon} className='rounded-lg' variant="background" size="24" />
                      </div>
                      <div>
                        <div className={`text-sm font-medium ${
                          asset.disabled ? 'text-gray-500' : 'text-white'
                        }`}>{asset.symbol}</div>
                      </div>
                    </div>

                    {/* APY */}
                    <div className={`text-center text-sm font-semibold truncate ${
                      asset.disabled ? 'text-gray-500' : 'text-white'
                    }`}>
                      {asset.apy}
                    </div>

                    {/* Total Staked */}
                    <div className={`text-right text-sm font-semibold ${
                      asset.disabled ? 'text-gray-500' : 'text-white'
                    }`}>
                      {(() => {
                        const assetPoolData = poolData.assets[asset.symbol as AssetSymbol];
                        if (assetPoolData?.isLoading) {
                          return <Skeleton className="h-4 w-12 bg-gray-700" />;
                        }
                        if (assetPoolData?.error) {
                          return <span className="text-red-400 text-xs">Error</span>;
                        }
                        if (asset.totalStaked === 'N/A') {
                          return 'N/A';
                        }
                        return <NumberFlow value={parseStakedAmount(asset.totalStaked)} />;
                      })()}
                    </div>

                    {/* Stake Button */}
                    <div className="text-center">
                      <button
                        onClick={asset.disabled ? undefined : () => handleStakeClick(asset.symbol as AssetSymbol)}
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

                return AssetRow;
              })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 