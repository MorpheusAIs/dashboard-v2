import { Info } from "lucide-react"

interface MetricValue {
  value: string | number
  label: string
  change?: string  // Optional change indicator (e.g. "+5.2%")
}

interface MetricCardProps {
  title: string
  metrics: MetricValue[]
  className?: string
}

export function MetricCard({ title, metrics, className = "" }: MetricCardProps) {
  const isDoubleMetric = metrics.length === 2

  const formatMetricValue = (value: string | number) => {
    const num = typeof value === 'string' ? 
      parseFloat(value.replace(/,/g, '')) : 
      value
    return Math.floor(num).toLocaleString('en-US')
    // return Number.isInteger(num) ? 
    //   num.toLocaleString('en-US', { maximumFractionDigits: 0 }) : 
    //   num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  return (
    <div className={`card-container group ${className}`}>
      <div className="card-gradient group-hover:bg-gradient-to-bl group-hover:from-emerald-400/10 group-hover:to-transparent" />
      <div className="relative">
        <div className="card-header">
          <h3 className="card-title">{title}</h3>
          <Info className="card-info-icon" />
        </div>
        {isDoubleMetric ? (
          <div className="metric-grid">
            {metrics.map((metric, index) => (
              <div key={index} className="metric-container">
                <span className="metric-value">{formatMetricValue(metric.value)}</span>
                <span className="metric-label">{metric.label}</span>
                {metric.change && <span className="metric-change">{metric.change}</span>}
              </div>
            ))}
          </div>
        ) : (
          <div className="metric-container">
            <span className="metric-value">{formatMetricValue(metrics[0].value)}</span>
            <span className="metric-label">{metrics[0].label}</span>
            {metrics[0].change && <span className="metric-change">{metrics[0].change}</span>}
          </div>
        )}
      </div>
    </div>
  )
} 
