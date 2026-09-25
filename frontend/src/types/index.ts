// Shared TypeScript types for X-Ray frontend
// Phase-by-phase these will be expanded as the backend models are built.

// ── Repository ────────────────────────────────────────────────────────────

export interface Repository {
  id: string
  name: string
  status: 'pending' | 'scanning' | 'ready' | 'error'
  created_at: string
  file_count?: number
}

// ── Graph ─────────────────────────────────────────────────────────────────

export type NodeType = 'file' | 'class' | 'function' | 'test'

export interface GraphNode {
  id: string
  label: string
  type: NodeType
  file_path: string
  git_churn?: number
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  type: 'import' | 'call' | 'inherits' | 'tests'
}

export interface GraphData {
  nodes: Array<{ data: GraphNode }>
  edges: Array<{ data: GraphEdge }>
}

// ── Impact Analysis ───────────────────────────────────────────────────────

export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW'

export interface ImpactResult {
  selected_node_id: string
  direct_affected: GraphNode[]
  transitive_affected: GraphNode[]
  related_tests: GraphNode[]
  risk_level: RiskLevel
  risk_score: number
  max_depth: number
}

// ── AI Explanation ────────────────────────────────────────────────────────

export interface AIExplanation {
  available: boolean
  explanation: string
  risk_areas: string[]
  migration_plan: string[]
  recommended_tests: string[]
  model_used: string
  analysis_type: 'ai_assisted' | 'mock' | 'unavailable'
}

// ── API responses ─────────────────────────────────────────────────────────

export interface HealthResponse {
  status: string
  service: string
}
