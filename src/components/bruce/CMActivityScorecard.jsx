import { useCallback } from 'react'
import { useDashboardQuery } from '../../hooks/useDashboardQuery'
import { getCMActivity } from '../../lib/queries'

export default function CMActivityScorecard({ startDate, endDate }) {
  const queryFn = useCallback(() => getCMActivity(startDate, endDate), [startDate, endDate])
  const { data: cms, loading, error } = useDashboardQuery(queryFn, 60000)

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">CM Activity</h3>
        <p className="text-sm text-red-600">Failed to load: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-900">CM Activity</h3>
      </div>
      {loading && !cms ? (
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : !cms || cms.length === 0 ? (
        <div className="p-6">
          <p className="text-sm text-gray-400 text-center py-4">No CM activity in this date range</p>
        </div>
      ) : (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cms.map((cm) => (
            <CMCard key={cm.id} cm={cm} />
          ))}
        </div>
      )}
    </div>
  )
}

function CMCard({ cm }) {
  const inactive = cm.total === 0

  const stats = [
    { label: 'Recordings', value: cm.recordings },
    { label: 'Processed', value: cm.processing },
    { label: 'Submitted', value: cm.submissions },
    { label: 'Emails', value: cm.emails },
    { label: 'Looms', value: cm.looms },
    { label: 'Meetings', value: cm.meetings },
  ].filter((s) => s.value > 0)

  return (
    <div className={`rounded-lg border p-4 ${inactive ? 'border-red-200 bg-red-50/50' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-2 h-2 rounded-full ${inactive ? 'bg-red-400' : 'bg-green-400'}`} />
        <span className="font-medium text-gray-900 text-sm">{cm.name}</span>
        <span className="text-xs text-gray-400 ml-auto">{cm.total} actions</span>
      </div>
      {stats.length > 0 ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {stats.map((s) => (
            <div key={s.label} className="text-xs">
              <span className="text-gray-500">{s.label}</span>{' '}
              <span className="font-medium text-gray-700">{s.value}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-red-500">No activity</p>
      )}
    </div>
  )
}
