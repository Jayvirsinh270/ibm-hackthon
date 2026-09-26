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
  module_name: string
  line_number: number
  git_churn: number
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
  selected_node_label: string
  selected_node_type: string
  direct_affected: Array<Record<string, unknown>>
  transitive_affected: Array<Record<string, unknown>>
  related_tests: Array<Record<string, unknown>>
  risk_level: RiskLevel
  risk_score: number
  contributing_factors: string[]
  max_depth: number
  analysis_type: string
  change_description: string
}

export interface ChangedSymbol {
  node_id: string
  label: string
  type: string
  file_path: string
  line_number: number
  change_type: string
}

export interface AffectedNodeSummary {
  id: string
  label?: string
  type?: string
  file_path?: string
  [key: string]: unknown
}

export interface DiffImpactResult {
  changed_files: string[]
  changed_symbols: ChangedSymbol[]
  direct_affected: AffectedNodeSummary[]
  transitive_affected: AffectedNodeSummary[]
  related_tests: AffectedNodeSummary[]
  untested_affected: AffectedNodeSummary[]
  risk_level: RiskLevel
  risk_score: number
  contributing_factors: string[]
  max_depth: number
  analysis_type: string
  change_description: string
  ai?: AIExplanation
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

export interface SourceCodeResponse {
  repo_id: string
  file_path: string
  relative_path: string
  total_lines: number
  content: string
  target_line?: number | null
  start_line?: number | null
  end_line?: number | null
  language: string
}

export interface DiffHunkFile {
  file_path: string
  change_type: string
  changed_lines: number[]
  raw_hunks: string[]
}

export interface DiffInspectResponse {
  repo_id: string
  files: DiffHunkFile[]
}

export interface CloneResponse {
  repo_id: string
  name: string
  file_count: number
  status: string
  source_url?: string
  branch?: string
}
