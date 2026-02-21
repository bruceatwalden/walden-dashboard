import { useCallback } from 'react'
import { useDashboardQuery } from '../../hooks/useDashboardQuery'
import { getSafetyEntries } from '../../lib/queries'

export default function SiteSafetyEntries({ startDate, endDate, projectId }) {
  const queryFn = useCallback(
    () => getSafetyEntries(startDate, endDate, projectId),
    [startDate, endDate, projectId]
  )
  const { data, loading, error } = useDashboardQuery(queryFn, 60000)

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Site Safety Entries</h3>
        <p className="text-sm text-red-600">Failed to load: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">Site Safety Entries</h3>
        {data && (
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              data.length > 0
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-600'
            }`}
          >
            {data.length > 0 ? `${data.length} logged` : 'None logged'}
          </span>
        )}
      </div>

      {loading && !data ? (
        <div className="p-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="p-6">
          <p className="text-sm text-gray-400 text-center py-4">No safety entries in this period</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
          {data.map((entry) => (
            <SafetyRow key={entry.id} entry={entry} showProject={!projectId} />
          ))}
        </div>
      )}
    </div>
  )
}

function SafetyRow({ entry, showProject }) {
  return (
    <div className="px-6 py-3 hover:bg-gray-50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {showProject && (
            <p className="text-xs font-medium text-blue-600 mb-0.5">{entry.projectName}</p>
          )}
          <p className="text-sm text-gray-900">{entry.description}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500">{entry.construction_manager}</span>
            <span className="text-xs text-gray-300">{entry.project_area}</span>
          </div>
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
          {formatTime(entry.created_at)}
        </span>
      </div>
    </div>
  )
}

function formatTime(timestamp) {
  const d = new Date(timestamp)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
