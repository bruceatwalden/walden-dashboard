import { useCallback, useState } from 'react'
import { useDashboardQuery } from '../../hooks/useDashboardQuery'
import { getPunchListEntries } from '../../lib/queries'

export default function PunchListTracker({ startDate, endDate, projectId }) {
  const queryFn = useCallback(
    () => getPunchListEntries(startDate, endDate, projectId),
    [startDate, endDate, projectId]
  )
  const { data, loading, error } = useDashboardQuery(queryFn, 60000)
  const [expandedProject, setExpandedProject] = useState(null)

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Punch List Tracker</h3>
        <p className="text-sm text-red-600">Failed to load: {error.message}</p>
      </div>
    )
  }

  const totalEntries = data ? data.reduce((sum, g) => sum + g.entries.length, 0) : 0

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-gray-900">Punch List Tracker</h3>
          {data && totalEntries > 0 && (
            <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
              {totalEntries} {totalEntries === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>
      </div>

      {loading && !data ? (
        <div className="p-6 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="p-6">
          <p className="text-sm text-gray-400 text-center py-4">No punch list entries in this period</p>
        </div>
      ) : (
        <div className="max-h-[28rem] overflow-y-auto divide-y divide-gray-100">
          {data.map((group) => {
            const isExpanded = expandedProject === group.projectId || data.length === 1

            return (
              <div key={group.projectId}>
                <button
                  onClick={() => setExpandedProject(isExpanded && data.length > 1 ? null : group.projectId)}
                  className="w-full px-6 py-3 flex items-center justify-between hover:bg-gray-50 text-left"
                >
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-medium text-gray-900">{group.projectName}</p>
                    <span className="text-xs text-gray-400">{group.entries.length} items</span>
                  </div>
                  {data.length > 1 && (
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </button>

                {isExpanded && (
                  <div className="px-6 pb-3">
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left px-3 py-2 font-medium text-gray-600">Area</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-600">Description</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">CM</th>
                            <th className="text-center px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {group.entries.map((entry) => (
                            <tr key={entry.id} className="hover:bg-gray-50/50">
                              <td className="px-3 py-2 text-gray-500 whitespace-nowrap text-xs">
                                {formatArea(entry.project_area)}
                              </td>
                              <td className="px-3 py-2 text-gray-900">
                                <p className="line-clamp-2">{entry.description}</p>
                              </td>
                              <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{entry.construction_manager}</td>
                              <td className="px-3 py-2 text-center text-gray-400 whitespace-nowrap text-xs">
                                {formatDate(entry.entry_date)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function formatArea(area) {
  if (!area) return '--'
  // Strip common prefixes to keep it concise
  return area.replace(/^Punch List\s*/i, '').trim() || area
}

function formatDate(dateStr) {
  if (!dateStr) return '--'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
