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
    ? value.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 })
    : value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
