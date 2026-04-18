import { useState } from 'react'
import clsx from 'clsx'

export default function PodMetricsTable({ data }) {
  const [sortField, setSortField] = useState('cpu_percent')
  const [sortDirection, setSortDirection] = useState('desc')
  const [filterStatus, setFilterStatus] = useState('all')

  const { pods, summary } = data

  const sortedPods = [...pods].sort((a, b) => {
    const aVal = a[sortField]
    const bVal = b[sortField]
    return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
  })

  const filteredPods = filterStatus === 'all' 
    ? sortedPods 
    : sortedPods.filter(p => p.status.toLowerCase() === filterStatus)

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const SortIcon = ({ field }) => (
    <svg 
      className={clsx(
        'w-4 h-4 ml-1 transition-transform',
        sortField === field ? 'text-brand-400' : 'text-slate-600'
      )}
      style={{ transform: sortField === field && sortDirection === 'asc' ? 'rotate(180deg)' : '' }}
      fill="none" 
      viewBox="0 0 24 24" 
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )

  const StatusBadge = ({ status, restart_count }) => {
    const colors = {
      'Running': 'bg-gradient-to-r from-emerald-500/20 to-emerald-600/10 text-emerald-300 border-emerald-500/30',
      'Pending': 'bg-gradient-to-r from-amber-500/20 to-amber-600/10 text-amber-300 border-amber-500/30',
      'Failed': 'bg-gradient-to-r from-red-500/20 to-red-600/10 text-red-300 border-red-500/30',
      'Succeeded': 'bg-gradient-to-r from-blue-500/20 to-blue-600/10 text-blue-300 border-blue-500/30',
      'Unknown': 'bg-gradient-to-r from-slate-500/20 to-slate-600/10 text-slate-300 border-slate-500/30',
    }
    
    return (
      <div className="flex items-center gap-2">
        <span className={clsx(
          'px-2.5 py-1 rounded-lg text-xs font-semibold border',
          colors[status] || colors['Unknown']
        )}>
          {status}
        </span>
        {restart_count > 0 && (
          <span className="text-xs text-amber-400 font-medium" title={`${restart_count} redémarrages`}>
            ↻{restart_count}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-violet-500/20 to-violet-600/10 rounded-xl flex items-center justify-center border border-violet-500/30">
            <svg className="w-6 h-6 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Métriques des Pods</h3>
            <p className="text-slate-400 text-sm">
              {summary.total} pods • {summary.running} en cours • CPU moyen: {summary.avg_cpu}%
            </p>
          </div>
        </div>

        {/* Filters */}
        <select 
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-slate-800/80 border border-slate-700/50 text-slate-200 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500/50 hover:border-slate-600/50 transition-colors"
        >
          <option value="all">Tous les statuts</option>
          <option value="running">Running</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="text-left py-3 px-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pod</span>
              </th>
              <th className="text-left py-3 px-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Namespace</span>
              </th>
              <th 
                className="text-left py-3 px-3 cursor-pointer hover:bg-slate-800/50 rounded-lg transition-colors"
                onClick={() => handleSort('cpu_percent')}
              >
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">CPU</span>
                  <SortIcon field="cpu_percent" />
                </div>
              </th>
              <th 
                className="text-left py-3 px-3 cursor-pointer hover:bg-slate-800/50 rounded-lg transition-colors"
                onClick={() => handleSort('memory_percent')}
              >
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Mémoire</span>
                  <SortIcon field="memory_percent" />
                </div>
              </th>
              <th className="text-left py-3 px-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Statut</span>
              </th>
              <th 
                className="text-left py-3 px-3 cursor-pointer hover:bg-slate-800/50 rounded-lg transition-colors"
                onClick={() => handleSort('age_hours')}
              >
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Âge</span>
                  <SortIcon field="age_hours" />
                </div>
              </th>
              <th className="text-left py-3 px-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Nœud</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {filteredPods.map((pod) => (
              <tr key={pod.pod_name} className="hover:bg-slate-800/40 transition-colors group">
                <td className="py-3.5 px-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gradient-to-br from-brand-400 to-brand-500" />
                    <span className="text-sm text-slate-200 font-medium group-hover:text-white transition-colors">{pod.pod_name}</span>
                  </div>
                </td>
                <td className="py-3.5 px-3">
                  <span className="text-xs text-slate-400 bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-700/30">
                    {pod.namespace}
                  </span>
                </td>
                <td className="py-3.5 px-3">
                  <div className="flex items-center gap-3">
                    <div className="w-20 h-2 bg-slate-700/50 rounded-full overflow-hidden">
                      <div 
                        className={clsx(
                          'h-full rounded-full transition-all duration-500 shadow-[0_0_6px_rgba(0,0,0,0.3)]',
                          pod.cpu_percent > 80 ? 'bg-gradient-to-r from-red-500 to-red-600' : pod.cpu_percent > 60 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                        )}
                        style={{ width: `${Math.min(100, pod.cpu_percent)}%` }}
                      />
                    </div>
                    <span className={clsx(
                      'text-sm font-bold',
                      pod.cpu_percent > 80 ? 'text-red-300' : pod.cpu_percent > 60 ? 'text-amber-300' : 'text-emerald-300'
                    )}>
                      {pod.cpu_percent.toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className="py-3.5 px-3">
                  <div className="flex items-center gap-3">
                    <div className="w-20 h-2 bg-slate-700/50 rounded-full overflow-hidden">
                      <div 
                        className={clsx(
                          'h-full rounded-full transition-all duration-500 shadow-[0_0_6px_rgba(0,0,0,0.3)]',
                          pod.memory_percent > 85 ? 'bg-gradient-to-r from-red-500 to-red-600' : pod.memory_percent > 70 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-blue-400 to-blue-500'
                        )}
                        style={{ width: `${Math.min(100, pod.memory_percent)}%` }}
                      />
                    </div>
                    <div className="text-sm">
                      <span className={clsx(
                        'font-bold',
                        pod.memory_percent > 85 ? 'text-red-300' : pod.memory_percent > 70 ? 'text-amber-300' : 'text-blue-300'
                      )}>
                        {pod.memory_percent.toFixed(1)}%
                      </span>
                      <span className="text-slate-500 text-xs ml-1">({pod.memory_usage_mb} MB)</span>
                    </div>
                  </div>
                </td>
                <td className="py-3.5 px-3">
                  <StatusBadge status={pod.status} restart_count={pod.restart_count} />
                </td>
                <td className="py-3.5 px-3">
                  <span className="text-sm text-slate-400 font-medium">
                    {pod.age_hours < 1 
                      ? `${Math.round(pod.age_hours * 60)}m` 
                      : pod.age_hours < 24 
                        ? `${Math.round(pod.age_hours)}h` 
                        : `${Math.round(pod.age_hours / 24)}d`
                    }
                  </span>
                </td>
                <td className="py-3.5 px-3">
                  <span className="text-xs text-slate-500 font-mono bg-slate-800/50 px-2 py-1 rounded">{pod.node}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredPods.length === 0 && (
        <div className="text-center py-12 bg-slate-800/20 rounded-xl border border-slate-700/30">
          <svg className="w-12 h-12 text-slate-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="text-slate-400 font-medium">Aucun pod trouvé pour ce filtre</p>
        </div>
      )}
    </div>
  )
}
