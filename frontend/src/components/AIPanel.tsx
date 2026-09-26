// frontend/src/components/AIPanel.tsx

import type { AIExplanation } from '../types'

interface Props {
  explanation?: AIExplanation | null
  loading?: boolean
  onRequest?: () => void
}

function SectionBlock({ title, items, ordered = false }: { title: string; items: string[]; ordered?: boolean }) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">{title}</p>
      {ordered ? (
        <ol className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2 text-xs text-gray-400">
              <span className="flex-shrink-0 w-4 h-4 rounded bg-indigo-500/15 text-indigo-400 text-[10px] font-semibold flex items-center justify-center">
                {i + 1}
              </span>
              {item}
            </li>
          ))}
        </ol>
      ) : (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2 text-xs text-gray-400">
              <span className="text-gray-700 mt-0.5">•</span>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function AIPanel({ explanation, loading, onRequest }: Props) {

  // Loading state
  if (loading) {
    return (
      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.04] p-4">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin flex-shrink-0" />
          <div>
            <p className="text-sm text-gray-300 font-medium">Requesting AI analysis…</p>
            <p className="text-xs text-gray-600 mt-0.5">Powered by IBM watsonx.ai</p>
          </div>
        </div>
      </div>
    )
  }

  // Result — unavailable
  if (explanation && !explanation.available) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-gray-600 flex-shrink-0">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M8 5v3M8 10v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <p className="text-xs text-gray-500">
            AI analysis is temporarily unavailable. Deterministic results are shown above.
          </p>
        </div>
      </div>
    )
  }

  // Result — available
  if (explanation) {
    return (
      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.04] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-3.5 py-3 border-b border-indigo-500/10">
          <div className="w-5 h-5 rounded bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3 text-indigo-400">
              <path d="M8 2l1.5 4.5H14l-3.5 2.5 1.5 4.5L8 11l-4 2.5 1.5-4.5L2 6.5h4.5L8 2z" fill="currentColor"/>
            </svg>
          </div>
          <span className="text-xs font-semibold text-gray-300">AI Analysis</span>
          <span className="ml-auto text-[10px] text-gray-600 truncate max-w-[100px]">{explanation.model_used}</span>
        </div>

        <div className="px-3.5 py-3 space-y-3.5">
          {/* Explanation prose */}
          {explanation.explanation && (
            <p className="text-xs text-gray-400 leading-relaxed">{explanation.explanation}</p>
          )}

          <SectionBlock title="Risk Areas"     items={explanation.risk_areas} />
          <SectionBlock title="Migration Plan"  items={explanation.migration_plan} ordered />
          <SectionBlock title="Recommended Tests" items={explanation.recommended_tests} />
        </div>
      </div>
    )
  }

  // Prompt to request
  return (
    <div className="rounded-xl border border-dashed border-white/[0.10] p-4">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-indigo-400">
            <path d="M8 2l1.5 4.5H14l-3.5 2.5 1.5 4.5L8 11l-4 2.5 1.5-4.5L2 6.5h4.5L8 2z" fill="currentColor" fillOpacity="0.7"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-300 mb-0.5">AI-Powered Insights</p>
          <p className="text-xs text-gray-600 leading-relaxed">
            Get an explanation, migration plan, and test recommendations from IBM watsonx.ai
          </p>
        </div>
      </div>
      <button
        onClick={onRequest}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors shadow-md shadow-indigo-900/30"
      >
        <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
          <path d="M8 2l1.5 4.5H14l-3.5 2.5 1.5 4.5L8 11l-4 2.5 1.5-4.5L2 6.5h4.5L8 2z" fill="currentColor" fillOpacity="0.8"/>
        </svg>
        Explain with AI
      </button>
      <p className="text-[10px] text-gray-700 mt-2.5 text-center">
        Structural metadata only · Powered by IBM watsonx.ai
      </p>
    </div>
  )
}
