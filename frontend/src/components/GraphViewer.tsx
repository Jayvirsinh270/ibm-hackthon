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

import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react'
import cytoscape from 'cytoscape'
import type { Core, NodeSingular, EventObject } from 'cytoscape'
import type { GraphData, GraphNode } from '../types'

export interface HierarchyInfo {
  active: boolean
  nodeId: string | null
  nodeLabel?: string
  nodeCount: number
  callerCount: number
  calleeCount: number
  tierCount: number
  scope: 'lineage' | 'deep' | 'component'
}

export interface GraphViewerHandle {
  focusNode: (id: string) => void
  tracePath: (targetId: string | null) => void
  exportPng: () => void
  layoutHierarchy: (nodeId: string, scope?: 'lineage' | 'deep' | 'component') => HierarchyInfo | null
  resetLayout: () => void
}

export interface DiffHighlightMap {
  changed: Set<string>
  direct: Set<string>
  transitive: Set<string>
  tests: Set<string>
}

interface Props {
  data: GraphData
  selectedNodeId: string | null
  highlightIds: Set<string>
  diffHighlights?: DiffHighlightMap | null
  isolateBlastRadius?: boolean
  tracedPathNodeId?: string | null
  heatmapMode?: boolean
  hiddenTypes?: Set<string>
  onNodeClick: (node: GraphNode) => void
  onBackgroundClick?: () => void
  onHierarchyChange?: (info: HierarchyInfo | null) => void
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
  // Highlighted (single node mode)
  { selector: 'node.highlighted',
    style: {
      'background-color': '#78350f', 'border-color': '#f59e0b', 'border-width': 2,
      'color': '#fbbf24', 'text-background-color': '#292524', 'z-index': 50,
    } },
  // Git Diff Mode Highlights
  { selector: 'node.changed-symbol',
    style: {
      'background-color': '#0284c7', 'border-color': '#38bdf8', 'border-width': 3,
      'color': '#ffffff', 'font-size': '10px', 'text-background-color': '#075985', 'z-index': 95,
    } },
  { selector: 'node.direct-affected',
    style: {
      'background-color': '#9a3412', 'border-color': '#fb923c', 'border-width': 2.5,
      'color': '#ffedd5', 'text-background-color': '#431407', 'z-index': 85,
    } },
  { selector: 'node.transitive-affected',
    style: {
      'background-color': '#581c87', 'border-color': '#c084fc', 'border-width': 2,
      'color': '#f3e8ff', 'text-background-color': '#3b0764', 'z-index': 75,
    } },
  { selector: 'node.related-test',
    style: {
      'background-color': '#065f46', 'border-color': '#34d399', 'border-width': 2,
      'color': '#ecfdf5', 'text-background-color': '#064e3b', 'z-index': 80,
    } },
  // Dimmed
  { selector: 'node.dimmed',    style: { 'opacity': 0.15 } },
  { selector: 'node.type-hidden', style: { 'display': 'none' } },
  { selector: 'edge.type-hidden', style: { 'display': 'none' } },
  { selector: 'node.subgraph-hidden', style: { 'display': 'none' } },
  { selector: 'edge.subgraph-hidden', style: { 'display': 'none' } },
  // Hierarchy Tree Layout Mode
  { selector: 'node.hierarchy-dimmed', style: { 'opacity': 0.04, 'events': 'no' } },
  { selector: 'edge.hierarchy-dimmed', style: { 'opacity': 0.01, 'events': 'no' } },
  { selector: 'node.hierarchy-node',
    style: {
      'border-color': '#38bdf8', 'border-width': 2,
      'color': '#e0f2fe', 'opacity': 1, 'z-index': 100,
    } },
  { selector: 'node.hierarchy-caller',
    style: {
      'background-color': '#064e3b', 'border-color': '#34d399', 'border-width': 2.5,
      'color': '#a7f3d0', 'text-background-color': '#022c22', 'z-index': 120,
    } },
  { selector: 'node.hierarchy-callee',
    style: {
      'background-color': '#3b0764', 'border-color': '#c084fc', 'border-width': 2.5,
      'color': '#f3e8ff', 'text-background-color': '#1e053a', 'z-index': 120,
    } },
  { selector: 'node.hierarchy-target',
    style: {
      'background-color': '#1e3a8a', 'border-color': '#38bdf8', 'border-width': 4,
      'color': '#ffffff', 'font-size': '11px', 'font-weight': 'bold',
      'text-background-color': '#082f49', 'text-background-opacity': 0.95,
      'text-background-padding': '4px', 'width': 36, 'height': 36, 'z-index': 160,
    } },
  { selector: 'edge.hierarchy-edge',
    style: {
      'line-color': '#38bdf8', 'target-arrow-color': '#38bdf8', 'target-arrow-shape': 'triangle',
      'arrow-scale': 1.2, 'width': 2.5, 'curve-style': 'bezier', 'opacity': 0.9, 'z-index': 110,
    } },
  // Traced path (gradient cyan illuminated lineage)
  { selector: 'node.path-traced',
    style: {
      'border-color': '#00f0ff',
      'border-width': 3.5,
      'color': '#ffffff',
      'text-background-color': '#083344',
      'z-index': 110,
    } },
  { selector: 'edge.path-traced',
    style: {
      'line-color': '#00f0ff',
      'target-arrow-color': '#00f0ff',
      'width': 3.5,
      'opacity': 1,
      'curve-style': 'bezier',
      'z-index': 105,
    } },
  // Hovered
  { selector: 'node.hovered',   style: { 'border-color': '#e5e7eb', 'border-width': 2, 'z-index': 60 } },
  // Git Churn Heatmap
  { selector: 'node.churn-zero',
    style: { 'background-color': '#1e293b', 'border-color': '#334155', 'color': '#64748b' } },
  { selector: 'node.churn-low',
    style: { 'background-color': '#075985', 'border-color': '#0284c7', 'color': '#38bdf8' } },
  { selector: 'node.churn-medium',
    style: { 'background-color': '#78350f', 'border-color': '#f59e0b', 'color': '#fbbf24' } },
  { selector: 'node.churn-high',
    style: {
      'background-color': '#991b1b',
      'border-color': '#ef4444',
      'border-width': 3,
      'color': '#fecaca',
      'z-index': 90,
    } },

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
  diffHighlights,
  isolateBlastRadius,
  tracedPathNodeId,
  heatmapMode,
  hiddenTypes,
  onNodeClick,
  onBackgroundClick,
  onHierarchyChange,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef        = useRef<Core | null>(null)
  const layoutTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [hierarchyInfo, setHierarchyInfo] = useState<HierarchyInfo | null>(null)
  const hierarchyInfoRef = useRef<HierarchyInfo | null>(null)
  hierarchyInfoRef.current = hierarchyInfo

  const onNodeClickRef       = useRef(onNodeClick)
  const onBackgroundClickRef = useRef(onBackgroundClick)
  const onHierarchyChangeRef = useRef(onHierarchyChange)
  useEffect(() => { onNodeClickRef.current = onNodeClick },             [onNodeClick])
  useEffect(() => { onBackgroundClickRef.current = onBackgroundClick }, [onBackgroundClick])
  useEffect(() => { onHierarchyChangeRef.current = onHierarchyChange }, [onHierarchyChange])

  // ── Hierarchy Tree Layout ───────────────────────────────────────────────
  const layoutHierarchy = useCallback((nodeId: string, scope: 'lineage' | 'deep' | 'component' = 'lineage'): HierarchyInfo | null => {
    const cy = cyRef.current
    if (!cy) return null

    const targetNode = cy.getElementById(nodeId)
    if (targetNode.length === 0) return null

    const maxDepth = scope === 'lineage' ? 1 : scope === 'deep' ? 2 : 6

    const nodeTiers = new Map<string, number>()
    nodeTiers.set(nodeId, 0)

    // Inbound BFS (upstream callers)
    let currentLevel: NodeSingular[] = [targetNode as unknown as NodeSingular]
    let depth = 1
    while (currentLevel.length > 0 && depth <= maxDepth) {
      const nextLevel: NodeSingular[] = []
      for (const n of currentLevel) {
        const callers = n.incomers('edge').sources()
        callers.forEach(c => {
          const cNode = c as unknown as NodeSingular
          if (!nodeTiers.has(cNode.id())) {
            nodeTiers.set(cNode.id(), -depth)
            nextLevel.push(cNode)
          }
        })
      }
      currentLevel = nextLevel
      depth++
    }

    // Outbound BFS (downstream callees)
    currentLevel = [targetNode as unknown as NodeSingular]
    depth = 1
    while (currentLevel.length > 0 && depth <= maxDepth) {
      const nextLevel: NodeSingular[] = []
      for (const n of currentLevel) {
        const callees = n.outgoers('edge').targets()
        callees.forEach(c => {
          const cNode = c as unknown as NodeSingular
          if (!nodeTiers.has(cNode.id())) {
            nodeTiers.set(cNode.id(), depth)
            nextLevel.push(cNode)
          }
        })
      }
      currentLevel = nextLevel
      depth++
    }

    // Direct contextual neighbors (tests, parent file/class)
    const neighbors = targetNode.neighborhood('node')
    neighbors.forEach(nb => {
      if (!nodeTiers.has(nb.id())) {
        const type = nb.data('type') as string
        if (type === 'test') {
          nodeTiers.set(nb.id(), 1)
        } else if (type === 'file' || type === 'class') {
          nodeTiers.set(nb.id(), -1)
        }
      }
    })

    // If 'component' mode, also bring in any remaining component nodes on outer levels
    if (scope === 'component') {
      const comp = targetNode.component().nodes()
      comp.forEach(n => {
        if (!nodeTiers.has(n.id())) {
          nodeTiers.set(n.id(), 2)
        }
      })
    }

    // Clean previous hierarchy classes
    cy.elements().removeClass('hierarchy-node hierarchy-edge hierarchy-target hierarchy-caller hierarchy-callee hierarchy-root hierarchy-dimmed')

    // Collect hierarchy elements
    const hierarchyNodes = cy.nodes().filter(n => nodeTiers.has(n.id()))
    const hierarchyEdges = hierarchyNodes.connectedEdges().filter(e => {
      return hierarchyNodes.contains(e.source()) && hierarchyNodes.contains(e.target())
    })
    const hierarchyEles = hierarchyNodes.union(hierarchyEdges)

    // Mark styling classes
    cy.elements().difference(hierarchyEles).addClass('hierarchy-dimmed')
    hierarchyNodes.addClass('hierarchy-node')
    hierarchyEdges.addClass('hierarchy-edge')

    targetNode.addClass('hierarchy-target')
    nodeTiers.forEach((tier, id) => {
      const ele = cy.getElementById(id)
      if (tier < 0) ele.addClass('hierarchy-caller')
      else if (tier > 0) ele.addClass('hierarchy-callee')
    })

    // Group by tier
    const tiers = new Map<number, NodeSingular[]>()
    for (const [id, tier] of nodeTiers.entries()) {
      if (!tiers.has(tier)) tiers.set(tier, [])
      const ele = cy.getElementById(id)
      if (ele.length > 0) {
        tiers.get(tier)!.push(ele as unknown as NodeSingular)
      }
    }

    const sortedTiers = Array.from(tiers.keys()).sort((a, b) => a - b)
    const X_SPACING = 150
    const Y_TIER_HEIGHT = 160
    const SUB_ROW_HEIGHT = 80
    const MAX_PER_ROW = 5

    const negativeTiers = sortedTiers.filter(t => t < 0)
    let currentY = -(negativeTiers.length * Y_TIER_HEIGHT)

    sortedTiers.forEach(t => {
      const nodesInTier = tiers.get(t) || []
      const subRows = Math.ceil(nodesInTier.length / MAX_PER_ROW)

      nodesInTier.forEach((node, idx) => {
        const subRow = Math.floor(idx / MAX_PER_ROW)
        const col = idx % MAX_PER_ROW
        const countInSubRow = Math.min(MAX_PER_ROW, nodesInTier.length - subRow * MAX_PER_ROW)
        const startX = -((countInSubRow - 1) * X_SPACING) / 2
        const x = startX + col * X_SPACING
        const y = currentY + subRow * SUB_ROW_HEIGHT
        
        node.animate({
          position: { x, y },
          duration: 500,
          easing: 'ease-in-out-cubic',
        } as Parameters<typeof node.animate>[0])
      })

      currentY += Math.max(Y_TIER_HEIGHT, subRows * SUB_ROW_HEIGHT + 50)
    })

    // Fit camera to the balanced hierarchy
    setTimeout(() => {
      if (!cyRef.current) return
      cyRef.current.animate({
        fit: {
          eles: hierarchyNodes,
          padding: 80,
        },
        duration: 550,
        easing: 'ease-in-out-cubic',
      } as Parameters<typeof cy.animate>[0])
    }, 100)

    const callerCount = Array.from(nodeTiers.values()).filter(t => t < 0).length
    const calleeCount = Array.from(nodeTiers.values()).filter(t => t > 0).length

    const info: HierarchyInfo = {
      active: true,
      nodeId,
      nodeLabel: (targetNode.data('label') as string) || nodeId,
      nodeCount: hierarchyNodes.length,
      callerCount,
      calleeCount,
      tierCount: sortedTiers.length,
      scope,
    }

    setHierarchyInfo(info)
    onHierarchyChangeRef.current?.(info)
    return info
  }, [])

  // ── Reset to Default Layout ─────────────────────────────────────────────
  const resetLayout = useCallback(() => {
    const cy = cyRef.current
    if (!cy) return

    cy.elements().removeClass('hierarchy-node hierarchy-edge hierarchy-root hierarchy-target hierarchy-dimmed')

    const opts = makeLayout(data.nodes.length)
    const layout = cy.layout({
      ...opts,
      animate: data.nodes.length <= 150,
      animationDuration: 450,
    } as cytoscape.LayoutOptions)

    layout.one('layoutstop', () => {
      cy.animate({
        fit: {
          eles: cy.elements(':visible'),
          padding: 60,
        },
        duration: 400,
        easing: 'ease-in-out-cubic',
      } as Parameters<typeof cy.animate>[0])
    })

    layout.run()

    setHierarchyInfo(null)
    onHierarchyChangeRef.current?.(null)
  }, [data.nodes.length])

  // Expose methods to parent via ref
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
    tracePath: (targetId: string | null) => {
      const cy = cyRef.current
      if (!cy) return
      cy.elements().removeClass('path-traced')
      if (!targetId) return

      const targetEle = cy.getElementById(targetId)
      if (targetEle.length === 0) return

      let rootIds: string[] = []
      if (diffHighlights && diffHighlights.changed.size > 0) {
        rootIds = Array.from(diffHighlights.changed)
      } else if (selectedNodeId) {
        rootIds = [selectedNodeId]
      }

      if (rootIds.length === 0) return

      let bestPath: cytoscape.CollectionReturnValue | null = null
      let shortestDist = Infinity

      for (const rId of rootIds) {
        const rootEle = cy.getElementById(rId)
        if (rootEle.length === 0) continue
        const res = cy.elements().aStar({
          root: rootEle,
          goal: targetEle,
          directed: false,
        })
        if (res.found && res.distance < shortestDist) {
          shortestDist = res.distance
          bestPath = res.path
        }
      }

      if (bestPath) {
        bestPath.addClass('path-traced')
      }
    },
    exportPng: () => {
      const cy = cyRef.current
      if (!cy) return
      const dataUri = cy.png({
        full: true,
        bg: '#0a0c10',
        scale: 2,
      })
      const link = document.createElement('a')
      link.download = `xray-blast-radius-${Date.now()}.png`
      link.href = dataUri
      link.click()
    },
    layoutHierarchy,
    resetLayout,
  }), [diffHighlights, selectedNodeId, layoutHierarchy, resetLayout])

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

    setHierarchyInfo(null)
    onHierarchyChangeRef.current?.(null)

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

    // If hierarchy mode is active, hierarchy styling takes precedence
    if (hierarchyInfoRef.current?.active) {
      if (selectedNodeId) {
        cy.nodes().removeClass('hierarchy-target')
        cy.getElementById(selectedNodeId).addClass('hierarchy-target')
      }
      return
    }

    cy.nodes().removeClass('selected highlighted dimmed changed-symbol direct-affected transitive-affected related-test')
    cy.edges().removeClass('highlighted dimmed')

    // Git Diff Mode Highlights
    if (diffHighlights) {
      const allActive = new Set([
        ...diffHighlights.changed,
        ...diffHighlights.direct,
        ...diffHighlights.transitive,
        ...diffHighlights.tests,
      ])

      cy.nodes().forEach(n => {
        const id = n.id()
        if (diffHighlights.changed.has(id)) {
          n.addClass('changed-symbol')
        } else if (diffHighlights.direct.has(id)) {
          n.addClass('direct-affected')
        } else if (diffHighlights.transitive.has(id)) {
          n.addClass('transitive-affected')
        } else if (diffHighlights.tests.has(id)) {
          n.addClass('related-test')
        } else {
          n.addClass('dimmed')
        }
      })

      cy.edges().forEach(e => {
        const s = e.source().id(), t = e.target().id()
        const onPath = allActive.has(s) && allActive.has(t)
        e.addClass(onPath ? 'highlighted' : 'dimmed')
      })
      return
    }

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
  }, [selectedNodeId, highlightIds, diffHighlights])

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

  // ── Subgraph Isolation ───────────────────────────────────────────────────
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return

    cy.elements().removeClass('subgraph-hidden')

    if (!isolateBlastRadius) {
      return
    }

    let activeIds: Set<string> | null = null
    if (diffHighlights) {
      activeIds = new Set([
        ...diffHighlights.changed,
        ...diffHighlights.direct,
        ...diffHighlights.transitive,
        ...diffHighlights.tests,
      ])
    } else if (selectedNodeId) {
      activeIds = new Set([selectedNodeId, ...highlightIds])
    }

    if (!activeIds || activeIds.size === 0) return

    cy.nodes().forEach(n => {
      if (!activeIds!.has(n.id())) {
        n.addClass('subgraph-hidden')
      }
    })

    cy.edges().forEach(e => {
      const s = e.source().id(), t = e.target().id()
      if (!activeIds!.has(s) || !activeIds!.has(t)) {
        e.addClass('subgraph-hidden')
      }
    })

    // Layout the isolated visible nodes in a clean DAG
    const visibleNodes = cy.nodes(':visible')
    if (visibleNodes.length > 0) {
      visibleNodes.layout({
        name: 'breadthfirst',
        directed: true,
        padding: 60,
        animate: true,
        animationDuration: 350,
        spacingFactor: 1.3,
      } as cytoscape.LayoutOptions).run()
      cy.fit(undefined, 60)
    }
  }, [isolateBlastRadius, diffHighlights, selectedNodeId, highlightIds])

  // ── Traced Path Effect ───────────────────────────────────────────────────
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return

    cy.elements().removeClass('path-traced')
    if (!tracedPathNodeId) return

    const targetEle = cy.getElementById(tracedPathNodeId)
    if (targetEle.length === 0) return

    let rootIds: string[] = []
    if (diffHighlights && diffHighlights.changed.size > 0) {
      rootIds = Array.from(diffHighlights.changed)
    } else if (selectedNodeId) {
      rootIds = [selectedNodeId]
    }

    if (rootIds.length === 0) return

    let bestPath: cytoscape.CollectionReturnValue | null = null
    let shortestDist = Infinity

    for (const rId of rootIds) {
      const rootEle = cy.getElementById(rId)
      if (rootEle.length === 0) continue
      const res = cy.elements().aStar({
        root: rootEle,
        goal: targetEle,
        directed: false,
      })
      if (res.found && res.distance < shortestDist) {
        shortestDist = res.distance
        bestPath = res.path
      }
    }

    if (bestPath) {
      bestPath.addClass('path-traced')
    }
  }, [tracedPathNodeId, diffHighlights, selectedNodeId])

  // ── Heatmap Mode ─────────────────────────────────────────────────────────
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return

    cy.nodes().removeClass('churn-zero churn-low churn-medium churn-high')

    if (!heatmapMode) return

    cy.nodes().forEach(n => {
      const churn = Number(n.data('git_churn') ?? 0)
      if (churn === 0) {
        n.addClass('churn-zero')
      } else if (churn <= 4) {
        n.addClass('churn-low')
      } else if (churn <= 14) {
        n.addClass('churn-medium')
      } else {
        n.addClass('churn-high')
      }
    })
  }, [heatmapMode])

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ background: '#0a0c10' }}
      />

      {/* Floating Hierarchy Status Banner */}
      {hierarchyInfo && hierarchyInfo.active && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-[#0c1017]/90 border border-cyan-500/30 rounded-2xl px-4 py-2 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-3 duration-300">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                <path d="M8 2v4M8 6l-4 4M8 6l4 4M4 10v3M12 10v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="8" cy="2" r="1.5" fill="currentColor"/>
                <circle cx="4" cy="13" r="1.5" fill="currentColor"/>
                <circle cx="12" cy="13" r="1.5" fill="currentColor"/>
              </svg>
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white font-mono">
                  {hierarchyInfo.nodeLabel || hierarchyInfo.nodeId}
                </span>
                <span className="text-[10px] bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.2 rounded font-medium">
                  {hierarchyInfo.nodeCount} nodes · {hierarchyInfo.tierCount} tiers
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                <span className="text-emerald-400 font-medium">▲ {hierarchyInfo.callerCount} Callers</span>
                <span className="text-gray-600">•</span>
                <span className="text-sky-300 font-medium">● Target</span>
                <span className="text-gray-600">•</span>
                <span className="text-purple-400 font-medium">▼ {hierarchyInfo.calleeCount} Dependencies</span>
              </div>
            </div>
          </div>

          <div className="h-7 w-px bg-white/[0.08] mx-0.5" />

          {/* Quick Depth Pills */}
          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/[0.06]">
            {(['lineage', 'deep', 'component'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => layoutHierarchy(hierarchyInfo.nodeId!, mode)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                  hierarchyInfo.scope === mode
                    ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-500/40 shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
                title={
                  mode === 'lineage'
                    ? 'Direct 1-hop callers & callees (Cleanest)'
                    : mode === 'deep'
                    ? '2-hop transitive lineage'
                    : 'All connected nodes in balanced cluster'
                }
              >
                {mode === 'lineage' ? 'Direct' : mode === 'deep' ? 'Deep (2-Hop)' : 'Cluster'}
              </button>
            ))}
          </div>

          <button
            onClick={resetLayout}
            className="flex items-center gap-1 text-xs font-medium text-gray-300 hover:text-rose-200 bg-white/[0.06] hover:bg-rose-500/20 border border-white/[0.1] hover:border-rose-500/40 px-3 py-1.5 rounded-xl transition-all"
            title="Exit hierarchy mode and return to force-directed graph"
          >
            <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3"><path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
            <span>Exit</span>
          </button>
        </div>
      )}

      {/* Canvas tools (export + zoom) */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 z-10">
        <button
          onClick={() => {
            if (hierarchyInfo?.active) {
              resetLayout()
            } else if (selectedNodeId) {
              layoutHierarchy(selectedNodeId)
            }
          }}
          disabled={!selectedNodeId && !hierarchyInfo?.active}
          title={
            hierarchyInfo?.active
              ? "Reset to standard force-directed layout"
              : selectedNodeId
              ? "Arrange connected nodes in hierarchy tree"
              : "Select a node first to arrange its connected hierarchy"
          }
          className={`w-8 h-8 rounded-lg backdrop-blur-sm border transition-all flex items-center justify-center shadow-lg group ${
            hierarchyInfo?.active
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-emerald-500/20'
              : selectedNodeId
              ? 'bg-[#161b26]/90 border-white/[0.10] text-gray-400 hover:text-emerald-300 hover:bg-[#1e2433]'
              : 'bg-[#161b26]/50 border-white/[0.05] text-gray-600 cursor-not-allowed'
          }`}
        >
          <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 group-hover:scale-110 transition-transform">
            <path d="M8 2v4M8 6l-4 4M8 6l4 4M4 10v3M12 10v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="8" cy="2" r="1.5" fill="currentColor"/>
            <circle cx="4" cy="13" r="1.5" fill="currentColor"/>
            <circle cx="12" cy="13" r="1.5" fill="currentColor"/>
          </svg>
        </button>
        <button
          onClick={() => {
            const cy = cyRef.current
            if (!cy) return
            const dataUri = cy.png({ full: true, bg: '#0a0c10', scale: 2 })
            const link = document.createElement('a')
            link.download = `xray-blast-radius-${Date.now()}.png`
            link.href = dataUri
            link.click()
          }}
          title="Export high-resolution PNG"
          className="w-8 h-8 rounded-lg bg-[#161b26]/90 backdrop-blur-sm border border-white/[0.10] text-gray-400 hover:text-cyan-300 hover:bg-[#1e2433] transition-all flex items-center justify-center shadow-lg group"
        >
          <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 group-hover:scale-110 transition-transform">
            <path d="M2.5 5.5A1.5 1.5 0 014 4h1.5l1-1.5h3l1 1.5H12a1.5 1.5 0 011.5 1.5v6a1.5 1.5 0 01-1.5 1.5H4a1.5 1.5 0 01-1.5-1.5v-6z" stroke="currentColor" strokeWidth="1.3"/>
            <circle cx="8" cy="8.5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
          </svg>
        </button>
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
