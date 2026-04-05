import { useDashboardSummary } from '../../hooks/useQueries.js'
import { useFilterStore } from '../../stores/filterStore.js'
import clsx from 'clsx'

const SEV_CONFIG = {
  CRITICAL: { bg: 'bg-red-900/60',    border: 'border-red-600/50',    text: 'text-red-300',    dot: 'bg-red-500' },
  HIGH:     { bg: 'bg-orange-900/40', border: 'border-orange-600/40', text: 'text-orange-300', dot: 'bg-orange-400' },
  MEDIUM:   { bg: 'bg-yellow-900/30', border: 'border-yellow-600/30', text: 'text-yellow-300', dot: 'bg-yellow-400' },
  LOW:      { bg: 'bg-green-900/20',  border: 'border-green-700/30',  text: 'text-green-400',  dot: 'bg-green-500' },
}

export default function ServiceHeatmap() {
  const { data, isLoading } = useDashboardSummary()
  const setNamespace = useFilterStore(s => s.setNamespace)
  const activeNs = useFilterStore(s => s.namespace)

  const namespaces = data?.top_namespaces ?? []

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-mono text-slate-400 uppercase tracking-widest">
          Heatmap namespaces
        </h2>
        <span className="text-[10px] text-slate-600 font-mono">cliquer pour filtrer</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 bg-surface-border/30 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : namespaces.length === 0 ? (
        <div className="text-center py-8 text-slate-600 text-sm font-mono">
          Aucune donnée disponible
        </div>
      ) : (
        <div className="space-y-2">
          {namespaces.map((ns) => {
            const cfg = SEV_CONFIG[ns.max_severity] || SEV_CONFIG.LOW
            const isActive = activeNs === ns.namespace

            return (
              <button
                key={ns.namespace}
                onClick={() => setNamespace(activeNs === ns.namespace ? null : ns.namespace)}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left',
                  cfg.bg, cfg.border,
                  isActive ? 'ring-1 ring-brand-500' : 'hover:opacity-80'
                )}
              >
                {/* Dot sévérité */}
                <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', cfg.dot)} />

                {/* Namespace name */}
                <span className="font-mono text-sm text-slate-200 flex-1 truncate">
                  {ns.namespace}
                </span>

                {/* Incidents count */}
                <span className={clsx('text-xs font-mono', cfg.text)}>
                  {ns.incident_count} inc.
                </span>

                {/* Avg score bar */}
                <div className="w-20 flex items-center gap-1.5">
                  <div className="flex-1 h-1 bg-surface-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${ns.avg_score}%`,
                        backgroundColor:
                          ns.max_severity === 'CRITICAL' ? '#ef4444' :
                          ns.max_severity === 'HIGH'     ? '#f97316' :
                          ns.max_severity === 'MEDIUM'   ? '#eab308' : '#22c55e',
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 w-6 text-right">
                    {Math.round(ns.avg_score)}
                  </span>
                </div>

                {/* Badge sévérité max */}
                <span className={clsx('text-[10px] font-mono px-1.5 py-0.5 rounded', cfg.text, 'border', cfg.border)}>
                  {ns.max_severity}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
