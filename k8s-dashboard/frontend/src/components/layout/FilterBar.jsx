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
    <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-4 flex-wrap">
      {/* Namespace */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 font-semibold uppercase">ns</label>
        <select
          value={namespace || ''}
          onChange={e => setNamespace(e.target.value || null)}
          className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-mono focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 min-w-28"
        >
          <option value="">Tous</option>
          {namespaces.map(ns => <option key={ns} value={ns}>{ns}</option>)}
        </select>
      </div>

      {/* Pod */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 font-semibold uppercase">pod</label>
        <select
          value={pod || ''}
          onChange={e => setPod(e.target.value || null)}
          className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-mono focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 min-w-28"
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
              'text-[10px] font-semibold px-2.5 py-1 rounded-full transition-all border',
              severity === sev
                ? sev === 'CRITICAL' ? 'bg-red-100 text-red-700 border-red-300'
                  : sev === 'HIGH' ? 'bg-orange-100 text-orange-700 border-orange-300'
                  : sev === 'MEDIUM' ? 'bg-amber-100 text-amber-700 border-amber-300'
                  : 'bg-emerald-100 text-emerald-700 border-emerald-300'
                : 'text-slate-400 border-slate-200 hover:border-slate-300 hover:text-slate-600 bg-white'
            )}
          >
            {sev}
          </button>
        ))}
      </div>

      {/* Date range */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
        {DATE_RANGES.map(r => (
          <button
            key={r.value}
            onClick={() => setDateRange(r.value)}
            className={clsx(
              'text-xs font-medium px-3 py-1 rounded-md transition-colors',
              dateRange === r.value
                ? 'bg-white text-brand-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
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
          className="ml-auto text-xs text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1.5 font-medium"
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
