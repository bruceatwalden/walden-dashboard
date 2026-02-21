import { useCallback } from 'react'
import { useDashboardQuery } from '../../hooks/useDashboardQuery'
import { getStaleOpenItems } from '../../lib/queries'

export default function StaleOpenItems({ projectId }) {
  const queryFn = useCallback(() => getStaleOpenItems(projectId), [projectId])
  const { data, loading, error } = useDashboardQuery(queryFn, 60000)

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Stale Open Items</h3>
        <p className="text-sm text-red-600">Failed to load: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-gray-900">Stale Open Items</h3>
          {data && data.length > 0 && (
            <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              {data.length} stale
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">No due date, 7+ days old</span>
      </div>

      {loading && !data ? (
        <div className="p-6 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="p-6">
          <p className="text-sm text-gray-400 text-center py-4">No stale items found</p>
        </div>
      ) : (
        <div className="max-h-[28rem] overflow-y-auto divide-y divide-gray-100">
          {data.map((item) => (
            <div key={item.id} className="px-6 py-3 hover:bg-gray-50/50 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-900 line-clamp-2">{item.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">{item.projectName}</span>
                    <span className="text-xs text-gray-300">&middot;</span>
                    <span className="text-xs text-gray-400">{item.construction_manager}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <AgeBadge days={item.daysOld} />
                  <p className="text-xs text-gray-400 mt-1">
                    created {formatDate(item.item_date)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AgeBadge({ days }) {
  const color = days >= 30 ? 'bg-red-100 text-red-700' : days >= 14 ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>
      {days}d old
    </span>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return '--'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
