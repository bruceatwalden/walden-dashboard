import { useCallback } from 'react'
import { useDashboardQuery } from '../../hooks/useDashboardQuery'
import { getInactiveProjects } from '../../lib/queries'

export default function InactiveProjects({ projectId }) {
  const queryFn = useCallback(() => getInactiveProjects(projectId), [projectId])
  const { data, loading, error } = useDashboardQuery(queryFn, 60000)

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Inactive Projects</h3>
        <p className="text-sm text-red-600">Failed to load: {error.message}</p>
      </div>
    )
  }

  // Sort: never-logged first, then by days since entry descending
  const sorted = data
    ? [...data].sort((a, b) => {
        if (a.lastEntryDate === null && b.lastEntryDate === null) return a.name.localeCompare(b.name)
        if (a.lastEntryDate === null) return -1
        if (b.lastEntryDate === null) return 1
        return (b.daysSinceEntry || 0) - (a.daysSinceEntry || 0)
      })
    : []

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-gray-900">Inactive Projects</h3>
          {data && data.length > 0 && (
            <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
              {data.length} inactive
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">No entries in 2+ days</span>
      </div>

      {loading && !data ? (
        <div className="p-6 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="p-6">
          <p className="text-sm text-gray-400 text-center py-4">All projects have recent activity</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-6 py-2 font-medium text-gray-600">Project</th>
                <th className="text-center px-4 py-2 font-medium text-gray-600 whitespace-nowrap">Last Entry</th>
                <th className="text-center px-4 py-2 font-medium text-gray-600 whitespace-nowrap">Days Inactive</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((project) => (
                <tr key={project.id} className="hover:bg-gray-50/50">
                  <td className="px-6 py-2.5 font-medium text-gray-900">{project.name}</td>
                  <td className="px-4 py-2.5 text-center text-gray-500 whitespace-nowrap">
                    {project.lastEntryDate ? formatDate(project.lastEntryDate) : (
                      <span className="text-gray-300">Never</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <InactiveBadge days={project.daysSinceEntry} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function InactiveBadge({ days }) {
  if (days === null) {
    return (
      <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
        Never
      </span>
    )
  }
  const color = days >= 7 ? 'bg-red-100 text-red-700' : days >= 4 ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>
      {days}d
    </span>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return '--'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
