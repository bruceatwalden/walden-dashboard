import { useCallback, useState, useMemo } from 'react'
import { useDashboardQuery } from '../../hooks/useDashboardQuery'
import { getSiteActivity } from '../../lib/queries'

function getThisWeekRange() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dayOfWeek = today.getDay()
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const monday = new Date(today)
  monday.setDate(today.getDate() - mondayOffset)
  const fmt = (d) => d.toISOString().split('T')[0]
  return { start: fmt(monday), end: fmt(today) }
}

export default function SiteActivityThisWeek({ projectId }) {
  const { start, end } = useMemo(() => getThisWeekRange(), [])

  const queryFn = useCallback(
    () => getSiteActivity(start, end, projectId),
    [start, end, projectId]
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

  const totals = useMemo(() => {
    if (!data) return { trades: 0, entries: 0, projects: 0 }
    let trades = 0, entries = 0
    for (const p of data) {
      trades += p.onSite.length + p.coordination.length
      entries += [...p.onSite, ...p.coordination].reduce((s, t) => s + t.entryCount, 0)
    }
    return { trades, entries, projects: data.length }
  }, [data])

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Site Activity This Week</h3>
        <p className="text-sm text-red-600">Failed to load: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-gray-900">Site Activity This Week</h3>
          {data && (
            <span className="text-xs text-gray-400">
              {formatDateShort(start)} – {formatDateShort(end)}
            </span>
          )}
        </div>
        {data && (
          <span className="text-xs text-gray-500">
            {totals.trades} trades &middot; {totals.entries} entries &middot; {totals.projects} projects
          </span>
        )}
      </div>

      {loading && !data ? (
        <div className="p-6">
          <div className="h-48 bg-gray-100 rounded animate-pulse" />
        </div>
      ) : !data || data.length === 0 ? (
        <div className="p-6">
          <p className="text-sm text-gray-400 text-center py-4">No site activity this week</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200 max-h-[40rem] overflow-y-auto">
          {data.map((group) => {
            const isExpanded = projectId ? true : !!expandedProjects[group.projectId]
            const allTrades = [...group.onSite, ...group.coordination]
            const totalEntries = allTrades.reduce((s, t) => s + t.entryCount, 0)

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
                    <span className="text-xs text-gray-400">{allTrades.length} trades</span>
                  </div>
                  <span className="text-xs text-gray-400">{totalEntries} entries</span>
                </button>

                {isExpanded && (
                  <div className="bg-gray-50/50 border-t border-gray-100">
                    {group.onSite.length > 0 && (
                      <TradeSection
                        label="On Site Work"
                        type="onsite"
                        trades={group.onSite}
                        projectId={group.projectId}
                        expandedTrades={expandedTrades}
                        onToggleTrade={toggleTrade}
                      />
                    )}
                    {group.coordination.length > 0 && (
                      <TradeSection
                        label="Coordination / Off Site"
                        type="coordination"
                        trades={group.coordination}
                        projectId={group.projectId}
                        expandedTrades={expandedTrades}
                        onToggleTrade={toggleTrade}
                      />
                    )}
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

function TradeSection({ label, type, trades, projectId, expandedTrades, onToggleTrade }) {
  return (
    <div>
      <div className={`px-6 py-2 flex items-center gap-2 border-b ${
        type === 'onsite'
          ? 'bg-emerald-50/60 border-emerald-100'
          : 'bg-amber-50/60 border-amber-100'
      }`}>
        {type === 'onsite' ? (
          <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
        <span className={`text-xs font-semibold uppercase tracking-wider ${
          type === 'onsite' ? 'text-emerald-700' : 'text-amber-700'
        }`}>
          {label}
        </span>
        <span className="text-xs text-gray-400 ml-auto">{trades.length}</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left px-6 py-2 text-xs font-medium text-gray-500 w-8"></th>
            <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Trade</th>
            <th className="text-center px-3 py-2 text-xs font-medium text-gray-500">Days</th>
            <th className="text-center px-3 py-2 text-xs font-medium text-gray-500">Entries</th>
            <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">CM</th>
            <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Days On Site</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {trades.map((trade) => {
            const tradeKey = `${projectId}:${trade.trade}`
            const isTradeExpanded = !!expandedTrades[tradeKey]
            return (
              <TradeRow
                key={tradeKey}
                trade={trade}
                isExpanded={isTradeExpanded}
                onToggle={() => onToggleTrade(tradeKey)}
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TradeRow({ trade, isExpanded, onToggle }) {
  const hasNarrative = trade.narrative && trade.narrative.length > 0

  return (
    <>
      <tr className={`hover:bg-white ${hasNarrative ? 'cursor-pointer' : ''}`} onClick={hasNarrative ? onToggle : undefined}>
        <td className="px-6 py-2">
          {hasNarrative && (
            <svg
              className={`w-3 h-3 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </td>
        <td className="px-3 py-2 text-sm font-medium text-gray-900">{trade.trade}</td>
        <td className="text-center px-3 py-2 text-xs text-gray-600">{trade.daysOnSite}</td>
        <td className="text-center px-3 py-2 text-xs text-gray-600">{trade.entryCount}</td>
        <td className="px-3 py-2 text-xs text-gray-500">{trade.cms.join(', ')}</td>
        <td className="px-3 py-2">
          <div className="flex flex-wrap gap-1">
            {trade.dates.map((date) => (
              <span
                key={date}
                className="inline-block text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded"
              >
                {formatDay(date)}
              </span>
            ))}
          </div>
        </td>
      </tr>
      {isExpanded && hasNarrative && (
        <tr>
          <td colSpan={6} className="px-6 py-3 bg-gray-50 border-t border-gray-100">
            <div className="space-y-1.5 pl-3 border-l-2 border-gray-200">
              {trade.narrative.map((line, i) => (
                <p key={i} className="text-sm text-gray-800 leading-relaxed">{line}</p>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function formatDay(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short' })
}

function formatDateShort(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

