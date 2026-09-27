// frontend/src/api/client.ts
// Axios API client with typed endpoints and automatic Vercel standalone fallback.
// Base URL is read from the VITE_API_BASE_URL env variable.

import axios from 'axios'
import type {
  HealthResponse,
  ImpactResult,
  AIExplanation,
  GraphData,
  DiffImpactResult,
  SourceCodeResponse,
  DiffInspectResponse,
  CloneResponse,
  NodeSummaryResponse,
  GeneratedTestSuite,
} from '../types'
import {
  FALLBACK_REPO_ID,
  getFallbackDemoRepo,
  getFallbackGraph,
  getFallbackImpact,
  getFallbackDiffImpact,
  getFallbackNodeSummary,
  getFallbackSourceCode,
  getFallbackGeneratedTest,
} from './demoFallback'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
})

// ── Health ────────────────────────────────────────────────────────────────

export async function checkHealth(): Promise<HealthResponse> {
  try {
    const { data } = await api.get<HealthResponse>('/api/health')
    return data
  } catch {
    return { status: 'ok', service: 'xray-client-standalone' }
  }
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
  if (repoId === FALLBACK_REPO_ID) {
    return {
      repo_id: repoId,
      files: [
        'src/api/routes.py',
        'src/auth/service.py',
        'src/auth/jwt.py',
        'src/models/user.py',
        'src/database/session.py',
        'src/payments/webhook.py',
        'tests/test_auth.py',
      ],
      tree: {
        src: {
          api: { 'routes.py': null },
          auth: { 'service.py': null, 'jwt.py': null },
          models: { 'user.py': null },
          database: { 'session.py': null },
          payments: { 'webhook.py': null },
        },
        tests: { 'test_auth.py': null },
      },
    }
  }

  try {
    const { data } = await api.get(`/api/structure/${repoId}`)
    return data
  } catch {
    return {
      repo_id: repoId,
      files: ['src/api/routes.py', 'src/auth/service.py', 'src/auth/jwt.py', 'src/models/user.py'],
      tree: {},
    }
  }
}

/** Delete a repository. */
export async function deleteRepository(repoId: string): Promise<void> {
  try {
    await api.delete(`/api/repos/${repoId}`)
  } catch {
    // Ignore error in standalone demo mode
  }
}

// ── Graph ─────────────────────────────────────────────────────────────────

/** Trigger analysis pipeline for a repo (returns immediately, runs in background). */
export async function scanRepository(repoId: string): Promise<{ repo_id: string; status: string; message: string }> {
  if (repoId === FALLBACK_REPO_ID) {
    return { repo_id: repoId, status: 'ready', message: 'Demo Ready' }
  }
  try {
    const { data } = await api.post(`/api/scan/${repoId}`)
    return data
  } catch {
    return { repo_id: repoId, status: 'ready', message: 'Demo Ready' }
  }
}

/** Poll scan status. */
export async function getScanStatus(repoId: string): Promise<{ repo_id: string; status: string; error_message?: string; scan_stage?: string }> {
  if (repoId === FALLBACK_REPO_ID) {
    return { repo_id: repoId, status: 'ready', scan_stage: 'Ready' }
  }
  try {
    const { data } = await api.get(`/api/status/${repoId}`)
    return data
  } catch {
    return { repo_id: repoId, status: 'ready', scan_stage: 'Ready' }
  }
}

/** Fetch the full dependency graph for a repo. */
export async function getGraph(repoId: string): Promise<GraphData> {
  if (repoId === FALLBACK_REPO_ID) {
    return getFallbackGraph()
  }
  try {
    const { data } = await api.get<GraphData>(`/api/graph/${repoId}`)
    return data
  } catch {
    console.warn('[X-Ray] Graph fetch fell back to demo dataset.')
    return getFallbackGraph()
  }
}

// ── Impact ────────────────────────────────────────────────────────────────

/** Run impact analysis for a selected node. */
export async function getImpact(
  repoId: string,
  nodeId: string,
  changeDescription?: string,
): Promise<ImpactResult> {
  if (repoId === FALLBACK_REPO_ID) {
    return getFallbackImpact(nodeId)
  }
  try {
    const { data } = await api.post<ImpactResult>(`/api/impact/${repoId}`, {
      node_id: nodeId,
      change_description: changeDescription ?? '',
    })
    return data
  } catch {
    return getFallbackImpact(nodeId)
  }
}

// ── AI Explanation ────────────────────────────────────────────────────────

/** Request an AI explanation for the impact of a selected node. */
export async function explainImpact(
  repoId: string,
  nodeId: string,
  changeDescription?: string,
): Promise<{ ai: AIExplanation } & Record<string, unknown>> {
  if (repoId === FALLBACK_REPO_ID) {
    const diffRes = getFallbackDiffImpact('')
    return { ai: diffRes.ai! }
  }
  try {
    const { data } = await api.post(`/api/explain/${repoId}`, {
      node_id: nodeId,
      change_description: changeDescription ?? '',
    })
    return data
  } catch {
    const diffRes = getFallbackDiffImpact('')
    return { ai: diffRes.ai! }
  }
}

/** Request an AI purpose summary for a selected function or node. */
export async function explainNode(
  repoId: string,
  nodeId: string,
): Promise<NodeSummaryResponse> {
  if (repoId === FALLBACK_REPO_ID) {
    return getFallbackNodeSummary(nodeId)
  }
  try {
    const { data } = await api.post<NodeSummaryResponse>(`/api/explain/node/${repoId}`, {
      node_id: nodeId,
    })
    return data
  } catch {
    return getFallbackNodeSummary(nodeId)
  }
}

// ── Git Diff Impact ───────────────────────────────────────────────────────

/** Run blast radius analysis for a Git diff. */
export async function getDiffImpact(
  repoId: string,
  diff: string,
  changeDescription?: string,
): Promise<DiffImpactResult> {
  if (repoId === FALLBACK_REPO_ID) {
    return getFallbackDiffImpact(diff)
  }
  try {
    const { data } = await api.post<DiffImpactResult>(`/api/impact/diff/${repoId}`, {
      diff,
      change_description: changeDescription ?? '',
    })
    return data
  } catch {
    return getFallbackDiffImpact(diff)
  }
}

/** Request AI explanation and migration plan for a Git diff. */
export async function explainDiffImpact(
  repoId: string,
  diff: string,
  changeDescription?: string,
): Promise<DiffImpactResult> {
  if (repoId === FALLBACK_REPO_ID) {
    return getFallbackDiffImpact(diff)
  }
  try {
    const { data } = await api.post<DiffImpactResult>(`/api/explain/diff/${repoId}`, {
      diff,
      change_description: changeDescription ?? '',
    })
    return data
  } catch {
    return getFallbackDiffImpact(diff)
  }
}

// ── Source Code & Diff Inspector ──────────────────────────────────────────

/** Fetch repository source code for in-app code viewing. */
export async function getSourceCode(
  repoId: string,
  filePath: string,
  targetLine?: number,
  startLine?: number,
  endLine?: number,
): Promise<SourceCodeResponse> {
  if (repoId === FALLBACK_REPO_ID) {
    return getFallbackSourceCode(filePath)
  }
  try {
    const params: Record<string, string | number> = { file_path: filePath }
    if (targetLine !== undefined && targetLine !== null) params.target_line = targetLine
    if (startLine !== undefined && startLine !== null) params.start_line = startLine
    if (endLine !== undefined && endLine !== null) params.end_line = endLine

    const { data } = await api.get<SourceCodeResponse>(`/api/source/${repoId}`, { params })
    return data
  } catch {
    return getFallbackSourceCode(filePath)
  }
}

/** Parse and inspect raw unified diff files and hunks. */
export async function inspectDiff(
  repoId: string,
  diff: string,
): Promise<DiffInspectResponse> {
  try {
    const { data } = await api.post<DiffInspectResponse>(`/api/source/diff/${repoId}`, { diff })
    return data
  } catch {
    return {
      repo_id: repoId,
      files: [
        {
          file_path: 'src/auth/service.py',
          change_type: 'modified',
          changed_lines: [32, 33, 34],
          raw_hunks: [
            '@@ -32,3 +32,3 @@\n-    def verify_token(self, token: str) -> bool:\n+    def verify_token_v2(self, token: str) -> bool:\n         return len(token) > 10',
          ],
        },
      ],
    }
  }
}

// ── Git Clone & Demo Repositories ─────────────────────────────────────────

/** Clone a remote Git repository by URL. */
export async function cloneRepository(
  url: string,
  branch?: string,
  token?: string,
  depth: number = 50,
): Promise<CloneResponse> {
  const { data } = await api.post<CloneResponse>('/api/clone', {
    url,
    branch: branch || undefined,
    token: token || undefined,
    depth,
  })
  return data
}

/** Provision an instant interactive demo repository. */
export async function loadDemoRepository(scenario: string = 'auth_service'): Promise<CloneResponse> {
  try {
    const { data } = await api.post<CloneResponse>('/api/demo', { scenario })
    return data
  } catch (err) {
    console.warn('[X-Ray] Live backend unreachable; switching to instant demo mode on Vercel.', err)
    return getFallbackDemoRepo()
  }
}

// ── AI Test Suite Generator (IBM Bob 2.0 / Watsonx Granite) ───────────────

/** Generate a complete pytest test file for an untested or critical component. */
export async function generateTest(
  repoId: string,
  nodeId: string,
  framework: string = 'pytest',
): Promise<GeneratedTestSuite> {
  if (repoId === FALLBACK_REPO_ID) {
    return getFallbackGeneratedTest(nodeId)
  }
  try {
    const { data } = await api.post<GeneratedTestSuite>(`/api/generate-test/${repoId}`, {
      node_id: nodeId,
      framework,
    })
    return data
  } catch {
    return getFallbackGeneratedTest(nodeId)
  }
}
