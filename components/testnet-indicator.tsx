'use client'

export function TestnetIndicator() {
  return (
    <div className="flex items-center px-2 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-medium text-emerald-400 bg-emerald-400/10 rounded-full whitespace-nowrap">
      <span className="hidden sm:inline">Connected to</span>
      <span className="sm:hidden">Connected to</span>
      <span className="ml-1">Testnet</span>
    </div>
  )
} 