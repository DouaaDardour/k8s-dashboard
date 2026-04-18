import { useState } from 'react'
import { useBlockedIps, useAuditTrail, useUnblockIp, usePendingIncidents, useTriggerIR } from '../../hooks/useQueries.js'
import ExecutionModal from './ExecutionModal.jsx'
import clsx from 'clsx'

/* ─── Carte d'un incident actif ─── */
function ActiveThreatCard({ incident, onExecutionResult }) {
  const triggerIR = useTriggerIR()

  const elapsed = incident.detected_at
    ? Math.floor((Date.now() - new Date(incident.detected_at).getTime()) / 1000)
    : 0

  const severityStyle = {
    critical: 'border-red-300 bg-red-50',
    high:     'border-orange-300 bg-orange-50',
    medium:   'border-amber-300 bg-amber-50',
    low:      'border-emerald-300 bg-emerald-50',
  }[incident.severity] || 'border-red-300 bg-red-50'

  const handleExecute = async () => {
    try {
      const result = await triggerIR.mutateAsync(incident.id)
      if (result?.steps) {
        onExecutionResult({ steps: result.steps, incident })
      }
    } catch (err) {
      console.error('Erreur IR:', err)
    }
  }

  return (
    <div className={clsx("rounded-xl border-2 p-5 flex flex-col gap-3 animate-slide-in", severityStyle)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-red-600 text-lg">⚡</span>
          <span className="font-mono text-slate-800 font-bold uppercase text-sm">
            {incident.type.replace(/_/g, ' ')}
          </span>
        </div>
        <span className={clsx(
          "text-[10px] font-mono font-bold px-2.5 py-1 rounded-full",
          incident.severity === 'critical' ? 'bg-red-100 text-red-700' :
          incident.severity === 'high' ? 'bg-orange-100 text-orange-700' :
          'bg-amber-100 text-amber-700'
        )}>
          {incident.severity?.toUpperCase()}
        </span>
      </div>

      <div className="text-sm text-slate-600 space-y-1.5">
        <p>
          <span className="text-slate-400 w-20 inline-block font-medium">IP Source</span>
          <span className="font-mono text-red-600 font-semibold">{incident.source_ip || 'Inconnue'}</span>
        </p>
        <p>
          <span className="text-slate-400 w-20 inline-block font-medium">Cible</span>
          <span className="font-mono text-slate-700">{incident.namespace}/{incident.pod_name || '?'}</span>
        </p>
        <p>
          <span className="text-slate-400 w-20 inline-block font-medium">Score ML</span>
          <span className="font-mono text-slate-800 font-bold">{incident.score?.toFixed(1)}/100</span>
        </p>
        <p>
          <span className="text-slate-400 w-20 inline-block font-medium">Détecté</span>
          <span className="font-mono text-slate-600">il y a {elapsed}s</span>
        </p>
      </div>

      <div className="mt-2 pt-3 border-t border-red-200">
        <button
          onClick={handleExecute}
          disabled={triggerIR.isPending}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-mono uppercase text-xs font-bold py-3 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.98]"
        >
          {triggerIR.isPending ? '⏳ Exécution en cours...' : '🛑 EXECUTE NOW'}
        </button>
      </div>
    </div>
  )
}

/* ─── Carte IP bloquée ─── */
function BlockedIpCard({ data }) {
  const unblock = useUnblockIp()
  const [reason, setReason] = useState('')
  const [showUnblock, setShowUnblock] = useState(false)

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3 shadow-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500"></span>
          <span className="font-mono text-slate-800 font-semibold text-sm">{data.ip}</span>
        </div>
        <span className={clsx(
          "text-[10px] font-mono font-bold px-2 py-0.5 rounded-full",
          data.level.includes("BLACKLIST") ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
        )}>
          {data.level}
        </span>
      </div>

      <div className="text-xs text-slate-500 space-y-1">
        <p><span className="text-slate-400 w-24 inline-block">Attaque :</span> <span className="font-mono text-slate-700">{data.attack_type}</span></p>
        <p><span className="text-slate-400 w-24 inline-block">Namespace :</span> <span className="font-mono text-slate-700">{data.namespace}</span></p>
        <p><span className="text-slate-400 w-24 inline-block">Bloqué le :</span> <span className="font-mono text-slate-700">{new Date(data.blocked_at).toLocaleString('fr-FR')}</span></p>
        <p><span className="text-slate-400 w-24 inline-block">Infractions :</span> <strong className="text-slate-800">{data.infraction_count}</strong></p>
      </div>

      <div className="mt-2 pt-3 border-t border-slate-100">
        {!showUnblock ? (
          <button onClick={() => setShowUnblock(true)} className="text-xs text-brand-600 hover:text-brand-700 font-medium transition-colors bg-brand-50 px-3 py-2 rounded-lg w-full border border-brand-200 hover:border-brand-300">
            Débloquer manuellement
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <input type="text" placeholder="Raison du déblocage..." value={reason} onChange={(e) => setReason(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700" />
            <div className="flex gap-2">
              <button onClick={() => setShowUnblock(false)} className="px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-500 w-1/3">Annuler</button>
              <button onClick={() => { if (reason.trim()) unblock.mutate({ ip: data.ip, reason }) }}
                disabled={unblock.isPending || !reason.trim()}
                className="px-3 py-2 text-xs rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 w-2/3 font-medium">
                {unblock.isPending ? 'Patientez...' : 'Confirmer'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Entrée d'audit ─── */
function AuditEntry({ entry }) {
  const resultColors = {
    executed: "text-emerald-700 bg-emerald-50 border-emerald-200",
    simulated: "text-blue-700 bg-blue-50 border-blue-200",
    failed: "text-red-700 bg-red-50 border-red-200",
    skipped: "text-amber-700 bg-amber-50 border-amber-200",
  }
  const resultStyle = resultColors[entry.result] || resultColors.executed

  return (
    <div className="flex gap-4 py-3 border-b border-slate-100 last:border-0">
      <div className="w-20 flex-shrink-0 text-[10px] text-slate-400 font-mono mt-1">
        {new Date(entry.ts).toLocaleTimeString('fr-FR')}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono font-semibold text-slate-700">{entry.playbook}</span>
          <span className={clsx("text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border uppercase", resultStyle)}>
            {entry.result}
          </span>
          {entry.incident_id > 0 && (
            <span className="text-[10px] text-slate-400 font-mono">#{entry.incident_id}</span>
          )}
        </div>
        <p className="text-xs text-slate-500">{entry.message}</p>
      </div>
    </div>
  )
}

/* ═══ PAGE PRINCIPALE ═══ */
export default function IRPage() {
  const { data: blockedIps, isLoading: loadingIps } = useBlockedIps()
  const { data: auditTrail, isLoading: loadingAudit } = useAuditTrail()
  const { data: pendingIncidents, isLoading: loadingPending } = usePendingIncidents()
  const [executionData, setExecutionData] = useState(null)

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <span className="p-2 bg-brand-100 rounded-xl text-brand-600">🚨</span>
            Incident Response
          </h1>
          <p className="text-sm text-slate-500 mt-1">Panneau de contrôle SOC — Détection et réponse aux menaces</p>
        </div>
        {pendingIncidents?.length > 0 && (
          <span className="text-xs font-semibold bg-red-100 text-red-700 px-4 py-2 rounded-full border border-red-200 flex items-center gap-2 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            {pendingIncidents.length} menace(s) active(s)
          </span>
        )}
      </div>

      {/* Section 1 : Menaces Actives */}
      <div>
        <h2 className="section-title border-b border-slate-200 pb-2 mb-4">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
          Action Radar — Menaces en attente
        </h2>

        {loadingPending ? (
          <div className="card h-32 flex items-center justify-center text-slate-400 animate-pulse text-sm">Scan en cours...</div>
        ) : !pendingIncidents || pendingIncidents.length === 0 ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center">
            <div className="text-3xl mb-3">✅</div>
            <p className="text-sm font-semibold text-emerald-800">Aucune menace active</p>
            <p className="text-xs mt-1 text-emerald-600">Tous les incidents sont traités. Le système est nominal.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingIncidents.map(inc => (
              <ActiveThreatCard key={inc.id} incident={inc} onExecutionResult={setExecutionData} />
            ))}
          </div>
        )}
      </div>

      {/* Section 2 : IPs Bloquées + Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="section-title border-b border-slate-200 pb-2">
            IPs Bloquées ({blockedIps ? blockedIps.length : 0})
          </h2>
          <div className="flex flex-col gap-4">
            {loadingIps ? (
              <div className="card h-32 flex items-center justify-center text-slate-400 animate-pulse text-sm">Chargement...</div>
            ) : blockedIps?.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
                <div className="text-3xl mb-3 opacity-40">🛡️</div>
                <p className="text-sm font-medium text-slate-600">Aucune IP bloquée</p>
              </div>
            ) : (
              blockedIps?.map(ipData => <BlockedIpCard key={ipData.ip} data={ipData} />)
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="section-title border-b border-slate-200 pb-2">Journal d'Audit</h2>
          <div className="card">
            {loadingAudit ? (
              <div className="h-64 flex items-center justify-center text-slate-400 animate-pulse text-sm">Chargement...</div>
            ) : auditTrail?.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Aucun log d'audit</div>
            ) : (
              <div className="max-h-[600px] overflow-y-auto pr-2">
                {auditTrail?.map((entry, idx) => (
                  <AuditEntry key={`${entry.ts}-${idx}`} entry={entry} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal d'exécution live */}
      {executionData && (
        <ExecutionModal
          steps={executionData.steps}
          incident={executionData.incident}
          onClose={() => setExecutionData(null)}
        />
      )}
    </div>
  )
}
