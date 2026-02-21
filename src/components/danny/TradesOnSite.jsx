import { useCallback, useState } from 'react'
import { useDashboardQuery } from '../../hooks/useDashboardQuery'
import { getTradesOnSite } from '../../lib/queries'

export default function TradesOnSite({ startDate, endDate, projectId }) {
  const queryFn = useCallback(
    () => getTradesOnSite(startDate, endDate, projectId),
    [startDate, endDate, projectId]
  )
  const { data, loading, error } = useDashboardQuery(queryFn, 60000)
  const [expandedProjects, setExpandedProjects] = useState({})
  const [expandedTrades, setExpandedTrades] = useState({})

  function toggleProject(id) {
    setExpandedProjects((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function toggleTrade(key) {
    setExpandedTrades((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const totalTrades = data
    ? new Set(data.flatMap((p) => p.trades.map((t) => t.trade))).size
    : 0

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Trades On Site</h3>
        <p className="text-sm text-red-600">Failed to load: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">Trades On Site</h3>
        {data && (
          <span className="text-xs text-gray-500">
            {totalTrades} trades across {data.length} projects
          </span>
        )}
      </div>

      {loading && !data ? (
        <div className="p-6">
          <div className="h-48 bg-gray-100 rounded animate-pulse" />
        </div>
      ) : !data || data.length === 0 ? (
        <div className="p-6">
          <p className="text-sm text-gray-400 text-center py-4">No trade activity in this period</p>
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
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                    <span className="text-sm font-medium text-gray-900">{group.projectName}</span>
                    <span className="text-xs text-gray-400">{group.trades.length} trades</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="bg-gray-50/50 border-t border-gray-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left px-6 py-2 text-xs font-medium text-gray-500 w-8"></th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Trade</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Days On Site</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Days</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {group.trades.map((trade) => {
                          const tradeKey = `${group.projectId}:${trade.trade}`
                          const isTradeExpanded = !!expandedTrades[tradeKey]
                          return (
                            <TradeRow
                              key={tradeKey}
                              trade={trade}
                              isExpanded={isTradeExpanded}
                              onToggle={() => toggleTrade(tradeKey)}
                            />
                          )
                        })}
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

function TradeRow({ trade, isExpanded, onToggle }) {
  return (
    <>
      <tr className="hover:bg-white cursor-pointer" onClick={onToggle}>
        <td className="px-6 py-2">
          {trade.summary && (
            <svg
              className={`w-3 h-3 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </td>
        <td className="px-3 py-2 text-sm font-medium text-gray-900">{trade.trade}</td>
        <td className="px-3 py-2 text-xs text-gray-600">{trade.daysOnSite}</td>
        <td className="px-3 py-2">
          <div className="flex flex-wrap gap-1">
            {trade.dates.map((date) => (
              <span
                key={date}
                className="inline-block text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded"
              >
                {formatDayShort(date)}
              </span>
            ))}
          </div>
        </td>
      </tr>
      {isExpanded && trade.summary && (
        <tr>
          <td colSpan={4} className="px-6 py-3 bg-gray-50">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Work Summary</p>
            <p className="text-sm text-gray-700 leading-relaxed">{trade.summary}</p>
          </td>
        </tr>
      )}
    </>
  )
}

function formatDayShort(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
