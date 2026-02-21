import { useState } from 'react'
import DashboardLayout from '../components/shared/DashboardLayout'
import HeaderStatsBar from '../components/shared/HeaderStatsBar'
import ProjectSelector from '../components/shared/ProjectSelector'
import DateRangePicker from '../components/shared/DateRangePicker'

export default function DoronDashboard() {
  const [projectId, setProjectId] = useState(null)
  const [dateRange, setDateRange] = useState({ preset: '30d' })

  const placeholderStats = [
    { label: 'Tracker Entries', value: '--', loading: false },
    { label: 'Categories Active', value: '--', loading: false },
    { label: 'Pending Submissions', value: '--', loading: false },
    { label: 'Emails This Week', value: '--', loading: false },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <ProjectSelector value={projectId} onChange={setProjectId} />
          <DateRangePicker {...dateRange} onChange={setDateRange} />
        </div>

        <HeaderStatsBar stats={placeholderStats} />

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
