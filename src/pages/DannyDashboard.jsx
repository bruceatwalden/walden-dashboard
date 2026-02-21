import { useState, useCallback, useMemo } from 'react'
import DashboardLayout from '../components/shared/DashboardLayout'
import HeaderStatsBar from '../components/shared/HeaderStatsBar'
import ProjectSelector from '../components/shared/ProjectSelector'
import DateRangePicker, { getDateRange } from '../components/shared/DateRangePicker'
import DailyEntryHeatmap from '../components/danny/DailyEntryHeatmap'
import LoomVideoFeed from '../components/danny/LoomVideoFeed'
import PhotoActivitySummary from '../components/danny/PhotoActivitySummary'
import SiteSafetyEntries from '../components/danny/SiteSafetyEntries'
import SiteActivityThisWeek from '../components/danny/SiteActivityThisWeek'
import { useDashboardQuery } from '../hooks/useDashboardQuery'
import { getDannyOverview } from '../lib/queries'

export default function DannyDashboard() {
  const [projectId, setProjectId] = useState(null)
  const [dateRange, setDateRange] = useState({ preset: 'week' })

  const { start, end } = getDateRange(dateRange.preset, dateRange.customStart, dateRange.customEnd)

  // Overview query powers both the stats bar and the heatmap
  const queryFn = useCallback(() => getDannyOverview(start, end), [start, end])
  const { data: overview, loading, error } = useDashboardQuery(queryFn, 60000)

  const stats = useMemo(() => {
    if (!overview) {
      return [
        { label: 'Entries', value: null, loading: true },
        { label: 'Looms', value: null, loading: true },
        { label: 'Photos', value: null, loading: true },
        { label: 'Safety Logged', value: null, loading: true },
      ]
    }

    const filtered = projectId
      ? overview.rows.filter((r) => r.id === projectId)
      : overview.rows

    const totals = filtered.reduce(
      (acc, r) => ({
        entries: acc.entries + r.entries,
        photos: acc.photos + r.photos,
        looms: acc.looms + r.looms,
        safetyCount: acc.safetyCount + (r.hasSafety ? 1 : 0),
      }),
      { entries: 0, photos: 0, looms: 0, safetyCount: 0 }
    )

    const safetyLabel = projectId
      ? totals.safetyCount > 0
        ? 'Yes'
        : 'No'
      : `${totals.safetyCount}/${filtered.length}`

    return [
      { label: 'Entries', value: totals.entries, loading: false },
      { label: 'Looms', value: totals.looms, loading: false },
      { label: 'Photos', value: totals.photos, loading: false },
      { label: 'Safety Logged', value: safetyLabel, loading: false },
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

        <DailyEntryHeatmap
          data={overview?.rows}
          loading={loading}
          error={error}
          projectId={projectId}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LoomVideoFeed startDate={start} endDate={end} projectId={projectId} />
          <PhotoActivitySummary startDate={start} endDate={end} projectId={projectId} />
          <SiteSafetyEntries startDate={start} endDate={end} projectId={projectId} />
        </div>

        <SiteActivityThisWeek projectId={projectId} />
      </div>
    </DashboardLayout>
  )
}
