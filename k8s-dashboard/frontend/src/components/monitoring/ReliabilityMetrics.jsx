import clsx from 'clsx'

export default function ReliabilityMetrics({ data }) {
  const { 
    uptime_percent, 
    mttr_minutes, 
    mtbf_hours, 
    availability_percent,
    incidents_7d,
    resolved_7d,
    resolution_rate,
    incidents_trend,
    sla_target,
    sla_current,
    sla_status 
  } = data

  const SLABadge = ({ status }) => {
    const colors = {
      ok: 'bg-gradient-to-r from-emerald-500/20 to-emerald-600/10 text-emerald-300 border-emerald-500/30',
      warning: 'bg-gradient-to-r from-amber-500/20 to-amber-600/10 text-amber-300 border-amber-500/30',
      breach: 'bg-gradient-to-r from-red-500/20 to-red-600/10 text-red-300 border-red-500/30',
    }
    const labels = {
      ok: 'SLA OK',
      warning: 'SLA Warning',
      breach: 'SLA Breach',
    }
    
    return (
      <span className={clsx(
        'px-3 py-1.5 rounded-full text-xs font-semibold border',
        colors[status] || colors.ok
      )}>
        {labels[status] || status}
      </span>
    )
  }

  const MetricBox = ({ label, value, unit, subtext, color = 'white' }) => {
    const colorClasses = {
      emerald: 'text-emerald-300',
      amber: 'text-amber-300',
      red: 'text-red-300',
      white: 'text-white',
      brand: 'text-brand-300',
    }
    
    const bgClasses = {
      emerald: 'from-emerald-500/15 to-emerald-600/5 border-emerald-500/20',
      amber: 'from-amber-500/15 to-amber-600/5 border-amber-500/20',
      red: 'from-red-500/15 to-red-600/5 border-red-500/20',
      white: 'from-slate-700/50 to-slate-800/30 border-slate-600/30',
      brand: 'from-brand-500/15 to-brand-600/5 border-brand-500/20',
    }
    
    return (
      <div className={clsx('bg-gradient-to-br rounded-xl p-4 text-center border', bgClasses[color])}>
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{label}</p>
        <p className={clsx('text-3xl font-bold mt-2', colorClasses[color])}>
          {value}
          <span className="text-sm font-normal text-slate-500 ml-1">{unit}</span>
        </p>
        {subtext && <p className="text-xs text-slate-500 mt-2 font-medium">{subtext}</p>}
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 rounded-xl flex items-center justify-center border border-emerald-500/30">
            <svg className="w-6 h-6 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Métriques de Fiabilité</h3>
            <p className="text-slate-400 text-sm">SLA, MTTR, MTBF et tendances</p>
          </div>
        </div>
        <SLABadge status={sla_status} />
      </div>

      {/* Main Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <MetricBox 
          label="Uptime"
          value={uptime_percent.toFixed(3)}
          unit="%"
          color={uptime_percent > 99.9 ? 'emerald' : uptime_percent > 99 ? 'amber' : 'red'}
        />
        <MetricBox 
          label="Disponibilité"
          value={availability_percent.toFixed(3)}
          unit="%"
          color={availability_percent > 99.9 ? 'emerald' : availability_percent > 99 ? 'amber' : 'red'}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <MetricBox 
          label="MTTR"
          value={mttr_minutes.toFixed(1)}
          unit="min"
          subtext="Mean Time To Recovery"
          color={mttr_minutes < 30 ? 'emerald' : mttr_minutes < 60 ? 'amber' : 'red'}
        />
        <MetricBox 
          label="MTBF"
          value={mtbf_hours.toFixed(1)}
          unit="h"
          subtext="Mean Time Between Failures"
          color={mtbf_hours > 48 ? 'emerald' : mtbf_hours > 24 ? 'amber' : 'red'}
        />
      </div>

      {/* SLA Comparison */}
      <div className="bg-gradient-to-br from-slate-700/40 to-slate-800/30 border border-slate-600/30 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-slate-400">SLA Target</span>
          <span className="text-sm font-bold text-white">{sla_target}%</span>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-400">SLA Actuel</span>
          <span className={clsx(
            'text-sm font-bold',
            sla_current >= sla_target ? 'text-emerald-300' : 'text-red-300'
          )}>
            {sla_current}%
          </span>
        </div>
        <div className="h-2.5 bg-slate-700/50 rounded-full overflow-hidden">
          <div 
            className={clsx(
              'h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_8px_rgba(0,0,0,0.3)]',
              sla_current >= sla_target ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-red-400 to-red-500'
            )}
            style={{ width: `${Math.min(100, (sla_current / sla_target) * 100)}%` }}
          />
        </div>
        <p className="text-xs text-slate-400 mt-3 font-medium">
          {sla_current >= sla_target 
            ? <span className="text-emerald-400">✓ SLA respecté (+{(sla_current - sla_target).toFixed(3)}%)</span>
            : <span className="text-red-400">✗ SLA non respecté (-{(sla_target - sla_current).toFixed(3)}%)</span>
          }
        </p>
      </div>

      {/* Incidents Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="text-center p-4 bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-xl">
          <p className="text-2xl font-bold text-amber-300">{incidents_7d}</p>
          <p className="text-xs text-slate-400 mt-1 font-medium uppercase tracking-wider">Incidents 7j</p>
        </div>
        <div className="text-center p-4 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 rounded-xl">
          <p className="text-2xl font-bold text-emerald-300">{resolved_7d}</p>
          <p className="text-xs text-slate-400 mt-1 font-medium uppercase tracking-wider">Résolus</p>
        </div>
        <div className="text-center p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl">
          <p className={clsx('text-2xl font-bold', resolution_rate >= 90 ? 'text-emerald-300' : 'text-amber-300')}>
            {resolution_rate}%
          </p>
          <p className="text-xs text-slate-400 mt-1 font-medium uppercase tracking-wider">Taux résolution</p>
        </div>
      </div>

      {/* Trend Chart */}
      {incidents_trend && incidents_trend.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Tendance Incidents (7 jours)</h4>
          <div className="flex items-end gap-1.5 h-28 bg-slate-800/30 rounded-xl p-3 border border-slate-700/30">
            {incidents_trend.map((day, index) => {
              const maxCount = Math.max(...incidents_trend.map(d => d.count), 1)
              const height = (day.count / maxCount) * 100
              
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center group cursor-pointer">
                  <div 
                    className={clsx(
                      'w-full rounded-lg transition-all duration-300 hover:opacity-80 shadow-lg',
                      day.count === 0 ? 'bg-slate-700' : day.count < 3 ? 'bg-gradient-to-t from-emerald-600 to-emerald-400' : day.count < 6 ? 'bg-gradient-to-t from-amber-600 to-amber-400' : 'bg-gradient-to-t from-red-600 to-red-400'
                    )}
                    style={{ height: `${Math.max(15, height)}%` }}
                    title={`${day.date}: ${day.count} incidents`}
                  />
                  <span className="text-[10px] text-slate-500 mt-2 font-medium group-hover:text-slate-300 transition-colors">
                    {new Date(day.date).toLocaleDateString('fr-FR', { weekday: 'narrow' })}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
