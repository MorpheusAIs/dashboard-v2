"use client"

import { MetricCard } from "@/components/metric-card"

export default function MOR20Page() {
  return (
    <div className="page-container">
      <div className="page-grid">
        <MetricCard
          title="Token Price"
          metrics={[{ value: "$1.24", label: "USD", change: "+5.2%" }]}
        />

        <MetricCard
          title="Market Cap"
          metrics={[{ value: "$124.5M", label: "USD" }]}
        />

        <MetricCard
          className="col-span-2"
          title="Token Distribution"
          metrics={[
            { value: "85.2M", label: "Circulating" },
            { value: "100M", label: "Total Supply" }
          ]}
        />
      </div>

      <div className="page-section">
        <h2 className="section-title">Price History</h2>
        <div className="section-content group">
          <div className="section-content-gradient group-hover:bg-gradient-to-bl group-hover:from-emerald-400/10 group-hover:to-transparent" />
          <div className="section-body"></div>
        </div>
      </div>
    </div>
  )
} 