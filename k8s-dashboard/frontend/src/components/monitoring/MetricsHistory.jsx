import { useState } from 'react'
import clsx from 'clsx'

export default function MetricsHistory({ data }) {
  const [selectedMetric, setSelectedMetric] = useState('cpu_percent')
  const { metrics, period_hours } = data

  const metricLabels = {
    cpu_percent: 'CPU (%)',
    memory_percent: 'Mémoire (%)',
    disk_percent: 'Disque (%)',
    network_mbps: 'Réseau (MB/s)',
  }

  const metricColors = {
    cpu_percent: 'text-blue-400',
    memory_percent: 'text-emerald-400',
    disk_percent: 'text-purple-400',
    network_mbps: 'text-cyan-400',
  }

  const metricBgColors = {
    cpu_percent: 'bg-blue-500',
    memory_percent: 'bg-emerald-500',
    disk_percent: 'bg-purple-500',
    network_mbps: 'bg-cyan-500',
  }

  // Calculate stats
  const values = metrics.map(m => m[selectedMetric])
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  const max = Math.max(...values)
  const min = Math.min(...values)
  const current = values[values.length - 1]

  // Create SVG path for chart
  const chartHeight = 150
  const chartWidth = 800
  const padding = { top: 10, right: 10, bottom: 20, left: 40 }
  
  const innerWidth = chartWidth - padding.left - padding.right
  const innerHeight = chartHeight - padding.top - padding.bottom
  
  const yScale = (value) => {
    const range = max - min || 1
    return innerHeight - ((value - min) / range) * innerHeight + padding.top
  }
  
  const xScale = (index) => {
    return (index / (metrics.length - 1)) * innerWidth + padding.left
  }

  // Generate path
  const pathData = metrics.map((m, i) => {
    const x = xScale(i)
    const y = yScale(m[selectedMetric])
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
  }).join(' ')

  // Generate area path
  const areaPath = `${pathData} L ${xScale(metrics.length - 1)} ${chartHeight - padding.bottom} L ${padding.left} ${chartHeight - padding.bottom} Z`

  return (
    <div className="bg-surface border border-slate-800 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Historique des Métriques</h3>
            <p className="text-slate-400 text-sm">{period_hours} dernières heures</p>
          </div>
        </div>

        {/* Metric Selector */}
        <div className="flex gap-2">
          {Object.entries(metricLabels).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSelectedMetric(key)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                selectedMetric === key 
                  ? 'bg-brand-600 text-white' 
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800/30 rounded-lg p-3">
          <p className="text-xs text-slate-500">Actuel</p>
          <p className={clsx('text-xl font-bold', metricColors[selectedMetric])}>
            {current.toFixed(1)}{selectedMetric.includes('percent') ? '%' : ''}
          </p>
        </div>
        <div className="bg-slate-800/30 rounded-lg p-3">
          <p className="text-xs text-slate-500">Moyenne</p>
          <p className="text-xl font-bold text-white">
            {avg.toFixed(1)}{selectedMetric.includes('percent') ? '%' : ''}
          </p>
        </div>
        <div className="bg-slate-800/30 rounded-lg p-3">
          <p className="text-xs text-slate-500">Max</p>
          <p className="text-xl font-bold text-emerald-400">
            {max.toFixed(1)}{selectedMetric.includes('percent') ? '%' : ''}
          </p>
        </div>
        <div className="bg-slate-800/30 rounded-lg p-3">
          <p className="text-xs text-slate-500">Min</p>
          <p className="text-xl font-bold text-blue-400">
            {min.toFixed(1)}{selectedMetric.includes('percent') ? '%' : ''}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        <svg 
          viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
          className="w-full h-48"
          preserveAspectRatio="none"
        >
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((percent) => (
            <line
              key={percent}
              x1={padding.left}
              y1={padding.top + (innerHeight * percent) / 100}
              x2={chartWidth - padding.right}
              y2={padding.top + (innerHeight * percent) / 100}
              stroke="#334155"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
          ))}

          {/* Area under curve */}
          <path
            d={areaPath}
            fill={metricBgColors[selectedMetric]}
            fillOpacity={0.1}
          />

          {/* Line */}
          <path
            d={pathData}
            fill="none"
            stroke={metricBgColors[selectedMetric].replace('bg-', '#')}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {metrics.filter((_, i) => i % Math.ceil(metrics.length / 12) === 0).map((m, i) => {
            const idx = i * Math.ceil(metrics.length / 12)
            const x = xScale(idx)
            const y = yScale(m[selectedMetric])
            return (
              <circle
                key={idx}
                cx={x}
                cy={y}
                r={4}
                fill="#1e293b"
                stroke={metricBgColors[selectedMetric].replace('bg-', '#')}
                strokeWidth={2}
              />
            )
          })}

          {/* Y-axis labels */}
          {[0, 25, 50, 75, 100].map((percent) => {
            const value = min + ((max - min) * percent) / 100
            return (
              <text
                key={percent}
                x={padding.left - 5}
                y={padding.top + (innerHeight * (100 - percent)) / 100 + 3}
                fill="#64748b"
                fontSize={10}
                textAnchor="end"
              >
                {value.toFixed(0)}
              </text>
            )
          })}

          {/* X-axis labels */}
          {[0, Math.floor(metrics.length / 2), metrics.length - 1].map((idx) => {
            const m = metrics[idx]
            if (!m) return null
            return (
              <text
                key={idx}
                x={xScale(idx)}
                y={chartHeight - 5}
                fill="#64748b"
                fontSize={10}
                textAnchor={idx === 0 ? 'start' : idx === metrics.length - 1 ? 'end' : 'middle'}
              >
                {new Date(m.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </text>
            )
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <div className={clsx('w-3 h-3 rounded', metricBgColors[selectedMetric])} />
          <span>{metricLabels[selectedMetric]}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-slate-600" />
          <span>Moyenne: {avg.toFixed(1)}</span>
        </div>
      </div>
    </div>
  )
}
