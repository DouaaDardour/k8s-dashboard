import { useDashboardSummary } from '../../hooks/useQueries.js'
import { useFilterStore } from '../../stores/filterStore.js'
import clsx from 'clsx'

const SEV_CONFIG = {
  CRITICAL: { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     dot: 'bg-red-500' },
  HIGH:     { bg: 'bg-orange-50',  border: 'border-orange-200',  text: 'text-orange-700',  dot: 'bg-orange-400' },
  MEDIUM:   { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   dot: 'bg-amber-400' },
  LOW:      { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
}

export default function ServiceHeatmap() {
  const { data, isLoading } = useDashboardSummary()
  const setNamespace = useFilterStore(s => s.setNamespace)
  const activeNs = useFilterStore(s => s.namespace)

  const namespaces = data?.top_namespaces ?? []

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Heatmap namespaces
        </h2>
        <span className="text-[10px] text-slate-400">cliquer pour filtrer</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : namespaces.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">
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
                  isActive ? 'ring-2 ring-brand-500 shadow-md' : 'hover:shadow-sm'
                )}
              >
                <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', cfg.dot)} />
                <span className="font-mono text-sm text-slate-700 flex-1 truncate font-medium">
                  {ns.namespace}
                </span>
                <span className={clsx('text-xs font-mono font-semibold', cfg.text)}>
                  {ns.incident_count} inc.
                </span>
                <div className="w-20 flex items-center gap-1.5">
                  <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${ns.avg_score}%`,
                        backgroundColor:
                          ns.max_severity === 'CRITICAL' ? '#dc2626' :
                          ns.max_severity === 'HIGH'     ? '#ea580c' :
                          ns.max_severity === 'MEDIUM'   ? '#d97706' : '#16a34a',
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 w-6 text-right font-semibold">
                    {Math.round(ns.avg_score)}
                  </span>
                </div>
                <span className={clsx('text-[10px] font-mono font-bold px-2 py-0.5 rounded-full', cfg.text, 'border', cfg.border)}>
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
