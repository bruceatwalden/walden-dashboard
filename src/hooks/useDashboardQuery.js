import { useState, useEffect, useCallback } from 'react'

export function useDashboardQuery(queryFn, intervalMs = 60000) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refetch = useCallback(async () => {
    try {
      setError(null)
      const result = await queryFn()
      setData(result)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [queryFn])

  useEffect(() => {
    refetch()
    if (intervalMs > 0) {
      const id = setInterval(refetch, intervalMs)
      return () => clearInterval(id)
    }
  }, [refetch, intervalMs])

  return { data, loading, error, refetch }
}
