// frontend/src/pages/GraphPage.tsx
// Main analysis page — graph viewer + node panel + impact results

import { useState, useMemo } from 'react'
import GraphViewer from '../components/GraphViewer'
import NodePanel from '../components/NodePanel'
import { useGraph } from '../hooks/useGraph'
import { useImpact } from '../hooks/useImpact'
import { useAI } from '../hooks/useAI'
import type { GraphNode } from '../types'

interface Props {
  repoId: string
}

// ── Legend ────────────────────────────────────────────────────────────────
function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
      <span className="font-semibold text-gray-400">Nodes:</span>
      <span><span className="inline-block w-2.5 h-2.5 rounded bg-gray-500 mr-1" />File</span>
      <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-700 mr-1" />Class</span>
      <span><span className="inline-block w-2.5 h-2.5 rotate-45 bg-violet-700 mr-1" />Function</span>
      <span><span className="inline-block w-2.5 h-2.5 rounded bg-emerald-900 mr-1" />Test</span>
      <span className="ml-2 font-semibold text-gray-400">Edges:</span>
      <span><span className="inline-block w-3 h-0.5 bg-gray-500 mr-1" />Import</span>
      <span><span className="inline-block w-3 h-0.5 bg-amber-600 mr-1" />Call</span>
      <span><span className="inline-block w-3 h-0.5 bg-blue-500 mr-1" />Inherits</span>
      <span><span className="inline-block w-3 h-0.5 bg-emerald-500 mr-1" />Tests</span>
    </div>
  )
}

export default function GraphPage({ repoId }: Props) {
  const { graph, status, error, reload } = useGraph(repoId)
  const { result: impactResult, loading: impactLoading, error: impactError, run: runImpact } = useImpact()
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const { explanation: aiExplanation, loading: aiLoading, request: requestAI, clear: clearAI } = useAI()

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

  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(node)
    clearAI()
  }

  const handleBackgroundClick = () => {
    setSelectedNode(null)
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

  // ── Loading / error states ────────────────────────────────────────────
  if (status === 'scanning' && !graph) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">Scanning repository…</p>
        <p className="text-gray-600 text-xs">Parsing Python files and building dependency graph</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3">
        <p className="text-red-400">⚠ Scan failed</p>
        <p className="text-gray-500 text-sm">{error}</p>
        <button onClick={reload} className="text-xs text-blue-400 underline">Retry</button>
      </div>
    )
  }

  if (!graph) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-600 text-sm animate-pulse">Loading graph…</p>
      </div>
    )
  }

  const nodeCount = graph.nodes.length
  const edgeCount = graph.edges.length

  // ── Main layout ───────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-52px)] overflow-hidden">
      {/* ── Graph canvas ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col p-3 gap-2 min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-xs text-gray-500">
              {nodeCount} nodes · {edgeCount} edges
            </p>
            <button
              onClick={reload}
              className="text-xs text-gray-600 hover:text-gray-400"
              title="Re-scan"
            >
              ↺ Re-scan
            </button>
          </div>
          <Legend />
        </div>

        {/* Cytoscape canvas */}
        <div className="flex-1 rounded-xl overflow-hidden border border-gray-800">
          <GraphViewer
            data={graph}
            selectedNodeId={selectedNode?.id ?? null}
            highlightIds={highlightIds}
            onNodeClick={handleNodeClick}
            onBackgroundClick={handleBackgroundClick}
          />
        </div>

        {/* Hint */}
        {!selectedNode && (
          <p className="text-center text-xs text-gray-700">
            Click any node to analyse its change impact
          </p>
        )}
      </div>

      {/* ── Sidebar ───────────────────────────────────────────────────── */}
      {selectedNode && (
        <div className="w-80 flex-shrink-0 border-l border-gray-800 overflow-y-auto p-4 bg-gray-950">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-300">Node Details</h3>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-gray-600 hover:text-gray-400 text-lg leading-none"
            >
              ×
            </button>
          </div>
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
          />
        </div>
      )}
    </div>
  )
}
