// frontend/src/api/client.ts
// Axios API client with typed endpoints.
// Base URL is read from the VITE_API_BASE_URL env variable.

import axios from 'axios'
import type { HealthResponse, ImpactResult, AIExplanation, GraphData, DiffImpactResult } from '../types'

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

/** Trigger analysis pipeline for a repo (returns immediately, runs in background). */
export async function scanRepository(repoId: string): Promise<{ repo_id: string; status: string; message: string }> {
  const { data } = await api.post(`/api/scan/${repoId}`)
  return data
}

/** Poll scan status. */
export async function getScanStatus(repoId: string): Promise<{ repo_id: string; status: string; error_message?: string; scan_stage?: string }> {
  const { data } = await api.get(`/api/status/${repoId}`)
  return data
}

/** Fetch the full dependency graph for a repo. */
export async function getGraph(repoId: string): Promise<GraphData> {
  const { data } = await api.get<GraphData>(`/api/graph/${repoId}`)
  return data
}

// ── Impact ────────────────────────────────────────────────────────────────

/** Run impact analysis for a selected node. */
export async function getImpact(
  repoId: string,
  nodeId: string,
  changeDescription?: string,
): Promise<ImpactResult> {
  const { data } = await api.post<ImpactResult>(`/api/impact/${repoId}`, {
    node_id: nodeId,
    change_description: changeDescription ?? '',
  })
  return data
}

// ── AI Explanation ────────────────────────────────────────────────────────

/** Request an AI explanation for the impact of a selected node. */
export async function explainImpact(
  repoId: string,
  nodeId: string,
  changeDescription?: string,
): Promise<{ ai: AIExplanation } & Record<string, unknown>> {
  const { data } = await api.post(`/api/explain/${repoId}`, {
    node_id: nodeId,
    change_description: changeDescription ?? '',
  })
  return data
}

// ── Git Diff Impact ───────────────────────────────────────────────────────

/** Run blast radius analysis for a Git diff. */
export async function getDiffImpact(
  repoId: string,
  diff: string,
  changeDescription?: string,
): Promise<DiffImpactResult> {
  const { data } = await api.post<DiffImpactResult>(`/api/impact/diff/${repoId}`, {
    diff,
    change_description: changeDescription ?? '',
  })
  return data
}

/** Request AI explanation and migration plan for a Git diff. */
export async function explainDiffImpact(
  repoId: string,
  diff: string,
  changeDescription?: string,
): Promise<DiffImpactResult> {
  const { data } = await api.post<DiffImpactResult>(`/api/explain/diff/${repoId}`, {
    diff,
    change_description: changeDescription ?? '',
  })
  return data
}
