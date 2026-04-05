import { useFilterStore } from '../../stores/filterStore.js'
import { useNamespaces, usePods } from '../../hooks/useQueries.js'
import clsx from 'clsx'

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
const DATE_RANGES = [{ label: '7j', value: 7 }, { label: '30j', value: 30 }, { label: '90j', value: 90 }]

export default function FilterBar() {
  const {
    namespace, pod, severity, dateRange,
    setNamespace, setPod, setSeverity, setDateRange, resetFilters
  } = useFilterStore()

  const { data: namespaces = [] } = useNamespaces()
  const { data: pods = [] } = usePods()

  const hasActiveFilters = namespace || pod || severity

  return (
    <div className="bg-surface-card border-b border-surface-border px-6 py-3 flex items-center gap-4 flex-wrap">
      {/* Namespace */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-500 font-mono">ns:</label>
        <select
          value={namespace || ''}
          onChange={e => setNamespace(e.target.value || null)}
          className="bg-surface border border-surface-border rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-brand-500 min-w-28"
        >
          <option value="">Tous</option>
          {namespaces.map(ns => <option key={ns} value={ns}>{ns}</option>)}
        </select>
      </div>

      {/* Pod */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-500 font-mono">pod:</label>
        <select
          value={pod || ''}
          onChange={e => setPod(e.target.value || null)}
          className="bg-surface border border-surface-border rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-brand-500 min-w-28"
        >
          <option value="">Tous</option>
          {pods.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Sévérité */}
      <div className="flex items-center gap-1.5">
        {SEVERITIES.map(sev => (
          <button
            key={sev}
            onClick={() => setSeverity(severity === sev ? null : sev)}
            className={clsx(
              'text-[10px] font-mono px-2 py-1 rounded transition-all',
              severity === sev
                ? sev === 'CRITICAL' ? 'bg-red-700 text-red-100'
                  : sev === 'HIGH' ? 'bg-orange-700 text-orange-100'
                  : sev === 'MEDIUM' ? 'bg-yellow-700 text-yellow-100'
                  : 'bg-green-700 text-green-100'
                : 'text-slate-500 hover:text-slate-300 border border-surface-border hover:border-slate-600'
            )}
          >
            {sev}
          </button>
        ))}
      </div>

      {/* Date range */}
      <div className="flex items-center gap-1">
        {DATE_RANGES.map(r => (
          <button
            key={r.value}
            onClick={() => setDateRange(r.value)}
            className={clsx(
              'text-xs font-mono px-2.5 py-1 rounded transition-colors',
              dateRange === r.value
                ? 'bg-brand-600/30 text-brand-400'
                : 'text-slate-500 hover:text-slate-300'
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Reset */}
      {hasActiveFilters && (
        <button
          onClick={resetFilters}
          className="ml-auto text-xs text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Réinitialiser
        </button>
      )}
    </div>
  )
}
