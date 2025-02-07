"use client"

import { Info } from "lucide-react"
import { MetricCard } from "@/components/metric-card"

export default function CapitalPage() {
  return (
    <div className="page-container">
      <div className="page-grid">
        <MetricCard
          title="Total Deposits"
          metrics={[{ value: "39573.032", label: "stETH" }]}
        />

        <MetricCard
          title="Current Daily Reward"
          metrics={[{ value: "3248.6044", label: "MOR" }]}
        />

        {/* Your Deposit card taking two columns */}
        <div className="col-span-2 card-container group">
          <div className="card-gradient group-hover:bg-gradient-to-bl group-hover:from-emerald-400/10 group-hover:to-transparent" />
          <div className="relative grid grid-cols-2 gap-8">
            {/* Left column - Deposit amount */}
            <div>
              <div className="card-header">
                <h3 className="card-title">Your Deposit</h3>
                <Info className="card-info-icon" />
              </div>
              <div className="metric-container">
                <span className="metric-value">39,573.03</span>
                <span className="metric-label">stETH</span>
              </div>
              <button className="mt-6 copy-button">
                Withdraw stETH
              </button>
            </div>

            {/* Right column - Lock info */}
            <div>
              <div className="card-header">
                <h3 className="card-title">Withdraw is Locked Until</h3>
                <Info className="card-info-icon" />
              </div>
              <div className="text-xl">1 Jan 2025 at 05:12</div>
            </div>
          </div>
        </div>
      </div>

      <div className="page-section">
        <h2 className="section-title">Assets to Deposit</h2>
        <div className="section-content group">
          <div className="section-content-gradient group-hover:bg-gradient-to-bl group-hover:from-emerald-400/10 group-hover:to-transparent" />
          <div className="section-body"></div>
        </div>
      </div>
    </div>
  )
}