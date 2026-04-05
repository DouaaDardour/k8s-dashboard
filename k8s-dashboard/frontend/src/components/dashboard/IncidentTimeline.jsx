import { useRiskHistory } from '../../hooks/useQueries.js'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

const LEVEL_LINES = [
  { y: 76, label: 'CRITICAL', color: '#ef4444' },
  { y: 51, label: 'HIGH',     color: '#f97316' },
  { y: 26, label: 'MEDIUM',   color: '#eab308' },
]

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const score = payload[0]?.value ?? 0
  const level = score >= 76 ? 'CRITICAL' : score >= 51 ? 'HIGH' : score >= 26 ? 'MEDIUM' : 'LOW'
  const colors = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e' }

  return (
    <div className="bg-surface-card border border-surface-border rounded-lg px-3 py-2 text-xs font-mono shadow-xl">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="text-slate-100">{Math.round(score)} <span style={{ color: colors[level] }}>● {level}</span></p>
    </div>
  )
}

export default function IncidentTimeline() {
  const { data: history = [], isLoading } = useRiskHistory()

  const chartData = history.map(h => ({
    time: format(parseISO(h.computed_at), 'dd/MM HH:mm', { locale: fr }),
    score: Math.round(h.score),
    level: h.level,
  }))

  // Sous-échantillonner si trop de points
  const sampled = chartData.length > 200
    ? chartData.filter((_, i) => i % Math.ceil(chartData.length / 200) === 0)
    : chartData

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xs font-mono text-slate-400 uppercase tracking-widest">
          Évolution Risk Score
        </h2>
        <div className="flex items-center gap-3 text-[10px] font-mono">
          {LEVEL_LINES.map(l => (
            <span key={l.label} style={{ color: l.color }}>── {l.label}</span>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="h-48 bg-surface-border/20 rounded animate-pulse" />
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={sampled} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fill: '#475569', fontSize: 10, fontFamily: 'IBM Plex Mono' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: '#475569', fontSize: 10, fontFamily: 'IBM Plex Mono' }}
              tickLine={false}
              axisLine={false}
              ticks={[0, 25, 50, 75, 100]}
            />
            <Tooltip content={<CustomTooltip />} />
            {LEVEL_LINES.map(l => (
              <ReferenceLine key={l.label} y={l.y} stroke={l.color} strokeDasharray="4 4" strokeOpacity={0.5} />
            ))}
            <Area
              type="monotone"
              dataKey="score"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#scoreGrad)"
              dot={false}
              activeDot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
