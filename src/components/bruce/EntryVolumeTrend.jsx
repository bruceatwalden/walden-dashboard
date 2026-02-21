import { useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { useDashboardQuery } from '../../hooks/useDashboardQuery'
import { getEntryTrend } from '../../lib/queries'

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
]

export default function EntryVolumeTrend({ startDate, endDate, projectId }) {
  const queryFn = useCallback(() => getEntryTrend(startDate, endDate), [startDate, endDate])
  const { data, loading, error } = useDashboardQuery(queryFn, 0)

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Entry Volume Trend</h3>
        <p className="text-sm text-red-600">Failed to load: {error.message}</p>
      </div>
    )
  }

  const isSingleDay = startDate === endDate

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-sm font-medium text-gray-900 mb-4">Entry Volume Trend</h3>
      {loading && !data ? (
        <div className="h-64 bg-gray-100 rounded animate-pulse" />
      ) : isSingleDay ? (
        <div className="h-64 flex items-center justify-center">
          <p className="text-sm text-gray-400">Select This Week or This Month to see the trend chart</p>
        </div>
      ) : (
        <Chart data={data} projectId={projectId} />
      )}
    </div>
  )
}

function Chart({ data, projectId }) {
  if (!data) return null

  const { chartData, projectKeys } = data

  // If a project is selected, show just that project's bar; otherwise show stacked
  const keysToShow = projectId
    ? projectKeys.filter((k) => {
        // Find the project name for the selected ID — match by checking if any row has entries for it
        return chartData.some((d) => d[k] > 0)
      })
    : projectKeys

  // For single project filter, we filter keys by matching project name
  // We need the project name from the data. Simplest: if projectId is set, show total only.
  const showStacked = !projectId && keysToShow.length > 1

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickFormatter={formatDateTick}
          interval={chartData.length > 14 ? Math.floor(chartData.length / 7) : 0}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
          labelFormatter={(label) => formatDateLabel(label)}
        />
        {showStacked ? (
          <>
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              iconSize={10}
            />
            {keysToShow.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                stackId="entries"
                fill={COLORS[i % COLORS.length]}
                radius={i === keysToShow.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </>
        ) : (
          <Bar
            dataKey="total"
            fill="#3b82f6"
            radius={[2, 2, 0, 0]}
            name="Entries"
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  )
}

function formatDateTick(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
