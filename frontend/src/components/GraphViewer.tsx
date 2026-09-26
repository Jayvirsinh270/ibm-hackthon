// frontend/src/components/GraphViewer.tsx
// Cytoscape.js interactive dependency graph
// Nodes: file (grey), class (blue), function (purple), test (green)
// Edges: import (grey), call (orange), inherits (blue), tests (green dashed)

import { useEffect, useRef } from 'react'
import cytoscape from 'cytoscape'
import type { Core, NodeSingular } from 'cytoscape'
import type { GraphData, GraphNode } from '../types'

interface Props {
  data: GraphData
  selectedNodeId: string | null
  highlightIds: Set<string>
  onNodeClick: (node: GraphNode) => void
}

// ── Cytoscape stylesheet ──────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const STYLESHEET: any[] = [
  {
    selector: 'node',
    style: {
      'background-color': '#4b5563',
      'label': 'data(label)',
      'color': '#d1d5db',
      'font-size': '11px',
      'text-valign': 'bottom',
      'text-halign': 'center',
      'text-margin-y': 4,
      'width': 28,
      'height': 28,
      'border-width': 2,
      'border-color': '#374151',
    },
  },
  // Node types
  { selector: 'node[type="file"]',     style: { 'background-color': '#4b5563', 'shape': 'round-rectangle' } },
  { selector: 'node[type="class"]',    style: { 'background-color': '#1d4ed8', 'shape': 'ellipse' } },
  { selector: 'node[type="function"]', style: { 'background-color': '#7c3aed', 'shape': 'diamond', 'width': 22, 'height': 22 } },
  { selector: 'node[type="test"]',     style: { 'background-color': '#065f46', 'shape': 'round-rectangle' } },
  // Selected
  {
    selector: 'node.selected',
    style: {
      'border-color': '#3b82f6',
      'border-width': 3,
      'background-color': '#1e40af',
    },
  },
  // Highlighted (in impact set)
  {
    selector: 'node.highlighted',
    style: {
      'border-color': '#f59e0b',
      'border-width': 2,
      'background-color': '#92400e',
    },
  },
  // Dimmed (not in impact set when one is selected)
  {
    selector: 'node.dimmed',
    style: { 'opacity': 0.25 },
  },
  // Edges
  {
    selector: 'edge',
    style: {
      'width': 1.5,
      'line-color': '#374151',
      'target-arrow-color': '#374151',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'opacity': 0.7,
    },
  },
  { selector: 'edge[type="call"]',     style: { 'line-color': '#d97706', 'target-arrow-color': '#d97706' } },
  { selector: 'edge[type="inherits"]', style: { 'line-color': '#3b82f6', 'target-arrow-color': '#3b82f6' } },
  { selector: 'edge[type="tests"]',    style: { 'line-color': '#10b981', 'target-arrow-color': '#10b981', 'line-style': 'dashed' } },
  { selector: 'edge.highlighted',      style: { 'opacity': 1, 'width': 2.5 } },
  { selector: 'edge.dimmed',           style: { 'opacity': 0.1 } },
]

export default function GraphViewer({ data, selectedNodeId, highlightIds, onNodeClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef        = useRef<Core | null>(null)

  // ── Init Cytoscape once ───────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    const cy = cytoscape({
      container: containerRef.current,
      elements: [],
      style: STYLESHEET,
      layout: { name: 'cose', animate: false, nodeRepulsion: () => 8000, idealEdgeLength: () => 80 } as cytoscape.LayoutOptions,
      wheelSensitivity: 0.3,
    })

    cy.on('tap', 'node', (evt) => {
      const node = evt.target as NodeSingular
      const nodeData = node.data() as GraphNode
      onNodeClick(nodeData)
    })

    // Click on background → deselect handled by parent via selectedNodeId=null
    cyRef.current = cy
    return () => { cy.destroy(); cyRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Load graph data when it changes ──────────────────────────────────
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.elements().remove()
    cy.add(data.nodes as cytoscape.ElementDefinition[])
    cy.add(data.edges as cytoscape.ElementDefinition[])
    cy.layout({ name: 'cose', animate: false, nodeRepulsion: () => 8000, idealEdgeLength: () => 80 } as cytoscape.LayoutOptions).run()
    cy.fit(undefined, 40)
  }, [data])

  // ── Update visual classes when selection / highlights change ─────────
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return

    cy.nodes().removeClass('selected highlighted dimmed')
    cy.edges().removeClass('highlighted dimmed')

    if (!selectedNodeId) return

    // Selected node
    cy.getElementById(selectedNodeId).addClass('selected')

    if (highlightIds.size > 0) {
      // Highlight impact set; dim everything else
      cy.nodes().forEach(n => {
        const id = n.id()
        if (id === selectedNodeId) return
        if (highlightIds.has(id)) n.addClass('highlighted')
        else n.addClass('dimmed')
      })
      cy.edges().forEach(e => {
        const s = e.source().id(), t = e.target().id()
        if (highlightIds.has(s) || highlightIds.has(t) || s === selectedNodeId || t === selectedNodeId)
          e.addClass('highlighted')
        else
          e.addClass('dimmed')
      })
    }
  }, [selectedNodeId, highlightIds])

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-gray-950 rounded-xl"
      style={{ minHeight: '500px' }}
    />
  )
}
