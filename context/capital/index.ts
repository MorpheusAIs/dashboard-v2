/**
 * Capital Context Module
 * Re-exports all capital-related functionality for backward compatibility
 */

// Re-export context and hook
export { CapitalProvider, useCapitalContext } from "./CapitalContext";

// Re-export all types
export * from "./types";

// Re-export constants
export * from "./constants";

// Backward compatibility - re-export AssetSymbol from original location
export type { AssetSymbol } from "@/components/capital/constants/asset-config";
