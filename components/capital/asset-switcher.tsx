"use client";

import { getAvailableAssets, type TokenType } from "@/mock-data";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface AssetSwitcherProps {
  selectedAsset: TokenType;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  onAssetChangeAction: (asset: TokenType) => void;
  availableAssets?: Array<{ token: TokenType; deposits: number; }>;
}

export function AssetSwitcher({
  selectedAsset,
  onAssetChangeAction,
  availableAssets: propAvailableAssets
}: AssetSwitcherProps) {
  // Use provided available assets or fallback to mock data function
  const availableAssets = propAvailableAssets || getAvailableAssets();
  
  // Temporary flag to disable non-stETH assets
  const ENABLE_ALL_ASSETS = false; // Set to true to enable all assets

  // if (availableAssets.length === 0) {
  //   return (
  //     <div className="flex items-center space-x-1">
  //       <div className="text-xs px-2 py-1 text-gray-500 rounded border border-gray-700">
  //         No pools with deposits
  //       </div>
  //     </div>
  //   );
  // }

  // Define colors directly to avoid Tailwind CSS issues
  const getButtonStyle = (token: TokenType, isSelected: boolean, isDisabled: boolean) => {
    const colorMap = {
      stETH: { color: '#34d399', borderColor: '#34d399' }, // emerald-400
      LINK: { color: '#60a5fa', borderColor: '#60a5fa' }, // blue-400
      wETH: { color: '#a78bfa', borderColor: '#a78bfa' }, // purple-400
      USDC: { color: '#22d3ee', borderColor: '#22d3ee' }, // cyan-400
      USDT: { color: '#4ade80', borderColor: '#4ade80' }, // green-400
      wBTC: { color: '#fb923c', borderColor: '#fb923c' }, // orange-400
    };

    if (isDisabled) {
      return {
        backgroundColor: '#000000', // black
        color: '#6b7280', // gray-500 (more muted for disabled)
        borderColor: '#374151', // gray-700 (darker border for disabled)
        cursor: 'not-allowed',
        opacity: 0.6,
      };
    }

    if (!isSelected) {
      return {
        backgroundColor: '#000000', // black
        color: '#9ca3af', // gray-400
        borderColor: `${colorMap[token].borderColor}33`, // 20% opacity (hex: 33)
      };
    }

    return {
      backgroundColor: '#000000', // black
      color: colorMap[token].color,
      borderColor: colorMap[token].borderColor, // full opacity
    };
  };

  return (
    <TooltipProvider>
      <div className="flex items-center space-x-1">
        {availableAssets.map(({ token }) => {
          const isSelected = selectedAsset === token;
          const isDisabled = !ENABLE_ALL_ASSETS && token !== 'stETH';
          const buttonStyle = getButtonStyle(token, isSelected, isDisabled);
          
          const ButtonComponent = (
            <button
              key={token}
              onClick={() => {
                if (!isDisabled) {
                  onAssetChangeAction(token);
                }
              }}
              disabled={isDisabled}
              className="text-xs px-2 py-1 h-auto rounded border transition-all duration-200"
              onMouseEnter={(e) => {
                if (!isDisabled) {
                  e.currentTarget.style.backgroundColor = '#000000';
                }
              }}
              onMouseLeave={(e) => {
                if (!isDisabled) {
                  e.currentTarget.style.backgroundColor = '#000000';
                }
              }}
              style={buttonStyle}
              aria-label={`Switch to ${token} deposits`}
            >
              {token}
            </button>
          );

          // Wrap disabled buttons with tooltip
          if (isDisabled) {
            return (
              <Tooltip key={token}>
                <TooltipTrigger asChild>
                  {ButtonComponent}
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  avoidCollisions={false}
                  className="bg-black/90 text-white border-emerald-500/20 z-50 rounded-xl"
                >
                  <p className="text-sm font-medium">
                    Coming soon
                  </p>
                </TooltipContent>
              </Tooltip>
            );
          }

          return ButtonComponent;
        })}
      </div>
    </TooltipProvider>
  );
}
