import type { AssetSymbol } from "@/context/CapitalPageContext";

export interface UserAsset {
  id: string;
  symbol: string;
  assetSymbol: AssetSymbol; // Add the actual asset symbol for context
  icon: string;
  amountStaked: number;
  available: number;
  dailyEmissions: number;
  apr: string;
  powerFactor: string;
  unlockDate: string | null;
  unlockDateTooltip: string | null;
  withdrawUnlockDate: string | null;
  withdrawUnlockDateTooltip: string | null;
  availableToClaim: number;
  canClaim: boolean;
  canWithdraw: boolean;
}

// Interface for tracking reward accumulation over time
export interface RewardSnapshot {
  timestamp: number;
  reward: bigint;
}
