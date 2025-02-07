import { MetricCard } from "@/components/metric-card"

export default function BuildersPage() {
  return (
    <div className="page-container">
      <div className="page-grid">
        <MetricCard
          title="Active Builders"
          metrics={[{ value: "2,481", label: "Users" }]}
        />

        <MetricCard
          title="Total Projects"
          metrics={[{ value: "847", label: "Deployed" }]}
        />

        <MetricCard
          className="col-span-2"
          title="Community Stats"
          metrics={[
            { value: "156", label: "Contributors" },
            { value: "12.5k", label: "Commits" }
          ]}
        />
      </div>

      <div className="page-section">
        <h2 className="section-title">Project Activity</h2>
        <div className="section-content group">
          <div className="section-content-gradient group-hover:bg-gradient-to-bl group-hover:from-emerald-400/10 group-hover:to-transparent" />
          <div className="section-body"></div>
        </div>
      </div>
    </div>
  )
} 