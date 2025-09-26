// import { Info } from "lucide-react"
import dynamic from 'next/dynamic'
import { GlowingEffect } from "./ui/glowing-effect"

// Dynamically import NumberFlow with SSR disabled to prevent hydration errors
const NumberFlow = dynamic(() => import('@number-flow/react'), {
  ssr: false,
  loading: () => <span>—</span>
})
import { formatNumber } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
// import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export interface MetricCardMinimalProps {
  title: string | React.ReactNode
  value?: string | number // Made optional to support loading state
  label?: string // Optional label like "MOR", "ETH", etc
  isUSD?: boolean // If true, shows $ before the value
  className?: string
  disableGlow?: boolean
  autoFormatNumbers?: boolean // Auto format numbers (show decimals only for values < 1)
  showInfo?: boolean // Show info icon
  isGreen?: boolean // If true, shows emerald-400 color
  isLoading?: boolean // If true, shows skeleton loader
}

export function MetricCardMinimal({
  title,
  value,
  label,
  isUSD = false,
  className = "",
  disableGlow = false,
  autoFormatNumbers = false,
  isGreen = false,
  isLoading = false,
//   showInfo = true
}: MetricCardMinimalProps) {

  const getNumericValue = (value: string | number): number => {
    return typeof value === 'string' ? 
      parseFloat(value.replace(/,/g, '')) : 
      value;
  }
  
  // Format number values with decimals only when less than 1
  const formatValue = (value: string | number): string | number => {
    if (!autoFormatNumbers) return value;
    
    // Only process numeric values
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
    
    // Check if it's a valid number
    if (isNaN(numValue)) return value;
    
    // Apply the formatting logic using the utility function
    return formatNumber(numValue);
  }

  // Helper to check if a string looks numeric (allows commas, decimals)
  const isNumericString = (value: string | number): boolean => {
    if (typeof value === 'number') return true;
    if (typeof value !== 'string') return false;
    // Remove commas, check if it's a valid number (potentially with decimals)
    return !isNaN(parseFloat(value.replace(/,/g, '')));
  }

  return (
    <>
      <Card className={`card-minimal group relative p-4 h-full flex flex-col ${className}`}>
        <CardContent className="absolute inset-0 pointer-events-none" />
        <CardHeader className="relative flex flex-col items-start p-0 mb-0 gap-2">
          {typeof title === 'string' ? (
            <CardDescription className="text-sm text-gray-400 leading-tight">
              {title}
            </CardDescription>
          ) : (
            <div className="text-sm text-gray-400 leading-tight">
              {title}
            </div>
          )}
          <CardTitle className={`font-semibold tabular-nums leading-none text-base sm:text-lg ${isGreen ? "text-emerald-400" : "text-gray-200"}`}>
            {isLoading ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              <>
                {isUSD && <span>$</span>}
                {value !== undefined && isNumericString(value) ? (
                  <NumberFlow value={getNumericValue(formatValue(value))} />
                ) : (
                  value !== undefined ? formatValue(value) : '—'
                )}
                {label && <span className="text-sm sm:text-md font-semibold"> {label}</span>}
              </>
            )}
          </CardTitle>
        </CardHeader>
      </Card>
      {!disableGlow && (
        <GlowingEffect 
          spread={40}
          glow={true}
          disabled={false}
          proximity={64}
          inactiveZone={0.01}
          borderWidth={2}
          borderRadius="rounded-xl"
        />
      )}
    </>
  )
} 