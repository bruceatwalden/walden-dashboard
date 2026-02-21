import { useCallback, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useDashboardQuery } from '../../hooks/useDashboardQuery'
import { getOverdueActionItems } from '../../lib/queries'

export default function OverdueItemsSummary({ projectId }) {
  const queryFn = useCallback(() => getOverdueActionItems(projectId), [projectId])
  const { data, loading, error } = useDashboardQuery(queryFn, 60000)
  const [expandedProject, setExpandedProject] = useState(null)

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Overdue Action Items</h3>
        <p className="text-sm text-red-600">Failed to load: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">Overdue Action Items</h3>
        {data && (
          <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
            {data.total} overdue
          </span>
        )}
      </div>

      {loading && !data ? (
        <div className="p-6">
          <div className="h-40 bg-gray-100 rounded animate-pulse" />
        </div>
      ) : !data || data.total === 0 ? (
        <div className="p-6">
          <p className="text-sm text-gray-400 text-center py-4">No overdue action items</p>
        </div>
      ) : (
        <div className="p-6 space-y-6">
          {data.chartData.length > 1 && (
            <ResponsiveContainer width="100%" height={Math.max(data.chartData.length * 36, 80)}>
              <BarChart
                data={data.chartData}
                layout="vertical"
                margin={{ top: 0, right: 4, bottom: 0, left: 0 }}
              >
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  width={120}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  formatter={(value) => [value, 'Overdue']}
                />
                <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                  {data.chartData.map((_, i) => (
                    <Cell key={i} fill="#ef4444" fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Oldest overdue items
            </h4>
            <ItemList
              items={data.items}
              expandedProject={expandedProject}
              onToggle={setExpandedProject}
              showProject={!projectId}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function ItemList({ items, expandedProject, onToggle, showProject }) {
  // Group by project
  const grouped = {}
  for (const item of items) {
    if (!grouped[item.projectName]) grouped[item.projectName] = []
    grouped[item.projectName].push(item)
  }

  const projectNames = Object.keys(grouped).sort()

  // If single project or few total items, show flat list
  if (!showProject || projectNames.length <= 1) {
    return (
      <div className="space-y-1">
        {items.slice(0, 20).map((item) => (
          <ItemRow key={item.id} item={item} showProject={showProject && projectNames.length > 1} />
        ))}
        {items.length > 20 && (
          <p className="text-xs text-gray-400 pt-1">+ {items.length - 20} more</p>
        )}
      </div>
    )
  }

  // Multi-project: collapsible sections
  return (
    <div className="space-y-1">
      {projectNames.map((name) => {
        const projectItems = grouped[name]
        const isExpanded = expandedProject === name

        return (
          <div key={name}>
            <button
              onClick={() => onToggle(isExpanded ? null : name)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50 text-left"
            >
              <span className="text-sm font-medium text-gray-900">{name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
                  {projectItems.length}
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
              <div className="ml-3 pl-3 border-l border-gray-200 space-y-1 mb-2">
                {projectItems.map((item) => (
                  <ItemRow key={item.id} item={item} showProject={false} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ItemRow({ item, showProject }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2 rounded-md hover:bg-gray-50">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 truncate">{item.description}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {showProject && (
            <span className="text-xs text-gray-500">{item.projectName}</span>
          )}
          <span className="text-xs text-gray-400">{item.construction_manager}</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <span className="text-xs font-medium text-red-600">{item.daysOverdue}d overdue</span>
        <p className="text-xs text-gray-400 mt-0.5">due {formatDate(item.due_date)}</p>
      </div>
    </div>
  )
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
