import { useCallback, useState } from 'react'
import { useDashboardQuery } from '../../hooks/useDashboardQuery'
import { getVendorCompliance, postVendorOverride } from '../../lib/api'

const OVERRIDE_LABELS = {
  not_required: 'Not Required',
  supplier_only: 'Supplier Only',
  owner_direct: 'Owner Direct',
  confirmed_clear: 'Confirmed Clear',
  watch: 'Watch',
}

export default function VendorCompliancePanel({ days = 90, onDataLoaded }) {
  const [overrideTarget, setOverrideTarget] = useState(null)

  const queryFn = useCallback(async () => {
    const data = await getVendorCompliance(days)
    onDataLoaded?.({
      ...data.summary,
      currentPeriod: data.currentPeriod,
      nextPeriod: data.nextPeriod,
      liveCheckSummary: data.liveCheckSummary,
    })
    return data
  }, [days, onDataLoaded])

  const { data, loading, error, refetch } = useDashboardQuery(queryFn, 300000)

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Vendor Compliance</h3>
        <p className="text-sm text-red-600">Failed to load: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {data && <PeriodBar currentPeriod={data.currentPeriod} nextPeriod={data.nextPeriod} />}
      {data?.liveCheckSummary && <LiveCheckBar summary={data.liveCheckSummary} />}

      <VendorSection
        title="Not Cleared"
        description="WSIB clearance is No or missing"
        items={data?.notCleared}
        loading={loading && !data}
        color="red"
        columns={notClearedColumns}
        onOverride={setOverrideTarget}
        defaultOpen
      />
      <VendorSection
        title="Expiring Soon"
        description={`Current period cleared — next period (${data?.nextPeriod || '...'}) not yet`}
        items={data?.expiringSoon}
        loading={loading && !data}
        color="amber"
        columns={expiringColumns}
        defaultOpen
      />
      <VendorSection
        title="Cleared"
        description="Current WSIB clearance confirmed"
        items={data?.cleared}
        loading={loading && !data}
        color="green"
        columns={clearedColumns}
        rowClassName={(v) =>
          v.currentStatus === 'Yes' && v.wsibLiveStatus === 'not_eligible'
            ? 'bg-red-50/60 hover:bg-red-100/60'
            : 'hover:bg-gray-50'
        }
      />
      <VendorSection
        title="COI Expired"
        description="Certificate of Insurance has passed its expiry date"
        items={data?.coiExpired}
        loading={loading && !data}
        color="orange"
        columns={coiColumns}
        defaultOpen
      />
      <VendorSection
        title="Excluded"
        description="Marked as not requiring WSIB clearance"
        items={data?.excluded}
        loading={loading && !data}
        color="gray"
        columns={excludedColumns}
      />
      <VendorSection
        title="Untracked"
        description="In invoices but not found in WSIB eClearance sheet"
        items={data?.untracked}
        loading={loading && !data}
        color="blue"
        columns={untrackedColumns}
        onOverride={setOverrideTarget}
      />

      {overrideTarget && (
        <OverrideModal
          vendor={overrideTarget}
          onClose={() => setOverrideTarget(null)}
          onSaved={() => { setOverrideTarget(null); refetch() }}
        />
      )}
    </div>
  )
}

// --- Period bar ---

function parsePeriodDate(str) {
  if (!str) return null
  const match = str.match(/^(\d{1,2})([A-Za-z]+)(\d{4})$/)
  if (!match) return null
  const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }
  const m = months[match[2].toLowerCase()]
  if (m === undefined) return null
  return new Date(Number(match[3]), m, Number(match[1]))
}

function fmtPeriodDate(d) {
  if (!d) return '...'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function addMonths(d, n) {
  const r = new Date(d)
  r.setMonth(r.getMonth() + n)
  return r
}

function PeriodBar({ currentPeriod, nextPeriod }) {
  const currStart = parsePeriodDate(currentPeriod)
  const nextStart = parsePeriodDate(nextPeriod)
  const nextEnd = nextStart ? addMonths(nextStart, 3) : null
  const year = nextStart ? nextStart.getFullYear() : ''

  return (
    <div className="bg-blue-50/60 border border-blue-200 rounded-lg px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
      <span className="font-medium text-blue-900">WSIB Clearance Periods</span>
      <span className="text-blue-700">
        Current: {fmtPeriodDate(currStart)} – {fmtPeriodDate(nextStart)}, {year}
      </span>
      <span className="text-blue-600">
        Next: {fmtPeriodDate(nextStart)} – {fmtPeriodDate(nextEnd)}, {nextEnd ? nextEnd.getFullYear() : ''}
      </span>
    </div>
  )
}

// --- Live check bar ---

function LiveCheckBar({ summary }) {
  const checkedAt = summary.checkedAt
    ? new Date(summary.checkedAt).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : null

  return (
    <div className="bg-purple-50/60 border border-purple-200 rounded-lg px-5 py-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
      <span className="font-medium text-purple-900">Live Check:</span>
      <span className="text-green-700 font-medium">{summary.eligible ?? 0} Eligible</span>
      <span className="text-gray-400">·</span>
      <span className="text-red-700 font-medium">{summary.notEligible ?? 0} Not Eligible</span>
      <span className="text-gray-400">·</span>
      <span className="text-gray-500 font-medium">{summary.notFound ?? 0} Not Found</span>
      <span className="text-gray-400">·</span>
      <span className="text-amber-700 font-medium">{summary.multipleResults ?? 0} Multiple Results</span>
      {checkedAt && (
        <span className="ml-auto text-xs text-purple-400">Checked {checkedAt}</span>
      )}
    </div>
  )
}

// --- Activity indicator ---

function ActivityDot({ active }) {
  if (!active) return <span className="text-xs text-gray-300">—</span>
  return (
    <span className="inline-flex items-center gap-1 text-xs text-green-700">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
      Active
    </span>
  )
}

// --- Vendor name with account number indicator ---

function VendorName({ v }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {v.vendor}
      {v.hasAccountNumber && (
        <span title="WSIB account number on file" className="text-emerald-500 flex-shrink-0">
          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
          </svg>
        </span>
      )}
    </span>
  )
}

// --- Live status badge ---

const LIVE_STATUS_CONFIG = {
  eligible:         { label: 'Eligible',         style: 'bg-green-50 text-green-700' },
  not_eligible:     { label: 'Not Eligible',     style: 'bg-red-50 text-red-700' },
  not_found:        { label: 'Not Found',        style: 'bg-gray-100 text-gray-500' },
  multiple_results: { label: 'Multiple Results', style: 'bg-amber-50 text-amber-700' },
}

function LiveStatusBadge({ value }) {
  if (!value) return <span className="text-xs text-gray-300">—</span>
  const cfg = LIVE_STATUS_CONFIG[value] || { label: value, style: 'bg-gray-100 text-gray-500' }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${cfg.style}`}>
      {cfg.label}
    </span>
  )
}

function MismatchWarning({ v }) {
  if (v.currentStatus !== 'Yes' || v.wsibLiveStatus !== 'not_eligible') return null
  return (
    <span
      title="Smartsheet says Cleared but WSIB live check says Not Eligible"
      className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full whitespace-nowrap"
    >
      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
      </svg>
      Mismatch
    </span>
  )
}

// --- Column definitions ---

const notClearedColumns = [
  { key: 'vendor', label: 'Vendor', className: 'font-medium text-gray-900', render: (v) => <VendorName v={v} /> },
  { key: 'currentStatus', label: 'WSIB Status', render: (v) => <StatusBadge value={v.currentStatus} /> },
  { key: '_liveStatus', label: 'Live Status', render: (v) => <LiveStatusBadge value={v.wsibLiveStatus} /> },
  { key: '_activity', label: 'Activity', render: (v) => <ActivityDot active={v.hasRecentActivity} /> },
  { key: 'projects', label: 'Projects', render: (v) => v.projects?.join(', ') || '—' },
  { key: 'latestInvoiceDate', label: 'Last Invoice', render: (v) => formatDate(v.latestInvoiceDate) },
  { key: '_override', label: '', render: (v, { onOverride }) => (
    <button
      onClick={() => onOverride(v)}
      className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
    >
      Override
    </button>
  )},
]

const expiringColumns = [
  { key: 'vendor', label: 'Vendor', className: 'font-medium text-gray-900', render: (v) => <VendorName v={v} /> },
  { key: 'nextStatus', label: 'Next Period', render: (v) => <StatusBadge value={v.nextStatus} /> },
  { key: '_liveStatus', label: 'Live Status', render: (v) => <LiveStatusBadge value={v.wsibLiveStatus} /> },
  { key: '_activity', label: 'Activity', render: (v) => <ActivityDot active={v.hasRecentActivity} /> },
  { key: 'projects', label: 'Projects', render: (v) => v.projects?.join(', ') || '—' },
  { key: 'latestInvoiceDate', label: 'Last Invoice', render: (v) => formatDate(v.latestInvoiceDate) },
]

const clearedColumns = [
  { key: 'vendor', label: 'Vendor', className: 'font-medium text-gray-900', render: (v) => <VendorName v={v} /> },
  { key: 'currentStatus', label: 'WSIB Status', render: (v) => <StatusBadge value={v.currentStatus} /> },
  { key: '_liveStatus', label: 'Live Status', render: (v) => (
    <span className="inline-flex items-center gap-1.5">
      <LiveStatusBadge value={v.wsibLiveStatus} />
      <MismatchWarning v={v} />
    </span>
  )},
  { key: '_activity', label: 'Activity', render: (v) => <ActivityDot active={v.hasRecentActivity} /> },
  { key: 'projects', label: 'Projects', render: (v) => v.projects?.join(', ') || '—' },
  { key: 'latestInvoiceDate', label: 'Last Invoice', render: (v) => formatDate(v.latestInvoiceDate) },
]

const coiColumns = [
  { key: 'vendor', label: 'Vendor', className: 'font-medium text-gray-900', render: (v) => <VendorName v={v} /> },
  { key: 'coiExpiryDate', label: 'COI Expired', render: (v) => formatDate(v.coiExpiryDate) },
  { key: 'currentStatus', label: 'WSIB Status', render: (v) => <StatusBadge value={v.currentStatus} /> },
  { key: '_liveStatus', label: 'Live Status', render: (v) => <LiveStatusBadge value={v.wsibLiveStatus} /> },
  { key: '_activity', label: 'Activity', render: (v) => <ActivityDot active={v.hasRecentActivity} /> },
  { key: 'projects', label: 'Projects', render: (v) => v.projects?.join(', ') || '—' },
]

const excludedColumns = [
  { key: 'vendor', label: 'Vendor', className: 'font-medium text-gray-900', render: (v) => <VendorName v={v} /> },
  { key: 'overrideStatus', label: 'Status', render: (v) => (
    <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
      {OVERRIDE_LABELS[v.overrideStatus] || v.overrideStatus}
    </span>
  )},
  { key: '_liveStatus', label: 'Live Status', render: (v) => <LiveStatusBadge value={v.wsibLiveStatus} /> },
  { key: 'overrideReason', label: 'Reason', className: 'text-gray-500' },
  { key: '_activity', label: 'Activity', render: (v) => <ActivityDot active={v.hasRecentActivity} /> },
  { key: 'projects', label: 'Projects', render: (v) => v.projects?.join(', ') || '—' },
]

const untrackedColumns = [
  { key: 'vendor', label: 'Vendor', className: 'font-medium text-gray-900' },
  { key: '_liveStatus', label: 'Live Status', render: (v) => <LiveStatusBadge value={v.wsibLiveStatus} /> },
  { key: 'projects', label: 'Projects', render: (v) => v.projects?.join(', ') || '—' },
  { key: 'latestInvoiceDate', label: 'Last Invoice', render: (v) => formatDate(v.latestInvoiceDate) },
  { key: '_override', label: '', render: (v, { onOverride }) => onOverride ? (
    <button
      onClick={() => onOverride(v)}
      className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
    >
      Override
    </button>
  ) : null},
]

// --- Color map ---

const COLOR_MAP = {
  red: {
    badge: 'bg-red-50 text-red-700',
    headerBorder: 'border-red-200',
    headerBg: 'bg-red-50/50',
    dot: 'bg-red-500',
  },
  amber: {
    badge: 'bg-amber-50 text-amber-700',
    headerBorder: 'border-amber-200',
    headerBg: 'bg-amber-50/50',
    dot: 'bg-amber-500',
  },
  green: {
    badge: 'bg-green-50 text-green-700',
    headerBorder: 'border-green-200',
    headerBg: 'bg-green-50/50',
    dot: 'bg-green-500',
  },
  orange: {
    badge: 'bg-orange-50 text-orange-700',
    headerBorder: 'border-orange-200',
    headerBg: 'bg-orange-50/50',
    dot: 'bg-orange-500',
  },
  gray: {
    badge: 'bg-gray-100 text-gray-600',
    headerBorder: 'border-gray-200',
    headerBg: 'bg-gray-50/50',
    dot: 'bg-gray-400',
  },
  blue: {
    badge: 'bg-blue-50 text-blue-700',
    headerBorder: 'border-blue-200',
    headerBg: 'bg-blue-50/50',
    dot: 'bg-blue-500',
  },
}

// --- VendorSection (collapsible) ---

function VendorSection({ title, description, items, loading, color, columns, onOverride, defaultOpen = false, rowClassName }) {
  const [open, setOpen] = useState(defaultOpen)
  const c = COLOR_MAP[color]
  const count = items?.length ?? 0

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full px-6 py-4 border-b ${c.headerBorder} ${c.headerBg} flex items-center justify-between cursor-pointer select-none`}
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className={`w-2 h-2 rounded-full ${c.dot}`} />
          <h3 className="text-sm font-medium text-gray-900">{title}</h3>
          <span className="text-xs text-gray-500 hidden sm:inline">{description}</span>
        </div>
        {!loading && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.badge}`}>
            {count}
          </span>
        )}
      </button>

      {open && (
        <>
          {loading ? (
            <div className="p-6">
              <div className="h-24 bg-gray-100 rounded animate-pulse" />
            </div>
          ) : count === 0 ? (
            <div className="p-6">
              <p className="text-sm text-gray-400 text-center py-2">None</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {columns.map((col) => (
                      <th key={col.key} className={`px-6 py-3 ${col.className?.includes('text-right') ? 'text-right' : ''}`}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, i) => (
                    <tr key={i} className={rowClassName ? rowClassName(item) : 'hover:bg-gray-50'}>
                      {columns.map((col) => (
                        <td key={col.key} className={`px-6 py-3 ${col.className || 'text-gray-600'}`}>
                          {col.render ? col.render(item, { onOverride }) : (item[col.key] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// --- Override modal ---

function OverrideModal({ vendor, onClose, onSaved }) {
  const [status, setStatus] = useState('not_required')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      await postVendorOverride({
        vendor_name: vendor.vendor,
        status,
        reason: reason.trim() || null,
        set_by: 'Doron',
      })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">Override WSIB Status</h3>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
            <p className="text-sm text-gray-900 bg-gray-50 rounded px-3 py-2">{vendor.vendor}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="not_required">Not Required</option>
              <option value="supplier_only">Supplier Only</option>
              <option value="owner_direct">Owner Direct</option>
              <option value="watch">Watch</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Material supplier — no workers on site"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300"
          >
            {saving ? 'Saving...' : 'Save Override'}
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Shared helpers ---

function StatusBadge({ value }) {
  if (!value) {
    return <span className="text-xs font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Not in WSIB tracker</span>
  }

  const styles = {
    Yes: 'bg-green-50 text-green-700',
    No: 'bg-red-50 text-red-700',
    'N/A': 'bg-gray-100 text-gray-500',
  }

  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[value] || 'bg-gray-100 text-gray-500'}`}>
      {value}
    </span>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
