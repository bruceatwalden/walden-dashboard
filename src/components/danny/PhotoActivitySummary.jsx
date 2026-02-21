import { useCallback, useState, useMemo } from 'react'
import { useDashboardQuery } from '../../hooks/useDashboardQuery'
import { getPhotoActivity, getStorageUrl } from '../../lib/queries'
import { formatDateHeader } from '../../lib/dateUtils'
import { CONSTRUCTION_PHASES } from '../../lib/construction-phases'
import Lightbox from '../shared/Lightbox'

function groupPhotosByDate(photos) {
  const groups = {}
  for (const photo of photos) {
    const date = photo.photoDate || 'Unknown'
    if (!groups[date]) groups[date] = []
    groups[date].push(photo)
  }
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, photos]) => ({ date, photos }))
}

export default function PhotoActivitySummary({ startDate, endDate, projectId }) {
  const queryFn = useCallback(
    () => getPhotoActivity(startDate, endDate, projectId),
    [startDate, endDate, projectId]
  )
  const { data, loading, error } = useDashboardQuery(queryFn, 60000)
  const [expandedProject, setExpandedProject] = useState(null)
  const [phaseFilter, setPhaseFilter] = useState('')
  const [lightbox, setLightbox] = useState(null) // { photos, index }

  function openLightbox(photos, index) {
    setLightbox({ photos, index })
  }

  const filteredData = useMemo(() => {
    if (!data) return null
    if (!phaseFilter) return data
    return data
      .map((group) => {
        const photos = group.photos.filter((p) => (p.constructionPhases || []).includes(phaseFilter))
        return { ...group, photos, total: photos.length }
      })
      .filter((g) => g.total > 0)
  }, [data, phaseFilter])

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Photo Activity</h3>
        <p className="text-sm text-red-600">Failed to load: {error.message}</p>
      </div>
    )
  }

  const totalPhotos = filteredData ? filteredData.reduce((sum, g) => sum + g.total, 0) : 0

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-gray-900">Photo Activity</h3>
        <div className="flex items-center gap-2">
          <select
            value={phaseFilter}
            onChange={(e) => setPhaseFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1 text-xs bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Phases</option>
            {CONSTRUCTION_PHASES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          {filteredData && (
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              {totalPhotos} total
            </span>
          )}
        </div>
      </div>

      {loading && !filteredData ? (
        <div className="p-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : !filteredData || filteredData.length === 0 ? (
        <div className="p-6">
          <p className="text-sm text-gray-400 text-center py-4">No photos in this period</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 max-h-[32rem] overflow-y-auto">
          {filteredData.map((group) => (
            <ProjectPhotoRow
              key={group.projectId}
              group={group}
              isExpanded={expandedProject === group.projectId}
              onToggle={() =>
                setExpandedProject(
                  expandedProject === group.projectId ? null : group.projectId
                )
              }
              onPhotoClick={(index) => openLightbox(group.photos, index)}
            />
          ))}
        </div>
      )}

      {lightbox && (
        <Lightbox
          photos={lightbox.photos}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}

function ProjectPhotoRow({ group, isExpanded, onToggle, onPhotoClick }) {
  const dateGroups = isExpanded ? groupPhotosByDate(group.photos) : []

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full px-6 py-3 flex items-center justify-between hover:bg-gray-50 text-left"
      >
        <div>
          <p className="text-sm font-medium text-gray-900">{group.projectName}</p>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-gray-500">
              {group.total} photo{group.total !== 1 ? 's' : ''}
            </span>
            {group.clientVisible > 0 && (
              <span className="text-xs text-green-600">
                {group.clientVisible} client-visible
              </span>
            )}
            {group.uploaders.length > 0 && (
              <span className="text-xs text-gray-400">
                By: {group.uploaders.join(', ')}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold tabular-nums text-gray-900">{group.total}</span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="px-6 pb-4">
          {(() => {
            let cumulativeIndex = 0
            return dateGroups.map(({ date, photos }) => {
              const startIdx = cumulativeIndex
              cumulativeIndex += photos.length
              return (
                <div key={date} className="mb-3">
                  <p className="text-xs font-medium text-gray-500 mb-1.5">
                    {formatDateHeader(date)}
                  </p>
                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                    {photos.map((photo, i) => {
                      const thumbUrl = getStorageUrl(photo.thumbPath)
                      return (
                        <button
                          key={photo.id}
                          onClick={() => onPhotoClick(startIdx + i)}
                          className="aspect-square rounded-md overflow-hidden bg-gray-100 hover:ring-2 hover:ring-blue-400 transition-all"
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
                              <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })
          })()}
        </div>
      )}
    </div>
  )
}
