import { useCallback } from 'react'
import { useDashboardQuery } from '../../hooks/useDashboardQuery'
import { getVendorCompliance } from '../../lib/api'

export default function VendorCompliancePanel({ days = 90, onDataLoaded }) {
  const queryFn = useCallback(async () => {
    const data = await getVendorCompliance(days)
    onDataLoaded?.({
      ...data.summary,
      expiringSoon: data.expiringSoon?.length ?? 0,
    })
    return data
  }, [days, onDataLoaded])

  const { data, loading, error } = useDashboardQuery(queryFn, 300000)

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
      <VendorSection
        title="At Risk"
        description="WSIB clearance is No or missing"
        items={data?.atRisk}
        loading={loading && !data}
        color="red"
        columns={atRiskColumns}
      />
      <VendorSection
        title="Expiring Soon"
        description={`Current period cleared — next period (${data?.nextPeriod || '...'}) not yet`}
        items={data?.expiringSoon}
        loading={loading && !data}
        color="amber"
        columns={expiringColumns}
      />
      <VendorSection
        title="COI Expired"
        description="Certificate of Insurance has passed its expiry date"
        items={data?.coiExpired}
        loading={loading && !data}
        color="orange"
        columns={coiColumns}
      />
    </div>
  )
}

const atRiskColumns = [
  { key: 'vendor', label: 'Vendor', className: 'font-medium text-gray-900' },
  { key: 'currentStatus', label: 'WSIB Status', render: (v) => <StatusBadge value={v.currentStatus} /> },
  { key: 'projects', label: 'Projects', render: (v) => v.projects?.join(', ') || '—' },
  { key: 'invoiceCount', label: 'Invoices', className: 'text-right tabular-nums' },
  { key: 'latestInvoiceDate', label: 'Last Invoice', render: (v) => formatDate(v.latestInvoiceDate) },
]

const expiringColumns = [
  { key: 'vendor', label: 'Vendor', className: 'font-medium text-gray-900' },
  { key: 'nextStatus', label: 'Next Period', render: (v) => <StatusBadge value={v.nextStatus} /> },
  { key: 'projects', label: 'Projects', render: (v) => v.projects?.join(', ') || '—' },
  { key: 'invoiceCount', label: 'Invoices', className: 'text-right tabular-nums' },
  { key: 'latestInvoiceDate', label: 'Last Invoice', render: (v) => formatDate(v.latestInvoiceDate) },
]

const coiColumns = [
  { key: 'vendor', label: 'Vendor', className: 'font-medium text-gray-900' },
  { key: 'coiExpiryDate', label: 'COI Expired', render: (v) => formatDate(v.coiExpiryDate) },
  { key: 'currentStatus', label: 'WSIB Status', render: (v) => <StatusBadge value={v.currentStatus} /> },
  { key: 'projects', label: 'Projects', render: (v) => v.projects?.join(', ') || '—' },
  { key: 'invoiceCount', label: 'Invoices', className: 'text-right tabular-nums' },
]

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
  orange: {
    badge: 'bg-orange-50 text-orange-700',
    headerBorder: 'border-orange-200',
    headerBg: 'bg-orange-50/50',
    dot: 'bg-orange-500',
  },
}

function VendorSection({ title, description, items, loading, color, columns }) {
  const c = COLOR_MAP[color]
  const count = items?.length ?? 0

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className={`px-6 py-4 border-b ${c.headerBorder} ${c.headerBg} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${c.dot}`} />
          <h3 className="text-sm font-medium text-gray-900">{title}</h3>
          <span className="text-xs text-gray-500">{description}</span>
        </div>
        {!loading && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.badge}`}>
            {count}
          </span>
        )}
      </div>

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
                <tr key={i} className="hover:bg-gray-50">
                  {columns.map((col) => (
                    <td key={col.key} className={`px-6 py-3 ${col.className || 'text-gray-600'}`}>
                      {col.render ? col.render(item) : (item[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ value }) {
  if (!value) {
    return <span className="text-xs font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">No record</span>
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
