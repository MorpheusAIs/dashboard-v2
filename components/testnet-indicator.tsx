'use client'

export function TestnetIndicator() {
  return (
    <div className="flex items-center px-2 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-medium bg-orange-500/20 border border-orange-500/30 rounded-full text-orange-400 rounded-full whitespace-nowrap">
      <span className="hidden sm:inline">Connected to</span>
      <span className="sm:hidden">Connected to</span>
      <span className="ml-1">Testnet</span>
    </div>
  )
} 