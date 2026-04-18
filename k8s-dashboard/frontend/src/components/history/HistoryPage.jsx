import { useRiskHistory } from '../../hooks/useQueries.js'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, BarChart, Bar, Legend } from 'recharts'
import clsx from 'clsx'

function HistoryStats({ history }) {
  if (!history || history.length === 0) return null

  // Calcul du score moyen
  const avgScore = history.reduce((acc, p) => acc + p.score, 0) / history.length
  
  // Rétrospective des pics
  const maxScore = Math.max(...history.map(p => p.score))
  const criticalCount = history.filter(p => p.score >= 76).length

  return (
    <div className="grid grid-cols-3 gap-6 mb-6">
      <div className="card text-center p-4">
        <h3 className="section-title justify-center mb-2">Score Moyen Période</h3>
        <p className="text-3xl font-mono text-slate-100">{avgScore.toFixed(1)} / 100</p>
      </div>
      <div className="card text-center p-4">
        <h3 className="section-title justify-center mb-2">Pic de Risque Max</h3>
        <p className="text-3xl font-mono text-red-400">{maxScore.toFixed(1)} / 100</p>
      </div>
      <div className="card text-center p-4">
        <h3 className="section-title justify-center mb-2">Incidents Critiques Contenus</h3>
        <p className="text-3xl font-mono text-orange-400">{criticalCount}</p>
      </div>
    </div>
  )
}

export default function HistoryPage() {
  const { data: historyData, isLoading } = useRiskHistory(7)

  // Formattage pour les graphs : Grouper par date/heure
  const formattedData = historyData?.map(point => ({
    ...point,
    displayTime: new Date(point.computed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    displayDate: new Date(point.computed_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
  })) || []

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-slate-100 uppercase tracking-wide font-mono flex items-center gap-3">
          <span className="p-2 bg-brand-500/10 rounded-lg text-brand-400">📈</span>
          Security Posture History
        </h1>
        <div className="text-xs font-mono text-slate-400 bg-surface-card px-3 py-1.5 rounded-lg border border-surface-border">
          Derniers 7 Jours
        </div>
      </div>

      {isLoading ? (
        <div className="card h-[500px] flex items-center justify-center text-slate-500 animate-pulse">
          Analyse de l'historique ML...
        </div>
      ) : formattedData.length === 0 ? (
        <div className="card h-[500px] flex items-center justify-center text-slate-500">
          Pas assez de données pour l'historique.
        </div>
      ) : (
        <>
          <HistoryStats history={formattedData} />
          
          <div className="card">
            <h2 className="section-title mb-6">Évolution du ML Risk Score</h2>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.6}/>
                      <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d3a52" vertical={false} opacity={0.3} />
                  <XAxis 
                    dataKey="displayTime" 
                    stroke="#64748b" 
                    fontSize={10} 
                    tickMargin={10}
                    tickFormatter={(val, i) => i % Math.max(1, Math.floor(formattedData.length/10)) === 0 ? val : ''}
                  />
                  <YAxis stroke="#64748b" fontSize={10} domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                    labelStyle={{ color: '#94a3b8', fontSize: '10px' }}
                    itemStyle={{ color: '#f8fafc', fontSize: '12px', fontWeight: 'bold' }}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.displayDate + ' ' + label}
                  />
                  
                  {/* Lignes de seuils */}
                  <ReferenceLine y={25} stroke="#22c55e" strokeDasharray="3 3" opacity={0.3} />
                  <ReferenceLine y={50} stroke="#eab308" strokeDasharray="3 3" opacity={0.5} />
                  <ReferenceLine y={75} stroke="#ef4444" strokeDasharray="3 3" opacity={0.8} />

                  <Area 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorRisk)" 
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
