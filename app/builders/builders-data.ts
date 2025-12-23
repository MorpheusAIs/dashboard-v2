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

/**
 * Helper function to detect if a builder subnet is V4 (has on-chain metadata)
 * V4 subnets will have slug field populated OR metadata fields come from on-chain
 * V1 subnets will have metadata from Supabase and no slug field
 */
export function isV4Builder(builder: Builder): boolean {
  // V4 indicator 1: has slug field populated
  if (builder.slug) {
    return true;
  }
  
  // V4 indicator 2: builder.id is a hex address (bytes32) not a UUID
  // UUIDs are in format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  // Hex addresses are in format: 0x...
  if (builder.id && builder.id.startsWith('0x') && builder.id.length === 66) {
    return true;
  }
  
  // V4 indicator 3: mainnetProjectId is a hex address (for mainnet V4 subnets)
  if (builder.mainnetProjectId && builder.mainnetProjectId.startsWith('0x') && builder.mainnetProjectId.length === 66) {
    return true;
  }
  
  // V1 subnets have UUIDs as their id (from Supabase)
  // UUID pattern: 8-4-4-4-12 hex digits separated by hyphens
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (builder.id && uuidPattern.test(builder.id)) {
    return false; // This is definitely V1 (Supabase UUID)
  }
  
  // Default: if we can't determine, assume V1 for safety
  return false;
} 