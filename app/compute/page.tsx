"use client"

import { MetricCard } from "@/components/metric-card"

export default function ComputePage() {
  return (
    <div className="page-container">
      <div className="page-grid">
        <MetricCard
          title="Compute Stats"
          metrics={[{ value: "128", label: "Active Nodes" }]}
        />

        <MetricCard
          title="Network Load"
          metrics={[{ value: "87%", label: "Utilization" }]}
        />

        <MetricCard
          className="col-span-2"
          title="Performance Metrics"
          metrics={[
            { value: "1.2ms", label: "Latency" },
            { value: "99.99%", label: "Uptime" }
          ]}
        />
      </div>

      <div className="page-section">
        <h2 className="section-title">Network Overview</h2>
        <div className="section-content group">
          <div className="section-content-gradient group-hover:bg-gradient-to-bl group-hover:from-emerald-400/10 group-hover:to-transparent" />
          <div className="section-body"></div>
        </div>
      </div>
    </div>
  )
} 