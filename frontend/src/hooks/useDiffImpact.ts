// frontend/src/hooks/useDiffImpact.ts
// Custom hook for running Git diff impact analysis and Watsonx AI explanations

import { useState } from 'react'
import { getDiffImpact, explainDiffImpact } from '../api/client'
import type { DiffImpactResult } from '../types'

interface UseDiffImpactReturn {
  result: DiffImpactResult | null
  loading: boolean
  aiLoading: boolean
  error: string | null
  run: (repoId: string, diff: string, changeDescription?: string) => Promise<void>
  runWithAi: (repoId: string, diff: string, changeDescription?: string) => Promise<void>
  clear: () => void
}

export function useDiffImpact(): UseDiffImpactReturn {
  const [result, setResult] = useState<DiffImpactResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (repoId: string, diff: string, changeDescription?: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await getDiffImpact(repoId, diff, changeDescription)
      setResult(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Diff impact analysis failed'
      setError(msg)
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const runWithAi = async (repoId: string, diff: string, changeDescription?: string) => {
    setAiLoading(true)
    setError(null)
    try {
      const data = await explainDiffImpact(repoId, diff, changeDescription)
      setResult(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI explanation failed'
      setError(msg)
    } finally {
      setAiLoading(false)
    }
  }

  const clear = () => {
    setResult(null)
    setError(null)
  }

  return { result, loading, aiLoading, error, run, runWithAi, clear }
}
