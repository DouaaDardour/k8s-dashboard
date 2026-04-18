import { useQuery } from '@tanstack/react-query'
import SystemMetrics from './SystemMetrics'
import ClusterHealth from './ClusterHealth'
import PodMetricsTable from './PodMetricsTable'
import ReliabilityMetrics from './ReliabilityMetrics'
import MetricsHistory from './MetricsHistory'
import { api } from '../../api/client.js'

export default function MonitoringPage() {
  const { data: systemMetrics, isLoading: loadingSystem, refetch: refetchSystem } = useQuery({
    queryKey: ['monitoring', 'system'],
    queryFn: api.getSystemMetrics,
    refetchInterval: 30000,
    staleTime: 15000,
  })

  const { data: clusterHealth, isLoading: loadingHealth } = useQuery({
    queryKey: ['monitoring', 'clusterHealth'],
    queryFn: api.getClusterHealth,
    refetchInterval: 30000,
    staleTime: 15000,
  })

  const { data: reliability, isLoading: loadingReliability } = useQuery({
    queryKey: ['monitoring', 'reliability'],
    queryFn: api.getClusterReliability,
    refetchInterval: 60000,
    staleTime: 30000,
  })

  const { data: podMetrics, isLoading: loadingPods } = useQuery({
    queryKey: ['monitoring', 'podMetrics'],
    queryFn: api.getPodMetrics,
    refetchInterval: 30000,
    staleTime: 15000,
  })

  const { data: history, isLoading: loadingHistory } = useQuery({
    queryKey: ['monitoring', 'history', 24],
    queryFn: () => api.getMetricsHistory(24),
    refetchInterval: 60000,
    staleTime: 30000,
  })

  const isLoading = loadingSystem || loadingHealth || loadingReliability || loadingPods || loadingHistory

  const handleRefresh = () => {
    refetchSystem()
    window.location.reload()
  }

  if (isLoading && !systemMetrics) {
    return (
      <div className="flex items-center justify-center h-96 bg-white rounded-xl">
        <div className="flex items-center gap-3 text-slate-500">
          <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="font-medium">Chargement des métriques...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Monitoring & Performance</h1>
          <p className="text-slate-500 mt-1">
            Suivi des ressources système, fiabilité et performances du cluster
          </p>
        </div>
        <div className="flex items-center gap-4">
          {systemMetrics?.timestamp && (
            <span className="text-xs text-slate-500 font-mono bg-slate-100 px-3 py-1.5 rounded-lg">
              Mis à jour: {new Date(systemMetrics.timestamp).toLocaleTimeString('fr-FR')}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 disabled:bg-slate-300 text-white rounded-lg transition-colors text-sm font-semibold shadow-sm"
          >
            <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Rafraîchir
          </button>
        </div>
      </div>

      {/* System Metrics (CPU, RAM, GPU, Disk) */}
      {systemMetrics && <SystemMetrics data={systemMetrics} />}

      {/* Cluster Health & Reliability Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {clusterHealth && <ClusterHealth data={clusterHealth} />}
        {reliability && <ReliabilityMetrics data={reliability} />}
      </div>

      {/* Pod Metrics Table */}
      {podMetrics && <PodMetricsTable data={podMetrics} />}

      {/* Metrics History Chart */}
      {history && <MetricsHistory data={history} />}
    </div>
  )
}
