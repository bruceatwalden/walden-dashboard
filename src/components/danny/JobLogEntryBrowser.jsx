import { useCallback, useState } from 'react'
import { useDashboardQuery } from '../../hooks/useDashboardQuery'
import { getJobLogEntries } from '../../lib/queries'

export default function JobLogEntryBrowser({ startDate, endDate, projectId }) {
  const queryFn = useCallback(
    () => getJobLogEntries(startDate, endDate, projectId),
    [startDate, endDate, projectId]
  )
  const { data, loading, error } = useDashboardQuery(queryFn, 60000)
  const [expandedProjects, setExpandedProjects] = useState({})

  function toggleProject(id) {
    setExpandedProjects((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const totalEntries = data ? data.reduce((sum, g) => sum + g.entries.length, 0) : 0

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Job Log Entry Browser</h3>
        <p className="text-sm text-red-600">Failed to load: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">Job Log Entry Browser</h3>
        {data && (
          <span className="text-xs text-gray-500">
            {totalEntries} entries across {data.length} projects
          </span>
        )}
      </div>

      {loading && !data ? (
        <div className="p-6">
          <div className="h-48 bg-gray-100 rounded animate-pulse" />
        </div>
      ) : !data || data.length === 0 ? (
        <div className="p-6">
          <p className="text-sm text-gray-400 text-center py-4">No entries in this period</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200 max-h-[36rem] overflow-y-auto">
          {data.map((group) => {
            const isExpanded = projectId ? true : !!expandedProjects[group.projectId]

            return (
              <div key={group.projectId}>
                <button
                  onClick={() => !projectId && toggleProject(group.projectId)}
                  className={`w-full flex items-center justify-between px-6 py-3 text-left hover:bg-gray-50 ${
                    projectId ? 'cursor-default' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {!projectId && (
                      <svg
                        className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                    <span className="text-sm font-medium text-gray-900">{group.projectName}</span>
                    <span className="text-xs text-gray-400">{group.entries.length} entries</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="bg-gray-50/50 border-t border-gray-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left px-6 py-2 text-xs font-medium text-gray-500">Date</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Area</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Description</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">CM</th>
                          <th className="text-center px-3 py-2 text-xs font-medium text-gray-500">SS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {group.entries.map((entry) => (
                          <tr key={entry.id} className="hover:bg-white">
                            <td className="px-6 py-2 text-xs text-gray-500 whitespace-nowrap">
                              {formatDate(entry.entry_date)}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap max-w-[160px] truncate">
                              {entry.project_area}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900 max-w-md">
                              <p className="line-clamp-2">{entry.description}</p>
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                              {entry.construction_manager}
                            </td>
                            <td className="text-center px-3 py-2">
                              {entry.smartsheet_submitted ? (
                                <span className="inline-block w-2 h-2 rounded-full bg-green-500" title="Submitted" />
                              ) : (
                                <span className="inline-block w-2 h-2 rounded-full bg-gray-300" title="Not submitted" />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
