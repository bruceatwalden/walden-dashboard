const PRESETS = [
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
]

export function getDateRange(preset, customStart, customEnd) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  switch (preset) {
    case 'today':
      return { start: formatDate(today), end: formatDate(today) }
    case 'week': {
      // Monday of this week through today
      const dayOfWeek = today.getDay()
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      const monday = new Date(today)
      monday.setDate(today.getDate() - mondayOffset)
      return { start: formatDate(monday), end: formatDate(today) }
    }
    case 'month': {
      // 1st of this month through today
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      return { start: formatDate(firstOfMonth), end: formatDate(today) }
    }
    // Legacy presets (in case any state still holds them)
    case '7d': {
      const start = new Date(today)
      start.setDate(start.getDate() - 6)
      return { start: formatDate(start), end: formatDate(today) }
    }
    case '30d': {
      const start = new Date(today)
      start.setDate(start.getDate() - 29)
      return { start: formatDate(start), end: formatDate(today) }
    }
    case 'custom':
      return { start: customStart, end: customEnd }
    default:
      return { start: formatDate(today), end: formatDate(today) }
  }
}

function formatDate(d) {
  return d.toISOString().split('T')[0]
}

function todayStr() {
  return formatDate(new Date())
}

export default function DateRangePicker({ preset, customStart, customEnd, onChange }) {
  return (
    <div className="flex items-center gap-2">
      {PRESETS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange({ preset: p.value })}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            preset === p.value
              ? 'bg-blue-600 text-white'
              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          {p.label}
        </button>
      ))}

      <button
        onClick={() => onChange({ preset: 'custom', customStart: customStart || todayStr(), customEnd: customEnd || todayStr() })}
        className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
          preset === 'custom'
            ? 'bg-blue-600 text-white'
            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
        }`}
      >
        Custom
      </button>

      {preset === 'custom' && (
        <div className="flex items-center gap-1.5 ml-1">
          <input
            type="date"
            value={customStart || ''}
            onChange={(e) => onChange({ preset: 'custom', customStart: e.target.value, customEnd })}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span className="text-gray-400 text-sm">to</span>
          <input
            type="date"
            value={customEnd || ''}
            onChange={(e) => onChange({ preset: 'custom', customStart, customEnd: e.target.value })}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}
    </div>
  )
}
