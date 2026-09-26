import React, { useState, useEffect } from 'react'
import ImpactPanel from './ImpactPanel'
import AIPanel from './AIPanel'
import { explainNode } from '../api/client'
import type { GraphNode, ImpactResult, AIExplanation, NodeSummaryResponse } from '../types'

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
  onViewSource?: (filePath: string, targetLine?: number, symbolName?: string) => void
  onLayoutHierarchy?: (nodeId: string, scope: 'component' | 'lineage') => void
  onResetLayout?: () => void
  isHierarchyActive?: boolean
  hierarchyNodeCount?: number
  hierarchyScope?: 'component' | 'lineage'
  onScopeChange?: (scope: 'component' | 'lineage') => void
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
  repoId,
  impactResult,
  impactLoading,
  impactError,
  onAnalyze,
  aiExplanation,
  aiLoading,
  onAiRequest,
  onViewSource,
  onLayoutHierarchy,
  onResetLayout,
  isHierarchyActive,
  hierarchyNodeCount,
  hierarchyScope = 'component',
  onScopeChange,
}: Props) {
  const [changeDesc, setChangeDesc] = useState('')
  const MAX_DESC = 500

  // Watsonx Node Purpose Summary state
  const [summary, setSummary] = useState<NodeSummaryResponse | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [summaryExpanded, setSummaryExpanded] = useState(true)

  // Clear description and summary whenever the selected node changes
  useEffect(() => {
    setChangeDesc('')
    setSummary(null)
    setSummaryLoading(false)
    setSummaryError(null)
    setSummaryExpanded(true)
  }, [node.id])

  const handleExplainNode = async () => {
    if (summaryLoading) return
    setSummaryLoading(true)
    setSummaryError(null)
    try {
      const res = await explainNode(repoId, node.id)
      setSummary(res)
      setSummaryExpanded(true)
    } catch (err: unknown) {
      const errorMsg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : null
      setSummaryError(errorMsg || (err instanceof Error ? err.message : 'Failed to explain node'))
    } finally {
      setSummaryLoading(false)
    }
  }

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

        {/* Action Buttons: View Source & Hierarchy Tree */}
        <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex flex-col gap-2">
          <div className={`grid ${node.file_path ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
            {node.file_path && (
              <button
                onClick={() => onViewSource?.(node.file_path, node.line_number, node.label)}
                className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-white/[0.05] hover:bg-cyan-500/10 border border-white/[0.08] hover:border-cyan-500/30 text-xs font-mono text-gray-300 hover:text-cyan-300 transition-all group shadow-sm"
                title="Inspect source code in-app with target line highlighted"
              >
                <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform flex-shrink-0">
                  <path d="M5 4L2 8l3 4M11 4l3 4-3 4M9 2.5l-2 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="truncate">View Source</span>
              </button>
            )}

            <button
              onClick={() => {
                if (isHierarchyActive) {
                  onResetLayout?.()
                } else {
                  onLayoutHierarchy?.(node.id, hierarchyScope)
                }
              }}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all group shadow-sm border ${
                isHierarchyActive
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30 shadow-amber-500/10'
                  : 'bg-white/[0.05] hover:bg-emerald-500/10 border-white/[0.08] hover:border-emerald-500/30 text-gray-300 hover:text-emerald-300'
              }`}
              title={
                isHierarchyActive
                  ? "Reset graph back to organic force-directed layout"
                  : "Re-arrange all connected nodes into a top-to-bottom hierarchy"
              }
            >
              <svg viewBox="0 0 16 16" fill="none" className={`w-3.5 h-3.5 ${isHierarchyActive ? 'text-amber-400' : 'text-emerald-400 group-hover:scale-110'} transition-transform flex-shrink-0`}>
                <path d="M8 2v4M8 6l-4 4M8 6l4 4M4 10v3M12 10v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="8" cy="2" r="1.5" fill="currentColor"/>
                <circle cx="4" cy="13" r="1.5" fill="currentColor"/>
                <circle cx="12" cy="13" r="1.5" fill="currentColor"/>
              </svg>
              <span className="truncate">{isHierarchyActive ? 'Reset Layout' : 'Hierarchy Tree'}</span>
            </button>
          </div>

          {/* Active Hierarchy Sub-bar */}
          {isHierarchyActive && (
            <div className="p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/25 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-emerald-300 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                <span className="truncate">Hierarchy: {hierarchyNodeCount ?? 'Connected'} nodes</span>
              </div>
              <button
                onClick={() => {
                  const nextScope = hierarchyScope === 'component' ? 'lineage' : 'component'
                  onScopeChange?.(nextScope)
                  onLayoutHierarchy?.(node.id, nextScope)
                }}
                className="text-[10px] text-gray-300 hover:text-cyan-300 px-2 py-0.5 rounded bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] transition-colors flex-shrink-0"
                title="Switch between entire connected cluster and direct callers/callees lineage"
              >
                {hierarchyScope === 'component' ? 'Full Cluster' : 'Lineage'} ⇄
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Watsonx AI Purpose Summary Card ────────────────────────────── */}
      <div className="rounded-xl border border-indigo-500/25 bg-gradient-to-b from-indigo-950/20 via-purple-950/10 to-[#121620] p-3.5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-md bg-indigo-500/20 text-indigo-400">
              <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
                <path d="M8 1.5l1.5 3.5 3.5 1.5-3.5 1.5L8 11.5l-1.5-3.5L3 6.5l3.5-1.5L8 1.5z" fill="currentColor"/>
                <path d="M13 11l.75 1.75L15.5 13.5l-1.75.75L13 16l-.75-1.75L10.5 13.5l1.75-.75L13 11z" fill="currentColor" opacity="0.7"/>
              </svg>
            </span>
            <div>
              <h4 className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                What does this {node.type} do?
                <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  watsonx.ai
                </span>
              </h4>
              <p className="text-[11px] text-gray-400">Grounded code purpose & contract summary</p>
            </div>
          </div>

          {summary && (
            <button
              onClick={() => setSummaryExpanded(!summaryExpanded)}
              className="text-gray-400 hover:text-gray-200 text-xs p-1"
              title={summaryExpanded ? "Collapse summary" : "Expand summary"}
            >
              <svg viewBox="0 0 16 16" fill="none" className={`w-3.5 h-3.5 transition-transform ${summaryExpanded ? 'rotate-180' : ''}`}>
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>

        {!summary && !summaryLoading && (
          <div className="mt-3">
            <button
              onClick={handleExplainNode}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/30 hover:border-indigo-400/50 text-indigo-200 text-xs font-medium transition-all shadow-sm group"
            >
              <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-indigo-300 group-hover:rotate-12 transition-transform">
                <path d="M8 1.5l1.5 3.5 3.5 1.5-3.5 1.5L8 11.5l-1.5-3.5L3 6.5l3.5-1.5L8 1.5z" fill="currentColor"/>
              </svg>
              <span>Explain Code Purpose (Watsonx)</span>
            </button>
            {summaryError && (
              <p className="mt-2 text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded p-1.5">{summaryError}</p>
            )}
          </div>
        )}

        {summaryLoading && (
          <div className="mt-3 py-3 px-3 rounded-lg bg-indigo-950/30 border border-indigo-500/20 flex items-center gap-2.5">
            <div className="w-3.5 h-3.5 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin flex-shrink-0" />
            <span className="text-xs text-indigo-200 animate-pulse">
              Watsonx Granite reading AST & dependency graph…
            </span>
          </div>
        )}

        {summary && summaryExpanded && (
          <div className="mt-3 flex flex-col gap-2.5 text-xs">
            {/* Purpose */}
            <div className="bg-[#12151e]/80 rounded-lg p-2.5 border border-white/[0.05]">
              <p className="text-[10px] font-semibold text-indigo-300 uppercase tracking-wider mb-1">
                Core Purpose
              </p>
              <p className="text-gray-200 leading-relaxed text-xs">
                {summary.purpose}
              </p>
            </div>

            {/* Responsibilities */}
            {summary.responsibilities && summary.responsibilities.length > 0 && (
              <div className="bg-[#12151e]/80 rounded-lg p-2.5 border border-white/[0.05]">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Key Responsibilities
                </p>
                <ul className="space-y-1">
                  {summary.responsibilities.map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-gray-300">
                      <span className="text-indigo-400 mt-0.5">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Input / Output Contract */}
            {summary.inputs_and_outputs && (
              <div className="bg-[#12151e]/80 rounded-lg p-2.5 border border-white/[0.05]">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Contract & Data Flow
                </p>
                <p className="text-gray-300 font-mono text-[11px] break-words">
                  {summary.inputs_and_outputs}
                </p>
              </div>
            )}

            {/* Architecture & Complexity Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {summary.architectural_role && (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-500/10 text-purple-300 border border-purple-500/20 font-medium">
                  Role: {summary.architectural_role}
                </span>
              )}
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  summary.complexity_rating === 'HIGH'
                    ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                    : summary.complexity_rating === 'MEDIUM'
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                }`}
              >
                Complexity: {summary.complexity_rating}
              </span>
            </div>

            {/* Grounding & Refresh */}
            <div className="flex items-center justify-between pt-1 border-t border-white/[0.05] text-[10px] text-gray-400">
              <span className="truncate max-w-[200px]" title={summary.model_used}>
                Model: {summary.model_used || 'IBM Granite'}
              </span>
              <button
                onClick={handleExplainNode}
                className="text-indigo-400 hover:text-indigo-300 hover:underline"
              >
                Re-analyze
              </button>
            </div>
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
