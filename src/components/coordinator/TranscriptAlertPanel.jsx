import { useCallback, useState, useMemo } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useDashboardQuery } from '../../hooks/useDashboardQuery'
import { getTranscriptAlerts, resolveAlert, unresolveAlert, addManualAlert, deleteManualAlert, getProjects } from '../../lib/queries'

/**
 * Reusable panel for transcript-sourced + manually added alerts.
 * Props:
 *   title        — panel heading
 *   itemTypes    — array of transcript_items.item_type values to show
 *   projectId    — optional project filter
 *   badgeColor   — { bg, text } for the count pill
 *   allowAdd     — show "Add Item" button (for Cost Alerts and Hot Buttons)
 */
export default function TranscriptAlertPanel({ title, itemTypes, projectId, badgeColor, allowAdd }) {
  const { user } = useAuth()
  const [sortBy, setSortBy] = useState('project')
  const [showResolved, setShowResolved] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState(null) // null = all collapsed by default

  const queryFn = useCallback(() => getTranscriptAlerts(itemTypes, projectId), [itemTypes, projectId])
  const { data, loading, error, refetch } = useDashboardQuery(queryFn, 60000)

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
            const dateA = a.meetingDate || a.createdAt
            const dateB = b.meetingDate || b.createdAt
            if (!dateA) return 1
            if (!dateB) return -1
            return new Date(dateB) - new Date(dateA)
          }),
        }))
    }

    // Sort by date — group by meeting (transcript items) or by project (manual items)
    const byGroup = {}
    const sorted = [...filtered].sort((a, b) => {
      const dateA = a.meetingDate || a.createdAt
      const dateB = b.meetingDate || b.createdAt
      if (!dateA) return 1
      if (!dateB) return -1
      return new Date(dateB) - new Date(dateA)
    })
    for (const item of sorted) {
      const key = item.source === 'manual' ? `manual_${item.projectId}` : item.transcriptId
      if (!byGroup[key]) {
        byGroup[key] = item.source === 'manual'
          ? { label: item.projectName || 'Unknown', sublabel: 'Manually Added', items: [] }
          : {
              label: `${item.meetingTitle}${item.projectName ? ' — ' + item.projectName : ''}`,
              sublabel: item.meetingDate ? formatDate(item.meetingDate) : null,
              items: [],
            }
      }
      byGroup[key].items.push(item)
    }
    return Object.values(byGroup)
  }, [filtered, sortBy])

  const openCount = data ? data.filter((i) => !i.resolved).length : 0
  const resolvedCount = data ? data.filter((i) => i.resolved).length : 0
  const totalAmount = filtered.reduce((sum, item) => sum + (item.amount || 0), 0)
  const pill = badgeColor || { bg: 'bg-red-50', text: 'text-red-600' }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">{title}</h3>
        <p className="text-sm text-red-600">Failed to load: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-gray-900">{title}</h3>
          {data && openCount > 0 && (
            <span className={`text-xs font-medium ${pill.text} ${pill.bg} px-2 py-0.5 rounded-full`}>
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
          {allowAdd && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className={`text-xs px-2.5 py-1 rounded transition-colors inline-flex items-center gap-1 ${
                showAddForm
                  ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                  : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showAddForm ? 'M6 18L18 6M6 6l12 12' : 'M12 4v16m8-8H4'} />
              </svg>
              {showAddForm ? 'Cancel' : 'Add Item'}
            </button>
          )}
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
              <SortBtn active={sortBy === 'date'} onClick={() => { setSortBy('date'); setCollapsedGroups(null) }}>Date</SortBtn>
              <SortBtn active={sortBy === 'project'} onClick={() => { setSortBy('project'); setCollapsedGroups(null) }}>Project</SortBtn>
            </div>
          )}
        </div>
      </div>

      {showAddForm && (
        <AddItemForm
          itemType={itemTypes[0]}
          userName={user?.name || 'Unknown'}
          onAdded={() => { setShowAddForm(false); refetch() }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {loading && !data ? (
        <div className="p-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="p-6">
          <p className="text-sm text-gray-400 text-center py-4">No items found</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-6">
          <p className="text-sm text-gray-400 text-center py-4">All items resolved</p>
        </div>
      ) : (
        <div className="max-h-[36rem] overflow-y-auto">
          {grouped.map((group, gi) => {
            const groupKey = group.label + gi
            // null = all collapsed initially; object tracks expanded groups
            const isCollapsed = collapsedGroups === null ? true : !collapsedGroups[groupKey]
            return (
              <div key={groupKey}>
                <button
                  type="button"
                  onClick={() => setCollapsedGroups((prev) => {
                    if (prev === null) {
                      // First click from all-collapsed: expand this group
                      return { [groupKey]: true }
                    }
                    return { ...prev, [groupKey]: !prev[groupKey] }
                  })}
                  className={`w-full sticky top-0 z-10 px-6 py-2.5 bg-gradient-to-r cursor-pointer select-none ${
                    sortBy === 'date'
                      ? 'from-slate-50 to-white border-b border-slate-200'
                      : 'from-indigo-50/40 to-white border-b border-indigo-100'
                  } ${gi > 0 ? 'border-t border-gray-200' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <svg
                      className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
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
                    {group.sublabel && (
                      <span className="text-xs text-gray-400">{group.sublabel}</span>
                    )}
                    <span className="text-xs text-gray-400 ml-auto">{group.items.length}</span>
                  </div>
                </button>

                {!isCollapsed && (
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
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AddItemForm({ itemType, userName, onAdded, onCancel }) {
  const [description, setDescription] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  const projectsFn = useCallback(() => getProjects(), [])
  const { data: projects } = useDashboardQuery(projectsFn, 0)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!description.trim() || !selectedProjectId) return
    setSaving(true)
    setErr(null)
    try {
      await addManualAlert(itemType, description.trim(), selectedProjectId, userName)
      onAdded()
    } catch (error) {
      setErr(error.message || 'Failed to add item')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="px-6 py-4 bg-blue-50/50 border-b border-blue-100">
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          required
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:w-48"
        >
          <option value="">Select project...</option>
          {projects?.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the item..."
          required
          className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          autoFocus
        />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={saving || !description.trim() || !selectedProjectId}
            className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {saving ? 'Adding...' : 'Add'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
      {err && <p className="text-xs text-red-600 mt-2">{err}</p>}
    </form>
  )
}

function AlertCard({ item, sortBy, isExpanded, onToggle, userName, onChanged }) {
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

  async function handleDelete() {
    setSaving(true)
    setErr(null)
    try {
      await deleteManualAlert(item.id)
      await onChanged()
    } catch (e) {
      setErr(e.message || 'Failed to delete')
    } finally {
      setSaving(false)
    }
  }

  const isManual = item.source === 'manual'

  return (
    <div className={`px-6 py-3.5 transition-colors ${item.resolved ? 'bg-gray-50/60 opacity-75' : 'hover:bg-gray-50/50'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {item.resolved && <ResolvedBadge />}
            {isManual && !item.resolved && <ManualBadge />}
            <p className={`text-sm font-medium ${item.resolved ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
              {sortBy === 'project'
                ? (isManual ? (item.createdBy || 'Manual') : (item.meetingTitle || 'Meeting'))
                : item.projectName}
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

      {isManual && item.createdBy && !item.resolved && (
        <div className="mt-1 text-xs text-gray-400">
          Added by {item.createdBy}{item.createdAt ? ' ' + formatRelative(item.createdAt) : ''}
        </div>
      )}

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
          {!isManual && (
            <button
              onClick={onToggle}
              className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {isExpanded ? 'Hide details' : 'Full details'}
            </button>
          )}

          {isManual && !item.resolved && (
            <DeleteButton saving={saving} onDelete={handleDelete} />
          )}

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

      {isExpanded && !isManual && (
        <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Description</h4>
            <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">{item.description}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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

function DeleteButton({ saving, onDelete }) {
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={onDelete}
          disabled={saving}
          className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
        >
          {saving ? '...' : 'Confirm'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 transition-colors"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
      Delete
    </button>
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

function ManualBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
      Manual
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
