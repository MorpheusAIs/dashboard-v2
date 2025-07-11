// import { Info } from "lucide-react"
import NumberFlow from '@number-flow/react'
import { GlowingEffect } from "./ui/glowing-effect"
import { formatNumber } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
// import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface MetricCardMinimalProps {
  title: string
  value: string | number
  label?: string // Optional label like "MOR", "ETH", etc
  isUSD?: boolean // If true, shows $ before the value
  className?: string
  disableGlow?: boolean
  autoFormatNumbers?: boolean // Auto format numbers (show decimals only for values < 1)
  showInfo?: boolean // Show info icon
  isGreen?: boolean // If true, shows emerald-400 color
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
      <Card className={`card-minimal group relative p-4 ${className}`}>
        <CardContent className="absolute inset-0 pointer-events-none" />
        <CardHeader className="relative flex flex-col items-start p-0 mb-0">
          <CardDescription className="text-sm text-gray-400">
            {title}
          </CardDescription>
          <CardTitle className={`text-lg font-semibold tabular-nums @[200px]/card:text-xl ${isGreen ? "text-emerald-400" : "text-gray-200"}`}>
            {isUSD && <span>$</span>}
            {isNumericString(value) ? (
              <NumberFlow value={getNumericValue(formatValue(value))} />
            ) : (
              formatValue(value)
            )}
            {label && <span className="text-xs font-normal ml-1">{label}</span>}
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