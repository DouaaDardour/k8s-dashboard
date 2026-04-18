import { useRiskScore } from '../../hooks/useQueries.js'
import clsx from 'clsx'

const LEVEL_CONFIG = {
  LOW:      { color: '#16a34a', bg: 'bg-emerald-50',  border: 'border-emerald-200',  label: 'LOW' },
  MEDIUM:   { color: '#d97706', bg: 'bg-amber-50',    border: 'border-amber-200',    label: 'MEDIUM' },
  HIGH:     { color: '#ea580c', bg: 'bg-orange-50',   border: 'border-orange-200',   label: 'HIGH' },
  CRITICAL: { color: '#dc2626', bg: 'bg-red-50',      border: 'border-red-200',      label: 'CRITICAL' },
}

function GaugeArc({ score, color, level }) {
  const pct = Math.max(0, Math.min(100, score))
  const radius = 70
  const stroke = 12
  const circumference = Math.PI * radius // half circle
  const offset = circumference * (1 - pct / 100)

  return (
    <div className="flex flex-col items-center">
      <svg width="200" height="110" viewBox="0 0 200 110">
        {/* Background arc */}
        <path
          d="M 15 100 A 85 85 0 0 1 185 100"
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {/* Filled arc */}
        <path
          d="M 15 100 A 85 85 0 0 1 185 100"
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
        {/* Score text */}
        <text x="100" y="85" textAnchor="middle" className="font-mono" style={{ fill: color, fontSize: '36px', fontWeight: 700 }}>
          {Math.round(score)}
        </text>
        <text x="100" y="103" textAnchor="middle" style={{ fill: '#94a3b8', fontSize: '11px' }}>
          / 100
        </text>
      </svg>

      {/* Badge niveau */}
      <span
        className="text-[11px] font-mono font-semibold tracking-[0.15em] uppercase px-3 py-1 rounded-full border -mt-1"
        style={{
          color: color,
          borderColor: color + '40',
          backgroundColor: color + '12',
        }}
      >
        {level}
      </span>
    </div>
  )
}

function ScoreBar({ label, value, color, weight }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="text-xs text-slate-600 font-medium">{label}</span>
          <span className="text-[10px] text-slate-400 font-mono">×{weight}</span>
        </div>
        <span className="text-xs text-slate-700 font-mono font-semibold tabular-nums w-6 text-right">
          {Math.round(value)}
        </span>
      </div>
      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${Math.max(value, 0)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

export default function RiskScoreGauge() {
  const { data, isLoading, isError } = useRiskScore()

  if (isLoading) return (
    <div className="card animate-pulse space-y-4">
      <div className="h-3 w-20 bg-slate-200 rounded" />
      <div className="h-24 bg-slate-100 rounded-lg" />
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => <div key={i} className="h-6 bg-slate-200 rounded" />)}
      </div>
    </div>
  )

  if (isError || !data) return (
    <div className="card flex items-center justify-center h-48 text-slate-400 text-sm">
      Données indisponibles
    </div>
  )

  const cfg = LEVEL_CONFIG[data.level] || LEVEL_CONFIG.LOW

  return (
    <div className={clsx('card border transition-all duration-500 flex flex-col gap-4', cfg.border, cfg.bg)}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Risk Score</h2>
        <span
          className="flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full border"
          style={{ color: cfg.color, borderColor: cfg.color + '50' }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: cfg.color }} />
          LIVE
        </span>
      </div>

      {/* ── Arc + Score + Badge (tout intégré dans le SVG) ── */}
      <GaugeArc score={data.score} color={cfg.color} level={cfg.label} />

      {/* ── Breakdown ──────────────────────────────────────── */}
      <div className="space-y-3 pt-4 border-t border-slate-200">
        <ScoreBar label="Sécurité"  value={data.security_score}    color="#ef4444" weight="0.50" />
        <ScoreBar label="Fiabilité" value={data.reliability_score} color="#f97316" weight="0.30" />
        <ScoreBar label="Fréquence" value={data.frequency_score}   color="#8b5cf6" weight="0.20" />
      </div>

      {/* ── Timestamp ──────────────────────────────────────── */}
      <p className="text-[10px] text-slate-400 font-mono text-right -mt-1">
        {new Date(data.computed_at).toLocaleTimeString('fr-FR')}
      </p>

    </div>
  )
}
