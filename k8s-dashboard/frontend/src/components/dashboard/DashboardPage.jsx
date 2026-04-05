import RiskScoreGauge   from './RiskScoreGauge.jsx'
import DashboardSummary from './DashboardSummary.jsx'
import IncidentTimeline  from './IncidentTimeline.jsx'
import ServiceHeatmap    from './ServiceHeatmap.jsx'
import IncidentTable     from './IncidentTable.jsx'
import IRLivePanel       from '../ir/IRLivePanel.jsx'

export default function DashboardPage() {
  return (
    <div className="space-y-6 max-w-screen-2xl mx-auto">

      {/* ── Ligne 1 : KPI cards ─────────────────────────────── */}
      <DashboardSummary />

      {/* ── Ligne 2 : Gauge + Timeline + IR Live ────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Gauge Risk Score */}
        <div className="lg:col-span-3">
          <RiskScoreGauge />
        </div>

        {/* Timeline */}
        <div className="lg:col-span-5">
          <IncidentTimeline />
        </div>

        {/* IR Live Panel */}
        <div className="lg:col-span-4">
          <IRLivePanel />
        </div>
      </div>

      {/* ── Ligne 3 : Heatmap + Table incidents ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Heatmap namespaces */}
        <div className="lg:col-span-4">
          <ServiceHeatmap />
        </div>

        {/* Table incidents */}
        <div className="lg:col-span-8">
          <IncidentTable />
        </div>
      </div>

    </div>
  )
}
