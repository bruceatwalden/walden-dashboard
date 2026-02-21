import { useCallback, useState, useMemo } from 'react'
import { useDashboardQuery } from '../../hooks/useDashboardQuery'
import { getLoomFeed } from '../../lib/queries'

export default function LoomVideoFeed({ startDate, endDate, projectId }) {
  const [sortBy, setSortBy] = useState('date')
  const queryFn = useCallback(
    () => getLoomFeed(startDate, endDate, projectId),
    [startDate, endDate, projectId]
  )
  const { data, loading, error } = useDashboardQuery(queryFn, 60000)

  const grouped = useMemo(() => {
    if (!data || data.length === 0) return []

    if (sortBy === 'project') {
      const byProject = {}
      for (const loom of data) {
        const key = loom.projectName || 'Unknown'
        if (!byProject[key]) byProject[key] = { label: key, items: [] }
        byProject[key].items.push(loom)
      }
      // Sort groups alphabetically, items within each group by newest first
      return Object.values(byProject)
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((g) => ({
          ...g,
          items: g.items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
        }))
    }

    // Sort by date (default) — group by calendar date, newest first
    const byDate = {}
    const sorted = [...data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    for (const loom of sorted) {
      const dateKey = new Date(loom.createdAt).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
      if (!byDate[dateKey]) byDate[dateKey] = { label: dateKey, items: [] }
      byDate[dateKey].items.push(loom)
    }
    return Object.values(byDate)
  }, [data, sortBy])

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Loom Video Feed</h3>
        <p className="text-sm text-red-600">Failed to load: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-gray-900">Loom Video Feed</h3>
          {data && data.length > 0 && (
            <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
              {data.length} {data.length === 1 ? 'video' : 'videos'}
            </span>
          )}
        </div>
        {data && data.length > 0 && (
          <div className="flex items-center bg-gray-100 rounded-md p-0.5">
            <SortButton active={sortBy === 'date'} onClick={() => setSortBy('date')}>
              Date
            </SortButton>
            <SortButton active={sortBy === 'project'} onClick={() => setSortBy('project')}>
              Project
            </SortButton>
          </div>
        )}
      </div>

      {loading && !data ? (
        <div className="p-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="p-6">
          <p className="text-sm text-gray-400 text-center py-4">No Loom videos in this period</p>
        </div>
      ) : (
        <div className="max-h-[32rem] overflow-y-auto">
          {grouped.map((group, gi) => (
            <div key={group.label}>
              {/* Group divider */}
              <div
                className={`sticky top-0 z-10 px-6 py-2.5 bg-gradient-to-r ${
                  sortBy === 'date'
                    ? 'from-slate-50 to-white border-b border-slate-200'
                    : 'from-indigo-50/60 to-white border-b border-indigo-100'
                } ${gi > 0 ? 'border-t border-gray-200' : ''}`}
              >
                <div className="flex items-center gap-2">
                  {sortBy === 'date' ? (
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  )}
                  <span className="text-xs font-semibold tracking-wide text-gray-600 uppercase">
                    {group.label}
                  </span>
                  <span className="text-xs text-gray-400">{group.items.length}</span>
                </div>
              </div>

              {/* Loom cards within group */}
              <div className="divide-y divide-gray-50">
                {group.items.map((loom) => (
                  <LoomCard key={loom.loomUrl} loom={loom} sortBy={sortBy} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SortButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
        active
          ? 'bg-white text-gray-900 shadow-sm'
          : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  )
}

function LoomCard({ loom, sortBy }) {
  const topicLabels = loom.topics.map((t) =>
    t.replace(/^Job Log\s+/i, '').replace(/^Tracker\s+/i, 'Tracker: ')
  )

  return (
    <div className="px-6 py-3.5 hover:bg-gray-50/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900">
              {sortBy === 'project' ? loom.cmName : loom.projectName}
            </p>
            {loom.entryCount && (
              <span className="text-xs text-gray-400">
                {loom.entryCount} {loom.entryCount === 1 ? 'entry' : 'entries'}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {sortBy === 'project' ? formatDateTime(loom.createdAt) : loom.cmName}
          </p>
        </div>
        {sortBy === 'date' && (
          <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
            {formatTime(loom.createdAt)}
          </span>
        )}
      </div>

      {loom.summary && (
        <p className="text-sm text-gray-600 mt-2 leading-relaxed line-clamp-2">
          {loom.summary}
        </p>
      )}

      {topicLabels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {topicLabels.map((topic) => (
            <span
              key={topic}
              className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
            >
              {topic}
            </span>
          ))}
        </div>
      )}

      <a
        href={loom.loomUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Watch Loom
      </a>
    </div>
  )
}

function formatTime(timestamp) {
  const d = new Date(timestamp)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatDateTime(timestamp) {
  const d = new Date(timestamp)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
