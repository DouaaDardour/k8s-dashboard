import { useDashboardSummary, useCancelIncident } from '../../hooks/useQueries.js'
import IRTimer from './IRTimer.jsx'
import clsx from 'clsx'

const PLAYBOOK_CONFIG = {
  restart_pod:      { label: 'Redémarrage pod',    icon: '🔄', color: 'text-blue-400',   delay: 'Immédiat' },
  patch_memory:     { label: 'Patch mémoire +25%', icon: '💾', color: 'text-purple-400', delay: 'Immédiat' },
  scale_out:        { label: 'Scale-out HPA',       icon: '📈', color: 'text-blue-400',   delay: 'Immédiat' },
  block_ip:         { label: 'Blocage IP (NetworkPolicy)', icon: '🔒', color: 'text-orange-400', delay: '2 min' },
  rate_limit_pod:   { label: 'Rate limiting renforcé',     icon: '⚡', color: 'text-yellow-400', delay: '2 min' },
  revoke_token:     { label: 'Révocation token JWT',       icon: '🚫', color: 'text-red-400',    delay: '2 min' },
  rollback_deploy:  { label: 'Rollback déploiement',       icon: '⏪', color: 'text-orange-400', delay: '2 min' },
  rollback_escalate:{ label: 'Rollback + Escalade',        icon: '🚨', color: 'text-red-400',    delay: '5 min' },
  alert_only:       { label: 'Alerte uniquement',          icon: '📢', color: 'text-slate-400',  delay: '—' },
}

function PendingActionRow({ action, onCancelled }) {
  const cancel = useCancelIncident()

  const playbook = PLAYBOOK_CONFIG[action.playbook] || PLAYBOOK_CONFIG[action.incident_type] || {
    label: action.playbook, icon: '⚙️', color: 'text-slate-400', delay: '—'
  }

  const handleCancel = async () => {
    await cancel.mutateAsync(action.incident_id)
    onCancelled?.()
  }

  return (
    <div className="flex items-center gap-3 py-3 border-b border-surface-border last:border-0">
      {/* Timer arc */}
      <IRTimer
        secondsRemaining={action.seconds_remaining}
        onExpire={() => {}}
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm">{playbook.icon}</span>
          <span className={clsx('text-xs font-mono font-medium', playbook.color)}>
            {playbook.label}
          </span>
        </div>
        <p className="text-[10px] font-mono text-slate-600 truncate">
          #{action.incident_id} · {action.incident_type} · {action.namespace}
          {action.pod_name ? ` / ${action.pod_name}` : ''}
        </p>
      </div>

      {/* Bouton annuler */}
      {action.seconds_remaining > 0 && (
        <button
          onClick={handleCancel}
          disabled={cancel.isPending}
          className="flex-shrink-0 text-[10px] font-mono px-3 py-1.5 rounded-lg border border-red-700/40 text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-40"
        >
          {cancel.isPending ? '…' : 'Annuler'}
        </button>
      )}

      {action.seconds_remaining === 0 && (
        <span className="text-[10px] font-mono text-green-400 flex-shrink-0">✓ Exécuté</span>
      )}
    </div>
  )
}

export default function IRLivePanel() {
  const { data, refetch } = useDashboardSummary()
  const pending = data?.pending_ir_actions ?? []

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-mono text-slate-400 uppercase tracking-widest">
            IR Live Panel
          </h2>
          {pending.length > 0 && (
            <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
          )}
        </div>
        <span className="text-xs font-mono text-slate-600">
          {pending.length} action{pending.length !== 1 ? 's' : ''} en attente
        </span>
      </div>

      {/* Circuit breaker info */}
      <div className="bg-surface rounded-lg px-3 py-2 mb-4 flex items-center gap-2 border border-surface-border">
        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span className="text-[10px] font-mono text-slate-500">
          Circuit breaker actif · 3 échecs → mode manuel automatique
        </span>
        <span className="ml-auto text-[10px] font-mono text-green-400">● CLOSED</span>
      </div>

      {/* Liste actions */}
      {pending.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-2xl mb-2">✅</div>
          <p className="text-xs font-mono text-slate-600">Aucune action IR en attente</p>
          <p className="text-[10px] text-slate-700 mt-1">Le cluster est stable</p>
        </div>
      ) : (
        <div>
          {pending.map((action) => (
            <PendingActionRow
              key={`${action.incident_id}-${action.celery_task_id}`}
              action={action}
              onCancelled={refetch}
            />
          ))}
        </div>
      )}

      {/* Légende délais */}
      <div className="mt-4 pt-3 border-t border-surface-border grid grid-cols-3 gap-2">
        {[
          { label: 'Immédiat', desc: 'CrashLoop, OOM, Saturation', color: 'text-blue-400' },
          { label: '2 minutes', desc: 'SQLi, XSS, Brute-force', color: 'text-orange-400' },
          { label: '5 minutes', desc: 'Rollback, CRITICAL', color: 'text-red-400' },
        ].map(item => (
          <div key={item.label} className="text-center">
            <p className={clsx('text-[10px] font-mono font-medium', item.color)}>{item.label}</p>
            <p className="text-[9px] text-slate-700 leading-tight mt-0.5">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
