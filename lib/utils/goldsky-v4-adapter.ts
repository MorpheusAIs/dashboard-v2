/**
 * Adapter for Goldsky V4 subgraph responses
 * V4 uses standard mainnet schema (buildersProjects, buildersUsers)
 * No field name transformations needed - handles formatting only
 */

import { Builder } from '@/app/builders/builders-data';
import { formatTimePeriod } from '@/app/utils/time-utils';

/**
 * V4 BuildersProject from Goldsky
 */
export interface V4BuildersProject {
  id: string;
  name: string;
  admin: string;
  minimalDeposit: string;
  totalStaked: string;
  totalUsers: string;
  totalClaimed: string;
  startsAt: string;
  withdrawLockPeriodAfterDeposit: string;
  claimLockEnd: string;
}

/**
 * V4 BuildersUser from Goldsky
 * Note: Does NOT have 'claimed' or 'claimLockEnd' fields
 */
export interface V4BuildersUser {
  id: string;
  address: string;
  staked: string;
  lastStake: string;
  buildersProject?: V4BuildersProject;
}

/**
 * V4 Response structure from Goldsky
 */
export interface V4BuildersResponse {
  buildersProjects: V4BuildersProject[];
}

export interface V4BuildersUsersResponse {
  buildersUsers: V4BuildersUser[];
}

/**
 * Chain ID constants
 */
export const CHAIN_IDS = {
  Base: 8453,
  Arbitrum: 42161,
  BaseSepolia: 84532,
  ArbitrumSepolia: 421614,
} as const;

/**
 * Network names
 */
export const NETWORK_NAMES = {
  [CHAIN_IDS.Base]: 'Base',
  [CHAIN_IDS.Arbitrum]: 'Arbitrum',
  [CHAIN_IDS.BaseSepolia]: 'Base Sepolia',
  [CHAIN_IDS.ArbitrumSepolia]: 'Arbitrum Sepolia',
} as const;

/**
 * Transform V4 BuildersProject to internal Builder type
 */
export function transformV4ProjectToBuilder(
  project: V4BuildersProject,
  network: string,
  supabaseMetadata?: Partial<Builder>
): Builder {
  const totalStakedInMor = Number(project.totalStaked || '0') / 1e18;
  const totalClaimedInMor = Number(project.totalClaimed || '0') / 1e18;
  const minDepositInMor = Number(project.minimalDeposit || '0') / 1e18;
  const lockPeriodSeconds = parseInt(project.withdrawLockPeriodAfterDeposit || '0', 10);
  const lockPeriodFormatted = formatTimePeriod(lockPeriodSeconds);
  const stakingCount = parseInt(project.totalUsers || '0', 10);

  return {
    id: project.id,
    mainnetProjectId: project.id,
    name: project.name,
    description: supabaseMetadata?.description || '',
    long_description: supabaseMetadata?.long_description || '',
    admin: project.admin,
    networks: [network],
    network: network,
    totalStaked: totalStakedInMor,
    totalClaimed: totalClaimedInMor,
    minDeposit: minDepositInMor,
    lockPeriod: lockPeriodFormatted,
    withdrawLockPeriodRaw: lockPeriodSeconds,
    withdrawLockPeriodAfterDeposit: lockPeriodSeconds.toString(),
    stakingCount: stakingCount,
    website: supabaseMetadata?.website || '',
    image_src: supabaseMetadata?.image_src || '',
    image: supabaseMetadata?.image || '',
    tags: supabaseMetadata?.tags || [],
    github_url: supabaseMetadata?.github_url || '',
    twitter_url: supabaseMetadata?.twitter_url || '',
    discord_url: supabaseMetadata?.discord_url || '',
    contributors: supabaseMetadata?.contributors || 0,
    github_stars: supabaseMetadata?.github_stars || 0,
    reward_types: supabaseMetadata?.reward_types || [],
    reward_types_detail: supabaseMetadata?.reward_types_detail || [],
    created_at: supabaseMetadata?.created_at || new Date().toISOString(),
    updated_at: supabaseMetadata?.updated_at || new Date().toISOString(),
    startsAt: project.startsAt || '',
  };
}

/**
 * Transform V4 BuildersUser to user stake data
 */
export function transformV4UserToStakeData(
  user: V4BuildersUser,
  network: string
) {
  const userStakedAmount = parseFloat((Number(user.staked || '0') / 1e18).toFixed(6));
  
  return {
    address: user.address,
    staked: user.staked,
    userStake: userStakedAmount,
    lastStake: user.lastStake,
    project: user.buildersProject ? {
      id: user.buildersProject.id,
      name: user.buildersProject.name,
      admin: user.buildersProject.admin,
      totalStaked: user.buildersProject.totalStaked,
      totalUsers: user.buildersProject.totalUsers,
      network: network,
    } : undefined,
  };
}

/**
 * Format wei amount to MOR tokens
 */
export function formatMorAmount(weiAmount: string | bigint): number {
  try {
    const amount = Number(weiAmount) / 1e18;
    return amount < 1 ? parseFloat(amount.toFixed(6)) : Math.round(amount);
  } catch {
    return 0;
  }
}

/**
 * Format timestamp to human-readable date
 */
export function formatTimestamp(timestamp: string | number): string {
  try {
    const ts = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp;
    return new Date(ts * 1000).toLocaleDateString();
  } catch {
    return 'Unknown';
  }
}

/**
 * Calculate claim lock end time from lastStake and lock period
 * V4 schema doesn't provide claimLockEnd on BuildersUser, so we calculate it
 */
export function calculateClaimLockEnd(
  lastStake: string | number,
  withdrawLockPeriod: number
): number {
  try {
    const lastStakeTs = typeof lastStake === 'string' ? parseInt(lastStake) : lastStake;
    return lastStakeTs + withdrawLockPeriod;
  } catch {
    return 0;
  }
}

/**
 * Check if project is a V4 project (has metadata fields)
 */
export function isV4Project(project: Partial<V4BuildersProject>): boolean {
  // V4 projects have startsAt and claimLockEnd fields
  return !!(project.startsAt || project.claimLockEnd);
}


