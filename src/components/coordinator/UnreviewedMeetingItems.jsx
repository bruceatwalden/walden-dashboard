import { useCallback } from 'react'
import { useDashboardQuery } from '../../hooks/useDashboardQuery'
import { getUnreviewedMeetingItems } from '../../lib/queries'

export default function UnreviewedMeetingItems({ projectId }) {
  const queryFn = useCallback(() => getUnreviewedMeetingItems(projectId), [projectId])
  const { data, loading, error } = useDashboardQuery(queryFn, 60000)

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Unreviewed Meeting Items</h3>
        <p className="text-sm text-red-600">Failed to load: {error.message}</p>
      </div>
    )
  }

  // Group by meeting
  const grouped = {}
  if (data) {
    for (const item of data) {
      const key = item.meetingTitle + '|' + item.meetingDate
      if (!grouped[key]) {
        grouped[key] = {
          meetingTitle: item.meetingTitle,
          meetingDate: item.meetingDate,
          projectName: item.projectName,
          items: [],
        }
      }
      grouped[key].items.push(item)
    }
  }
  const meetings = Object.values(grouped)

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-gray-900">Unreviewed Meeting Items</h3>
          {data && data.length > 0 && (
            <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
              {data.length} pending
            </span>
          )}
        </div>
      </div>

      {loading && !data ? (
        <div className="p-6 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="p-6">
          <p className="text-sm text-gray-400 text-center py-4">All meeting items have been reviewed</p>
        </div>
      ) : (
        <div className="max-h-[28rem] overflow-y-auto">
          {meetings.map((meeting) => (
            <div key={meeting.meetingTitle + meeting.meetingDate}>
              {/* Meeting header */}
              <div className="sticky top-0 z-10 px-6 py-2.5 bg-gradient-to-r from-orange-50/60 to-white border-b border-orange-100">
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs font-semibold text-gray-700">{meeting.meetingTitle}</span>
                  <span className="text-xs text-gray-400">{meeting.projectName}</span>
                  {meeting.meetingDate && (
                    <span className="text-xs text-gray-400">&middot; {formatDate(meeting.meetingDate)}</span>
                  )}
                  <span className="text-xs text-orange-500 ml-auto">{meeting.items.length} items</span>
                </div>
              </div>

              {/* Items */}
              <div className="divide-y divide-gray-50">
                {meeting.items.map((item) => (
                  <div key={item.id} className="px-6 py-3 hover:bg-gray-50/50 transition-colors">
                    <p className="text-sm text-gray-900">{item.description}</p>
                    {item.assignee && (
                      <p className="text-xs text-gray-400 mt-1">
                        Assigned to: <span className="text-gray-500">{item.assignee}</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
