import { useState } from 'react'
import { useIncidents, useCancelIncident, useResolveIncident } from '../../hooks/useQueries.js'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import clsx from 'clsx'

const SEV_BADGE = {
  CRITICAL: 'badge-critical',
  HIGH:     'badge-high',
  MEDIUM:   'badge-medium',
  LOW:      'badge-low',
}

const STATUS_LABEL = {
  open:          { label: 'Ouvert',    color: 'text-blue-400' },
  auto_pending:  { label: 'IR en att.', color: 'text-orange-400 animate-pulse' },
  remediating:   { label: 'En cours',  color: 'text-yellow-400' },
  resolved:      { label: 'Résolu',    color: 'text-green-400' },
  cancelled:     { label: 'Annulé',    color: 'text-slate-500' },
}

const TYPE_ICONS = {
  crash_loop:           '🔄',
  oom_killed:           '💾',
  sql_injection:        '💉',
  xss:                  '⚡',
  brute_force:          '🔒',
  unauthorized_access:  '🚫',
  http_5xx:             '🌐',
  resource_saturation:  '📈',
  anomaly_detected:     '🔍',
}

function IncidentRow({ incident, onSelect }) {
  const cancel  = useCancelIncident()
  const resolve = useResolveIncident()

  const ago = formatDistanceToNow(parseISO(incident.detected_at), { locale: fr, addSuffix: true })
  const status = STATUS_LABEL[incident.status] || { label: incident.status, color: 'text-slate-400' }

  return (
    <tr
      className="border-b border-surface-border hover:bg-surface-hover transition-colors cursor-pointer group"
      onClick={() => onSelect(incident)}
    >
      {/* Type */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-base" title={incident.type}>
            {TYPE_ICONS[incident.type] ?? '⚠️'}
          </span>
          <span className="text-xs font-mono text-slate-300">{incident.type}</span>
        </div>
      </td>

      {/* Sévérité */}
      <td className="px-4 py-3">
        <span className={SEV_BADGE[incident.severity] || 'badge-low'}>
          {incident.severity}
        </span>
      </td>

      {/* Score */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-14 h-1.5 bg-surface-border rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${incident.score}%`,
                backgroundColor:
                  incident.score >= 76 ? '#ef4444' :
                  incident.score >= 51 ? '#f97316' :
                  incident.score >= 26 ? '#eab308' : '#22c55e',
              }}
            />
          </div>
          <span className="text-xs font-mono text-slate-400">{Math.round(incident.score)}</span>
        </div>
      </td>

      {/* Namespace / Pod */}
      <td className="px-4 py-3">
        <p className="text-xs font-mono text-slate-300">{incident.namespace}</p>
        {incident.pod_name && (
          <p className="text-[10px] font-mono text-slate-600 truncate max-w-[120px]">{incident.pod_name}</p>
        )}
      </td>

      {/* Statut */}
      <td className="px-4 py-3">
        <span className={clsx('text-xs font-mono', status.color)}>{status.label}</span>
      </td>

      {/* Détecté */}
      <td className="px-4 py-3 text-xs font-mono text-slate-500">{ago}</td>

      {/* Actions */}
      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {incident.status === 'auto_pending' && (
            <button
              onClick={() => cancel.mutate(incident.id)}
              disabled={cancel.isPending}
              className="btn-danger text-[10px] py-1 px-2 disabled:opacity-50"
            >
              Annuler
            </button>
          )}
          {['open', 'remediating'].includes(incident.status) && (
            <button
              onClick={() => resolve.mutate(incident.id)}
              disabled={resolve.isPending}
              className="btn-ghost text-[10px] py-1 px-2"
            >
              Résoudre
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

function IncidentDetail({ incident, onClose }) {
  const { data: timeline = [] } = useIncidents()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
         onClick={onClose}>
      <div className="card w-full max-w-xl max-h-[80vh] overflow-y-auto animate-slide-in"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{TYPE_ICONS[incident.type] ?? '⚠️'}</span>
              <h3 className="font-mono font-medium text-slate-100">{incident.type}</h3>
              <span className={SEV_BADGE[incident.severity]}>{incident.severity}</span>
            </div>
            <p className="text-xs font-mono text-slate-500">
              #{incident.id} · {incident.namespace} / {incident.pod_name}
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Score breakdown */}
        <div className="bg-surface rounded-lg p-3 mb-4 space-y-1">
          <p className="text-xs font-mono text-slate-500 mb-2">Score : <span className="text-slate-200">{Math.round(incident.score)}</span></p>
          <p className="text-xs font-mono text-slate-500">Statut : <span className={clsx(STATUS_LABEL[incident.status]?.color)}>{STATUS_LABEL[incident.status]?.label}</span></p>
          <p className="text-xs font-mono text-slate-500">Catégorie : <span className="text-slate-300">{incident.category}</span></p>
        </div>

        {/* Metadata */}
        {incident.metadata_ && (
          <div className="mb-4">
            <p className="text-xs font-mono text-slate-500 mb-2 uppercase tracking-wider">Metadata ML</p>
            <pre className="bg-surface rounded-lg p-3 text-[10px] font-mono text-slate-400 overflow-x-auto">
              {JSON.stringify(incident.metadata_, null, 2)}
            </pre>
          </div>
        )}

        <button onClick={onClose} className="btn-ghost w-full text-center text-xs mt-2">Fermer</button>
      </div>
    </div>
  )
}

export default function IncidentTable() {
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const { data, isLoading } = useIncidents({ page, page_size: 10 })

  const incidents = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / 10)

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-mono text-slate-400 uppercase tracking-widest">
          Incidents récents
        </h2>
        <span className="text-xs font-mono text-slate-600">{total} total</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-surface-border/30 rounded animate-pulse" />
          ))}
        </div>
      ) : incidents.length === 0 ? (
        <div className="text-center py-10 text-slate-600 text-sm font-mono">
          Aucun incident trouvé
        </div>
      ) : (
        <>
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border">
                  {['Type', 'Sévérité', 'Score', 'Namespace / Pod', 'Statut', 'Détecté', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-mono text-slate-600 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {incidents.map(inc => (
                  <IncidentRow key={inc.id} incident={inc} onSelect={setSelected} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-surface-border">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-ghost text-xs disabled:opacity-30"
              >
                ← Précédent
              </button>
              <span className="text-xs font-mono text-slate-500">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-ghost text-xs disabled:opacity-30"
              >
                Suivant →
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal détail */}
      {selected && <IncidentDetail incident={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
