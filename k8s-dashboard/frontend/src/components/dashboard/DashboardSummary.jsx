import { useDashboardSummary } from '../../hooks/useQueries.js'
import clsx from 'clsx'

const ICONS = {
  incidents: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  ),
  critical: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  ),
  pending: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M13 10V3L4 14h7v7l9-11h-7z" />
  ),
  resolved: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  ),
}

function KpiCard({ label, value, sub, color, pulse, iconKey }) {
  const colorMap = {
    red:    { bg: 'bg-red-50',    border: 'border-red-200', text: 'text-red-700',    accent: 'bg-red-500',    icon: 'text-red-400', iconBg: 'bg-red-100' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', accent: 'bg-orange-500', icon: 'text-orange-400', iconBg: 'bg-orange-100' },
    blue:   { bg: 'bg-blue-50',   border: 'border-blue-200', text: 'text-blue-700',   accent: 'bg-blue-500',   icon: 'text-blue-400', iconBg: 'bg-blue-100' },
    green:  { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', accent: 'bg-emerald-500', icon: 'text-emerald-400', iconBg: 'bg-emerald-100' },
    slate:  { bg: 'bg-white',     border: 'border-slate-200', text: 'text-slate-700',  accent: 'bg-slate-300',  icon: 'text-slate-400', iconBg: 'bg-slate-100' },
  }
  const cfg = colorMap[color] || colorMap.slate

  return (
    <div className={clsx('rounded-xl border p-5 transition-all duration-200 hover:shadow-card-hover relative overflow-hidden', cfg.bg, cfg.border)}>
      <div className={clsx('absolute top-0 left-0 right-0 h-1 rounded-t-xl', cfg.accent, pulse && 'animate-pulse')} />

      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
        <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center', cfg.iconBg)}>
          <svg className={clsx('w-4 h-4', cfg.icon)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {ICONS[iconKey]}
          </svg>
        </div>
      </div>

      <p className={clsx('text-3xl font-bold font-mono', cfg.text, pulse && 'animate-pulse-slow')}>
        {value ?? '—'}
      </p>
      {sub && <p className="text-xs text-slate-500 mt-1.5">{sub}</p>}
    </div>
  )
}

export default function DashboardSummary() {
  const { data, isLoading } = useDashboardSummary()

  if (isLoading) return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 animate-pulse h-28" />
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
        iconKey="incidents"
      />
      <KpiCard
        label="Critiques actifs"
        value={data.critical_incidents}
        sub={`${data.high_incidents} HIGH en attente`}
        color={data.critical_incidents > 0 ? 'red' : 'slate'}
        pulse={data.critical_incidents > 0}
        iconKey="critical"
      />
      <KpiCard
        label="Actions IR"
        value={data.pending_ir_actions?.length ?? 0}
        sub="en attente de validation"
        color={data.pending_ir_actions?.length > 0 ? 'orange' : 'slate'}
        iconKey="pending"
      />
      <KpiCard
        label="Résolus aujourd'hui"
        value={data.resolved_today}
        sub="incidents traités"
        color="green"
        iconKey="resolved"
      />
    </div>
  )
}
