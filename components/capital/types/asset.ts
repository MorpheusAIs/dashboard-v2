export interface Asset {
  symbol: string;
  apr: string; // Renamed from 'apy' - we calculate APR (no compounding), not APY
  totalStaked: string;
  icon: string;
  disabled?: boolean;
}
