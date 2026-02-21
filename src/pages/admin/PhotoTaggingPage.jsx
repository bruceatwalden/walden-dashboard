import { useState, useRef, useEffect, useCallback } from 'react'
import { getUncategorizedPhotosFiltered, getProjects, updatePhotoAnalysis, getStorageUrl } from '../../lib/queries'
import { categorizePhoto } from '../../lib/photo-categorizer'
import { useAutoCategorizer } from '../../hooks/useAutoCategorizer'
import { useDashboardQuery } from '../../hooks/useDashboardQuery'

const BATCH_SIZE = 10

export default function PhotoTaggingPage() {
  // --- Auto-categorizer controls ---
  const autoCat = useAutoCategorizer()

  // --- Manual mode state ---
  const [projectId, setProjectId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | running | stopped | done | error
  const [photos, setPhotos] = useState([])
  const [processed, setProcessed] = useState(0)
  const [results, setResults] = useState([])
  const [errorMsg, setErrorMsg] = useState(null)
  const stopRef = useRef(false)

  const fetchProjects = useCallback(() => getProjects(), [])
  const { data: projects } = useDashboardQuery(fetchProjects, 0)

  // Pause auto-categorizer while manual mode is running
  useEffect(() => {
    if (status === 'running') {
      autoCat?.setPaused(true)
    } else {
      autoCat?.setPaused(false)
    }
  }, [status, autoCat])

  useEffect(() => {
    return () => autoCat?.setPaused(false)
  }, [autoCat])

  async function loadAndStart() {
    setStatus('loading')
    setErrorMsg(null)
    setProcessed(0)
    setResults([])
    stopRef.current = false

    try {
      const uncategorized = await getUncategorizedPhotosFiltered({
        projectId: projectId || null,
        startDate: startDate || null,
        endDate: endDate || null,
      })
      setPhotos(uncategorized)

      if (uncategorized.length === 0) {
        setStatus('done')
        return
      }

      setStatus('running')
      await processBatches(uncategorized)
    } catch (err) {
      setErrorMsg(err.message)
      setStatus('error')
    }
  }

  async function processBatches(allPhotos) {
    for (let i = 0; i < allPhotos.length; i += BATCH_SIZE) {
      if (stopRef.current) {
        setStatus('stopped')
        return
      }

      const batch = allPhotos.slice(i, i + BATCH_SIZE)
      const batchResults = await Promise.allSettled(
        batch.map(async (photo) => {
          const thumbUrl = getStorageUrl(photo.thumb_path)
          const analysis = await categorizePhoto(thumbUrl)
          await updatePhotoAnalysis(photo.id, analysis)
          return { id: photo.id, ...analysis, thumbPath: photo.thumb_path }
        })
      )

      const successes = []
      for (const r of batchResults) {
        if (r.status === 'fulfilled') {
          successes.push(r.value)
        }
      }

      setResults((prev) => [...prev, ...successes])
      setProcessed((prev) => prev + batch.length)

      if (stopRef.current) {
        setStatus('stopped')
        return
      }
    }
    setStatus('done')
  }

  function handleStop() {
    stopRef.current = true
  }

  const total = photos.length
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0
  const isRunning = status === 'running' || status === 'loading'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Photo Tagging</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage automatic and manual photo categorization using Claude Haiku.
        </p>
      </div>

      {/* Auto-Categorizer Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Auto-Categorizer</h3>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">Background processing</span>
              {autoCat && (
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  autoCat.status === 'processing'
                    ? 'bg-blue-100 text-blue-700'
                    : autoCat.status === 'error'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {autoCat.status === 'processing' ? 'Processing' : autoCat.status === 'error' ? 'Error' : 'Idle'}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">
              Polls every 5 minutes for uncategorized photos (Feb 2026+). Processes in batches of 10.
            </p>
            {autoCat && autoCat.pending > 0 && (
              <p className="text-xs text-gray-500">
                {autoCat.pending} photo{autoCat.pending !== 1 ? 's' : ''} pending
              </p>
            )}
          </div>
          {autoCat && (
            <button
              onClick={() => autoCat.setEnabled(!autoCat.enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoCat.enabled ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  autoCat.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Manual Batch Processing */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Manual Batch Processing</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={isRunning}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="">All Projects</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={isRunning}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={isRunning}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadAndStart}
            disabled={isRunning}
            className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {status === 'loading' ? 'Loading...' : 'Categorize'}
          </button>
          {status === 'running' && (
            <button
              onClick={handleStop}
              className="px-4 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
            >
              Stop
            </button>
          )}
        </div>

        {errorMsg && (
          <p className="mt-3 text-sm text-red-600">{errorMsg}</p>
        )}

        {status === 'done' && total === 0 && (
          <p className="mt-3 text-sm text-green-600">
            {projectId || startDate || endDate
              ? 'No uncategorized photos match your filters.'
              : 'All photos are already categorized.'}
          </p>
        )}

        {status === 'stopped' && (
          <p className="mt-3 text-sm text-amber-600">
            Stopped. {processed} of {total} processed. Click Categorize again to continue with remaining.
          </p>
        )}
      </div>

      {/* Progress */}
      {total > 0 && status !== 'idle' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              {status === 'done' ? 'Complete' : 'Processing...'}
            </span>
            <span className="text-sm tabular-nums text-gray-500">
              {processed} / {total} ({pct}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all duration-300 ${
                status === 'done' ? 'bg-green-500' : status === 'stopped' ? 'bg-amber-500' : 'bg-blue-600'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-900 mb-3">
            Categorized ({results.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {results.map((r) => (
              <div key={r.id}>
                <div className="relative aspect-square rounded-md overflow-hidden bg-gray-100">
                  <img
                    src={getStorageUrl(r.thumbPath)}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {r.phases.map((phase, i) => (
                    <span
                      key={phase}
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded leading-none ${
                        i === 0
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {phase}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
