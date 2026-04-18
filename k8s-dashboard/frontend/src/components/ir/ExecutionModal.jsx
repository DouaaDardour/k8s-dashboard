import { useState, useEffect } from 'react'
import clsx from 'clsx'

const PHASE_CONFIG = {
  IDENTIFY: { icon: '🔍', color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200',    label: 'Identification' },
  QUALIFY:  { icon: '📋', color: 'text-indigo-600',  bg: 'bg-indigo-50',  border: 'border-indigo-200',  label: 'Qualification' },
  CONTAIN:  { icon: '🛡️', color: 'text-orange-600',  bg: 'bg-orange-50',  border: 'border-orange-200',  label: 'Confinement' },
  EXTRACT:  { icon: '🎯', color: 'text-purple-600',  bg: 'bg-purple-50',  border: 'border-purple-200',  label: 'Extraction' },
  BLOCK:    { icon: '🚫', color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200',     label: 'Blocage' },
  AUDIT:    { icon: '📝', color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200',   label: 'Audit' },
  RESOLVE:  { icon: '✅', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Résolution' },
  ERROR:    { icon: '❌', color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200',     label: 'Erreur' },
}

const STATUS_STYLE = {
  success: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500', label: 'SUCCÈS' },
  warning: { bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-300',   dot: 'bg-amber-500',   label: 'ATTENTION' },
  skipped: { bg: 'bg-slate-100',   text: 'text-slate-500',   border: 'border-slate-300',   dot: 'bg-slate-400',   label: 'IGNORÉ' },
  error:   { bg: 'bg-red-100',     text: 'text-red-700',     border: 'border-red-300',     dot: 'bg-red-500',     label: 'ERREUR' },
}

/* ─── Carte d'une clé/valeur technique ─── */
function DetailTag({ label, value, highlight }) {
  return (
    <div className={clsx(
      "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] border",
      highlight ? "bg-red-50 border-red-200" : "bg-white border-slate-200"
    )}>
      <span className="text-slate-400 font-medium uppercase">{label}</span>
      <span className={clsx("font-mono font-bold", highlight ? "text-red-700" : "text-slate-700")}>{String(value)}</span>
    </div>
  )
}

/* ─── Carte d'étape ─── */
function StepCard({ step, index, visible }) {
  const cfg = PHASE_CONFIG[step.phase] || PHASE_CONFIG.IDENTIFY
  const statusCfg = STATUS_STYLE[step.status] || STATUS_STYLE.success
  const [showRaw, setShowRaw] = useState(false)

  // Sélectionner les détails les plus importants à afficher directement
  const details = step.details || {}
  const importantKeys = Object.keys(details).filter(k => !['metadata_keys'].includes(k))

  return (
    <div className={clsx(
      'transition-all duration-500 ease-out',
      visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6 pointer-events-none h-0 overflow-hidden'
    )}>
      <div className={clsx('border rounded-xl overflow-hidden mb-3', cfg.border)}>
        {/* Header avec numéro + phase */}
        <div className={clsx('px-4 py-3 flex items-center gap-3', cfg.bg)}>
          {/* Numéro */}
          <div className={clsx('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2', cfg.border, cfg.color)}>
            {index + 1}
          </div>
          {/* Icône + Phase */}
          <span className="text-lg">{cfg.icon}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={clsx('text-sm font-bold uppercase tracking-wide', cfg.color)}>{step.phase}</span>
              <span className="text-slate-400">—</span>
              <span className="text-sm text-slate-700 font-semibold">{step.title}</span>
            </div>
          </div>
          {/* Badge statut */}
          <div className={clsx('flex items-center gap-1.5 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border', statusCfg.bg, statusCfg.text, statusCfg.border)}>
            <span className={clsx('w-1.5 h-1.5 rounded-full', statusCfg.dot)} />
            {statusCfg.label}
          </div>
        </div>

        {/* Corps */}
        <div className="px-4 py-3 bg-white">
          {/* Message principal */}
          <p className="text-xs text-slate-600 mb-3 leading-relaxed">
            <span className="text-slate-400 mr-1">→</span>
            {step.message}
          </p>

          {/* Tags de détails importants */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {importantKeys.map(key => (
              <DetailTag
                key={key}
                label={key.replace(/_/g, ' ')}
                value={Array.isArray(details[key]) ? details[key].join(', ') : details[key]}
                highlight={['ip', 'source_ip', 'level'].includes(key)}
              />
            ))}
          </div>

          {/* Toggle JSON brut */}
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="text-[10px] text-brand-600 hover:text-brand-700 font-medium transition-colors flex items-center gap-1 mt-1"
          >
            <svg className={clsx('w-3 h-3 transition-transform duration-200', showRaw && 'rotate-90')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {showRaw ? 'Masquer le JSON brut' : 'Voir le JSON brut'}
          </button>

          {showRaw && (
            <pre className="mt-2 bg-slate-50 rounded-lg border border-slate-200 p-3 text-[10px] font-mono text-slate-600 overflow-x-auto animate-fade-in">
              {JSON.stringify(details, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}

/* ═══ MODAL PRINCIPAL ═══ */
export default function ExecutionModal({ steps, incident, onClose }) {
  const [visibleCount, setVisibleCount] = useState(0)
  const allDone = visibleCount >= steps.length

  // Animation séquentielle
  useEffect(() => {
    if (visibleCount < steps.length) {
      const timer = setTimeout(() => setVisibleCount(c => c + 1), 500)
      return () => clearTimeout(timer)
    }
  }, [visibleCount, steps.length])

  const successCount = steps.filter(s => s.status === 'success').length
  const warningCount = steps.filter(s => s.status === 'warning').length
  const errorCount = steps.filter(s => s.status === 'error').length
  const skippedCount = steps.filter(s => s.status === 'skipped').length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-elevated w-full max-w-2xl max-h-[90vh] flex flex-col animate-slide-in border border-slate-200"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────── */}
        <div className="px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                ⚡ Exécution du Playbook IR
                {!allDone && <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200 animate-pulse">EN COURS</span>}
                {allDone && <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">TERMINÉ</span>}
              </h2>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                <span>Incident <strong>#{incident?.id}</strong></span>
                <span className="text-slate-300">|</span>
                <span className="font-mono">{incident?.type?.replace(/_/g, ' ').toUpperCase()}</span>
                <span className="text-slate-300">|</span>
                <span>Score <strong>{incident?.score?.toFixed(1)}</strong></span>
                <span className="text-slate-300">|</span>
                <span>IP <strong className="text-red-600">{incident?.source_ip || 'Extraction…'}</strong></span>
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Progress bar ─────────────────────────────────── */}
        <div className="px-6 py-3 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              Progression : {visibleCount} / {steps.length} étapes
            </span>
            <div className="flex items-center gap-4 text-[11px] font-semibold">
              {successCount > 0 && <span className="text-emerald-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {successCount} succès
              </span>}
              {warningCount > 0 && <span className="text-amber-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> {warningCount} avert.
              </span>}
              {skippedCount > 0 && <span className="text-slate-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> {skippedCount} ignoré
              </span>}
              {errorCount > 0 && <span className="text-red-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> {errorCount} erreur
              </span>}
            </div>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full transition-all duration-700 ease-out',
                errorCount > 0 ? 'bg-gradient-to-r from-red-400 to-red-500' : 'bg-gradient-to-r from-emerald-400 to-emerald-500'
              )}
              style={{ width: `${(visibleCount / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* ── Steps ────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {steps.map((step, idx) => (
            <StepCard key={`${step.phase}-${idx}`} step={step} index={idx} visible={idx < visibleCount} />
          ))}

          {/* Spinner pendant le chargement */}
          {!allDone && (
            <div className="flex items-center gap-3 py-4 text-sm text-slate-400 animate-pulse">
              <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              Exécution de l'étape suivante…
            </div>
          )}
        </div>

        {/* ── Footer résultat final ────────────────────────── */}
        {allDone && (
          <div className="px-6 py-4 border-t border-slate-200 flex-shrink-0 animate-fade-in">
            <div className={clsx(
              'rounded-xl p-4 flex items-center gap-4',
              errorCount > 0 ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200'
            )}>
              <span className="text-3xl">{errorCount > 0 ? '❌' : '🎉'}</span>
              <div className="flex-1">
                <p className={clsx('text-sm font-bold', errorCount > 0 ? 'text-red-800' : 'text-emerald-800')}>
                  {errorCount > 0 ? 'Exécution terminée avec des erreurs' : 'Playbook exécuté avec succès !'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {steps.length} étapes • {successCount} succès • {warningCount} avert. • {skippedCount} ignoré
                </p>
              </div>
              <button onClick={onClose} className="btn-primary text-xs px-4 py-2">
                Fermer le rapport
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
