// frontend/src/components/DiffPanel.tsx
// Interactive Git Diff Blast Radius panel

import { useState } from 'react'
import RiskBadge from './RiskBadge'
import type { DiffImpactResult } from '../types'

interface Props {
  repoId: string
  result: DiffImpactResult | null
  loading: boolean
  aiLoading: boolean
  error: string | null
  onAnalyze: (diff: string, description: string) => void
  onRequestAI: (diff: string, description: string) => void
  onClear: () => void
  onClose: () => void
  onFocusNode: (nodeId: string) => void
}

const SAMPLE_DEMO_DIFF = `diff --git a/auth/service.py b/auth/service.py
--- a/auth/service.py
+++ b/auth/service.py
@@ -10,6 +10,8 @@ class AuthService:
     def login(self, username, password):
+        # Update token verification contract
+        verify_token_v2(username)
         return token
`

export default function DiffPanel({
  result,
  loading,
  aiLoading,
  error,
  onAnalyze,
  onRequestAI,
  onClear,
  onClose,
  onFocusNode,
}: Props) {
  const [diffText, setDiffText] = useState('')
  const [description, setDescription] = useState('')
  const [copiedCmd, setCopiedCmd] = useState(false)

  const handleRun = () => {
    if (!diffText.trim()) return
    onAnalyze(diffText, description)
  }

  const handleLoadSample = () => {
    setDiffText(SAMPLE_DEMO_DIFF)
    setDescription('Update login token verification contract')
  }

  const handleCopyTestCmd = (cmd: string) => {
    navigator.clipboard.writeText(cmd)
    setCopiedCmd(true)
    setTimeout(() => setCopiedCmd(false), 2000)
  }

  // Derive pytest command
  const testFiles = result?.related_tests
    ? Array.from(
        new Set(
          result.related_tests
            .map(t => (t as { file_path?: string }).file_path)
            .filter(Boolean) as string[],
        ),
      )
    : []

  const pytestCommand = testFiles.length > 0 ? `pytest ${testFiles.join(' ')}` : ''

  return (
    <div className="w-96 flex flex-col h-full bg-[#0d1017] border-l border-white/[0.08] shadow-2xl z-20 overflow-hidden">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0 bg-[#0f131c]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
              <path d="M4 3a2 2 0 100 4 2 2 0 000-4zM4 9a2 2 0 100 4 2 2 0 000-4zM12 9a2 2 0 100 4 2 2 0 000-4z" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M4 7v2M12 9V7a3 3 0 00-3-3H6" stroke="currentColor" strokeWidth="1.3"/>
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white tracking-tight">Git Diff Blast Radius</h2>
            <p className="text-[11px] text-gray-500">Multi-node impact across files</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-300 p-1 rounded-md hover:bg-white/[0.06] transition-colors"
          title="Close Diff Mode"
        >
          <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5">
            <path d="M11 3L3 11M3 3l8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* ── Scrollable Body ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto xray-scrollbar px-5 py-4 space-y-5">
        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300">
            {error}
          </div>
        )}

        {/* ── Input State (No Result) ───────────────────────────────────── */}
        {!result && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-gray-300">Unified Git Diff</label>
                <button
                  onClick={handleLoadSample}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 hover:underline transition-colors"
                >
                  Load Sample Diff
                </button>
              </div>
              <textarea
                value={diffText}
                onChange={e => setDiffText(e.target.value)}
                placeholder="diff --git a/... b/...&#10;--- a/auth/service.py&#10;+++ b/auth/service.py&#10;@@ -10,3 +10,4 @@&#10;+   verify_token()"
                rows={9}
                className="w-full bg-[#0a0c10] border border-white/[0.10] rounded-xl px-3 py-2.5 text-xs text-gray-200 font-mono placeholder-gray-600 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all resize-none xray-scrollbar"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-300 block mb-1.5">
                Change Context <span className="text-gray-500 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Refactor token auth parameters"
                className="w-full bg-[#0a0c10] border border-white/[0.10] rounded-xl px-3 py-2 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-cyan-500/50 transition-all"
              />
            </div>

            <button
              onClick={handleRun}
              disabled={loading || !diffText.trim()}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-xs font-semibold text-white shadow-lg shadow-cyan-900/30 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Mapping AST & Traversing Graph…
                </>
              ) : (
                <>
                  <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
                    <path d="M8 2v12M2 8l6-6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Calculate Diff Blast Radius
                </>
              )}
            </button>
          </div>
        )}

        {/* ── Result State ──────────────────────────────────────────────── */}
        {result && (
          <div className="space-y-5">
            {/* Top Risk & Metrics */}
            <div className="bg-[#121620] border border-white/[0.08] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-gray-500 uppercase font-semibold tracking-wider block">Risk Level</span>
                  <p className="text-xs text-gray-300 mt-0.5 font-medium">Composite Blast Radius</p>
                </div>
                <RiskBadge level={result.risk_level} score={result.risk_score} />
              </div>

              {/* Metric grid */}
              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-white/[0.06] text-center">
                <div className="bg-white/[0.02] rounded-lg py-1.5 px-1 border border-white/[0.04]">
                  <span className="text-sm font-semibold text-cyan-400 block tabular-nums">{result.changed_symbols.length}</span>
                  <span className="text-[10px] text-gray-500">Changed</span>
                </div>
                <div className="bg-white/[0.02] rounded-lg py-1.5 px-1 border border-white/[0.04]">
                  <span className="text-sm font-semibold text-amber-400 block tabular-nums">{result.direct_affected.length}</span>
                  <span className="text-[10px] text-gray-500">Direct</span>
                </div>
                <div className="bg-white/[0.02] rounded-lg py-1.5 px-1 border border-white/[0.04]">
                  <span className="text-sm font-semibold text-purple-400 block tabular-nums">{result.transitive_affected.length}</span>
                  <span className="text-[10px] text-gray-500">Transitive</span>
                </div>
                <div className="bg-white/[0.02] rounded-lg py-1.5 px-1 border border-white/[0.04]">
                  <span className="text-sm font-semibold text-emerald-400 block tabular-nums">{result.related_tests.length}</span>
                  <span className="text-[10px] text-gray-500">Tests</span>
                </div>
              </div>
            </div>

            {/* Key Findings */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Key Findings</h3>
              <ul className="space-y-1.5 text-xs text-gray-400">
                {result.contributing_factors.map((factor, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-cyan-400 mt-0.5">•</span>
                    <span>{factor}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Changed Symbols */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center justify-between">
                <span>Directly Modified ({result.changed_symbols.length})</span>
                <span className="text-[10px] text-gray-500 lowercase">click to focus</span>
              </h3>
              <div className="space-y-1 max-h-40 overflow-y-auto xray-scrollbar">
                {result.changed_symbols.map(sym => (
                  <button
                    key={sym.node_id}
                    onClick={() => onFocusNode(sym.node_id)}
                    className="w-full text-left p-2 rounded-lg bg-cyan-950/20 border border-cyan-500/20 hover:border-cyan-500/40 hover:bg-cyan-950/40 transition-all flex items-center justify-between group"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-mono font-medium text-cyan-300 block truncate group-hover:underline">
                        {sym.label}
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono block truncate">
                        line {sym.line_number} · {sym.file_path.split(/[/\\]/).slice(-2).join('/')}
                      </span>
                    </div>
                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-medium">
                      {sym.type}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Test Suite Command */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Verification Command</h3>
              {pytestCommand ? (
                <div className="bg-[#0a0c10] border border-white/[0.08] rounded-xl p-2.5 flex items-center justify-between gap-2">
                  <code className="text-xs font-mono text-emerald-400 truncate flex-1">{pytestCommand}</code>
                  <button
                    onClick={() => handleCopyTestCmd(pytestCommand)}
                    className="text-[10px] bg-white/[0.06] hover:bg-white/[0.10] text-gray-300 px-2.5 py-1 rounded-md transition-colors flex-shrink-0"
                  >
                    {copiedCmd ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              ) : (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
                  ⚠️ No test files directly cover the modified components.
                </div>
              )}
            </div>

            {/* Untested Dependencies Warning */}
            {result.untested_affected.length > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1.5">
                <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                  <span>⚠️</span> {result.untested_affected.length} Untested Downstream Dependencies
                </span>
                <p className="text-[11px] text-amber-300/80 leading-relaxed">
                  These components depend on modified code but have no tests verifying their behavior.
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {result.untested_affected.slice(0, 4).map(u => (
                    <span key={u.id as string} className="text-[10px] font-mono bg-amber-500/20 text-amber-200 px-1.5 py-0.5 rounded">
                      {(u as { label?: string }).label ?? u.id}
                    </span>
                  ))}
                  {result.untested_affected.length > 4 && (
                    <span className="text-[10px] text-amber-400">+{result.untested_affected.length - 4} more</span>
                  )}
                </div>
              </div>
            )}

            {/* Watsonx AI Explanation */}
            <div className="pt-2 border-t border-white/[0.06] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Watsonx Migration Plan</span>
                {!result.ai?.explanation && (
                  <button
                    onClick={() => onRequestAI(diffText, description)}
                    disabled={aiLoading}
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium transition-colors"
                  >
                    {aiLoading ? 'Synthesizing…' : 'Generate Plan ➔'}
                  </button>
                )}
              </div>

              {result.ai?.explanation && (
                <div className="bg-[#121620] border border-white/[0.08] rounded-xl p-3.5 space-y-3 text-xs">
                  <p className="text-gray-300 leading-relaxed">{result.ai.explanation}</p>
                  {result.ai.migration_plan.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
                      <span className="text-[11px] font-semibold text-cyan-400 block">Step-by-step Safeguards:</span>
                      <ol className="list-decimal list-inside space-y-1 text-gray-400 text-[11px]">
                        {result.ai.migration_plan.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Clear / Reset button */}
            <button
              onClick={onClear}
              className="w-full py-2 bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-gray-200 rounded-xl text-xs transition-colors border border-white/[0.06]"
            >
              Analyze Another Diff
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
