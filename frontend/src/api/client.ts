// frontend/src/api/client.ts
// Axios API client with typed endpoints.
// Base URL is read from the VITE_API_BASE_URL env variable.

import axios from 'axios'
import type { HealthResponse, ImpactResult, AIExplanation, GraphData } from '../types'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// ── Health ────────────────────────────────────────────────────────────────

export async function checkHealth(): Promise<HealthResponse> {
  const { data } = await api.get<HealthResponse>('/api/health')
  return data
}

// ── Repository ────────────────────────────────────────────────────────────

/** Upload a zip file and return the new repo_id + metadata. */
export async function uploadRepository(file: File): Promise<{
  repo_id: string
  name: string
  file_count: number
  status: string
}> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post('/api/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

/** Get the file tree structure for a repo. */
export async function getStructure(repoId: string): Promise<{
  repo_id: string
  files: string[]
  tree: Record<string, unknown>
}> {
  const { data } = await api.get(`/api/structure/${repoId}`)
  return data
}

/** Delete a repository. */
export async function deleteRepository(repoId: string): Promise<void> {
  await api.delete(`/api/repos/${repoId}`)
}

// ── Graph ─────────────────────────────────────────────────────────────────

/** Fetch the full dependency graph for a repo. */
export async function getGraph(_repoId: string): Promise<GraphData> {
  // TODO: implement in Phase 4
  throw new Error('Not implemented yet (Phase 4)')
}

// ── Impact ────────────────────────────────────────────────────────────────

/** Run impact analysis for a selected node. */
export async function getImpact(
  _repoId: string,
  _nodeId: string,
  _changeDescription?: string,
): Promise<ImpactResult> {
  // TODO: implement in Phase 6
  throw new Error('Not implemented yet (Phase 6)')
}

// ── AI Explanation ────────────────────────────────────────────────────────

/** Request an AI explanation for the impact of a selected node. */
export async function explainImpact(
  _repoId: string,
  _nodeId: string,
  _changeDescription?: string,
): Promise<AIExplanation> {
  // TODO: implement in Phase 8
  throw new Error('Not implemented yet (Phase 8)')
}
