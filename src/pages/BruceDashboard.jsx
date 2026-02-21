import { useState, useCallback, useMemo } from 'react'
import DashboardLayout from '../components/shared/DashboardLayout'
import HeaderStatsBar from '../components/shared/HeaderStatsBar'
import ProjectSelector from '../components/shared/ProjectSelector'
import DateRangePicker, { getDateRange } from '../components/shared/DateRangePicker'
import ProjectOverviewGrid from '../components/bruce/ProjectOverviewGrid'
import CMActivityScorecard from '../components/bruce/CMActivityScorecard'
import EntryVolumeTrend from '../components/bruce/EntryVolumeTrend'
import OverdueItemsSummary from '../components/bruce/OverdueItemsSummary'
import AppAdoptionMetrics from '../components/bruce/AppAdoptionMetrics'
import { useDashboardQuery } from '../hooks/useDashboardQuery'
import { getProjectOverview } from '../lib/queries'

export default function BruceDashboard() {
  const [projectId, setProjectId] = useState(null)
  const [dateRange, setDateRange] = useState({ preset: 'week' })

  const { start, end } = getDateRange(dateRange.preset, dateRange.customStart, dateRange.customEnd)

  // Single query powers both the stats bar and the grid
  const queryFn = useCallback(() => getProjectOverview(start, end), [start, end])
  const { data: overview, loading, error } = useDashboardQuery(queryFn, 60000)

  // Compute totals for stats bar (respecting project filter)
  const stats = useMemo(() => {
    if (!overview) {
      return [
        { label: 'Active CMs', value: null, loading: true },
        { label: 'Entries', value: null, loading: true },
        { label: 'Overdue Items', value: null, loading: true },
        { label: 'Photos', value: null, loading: true },
      ]
    }

    const filtered = projectId
      ? overview.rows.filter((r) => r.id === projectId)
      : overview.rows

    const totals = filtered.reduce(
      (acc, r) => ({
        entries: acc.entries + r.entries,
        photos: acc.photos + r.photos,
        overdue: acc.overdue + r.overdueItems,
      }),
      { entries: 0, photos: 0, overdue: 0 }
    )

    return [
      { label: 'Active CMs', value: overview.activeCMs, loading: false },
      { label: 'Entries', value: totals.entries, loading: false },
      { label: 'Overdue Items', value: totals.overdue, loading: false },
      { label: 'Photos', value: totals.photos, loading: false },
    ]
  }, [overview, projectId])

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <ProjectSelector value={projectId} onChange={setProjectId} />
          <DateRangePicker {...dateRange} onChange={setDateRange} />
        </div>

        <HeaderStatsBar stats={stats} />

        <ProjectOverviewGrid
          data={overview?.rows}
          loading={loading}
          error={error}
          projectId={projectId}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CMActivityScorecard startDate={start} endDate={end} />
          <EntryVolumeTrend startDate={start} endDate={end} projectId={projectId} />
          <AppAdoptionMetrics />
          <OverdueItemsSummary projectId={projectId} />
        </div>
      </div>
    </DashboardLayout>
  )
}
