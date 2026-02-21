import { useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { useDashboardQuery } from '../../hooks/useDashboardQuery'
import { getOpenItemsByProject } from '../../lib/queries'

export default function OpenItemsByProject({ projectId }) {
  const queryFn = useCallback(() => getOpenItemsByProject(projectId), [projectId])
  const { data, loading, error } = useDashboardQuery(queryFn, 60000)

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Open Items by Project</h3>
        <p className="text-sm text-red-600">Failed to load: {error.message}</p>
      </div>
    )
  }

  const totalOpen = data ? data.reduce((sum, d) => sum + d.total, 0) : 0

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-gray-900">Open Items by Project</h3>
          {data && totalOpen > 0 && (
            <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
              {totalOpen} total
            </span>
          )}
        </div>
      </div>

      {loading && !data ? (
        <div className="p-6">
          <div className="h-64 bg-gray-100 rounded animate-pulse" />
        </div>
      ) : !data || data.length === 0 ? (
        <div className="p-6">
          <p className="text-sm text-gray-400 text-center py-4">No open action items</p>
        </div>
      ) : (
        <div className="p-6">
          <ResponsiveContainer width="100%" height={Math.max(data.length * 40, 120)}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 0, right: 4, bottom: 0, left: 0 }}
            >
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                width={130}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
              <Bar dataKey="overdue" stackId="items" fill="#ef4444" name="Overdue" radius={[0, 0, 0, 0]} />
              <Bar dataKey="onTrack" stackId="items" fill="#f59e0b" name="On Track" radius={[0, 0, 0, 0]} />
              <Bar dataKey="noDueDate" stackId="items" fill="#9ca3af" name="No Due Date" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
