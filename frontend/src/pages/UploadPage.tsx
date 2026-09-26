// frontend/src/pages/UploadPage.tsx

import { useState } from 'react'
import UploadZone from '../components/UploadZone'
import FileTree from '../components/FileTree'
import { uploadRepository, getStructure, deleteRepository, scanRepository } from '../api/client'

interface Props {
  onRepoReady: (repoId: string) => void
}

type Stage = 'idle' | 'uploading' | 'preview' | 'error'

interface RepoPreview {
  repo_id: string
  name: string
  file_count: number
  tree: Record<string, unknown>
}

export default function UploadPage({ onRepoReady }: Props) {
  const [stage, setStage] = useState<Stage>('idle')
  const [preview, setPreview] = useState<RepoPreview | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    setStage('uploading')
    setError(null)

    try {
      const uploaded = await uploadRepository(file)
      scanRepository(uploaded.repo_id).catch(() => { /* status polled separately */ })
      const structure = await getStructure(uploaded.repo_id)

      setPreview({
        repo_id: uploaded.repo_id,
        name: uploaded.name,
        file_count: uploaded.file_count,
        tree: structure.tree,
      })
      setStage('preview')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      setError(msg)
      setStage('error')
    }
  }

  const handleDelete = async () => {
    if (!preview) return
    try {
      await deleteRepository(preview.repo_id)
    } catch {
      // ignore — we'll clear the UI anyway
    }
    setPreview(null)
    setStage('idle')
  }

  const handleAnalyze = () => {
    if (preview) onRepoReady(preview.repo_id)
  }

  return (
    <div className="min-h-[calc(100vh-56px)] flex flex-col items-center justify-center px-4 py-12">

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div className="w-full max-w-xl mb-8 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1 mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-xs text-blue-400 font-medium">Intelligent Dependency Analysis</span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
          Analyze Your Repository
        </h1>
        <p className="text-gray-400 text-sm leading-relaxed max-w-md mx-auto">
          Upload a Python project as a <code className="text-gray-300 bg-white/[0.07] px-1.5 py-0.5 rounded text-xs">.zip</code> archive to build an interactive dependency graph and analyze change impact.
        </p>
      </div>

      {/* ── Main card ─────────────────────────────────────────────────── */}
      <div className="w-full max-w-xl">

        {/* Upload zone — hidden during preview */}
        {stage !== 'preview' && (
          <UploadZone onFile={handleFile} disabled={stage === 'uploading'} />
        )}

        {/* Uploading state */}
        {stage === 'uploading' && (
          <div className="mt-6 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-300 font-medium">Extracting repository…</p>
            <p className="text-xs text-gray-500">Parsing Python files and building the dependency graph</p>
          </div>
        )}

        {/* Error state */}
        {stage === 'error' && error && (
          <div className="mt-4 flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3.5 text-sm">
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-red-300">{error}</p>
              <button
                className="mt-1.5 text-xs text-red-400 hover:text-red-200 underline"
                onClick={() => setStage('idle')}
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Preview */}
        {stage === 'preview' && preview && (
          <div className="border border-white/[0.08] rounded-2xl overflow-hidden bg-[#0d1017] shadow-2xl shadow-black/40">

            {/* Repo header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-600/30 to-blue-600/30 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-violet-400">
                    <path d="M2 12V4a1 1 0 011-1h7l3 3v6a1 1 0 01-1 1H3a1 1 0 01-1-1z" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M9 3v3h3" stroke="currentColor" strokeWidth="1.2"/>
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-white text-sm truncate">{preview.name}</p>
                  <p className="text-xs text-gray-500">
                    {preview.file_count} Python file{preview.file_count !== 1 ? 's' : ''} detected
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Ready
                </span>
                <button
                  onClick={handleDelete}
                  className="text-xs text-gray-500 hover:text-red-400 transition-colors flex items-center gap-1"
                  title="Remove repository"
                >
                  <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
                    <path d="M3 4h10M6 4V3h4v1M5 4v8a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                  Remove
                </button>
              </div>
            </div>

            {/* File tree */}
            <div className="px-5 py-4 max-h-64 overflow-y-auto xray-scrollbar">
              <FileTree tree={preview.tree} />
            </div>

            {/* Footer / action */}
            <div className="px-5 py-4 border-t border-white/[0.06] flex items-center justify-between">
              <p className="text-xs text-gray-600">
                Analysis builds a full import + call graph
              </p>
              <button
                onClick={handleAnalyze}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors shadow-lg shadow-blue-900/30"
              >
                Build Graph
                <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Feature callouts ──────────────────────────────────────────── */}
      {(stage === 'idle' || stage === 'uploading') && (
        <div className="mt-10 grid grid-cols-3 gap-4 w-full max-w-xl">
          {[
            { icon: '⬡', label: 'Dependency Graph', desc: 'Visual map of all imports, calls, and inheritance' },
            { icon: '⚡', label: 'Impact Analysis', desc: 'Trace how a change propagates through your codebase' },
            { icon: '🤖', label: 'AI Insights', desc: 'Watsonx-powered explanations and migration plans' },
          ].map(f => (
            <div key={f.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-4 text-center">
              <div className="text-xl mb-2">{f.icon}</div>
              <p className="text-xs font-semibold text-gray-300 mb-1">{f.label}</p>
              <p className="text-[11px] text-gray-600 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
