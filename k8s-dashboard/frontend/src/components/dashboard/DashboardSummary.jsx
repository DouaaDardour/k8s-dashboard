import { useDashboardSummary } from '../../hooks/useQueries.js'
import clsx from 'clsx'

function KpiCard({ label, value, sub, color, pulse }) {
  const colorMap = {
    red:    'text-red-400 bg-red-900/15 border-red-800/30',
    orange: 'text-orange-400 bg-orange-900/15 border-orange-800/30',
    blue:   'text-blue-400 bg-blue-900/15 border-blue-800/30',
    green:  'text-green-400 bg-green-900/15 border-green-800/30',
    slate:  'text-slate-300 bg-surface-card border-surface-border',
  }

  return (
    <div className={clsx('rounded-xl border p-4 transition-all', colorMap[color] || colorMap.slate)}>
      <p className="text-xs font-mono text-slate-500 mb-1 uppercase tracking-wider">{label}</p>
      <p className={clsx('text-2xl font-semibold font-mono', pulse && 'animate-pulse-slow')}>
        {value ?? '—'}
      </p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function DashboardSummary() {
  const { data, isLoading } = useDashboardSummary()

  if (isLoading) return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-xl border border-surface-border bg-surface-card p-4 animate-pulse h-20" />
      ))}
    </div>
  )

  if (!data) return null

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        label="Incidents 24h"
        value={data.total_incidents_24h}
        sub={`${data.open_incidents} ouverts`}
        color="blue"
      />
      <KpiCard
        label="Critiques actifs"
        value={data.critical_incidents}
        sub={`${data.high_incidents} HIGH`}
        color={data.critical_incidents > 0 ? 'red' : 'slate'}
        pulse={data.critical_incidents > 0}
      />
      <KpiCard
        label="Actions IR en attente"
        value={data.pending_ir_actions?.length ?? 0}
        sub="nécessitent validation"
        color={data.pending_ir_actions?.length > 0 ? 'orange' : 'slate'}
      />
      <KpiCard
        label="Résolus aujourd'hui"
        value={data.resolved_today}
        sub="incidents traités"
        color="green"
      />
    </div>
  )
}
