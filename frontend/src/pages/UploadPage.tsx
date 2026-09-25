// frontend/src/pages/UploadPage.tsx
// Phase 2 — Upload page with drag-and-drop, file tree preview, and delete

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
      // Kick off analysis pipeline immediately (runs in background)
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
    <div className="max-w-2xl mx-auto mt-12 px-6">
      <h1 className="text-2xl font-bold mb-1">Upload Repository</h1>
      <p className="text-gray-400 text-sm mb-8">
        Upload a .zip of a Python project to build its dependency graph.
      </p>

      {/* Upload zone — hidden while showing preview */}
      {stage !== 'preview' && (
        <UploadZone onFile={handleFile} disabled={stage === 'uploading'} />
      )}

      {/* Uploading spinner */}
      {stage === 'uploading' && (
        <p className="text-center text-gray-400 mt-4 animate-pulse">
          Extracting repository…
        </p>
      )}

      {/* Error */}
      {stage === 'error' && error && (
        <div className="mt-4 bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">
          {error}
          <button
            className="ml-4 underline text-red-400 hover:text-red-200"
            onClick={() => setStage('idle')}
          >
            Try again
          </button>
        </div>
      )}

      {/* Preview */}
      {stage === 'preview' && preview && (
        <div className="border border-gray-700 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700">
            <div>
              <span className="font-semibold text-white">{preview.name}</span>
              <span className="ml-3 text-xs text-gray-400">
                {preview.file_count} Python file{preview.file_count !== 1 ? 's' : ''}
              </span>
            </div>
            <button
              onClick={handleDelete}
              className="text-xs text-gray-500 hover:text-red-400"
            >
              🗑 Remove
            </button>
          </div>

          {/* File tree */}
          <div className="px-4 py-3 max-h-72 overflow-y-auto bg-gray-950">
            <FileTree tree={preview.tree} />
          </div>

          {/* Action */}
          <div className="px-4 py-3 bg-gray-900 border-t border-gray-700 flex justify-end">
            <button
              onClick={handleAnalyze}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
            >
              Analyze →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
