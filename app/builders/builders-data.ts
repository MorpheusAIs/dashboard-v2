import { BuilderDB } from '../lib/supabase';

export interface Builder extends BuilderDB {
  totalStaked: number;
  totalClaimed?: number;
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
  builderUsers?: BuilderUser[];
  mainnetProjectId: string | null;
  admin: string | null;
  slug?: string; // V4-only field
}

export interface BuilderUser {
  id: string;
  address: string;
  staked: string;
  claimed: string;
  claimLockEnd: string;
  lastStake: string;
}

// This will be populated by the component using BuildersService
export const builders: Builder[] = [];

// Helper function to merge on-chain data with builder metadata
export const mergeBuilderData = (
  builderDB: BuilderDB,
  onChainData: {
    id?: string;
    totalStaked?: number;
    totalClaimed?: number;
    minimalDeposit?: number;
    withdrawLockPeriodAfterDeposit?: number;
    withdrawLockPeriodRaw?: number;
    stakingCount?: number;
    userStake?: number;
    lockPeriod?: string;
    network?: string;
    networks?: string[];
    admin?: string | undefined;
    image?: string;
    website?: string;
    description?: string;
    startsAt?: string;
  }
): Builder => {

  // Admin data only comes from on-chain data since BuilderDB doesn't have this field
  const finalAdmin: string | null = (typeof onChainData.admin === 'string') ? onChainData.admin : null;

  const mergedBuilder = {
    ...builderDB,
    mainnetProjectId: onChainData.id || null,
    totalStaked: onChainData.totalStaked || 0,
    totalClaimed: onChainData.totalClaimed || 0,
    minDeposit: onChainData.minimalDeposit || 0,
    minimalDeposit: onChainData.minimalDeposit?.toString(),
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
    description: typeof onChainData.description === 'string' ? onChainData.description : builderDB.description,
    startsAt: onChainData.startsAt,
  };


  return mergedBuilder;
}; 