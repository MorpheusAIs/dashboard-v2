import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(value: string | number): string {
  // Convert to number if it's a string
  const num = typeof value === 'string' ? parseFloat(value) : value

  // Check if it's a valid number
  if (isNaN(num)) return value.toString()

  // Check if it's a whole number
  if (Number.isInteger(num)) {
    return num.toLocaleString('en-US')
  }

  // Format with 2 decimal places and thousands separator
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}
