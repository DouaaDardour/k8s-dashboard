import { useRiskScore } from '../../hooks/useQueries.js'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import clsx from 'clsx'

const LEVEL_CONFIG = {
  LOW:      { color: '#22c55e', bg: 'bg-green-900/20',  border: 'border-green-700/40',  label: 'LOW',      ring: '#22c55e' },
  MEDIUM:   { color: '#eab308', bg: 'bg-yellow-900/20', border: 'border-yellow-700/40', label: 'MEDIUM',   ring: '#eab308' },
  HIGH:     { color: '#f97316', bg: 'bg-orange-900/20', border: 'border-orange-700/40', label: 'HIGH',     ring: '#f97316' },
  CRITICAL: { color: '#ef4444', bg: 'bg-red-900/20',    border: 'border-red-700/40',    label: 'CRITICAL', ring: '#ef4444' },
}

function GaugeChart({ score, level }) {
  const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG.LOW
  const filled = Math.max(0, Math.min(100, score))
  const empty  = 100 - filled

  return (
    <div className="relative w-40 h-20 mx-auto">
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie
            data={[{ value: filled }, { value: empty }]}
            cx="50%"
            cy="100%"
            startAngle={180}
            endAngle={0}
            innerRadius={52}
            outerRadius={68}
            paddingAngle={0}
            dataKey="value"
            strokeWidth={0}
          >
            <Cell fill={cfg.color} />
            <Cell fill="#1e2535" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {/* Valeur centrale */}
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-1 pointer-events-none">
        <span className="text-3xl font-semibold font-mono" style={{ color: cfg.color }}>
          {Math.round(score)}
        </span>
      </div>
    </div>
  )
}

function ScoreBar({ label, value, color }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-500 font-mono">{label}</span>
        <span className="text-slate-300 font-mono">{Math.round(value)}</span>
      </div>
      <div className="h-1.5 bg-surface-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

export default function RiskScoreGauge() {
  const { data, isLoading, isError } = useRiskScore()

  if (isLoading) return (
    <div className="card animate-pulse">
      <div className="h-4 w-24 bg-surface-border rounded mb-6" />
      <div className="h-24 bg-surface-border rounded" />
    </div>
  )

  if (isError || !data) return (
    <div className="card flex items-center justify-center h-48 text-slate-600 text-sm">
      Données indisponibles
    </div>
  )

  const cfg = LEVEL_CONFIG[data.level] || LEVEL_CONFIG.LOW

  return (
    <div className={clsx('card border', cfg.border, cfg.bg, 'transition-all duration-500')}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-mono text-slate-400 uppercase tracking-widest">Risk Score</h2>
        <span className={clsx(
          'text-[10px] font-mono px-2 py-0.5 rounded border',
          cfg.border,
          'animate-pulse-slow'
        )} style={{ color: cfg.color }}>
          ● LIVE
        </span>
      </div>

      <GaugeChart score={data.score} level={data.level} />

      {/* Niveau */}
      <div className="text-center mt-2 mb-4">
        <span className="text-xs font-mono tracking-widest" style={{ color: cfg.color }}>
          {cfg.label}
        </span>
      </div>

      {/* Breakdown */}
      <div className="space-y-2.5 pt-4 border-t border-surface-border">
        <ScoreBar label="Sécurité   ×0.50" value={data.security_score}     color="#ef4444" />
        <ScoreBar label="Fiabilité  ×0.30" value={data.reliability_score}  color="#f97316" />
        <ScoreBar label="Fréquence  ×0.20" value={data.frequency_score}    color="#8b5cf6" />
      </div>

      {/* Timestamp */}
      <p className="text-[10px] text-slate-600 font-mono text-right mt-3">
        {new Date(data.computed_at).toLocaleTimeString('fr-FR')}
      </p>
    </div>
  )
}
