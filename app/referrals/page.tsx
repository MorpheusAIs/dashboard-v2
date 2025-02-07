"use client"

import { MetricCard } from "@/components/metric-card"
import { ReferralLinkCard } from "@/components/referral-link-card"

export default function ReferralsPage() {
  return (
    <div className="page-container">
      <div className="page-grid">
        <MetricCard
          title="Total Referrals"
          metrics={[{ value: "1,248", label: "Users" }]}
        />

        <MetricCard
          title="Earnings"
          metrics={[{ value: "485.32", label: "MOR" }]}
        />

        <ReferralLinkCard
          className="col-span-2"
          title="Your Referral Link"
          link="https://app.morpheus.com/ref/0x760"
        />
      </div>

      <div className="page-section">
        <h2 className="section-title">Referral History</h2>
        <div className="section-content group">
          <div className="section-content-gradient group-hover:bg-gradient-to-bl group-hover:from-emerald-400/10 group-hover:to-transparent" />
          <div className="section-body"></div>
        </div>
      </div>
    </div>
  )
} 