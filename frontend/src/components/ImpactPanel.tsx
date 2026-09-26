// frontend/src/components/ImpactPanel.tsx
// Shows impact analysis results: affected components, tests, risk metrics, with integrated AI explanation slot

import React, { useState, useCallback } from 'react'
import RiskBadge from './RiskBadge'
import type { ImpactResult, RiskLevel } from '../types'

interface Props {
  result: ImpactResult | null
  loading?: boolean
  aiContent?: React.ReactNode
}

const TYPE_ICON: Record<string, React.ReactElement> = {
  function: (
    <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3 flex-shrink-0">
      <path d="M6 1L11 6L6 11L1 6L6 1Z" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1"/>
    </svg>
  ),
  class: (
    <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3 flex-shrink-0">
      <circle cx="6" cy="6" r="4.5" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1"/>
    </svg>
  ),
  test: (
    <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3 flex-shrink-0">
      <path d="M4.5 1.5h3v4.5l1.5 4.5h-6l1.5-4.5V1.5z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1"/>
    </svg>
  ),
  file: (
    <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3 flex-shrink-0">
      <path d="M2 9V3a.75.75 0 01.75-.75h3.75L9 4.5V9a.75.75 0 01-.75.75H2.75A.75.75 0 012 9z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1"/>
    </svg>
  ),
}

const TYPE_COLOR: Record<string, string> = {
  function: 'text-violet-400',
  class: 'text-blue-400',
  test: 'text-emerald-400',
  file: 'text-gray-400',
}

function NodeList({
  nodes,
  label,
  accent,
}: {
  nodes: Array<Record<string, unknown>>
  label: string
  accent: string
}) {
  const [expanded, setExpanded] = useState(false)
  if (nodes.length === 0) return null

  const INITIAL_LIMIT = 5
  const shouldTruncate = nodes.length > INITIAL_LIMIT
  const visibleNodes = shouldTruncate && !expanded ? nodes.slice(0, INITIAL_LIMIT) : nodes

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">{label}</h4>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${accent}`}>
            {nodes.length}
          </span>
        </div>
        {shouldTruncate && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
          >
            {expanded ? 'Collapse' : `+${nodes.length - INITIAL_LIMIT} more`}
          </button>
        )}
      </div>

      <ul className="space-y-1">
        {visibleNodes.map((n) => {
          const type = (n.type as string) || 'function'
          const labelStr = (n.label as string) || (n.id as string)
          const moduleStr = (n.module_name as string)?.split('.').pop()

          return (
            <li
              key={n.id as string}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] transition-colors group"
              title={n.id as string}
            >
              <span className={TYPE_COLOR[type] ?? 'text-gray-400'}>
                {TYPE_ICON[type] ?? TYPE_ICON.file}
              </span>
              <span className="text-xs font-mono text-gray-200 truncate group-hover:text-white transition-colors">
                {labelStr}
              </span>
              {moduleStr && (
                <span className="text-[10px] font-mono text-gray-500 truncate ml-auto pl-1 min-w-0 max-w-[100px]">
                  {moduleStr}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ── Export button ─────────────────────────────────────────────────────────
function ExportButton({ result }: { result: ImpactResult }) {
  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `xray-impact-${result.selected_node_label.replace(/[^a-z0-9]/gi, '_')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [result])

  return (
    <button
      onClick={handleExport}
      title="Export impact report as JSON"
      className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-300 transition-colors font-medium px-2 py-1 rounded hover:bg-white/[0.05]"
    >
      <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
        <path d="M6 1v7M3.5 5.5L6 8l2.5-2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M1.5 9.5v1h9v-1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
      </svg>
      Export JSON
    </button>
  )
}

export default function ImpactPanel({ result, loading, aiContent }: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-blue-500/25 bg-gradient-to-b from-blue-950/25 via-[#10141d] to-[#0c0e17] p-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-400 rounded-full animate-spin flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-white">Analysing dependency blast radius…</p>
            <p className="text-[11px] text-blue-300/80 mt-0.5 animate-pulse">Tracing upstream and downstream propagation</p>
          </div>
        </div>
      </div>
    )
  }

  if (!result) return null

  const totalAffected = result.direct_affected.length + result.transitive_affected.length
  const testCoverage = result.related_tests.length > 0
    ? Math.round((result.related_tests.length / Math.max(totalAffected, 1)) * 100)
    : 0

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#111520] via-[#0d1017] to-[#0a0d13] shadow-xl overflow-hidden flex flex-col">

      {/* ── Summary header ──────────────────────────────────────────── */}
      <div className="px-4 py-3.5 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-0.5">
              Impact Analysis
            </p>
            <p className="font-semibold text-white text-sm font-mono truncate" title={result.selected_node_label}>
              {result.selected_node_label}
            </p>
            <p className="text-[11px] text-gray-400 capitalize mt-0.5">
              Target component · {result.selected_node_type}
            </p>
          </div>
          <div className="flex-shrink-0">
            <RiskBadge level={result.risk_level as RiskLevel} score={result.risk_score} />
          </div>
        </div>
      </div>

      {/* ── Metrics row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 divide-x divide-white/[0.05] border-b border-white/[0.06] bg-black/20">
        {[
          { value: result.direct_affected.length, label: 'Direct', color: 'text-amber-400' },
          { value: result.transitive_affected.length, label: 'Transitive', color: 'text-orange-400' },
          { value: result.related_tests.length, label: 'Tests', color: 'text-emerald-400' },
        ].map(m => (
          <div key={m.label} className="px-3 py-2.5 text-center">
            <p className={`text-lg font-bold font-mono tabular-nums ${m.color}`}>{m.value}</p>
            <p className="text-[10px] text-gray-400 font-medium mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>

      {/* ── Coverage indicator ──────────────────────────────────────── */}
      {totalAffected > 0 && (
        <div className="px-4 py-2.5 border-b border-white/[0.06] bg-black/10">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Test Coverage</span>
            <span className={`text-xs font-semibold font-mono ${testCoverage > 50 ? 'text-emerald-400' : testCoverage > 0 ? 'text-amber-400' : 'text-rose-400'}`}>
              {testCoverage}%
            </span>
          </div>
          <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${testCoverage > 50 ? 'bg-emerald-500' : testCoverage > 0 ? 'bg-amber-500' : 'bg-rose-500/70'}`}
              style={{ width: `${Math.max(testCoverage, testCoverage > 0 ? 5 : 0)}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Contributing factors ─────────────────────────────────────── */}
      {result.contributing_factors && result.contributing_factors.length > 0 && (
        <div className="px-4 py-3 border-b border-white/[0.06] space-y-1.5 bg-white/[0.01]">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Contributing Risk Signals
          </p>
          {result.contributing_factors.map((f, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-gray-300">
              <span className="text-gray-500 mt-0.5">•</span>
              <span className="leading-snug">{f}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Integrated AI Assessment & Migration Plan ───────────────── */}
      {aiContent && (
        <div className="border-b border-white/[0.06] p-3 bg-indigo-950/[0.12]">
          {aiContent}
        </div>
      )}

      {/* ── Granular Affected Component Lists ───────────────────────── */}
      <div className="p-4 space-y-4">
        <NodeList
          nodes={result.direct_affected}
          label="Directly Affected"
          accent="bg-amber-500/15 text-amber-300 border border-amber-500/30"
        />
        <NodeList
          nodes={result.transitive_affected}
          label="Transitively Affected"
          accent="bg-orange-500/15 text-orange-300 border border-orange-500/30"
        />
        <NodeList
          nodes={result.related_tests}
          label="Related Tests"
          accent="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
        />

        {result.direct_affected.length === 0 &&
         result.transitive_affected.length === 0 &&
         result.related_tests.length === 0 && (
          <div className="py-4 text-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 mx-auto mb-2 text-gray-600">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <p className="text-gray-400 text-xs">No affected downstream components found.</p>
            <p className="text-gray-500 text-[11px] mt-0.5">This node has no active callers or dependencies.</p>
          </div>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <div className="px-4 py-2.5 border-t border-white/[0.06] bg-black/30 flex items-center justify-between gap-2 mt-auto">
        <div className="flex items-center gap-1.5">
          <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3 text-gray-500">
            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1"/>
            <path d="M6 4v3M6 8.5v.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
          </svg>
          <p className="text-[10px] text-gray-400 font-mono">
            {result.max_depth}-hop traversal · Deterministic
          </p>
        </div>
        <ExportButton result={result} />
      </div>
    </div>
  )
}
