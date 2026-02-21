import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useDashboardQuery } from '../hooks/useDashboardQuery'
import { getPhotoGallery, getStorageUrl } from '../lib/queries'
import { formatDateHeader } from '../lib/dateUtils'
import Lightbox from '../components/shared/Lightbox'
import { CONSTRUCTION_PHASES } from '../lib/construction-phases'

// ---------------------------------------------------------------------------
// Date range helpers
// ---------------------------------------------------------------------------

function getGalleryDateRange(preset, customStart, customEnd) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const fmt = (d) => d.toISOString().split('T')[0]

  switch (preset) {
    case 'week': {
      const dayOfWeek = today.getDay()
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      const monday = new Date(today)
      monday.setDate(today.getDate() - mondayOffset)
      return { start: fmt(monday), end: fmt(today) }
    }
    case 'month': {
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      return { start: fmt(firstOfMonth), end: fmt(today) }
    }
    case 'all':
      return { start: null, end: null }
    case 'custom':
      return { start: customStart, end: customEnd }
    default:
      return getGalleryDateRange('week')
  }
}

const PRESETS = [
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'All Time', value: 'all' },
]

// ---------------------------------------------------------------------------
// Justified-row layout algorithm
// ---------------------------------------------------------------------------

// Module-level cache so measured aspect ratios survive re-renders / unmounts
const arCache = new Map()

/**
 * Given items with known aspect ratios, compute rows that fill the container
 * edge-to-edge (Google Photos / Flickr style). The last row is left-aligned
 * at targetHeight rather than being stretched.
 */
function computeJustifiedRows(items, containerWidth, targetHeight, gap) {
  if (items.length === 0 || containerWidth <= 0) return []

  const rows = []
  let cur = []
  let curWidth = 0

  for (const item of items) {
    const w = item.aspectRatio * targetHeight
    const gapW = cur.length > 0 ? gap : 0

    if (cur.length > 0 && curWidth + gapW + w > containerWidth) {
      // Finalise this row — compute the exact height so items fill the width
      const totalAR = cur.reduce((s, it) => s + it.aspectRatio, 0)
      const availW = containerWidth - gap * (cur.length - 1)
      rows.push({ items: cur, height: availW / totalAR })
      cur = []
      curWidth = 0
    }

    cur.push(item)
    curWidth += (cur.length > 1 ? gap : 0) + item.aspectRatio * targetHeight
  }

  // Last (incomplete) row — keep targetHeight but cap if it would overflow
  if (cur.length > 0) {
    const totalW = cur.reduce((s, it) => s + it.aspectRatio * targetHeight, 0)
      + gap * (cur.length - 1)
    if (totalW > containerWidth) {
      const totalAR = cur.reduce((s, it) => s + it.aspectRatio, 0)
      const availW = containerWidth - gap * (cur.length - 1)
      rows.push({ items: cur, height: availW / totalAR })
    } else {
      rows.push({ items: cur, height: targetHeight })
    }
  }

  return rows
}

// ---------------------------------------------------------------------------
// Main gallery page
// ---------------------------------------------------------------------------

export default function PhotoGallery() {
  const [filter, setFilter] = useState({ preset: 'week' })
  const { start, end } = getGalleryDateRange(filter.preset, filter.customStart, filter.customEnd)

  const queryFn = useCallback(() => getPhotoGallery(start, end), [start, end])
  const { data, loading, error } = useDashboardQuery(queryFn, 120000)
  const [expandedProject, setExpandedProject] = useState(null)
  const [clientOnly, setClientOnly] = useState(false)
  const [phaseFilter, setPhaseFilter] = useState('')
  const [lightbox, setLightbox] = useState(null)

  function openLightbox(photos, index, projectName) {
    setLightbox({ photos, index, projectName })
  }

  const filteredData = useMemo(() => {
    if (!data) return null
    if (!clientOnly && !phaseFilter) return data

    const photoFilter = (p) => {
      if (clientOnly && !p.clientVisible) return false
      if (phaseFilter && !(p.constructionPhases || []).includes(phaseFilter)) return false
      return true
    }

    return data
      .map((project) => {
        const dateGroups = project.dateGroups
          .map((g) => ({
            ...g,
            photos: g.photos.filter(photoFilter),
          }))
          .filter((g) => g.photos.length > 0)
        const total = dateGroups.reduce((sum, g) => sum + g.photos.length, 0)
        return { ...project, dateGroups, total }
      })
      .filter((p) => p.total > 0)
  }, [data, clientOnly, phaseFilter])

  const totalPhotos = filteredData ? filteredData.reduce((sum, p) => sum + p.total, 0) : 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">
                Walden
              </h1>
              <p className="text-sm text-gray-400 mt-0.5 font-display">
                Construction Photo Gallery
                {filteredData && (
                  <span className="ml-3 text-gray-300">
                    {totalPhotos} photo{totalPhotos !== 1 ? 's' : ''} &middot; {filteredData.length} project{filteredData.length !== 1 ? 's' : ''}
                  </span>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-md border border-gray-200 overflow-hidden text-sm">
                <button
                  onClick={() => setClientOnly(false)}
                  className={`px-3 py-1.5 transition-colors ${
                    !clientOnly
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setClientOnly(true)}
                  className={`px-3 py-1.5 transition-colors border-l border-gray-200 ${
                    clientOnly
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Client
                </button>
              </div>
              <select
                value={phaseFilter}
                onChange={(e) => setPhaseFilter(e.target.value)}
                className="border border-gray-200 rounded-md px-2 py-1.5 text-sm bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
              >
                <option value="">All Phases</option>
                {CONSTRUCTION_PHASES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <GalleryDateFilter filter={filter} onChange={setFilter} />
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <p className="text-sm text-red-600 mb-4">Failed to load photos: {error.message}</p>
        )}

        {loading && !data ? (
          <LoadingSkeleton />
        ) : !filteredData || filteredData.length === 0 ? (
          <div className="text-center py-20">
            <svg className="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm text-gray-400">No photos found for this period</p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredData.map((project) => (
              <ProjectSection
                key={project.projectId}
                project={project}
                isExpanded={expandedProject === project.projectId}
                onToggle={() =>
                  setExpandedProject(
                    expandedProject === project.projectId ? null : project.projectId
                  )
                }
                onPhotoClick={(photos, index) => openLightbox(photos, index, project.projectName)}
              />
            ))}
          </div>
        )}
      </main>

      {lightbox && (
        <Lightbox
          photos={lightbox.photos}
          startIndex={lightbox.index}
          projectName={lightbox.projectName}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-5 w-36 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-16 bg-gray-100 rounded-full animate-pulse" />
            </div>
            <div className="flex items-center gap-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="w-10 h-10 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Date filter
// ---------------------------------------------------------------------------

function GalleryDateFilter({ filter, onChange }) {
  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PRESETS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange({ preset: p.value })}
          className={`px-2.5 py-1.5 text-xs rounded-md transition-colors ${
            filter.preset === p.value
              ? 'bg-gray-900 text-white'
              : 'bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          {p.label}
        </button>
      ))}
      <button
        onClick={() =>
          onChange({
            preset: 'custom',
            customStart: filter.customStart || todayStr,
            customEnd: filter.customEnd || todayStr,
          })
        }
        className={`px-2.5 py-1.5 text-xs rounded-md transition-colors ${
          filter.preset === 'custom'
            ? 'bg-gray-900 text-white'
            : 'bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50'
        }`}
      >
        Custom
      </button>
      {filter.preset === 'custom' && (
        <div className="flex items-center gap-1.5 ml-1">
          <input
            type="date"
            value={filter.customStart || ''}
            onChange={(e) => onChange({ ...filter, customStart: e.target.value })}
            className="border border-gray-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
          <span className="text-gray-300 text-xs">&ndash;</span>
          <input
            type="date"
            value={filter.customEnd || ''}
            onChange={(e) => onChange({ ...filter, customEnd: e.target.value })}
            className="border border-gray-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Project section (collapsible, with preview strip)
// ---------------------------------------------------------------------------

function ProjectSection({ project, isExpanded, onToggle, onPhotoClick }) {
  const allPhotos = project.dateGroups.flatMap((g) => g.photos)
  const previewPhotos = allPhotos.slice(0, 5)

  return (
    <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50/50 text-left transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-sm font-semibold text-gray-900 truncate">
            {project.projectName}
          </h2>
          <span className="text-xs text-gray-400 tabular-nums shrink-0">
            {project.total}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {!isExpanded && (
            <div className="hidden sm:flex items-center gap-1">
              {previewPhotos.map((photo) => {
                const thumbUrl = getStorageUrl(photo.thumbPath)
                return thumbUrl ? (
                  <div key={photo.id} className="w-10 h-10 rounded overflow-hidden bg-gray-100 shrink-0">
                    <img src={thumbUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                ) : null
              })}
              {project.total > 5 && (
                <span className="text-[10px] text-gray-300 ml-1">+{project.total - 5}</span>
              )}
            </div>
          )}
          <svg
            className={`w-4 h-4 text-gray-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="px-5 pb-5 border-t border-gray-100">
          {(() => {
            let cumulativeIndex = 0
            return project.dateGroups.map(({ date, photos }) => {
              const startIdx = cumulativeIndex
              cumulativeIndex += photos.length

              return (
                <div key={date} className="mt-5">
                  {/* Date header */}
                  <div className="flex items-center gap-3 mb-3">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide shrink-0">
                      {formatDateHeader(date)}
                    </p>
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-[10px] text-gray-300 tabular-nums shrink-0">
                      {photos.length}
                    </span>
                  </div>
                  {/* Justified photo grid */}
                  <JustifiedGallery
                    photos={photos}
                    onPhotoClick={(localIdx) => onPhotoClick(allPhotos, startIdx + localIdx)}
                  />
                </div>
              )
            })
          })()}
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Justified gallery — measures thumbnails, computes rows, renders
// ---------------------------------------------------------------------------

const GAP = 6

function JustifiedGallery({ photos, onPhotoClick }) {
  const containerRef = useRef(null)
  const [containerWidth, setContainerWidth] = useState(0)
  // Incrementing counter to trigger re-render after async measurement completes
  const [, setMeasured] = useState(0)

  // Measure container width via ResizeObserver
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Load aspect ratios for any uncached thumbnails
  const photoIds = photos.map((p) => p.id).join(',')
  useEffect(() => {
    const uncached = photos.filter((p) => !arCache.has(p.id))
    if (uncached.length === 0) return

    let cancelled = false
    let loaded = 0
    const total = uncached.length

    for (const p of uncached) {
      const url = getStorageUrl(p.thumbPath)
      if (!url) {
        arCache.set(p.id, 4 / 3)
        loaded++
        if (loaded === total && !cancelled) setMeasured((n) => n + 1)
        continue
      }
      const img = new Image()
      img.onload = () => {
        arCache.set(p.id, img.naturalWidth / img.naturalHeight)
        loaded++
        if (loaded === total && !cancelled) setMeasured((n) => n + 1)
      }
      img.onerror = () => {
        arCache.set(p.id, 4 / 3)
        loaded++
        if (loaded === total && !cancelled) setMeasured((n) => n + 1)
      }
      img.src = url
    }

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoIds])

  const ready = photos.every((p) => arCache.has(p.id))

  // Responsive target height — shorter on small screens
  const targetHeight = containerWidth < 480 ? 140 : containerWidth < 768 ? 180 : 220

  const rows = useMemo(() => {
    if (!ready || containerWidth <= 0) return []
    const items = photos.map((p, i) => ({
      ...p,
      aspectRatio: arCache.get(p.id) || 4 / 3,
      localIndex: i,
    }))
    return computeJustifiedRows(items, containerWidth, targetHeight, GAP)
  }, [photos, ready, containerWidth, targetHeight])

  return (
    <div ref={containerRef}>
      {!ready || containerWidth === 0 ? (
        <div className="flex gap-1.5">
          {Array.from({ length: Math.min(photos.length, 5) }).map((_, i) => (
            <div key={i} className="h-44 flex-1 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col" style={{ gap: GAP }}>
          {rows.map((row, ri) => (
            <div key={ri} className="flex" style={{ gap: GAP }}>
              {row.items.map((photo) => {
                const w = photo.aspectRatio * row.height
                const thumbUrl = getStorageUrl(photo.thumbPath)
                return (
                  <button
                    key={photo.id}
                    onClick={() => onPhotoClick(photo.localIndex)}
                    className="relative rounded-lg overflow-hidden bg-gray-100 hover:brightness-[.92] transition-all shrink-0"
                    style={{ width: w, height: row.height }}
                  >
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    {photo.clientVisible && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-white" title="Client visible" />
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
