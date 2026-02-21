import { useCallback, useState } from 'react'
import { useDashboardQuery } from '../../hooks/useDashboardQuery'
import { getOverdueActionItems } from '../../lib/queries'

export default function OverdueItemsBoard({ projectId }) {
  const queryFn = useCallback(() => getOverdueActionItems(projectId), [projectId])
  const { data, loading, error } = useDashboardQuery(queryFn, 60000)
  const [expandedProject, setExpandedProject] = useState(null)
  const [sortBy, setSortBy] = useState('overdue') // 'overdue' | 'date' | 'project'

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Overdue Action Items</h3>
        <p className="text-sm text-red-600">Failed to load: {error.message}</p>
      </div>
    )
  }

  const sortedItems = data
    ? [...data.items].sort((a, b) => {
        if (sortBy === 'project') return a.projectName.localeCompare(b.projectName)
        if (sortBy === 'date') return new Date(a.item_date) - new Date(b.item_date)
        return b.daysOverdue - a.daysOverdue
      })
    : []

  // Group by project
  const grouped = {}
  for (const item of sortedItems) {
    if (!grouped[item.projectName]) grouped[item.projectName] = []
    grouped[item.projectName].push(item)
  }
  const projectNames = Object.keys(grouped).sort((a, b) => {
    if (sortBy === 'overdue') {
      return Math.max(...grouped[b].map((i) => i.daysOverdue)) - Math.max(...grouped[a].map((i) => i.daysOverdue))
    }
    return a.localeCompare(b)
  })

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-gray-900">Overdue Action Items</h3>
          {data && data.total > 0 && (
            <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
              {data.total} overdue
            </span>
          )}
        </div>
        {data && data.total > 0 && (
          <div className="flex items-center bg-gray-100 rounded-md p-0.5">
            <SortBtn active={sortBy === 'overdue'} onClick={() => setSortBy('overdue')}>Most Overdue</SortBtn>
            <SortBtn active={sortBy === 'project'} onClick={() => setSortBy('project')}>Project</SortBtn>
            <SortBtn active={sortBy === 'date'} onClick={() => setSortBy('date')}>Created</SortBtn>
          </div>
        )}
      </div>

      {loading && !data ? (
        <div className="p-6 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : !data || data.total === 0 ? (
        <div className="p-6">
          <p className="text-sm text-gray-400 text-center py-4">No overdue action items</p>
        </div>
      ) : (
        <div className="max-h-[36rem] overflow-y-auto divide-y divide-gray-100">
          {projectNames.map((name) => {
            const items = grouped[name]
            const isExpanded = expandedProject === name

            return (
              <div key={name}>
                <button
                  onClick={() => setExpandedProject(isExpanded ? null : name)}
                  className="w-full px-6 py-3 flex items-center justify-between hover:bg-gray-50 text-left"
                >
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-medium text-gray-900">{name}</p>
                    <span className="text-xs font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
                      {items.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">
                      worst: {Math.max(...items.map((i) => i.daysOverdue))}d overdue
                    </span>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-6 pb-3">
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left px-3 py-2 font-medium text-gray-600">Description</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">CM</th>
                            <th className="text-center px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Due Date</th>
                            <th className="text-center px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Overdue</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {items.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50/50">
                              <td className="px-3 py-2 text-gray-900">
                                <p className="line-clamp-2">{item.description}</p>
                              </td>
                              <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{item.construction_manager}</td>
                              <td className="px-3 py-2 text-center text-gray-500 whitespace-nowrap">{formatDate(item.due_date)}</td>
                              <td className="px-3 py-2 text-center">
                                <OverdueBadge days={item.daysOverdue} />
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

function SortBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
        active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  )
}

function OverdueBadge({ days }) {
  const color = days >= 14 ? 'bg-red-100 text-red-700' : days >= 7 ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'
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
