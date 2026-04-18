import { useIncidents } from '../../hooks/useQueries.js'
import clsx from 'clsx'

function IncidentRow({ incident }) {
  const isResolved = incident.status === 'resolved'
  const isRemediating = incident.status === 'remediating'

  return (
    <div className="grid grid-cols-12 gap-4 py-3.5 px-2 border-b border-slate-100 items-center hover:bg-slate-50 rounded-lg transition-colors">
      <div className="col-span-1 text-center font-mono text-xs text-slate-400">#{incident.id}</div>
      <div className="col-span-2">
        <span className={clsx(
          incident.severity === 'CRITICAL' ? 'badge-critical' :
          incident.severity === 'HIGH' ? 'badge-high' :
          incident.severity === 'MEDIUM' ? 'badge-medium' : 'badge-low'
        )}>
          {incident.severity}
        </span>
      </div>
      <div className="col-span-2 font-mono text-sm text-slate-800 font-medium truncate" title={incident.type}>
        {incident.type}
      </div>
      <div className="col-span-3 text-xs text-slate-500">
        <div className="truncate"><span className="text-slate-400">NS:</span> <span className="text-slate-700">{incident.namespace}</span></div>
        <div className="truncate"><span className="text-slate-400">POD:</span> <span className="text-slate-700">{incident.pod_name || 'N/A'}</span></div>
      </div>
      <div className="col-span-2 text-[11px] font-mono text-slate-500">
        {new Date(incident.detected_at).toLocaleString('fr-FR')}
      </div>
      <div className="col-span-2 flex justify-end pr-4">
        {isResolved ? (
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full flex items-center gap-1.5 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> RESOLVED
          </span>
        ) : isRemediating ? (
          <span className="text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full flex items-center gap-1.5 font-mono animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span> REMEDIATING
          </span>
        ) : (
          <span className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full flex items-center gap-1.5 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> OPEN
          </span>
        )}
      </div>
    </div>
  )
}

export default function IncidentsPage() {
  const { data, isLoading } = useIncidents({ page_size: 50 })
  const incidents = data?.items || []

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <span className="p-2 bg-brand-100 rounded-xl text-brand-600">🛡️</span>
            Registre des Incidents
          </h1>
          <p className="text-sm text-slate-500 mt-1">Historique complet des incidents détectés par le système ML</p>
        </div>
        <div className="text-sm font-medium text-slate-400 bg-slate-100 px-4 py-2 rounded-lg">
          Total : <span className="text-slate-700 font-bold">{data?.total || 0}</span> incidents
        </div>
      </div>

      <div className="card !p-3">
        {/* Header */}
        <div className="grid grid-cols-12 gap-4 py-3 px-2 border-b-2 border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50 rounded-t-lg">
          <div className="col-span-1 text-center">ID</div>
          <div className="col-span-2">Sévérité</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-3">Cible (NS/Pod)</div>
          <div className="col-span-2">Détection</div>
          <div className="col-span-2 text-right pr-4">Statut</div>
        </div>

        {/* Rows */}
        <div className="max-h-[70vh] overflow-y-auto mt-1">
          {isLoading ? (
            <div className="py-20 text-center text-slate-400 animate-pulse text-sm">Chargement du registre...</div>
          ) : incidents.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-sm">Aucun incident enregistré.</div>
          ) : (
            incidents.map(inc => <IncidentRow key={inc.id} incident={inc} />)
          )}
        </div>
      </div>
    </div>
  )
}
