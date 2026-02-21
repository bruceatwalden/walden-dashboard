import { useState } from 'react'

const GALLERY_KEYS = {
  defaultFilter: 'gallery_defaultFilter',
  showClientBadges: 'gallery_showClientBadges',
  targetRowHeight: 'gallery_targetRowHeight',
}

const FILTER_OPTIONS = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Time' },
]

function loadSetting(key, fallback) {
  const stored = localStorage.getItem(key)
  if (stored === null) return fallback
  if (fallback === true || fallback === false) return stored === 'true'
  if (typeof fallback === 'number') return Number(stored) || fallback
  return stored
}

export default function GallerySettingsPage() {
  const [defaultFilter, setDefaultFilter] = useState(() => loadSetting(GALLERY_KEYS.defaultFilter, 'week'))
  const [showClientBadges, setShowClientBadges] = useState(() => loadSetting(GALLERY_KEYS.showClientBadges, true))
  const [targetRowHeight, setTargetRowHeight] = useState(() => loadSetting(GALLERY_KEYS.targetRowHeight, 220))
  const [saved, setSaved] = useState(false)

  function handleSave() {
    localStorage.setItem(GALLERY_KEYS.defaultFilter, defaultFilter)
    localStorage.setItem(GALLERY_KEYS.showClientBadges, String(showClientBadges))
    localStorage.setItem(GALLERY_KEYS.targetRowHeight, String(targetRowHeight))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Gallery Settings</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Configure the public photo gallery at <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">/photos</code>.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-5">
        {/* Default date filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Default Date Filter</label>
          <select
            value={defaultFilter}
            onChange={(e) => setDefaultFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">The filter selected when visitors first open the gallery.</p>
        </div>

        {/* Show client badges */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-gray-700">Show Client Badges</span>
            <p className="text-xs text-gray-400 mt-0.5">Display a green dot on photos from client sources.</p>
          </div>
          <button
            onClick={() => setShowClientBadges(!showClientBadges)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              showClientBadges ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                showClientBadges ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Target row height */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Target Row Height — {targetRowHeight}px
          </label>
          <input
            type="range"
            min={120}
            max={320}
            step={10}
            value={targetRowHeight}
            onChange={(e) => setTargetRowHeight(Number(e.target.value))}
            className="w-64 accent-blue-600"
          />
          <p className="text-xs text-gray-400 mt-1">Controls how tall photo rows appear on desktop. Default: 220px.</p>
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Save Settings
          </button>
          {saved && (
            <span className="text-sm text-green-600">Saved</span>
          )}
          <a
            href="/photos"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-700 ml-auto"
          >
            Preview Gallery
          </a>
        </div>
      </div>
    </div>
  )
}
