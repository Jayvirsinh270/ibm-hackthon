// frontend/src/pages/GraphPage.tsx
// Main analysis page — graph viewer + node panel + impact results

import { useState, useMemo, useRef, useEffect } from 'react'
import GraphViewer, { type GraphViewerHandle, type DiffHighlightMap, type HierarchyInfo } from '../components/GraphViewer'
import NodePanel from '../components/NodePanel'
import DiffPanel from '../components/DiffPanel'
import CodeViewerDrawer from '../components/CodeViewerDrawer'
import { useGraph } from '../hooks/useGraph'
import { useImpact } from '../hooks/useImpact'
import { useDiffImpact } from '../hooks/useDiffImpact'
import { useAI } from '../hooks/useAI'
import type { GraphNode } from '../types'

interface Props {
  repoId: string
}

// ── Node type color dot ────────────────────────────────────────────────────
const TYPE_DOT: Record<string, string> = {
  file:     'bg-gray-400',
  class:    'bg-blue-500',
  function: 'bg-violet-500',
  test:     'bg-emerald-500',
}

// ── Legend ────────────────────────────────────────────────────────────────
function Legend({ isDiffMode, isHeatmapMode }: { isDiffMode?: boolean; isHeatmapMode?: boolean }) {
  if (isHeatmapMode) {
    return (
      <div className="flex items-center gap-3 text-xs text-gray-400 bg-orange-950/30 border border-orange-500/20 px-3 py-1 rounded-lg">
        <span className="text-orange-400 font-semibold text-[11px] tracking-wide flex items-center gap-1">
          <span>🔥</span> Churn:
        </span>
        <div className="flex items-center gap-3">
          {[
            { label: '0 (Stable)',     color: 'bg-slate-600' },
            { label: '1–4 (Low)',      color: 'bg-sky-500' },
            { label: '5–14 (Mod)',     color: 'bg-amber-500' },
            { label: '15+ (Hotspot)',  color: 'bg-rose-500 ring-2 ring-rose-500/40' },
          ].map(item => (
            <span key={item.label} className="flex items-center gap-1.5">
              <span className={`inline-block w-2 h-2 rounded-full ${item.color}`} />
              <span className="text-gray-300 text-[11px]">{item.label}</span>
            </span>
          ))}
        </div>
      </div>
    )
  }

  if (isDiffMode) {
    return (
      <div className="flex items-center gap-3 text-xs text-gray-400 bg-cyan-950/30 border border-cyan-500/20 px-3 py-1 rounded-lg">
        <span className="text-cyan-400 font-semibold text-[11px] tracking-wide">Diff Legend:</span>
        <div className="flex items-center gap-3">
          {[
            { label: 'Modified',   color: 'bg-sky-400 ring-2 ring-sky-400/30' },
            { label: 'Direct',     color: 'bg-amber-500' },
            { label: 'Transitive', color: 'bg-purple-500' },
            { label: 'Test Suite', color: 'bg-emerald-400' },
          ].map(item => (
            <span key={item.label} className="flex items-center gap-1.5">
              <span className={`inline-block w-2 h-2 rounded-full ${item.color}`} />
              <span className="text-gray-300 text-[11px]">{item.label}</span>
            </span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4 text-xs text-gray-500">
      <div className="flex items-center gap-3">
        <span className="text-gray-600 font-medium">Nodes</span>
        {[
          { label: 'File',     color: 'bg-gray-400' },
          { label: 'Class',    color: 'bg-blue-500' },
          { label: 'Function', color: 'bg-violet-500' },
          { label: 'Test',     color: 'bg-emerald-500' },
        ].map(item => (
          <span key={item.label} className="flex items-center gap-1.5">
            <span className={`inline-block w-2 h-2 rounded-full ${item.color} opacity-80`} />
            {item.label}
          </span>
        ))}
      </div>
      <span className="text-gray-700">·</span>
      <div className="flex items-center gap-3">
        <span className="text-gray-600 font-medium">Edges</span>
        {[
          { label: 'Import',  color: 'bg-gray-500' },
          { label: 'Call',    color: 'bg-amber-500' },
          { label: 'Inherits', color: 'bg-blue-400' },
          { label: 'Tests',   color: 'bg-emerald-400' },
        ].map(item => (
          <span key={item.label} className="flex items-center gap-1.5">
            <span className={`inline-block w-4 h-0.5 ${item.color} opacity-70 rounded`} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Stat chip ─────────────────────────────────────────────────────────────
function StatChip({ label, value }: { label: string; value: number | string }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.07] rounded-md px-2.5 py-1 text-xs">
      <span className="text-gray-300 font-medium tabular-nums">{value}</span>
      <span className="text-gray-600">{label}</span>
    </span>
  )
}

export default function GraphPage({ repoId }: Props) {
  const { graph, status, scanStage, error, reload } = useGraph(repoId)
  const { result: impactResult, loading: impactLoading, error: impactError, run: runImpact } = useImpact()
  const {
    result: diffResult,
    loading: diffLoading,
    aiLoading: diffAiLoading,
    error: diffError,
    run: runDiff,
    runWithAi: runDiffWithAi,
    clear: clearDiff,
  } = useDiffImpact()

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [diffModeOpen, setDiffModeOpen] = useState(false)
  const [sidebarTab, setSidebarTab] = useState<'diff' | 'node'>('diff')
  const [isolateBlastRadius, setIsolateBlastRadius] = useState(false)
  const [tracedPathNodeId, setTracedPathNodeId] = useState<string | null>(null)
  const [heatmapMode, setHeatmapMode] = useState(false)
  const [hierarchyInfo, setHierarchyInfo] = useState<HierarchyInfo | null>(null)
  const [hierarchyScope, setHierarchyScope] = useState<'component' | 'lineage'>('component')
  const { explanation: aiExplanation, loading: aiLoading, request: requestAI, clear: clearAI } = useAI()
  const graphViewerRef = useRef<GraphViewerHandle>(null)

  const handleLayoutHierarchy = (nodeId: string, scope?: 'component' | 'lineage') => {
    const targetScope = scope ?? hierarchyScope
    setHierarchyScope(targetScope)
    const info = graphViewerRef.current?.layoutHierarchy(nodeId, targetScope)
    if (info) {
      setHierarchyInfo(info)
    }
  }

  const handleResetLayout = () => {
    graphViewerRef.current?.resetLayout()
    setHierarchyInfo(null)
  }

  // ── Source Code Viewer State ──────────────────────────────────────────
  const [codeViewerOpen, setCodeViewerOpen] = useState(false)
  const [viewingFilePath, setViewingFilePath] = useState<string | null>(null)
  const [viewingTargetLine, setViewingTargetLine] = useState<number | null>(null)
  const [viewingSymbolName, setViewingSymbolName] = useState<string | null>(null)
  const [viewingChangedLines, setViewingChangedLines] = useState<number[]>([])

  const handleOpenSource = (filePath: string, targetLine?: number, symbolName?: string, changedLines?: number[]) => {
    setViewingFilePath(filePath)
    setViewingTargetLine(targetLine ?? null)
    setViewingSymbolName(symbolName ?? null)
    setViewingChangedLines(changedLines ?? [])
    setCodeViewerOpen(true)
  }

  // ── Filter state ──────────────────────────────────────────────────────
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set())
  const toggleType = (type: string) => {
    setHiddenTypes(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type); else next.add(type)
      return next
    })
  }

  // ── Search state ──────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Build the set of highlighted node IDs from impact result
  const highlightIds = useMemo<Set<string>>(() => {
    if (!impactResult) return new Set()
    const ids = [
      ...impactResult.direct_affected.map(n => (n as { id: string }).id),
      ...impactResult.transitive_affected.map(n => (n as { id: string }).id),
      ...impactResult.related_tests.map(n => (n as { id: string }).id),
    ]
    return new Set(ids)
  }, [impactResult])

  // Build the diff blast radius highlight map
  const diffHighlights = useMemo<DiffHighlightMap | undefined>(() => {
    if (!diffModeOpen || !diffResult) return undefined
    return {
      changed: new Set(diffResult.changed_symbols.map(s => s.node_id)),
      direct: new Set(diffResult.direct_affected.map(n => n.id)),
      transitive: new Set(diffResult.transitive_affected.map(n => n.id)),
      tests: new Set(diffResult.related_tests.map(n => n.id)),
    }
  }, [diffModeOpen, diffResult])

  // Search results — filter nodes by label (case-insensitive)
  // MUST be here (before any conditional returns) — Rules of Hooks
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q || !graph) return []
    return graph.nodes
      .filter(n => n.data.label.toLowerCase().includes(q) || n.data.id.toLowerCase().includes(q))
      .slice(0, 10)
  }, [searchQuery, graph])

  // Per-render graph stats (safe — no hooks, just derived values)
  const nodeCount   = graph?.nodes.length ?? 0
  const edgeCount   = graph?.edges.length ?? 0
  const typeCounts  = useMemo(() => {
    if (!graph) return {} as Record<string, number>
    return graph.nodes.reduce((acc, n) => {
      const t = n.data.type
      acc[t] = (acc[t] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)
  }, [graph])

  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(node)
    clearAI()
    if (diffModeOpen) {
      setSidebarTab('node')
    }
    // Fly to node with a small delay so the sidebar doesn't obscure the animation
    setTimeout(() => graphViewerRef.current?.focusNode(node.id), 50)
    // If hierarchy mode is active, rearrange around newly selected node
    if (hierarchyInfo?.active) {
      setTimeout(() => handleLayoutHierarchy(node.id, hierarchyScope), 60)
    }
  }

  const handleBackgroundClick = () => {
    setSelectedNode(null)
    setTracedPathNodeId(null)
    if (hierarchyInfo?.active) {
      handleResetLayout()
    }
    if (diffModeOpen) {
      setSidebarTab('diff')
    }
  }

  const handleAnalyze = (nodeId: string, description: string) => {
    clearAI()
    runImpact(repoId, nodeId, description)
  }

  const handleAiRequest = () => {
    if (selectedNode) {
      requestAI(repoId, selectedNode.id, impactResult?.change_description ?? '')
    }
  }

  const handleSearchSelect = (node: GraphNode) => {
    setSelectedNode(node)
    clearAI()
    setSearchQuery('')
    setSearchOpen(false)
    if (diffModeOpen) {
      setSidebarTab('node')
    }
    // Pan graph to the selected node
    setTimeout(() => graphViewerRef.current?.focusNode(node.id), 50)
  }

  // ── Loading / error states ────────────────────────────────────────────
  if (status === 'scanning' && !graph) {
    const STAGES = [
      'Parsing Python files…',
      'Extracting dependencies…',
      'Reading Git history…',
      'Building dependency graph…',
      'Saving graph…',
    ]
    const stageIdx  = STAGES.indexOf(scanStage ?? '')
    const progress  = stageIdx >= 0 ? Math.round(((stageIdx + 1) / STAGES.length) * 100) : 10

    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-56px)] gap-6">
        <div className="relative">
          <div className="w-12 h-12 border-2 border-blue-500/20 rounded-full" />
          <div className="w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full animate-spin absolute inset-0" />
        </div>
        <div className="w-64 text-center">
          <p className="text-gray-300 text-sm font-medium mb-1">Scanning repository…</p>
          <p className="text-blue-400 text-xs font-medium mb-3 min-h-[16px]">{scanStage ?? 'Starting…'}</p>
          {/* Progress bar */}
          <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          {/* Stage dots */}
          <div className="flex justify-between mt-2">
            {STAGES.map((s, i) => (
              <span
                key={s}
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${i <= stageIdx ? 'bg-blue-500' : 'bg-white/[0.08]'}`}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-56px)] gap-4">
        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <svg viewBox="0 0 16 16" fill="none" className="w-5 h-5 text-red-400">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="text-center">
          <p className="text-gray-200 font-medium text-sm mb-1">Scan failed</p>
          <p className="text-gray-500 text-xs mb-3">{error}</p>
          <button
            onClick={reload}
            className="text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-md transition-colors"
          >
            Retry scan
          </button>
        </div>
      </div>
    )
  }

  if (!graph) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)]">
        <p className="text-gray-600 text-sm animate-pulse">Loading graph…</p>
      </div>
    )
  }

  // ── Main layout ───────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">

      {/* ── Graph canvas ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-0 min-w-0 overflow-hidden">

        {/* Toolbar */}
        <div className="relative z-30 flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-[#0d1017]/90 backdrop-blur-md gap-3">
          {/* Left — stats */}
          <div className="flex items-center gap-2 flex-wrap">
            <StatChip value={nodeCount} label="nodes" />
            <StatChip value={edgeCount} label="edges" />
            {Object.entries(typeCounts).map(([type, count]) => (
              <span key={type} className="hidden lg:inline-flex items-center gap-1 text-xs text-gray-600">
                <span className={`w-1.5 h-1.5 rounded-full ${TYPE_DOT[type] ?? 'bg-gray-500'} opacity-70`} />
                {count} {type}s
              </span>
            ))}
            <button
              onClick={reload}
              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-300 transition-colors ml-1"
              title="Re-scan repository"
            >
              <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
                <path d="M13.5 8A5.5 5.5 0 112.5 5M2.5 2v3h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Re-scan
            </button>
          </div>

          {/* Centre — search */}
          <div ref={searchRef} className="relative flex-1 max-w-sm min-w-[200px]">
            <div className="flex items-center gap-2 bg-[#121620] border border-white/[0.12] rounded-lg px-2.5 py-1.5 focus-within:border-blue-500/60 focus-within:bg-[#151a26] focus-within:ring-1 focus-within:ring-blue-500/30 transition-all">
              <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-gray-500 flex-shrink-0">
                <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true) }}
                onFocus={() => searchQuery && setSearchOpen(true)}
                onKeyDown={e => {
                  if (e.key === 'Escape') { setSearchQuery(''); setSearchOpen(false) }
                  if (e.key === 'Enter' && searchResults.length > 0) handleSearchSelect(searchResults[0].data)
                }}
                placeholder="Search functions, classes, files…"
                className="flex-1 bg-transparent text-xs text-gray-200 placeholder-gray-500 outline-none min-w-0 font-sans"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setSearchOpen(false) }}
                  className="text-gray-500 hover:text-gray-300 p-0.5 rounded transition-colors flex-shrink-0"
                >
                  <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3"><path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                </button>
              )}
            </div>

            {/* Dropdown results */}
            {searchOpen && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#0f131c] border border-white/[0.14] rounded-xl shadow-2xl shadow-black/90 z-50 overflow-hidden backdrop-blur-xl">
                <div className="px-3 py-1.5 border-b border-white/[0.06] flex items-center justify-between text-[10px] text-gray-500">
                  <span>{searchResults.length} matching component{searchResults.length !== 1 ? 's' : ''}</span>
                  <span className="font-mono text-[9px] text-gray-600">Press ↵ to jump</span>
                </div>
                <div className="max-h-64 overflow-y-auto xray-scrollbar divide-y divide-white/[0.03]">
                  {searchResults.map((n, idx) => (
                    <button
                      key={n.data.id}
                      onClick={() => handleSearchSelect(n.data)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-blue-500/10 hover:border-l-2 hover:border-blue-400 transition-all text-left group"
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${TYPE_DOT[n.data.type] ?? 'bg-gray-500'} ring-2 ring-black/40`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-medium text-gray-200 group-hover:text-blue-300 transition-colors truncate">
                            {n.data.label}
                          </span>
                          {idx === 0 && (
                            <span className="text-[9px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1 py-0.2 rounded font-sans">
                              Best match
                            </span>
                          )}
                        </div>
                        {n.data.module_name && (
                          <span className="text-[10px] text-gray-500 truncate block font-mono">
                            {n.data.module_name}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-500 bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 rounded capitalize flex-shrink-0 font-medium">
                        {n.data.type}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {searchOpen && searchQuery.trim() && searchResults.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#0f131c] border border-white/[0.14] rounded-xl shadow-2xl shadow-black/90 z-50 px-3.5 py-3 text-xs text-gray-400">
                No nodes match <span className="font-mono text-gray-200">"{searchQuery}"</span>
              </div>
            )}
          </div>

          {/* Right — Subgraph Focus + Git Diff Mode button + legend */}
          <div className="flex items-center gap-2.5">
            {/* Hierarchy Tree Layout Toggle */}
            {(selectedNode || hierarchyInfo?.active) && (
              <button
                onClick={() => {
                  if (hierarchyInfo?.active) {
                    handleResetLayout()
                  } else if (selectedNode) {
                    handleLayoutHierarchy(selectedNode.id)
                  }
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  hierarchyInfo?.active
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-md shadow-emerald-500/10'
                    : 'bg-white/[0.05] border-white/[0.1] text-gray-300 hover:text-white hover:bg-white/[0.08]'
                }`}
                title={
                  hierarchyInfo?.active
                    ? "Reset graph back to organic layout"
                    : "Re-arrange all connected nodes into a top-to-bottom hierarchy"
                }
              >
                <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0">
                  <path d="M8 2v4M8 6l-4 4M8 6l4 4M4 10v3M12 10v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="8" cy="2" r="1.5" fill="currentColor"/>
                  <circle cx="4" cy="13" r="1.5" fill="currentColor"/>
                  <circle cx="12" cy="13" r="1.5" fill="currentColor"/>
                </svg>
                <span>{hierarchyInfo?.active ? 'Exit Hierarchy' : 'Hierarchy Tree'}</span>
              </button>
            )}

            {/* Focus Subgraph / Full Graph Toggle */}
            {((diffModeOpen && Boolean(diffResult)) || Boolean(impactResult)) && (
              <button
                onClick={() => setIsolateBlastRadius(prev => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  isolateBlastRadius
                    ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 shadow-md shadow-purple-500/10'
                    : 'bg-white/[0.05] border-white/[0.1] text-gray-300 hover:text-white hover:bg-white/[0.08]'
                }`}
                title={isolateBlastRadius ? "Show full repository graph" : "Isolate blast radius and hide unaffected nodes"}
              >
                <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-purple-400 flex-shrink-0">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3"/>
                  <circle cx="8" cy="8" r="2.5" fill="currentColor"/>
                </svg>
                <span>{isolateBlastRadius ? 'Full Graph' : 'Focus Subgraph'}</span>
              </button>
            )}

            {/* Git Churn Heatmap Toggle */}
            <button
              onClick={() => setHeatmapMode(prev => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                heatmapMode
                  ? 'bg-orange-500/20 border-orange-500/50 text-orange-300 shadow-md shadow-orange-500/10'
                  : 'bg-white/[0.05] border-white/[0.1] text-gray-400 hover:text-white hover:bg-white/[0.08]'
              }`}
              title={heatmapMode ? "Switch to standard component view" : "Visualize code churn hotspots and high-frequency commit areas"}
            >
              <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-orange-400 flex-shrink-0">
                <path d="M8 1c.5 2 2.5 3 2.5 5 0 2-1.5 3.5-2.5 4-1-.5-2.5-2-2.5-4 0-2 2-3 2.5-5z" fill="currentColor" fillOpacity="0.3"/>
                <path d="M8 1c.5 2 2.5 3 2.5 5 0 2-1.5 3.5-2.5 4-1-.5-2.5-2-2.5-4 0-2 2-3 2.5-5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                <path d="M8 7c.3 1 1.2 1.5 1.2 2.5 0 1-.7 1.7-1.2 2-.5-.3-1.2-1-1.2-2 0-1 .9-1.5 1.2-2.5z" fill="currentColor"/>
              </svg>
              <span>{heatmapMode ? 'Exit Heatmap' : 'Hotspots'}</span>
            </button>

            <button
              onClick={() => {
                setDiffModeOpen(prev => {
                  const next = !prev
                  if (next) setSidebarTab('diff')
                  return next
                })
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                diffModeOpen
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-lg shadow-cyan-500/10'
                  : 'bg-white/[0.05] border-white/[0.1] text-gray-300 hover:text-white hover:bg-white/[0.08]'
              }`}
              title="Analyze Git diff blast radius"
            >
              <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0">
                <path d="M4 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM4 10a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM12 10a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM4 6v4M4 7.5c2 0 4 1 8 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Git Diff Mode</span>
              {diffResult && (
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse ml-0.5" />
              )}
            </button>

            <div className="hidden md:block">
              <Legend isDiffMode={diffModeOpen && Boolean(diffResult)} isHeatmapMode={heatmapMode} />
            </div>
          </div>
        </div>

        {/* Filter chips */}
        <div className="relative z-20 flex items-center gap-2 px-4 py-1.5 border-b border-white/[0.04] bg-[#0d1017]/40 flex-wrap">
          <span className="text-[10px] text-gray-600 font-medium uppercase tracking-wider mr-1">Show</span>
          {[
            { type: 'file',     label: 'Files',     dot: 'bg-gray-400' },
            { type: 'class',    label: 'Classes',   dot: 'bg-blue-500' },
            { type: 'function', label: 'Functions', dot: 'bg-violet-500' },
            { type: 'test',     label: 'Tests',     dot: 'bg-emerald-500' },
          ].map(({ type, label, dot }) => {
            const active = !hiddenTypes.has(type)
            return (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={[
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-all duration-150',
                  active
                    ? 'bg-white/[0.06] border-white/[0.12] text-gray-300'
                    : 'bg-transparent border-white/[0.04] text-gray-600 line-through',
                ].join(' ')}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${active ? dot : 'bg-gray-700'}`} />
                {label}
              </button>
            )
          })}
          {hiddenTypes.size > 0 && (
            <button
              onClick={() => setHiddenTypes(new Set())}
              className="text-[10px] text-gray-600 hover:text-gray-400 ml-1 transition-colors"
            >
              Reset
            </button>
          )}
        </div>

        {/* Cytoscape canvas */}
        <div className="flex-1 relative z-10 overflow-hidden">
          <GraphViewer
            ref={graphViewerRef}
            data={graph}
            selectedNodeId={selectedNode?.id ?? null}
            highlightIds={highlightIds}
            diffHighlights={diffHighlights}
            isolateBlastRadius={isolateBlastRadius}
            tracedPathNodeId={tracedPathNodeId}
            heatmapMode={heatmapMode}
            hiddenTypes={hiddenTypes}
            onNodeClick={handleNodeClick}
            onBackgroundClick={handleBackgroundClick}
            onHierarchyChange={setHierarchyInfo}
          />

          {/* Floating hint when nothing selected and no diff */}
          {!selectedNode && !diffResult && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
              <div className="flex items-center gap-2 bg-[#161b26]/90 backdrop-blur-md border border-white/[0.08] rounded-full px-4 py-2 text-xs text-gray-400 shadow-xl">
                <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-gray-500">
                  <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
                  <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.2"/>
                </svg>
                {diffModeOpen ? 'Git Diff Mode active — paste unified diff or load sample' : 'Click any node to analyse its change impact, or open Git Diff Mode'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Sidebar (DiffPanel or NodePanel) ─────────────────────────── */}
      {(diffModeOpen || selectedNode) && (
        <div className="w-[380px] flex-shrink-0 border-l border-white/[0.06] overflow-y-auto xray-scrollbar bg-[#0d1017] flex flex-col">
          {/* Tab switcher when both diff mode and node are active */}
          {diffModeOpen && selectedNode && (
            <div className="flex items-center border-b border-white/[0.06] bg-[#0d1017]/95 px-2 pt-2 gap-1 sticky top-0 z-20">
              <button
                onClick={() => setSidebarTab('diff')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-t-md transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
                  sidebarTab === 'diff'
                    ? 'border-cyan-400 text-cyan-300 bg-white/[0.04]'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                Diff Analysis
              </button>
              <button
                onClick={() => setSidebarTab('node')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-t-md transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
                  sidebarTab === 'node'
                    ? 'border-blue-400 text-blue-300 bg-white/[0.04]'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${TYPE_DOT[selectedNode.type] ?? 'bg-gray-400'}`} />
                <span className="truncate max-w-[120px]">{selectedNode.label}</span>
              </button>
            </div>
          )}

          {/* Panel view */}
          {diffModeOpen && (!selectedNode || sidebarTab === 'diff') ? (
            <DiffPanel
              repoId={repoId}
              result={diffResult}
              loading={diffLoading}
              aiLoading={diffAiLoading}
              error={diffError}
              onAnalyze={(diff, desc) => runDiff(repoId, diff, desc)}
              onRequestAI={(diff, desc) => runDiffWithAi(repoId, diff, desc)}
              onClear={clearDiff}
              onClose={() => setDiffModeOpen(false)}
              onFocusNode={(nodeId) => {
                graphViewerRef.current?.focusNode(nodeId)
              }}
              onTracePath={setTracedPathNodeId}
              tracedNodeId={tracedPathNodeId}
              onViewSource={handleOpenSource}
            />
          ) : selectedNode ? (
            <div>
              {/* Sidebar header (when only node is open) */}
              {!diffModeOpen && (
                <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-[#0d1017]/95 backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${TYPE_DOT[selectedNode.type] ?? 'bg-gray-400'}`} />
                    <h3 className="text-sm font-semibold text-gray-200">Node Details</h3>
                  </div>
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-white/[0.06] transition-all"
                    title="Close"
                  >
                    <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
                      <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              )}

              <div className="p-4">
                <NodePanel
                  node={selectedNode}
                  repoId={repoId}
                  impactResult={impactResult}
                  impactLoading={impactLoading}
                  impactError={impactError}
                  onAnalyze={handleAnalyze}
                  aiExplanation={aiExplanation}
                  aiLoading={aiLoading}
                  onAiRequest={handleAiRequest}
                  onViewSource={handleOpenSource}
                  onLayoutHierarchy={handleLayoutHierarchy}
                  onResetLayout={handleResetLayout}
                  isHierarchyActive={Boolean(hierarchyInfo?.active)}
                  hierarchyNodeCount={hierarchyInfo?.nodeCount}
                  hierarchyScope={hierarchyScope}
                  onScopeChange={setHierarchyScope}
                />
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ── In-App Source Code Viewer & Diff Inspector Drawer ────────────── */}
      <CodeViewerDrawer
        repoId={repoId}
        filePath={viewingFilePath}
        targetLine={viewingTargetLine}
        symbolName={viewingSymbolName}
        changedLines={viewingChangedLines}
        isOpen={codeViewerOpen}
        onClose={() => setCodeViewerOpen(false)}
      />
    </div>
  )
}
