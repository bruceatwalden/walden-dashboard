import { useState, useEffect } from 'react'
import { getStorageUrl } from '../../lib/queries'
import { formatDateHeader } from '../../lib/dateUtils'

export default function Lightbox({ photos, startIndex, projectName, onClose }) {
  const [index, setIndex] = useState(startIndex)
  const [zoom, setZoom] = useState(1)

  const photo = photos[index]
  const src = getStorageUrl(photo?.filePath)
  const total = photos.length

  function prev() {
    setIndex((i) => (i > 0 ? i - 1 : total - 1))
    setZoom(1)
  }

  function next() {
    setIndex((i) => (i < total - 1 ? i + 1 : 0))
    setZoom(1)
  }

  function zoomIn() {
    setZoom((z) => Math.min(z + 0.5, 4))
  }

  function zoomOut() {
    setZoom((z) => Math.max(z - 0.5, 0.5))
  }

  function resetZoom() {
    setZoom(1)
  }

  // Scroll-to-zoom
  function handleWheel(e) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setZoom((z) => Math.min(Math.max(z + delta, 0.5), 4))
  }

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e) {
      switch (e.key) {
        case 'ArrowLeft':
          prev()
          break
        case 'ArrowRight':
          next()
          break
        case 'Escape':
          onClose()
          break
        case '+':
        case '=':
          zoomIn()
          break
        case '-':
          zoomOut()
          break
        case '0':
          resetZoom()
          break
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  })

  if (!src) return null

  const phases = photo?.constructionPhases || []
  const photoDate = photo?.photoDate

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: project info */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm text-white/50 tabular-nums shrink-0">
            {index + 1} / {total}
          </span>
          {projectName && (
            <>
              <span className="text-white/20">|</span>
              <span className="text-sm font-medium text-white/80 truncate">
                {projectName}
              </span>
            </>
          )}
          {photoDate && (
            <span className="text-xs text-white/40 shrink-0 hidden sm:inline">
              {formatDateHeader(photoDate)}
            </span>
          )}
        </div>

        {/* Right: zoom controls + close */}
        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            className="p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            title="Zoom out (-)"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
            </svg>
          </button>
          <button
            onClick={resetZoom}
            className="px-2 py-1 rounded text-xs font-medium text-white/50 hover:text-white hover:bg-white/10 transition-colors tabular-nums min-w-[3rem] text-center"
            title="Reset zoom (0)"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={zoomIn}
            className="p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            title="Zoom in (+)"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
          </button>
          <div className="w-px h-4 bg-white/10 mx-1" />
          <button
            onClick={onClose}
            className="p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            title="Close (Esc)"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Image area */}
      <div
        className="flex-1 flex items-center justify-center overflow-auto relative min-h-0"
        onClick={onClose}
        onWheel={handleWheel}
      >
        {/* Previous arrow */}
        {total > 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); prev() }}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/40 text-white/60 hover:text-white hover:bg-black/60 transition-colors"
            title="Previous photo"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        <img
          src={src}
          alt=""
          className="max-h-full object-contain transition-transform duration-200"
          style={{
            transform: `scale(${zoom})`,
            maxWidth: zoom <= 1 ? '100%' : 'none',
          }}
          onClick={(e) => e.stopPropagation()}
          draggable={false}
        />

        {/* Next arrow */}
        {total > 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); next() }}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/40 text-white/60 hover:text-white hover:bg-black/60 transition-colors"
            title="Next photo"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      {/* Bottom bar: phase tags + date on mobile */}
      {(phases.length > 0 || photoDate) && (
        <div
          className="px-4 py-2.5 flex items-center justify-between shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 flex-wrap">
            {phases.map((phase) => (
              <span
                key={phase}
                className="text-[11px] font-medium text-white/60 bg-white/10 px-2 py-0.5 rounded"
              >
                {phase}
              </span>
            ))}
          </div>
          {photoDate && (
            <span className="text-xs text-white/30 sm:hidden">
              {formatDateHeader(photoDate)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
