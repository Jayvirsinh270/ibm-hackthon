// frontend/src/components/NodePanel.tsx
// Sidebar showing selected node details + trigger impact analysis + AI panel

import React, { useState, useEffect } from 'react'
import ImpactPanel from './ImpactPanel'
import AIPanel from './AIPanel'
import type { GraphNode, ImpactResult, AIExplanation } from '../types'

interface Props {
  node: GraphNode
  repoId: string
  impactResult: ImpactResult | null
  impactLoading: boolean
  impactError: string | null
  onAnalyze: (nodeId: string, description: string) => void
  aiExplanation?: AIExplanation | null
  aiLoading?: boolean
  onAiRequest?: () => void
}

const TYPE_ICON: Record<string, React.ReactElement> = {
  file: (
    <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
      <path d="M3 12V4a1 1 0 011-1h5l3 3v6a1 1 0 01-1 1H4a1 1 0 01-1-1z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M8 3v3h3" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  ),
  class: (
    <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
      <circle cx="8" cy="8" r="5" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M5.5 8h5M8 5.5v5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  function: (
    <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
      <path d="M8 2L14 8L8 14L2 8L8 2Z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M5.5 8h5M8 5.5v5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
    </svg>
  ),
  test: (
    <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
      <path d="M6 2h4v6l2 6H4l2-6V2z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  ),
}

const TYPE_COLOR: Record<string, string> = {
  file: 'text-gray-400',
  class: 'text-blue-400',
  function: 'text-violet-400',
  test: 'text-emerald-400',
}

const TYPE_BG: Record<string, string> = {
  file: 'bg-gray-500/10 border-gray-500/20',
  class: 'bg-blue-500/10 border-blue-500/20',
  function: 'bg-violet-500/10 border-violet-500/20',
  test: 'bg-emerald-500/10 border-emerald-500/20',
}

export default function NodePanel({
  node,
  repoId: _repoId,
  impactResult,
  impactLoading,
  impactError,
  onAnalyze,
  aiExplanation,
  aiLoading,
  onAiRequest,
}: Props) {
  const [changeDesc, setChangeDesc] = useState('')
  const MAX_DESC = 500

  // Clear description whenever the selected node changes
  useEffect(() => {
    setChangeDesc('')
  }, [node.id])

  return (
    <div className="flex flex-col gap-3">

      {/* ── Node identity card ─────────────────────────────────────────── */}
      <div className={`rounded-xl border p-3.5 ${TYPE_BG[node.type] ?? TYPE_BG.file}`}>
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex-shrink-0 ${TYPE_COLOR[node.type] ?? 'text-gray-400'}`}>
            {TYPE_ICON[node.type] ?? TYPE_ICON.file}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-white text-sm truncate leading-tight">{node.label}</p>
            {node.module_name && (
              <p className="text-xs text-gray-500 truncate mt-0.5 font-mono">{node.module_name}</p>
            )}
            <p className={`text-xs font-medium mt-1.5 capitalize ${TYPE_COLOR[node.type] ?? 'text-gray-400'}`}>
              {node.type}
              {node.line_number > 0 && (
                <span className="text-gray-600 font-normal ml-1">· line {node.line_number}</span>
              )}
            </p>
          </div>
        </div>

        {node.git_churn > 0 && (
          <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center gap-2">
            <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-amber-500 flex-shrink-0">
              <path d="M8 1v6l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
            <p className="text-xs text-gray-500">
              <span className="text-amber-400 font-medium">{node.git_churn}</span>{' '}
              git commit{node.git_churn !== 1 ? 's' : ''} in history
            </p>
          </div>
        )}
      </div>

      {/* ── Change description ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
            What are you changing? <span className="text-gray-700 font-normal normal-case tracking-normal">(optional)</span>
          </label>
          <span className={`text-[10px] tabular-nums ${changeDesc.length >= MAX_DESC ? 'text-red-400' : 'text-gray-700'}`}>
            {changeDesc.length}/{MAX_DESC}
          </span>
        </div>
        <textarea
          value={changeDesc}
          onChange={e => setChangeDesc(e.target.value.slice(0, MAX_DESC))}
          placeholder="e.g. Refactoring the authentication logic…"
          maxLength={MAX_DESC}
          rows={2}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-gray-300 placeholder-gray-600 resize-none focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.06] transition-colors"
        />
      </div>

      {/* ── Analyse Impact button ──────────────────────────────────────── */}
      <button
        onClick={() => onAnalyze(node.id, changeDesc)}
        disabled={impactLoading}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 disabled:cursor-wait text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors shadow-md shadow-blue-900/30"
      >
        {impactLoading ? (
          <>
            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Analysing…
          </>
        ) : (
          <>
            <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
              <path d="M8 2l1.5 4.5H14l-3.5 2.5 1.5 4.5L8 11l-4 2.5 1.5-4.5L2 6.5h4.5L8 2z" fill="currentColor" fillOpacity="0.8"/>
            </svg>
            Analyse Impact
          </>
        )}
      </button>

      {/* ── Impact error ───────────────────────────────────────────────── */}
      {impactError && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 text-xs text-red-300">
          <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-red-400">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M8 5v3M8 10v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          {impactError}
        </div>
      )}

      {/* ── Impact results ─────────────────────────────────────────────── */}
      {(impactResult || impactLoading) && (
        <ImpactPanel result={impactResult} loading={impactLoading} />
      )}

      {/* ── AI panel ───────────────────────────────────────────────────── */}
      {impactResult && (
        <AIPanel
          explanation={aiExplanation}
          loading={aiLoading}
          onRequest={onAiRequest}
        />
      )}

    </div>
  )
}
