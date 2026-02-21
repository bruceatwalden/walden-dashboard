import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAuth } from './useAuth'
import { getRecentUncategorizedPhotos, updatePhotoAnalysis, getStorageUrl } from '../lib/queries'
import { categorizePhoto } from '../lib/photo-categorizer'

const AutoCategorizerContext = createContext(null)

const POLL_INTERVAL = 5 * 60 * 1000 // 5 minutes
const BATCH_SIZE = 10
const BATCH_DELAY = 3000 // 3 seconds between batches
const STARTUP_DELAY = 10000 // 10 seconds — let the dashboard load first

export function AutoCategorizerProvider({ children }) {
  const { user } = useAuth()
  const isAuthenticated = !!user
  const [status, setStatus] = useState('idle') // idle | processing | error
  const [pending, setPending] = useState(0)
  const pausedRef = useRef(false)

  const setPaused = useCallback((val) => {
    pausedRef.current = val
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return

    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) return

    let cancelled = false
    let timeoutId = null

    async function run() {
      if (cancelled) return

      // If paused by manual categorizer, check again later
      if (pausedRef.current) {
        timeoutId = setTimeout(run, POLL_INTERVAL)
        return
      }

      try {
        const { photos, totalPending } = await getRecentUncategorizedPhotos(BATCH_SIZE)
        if (cancelled) return

        setPending(totalPending)

        if (totalPending === 0) {
          setStatus('idle')
          timeoutId = setTimeout(run, POLL_INTERVAL)
          return
        }

        setStatus('processing')

        const results = await Promise.allSettled(
          photos.map(async (photo) => {
            const thumbUrl = getStorageUrl(photo.thumb_path)
            const analysis = await categorizePhoto(thumbUrl)
            await updatePhotoAnalysis(photo.id, analysis)
          })
        )

        if (cancelled) return

        const succeeded = results.filter((r) => r.status === 'fulfilled').length
        setPending((prev) => Math.max(0, prev - succeeded))

        if (results.every((r) => r.status === 'rejected')) {
          // All failed — likely API issue, back off
          setStatus('error')
          timeoutId = setTimeout(run, POLL_INTERVAL)
          return
        }

        // Brief pause then process next batch
        timeoutId = setTimeout(run, BATCH_DELAY)
      } catch (err) {
        console.error('Auto-categorizer error:', err)
        if (!cancelled) {
          setStatus('error')
          timeoutId = setTimeout(run, POLL_INTERVAL)
        }
      }
    }

    // Delay startup so initial dashboard data loads first
    timeoutId = setTimeout(run, STARTUP_DELAY)

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [isAuthenticated])

  const value = useMemo(
    () => ({ status, pending, setPaused }),
    [status, pending, setPaused]
  )

  return (
    <AutoCategorizerContext.Provider value={value}>
      {children}
    </AutoCategorizerContext.Provider>
  )
}

export function useAutoCategorizer() {
  return useContext(AutoCategorizerContext)
}
