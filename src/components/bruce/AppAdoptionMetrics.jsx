import { useCallback } from 'react'
import { useDashboardQuery } from '../../hooks/useDashboardQuery'
import { getAdoptionMetrics } from '../../lib/queries'

const METRICS = [
  { key: 'activeUsers', label: 'Active CMs' },
  { key: 'recordings', label: 'Recordings' },
  { key: 'entries', label: 'Entries Created' },
  { key: 'photos', label: 'Photos Uploaded' },
  { key: 'submissions', label: 'Smartsheet Submissions' },
  { key: 'looms', label: 'Looms' },
  { key: 'emails', label: 'Emails' },
]

export default function AppAdoptionMetrics() {
  const queryFn = useCallback(() => getAdoptionMetrics(), [])
  const { data, loading, error } = useDashboardQuery(queryFn, 0)

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">App Adoption</h3>
        <p className="text-sm text-red-600">Failed to load: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-900">App Adoption</h3>
        {data && (
          <p className="text-xs text-gray-400 mt-0.5">
            {data.periodLabel} vs {data.prevLabel}
          </p>
        )}
      </div>

      {loading && !data ? (
        <div className="p-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : !data ? null : (
        <div className="divide-y divide-gray-100">
          {METRICS.map(({ key, label }) => {
            const cur = data.current[key] || 0
            const prev = data.previous[key] || 0
            return (
              <MetricRow key={key} label={label} current={cur} previous={prev} />
            )
          })}
        </div>
      )}
    </div>
  )
}

function MetricRow({ label, current, previous }) {
  const diff = current - previous
  const pct = previous > 0 ? Math.round((diff / previous) * 100) : current > 0 ? 100 : 0

  let trend = 'neutral'
  let arrow = ''
  let color = 'text-gray-400'

  if (diff > 0) {
    trend = 'up'
    arrow = '\u2191'
    color = 'text-green-600'
  } else if (diff < 0) {
    trend = 'down'
    arrow = '\u2193'
    color = 'text-red-600'
  }

  return (
    <div className="flex items-center justify-between px-6 py-3">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold tabular-nums text-gray-900">{current}</span>
        {previous > 0 || diff !== 0 ? (
          <span className={`text-xs tabular-nums ${color} w-16 text-right`}>
            {arrow} {Math.abs(pct)}%
            <span className="text-gray-300 ml-1">({previous})</span>
          </span>
        ) : (
          <span className="text-xs text-gray-300 w-16 text-right">--</span>
        )}
      </div>
    </div>
  )
}
