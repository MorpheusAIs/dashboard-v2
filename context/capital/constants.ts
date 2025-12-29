/**
 * Constants for the Capital Page Context
 * Centralized magic numbers and configuration values
 */

import { parseEther } from "viem";

// Pool identifiers
export const PUBLIC_POOL_ID = BigInt(0);
export const V2_REWARD_POOL_INDEX = BigInt(0);

// Lock period defaults
export const MINIMUM_CLAIM_LOCK_PERIOD = BigInt(90 * 24 * 60 * 60); // 90 days in seconds

// Cross-chain gas fees
export const ETH_FOR_CROSS_CHAIN_GAS = parseEther("0.01"); // 0.01 ETH for L2 gas

// Timing intervals
export const TIMESTAMP_UPDATE_INTERVAL = 30000; // 30 seconds
export const REWARD_REFETCH_INTERVAL = 2 * 60 * 1000; // 2 minutes

// Gas limits for transactions
export const GAS_LIMIT_CLAIM = BigInt(800000);
export const GAS_LIMIT_LOCK = BigInt(500000);
export const GAS_LIMIT_REFERRAL_CLAIM = BigInt(600000);
export const GAS_LIMIT_WITHDRAW = BigInt(1200000);

// Time conversion constants
export const SECONDS_PER_DAY = 86400;
export const SECONDS_PER_MONTH = 30 * SECONDS_PER_DAY;
export const SECONDS_PER_YEAR = 365 * SECONDS_PER_DAY;
export const SIX_YEARS_IN_SECONDS = 189216000; // Exact value for maximum power factor

// Safety buffer for timing operations
export const TIMING_SAFETY_BUFFER_SECONDS = 300; // 5 minutes
