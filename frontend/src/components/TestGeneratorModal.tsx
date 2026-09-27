// frontend/src/components/TestGeneratorModal.tsx
// 1-Click AI Test Suite Generator Modal (IBM Bob 2.0 & watsonx.ai Granite)

import { useState, useEffect } from 'react'
import type { GeneratedTestSuite } from '../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  testSuite: GeneratedTestSuite | null
  loading: boolean
  error: string | null
  targetNodeLabel?: string
}

export default function TestGeneratorModal({
  isOpen,
  onClose,
  testSuite,
  loading,
  error,
  targetNodeLabel,
}: Props) {
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedCmd, setCopiedCmd] = useState(false)

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleCopyCode = () => {
    if (!testSuite?.test_code) return
    navigator.clipboard.writeText(testSuite.test_code)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const runCommand = testSuite ? `pytest tests/${testSuite.test_filename} -v` : 'pytest tests/ -v'

  const handleCopyCmd = () => {
    navigator.clipboard.writeText(runCommand)
    setCopiedCmd(true)
    setTimeout(() => setCopiedCmd(false), 2000)
  }

  const handleDownload = () => {
    if (!testSuite) return
    const blob = new Blob([testSuite.test_code], { type: 'text/x-python;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = testSuite.test_filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-3xl max-h-[90vh] bg-[#0c0f17] border border-white/[0.12] rounded-2xl shadow-2xl shadow-black/90 flex flex-col overflow-hidden text-gray-200"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Modal Header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] bg-gradient-to-r from-indigo-950/40 via-[#101422] to-[#0c0f17]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shadow-inner flex-shrink-0">
              <svg viewBox="0 0 16 16" fill="none" className="w-5 h-5 text-indigo-400">
                <path d="M6 2h4v6l2 6H4l2-6V2z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M5.5 10.5h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white truncate tracking-tight font-mono">
                  {testSuite ? testSuite.test_filename : `test_${targetNodeLabel || 'component'}.py`}
                </h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/35 flex-shrink-0">
                  IBM Bob 2.0 & watsonx.ai
                </span>
              </div>
              <p className="text-xs text-gray-400 truncate mt-0.5">
                {testSuite
                  ? `Automated regression safety net for ${testSuite.target_label} (${testSuite.target_file})`
                  : 'Synthesizing contract assertions, mocks, and boundary tests…'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-all flex-shrink-0 ml-3"
            title="Close modal"
          >
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* ── Modal Content ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto xray-scrollbar p-5 space-y-4">
          {/* Loading state */}
          {loading && (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-12 h-12 border-3 border-indigo-500/20 border-t-indigo-400 rounded-full animate-spin" />
                <span className="absolute inset-0 flex items-center justify-center text-indigo-300 text-sm">✦</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  Generating Pytest Regression Suite…
                </p>
                <p className="text-xs text-indigo-300/80 mt-1 max-w-md mx-auto">
                  IBM Bob 2.0 and Watsonx Granite are analyzing AST arguments, dependency mocks, and contract boundaries to build test fixtures.
                </p>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs flex items-start gap-3">
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M8 5v3M8 10v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <div>
                <p className="font-semibold text-red-200">Failed to generate test suite</p>
                <p className="text-[11px] text-red-300/90 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Result view */}
          {testSuite && !loading && (
            <>
              {/* Scenarios Covered Strip */}
              {testSuite.scenarios_covered && testSuite.scenarios_covered.length > 0 && (
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-gray-300 flex items-center gap-1.5">
                      <span className="text-emerald-400 font-bold">✓</span>
                      Verified Test Scenarios ({testSuite.scenarios_covered.length})
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      Model: {testSuite.model_used || 'IBM Granite'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {testSuite.scenarios_covered.map((scen, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] font-medium"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        {scen}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Code viewer card */}
              <div className="rounded-xl border border-white/[0.08] bg-[#080a10] overflow-hidden shadow-inner flex flex-col">
                <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/[0.06] bg-black/40 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                    <span className="font-mono text-gray-300 text-[11px] font-medium">
                      {testSuite.test_filename}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.05]">
                      {testSuite.framework}
                    </span>
                  </div>

                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-gray-300 hover:text-white text-[11px] font-medium transition-all active:scale-95"
                    title="Copy Python test code to clipboard"
                  >
                    {copiedCode ? (
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
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-4 font-mono text-xs text-gray-200 overflow-x-auto max-h-[50vh] xray-scrollbar leading-relaxed selection:bg-indigo-500/30 selection:text-white">
                  <pre>
                    <code>{testSuite.test_code}</code>
                  </pre>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Modal Footer ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/[0.08] bg-black/40 text-xs">
          {/* CLI Run snippet */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-gray-500 hidden sm:inline">Run tests:</span>
            <button
              onClick={handleCopyCmd}
              className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-black/50 border border-white/[0.08] hover:border-white/[0.15] text-gray-300 font-mono text-[11px] truncate transition-colors group"
              title="Click to copy test command"
            >
              <span className="text-cyan-400">$</span>
              <span className="truncate">{runCommand}</span>
              <span className="text-gray-500 group-hover:text-gray-300 text-[10px]">
                {copiedCmd ? '✓' : '⧉'}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            <button
              onClick={handleDownload}
              disabled={!testSuite || loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] hover:border-white/[0.15] text-gray-200 text-xs font-medium transition-all active:scale-95 disabled:opacity-40"
              title="Download test file directly"
            >
              <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-gray-400">
                <path d="M8 2v8M4 7l4 4 4-4M2 13h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Download File</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-indigo-950/40 transition-all active:scale-95"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
