/**
 * Capital Page Context
 *
 * This file has been refactored into modular components.
 * All exports are re-exported from the new location for backward compatibility.
 *
 * New module structure:
 * - /context/capital/types.ts - Type definitions
 * - /context/capital/constants.ts - Constants
 * - /context/capital/CapitalContext.tsx - Main context provider
 * - /hooks/capital/use-capital-contract-reads.ts - Contract read hooks
 * - /hooks/capital/use-capital-assets.ts - Asset computation
 * - /hooks/capital/use-capital-referrals.ts - Referral data
 * - /hooks/capital/use-capital-transactions.ts - Transaction handling
 * - /hooks/capital/use-multiplier-simulation.ts - Multiplier simulation
 * - /lib/utils/capital-helpers.ts - Pure helper functions
 */

// Re-export everything from the new modular structure
export * from "./capital";
