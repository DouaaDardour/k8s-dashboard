import clsx from 'clsx'

export default function ClusterHealth({ data }) {
  const { 
    status, 
    node_count, 
    pod_count, 
    ready_pods, 
    pending_pods, 
    failed_pods,
    avg_cpu_percent,
    avg_memory_percent,
    incidents_24h,
    reliability_score,
    namespace_breakdown 
  } = data

  const StatusBadge = ({ status }) => {
    const colors = {
      healthy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      degraded: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      critical: 'bg-red-500/10 text-red-400 border-red-500/20',
    }
    const labels = {
      healthy: 'Sain',
      degraded: 'Dégradé',
      critical: 'Critique',
    }
    
    return (
      <span className={clsx(
        'px-3 py-1 rounded-full text-xs font-medium border',
        colors[status] || colors.healthy
      )}>
        {labels[status] || status}
      </span>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/30">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Santé du Cluster</h3>
            <p className="text-slate-500 text-sm">État des nœuds et pods Kubernetes</p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{node_count}</p>
          <p className="text-xs text-blue-500 mt-1 font-semibold uppercase tracking-wider">Nœuds</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{ready_pods}</p>
          <p className="text-xs text-emerald-500 mt-1 font-semibold uppercase tracking-wider">Pods Prêts</p>
        </div>
        <div className={clsx(
          'rounded-xl p-4 text-center border',
          pending_pods > 0 
            ? 'bg-amber-50 border-amber-200' 
            : 'bg-slate-50 border-slate-200'
        )}>
          <p className={clsx('text-2xl font-bold', pending_pods > 0 ? 'text-amber-600' : 'text-slate-400')}>
            {pending_pods}
          </p>
          <p className="text-xs text-slate-500 mt-1 font-semibold uppercase tracking-wider">En Attente</p>
        </div>
        <div className={clsx(
          'rounded-xl p-4 text-center border',
          failed_pods > 0 
            ? 'bg-red-50 border-red-200' 
            : 'bg-slate-50 border-slate-200'
        )}>
          <p className={clsx('text-2xl font-bold', failed_pods > 0 ? 'text-red-600' : 'text-slate-400')}>
            {failed_pods}
          </p>
          <p className="text-xs text-slate-500 mt-1 font-semibold uppercase tracking-wider">Échecs</p>
        </div>
      </div>

      {/* Resource Usage */}
      <div className="space-y-5 mb-6">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Utilisation des Ressources</h4>
        
        {/* CPU */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">CPU Moyen</span>
            <span className={clsx(
              'text-sm font-bold',
              avg_cpu_percent > 80 ? 'text-red-600' : avg_cpu_percent > 60 ? 'text-amber-600' : 'text-emerald-600'
            )}>
              {avg_cpu_percent.toFixed(1)}%
            </span>
          </div>
          <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className={clsx(
                'h-full rounded-full transition-all duration-700 ease-out',
                avg_cpu_percent > 80 ? 'bg-gradient-to-r from-red-500 to-red-600' : avg_cpu_percent > 60 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-emerald-400 to-emerald-500'
              )}
              style={{ width: `${Math.min(100, avg_cpu_percent)}%` }}
            />
          </div>
        </div>

        {/* Memory */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Mémoire Moyenne</span>
            <span className={clsx(
              'text-sm font-bold',
              avg_memory_percent > 85 ? 'text-red-600' : avg_memory_percent > 70 ? 'text-amber-600' : 'text-emerald-600'
            )}>
              {avg_memory_percent.toFixed(1)}%
            </span>
          </div>
          <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className={clsx(
                'h-full rounded-full transition-all duration-700 ease-out',
                avg_memory_percent > 85 ? 'bg-gradient-to-r from-red-500 to-red-600' : avg_memory_percent > 70 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-emerald-400 to-emerald-500'
              )}
              style={{ width: `${Math.min(100, avg_memory_percent)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Reliability Score */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Score de Fiabilité</p>
            <p className={clsx(
              'text-3xl font-bold mt-1',
              reliability_score > 90 ? 'text-emerald-600' : reliability_score > 70 ? 'text-amber-600' : 'text-red-600'
            )}>
              {reliability_score.toFixed(1)}%
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Incidents 24h</p>
            <p className={clsx(
              'text-2xl font-bold mt-1',
              incidents_24h === 0 ? 'text-emerald-600' : incidents_24h < 5 ? 'text-amber-600' : 'text-red-600'
            )}>
              {incidents_24h}
            </p>
          </div>
        </div>
      </div>

      {/* Namespace Breakdown */}
      <div>
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Par Namespace</h4>
        <div className="space-y-2">
          {namespace_breakdown?.map((ns) => (
            <div key={ns.namespace} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-brand-500" />
                <span className="text-sm font-medium text-slate-700">{ns.namespace}</span>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-slate-500 font-medium">{ns.pods} pods</span>
                <span className="text-emerald-600 font-semibold">CPU: {ns.cpu_avg}%</span>
                <span className="text-blue-600 font-semibold">RAM: {ns.memory_avg}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
