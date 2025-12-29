import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a number with decimal places only when less than 1
 * @param value - The number to format
 * @returns Formatted string with decimal places only when value < 1
 */
export function formatNumber(value: number): string {
  if (isNaN(value)) return '0';

  return value < 1
    ? value.toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
    : value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/**
 * Extracts description from a builder's description field.
 * Handles both plain strings and stringified JSON with metadata_ structure.
 *
 * Some subnets store metadata as JSON: {"metadata_":{"description":"...", ...}}
 * This function extracts the actual description from that structure.
 *
 * @param description - The raw description field (string, null, or undefined)
 * @returns The extracted description string, or empty string if not available
 */
export function parseBuilderDescription(description: string | null | undefined): string {
  if (!description) return '';

  // Quick check: if it doesn't start with '{', it's a plain string
  if (!description.trim().startsWith('{')) {
    return description;
  }

  try {
    const parsed = JSON.parse(description);
    // Check for metadata_.description structure
    if (parsed?.metadata_?.description && typeof parsed.metadata_.description === 'string') {
      return parsed.metadata_.description;
    }
    // Fallback: return original if parsing succeeds but structure doesn't match
    return description;
  } catch {
    // JSON parsing failed, return original string
    return description;
  }
}
