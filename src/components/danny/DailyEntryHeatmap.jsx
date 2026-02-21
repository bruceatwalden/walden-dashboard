import { useState } from 'react'

export default function DailyEntryHeatmap({ data, loading, error, projectId }) {
  const [expanded, setExpanded] = useState(false)

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Daily Entry Heatmap</h3>
        <p className="text-sm text-red-600">Failed to load: {error.message}</p>
      </div>
    )
  }

  const activeRows = data
    ? projectId
      ? data.filter((r) => r.id === projectId)
      : data.filter((r) => r.entries > 0 || r.photos > 0 || r.looms > 0)
    : []

  const allRows = data
    ? projectId
      ? data.filter((r) => r.id === projectId)
      : data
    : []

  // Summary counts for collapsed view
  const summary = data
    ? {
        withEntries: data.filter((r) => r.entries > 0).length,
        withSafety: data.filter((r) => r.hasSafety).length,
        withPhotos: data.filter((r) => r.photos > 0).length,
        allSubmitted: data.filter((r) => r.entries > 0 && r.submitted === r.entries).length,
        total: data.length,
      }
    : null

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 border-b border-gray-200 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-gray-900">Daily Entry Heatmap</h3>
          {!expanded && summary && (
            <div className="flex items-center gap-2">
              <Pill label={`${summary.withEntries}/${summary.total} active`} color="blue" />
              <Pill label={`${summary.withSafety} safety`} color={summary.withSafety > 0 ? 'green' : 'red'} />
              <Pill label={`${summary.allSubmitted} submitted`} color="gray" />
            </div>
          )}
          {!expanded && loading && !data && (
            <div className="h-5 w-32 bg-gray-100 rounded animate-pulse" />
          )}
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        loading && !data ? (
          <div className="p-6">
            <div className="h-48 bg-gray-100 rounded animate-pulse" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-2 font-medium text-gray-600 whitespace-nowrap">Project</th>
                  <th className="text-center px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Entries</th>
                  <th className="text-center px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Safety</th>
                  <th className="text-center px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Attendance</th>
                  <th className="text-center px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Walden General</th>
                  <th className="text-center px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Close Up</th>
                  <th className="text-center px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Photos</th>
                  <th className="text-center px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Smartsheet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allRows.map((row) => (
                  <HeatmapRow key={row.id} row={row} />
                ))}
                {allRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-sm text-gray-400">
                      No projects found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}

function Pill({ label, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-600',
    gray: 'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[color] || colors.gray}`}>
      {label}
    </span>
  )
}

function HeatmapRow({ row }) {
  const hasActivity = row.entries > 0 || row.photos > 0

  let ssStatus = 'none'
  let ssLabel = '--'
  if (row.entries > 0) {
    if (row.submitted === row.entries) {
      ssStatus = 'complete'
      ssLabel = 'Complete'
    } else if (row.submitted > 0) {
      ssStatus = 'partial'
      ssLabel = `${row.submitted}/${row.entries}`
    } else {
      ssStatus = 'pending'
      ssLabel = 'Pending'
    }
  }

  return (
    <tr className={hasActivity ? '' : 'bg-gray-50/50'}>
      <td className="px-4 py-2.5 font-medium text-gray-900 whitespace-nowrap">{row.name}</td>
      <td className="text-center px-3 py-2.5">
        {row.entries > 0 ? (
          <span className="text-sm font-semibold tabular-nums text-gray-900">{row.entries}</span>
        ) : (
          <span className="text-gray-300">--</span>
        )}
      </td>
      <BoolCell value={row.hasSafety} hasEntries={row.entries > 0} />
      <BoolCell value={row.hasAttendance} hasEntries={row.entries > 0} />
      <BoolCell value={row.hasWaldenGeneral} hasEntries={row.entries > 0} />
      <BoolCell value={row.hasCloseUp} hasEntries={row.entries > 0} />
      <td className="text-center px-3 py-2.5">
        {row.photos > 0 ? (
          <span className="text-sm font-semibold tabular-nums text-gray-900">{row.photos}</span>
        ) : (
          <span className="text-gray-300">--</span>
        )}
      </td>
      <td className="text-center px-3 py-2.5">
        <span
          className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
            ssStatus === 'complete'
              ? 'bg-green-50 text-green-700'
              : ssStatus === 'partial'
                ? 'bg-yellow-50 text-yellow-700'
                : ssStatus === 'pending'
                  ? 'bg-red-50 text-red-700'
                  : 'text-gray-300'
          }`}
        >
          {ssLabel}
        </span>
      </td>
    </tr>
  )
}

function BoolCell({ value, hasEntries }) {
  if (!hasEntries) {
    return <td className="text-center px-3 py-2.5 text-gray-300">--</td>
  }
  return (
    <td className="text-center px-3 py-2.5">
      {value ? (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-50 text-green-600">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </span>
      ) : (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-50 text-red-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </span>
      )}
    </td>
  )
}
