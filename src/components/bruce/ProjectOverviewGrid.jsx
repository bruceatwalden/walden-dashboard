export default function ProjectOverviewGrid({ data, loading, error, projectId }) {
  const rows = data
    ? projectId
      ? data.filter((r) => r.id === projectId)
      : data
    : []

  // Totals row
  const totals = rows.reduce(
    (acc, r) => ({
      entries: acc.entries + r.entries,
      notes: acc.notes + r.notes,
      photos: acc.photos + r.photos,
      emails: acc.emails + r.emails,
      looms: acc.looms + r.looms,
      openItems: acc.openItems + r.openItems,
      overdueItems: acc.overdueItems + r.overdueItems,
    }),
    { entries: 0, notes: 0, photos: 0, emails: 0, looms: 0, openItems: 0, overdueItems: 0 }
  )

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Cross-Project Overview</h3>
        <p className="text-sm text-red-600">Failed to load: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-900">Cross-Project Overview</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="px-6 py-3">Project</th>
              <th className="px-4 py-3 text-right">Entries</th>
              <th className="px-4 py-3 text-right">Notes</th>
              <th className="px-4 py-3 text-right">Photos</th>
              <th className="px-4 py-3 text-right">Emails</th>
              <th className="px-4 py-3 text-right">Looms</th>
              <th className="px-4 py-3 text-right">Open Items</th>
              <th className="px-4 py-3 text-right">Overdue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && !data ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-6 py-3" colSpan={8}>
                    <div className="h-5 bg-gray-100 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-6 py-8 text-center text-gray-400" colSpan={8}>
                  No projects found
                </td>
              </tr>
            ) : (
              <>
                {rows.map((row) => {
                  const hasActivity = row.entries > 0 || row.notes > 0 || row.photos > 0 || row.emails > 0 || row.looms > 0
                  return (
                    <tr
                      key={row.id}
                      className={hasActivity ? 'bg-green-50' : 'bg-gray-50/50'}
                    >
                      <td className="px-6 py-3 font-medium text-gray-900">{row.name}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.entries || <Dim />}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.notes || <Dim />}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.photos || <Dim />}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.emails || <Dim />}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.looms || <Dim />}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.openItems || <Dim />}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.overdueItems > 0 ? (
                          <span className="inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            {row.overdueItems}
                          </span>
                        ) : (
                          <Dim />
                        )}
                      </td>
                    </tr>
                  )
                })}
                <tr className="bg-gray-50 font-medium border-t border-gray-200">
                  <td className="px-6 py-3 text-gray-700">Totals</td>
                  <td className="px-4 py-3 text-right tabular-nums">{totals.entries}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{totals.notes}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{totals.photos}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{totals.emails}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{totals.looms}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{totals.openItems}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {totals.overdueItems > 0 ? (
                      <span className="inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        {totals.overdueItems}
                      </span>
                    ) : (
                      '0'
                    )}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Dim() {
  return <span className="text-gray-300">0</span>
}
