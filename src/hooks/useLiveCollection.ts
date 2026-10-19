import { useCallback, useEffect, useState } from 'react'

export function useLiveCollection<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = useCallback(() => setRefreshKey((key) => key + 1), [])

  useEffect(() => {
    let active = true
    const fetchData = async () => {
      try {
        const result = await load()
        if (active) {
          setData(result)
          setError(null)
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load records.')
      }
    }
    void fetchData()
    const events = new EventSource('/api/events')
    events.onmessage = () => void fetchData()
    events.onopen = () => {
      if (active) {
        setError(null)
        void fetchData()
      }
    }
    events.onerror = () => {
      if (active) setError('Live updates are reconnecting. Data may be briefly out of date.')
    }
    return () => {
      active = false
      events.close()
    }
  }, [load, refreshKey])

  return { data, error, refresh }
}
