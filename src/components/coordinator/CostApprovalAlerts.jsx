import { useCallback, useState, useMemo } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useDashboardQuery } from '../../hooks/useDashboardQuery'
import { getCostApprovalAlerts, resolveAlert, unresolveAlert } from '../../lib/queries'

export default function CostApprovalAlerts({ projectId }) {
  const { user } = useAuth()
  const [sortBy, setSortBy] = useState('date')
  const [showResolved, setShowResolved] = useState(false)
  const [expandedId, setExpandedId] = useState(null)

  const queryFn = useCallback(() => getCostApprovalAlerts(projectId), [projectId])
  const { data, loading, error, refetch } = useDashboardQuery(queryFn, 300000)

  const filtered = useMemo(() => {
    if (!data) return []
    return showResolved ? data : data.filter((item) => !item.resolved)
  }, [data, showResolved])

  const grouped = useMemo(() => {
    if (filtered.length === 0) return []

    if (sortBy === 'project') {
      const byProject = {}
      for (const item of filtered) {
        const key = item.projectName
        if (!byProject[key]) byProject[key] = { label: key, items: [] }
        byProject[key].items.push(item)
      }
      return Object.values(byProject)
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((g) => ({
          ...g,
          items: g.items.sort((a, b) => {
            if (!a.meetingDate) return 1
            if (!b.meetingDate) return -1
            return new Date(b.meetingDate) - new Date(a.meetingDate)
          }),
        }))
    }

    // Sort by date — group by meeting
    const byMeeting = {}
    const sorted = [...filtered].sort((a, b) => {
      if (!a.meetingDate) return 1
      if (!b.meetingDate) return -1
      return new Date(b.meetingDate) - new Date(a.meetingDate)
    })
    for (const item of sorted) {
      const key = item.transcriptId
      if (!byMeeting[key]) {
        byMeeting[key] = {
          label: `${item.meetingTitle}${item.projectName ? ' — ' + item.projectName : ''}`,
          sublabel: item.meetingDate ? formatDate(item.meetingDate) : null,
          items: [],
        }
      }
      byMeeting[key].items.push(item)
    }
    return Object.values(byMeeting)
  }, [filtered, sortBy])

  const openCount = data ? data.filter((i) => !i.resolved).length : 0
  const resolvedCount = data ? data.filter((i) => i.resolved).length : 0
  const totalAmount = filtered.reduce((sum, item) => sum + (item.amount || 0), 0)

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Cost & Approval Alerts</h3>
        <p className="text-sm text-red-600">Failed to load: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-gray-900">Cost & Approval Alerts</h3>
          {data && openCount > 0 && (
            <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
              {openCount} open
            </span>
          )}
          {resolvedCount > 0 && (
            <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
              {resolvedCount} resolved
            </span>
          )}
          {totalAmount > 0 && (
            <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
              ${totalAmount.toLocaleString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {resolvedCount > 0 && (
            <button
              onClick={() => setShowResolved(!showResolved)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                showResolved
                  ? 'bg-green-50 text-green-700 hover:bg-green-100'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
            >
              {showResolved ? 'Showing resolved' : 'Show resolved'}
            </button>
          )}
          {data && data.length > 0 && (
            <div className="flex items-center bg-gray-100 rounded-md p-0.5">
              <SortBtn active={sortBy === 'date'} onClick={() => setSortBy('date')}>Date</SortBtn>
              <SortBtn active={sortBy === 'project'} onClick={() => setSortBy('project')}>Project</SortBtn>
            </div>
          )}
        </div>
      </div>

      {loading && !data ? (
        <div className="p-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="p-6">
          <p className="text-sm text-gray-400 text-center py-4">No cost or approval alerts found</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-6">
          <p className="text-sm text-gray-400 text-center py-4">All alerts resolved</p>
        </div>
      ) : (
        <div className="max-h-[36rem] overflow-y-auto">
          {grouped.map((group, gi) => (
            <div key={group.label + gi}>
              {/* Group divider */}
              <div
                className={`sticky top-0 z-10 px-6 py-2.5 bg-gradient-to-r ${
                  sortBy === 'date'
                    ? 'from-slate-50 to-white border-b border-slate-200'
                    : 'from-red-50/50 to-white border-b border-red-100'
                } ${gi > 0 ? 'border-t border-gray-200' : ''}`}
              >
                <div className="flex items-center gap-2">
                  {sortBy === 'date' ? (
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  )}
                  <span className="text-xs font-semibold tracking-wide text-gray-600 uppercase">
                    {group.label}
                  </span>
                  {group.sublabel && (
                    <span className="text-xs text-gray-400">{group.sublabel}</span>
                  )}
                  <span className="text-xs text-gray-400 ml-auto">{group.items.length}</span>
                </div>
              </div>

              {/* Alert cards within group */}
              <div className="divide-y divide-gray-50">
                {group.items.map((item) => (
                  <AlertCard
                    key={item.id}
                    item={item}
                    sortBy={sortBy}
                    isExpanded={expandedId === item.id}
                    onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    userName={user?.name || 'Unknown'}
                    onChanged={refetch}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AlertCard({ item, sortBy, isExpanded, onToggle, userName, onChanged }) {
  const isRedButton = item.itemType === 'red_button'
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  async function handleResolve() {
    setSaving(true)
    setErr(null)
    try {
      await resolveAlert(item.id, userName)
      await onChanged()
    } catch (e) {
      setErr(e.message || 'Failed to resolve')
    } finally {
      setSaving(false)
    }
  }

  async function handleReopen() {
    setSaving(true)
    setErr(null)
    try {
      await unresolveAlert(item.id)
      await onChanged()
    } catch (e) {
      setErr(e.message || 'Failed to reopen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`px-6 py-3.5 transition-colors ${item.resolved ? 'bg-gray-50/60 opacity-75' : 'hover:bg-gray-50/50'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {item.resolved ? <ResolvedBadge /> : <TypeBadge type={item.itemType} />}
            <p className={`text-sm font-medium ${item.resolved ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
              {sortBy === 'project' ? (item.meetingTitle || 'Meeting') : item.projectName}
            </p>
            {item.amount > 0 && (
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                item.resolved ? 'text-gray-400 bg-gray-100' : 'text-amber-700 bg-amber-50'
              }`}>
                ${item.amount.toLocaleString()}
              </span>
            )}
          </div>
          <p className={`text-sm mt-1 leading-relaxed line-clamp-2 ${item.resolved ? 'text-gray-400' : 'text-gray-600'}`}>
            {item.description}
          </p>
        </div>
        {sortBy === 'date' && (
          <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
            {item.projectName}
          </span>
        )}
      </div>

      {/* Resolution info (if resolved) */}
      {item.resolved && item.resolution && (
        <div className="mt-2 flex items-center gap-2 text-xs text-green-600">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>
            Resolved by <span className="font-medium">{item.resolution.resolvedBy}</span>
            {' '}{formatRelative(item.resolution.resolvedAt)}
          </span>
        </div>
      )}

      {/* Action row */}
      <div className="flex items-center gap-3 mt-2">
        {item.assignee && (
          <span className="text-xs text-gray-400">
            Assigned: <span className="text-gray-500">{item.assignee}</span>
          </span>
        )}
        {item.sectionCode && (
          <span className="text-xs text-gray-400">
            Code: <span className="text-gray-500">{item.sectionCode}</span>
          </span>
        )}
        {sortBy === 'project' && item.meetingDate && (
          <span className="text-xs text-gray-400">{formatDate(item.meetingDate)}</span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onToggle}
            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {isExpanded ? 'Hide details' : 'Full details'}
          </button>

          {item.resolved ? (
            <button
              onClick={handleReopen}
              disabled={saving}
              className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reopen
            </button>
          ) : (
            <button
              onClick={handleResolve}
              disabled={saving}
              className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-800 transition-colors disabled:opacity-50"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {saving ? 'Saving...' : 'Resolve'}
            </button>
          )}
        </div>
      </div>

      {err && (
        <p className="mt-2 text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded">{err}</p>
      )}

      {/* Expanded detail panel */}
      {isExpanded && (
        <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Description</h4>
            <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">{item.description}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <DetailField label="Type" value={isRedButton ? 'Cost / Approval Alert' : 'Client Concern'} />
            <DetailField label="Project" value={item.projectName} />
            <DetailField label="Meeting" value={item.meetingTitle} />
            {item.meetingDate && <DetailField label="Meeting Date" value={formatDate(item.meetingDate)} />}
            {item.meetingType && <DetailField label="Meeting Type" value={item.meetingType} />}
            {item.assignee && <DetailField label="Assignee" value={item.assignee} />}
            {item.sectionCode && <DetailField label="Trade Code" value={item.sectionCode} />}
            {item.amount > 0 && <DetailField label="Amount" value={`$${item.amount.toLocaleString()}`} highlight />}
          </div>

          {item.resolved && item.resolution && (
            <div className="pt-2 border-t border-gray-200">
              <div className="grid grid-cols-2 gap-3">
                <DetailField label="Resolved By" value={item.resolution.resolvedBy} />
                <DetailField label="Resolved On" value={formatDate(item.resolution.resolvedAt)} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DetailField({ label, value, highlight }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-sm ${highlight ? 'font-semibold text-amber-700' : 'text-gray-900'}`}>{value}</p>
    </div>
  )
}

function TypeBadge({ type }) {
  if (type === 'red_button') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-1.5 py-0.5 rounded">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        Alert
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded">
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      Concern
    </span>
  )
}

function ResolvedBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
      Resolved
    </span>
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

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function formatRelative(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  const now = new Date()
  const diffMs = now - d
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
