// frontend/src/components/GraphViewer.tsx
// Cytoscape.js interactive dependency graph
//
// Layout strategy: built-in CoSE with animate:false, deferred via setTimeout so
// the browser paints the loading state before the layout CPU work starts.
// Cola is NOT used — it runs a synchronous simulation that freezes the main thread
// on graphs with 100+ nodes ("Page Unresponsive" error).
//
// Edge style: 'straight' for graphs ≥80 nodes (fastest GPU path),
//             'bezier' for small graphs (nicer curves).

import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react'
import cytoscape from 'cytoscape'
import type { Core, NodeSingular, EventObject } from 'cytoscape'
import type { GraphData, GraphNode } from '../types'

export interface GraphViewerHandle {
  focusNode: (id: string) => void
}

interface Props {
  data: GraphData
  selectedNodeId: string | null
  highlightIds: Set<string>
  hiddenTypes?: Set<string>
  onNodeClick: (node: GraphNode) => void
  onBackgroundClick?: () => void
}

// ── Layout ────────────────────────────────────────────────────────────────
// CoSE with animate:false finishes in <300 ms even for 300-node graphs.
// Key tweaks vs defaults:
//   nodeRepulsion   – higher = more spread out
//   gravity         – pulls disconnected nodes toward centre (no flat rows)
//   idealEdgeLength – longer = clusters spread apart more
//   numIter         – keep low, CoSE converges fast
function makeLayout(nodeCount: number): cytoscape.LayoutOptions {
  const large = nodeCount > 100
  return {
    name: 'cose',
    animate: false,           // MUST be false — animation freezes large graphs
    fit: true,
    padding: 60,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nodeRepulsion:    () => large ? 12000 : 8000,
    idealEdgeLength:  () => large ? 120   : 90,
    edgeElasticity:   () => 100,
    gravity:          large ? 60 : 40,   // higher = disconnected nodes pulled in
    numIter:          large ? 150 : 100, // keep low — we don't need perfection
    coolingFactor:    0.95,
    minTemp:          1,
    randomize:        false,
    componentSpacing: large ? 80 : 50,   // space between connected components
  } as cytoscape.LayoutOptions
}

// ── Stylesheet ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const STYLESHEET: any[] = [
  // Base node
  {
    selector: 'node',
    style: {
      'background-color': '#374151',
      'label': 'data(label)',
      'color': '#9ca3af',
      'font-size': '9px',
      'font-family': '"SF Mono", "Fira Code", ui-monospace, monospace',
      'text-valign': 'bottom',
      'text-halign': 'center',
      'text-margin-y': 4,
      'text-background-color': '#0a0c10',
      'text-background-opacity': 0.85,
      'text-background-padding': '2px',
      'text-background-shape': 'roundrectangle',
      'width':  'data(size)',
      'height': 'data(size)',
      'border-width': 1.5,
      'border-color': '#4b5563',
    },
  },
  // Node types
  { selector: 'node[type="file"]',
    style: { 'background-color': '#1f2937', 'border-color': '#4b5563', 'shape': 'round-rectangle', 'color': '#6b7280' } },
  { selector: 'node[type="class"]',
    style: { 'background-color': '#172554', 'border-color': '#2563eb', 'shape': 'ellipse', 'color': '#93c5fd' } },
  { selector: 'node[type="function"]',
    style: { 'background-color': '#1e1b4b', 'border-color': '#7c3aed', 'shape': 'diamond', 'color': '#c4b5fd' } },
  { selector: 'node[type="test"]',
    style: { 'background-color': '#052e16', 'border-color': '#16a34a', 'shape': 'round-rectangle', 'color': '#6ee7b7' } },
  // Selected
  { selector: 'node.selected',
    style: {
      'background-color': '#1d4ed8', 'border-color': '#60a5fa', 'border-width': 3,
      'color': '#ffffff', 'font-size': '10px', 'text-background-color': '#1e3a5f', 'z-index': 99,
    } },
  // Highlighted
  { selector: 'node.highlighted',
    style: {
      'background-color': '#78350f', 'border-color': '#f59e0b', 'border-width': 2,
      'color': '#fbbf24', 'text-background-color': '#292524', 'z-index': 50,
    } },
  // Dimmed
  { selector: 'node.dimmed',    style: { 'opacity': 0.15 } },
  { selector: 'node.type-hidden', style: { 'display': 'none' } },
  { selector: 'edge.type-hidden', style: { 'display': 'none' } },
  // Hovered
  { selector: 'node.hovered',   style: { 'border-color': '#e5e7eb', 'border-width': 2, 'z-index': 60 } },

  // Base edge — 'straight' is the fastest rendering path in Cytoscape
  {
    selector: 'edge',
    style: {
      'width': 1,
      'line-color': '#1f2937',
      'target-arrow-color': '#374151',
      'target-arrow-shape': 'triangle',
      'arrow-scale': 0.75,
      'curve-style': 'straight',   // fastest — no CPU bezier math per frame
      'opacity': 0.4,
    },
  },
  { selector: 'edge[type="call"]',
    style: { 'line-color': '#92400e', 'target-arrow-color': '#92400e', 'width': 1.2 } },
  { selector: 'edge[type="inherits"]',
    style: { 'line-color': '#1e40af', 'target-arrow-color': '#1e40af', 'width': 1.5, 'curve-style': 'bezier' } },
  { selector: 'edge[type="tests"]',
    style: {
      'line-color': '#14532d', 'target-arrow-color': '#14532d',
      'line-style': 'dashed', 'line-dash-pattern': [5, 3],
    } },
  { selector: 'edge.highlighted', style: { 'opacity': 1, 'width': 2.5, 'curve-style': 'bezier' } },
  { selector: 'edge.dimmed',      style: { 'opacity': 0.05 } },
]

// ── Component ─────────────────────────────────────────────────────────────
const GraphViewer = forwardRef<GraphViewerHandle, Props>(function GraphViewer({
  data,
  selectedNodeId,
  highlightIds,
  hiddenTypes,
  onNodeClick,
  onBackgroundClick,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef        = useRef<Core | null>(null)
  const layoutTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onNodeClickRef       = useRef(onNodeClick)
  const onBackgroundClickRef = useRef(onBackgroundClick)
  useEffect(() => { onNodeClickRef.current = onNodeClick },             [onNodeClick])
  useEffect(() => { onBackgroundClickRef.current = onBackgroundClick }, [onBackgroundClick])

  // Expose focusNode to parent via ref
  useImperativeHandle(ref, () => ({
    focusNode: (id: string) => {
      const cy = cyRef.current
      if (!cy) return
      const node = cy.getElementById(id)
      if (node.length === 0) return
      cy.animate({
        center: { eles: node },
        zoom: Math.max(cy.zoom(), 1.2),
        duration: 350,
        easing: 'ease-in-out-cubic',
      } as Parameters<typeof cy.animate>[0])
    },
  }), [])

  // Zoom helpers
  const zoomIn  = useCallback(() => {
    const cy = cyRef.current; if (!cy) return
    cy.zoom({ level: cy.zoom() * 1.3, renderedPosition: { x: (containerRef.current?.clientWidth ?? 800) / 2, y: (containerRef.current?.clientHeight ?? 600) / 2 } })
  }, [])
  const zoomOut = useCallback(() => {
    const cy = cyRef.current; if (!cy) return
    cy.zoom({ level: cy.zoom() / 1.3, renderedPosition: { x: (containerRef.current?.clientWidth ?? 800) / 2, y: (containerRef.current?.clientHeight ?? 600) / 2 } })
  }, [])
  const fitAll  = useCallback(() => { cyRef.current?.fit(undefined, 50) }, [])

  // ── Init once ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    const cy = cytoscape({
      container: containerRef.current,
      elements: [],
      style: STYLESHEET,
      wheelSensitivity: 0.2,
      minZoom: 0.05,
      maxZoom: 5,
      boxSelectionEnabled: false,
      autounselectify: true,
    })

    cy.on('tap', 'node', (evt: EventObject) => {
      onNodeClickRef.current((evt.target as NodeSingular).data() as GraphNode)
    })
    cy.on('tap', (evt: EventObject) => {
      if (evt.target === cy) onBackgroundClickRef.current?.()
    })
    cy.on('mouseover', 'node', (evt: EventObject) => {
      (evt.target as NodeSingular).addClass('hovered')
    })
    cy.on('mouseout', 'node', (evt: EventObject) => {
      (evt.target as NodeSingular).removeClass('hovered')
    })

    cyRef.current = cy
    return () => {
      if (layoutTimer.current) clearTimeout(layoutTimer.current)
      cy.destroy()
      cyRef.current = null
    }
  }, [])

  // ── Load graph data ──────────────────────────────────────────────────────
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return

    // Cancel any in-flight deferred layout
    if (layoutTimer.current) { clearTimeout(layoutTimer.current); layoutTimer.current = null }

    cy.elements().remove()

    // Compute degree → node size (hub nodes are visually larger)
    const degree: Record<string, number> = {}
    for (const e of data.edges) {
      const src = (e as { data: { source: string } }).data.source
      const tgt = (e as { data: { target: string } }).data.target
      degree[src] = (degree[src] ?? 0) + 1
      degree[tgt] = (degree[tgt] ?? 0) + 1
    }
    const maxDeg = Math.max(1, ...Object.values(degree))

    const sizedNodes = data.nodes.map(n => {
      const d = (n as { data: { id: string; type: string } & object }).data
      const deg  = degree[d.id] ?? 0
      const base = d.type === 'file' ? 22 : d.type === 'class' ? 22 : 18
      const size = base + Math.round((deg / maxDeg) * 20)
      return { ...(n as object), data: { ...d, size } }
    })

    cy.add(sizedNodes as cytoscape.ElementDefinition[])
    cy.add(data.edges as cytoscape.ElementDefinition[])

    // ── Deferred layout ────────────────────────────────────────────────────
    // Yield to the browser's render loop before running the layout CPU work.
    // This ensures the canvas paints first and prevents "Page Unresponsive".
    layoutTimer.current = setTimeout(() => {
      if (!cyRef.current) return
      const opts = makeLayout(data.nodes.length)
      cyRef.current.layout(opts).run()
      cyRef.current.fit(undefined, 60)
      layoutTimer.current = null
    }, 50) // 50 ms is enough for one paint frame before layout starts
  }, [data])

  // ── Selection / highlight classes ───────────────────────────────────────
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return

    cy.nodes().removeClass('selected highlighted dimmed')
    cy.edges().removeClass('highlighted dimmed')

    if (!selectedNodeId) return

    cy.getElementById(selectedNodeId).addClass('selected')

    if (highlightIds.size > 0) {
      cy.nodes().forEach(n => {
        const id = n.id()
        if (id === selectedNodeId) return
        n.addClass(highlightIds.has(id) ? 'highlighted' : 'dimmed')
      })
      cy.edges().forEach(e => {
        const s = e.source().id(), t = e.target().id()
        const onPath = highlightIds.has(s) || highlightIds.has(t) || s === selectedNodeId || t === selectedNodeId
        e.addClass(onPath ? 'highlighted' : 'dimmed')
      })
    }
  }, [selectedNodeId, highlightIds])

  // ── Hidden types ─────────────────────────────────────────────────────────
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.nodes().forEach(n => {
      const type = (n.data('type') as string) ?? ''
      if (hiddenTypes?.has(type)) {
        n.addClass('type-hidden')
      } else {
        n.removeClass('type-hidden')
      }
    })
    cy.edges().forEach(e => {
      const srcHidden = hiddenTypes?.has(e.source().data('type') as string)
      const tgtHidden = hiddenTypes?.has(e.target().data('type') as string)
      if (srcHidden || tgtHidden) {
        e.addClass('type-hidden')
      } else {
        e.removeClass('type-hidden')
      }
    })
  }, [hiddenTypes])

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ background: '#0a0c10' }}
      />

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1 z-10">
        <button
          onClick={fitAll}
          title="Fit all nodes"
          className="w-8 h-8 rounded-lg bg-[#161b26]/90 backdrop-blur-sm border border-white/[0.10] text-gray-400 hover:text-white hover:bg-[#1e2433] transition-all flex items-center justify-center shadow-lg"
        >
          <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
            <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button
          onClick={zoomIn}
          title="Zoom in"
          className="w-8 h-8 rounded-lg bg-[#161b26]/90 backdrop-blur-sm border border-white/[0.10] text-gray-400 hover:text-white hover:bg-[#1e2433] transition-all flex items-center justify-center shadow-lg"
        >
          <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M7 5v4M5 7h4M11.5 11.5l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>
        <button
          onClick={zoomOut}
          title="Zoom out"
          className="w-8 h-8 rounded-lg bg-[#161b26]/90 backdrop-blur-sm border border-white/[0.10] text-gray-400 hover:text-white hover:bg-[#1e2433] transition-all flex items-center justify-center shadow-lg"
        >
          <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M5 7h4M11.5 11.5l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
})

export default GraphViewer
