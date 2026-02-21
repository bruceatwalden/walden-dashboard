import { useState, useCallback, useMemo } from 'react'
import DashboardLayout from '../components/shared/DashboardLayout'
import HeaderStatsBar from '../components/shared/HeaderStatsBar'
import ProjectSelector from '../components/shared/ProjectSelector'
import DateRangePicker, { getDateRange } from '../components/shared/DateRangePicker'
import OverdueItemsBoard from '../components/coordinator/OverdueItemsBoard'
import StaleOpenItems from '../components/coordinator/StaleOpenItems'
import PunchListTracker from '../components/coordinator/PunchListTracker'
import UnreviewedMeetingItems from '../components/coordinator/UnreviewedMeetingItems'
import InactiveProjects from '../components/coordinator/InactiveProjects'
import TranscriptAlertPanel from '../components/coordinator/TranscriptAlertPanel'
import { useDashboardQuery } from '../hooks/useDashboardQuery'
import { getCoordinatorOverview } from '../lib/queries'

const COST_ALERT_TYPES = ['red_button']
const CLIENT_CONCERN_TYPES = ['client_concern']
const HOT_BUTTON_TYPES = ['hot_button']

export default function CoordinatorDashboard() {
  const [projectId, setProjectId] = useState(null)
  const [dateRange, setDateRange] = useState({ preset: 'month' })

  const { start, end } = getDateRange(dateRange.preset, dateRange.customStart, dateRange.customEnd)

  // Overview query powers the stats bar
  const queryFn = useCallback(() => getCoordinatorOverview(projectId), [projectId])
  const { data: overview, loading } = useDashboardQuery(queryFn, 60000)

  const stats = useMemo(() => {
    if (!overview) {
      return [
        { label: 'Overdue Items', value: null, loading: true },
        { label: 'Stale Items', value: null, loading: true },
        { label: 'Unreviewed Meeting', value: null, loading: true },
        { label: 'Inactive Projects', value: null, loading: true },
      ]
    }

    return [
      {
        label: 'Overdue Items',
        value: overview.overdue,
        loading: false,
        color: overview.overdue > 0 ? 'red' : undefined,
      },
      {
        label: 'Stale Items',
        value: overview.stale,
        loading: false,
        color: overview.stale > 0 ? 'amber' : undefined,
      },
      {
        label: 'Unreviewed Meeting',
        value: overview.unreviewed ?? '--',
        loading: false,
        color: overview.unreviewed > 0 ? 'orange' : undefined,
      },
      {
        label: 'Inactive Projects',
        value: overview.inactive,
        loading: false,
        color: overview.inactive > 0 ? 'gray' : undefined,
      },
    ]
  }, [overview])

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <ProjectSelector value={projectId} onChange={setProjectId} />
          <DateRangePicker {...dateRange} onChange={setDateRange} />
        </div>

        <HeaderStatsBar stats={stats} />

        {/* Overdue action items */}
        <OverdueItemsBoard projectId={projectId} />

        {/* Stale items */}
        <StaleOpenItems projectId={projectId} />

        {/* Transcript alert panels */}
        <TranscriptAlertPanel
          title="Cost & Approval Alerts"
          itemTypes={COST_ALERT_TYPES}
          projectId={projectId}
          badgeColor={{ bg: 'bg-red-50', text: 'text-red-600' }}
          allowAdd
        />

        <TranscriptAlertPanel
          title="Client Concerns"
          itemTypes={CLIENT_CONCERN_TYPES}
          projectId={projectId}
          badgeColor={{ bg: 'bg-orange-50', text: 'text-orange-600' }}
        />

        <TranscriptAlertPanel
          title="Client Hot Buttons"
          itemTypes={HOT_BUTTON_TYPES}
          projectId={projectId}
          badgeColor={{ bg: 'bg-rose-50', text: 'text-rose-600' }}
          allowAdd
        />

        {/* Punch list + Unreviewed meeting items */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PunchListTracker startDate={start} endDate={end} projectId={projectId} />
          <UnreviewedMeetingItems projectId={projectId} />
        </div>

        {/* Inactive projects */}
        <InactiveProjects projectId={projectId} />
      </div>
    </DashboardLayout>
  )
}
