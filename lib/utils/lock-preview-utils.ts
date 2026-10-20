/**
 * Helpers for the capital lock-multiplier preview.
 *
 * Mirrors DepositPool v7 behaviour:
 * - totalMultiplier = LockMultiplierMath.getLockPeriodMultiplier(start, end)
 *                     + ReferrerLib.getReferralMultiplier(referrer) - PRECISION
 * - claim is allowed after claimLockEnd, lastStake + claimLockPeriodAfterStake
 *   and lastClaim + claimLockPeriodAfterClaim
 * - withdraw is allowed after lastStake + withdrawLockPeriodAfterStake
 */

// Multipliers are fixed-point with 25 decimals (PRECISION = 10^25)
export const MULTIPLIER_PRECISION = BigInt(10) ** BigInt(25);

// ReferrerLib.REFERRAL_MULTIPLIER = PRECISION * 101 / 100 when a referrer is set.
// It is an internal library constant, so it cannot be read on-chain.
export const REFERRAL_MULTIPLIER_BONUS = (MULTIPLIER_PRECISION * BigInt(101)) / BigInt(100) - MULTIPLIER_PRECISION;

export const SECONDS_PER_DAY = 86400;

export const LOCK_PREVIEW_PRESETS = [
  { label: "0d", days: 0 },
  { label: "6m", days: 182 },
  { label: "1y", days: 365 },
  { label: "2y", days: 730 },
  { label: "3y", days: 1095 },
  { label: "5y", days: 1825 },
] as const;

export function multiplierToNumber(raw: bigint): number {
  return Number((raw * BigInt(10000)) / MULTIPLIER_PRECISION) / 10000;
}

export function formatMultiplier(raw: bigint | undefined): string {
  if (raw === undefined) return "—";
  return `${multiplierToNumber(raw).toFixed(2)}×`;
}

export function getTotalMultiplier(lockMultiplier: bigint, hasReferrer: boolean): bigint {
  return hasReferrer ? lockMultiplier + REFERRAL_MULTIPLIER_BONUS : lockMultiplier;
}

export interface LockPeriods {
  withdrawLockPeriodAfterStake: bigint;
  claimLockPeriodAfterStake: bigint;
  claimLockPeriodAfterClaim: bigint;
}

export interface PositionTimestamps {
  lastStake: bigint;
  lastClaim: bigint;
}

/** Earliest timestamp claim() succeeds, given a claim lock end and the user's last stake/claim. */
export function getClaimableFrom(claimLockEnd: bigint, position: PositionTimestamps, periods: LockPeriods): bigint {
  const candidates = [
    claimLockEnd,
    position.lastStake + periods.claimLockPeriodAfterStake,
    position.lastClaim + periods.claimLockPeriodAfterClaim,
  ];
  return candidates.reduce((max, value) => (value > max ? value : max));
}

/** Earliest timestamp withdraw() succeeds after the user's last stake. */
export function getWithdrawableFrom(lastStake: bigint, periods: LockPeriods): bigint {
  return lastStake + periods.withdrawLockPeriodAfterStake;
}

export function formatPreviewDate(timestamp: bigint | number | undefined): string {
  if (timestamp === undefined) return "—";
  return new Date(Number(timestamp) * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
