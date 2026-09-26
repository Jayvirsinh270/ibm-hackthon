// frontend/src/pages/UploadPage.tsx
// Multi-modal repository importer: GitHub Clone, 1-Click Demo Showcase, and ZIP Upload.

import { useState } from 'react'
import UploadZone from '../components/UploadZone'
import FileTree from '../components/FileTree'
import {
  uploadRepository,
  getStructure,
  deleteRepository,
  scanRepository,
  cloneRepository,
  loadDemoRepository,
} from '../api/client'

interface Props {
  onRepoReady: (repoId: string) => void
}

type Tab = 'github' | 'demo' | 'upload'
type Stage = 'idle' | 'loading' | 'preview' | 'error'

interface RepoPreview {
  repo_id: string
  name: string
  file_count: number
  tree: Record<string, unknown>
  source_url?: string
}

const QUICK_GITHUB_REPOS = [
  { label: 'pallets/flask', url: 'https://github.com/pallets/flask', desc: 'Lightweight WSGI web application framework' },
  { label: 'psf/requests', url: 'https://github.com/psf/requests', desc: 'Elegant and simple Python HTTP library' },
  { label: 'bottlepy/bottle', url: 'https://github.com/bottlepy/bottle', desc: 'Fast, simple micro web-framework' },
]

const DEMO_SCENARIOS = [
  {
    id: 'auth_service',
    title: 'Auth & RBAC Microservice',
    tag: 'Recommended',
    desc: 'JWT token issuance, password hashing, user entities, and high-churn token verification contract.',
    stats: '8 files · 5 Git commits · Hotspot detected',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="w-5 h-5 text-cyan-400">
        <path d="M8 1L2 3.5V7c0 4 2.5 7.5 6 8.5 3.5-1 6-4.5 6-8.5V3.5L8 1z" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.1"/>
        <path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'ecommerce',
    title: 'E-Commerce Checkout Core',
    tag: 'Microservice',
    desc: 'Order orchestration, payment gateway integrations, and discount calculation cascades.',
    stats: 'Multi-module · Call cascades · Unit tests',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="w-5 h-5 text-emerald-400">
        <path d="M2 3h2l2 8h7l1.5-6H4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="6.5" cy="13.5" r="1" fill="currentColor"/>
        <circle cx="12.5" cy="13.5" r="1" fill="currentColor"/>
      </svg>
    ),
  },
]

export default function UploadPage({ onRepoReady }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('github')
  const [stage, setStage] = useState<Stage>('idle')
  const [preview, setPreview] = useState<RepoPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingMsg, setLoadingMsg] = useState('')

  // GitHub clone form state
  const [gitUrl, setGitUrl] = useState('')
  const [gitBranch, setGitBranch] = useState('')
  const [gitToken, setGitToken] = useState('')
  const [showAdvancedGit, setShowAdvancedGit] = useState(false)

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleFinishImport = async (repoId: string, name: string, fileCount: number, sourceUrl?: string) => {
    setLoadingMsg('Scanning dependencies & Git churn…')
    scanRepository(repoId).catch(() => {})
    const structure = await getStructure(repoId)

    setPreview({
      repo_id: repoId,
      name,
      file_count: fileCount,
      tree: structure.tree,
      source_url: sourceUrl,
    })
    setStage('preview')
  }

  const handleFile = async (file: File) => {
    setStage('loading')
    setLoadingMsg('Extracting ZIP archive & indexing Python files…')
    setError(null)

    try {
      const uploaded = await uploadRepository(file)
      await handleFinishImport(uploaded.repo_id, uploaded.name, uploaded.file_count)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      setError(msg)
      setStage('error')
    }
  }

  const handleCloneSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!gitUrl.trim()) return

    setStage('loading')
    setLoadingMsg(`Cloning repository from ${gitUrl.trim()}…`)
    setError(null)

    try {
      const cloned = await cloneRepository(
        gitUrl.trim(),
        gitBranch.trim() || undefined,
        gitToken.trim() || undefined,
        50,
      )
      await handleFinishImport(cloned.repo_id, cloned.name, cloned.file_count, cloned.source_url)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } }; message?: string }
      const msg = axiosErr.response?.data?.detail || axiosErr.message || 'Git clone failed'
      setError(msg)
      setStage('error')
    }
  }

  const handleLoadDemo = async (scenario: string) => {
    setStage('loading')
    setLoadingMsg('Provisioning interactive demo repository with Git history…')
    setError(null)

    try {
      const demo = await loadDemoRepository(scenario)
      await handleFinishImport(demo.repo_id, demo.name, demo.file_count, demo.source_url)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } }; message?: string }
      const msg = axiosErr.response?.data?.detail || axiosErr.message || 'Demo provisioning failed'
      setError(msg)
      setStage('error')
    }
  }

  const handleDelete = async () => {
    if (!preview) return
    try {
      await deleteRepository(preview.repo_id)
    } catch {
      // ignore
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
      <div className="w-full max-w-2xl mb-8 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1 mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs text-cyan-300 font-medium tracking-wide">
            Intelligent Software Change Impact Analyzer
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight">
          Analyze Software Blast Radius
        </h1>
        <p className="text-gray-400 text-sm leading-relaxed max-w-lg mx-auto">
          Map Python AST dependencies, compute Git churn hotspots, and simulate change propagation with Watsonx AI.
        </p>
      </div>

      {/* ── Main card ─────────────────────────────────────────────────── */}
      <div className="w-full max-w-2xl">

        {/* Tab Selector (only in non-preview state) */}
        {stage !== 'preview' && (
          <div className="flex items-center p-1 bg-white/[0.04] border border-white/[0.08] rounded-xl mb-4">
            <button
              onClick={() => { setActiveTab('github'); setError(null) }}
              className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                activeTab === 'github'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
              </svg>
              <span>GitHub URL</span>
            </button>

            <button
              onClick={() => { setActiveTab('demo'); setError(null) }}
              className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                activeTab === 'demo'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
                <path d="M8 2l1.5 4.5H14l-3.5 2.5 1.5 4.5L8 11l-4 2.5 1.5-4.5L2 6.5h4.5L8 2z" fill="currentColor"/>
              </svg>
              <span>1-Click Demos</span>
            </button>

            <button
              onClick={() => { setActiveTab('upload'); setError(null) }}
              className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                activeTab === 'upload'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
                <path d="M8 10V2M4 5l4-3 4 3M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Upload ZIP</span>
            </button>
          </div>
        )}

        {/* Tab 1: GitHub Clone */}
        {stage !== 'preview' && activeTab === 'github' && (
          <div className="bg-[#0d1017] border border-white/[0.08] rounded-2xl p-6 shadow-xl space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-white mb-1">Clone from Git Repository</h2>
              <p className="text-xs text-gray-400">
                Paste any public or private GitHub repository URL to clone and analyze.
              </p>
            </div>

            <form onSubmit={handleCloneSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                  Repository URL
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={gitUrl}
                    onChange={e => setGitUrl(e.target.value)}
                    placeholder="https://github.com/owner/repository"
                    required
                    className="w-full bg-white/[0.04] border border-white/[0.1] rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-gray-600 font-mono focus:outline-none focus:border-blue-500 focus:bg-white/[0.06] transition-colors"
                  />
                  {gitUrl && (
                    <button
                      type="button"
                      onClick={() => setGitUrl('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Quick preset chips */}
              <div>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1.5">
                  Try with popular open-source repositories:
                </span>
                <div className="flex flex-wrap gap-2">
                  {QUICK_GITHUB_REPOS.map(q => (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => setGitUrl(q.url)}
                      className="px-2.5 py-1 rounded-md bg-white/[0.03] hover:bg-cyan-500/10 border border-white/[0.06] hover:border-cyan-500/30 text-xs font-mono text-gray-300 hover:text-cyan-300 transition-colors"
                      title={q.desc}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Collapsible advanced options */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdvancedGit(prev => !prev)}
                  className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
                >
                  <span>{showAdvancedGit ? '▼' : '▶'}</span>
                  <span>Branch & Authentication Options</span>
                </button>

                {showAdvancedGit && (
                  <div className="grid grid-cols-2 gap-3 mt-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">
                        Branch or Tag
                      </label>
                      <input
                        type="text"
                        value={gitBranch}
                        onChange={e => setGitBranch(e.target.value)}
                        placeholder="e.g. main, master"
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2.5 py-1.5 text-xs text-gray-200 placeholder-gray-600 font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">
                        GitHub Token <span className="normal-case text-gray-600">(private repos)</span>
                      </label>
                      <input
                        type="password"
                        value={gitToken}
                        onChange={e => setGitToken(e.target.value)}
                        placeholder="ghp_xxxxxxxxxxxx"
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2.5 py-1.5 text-xs text-gray-200 placeholder-gray-600 font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={stage === 'loading' || !gitUrl.trim()}
                className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 disabled:cursor-wait text-white text-xs font-semibold tracking-wide transition-all shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2"
              >
                {stage === 'loading' ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Cloning & Scanning…</span>
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                      <path d="M4 12V4a1 1 0 011-1h6a1 1 0 011 1v8a1 1 0 01-1 1H5a1 1 0 01-1-1z" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M7 6l2 2-2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Clone & Analyze Repository</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Tab 2: 1-Click Demos */}
        {stage !== 'preview' && activeTab === 'demo' && (
          <div className="bg-[#0d1017] border border-white/[0.08] rounded-2xl p-6 shadow-xl space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-white mb-1">Instant Demo Showcase</h2>
              <p className="text-xs text-gray-400">
                Explore real AST dependency graphs, Git churn hotspots, and impact cascades in 1 click without any local setup.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {DEMO_SCENARIOS.map(demo => (
                <div
                  key={demo.id}
                  className="bg-white/[0.02] border border-white/[0.06] hover:border-cyan-500/30 hover:bg-white/[0.04] rounded-xl p-4 transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] group-hover:scale-105 transition-transform">
                        {demo.icon}
                      </div>
                      <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        {demo.tag}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-xs font-semibold text-gray-100">{demo.title}</h3>
                      <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                        {demo.desc}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                    <span className="text-[10px] text-gray-500 font-mono">{demo.stats}</span>
                    <button
                      onClick={() => handleLoadDemo(demo.id)}
                      disabled={stage === 'loading'}
                      className="px-3 py-1.5 rounded-md bg-cyan-600/20 hover:bg-cyan-600 border border-cyan-500/30 hover:border-cyan-500 text-cyan-300 hover:text-white text-xs font-medium transition-colors"
                    >
                      Launch Demo
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Upload ZIP */}
        {stage !== 'preview' && activeTab === 'upload' && (
          <UploadZone onFile={handleFile} disabled={stage === 'loading'} />
        )}

        {/* Loading state indicator */}
        {stage === 'loading' && (
          <div className="mt-6 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-300 font-medium">{loadingMsg || 'Processing repository…'}</p>
            <p className="text-xs text-gray-500">Parsing AST nodes, extracting imports, and indexing commit history</p>
          </div>
        )}

        {/* Error state alert */}
        {stage === 'error' && error && (
          <div className="mt-4 flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3.5 text-sm">
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-red-300 text-xs leading-relaxed font-mono">{error}</p>
              <button
                className="mt-2 text-xs text-red-400 hover:text-red-200 underline font-medium"
                onClick={() => setStage('idle')}
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Preview Screen */}
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
                Analysis builds a full import + call graph with Git churn
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
      {(stage === 'idle' || stage === 'loading') && (
        <div className="mt-10 grid grid-cols-3 gap-4 w-full max-w-2xl">
          {[
            { icon: '⬡', label: 'Dependency Graph', desc: 'Visual map of all imports, calls, and inheritance' },
            { icon: '⚡', label: 'Impact & Diff Analysis', desc: 'Trace how any code edit propagates through downstream systems' },
            { icon: '🤖', label: 'AI Migration Plans', desc: 'Watsonx-powered explanations and targeted test suites' },
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
