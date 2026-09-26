// frontend/src/hooks/useGraph.ts
// Custom hook — fetches graph data and polls scan status until ready

import { useState, useEffect, useRef } from 'react'
import { getGraph, getScanStatus, scanRepository } from '../api/client'
import type { GraphData } from '../types'

type ScanStatus = 'idle' | 'scanning' | 'ready' | 'error'

interface UseGraphReturn {
  graph: GraphData | null
  status: ScanStatus
  error: string | null
  reload: () => void
}

export function useGraph(repoId: string): UseGraphReturn {
  const [graph, setGraph]   = useState<GraphData | null>(null)
  const [status, setStatus] = useState<ScanStatus>('idle')
  const [error, setError]   = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  const fetchGraph = async () => {
    try {
      const data = await getGraph(repoId)
      setGraph(data)
      setStatus('ready')
      stopPolling()
    } catch {
      // graph not ready yet — keep polling
    }
  }

  const startPolling = () => {
    stopPolling()
    setStatus('scanning')
    fetchGraph() // try immediately
    pollRef.current = setInterval(async () => {
      try {
        const s = await getScanStatus(repoId)
        if (s.status === 'ready') {
          await fetchGraph()
        } else if (s.status === 'error') {
          setError(s.error_message ?? 'Scan failed')
          setStatus('error')
          stopPolling()
        }
      } catch {
        // network error — keep polling
      }
    }, 1500)
  }

  const reload = () => {
    setGraph(null)
    setError(null)
    scanRepository(repoId).catch(() => {})
    startPolling()
  }

  useEffect(() => {
    startPolling()
    return stopPolling
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoId])

  return { graph, status, error, reload }
}
