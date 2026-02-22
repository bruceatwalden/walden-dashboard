import { useState, useCallback } from 'react'
import DashboardLayout from '../components/shared/DashboardLayout'
import DateRangePicker, { getDateRange } from '../components/shared/DateRangePicker'
import VendorCompliancePanel from '../components/doron/VendorCompliancePanel'

export default function DoronDashboard() {
  const [dateRange, setDateRange] = useState({ preset: 'month' })
  const [summary, setSummary] = useState(null)

  const { start } = getDateRange(dateRange.preset, dateRange.customStart, dateRange.customEnd)
  const days = Math.max(1, Math.ceil((Date.now() - new Date(start + 'T00:00:00')) / 86400000))

  const onDataLoaded = useCallback((s) => setSummary(s), [])

  const stats = summary
    ? [
        { label: 'At Risk', value: summary.notCleared, loading: false, color: 'red' },
        { label: 'Expiring Soon', value: summary.expiringSoon, loading: false, color: 'amber' },
        { label: 'Cleared', value: summary.cleared, loading: false, color: 'green' },
        { label: 'COI Expired', value: summary.coiExpired, loading: false, color: 'orange' },
      ]
    : [
        { label: 'At Risk', value: null, loading: true },
        { label: 'Expiring Soon', value: null, loading: true },
        { label: 'Cleared', value: null, loading: true },
        { label: 'COI Expired', value: null, loading: true },
      ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <DateRangePicker {...dateRange} onChange={setDateRange} />
          <span className="text-xs text-gray-400">
            Showing vendors active in the last {days} day{days !== 1 ? 's' : ''}
          </span>
        </div>

        <ComplianceStatsBar stats={stats} />

        <VendorCompliancePanel days={days} onDataLoaded={onDataLoaded} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PlaceholderCard title="F1. Tracker Entry Feed" className="lg:col-span-2" />
          <PlaceholderCard title="F2. Tracker Summary by Category" />
          <PlaceholderCard title="F3. Smartsheet Submission Status" />
          <PlaceholderCard title="F4. Email / Communication Log" className="lg:col-span-2" />
        </div>
      </div>
    </DashboardLayout>
  )
}

function ComplianceStatsBar({ stats }) {
  const colorStyles = {
    red: 'border-red-200 bg-red-50/40',
    amber: 'border-amber-200 bg-amber-50/40',
    green: 'border-green-200 bg-green-50/40',
    orange: 'border-orange-200 bg-orange-50/40',
  }

  const valueStyles = {
    red: 'text-red-700',
    amber: 'text-amber-700',
    green: 'text-green-700',
    orange: 'text-orange-700',
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const cardClass = stat.color && !stat.loading
          ? colorStyles[stat.color] || 'border-gray-200'
          : 'border-gray-200'
        const valClass = stat.color && !stat.loading
          ? valueStyles[stat.color] || ''
          : ''

        return (
          <div key={stat.label} className={`bg-white rounded-lg shadow-sm border p-4 ${cardClass}`}>
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className={`text-2xl font-semibold mt-1 ${valClass}`}>
              {stat.loading ? (
                <span className="inline-block w-8 h-7 bg-gray-200 rounded animate-pulse" />
              ) : (
                stat.value ?? '--'
              )}
            </p>
          </div>
        )
      })}
    </div>
  )
}

function PlaceholderCard({ title, className = '' }) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
      <h3 className="text-sm font-medium text-gray-900 mb-3">{title}</h3>
      <div className="h-32 bg-gray-50 rounded border border-dashed border-gray-300 flex items-center justify-center">
        <span className="text-sm text-gray-400">Coming soon</span>
      </div>
    </div>
  )
}
