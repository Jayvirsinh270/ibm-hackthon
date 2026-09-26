// frontend/src/components/AIPanel.tsx
// Phase 8 — AI explanation panel (stub shown until Phase 8)

import type { AIExplanation } from '../types'

interface Props {
  explanation?: AIExplanation | null
  loading?: boolean
  onRequest?: () => void
}

export default function AIPanel({ explanation, loading, onRequest }: Props) {
  // Loading state
  if (loading) {
    return (
      <div className="border border-gray-700 rounded-xl p-4 bg-gray-900 animate-pulse">
        <p className="text-xs text-gray-500">🤖 Requesting AI explanation…</p>
      </div>
    )
  }

  // Result
  if (explanation) {
    if (!explanation.available) {
      return (
        <div className="border border-gray-700 rounded-xl p-4 bg-gray-900">
          <p className="text-xs text-gray-500">
            🤖 AI analysis is temporarily unavailable. Deterministic results are shown above.
          </p>
        </div>
      )
    }

    return (
      <div className="border border-gray-700 rounded-xl p-4 bg-gray-900 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">🤖</span>
          <span className="text-xs font-semibold text-gray-300">AI Analysis</span>
          <span className="text-xs text-gray-600 ml-auto">
            {explanation.model_used} · AI-assisted
          </span>
        </div>

        {explanation.explanation && (
          <p className="text-sm text-gray-300">{explanation.explanation}</p>
        )}

        {explanation.risk_areas.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-1">⚠ Risk Areas</p>
            <ul className="space-y-1">
              {explanation.risk_areas.map((r, i) => (
                <li key={i} className="text-xs text-gray-400">• {r}</li>
              ))}
            </ul>
          </div>
        )}

        {explanation.migration_plan.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-1">📋 Migration Plan</p>
            <ol className="space-y-1 list-decimal list-inside">
              {explanation.migration_plan.map((step, i) => (
                <li key={i} className="text-xs text-gray-400">{step}</li>
              ))}
            </ol>
          </div>
        )}

        {explanation.recommended_tests.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-1">🧪 Recommended Tests</p>
            <ul className="space-y-1">
              {explanation.recommended_tests.map((t, i) => (
                <li key={i} className="text-xs text-gray-400">• {t}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  // Prompt to request
  return (
    <div className="border border-dashed border-gray-700 rounded-xl p-4">
      <p className="text-xs text-gray-500 mb-3">
        🤖 Get an AI-powered explanation, migration plan, and test recommendations.
      </p>
      <button
        onClick={onRequest}
        className="w-full bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-medium
                   px-4 py-2 rounded-lg transition-colors"
      >
        Explain with AI →
      </button>
      <p className="text-xs text-gray-700 mt-2 text-center">
        Powered by IBM watsonx.ai · Structural metadata only
      </p>
    </div>
  )
}
