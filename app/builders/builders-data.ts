import { BuilderDB } from '../lib/supabase';
import { BuilderWithOnChainData, BuildersService } from '../services/builders.service';

export interface Builder extends BuilderDB {
  totalStaked: number;
  minimalDeposit?: string;
  withdrawLockPeriodAfterDeposit?: string;
  stakingCount?: number;
  userStake?: number;
  image?: string;
  lockPeriod?: string;
  minDeposit: number;
  network: string;
  networks: string[];
}

// This will be populated by the component using BuildersService
export const builders: Builder[] = [];

// Helper function to merge on-chain data with builder metadata
export const mergeBuilderData = (
  builderDB: BuilderDB,
  onChainData: {
    totalStaked?: number;
    minimalDeposit?: number;
    withdrawLockPeriodAfterDeposit?: number;
    stakingCount?: number;
    userStake?: number;
    lockPeriod?: string;
    network?: string;
    networks?: string[];
  }
): Builder => {
  return {
    ...builderDB,
    totalStaked: onChainData.totalStaked || 0,
    minimalDeposit: onChainData.minimalDeposit?.toString(),
    minDeposit: onChainData.minimalDeposit || 0,
    withdrawLockPeriodAfterDeposit: onChainData.withdrawLockPeriodAfterDeposit?.toString(),
    stakingCount: onChainData.stakingCount,
    userStake: onChainData.userStake,
    lockPeriod: onChainData.lockPeriod || '',
    network: onChainData.network || builderDB.network,
    networks: onChainData.networks || builderDB.networks
  };
}; 