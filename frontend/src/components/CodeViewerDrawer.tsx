// frontend/src/components/CodeViewerDrawer.tsx
// High-performance in-app source code viewer and visual diff inspector.

import { useState, useEffect, useRef, useMemo } from 'react'
import { getSourceCode } from '../api/client'
import type { SourceCodeResponse } from '../types'

interface Props {
  repoId: string
  filePath: string | null
  targetLine?: number | null
  startLine?: number | null
  endLine?: number | null
  symbolName?: string | null
  changedLines?: number[]
  isOpen: boolean
  onClose: () => void
}

const PYTHON_KEYWORDS = new Set([
  'def', 'class', 'return', 'import', 'from', 'as', 'if', 'elif', 'else',
  'try', 'except', 'finally', 'while', 'for', 'in', 'with', 'async', 'await',
  'lambda', 'yield', 'raise', 'pass', 'break', 'continue', 'and', 'or', 'not', 'is'
])
const PYTHON_BUILTINS = new Set(['True', 'False', 'None', 'self', 'cls'])

/**
 * Lightweight tokenizer-based syntax highlighter for Python.
 * Escapes HTML safely and tokenizes into spans without regex collision.
 */
function renderSyntaxLine(line: string, language: string): string {
  if (language !== 'python') {
    return escapeHtml(line)
  }

  const tokenRegex = /(#.*$)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(@[a-zA-Z_]\w*)|([a-zA-Z_]\w*)|(\b\d+(?:\.\d+)?\b)/g

  let result = ''
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      result += escapeHtml(line.slice(lastIndex, match.index))
    }

    const [raw, comment, str, decorator, word, num] = match
    if (comment) {
      result += `<span class="text-gray-500 italic">${escapeHtml(comment)}</span>`
    } else if (str) {
      result += `<span class="text-emerald-300 font-normal">${escapeHtml(str)}</span>`
    } else if (decorator) {
      result += `<span class="text-amber-300 font-semibold">${escapeHtml(decorator)}</span>`
    } else if (word) {
      if (PYTHON_KEYWORDS.has(word)) {
        result += `<span class="text-purple-400 font-semibold">${word}</span>`
      } else if (PYTHON_BUILTINS.has(word)) {
        result += `<span class="text-cyan-400 font-medium">${word}</span>`
      } else {
        result += escapeHtml(word)
      }
    } else if (num) {
      result += `<span class="text-amber-400">${num}</span>`
    } else {
      result += escapeHtml(raw)
    }

    lastIndex = tokenRegex.lastIndex
  }

  if (lastIndex < line.length) {
    result += escapeHtml(line.slice(lastIndex))
  }

  return result
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export default function CodeViewerDrawer({
  repoId,
  filePath,
  targetLine,
  startLine,
  endLine,
  symbolName,
  changedLines = [],
  isOpen,
  onClose,
}: Props) {
  const [data, setData] = useState<SourceCodeResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const targetRowRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Changed lines set for O(1) lookups
  const changedSet = useMemo(() => new Set(changedLines), [changedLines])

  // Fetch file content
  useEffect(() => {
    if (!isOpen || !filePath) return

    let cancelled = false
    setLoading(true)
    setError(null)

    getSourceCode(
      repoId,
      filePath,
      targetLine ?? undefined,
      startLine ?? undefined,
      endLine ?? undefined,
    )
      .then(res => {
        if (!cancelled) {
          setData(res)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          const msg = err.response?.data?.detail || err.message || 'Failed to load source file'
          setError(msg)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [repoId, filePath, targetLine, startLine, endLine, isOpen])

  // Auto-scroll to target line once loaded
  useEffect(() => {
    if (!loading && data && targetLine && targetRowRef.current) {
      const timer = setTimeout(() => {
        if (typeof targetRowRef.current?.scrollIntoView === 'function') {
          targetRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [loading, data, targetLine])

  // Esc key closes drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleCopyCode = () => {
    if (!data?.content) return
    navigator.clipboard.writeText(data.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const lines = data?.content.split('\n') ?? []
  const matchesSearch = (text: string) => {
    if (!searchQuery.trim()) return false
    return text.toLowerCase().includes(searchQuery.toLowerCase())
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end pointer-events-none">
      {/* Dark backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto transition-opacity"
        onClick={onClose}
      />

      {/* Slide-out drawer panel */}
      <div
        className={`relative z-10 pointer-events-auto flex flex-col bg-[#0b0e14] border-l border-white/[0.08] shadow-2xl transition-all duration-200 ease-out h-full ${
          isExpanded ? 'w-[90vw]' : 'w-full max-w-3xl'
        }`}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.07] bg-[#0e121b]">
          <div className="flex items-center gap-3 min-w-0">
            {/* File icon */}
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 flex-shrink-0">
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                <path d="M3 12V4a1 1 0 011-1h5l3 3v6a1 1 0 01-1 1H4a1 1 0 01-1-1z" stroke="currentColor" strokeWidth="1.3" />
                <path d="M8 3v3h3" stroke="currentColor" strokeWidth="1.3" />
              </svg>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-100 font-mono truncate">
                  {data?.relative_path || filePath?.split(/[/\\]/).slice(-2).join('/') || 'Source Viewer'}
                </span>
                {data?.language && (
                  <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-white/[0.06] text-gray-300 border border-white/[0.05]">
                    {data.language}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                {symbolName && (
                  <>
                    <span className="text-cyan-400 font-mono font-medium truncate max-w-[200px]">
                      {symbolName}
                    </span>
                    <span>·</span>
                  </>
                )}
                {targetLine && (
                  <span className="text-amber-400 font-mono font-medium">
                    Line {targetLine}
                  </span>
                )}
                {data && (
                  <span>({data.total_lines} lines)</span>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Search inside file */}
            <div className="relative hidden sm:block">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Find in file…"
                className="w-36 focus:w-48 transition-all bg-white/[0.04] border border-white/[0.08] rounded-md px-2.5 py-1 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Copy Code button */}
            <button
              onClick={handleCopyCode}
              disabled={!data?.content}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-xs text-gray-300 hover:text-white transition-colors"
              title="Copy entire file"
            >
              {copied ? (
                <>
                  <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-emerald-400">
                    <path d="M3 8.5l3.5 3.5 6.5-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-gray-400">
                    <rect x="4.5" y="4.5" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M3.5 11.5V3.5h8" stroke="currentColor" strokeWidth="1.2"/>
                  </svg>
                  <span>Copy</span>
                </>
              )}
            </button>

            {/* Expand / Minimize toggle */}
            <button
              onClick={() => setIsExpanded(prev => !prev)}
              className="p-1.5 rounded-md bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-gray-400 hover:text-white transition-colors"
              title={isExpanded ? 'Restore width' : 'Expand full width'}
            >
              <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
                {isExpanded ? (
                  <path d="M5 2v4H1m10-4v4h4M5 14v-4H1m10 4v-4h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                ) : (
                  <path d="M2 6V2h4m8 4V2h-4M2 10v4h4m8-4v4h-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                )}
              </svg>
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md bg-white/[0.04] border border-white/[0.08] hover:bg-red-500/20 hover:border-red-500/30 text-gray-400 hover:text-red-300 transition-colors"
              title="Close (Esc)"
            >
              <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
                <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* ── Target Symbol Banner (if target line specified) ───────────────── */}
        {targetLine && (
          <div className="px-5 py-2 bg-cyan-950/30 border-b border-cyan-500/20 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-cyan-300 font-mono">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>Target Focus:</span>
              <span className="font-semibold text-white">{symbolName || `Line ${targetLine}`}</span>
            </div>
            <button
              onClick={() => {
                if (typeof targetRowRef.current?.scrollIntoView === 'function') {
                  targetRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }
              }}
              className="text-cyan-400 hover:text-cyan-200 underline text-[11px]"
            >
              Jump to line {targetLine}
            </button>
          </div>
        )}

        {/* ── Content Viewport ────────────────────────────────────────────── */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-auto bg-[#0a0d14] text-xs font-mono xray-scrollbar"
        >
          {loading && (
            <div className="p-8 space-y-3">
              <div className="flex items-center gap-3 text-gray-400 text-sm">
                <div className="w-4 h-4 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                <span>Retrieving source code...</span>
              </div>
              <div className="space-y-2 pt-2">
                {[85, 60, 75, 40, 90, 70, 50].map((w, idx) => (
                  <div
                    key={idx}
                    className="h-3.5 bg-white/[0.04] rounded animate-pulse"
                    style={{ width: `${w}%` }}
                  />
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="p-6">
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-300 space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-red-400">
                    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
                    <path d="M8 5v3M8 10v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                  <span>Unable to open source file</span>
                </div>
                <p className="text-xs text-red-400/90">{error}</p>
                <p className="text-[11px] text-gray-500 font-mono mt-1">Path: {filePath}</p>
              </div>
            </div>
          )}

          {!loading && !error && data && (
            <div className="min-w-full inline-block py-2">
              {lines.map((rawLine, idx) => {
                const lineNum = idx + 1
                const isTarget = targetLine === lineNum
                const isDiffChanged = changedSet.has(lineNum)
                const inRange =
                  startLine && endLine
                    ? lineNum >= startLine && lineNum <= endLine
                    : false
                const isMatch = matchesSearch(rawLine)

                let rowBg = 'hover:bg-white/[0.03]'
                let borderAccent = 'border-l-2 border-transparent'

                if (isTarget) {
                  rowBg = 'bg-cyan-500/15'
                  borderAccent = 'border-l-2 border-cyan-400'
                } else if (isDiffChanged) {
                  rowBg = 'bg-amber-500/15'
                  borderAccent = 'border-l-2 border-amber-400'
                } else if (inRange) {
                  rowBg = 'bg-blue-500/08'
                  borderAccent = 'border-l-2 border-blue-400/40'
                } else if (isMatch) {
                  rowBg = 'bg-yellow-500/15'
                }

                return (
                  <div
                    key={lineNum}
                    ref={isTarget ? targetRowRef : undefined}
                    className={`flex items-start leading-5 transition-colors ${rowBg} ${borderAccent}`}
                  >
                    {/* Line number gutter */}
                    <div className="w-12 flex-shrink-0 select-none text-right pr-3 text-[11px] text-gray-600 font-mono tabular-nums">
                      {isTarget ? (
                        <span className="text-cyan-400 font-bold">▶ {lineNum}</span>
                      ) : isDiffChanged ? (
                        <span className="text-amber-400 font-medium">★ {lineNum}</span>
                      ) : (
                        lineNum
                      )}
                    </div>

                    {/* Code token content */}
                    <div
                      className="flex-1 pl-2 pr-4 overflow-x-auto whitespace-pre text-gray-300 font-mono"
                      dangerouslySetInnerHTML={{
                        __html: renderSyntaxLine(rawLine, data.language),
                      }}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Footer Status ──────────────────────────────────────────────── */}
        <div className="px-5 py-2 border-t border-white/[0.06] bg-[#0c0f16] flex items-center justify-between text-[11px] text-gray-500 font-mono">
          <div className="flex items-center gap-3">
            <span>{lines.length} lines</span>
            <span>·</span>
            <span>UTF-8</span>
            {changedLines.length > 0 && (
              <>
                <span>·</span>
                <span className="text-amber-400 font-medium">{changedLines.length} changed line(s)</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-600">Esc to close</span>
          </div>
        </div>
      </div>
    </div>
  )
}
