import { useState } from 'react'
import { useDiagnostic } from '../../hooks/useQueries.js'
import clsx from 'clsx'

const SECTION_ICONS = {
  '🚫': { bg: 'bg-red-50', border: 'border-red-200' },
  '📝': { bg: 'bg-amber-50', border: 'border-amber-200' },
  '🗄️': { bg: 'bg-blue-50', border: 'border-blue-200' },
  '⚙️': { bg: 'bg-indigo-50', border: 'border-indigo-200' },
  '📊': { bg: 'bg-purple-50', border: 'border-purple-200' },
}

function ItemCard({ item, index }) {
  const [open, setOpen] = useState(false)
  const isActive = item.is_active !== false
  const hasIP = !!item.ip

  return (
    <div className={clsx(
      'border rounded-lg p-3 transition-all',
      isActive ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60'
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => setOpen(!open)}>
        <span className="text-xs text-slate-400 font-mono w-5">#{index + 1}</span>
        {hasIP && <span className="font-mono text-sm font-bold text-red-600">{item.ip}</span>}
        {item.playbook && <span className="font-mono text-sm font-semibold text-indigo-700">{item.playbook}</span>}
        {item.type && <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{item.type}</span>}
        {item.level && (
          <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full',
            item.level?.includes('BLACKLIST') ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
          )}>{item.level}</span>
        )}
        {item.status && (
          <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full',
            item.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' :
            item.status === 'open' ? 'bg-red-100 text-red-700' :
            'bg-amber-100 text-amber-700'
          )}>{item.status}</span>
        )}
        {item.result && (
          <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full',
            item.result === 'executed' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
          )}>{item.result}</span>
        )}
        <span className="ml-auto text-[10px] text-slate-400">
          <svg className={clsx('w-3 h-3 transition-transform', open && 'rotate-90')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>

      {/* Proof line */}
      {item.proof && (
        <p className="text-[10px] text-emerald-600 mt-1.5 ml-5 font-medium">{item.proof}</p>
      )}

      {/* Expanded details */}
      {open && (
        <div className="mt-3 ml-5 border-t border-slate-100 pt-2 animate-fade-in">
          {Object.entries(item).filter(([k]) => !['proof'].includes(k)).map(([key, value]) => (
            <div key={key} className="flex items-start gap-2 py-0.5">
              <span className="text-[10px] text-slate-400 font-mono w-36 flex-shrink-0">{key}</span>
              <span className={clsx('text-[10px] font-mono break-all',
                key === 'ip' || key === 'source_ip' ? 'text-red-600 font-bold' :
                key === 'is_active' ? (value ? 'text-emerald-600 font-bold' : 'text-slate-400') :
                'text-slate-700'
              )}>
                {value === null ? 'null' : value === true ? '✅ true' : value === false ? '❌ false' : String(value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DiagnosticSection({ section }) {
  const [expanded, setExpanded] = useState(true)
  const icon = section.title?.substring(0, 2) || '📋'
  const style = SECTION_ICONS[icon] || { bg: 'bg-slate-50', border: 'border-slate-200' }

  return (
    <div className={clsx('rounded-xl border overflow-hidden', style.border)}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={clsx('w-full px-5 py-4 flex items-center gap-3 text-left', style.bg)}
      >
        <h3 className="text-sm font-bold text-slate-800 flex-1">{section.title}</h3>
        <span className="text-xs font-bold text-brand-700 bg-brand-100 px-2.5 py-1 rounded-full">
          {section.count} élément{section.count !== 1 ? 's' : ''}
        </span>
        <svg className={clsx('w-4 h-4 text-slate-400 transition-transform', expanded && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 pb-4 bg-white">
          <p className="text-xs text-slate-500 mb-3 mt-2">{section.description}</p>
          {section.retention && (
            <p className="text-[10px] text-slate-400 mb-2">Rétention : {section.retention}</p>
          )}
          <div className="space-y-2">
            {(section.items || []).length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Aucun élément</p>
            ) : (
              section.items.map((item, idx) => (
                <ItemCard key={idx} item={item} index={idx} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function DiagnosticPage() {
  const { data, isLoading, refetch, isFetching } = useDiagnostic()

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <span className="p-2 bg-brand-100 rounded-xl text-brand-600">🔬</span>
            Diagnostic & Vérification
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Vérification en temps réel que toutes les mesures IR sont réellement exécutées dans Redis & PostgreSQL
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="btn-primary text-xs px-4 py-2 flex items-center gap-2"
        >
          {isFetching ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          Actualiser
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : data?.error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 font-semibold">Erreur : {data.error}</p>
        </div>
      ) : (
        <>
          {/* Résumé */}
          {data?.summary && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
              <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                📊 Résumé du Diagnostic
                <span className="text-[10px] text-slate-400 font-normal">{new Date(data.timestamp).toLocaleString('fr-FR')}</span>
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: 'IPs bloquées', value: data.summary.ips_currently_blocked, color: 'text-red-700' },
                  { label: 'IPs historiques', value: data.summary.ips_ever_blocked, color: 'text-orange-700' },
                  { label: 'Audits aujourd\'hui', value: data.summary.audit_entries_today, color: 'text-amber-700' },
                  { label: 'Incidents total', value: data.summary.incidents_total, color: 'text-blue-700' },
                  { label: 'Incidents résolus', value: data.summary.incidents_resolved, color: 'text-emerald-700' },
                  { label: 'Actions IR', value: data.summary.ir_actions_executed, color: 'text-indigo-700' },
                ].map(s => (
                  <div key={s.label} className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                    <p className={clsx('text-2xl font-bold font-mono', s.color)}>{s.value}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                  ✅ {data.summary.verdict}
                </p>
              </div>
            </div>
          )}

          {/* Sections */}
          <div className="space-y-4">
            {(data?.sections || []).map((section, idx) => (
              <DiagnosticSection key={idx} section={section} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
