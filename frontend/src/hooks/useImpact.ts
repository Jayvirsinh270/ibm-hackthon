// frontend/src/hooks/useImpact.ts
// Custom hook for running impact analysis on a selected node

import { useState } from 'react'
import { getImpact } from '../api/client'
import type { ImpactResult } from '../types'

interface UseImpactReturn {
  result: ImpactResult | null
  loading: boolean
  error: string | null
  run: (repoId: string, nodeId: string, changeDescription?: string) => Promise<void>
  clear: () => void
}

export function useImpact(): UseImpactReturn {
  const [result, setResult] = useState<ImpactResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (repoId: string, nodeId: string, changeDescription?: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await getImpact(repoId, nodeId, changeDescription)
      setResult(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Impact analysis failed')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const clear = () => { setResult(null); setError(null) }

  return { result, loading, error, run, clear }
}
