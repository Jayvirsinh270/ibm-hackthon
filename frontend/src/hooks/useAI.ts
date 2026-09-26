// frontend/src/hooks/useAI.ts
// Phase 8 — hook for requesting AI explanations via /api/explain/{repo_id}

import { useState, useCallback } from 'react'
import { explainImpact } from '../api/client'
import type { AIExplanation } from '../types'

interface UseAIResult {
  explanation: AIExplanation | null
  loading: boolean
  error: string | null
  request: (repoId: string, nodeId: string, changeDescription?: string) => Promise<void>
  clear: () => void
}

export function useAI(): UseAIResult {
  const [explanation, setExplanation] = useState<AIExplanation | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const request = useCallback(
    async (repoId: string, nodeId: string, changeDescription?: string) => {
      setLoading(true)
      setError(null)
      setExplanation(null)
      try {
        const data = await explainImpact(repoId, nodeId, changeDescription)
        setExplanation(data.ai)
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : 'AI explanation failed — please try again'
        setError(msg)
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const clear = useCallback(() => {
    setExplanation(null)
    setError(null)
  }, [])

  return { explanation, loading, error, request, clear }
}
