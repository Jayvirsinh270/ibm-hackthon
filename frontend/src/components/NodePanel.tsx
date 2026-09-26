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
  onLayoutHierarchy?: (nodeId: string, scope: 'lineage' | 'deep' | 'component') => void
  onResetLayout?: () => void
  isHierarchyActive?: boolean
  hierarchyNodeCount?: number
  hierarchyScope?: 'lineage' | 'deep' | 'component'
  onScopeChange?: (scope: 'lineage' | 'deep' | 'component') => void
}

const TYPE_ICON: Record<string, React.ReactElement> = {
  file: (
    <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
      <path d="M3 12V4a1 1 0 011-1h5l3 3v6a1 1 0 01-1 1H4a1 1 0 01-1-1z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M8 3v3h3" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  ),
  class: (
    <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
      <circle cx="8" cy="8" r="5" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M5.5 8h5M8 5.5v5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  function: (
    <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
      <path d="M8 2L14 8L8 14L2 8L8 2Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M5.5 8h5M8 5.5v5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
    </svg>
  ),
  test: (
    <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
      <path d="M6 2h4v6l2 6H4l2-6V2z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.2"/>
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
  file: 'bg-gradient-to-b from-gray-900/40 via-gray-950/20 to-[#10141d] border-gray-500/25',
  class: 'bg-gradient-to-b from-blue-950/40 via-blue-950/15 to-[#10141d] border-blue-500/30',
  function: 'bg-gradient-to-b from-violet-950/40 via-violet-950/15 to-[#10141d] border-violet-500/30',
  test: 'bg-gradient-to-b from-emerald-950/40 via-emerald-950/15 to-[#10141d] border-emerald-500/30',
}

const TYPE_BADGE_BG: Record<string, string> = {
  file: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
  class: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  function: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  test: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
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
  hierarchyScope = 'lineage',
  onScopeChange,
}: Props) {
  const [changeDesc, setChangeDesc] = useState('')
  const [copied, setCopied] = useState(false)
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
    setCopied(false)
  }, [node.id])

  const handleCopySymbol = () => {
    navigator.clipboard.writeText(node.label)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

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
    <div className="flex flex-col gap-3.5">

      {/* ── 1. Node Identity Card ────────────────────────────────────────── */}
      <div className={`rounded-2xl border p-4 shadow-xl backdrop-blur-md transition-all ${TYPE_BG[node.type] ?? TYPE_BG.file}`}>
        <div className="flex items-start gap-3.5">
          <div className={`p-2 rounded-xl bg-white/[0.05] border border-white/[0.08] shadow-inner flex-shrink-0 ${TYPE_COLOR[node.type] ?? 'text-gray-400'}`}>
            {TYPE_ICON[node.type] ?? TYPE_ICON.file}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono font-bold text-white text-sm truncate leading-snug tracking-tight" title={node.label}>
                {node.label}
              </p>
              <button
                onClick={handleCopySymbol}
                className="text-gray-500 hover:text-gray-200 p-1 rounded-md hover:bg-white/[0.06] transition-colors flex-shrink-0"
                title={copied ? "Copied symbol name!" : "Copy symbol name"}
              >
                {copied ? (
                  <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-emerald-400">
                    <path d="M3 8.5l3.5 3.5L13 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
                    <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M3 11V3.5A1.5 1.5 0 014.5 2H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                )}
              </button>
            </div>

            {node.module_name && (
              <p className="text-[11px] text-gray-400 truncate mt-1 font-mono flex items-center gap-1.5 opacity-90" title={node.module_name}>
                <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3 text-gray-500 flex-shrink-0">
                  <path d="M2 3.5A1.5 1.5 0 013.5 2h3.086a1.5 1.5 0 011.06.44l1.414 1.414a1.5 1.5 0 001.06.44H12.5A1.5 1.5 0 0114 5.793v6.707A1.5 1.5 0 0112.5 14h-9A1.5 1.5 0 012 12.5v-9z" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.1"/>
                </svg>
                <span className="truncate">{node.module_name}</span>
              </p>
            )}

            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${TYPE_BADGE_BG[node.type] ?? TYPE_BADGE_BG.file}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                {node.type}
              </span>

              {node.line_number > 0 && (
                <span className="inline-flex items-center text-[10px] font-mono text-gray-400 bg-white/[0.05] border border-white/[0.08] px-2 py-0.5 rounded-full">
                  Line {node.line_number}
                </span>
              )}

              {node.git_churn > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-300 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-full">
                  <svg viewBox="0 0 16 16" fill="none" className="w-2.5 h-2.5 text-amber-400">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/>
                    <path d="M8 4.5v3.5l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                  {node.git_churn} git commits
                </span>
              )}
            </div>
          </div>
        </div>

        {/* View Source Code button */}
        {node.file_path && (
          <div className="mt-3.5 pt-3 border-t border-white/[0.07]">
            <button
              onClick={() => onViewSource?.(node.file_path, node.line_number, node.label)}
              className="w-full flex items-center justify-center gap-2 py-2 px-3.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/25 hover:border-cyan-400/50 text-cyan-200 text-xs font-mono font-medium transition-all group shadow-sm active:scale-[0.99]"
              title="Inspect source code in-app with target line highlighted"
            >
              <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform">
                <path d="M5 4L2 8l3 4M11 4l3 4-3 4M9 2.5l-2 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>View Source</span>
              {node.line_number > 0 && (
                <span className="text-cyan-400 font-semibold">: {node.line_number}</span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* ── 2. Dependency Hierarchy Tree Card ────────────────────────── */}
      <div className="rounded-2xl border border-cyan-500/25 bg-gradient-to-b from-cyan-950/25 via-[#101522] to-[#0c1017] p-4 shadow-xl shadow-cyan-950/20 transition-all">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shadow-inner flex-shrink-0">
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
              <path d="M8 2v4M8 6l-4 4M8 6l4 4M4 10v3M12 10v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="8" cy="2" r="1.5" fill="currentColor"/>
              <circle cx="4" cy="13" r="1.5" fill="currentColor"/>
              <circle cx="12" cy="13" r="1.5" fill="currentColor"/>
            </svg>
          </span>
          <div>
            <h4 className="text-xs font-semibold text-white tracking-tight">
              Dependency Hierarchy Tree
            </h4>
            <p className="text-[11px] text-gray-400 mt-0.5">Callers, target contract & callee flow</p>
          </div>
        </div>

        {!isHierarchyActive ? (
          <div className="mt-3.5 flex flex-col gap-2.5">
            {/* Segmented Depth Control */}
            <div className="flex items-center bg-black/50 p-1 rounded-xl border border-white/[0.07] gap-1">
              {(['lineage', 'deep', 'component'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => onScopeChange?.(mode)}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-all text-center whitespace-nowrap ${
                    hierarchyScope === mode
                      ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-500/40 shadow-sm font-semibold'
                      : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
                  }`}
                >
                  {mode === 'lineage' ? 'Direct (1-Hop)' : mode === 'deep' ? 'Deep (2-Hop)' : 'Cluster'}
                </button>
              ))}
            </div>

            <button
              onClick={() => onLayoutHierarchy?.(node.id, hierarchyScope)}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600/30 via-cyan-500/25 to-blue-600/30 hover:from-cyan-600/45 hover:to-blue-600/45 border border-cyan-500/40 hover:border-cyan-400/60 text-cyan-100 text-xs font-semibold shadow-lg shadow-cyan-950/40 transition-all active:scale-[0.99] group"
            >
              <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-cyan-300 group-hover:scale-110 transition-transform">
                <path d="M8 2v4M8 6l-4 4M8 6l4 4M4 10v3M12 10v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="8" cy="2" r="1.5" fill="currentColor"/>
                <circle cx="4" cy="13" r="1.5" fill="currentColor"/>
                <circle cx="12" cy="13" r="1.5" fill="currentColor"/>
              </svg>
              <span>Arrange Hierarchy Tree</span>
            </button>
          </div>
        ) : (
          <div className="mt-3.5 flex flex-col gap-2.5">
            <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/35 flex flex-col gap-2.5 shadow-inner">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-cyan-200 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  Hierarchy Active ({hierarchyNodeCount ?? 'Connected'} nodes)
                </span>
                <span className="text-[10px] text-cyan-300 capitalize bg-cyan-500/20 px-2 py-0.5 rounded-full border border-cyan-500/30 font-medium">
                  {hierarchyScope === 'lineage' ? '1-Hop Direct' : hierarchyScope === 'deep' ? '2-Hop Deep' : 'Full Cluster'}
                </span>
              </div>

              {/* Segmented Depth Pills */}
              <div className="flex items-center bg-black/60 p-1 rounded-xl border border-white/[0.08] gap-1">
                {(['lineage', 'deep', 'component'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => {
                      onScopeChange?.(mode)
                      onLayoutHierarchy?.(node.id, mode)
                    }}
                    className={`flex-1 py-1 rounded-lg text-[11px] font-medium transition-all text-center whitespace-nowrap ${
                      hierarchyScope === mode
                        ? 'bg-cyan-500/30 text-cyan-100 border border-cyan-500/50 shadow-sm font-semibold'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {mode === 'lineage' ? 'Direct (1-Hop)' : mode === 'deep' ? 'Deep (2-Hop)' : 'Cluster'}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={onResetLayout}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl bg-white/[0.05] hover:bg-rose-500/15 border border-white/[0.08] hover:border-rose-500/30 text-xs font-medium text-gray-300 hover:text-rose-200 transition-all shadow-sm active:scale-[0.99]"
            >
              <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3"><path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
              <span>Reset to Default Layout</span>
            </button>
          </div>
        )}
      </div>

      {/* ── 3. Watsonx AI Purpose Summary Card ───────────────────────────── */}
      <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/25 via-[#121422] to-[#0c0e17] p-4 shadow-xl shadow-indigo-950/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-indigo-500/20 border border-indigo-500/35 text-indigo-400 shadow-inner flex-shrink-0">
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                <path d="M8 1.5l1.5 3.5 3.5 1.5-3.5 1.5L8 11.5l-1.5-3.5L3 6.5l3.5-1.5L8 1.5z" fill="currentColor"/>
                <path d="M13 11l.75 1.75L15.5 13.5l-1.75.75L13 16l-.75-1.75L10.5 13.5l1.75-.75L13 11z" fill="currentColor" opacity="0.7"/>
              </svg>
            </span>
            <div>
              <h4 className="text-xs font-semibold text-white flex items-center gap-2">
                What does this {node.type} do?
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/35">
                  watsonx.ai
                </span>
              </h4>
              <p className="text-[11px] text-gray-400 mt-0.5">Grounded code purpose & contract summary</p>
            </div>
          </div>

          {summary && (
            <button
              onClick={() => setSummaryExpanded(!summaryExpanded)}
              className="text-gray-400 hover:text-white p-1 rounded-md transition-colors"
              title={summaryExpanded ? 'Collapse purpose details' : 'Expand purpose details'}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                className={`w-3.5 h-3.5 transition-transform duration-200 ${summaryExpanded ? 'rotate-180' : ''}`}
              >
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>

        {!summary && !summaryLoading && (
          <div className="mt-3.5">
            <button
              onClick={handleExplainNode}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600/30 via-purple-600/25 to-pink-600/25 hover:from-indigo-600/45 hover:to-pink-600/40 border border-indigo-500/40 hover:border-indigo-400/60 text-indigo-100 text-xs font-semibold shadow-lg shadow-indigo-950/40 transition-all active:scale-[0.99] group"
            >
              <span className="text-sm group-hover:rotate-12 transition-transform">✦</span>
              <span>Explain Code Purpose (Watsonx)</span>
            </button>
            {summaryError && (
              <p className="mt-2 text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-2.5">{summaryError}</p>
            )}
          </div>
        )}

        {summaryLoading && (
          <div className="mt-3.5 py-3 px-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin flex-shrink-0" />
            <span className="text-xs text-indigo-200 animate-pulse font-medium">
              Watsonx Granite reading AST & dependency graph…
            </span>
          </div>
        )}

        {summary && summaryExpanded && (
          <div className="mt-3.5 flex flex-col gap-2.5 text-xs">
            {/* Purpose */}
            <div className="bg-[#12151e] rounded-xl p-3 border border-white/[0.06] border-l-2 border-l-indigo-400">
              <p className="text-[10px] font-semibold text-indigo-300 uppercase tracking-wider mb-1">
                Core Purpose
              </p>
              <p className="text-gray-200 leading-relaxed text-xs">
                {summary.purpose}
              </p>
            </div>

            {/* Responsibilities */}
            {summary.responsibilities && summary.responsibilities.length > 0 && (
              <div className="bg-[#12151e] rounded-xl p-3 border border-white/[0.06]">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Key Responsibilities
                </p>
                <ul className="space-y-1.5">
                  {summary.responsibilities.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-gray-300">
                      <span className="text-indigo-400 mt-0.5">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Input / Output Contract */}
            {summary.inputs_and_outputs && (
              <div className="bg-[#12151e] rounded-xl p-3 border border-white/[0.06]">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Contract & Data Flow
                </p>
                <p className="text-gray-300 font-mono text-[11px] break-words bg-black/40 p-2 rounded-lg border border-white/[0.04]">
                  {summary.inputs_and_outputs}
                </p>
              </div>
            )}

            {/* Architecture & Complexity Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {summary.architectural_role && (
                <span className="px-2.5 py-1 rounded-full text-[10px] bg-purple-500/15 text-purple-300 border border-purple-500/30 font-medium">
                  Role: {summary.architectural_role}
                </span>
              )}
              <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                  summary.complexity_rating === 'HIGH'
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                    : summary.complexity_rating === 'MEDIUM'
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                }`}
              >
                Complexity: {summary.complexity_rating}
              </span>
            </div>

            {/* Grounding & Refresh */}
            <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-[10px] text-gray-400">
              <span className="truncate max-w-[200px]" title={summary.model_used}>
                Model: {summary.model_used || 'IBM Granite'}
              </span>
              <button
                onClick={handleExplainNode}
                className="text-indigo-400 hover:text-indigo-300 hover:underline font-medium"
              >
                Re-analyze
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 4. Impact Scenario & Analysis ───────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.03] to-[#0e121a] p-4 shadow-xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-blue-400">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M8 2v3M8 11v3M2 8h3M11 8h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <label className="text-xs font-semibold text-gray-200">
              Change Scenario <span className="text-gray-500 font-normal text-[11px]">(optional)</span>
            </label>
          </div>
          <span className={`text-[10px] tabular-nums font-mono ${changeDesc.length >= MAX_DESC ? 'text-red-400' : 'text-gray-500'}`}>
            {changeDesc.length}/{MAX_DESC}
          </span>
        </div>

        {/* Quick Scenario Fill Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { label: 'Refactor Logic', text: `Refactoring implementation of ${node.label}` },
            { label: 'Signature Update', text: `Updating parameters & return signature for ${node.label}` },
            { label: 'Bug Fix', text: `Bug fix addressing edge cases in ${node.label}` },
          ].map(p => (
            <button
              key={p.label}
              onClick={() => setChangeDesc(p.text)}
              className="text-[10px] font-medium text-gray-400 hover:text-blue-300 bg-white/[0.04] hover:bg-blue-500/10 border border-white/[0.06] hover:border-blue-500/30 px-2 py-0.5 rounded-md transition-all active:scale-95"
            >
              + {p.label}
            </button>
          ))}
        </div>

        <textarea
          value={changeDesc}
          onChange={e => setChangeDesc(e.target.value.slice(0, MAX_DESC))}
          placeholder="e.g. Refactoring the authentication logic or modifying public contract…"
          maxLength={MAX_DESC}
          rows={2}
          className="w-full bg-[#0a0d14] border border-white/[0.1] focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 rounded-xl p-3 text-xs text-gray-200 placeholder-gray-500 outline-none resize-none transition-all shadow-inner"
        />

        {/* ── Analyse Impact button ──────────────────────────────────────── */}
        <button
          onClick={() => onAnalyze(node.id, changeDesc)}
          disabled={impactLoading}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] disabled:opacity-40 disabled:cursor-wait text-white text-xs font-semibold shadow-xl shadow-blue-950/50 border border-white/[0.15] transition-all duration-150"
        >
          {impactLoading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Analysing Impact…</span>
            </>
          ) : (
            <>
              <span className="text-sm">★</span>
              <span>Analyse Impact</span>
            </>
          )}
        </button>
      </div>

      {/* ── Impact error ───────────────────────────────────────────────── */}
      {impactError && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-3 text-xs text-red-300">
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
