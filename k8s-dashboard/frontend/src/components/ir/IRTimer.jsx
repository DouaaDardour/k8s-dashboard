import { useEffect, useState } from 'react'
import clsx from 'clsx'

export default function IRTimer({ secondsRemaining, onExpire }) {
  const [secs, setSecs] = useState(secondsRemaining)

  // Sync si la valeur change (polling serveur)
  useEffect(() => {
    setSecs(secondsRemaining)
  }, [secondsRemaining])

  // Décompte local (entre les polls serveur)
  useEffect(() => {
    if (secs <= 0) {
      onExpire?.()
      return
    }
    const id = setTimeout(() => setSecs(s => Math.max(0, s - 1)), 1000)
    return () => clearTimeout(id)
  }, [secs, onExpire])

  const mins = Math.floor(secs / 60)
  const sec  = secs % 60
  const pct  = secondsRemaining > 0 ? (secs / secondsRemaining) * 100 : 0

  const urgent = secs <= 30
  const color  = secs === 0   ? '#6b7280'
               : urgent        ? '#ef4444'
               : secs <= 60   ? '#f97316'
               :                '#eab308'

  return (
    <div className="flex items-center gap-2.5">
      {/* Arc timer SVG */}
      <div className="relative w-10 h-10 flex-shrink-0">
        <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
          <circle cx="20" cy="20" r="16" fill="none" stroke="#1e2535" strokeWidth="3" />
          <circle
            cx="20" cy="20" r="16"
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 16}`}
            strokeDashoffset={`${2 * Math.PI * 16 * (1 - pct / 100)}`}
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={clsx('text-[9px] font-mono font-semibold', urgent && 'animate-pulse')}
            style={{ color }}
          >
            {secs === 0 ? '✓' : `${mins}:${String(sec).padStart(2, '0')}`}
          </span>
        </div>
      </div>
    </div>
  )
}
