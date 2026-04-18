import clsx from 'clsx'

export default function SystemMetrics({ data }) {
  const { cpu, memory, disk, network, gpu, timestamp } = data

  const MetricCard = ({ title, value, unit, subtext, icon, iconBg, barValue, barColor }) => (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center shadow-md', iconBg)}>
            {icon}
          </div>
          <div>
            <p className="text-slate-600 text-xs font-semibold uppercase tracking-wider">{title}</p>
            <p className="text-3xl font-bold text-slate-800 mt-1">
              {value}
              <span className="text-lg font-medium text-slate-500 ml-1">{unit}</span>
            </p>
          </div>
        </div>
      </div>
      
      {barValue !== undefined && (
        <div className="mt-4">
          <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className={clsx('h-full rounded-full transition-all duration-700 ease-out shadow-sm', barColor)}
              style={{ width: `${Math.min(100, barValue)}%` }}
            />
          </div>
          <p className="text-sm text-slate-600 mt-2 font-medium">{subtext}</p>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          </div>
          <div>
            <span className="text-slate-800">Ressources Système</span>
            <span className="text-sm font-normal text-slate-500 ml-2">
              {new Date(timestamp).toLocaleString('fr-FR')}
            </span>
          </div>
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU */}
        <MetricCard
          title="CPU"
          value={cpu?.percent?.toFixed(1) || '0.0'}
          unit="%"
          subtext={`${cpu?.count || 0} cœurs @ ${cpu?.frequency_mhz || 0} MHz`}
          icon={
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
          iconBg="bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/30"
          barValue={cpu?.percent}
          barColor={cpu?.percent > 80 ? 'bg-gradient-to-r from-red-500 to-red-600' : cpu?.percent > 60 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-blue-500 to-blue-600'}
        />

        {/* Memory */}
        <MetricCard
          title="Mémoire RAM"
          value={memory?.percent?.toFixed(1) || '0.0'}
          unit="%"
          subtext={`${memory?.used_mb || 0} / ${memory?.total_mb || 0} MB utilisés`}
          icon={
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
          iconBg="bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/30"
          barValue={memory?.percent}
          barColor={memory?.percent > 85 ? 'bg-gradient-to-r from-red-500 to-red-600' : memory?.percent > 70 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-emerald-500 to-emerald-600'}
        />

        {/* Disk */}
        <MetricCard
          title="Stockage"
          value={disk?.percent?.toFixed(1) || '0.0'}
          unit="%"
          subtext={`${disk?.used_gb || 0} / ${disk?.total_gb || 0} GB utilisés`}
          icon={
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
          }
          iconBg="bg-gradient-to-br from-violet-500 to-violet-600 shadow-violet-500/30"
          barValue={disk?.percent}
          barColor={disk?.percent > 90 ? 'bg-gradient-to-r from-red-500 to-red-600' : disk?.percent > 75 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-violet-500 to-violet-600'}
        />

        {/* Network */}
        <MetricCard
          title="Réseau"
          value={network?.bytes_sent_mb || 0}
          unit="MB"
          subtext={`↓ ${network?.bytes_recv_mb || 0} MB reçus • ${network?.errors_in || 0} erreurs`}
          icon={
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          iconBg="bg-gradient-to-br from-cyan-500 to-cyan-600 shadow-cyan-500/30"
          barValue={(network?.bytes_sent_mb / 100) * 100}
          barColor="bg-gradient-to-r from-cyan-500 to-cyan-600"
        />
      </div>

      {/* GPU Section (if available) */}
      {gpu && (
        <div className="bg-white border border-pink-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl flex items-center justify-center shadow-lg shadow-pink-500/30">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-pink-600 text-xs font-semibold uppercase tracking-wider">GPU • {gpu.name}</p>
              <p className="text-slate-700 font-semibold text-sm">{gpu.driver_version}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-3xl font-bold text-slate-800">{gpu.utilization_percent}%</p>
              <p className="text-xs text-slate-500 mt-1 font-medium">Utilisation</p>
              <div className="h-2 bg-slate-200 rounded-full mt-2 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-pink-500 to-rose-500 rounded-full"
                  style={{ width: `${gpu.utilization_percent}%` }}
                />
              </div>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-3xl font-bold text-slate-800">{gpu.memory_used_mb}</p>
              <p className="text-xs text-slate-500 mt-1 font-medium">MB VRAM</p>
              <p className="text-xs text-slate-400">/ {gpu.memory_total_mb} MB</p>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-200">
              <p className={clsx(
                'text-3xl font-bold',
                gpu.temperature_c > 80 ? 'text-red-600' : gpu.temperature_c > 70 ? 'text-amber-600' : 'text-emerald-600'
              )}>
                {gpu.temperature_c}°C
              </p>
              <p className="text-xs text-slate-500 mt-1 font-medium">Température</p>
              <p className={clsx('text-xs font-medium', gpu.temperature_c > 80 ? 'text-red-500' : gpu.temperature_c > 70 ? 'text-amber-500' : 'text-emerald-500')}>
                {gpu.temperature_c > 80 ? '⚠️ Chaud' : gpu.temperature_c > 70 ? '🔶 Moyen' : '✅ Normal'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
