import { Info } from "lucide-react"
import NumberFlow from '@number-flow/react'
import { GlowingEffect } from "./ui/glowing-effect"
import { formatNumber } from "@/lib/utils"

interface MetricValue {
  value: string | number
  label: string
  change?: string  // Optional change indicator (e.g. "+5.2%")
}

interface MetricCardProps {
  title: string
  metrics: MetricValue[]
  className?: string
  disableGlow?: boolean;
  autoFormatNumbers?: boolean; // Auto format numbers (show decimals only for values < 1)
}

export function MetricCard({ 
  title, 
  metrics, 
  className = "", 
  disableGlow = false,
  autoFormatNumbers = false
}: MetricCardProps) {
  const isDoubleMetric = metrics.length === 2

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

  return (
    <div className={`card-container group relative ${className}`}>
      <div className="card-gradient group-hover:bg-gradient-to-bl group-hover:from-emerald-400/10 group-hover:to-transparent" />
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
      <div className="relative">
        <div className="card-header">
          <h3 className="card-title">{title}</h3>
          <Info className="card-info-icon" />
        </div>
        {isDoubleMetric ? (
          <div className="metric-grid">
            {metrics.map((metric, index) => (
              <div key={index} className="metric-container">
                <span className="metric-value">
                  <NumberFlow value={getNumericValue(formatValue(metric.value))} />
                </span>
                <span className="metric-label">{metric.label}</span>
                {metric.change && <span className="metric-change">{metric.change}</span>}
              </div>
            ))}
          </div>
        ) : (
          <div className="metric-container">
            <span className="metric-value">
              <NumberFlow value={getNumericValue(formatValue(metrics[0].value))} />
            </span>
            <span className="metric-label">{metrics[0].label}</span>
            {metrics[0].change && <span className="metric-change">{metrics[0].change}</span>}
          </div>
        )}
      </div>
    </div>
  )
} 
