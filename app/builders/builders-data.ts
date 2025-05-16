import { BuilderDB } from '../lib/supabase';
import { BuilderUser } from '@/lib/types/graphql';

export interface Builder extends BuilderDB {
  totalStaked: number;
  minimalDeposit?: string;
  withdrawLockPeriodAfterDeposit?: string;
  withdrawLockPeriodRaw?: number;
  stakingCount?: number;
  userStake?: number;
  image?: string;
  lockPeriod?: string;
  minDeposit: number;
  network: string;
  networks: string[];
  startsAt?: string;
  mainnetProjectId?: string | null;
  builderUsers?: BuilderUser[];
}

// This will be populated by the component using BuildersService
export const builders: Builder[] = [];

// Helper function to merge on-chain data with builder metadata
export const mergeBuilderData = (
  builderDB: BuilderDB,
  onChainData: {
    id?: string;
    totalStaked?: number;
    minimalDeposit?: number;
    withdrawLockPeriodAfterDeposit?: number;
    withdrawLockPeriodRaw?: number;
    stakingCount?: number;
    userStake?: number;
    lockPeriod?: string;
    network?: string;
    networks?: string[];
    admin?: string | null;
    image?: string;
    website?: string;
    startsAt?: string;
  }
): Builder => {
  let finalAdmin: string | null;

  if (typeof onChainData.admin === 'string') {
    finalAdmin = onChainData.admin;
  } else {
    finalAdmin = builderDB.admin;
  }

  return {
    ...builderDB,
    mainnetProjectId: onChainData.id || null,
    totalStaked: onChainData.totalStaked || 0,
    minimalDeposit: onChainData.minimalDeposit?.toString(),
    minDeposit: onChainData.minimalDeposit || 0,
    withdrawLockPeriodAfterDeposit: onChainData.withdrawLockPeriodAfterDeposit?.toString(),
    withdrawLockPeriodRaw: onChainData.withdrawLockPeriodRaw,
    stakingCount: onChainData.stakingCount,
    userStake: onChainData.userStake,
    lockPeriod: onChainData.lockPeriod || '',
    network: onChainData.network || '',
    networks: onChainData.networks || builderDB.networks || [],
    admin: finalAdmin,
    image: typeof onChainData.image === 'string' ? onChainData.image : (builderDB.image_src || undefined),
    image_src: builderDB.image_src,
    website: typeof onChainData.website === 'string' ? onChainData.website : builderDB.website,
    startsAt: onChainData.startsAt,
  };
}; 