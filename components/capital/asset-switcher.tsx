"use client";

import { getAvailableAssets, type TokenType } from "../../mock-data";

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

  if (availableAssets.length === 0) {
    return (
      <div className="flex items-center space-x-1">
        <div className="text-xs px-2 py-1 text-gray-500 rounded border border-gray-700">
          No pools with deposits
        </div>
      </div>
    );
  }

  // Define colors directly to avoid Tailwind CSS issues
  const getButtonStyle = (token: TokenType, isSelected: boolean) => {
    const colorMap = {
      stETH: { color: '#34d399', borderColor: '#34d399' }, // emerald-400
      LINK: { color: '#60a5fa', borderColor: '#60a5fa' }, // blue-400
      wETH: { color: '#a78bfa', borderColor: '#a78bfa' }, // purple-400
      USDC: { color: '#22d3ee', borderColor: '#22d3ee' }, // cyan-400
      USDT: { color: '#4ade80', borderColor: '#4ade80' }, // green-400
      wBTC: { color: '#fb923c', borderColor: '#fb923c' }, // orange-400
    };

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
    <div className="flex items-center space-x-1">
      {availableAssets.map(({ token }) => {
        const isSelected = selectedAsset === token;
        const buttonStyle = getButtonStyle(token, isSelected);
        
        return (
          <button
            key={token}
            onClick={() => onAssetChangeAction(token)}
            className="text-xs px-2 py-1 h-auto rounded border transition-all duration-200"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#000000';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#000000';
            }}
            style={buttonStyle}
            aria-label={`Switch to ${token} deposits`}
          >
            {token}
          </button>
        );
      })}
    </div>
  );
}
