// frontend/src/hooks/useGraph.ts
// Custom hook — fetches graph data and polls scan status until ready

import { useState, useEffect, useRef } from 'react'
import { getGraph, getScanStatus, scanRepository } from '../api/client'
import type { GraphData } from '../types'

type ScanStatus = 'idle' | 'scanning' | 'ready' | 'error'

interface UseGraphReturn {
  graph: GraphData | null
  status: ScanStatus
  scanStage: string | null
  error: string | null
  reload: () => void
}

const POLL_INTERVAL_MS = 1500
const POLL_TIMEOUT_MS  = 60_000   // give up after 60 seconds

export function useGraph(repoId: string): UseGraphReturn {
  const [graph, setGraph]       = useState<GraphData | null>(null)
  const [status, setStatus]     = useState<ScanStatus>('idle')
  const [scanStage, setScanStage] = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopPolling = () => {
    if (pollRef.current)    { clearInterval(pollRef.current);  pollRef.current    = null }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
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
        if (s.scan_stage) setScanStage(s.scan_stage)
        if (s.status === 'ready') {
          await fetchGraph()
        } else if (s.status === 'error') {
          setError(s.error_message ?? 'Scan failed')
          setStatus('error')
          stopPolling()
        }
      } catch {
        // network error — keep polling until timeout
      }
    }, POLL_INTERVAL_MS)

    // Hard timeout — stop polling and surface an error after 60 s
    timeoutRef.current = setTimeout(() => {
      if (pollRef.current) {
        stopPolling()
        setError('Scan timed out after 60 seconds. The repository may be too large or the server is unresponsive.')
        setStatus('error')
      }
    }, POLL_TIMEOUT_MS)
  }

  const reload = () => {
    setGraph(null)
    setError(null)
    setScanStage(null)
    scanRepository(repoId).catch(() => {})
    startPolling()
  }

  useEffect(() => {
    startPolling()
    return stopPolling
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoId])

  return { graph, status, scanStage, error, reload }
}
