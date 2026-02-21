export default function HeaderStatsBar({ stats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500">{stat.label}</p>
          <p className="text-2xl font-semibold mt-1">
            {stat.loading ? (
              <span className="inline-block w-8 h-7 bg-gray-200 rounded animate-pulse" />
            ) : (
              stat.value ?? '--'
            )}
          </p>
        </div>
      ))}
    </div>
  )
}
