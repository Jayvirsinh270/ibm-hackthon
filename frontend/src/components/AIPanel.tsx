// frontend/src/components/AIPanel.tsx
// Phase 8 & UI/UX Enhancement — Displays IBM watsonx.ai impact explanation, risk areas, & migration plan

import { useState } from 'react'
import type { AIExplanation } from '../types'

interface Props {
  explanation?: AIExplanation | null
  loading?: boolean
  onRequest?: () => void
  hasScenario?: boolean
}

function SectionBlock({
  title,
  items,
  icon,
  ordered = false,
}: {
  title: string
  items: string[]
  icon: React.ReactNode
  ordered?: boolean
}) {
  if (!items || items.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <span className="text-gray-400">{icon}</span>
        <p className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">
          {title}
        </p>
        <span className="text-[10px] text-gray-500 font-mono bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.06] ml-auto">
          {items.length} {ordered ? 'steps' : 'items'}
        </span>
      </div>

      {ordered ? (
        <ol className="space-y-1.5">
          {items.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 text-xs text-gray-200 bg-white/[0.03] border border-white/[0.07] rounded-xl p-2.5 hover:border-indigo-500/30 transition-colors group"
            >
              <span className="flex-shrink-0 w-5 h-5 rounded-lg bg-indigo-500/20 border border-indigo-500/35 text-indigo-300 text-[11px] font-bold flex items-center justify-center font-mono group-hover:bg-indigo-500/30 group-hover:text-indigo-200 transition-colors">
                {i + 1}
              </span>
              <span className="leading-relaxed pt-0.5">{item}</span>
            </li>
          ))}
        </ol>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 text-xs text-amber-200/90 bg-amber-500/[0.07] border border-amber-500/20 rounded-xl p-2.5 leading-relaxed"
            >
              <span className="text-amber-400 mt-0.5 text-xs flex-shrink-0">⚠</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function AIPanel({ explanation, loading, onRequest }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopyPlan = () => {
    if (!explanation) return

    const lines: string[] = []
    lines.push(`### AI Impact & Migration Assessment`)
    if (explanation.model_used) {
      lines.push(`*Model: ${explanation.model_used} (IBM watsonx.ai)*\n`)
    }
    if (explanation.explanation) {
      lines.push(`${explanation.explanation}\n`)
    }
    if (explanation.risk_areas && explanation.risk_areas.length > 0) {
      lines.push(`#### Risk Areas:`)
      explanation.risk_areas.forEach(r => lines.push(`- ${r}`))
      lines.push('')
    }
    if (explanation.migration_plan && explanation.migration_plan.length > 0) {
      lines.push(`#### Migration Plan:`)
      explanation.migration_plan.forEach((s, i) => lines.push(`${i + 1}. ${s}`))
      lines.push('')
    }
    if (explanation.recommended_tests && explanation.recommended_tests.length > 0) {
      lines.push(`#### Recommended Tests:`)
      explanation.recommended_tests.forEach(t => lines.push(`- ${t}`))
      lines.push('')
    }

    navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Loading state
  if (loading) {
    return (
      <div className="rounded-2xl border border-indigo-500/35 bg-gradient-to-br from-indigo-950/40 via-[#121422] to-[#0c0e17] p-4 shadow-xl shadow-indigo-950/20">
        <div className="flex items-center gap-3 mb-3">
          <div className="relative flex-shrink-0">
            <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
            <span className="absolute inset-0 flex items-center justify-center text-[10px] text-indigo-300">✦</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-white flex items-center gap-2">
              Generating AI Migration Plan…
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/35">
                watsonx.ai
              </span>
            </p>
            <p className="text-[11px] text-indigo-300/80 mt-0.5 animate-pulse">
              Evaluating downstream blast radius & synthesizing staged rollout steps…
            </p>
          </div>
        </div>

        {/* Pulse Skeleton placeholders */}
        <div className="space-y-2 pt-1">
          <div className="h-2.5 bg-indigo-500/15 rounded-full animate-pulse w-full" />
          <div className="h-2.5 bg-indigo-500/10 rounded-full animate-pulse w-5/6" />
          <div className="h-2.5 bg-indigo-500/10 rounded-full animate-pulse w-4/6" />
        </div>
      </div>
    )
  }

  // Result — unavailable
  if (explanation && !explanation.available) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5 shadow-md">
        <div className="flex items-center gap-2.5">
          <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-amber-400 flex-shrink-0">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M8 5v3M8 10v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <div>
            <p className="text-xs font-medium text-gray-300">AI analysis temporarily unavailable</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Deterministic dependency graph results are shown below.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Result — available
  if (explanation) {
    return (
      <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/25 via-[#121422] to-[#0c0e17] overflow-hidden shadow-xl shadow-indigo-950/20 transition-all">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-indigo-500/20 bg-indigo-950/20">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-indigo-500/20 border border-indigo-500/35 text-indigo-300 shadow-inner flex-shrink-0">
              ✦
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white tracking-tight">AI Analysis</span>
                <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/35">
                  watsonx.ai
                </span>
              </div>
              <p className="text-[10px] text-gray-400 truncate mt-0.5" title={explanation.model_used}>
                Model: {explanation.model_used || 'IBM Granite'}
              </p>
            </div>
          </div>

          <button
            onClick={handleCopyPlan}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] hover:border-indigo-400/40 text-gray-300 hover:text-white text-[11px] font-medium transition-all flex-shrink-0 active:scale-95 shadow-sm"
            title="Copy complete migration plan to clipboard"
          >
            {copied ? (
              <>
                <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-emerald-400">
                  <path d="M3 8.5l3.5 3.5L13 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-emerald-300">Copied!</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-gray-400">
                  <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M3 11V3.5A1.5 1.5 0 014.5 2H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <span>Copy Plan</span>
              </>
            )}
          </button>
        </div>

        {/* Content body */}
        <div className="p-4 space-y-4">
          {/* Explanation prose */}
          {explanation.explanation && (
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/30 p-3 border-l-2 border-l-indigo-400">
              <p className="text-[10px] font-semibold text-indigo-300 uppercase tracking-wider mb-1">
                Executive Assessment
              </p>
              <p className="text-xs text-gray-200 leading-relaxed">
                {explanation.explanation}
              </p>
            </div>
          )}

          {/* Risk Areas */}
          <SectionBlock
            title="Risk Areas"
            items={explanation.risk_areas}
            icon={
              <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-amber-400">
                <path d="M8 2L14.5 13.5H1.5L8 2Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M8 6v3.5M8 11.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            }
          />

          {/* Migration Plan */}
          <SectionBlock
            title="Migration Plan"
            items={explanation.migration_plan}
            ordered
            icon={
              <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-indigo-400">
                <path d="M3 4h10M3 8h10M3 12h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            }
          />

          {/* Recommended Tests */}
          {explanation.recommended_tests && explanation.recommended_tests.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-emerald-400">
                  <path d="M6 2h4v6l2 6H4l2-6V2z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.2"/>
                </svg>
                <p className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">
                  Recommended Tests
                </p>
                <span className="text-[10px] text-gray-500 font-mono bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.06] ml-auto">
                  {explanation.recommended_tests.length} tests
                </span>
              </div>
              <ul className="space-y-1.5">
                {explanation.recommended_tests.map((test, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-500/[0.07] border border-emerald-500/20 rounded-xl p-2.5 font-mono"
                  >
                    <span className="text-emerald-400">✓</span>
                    <span className="truncate">{test}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Re-analyze CTA */}
          {onRequest && (
            <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-[10px] text-gray-400">
              <span>Grounding: AST AST & Dependency Traversals</span>
              <button
                onClick={onRequest}
                className="text-indigo-400 hover:text-indigo-300 hover:underline font-medium"
              >
                Re-explain with AI
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Prompt to request AI (when quick impact only was run or AI not requested yet)
  return (
    <div className="rounded-2xl border border-dashed border-indigo-500/30 bg-indigo-950/20 p-4 transition-all hover:border-indigo-500/50">
      <div className="flex items-start gap-3 mb-3.5">
        <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 text-indigo-400 shadow-inner">
          ✦
        </div>
        <div>
          <p className="text-xs font-semibold text-white flex items-center gap-1.5">
            AI-Powered Insights
            <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/35">
              watsonx.ai
            </span>
          </p>
          <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
            Get an automated migration plan, risk areas, and test recommendations from IBM watsonx.ai.
          </p>
        </div>
      </div>

      <button
        onClick={onRequest}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-500 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-lg shadow-indigo-950/50 transition-all active:scale-[0.99] group"
      >
        <span className="group-hover:rotate-12 transition-transform">✦</span>
        <span>Explain with AI</span>
      </button>

      <p className="text-[10px] text-gray-500 mt-2 text-center">
        Structural metadata only · Powered by IBM watsonx.ai
      </p>
    </div>
  )
}
