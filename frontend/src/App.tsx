import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, Component } from 'react'
import type { ReactNode } from 'react'
import UploadPage from './pages/UploadPage'
import GraphPage from './pages/GraphPage'

const queryClient = new QueryClient()

type Page = 'upload' | 'graph'

// ── Error boundary — catches render crashes and shows a recovery UI ────────
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#0a0c10] flex flex-col items-center justify-center gap-4 px-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <svg viewBox="0 0 16 16" fill="none" className="w-5 h-5 text-red-400">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="text-center max-w-md">
            <p className="text-gray-200 font-semibold text-sm mb-1">Something went wrong</p>
            <p className="text-gray-500 text-xs mb-4 font-mono break-all">{this.state.error.message}</p>
            <button
              onClick={() => { this.setState({ error: null }); window.location.reload() }}
              className="text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-md transition-colors"
            >
              Reload page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function App() {
  const [page, setPage] = useState<Page>('upload')
  const [repoId, setRepoId] = useState<string | null>(null)

  const handleRepoReady = (id: string) => {
    setRepoId(id)
    setPage('graph')
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
      <div className="min-h-screen bg-[#0a0c10] text-gray-100">

        {/* ── Top navigation bar ───────────────────────────────────────── */}
        <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0d1017]/90 backdrop-blur-md px-5 py-0 flex items-center h-14">
          {/* Brand */}
          <div className="flex items-center gap-2.5 select-none">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-900/40 flex-shrink-0">
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                <circle cx="8" cy="8" r="2.5" fill="white" />
                <circle cx="2.5" cy="4" r="1.5" fill="white" fillOpacity="0.6" />
                <circle cx="13.5" cy="4" r="1.5" fill="white" fillOpacity="0.6" />
                <circle cx="2.5" cy="12" r="1.5" fill="white" fillOpacity="0.6" />
                <circle cx="13.5" cy="12" r="1.5" fill="white" fillOpacity="0.6" />
                <line x1="8" y1="8" x2="2.5" y2="4" stroke="white" strokeOpacity="0.4" strokeWidth="0.8" />
                <line x1="8" y1="8" x2="13.5" y2="4" stroke="white" strokeOpacity="0.4" strokeWidth="0.8" />
                <line x1="8" y1="8" x2="2.5" y2="12" stroke="white" strokeOpacity="0.4" strokeWidth="0.8" />
                <line x1="8" y1="8" x2="13.5" y2="12" stroke="white" strokeOpacity="0.4" strokeWidth="0.8" />
              </svg>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-sm font-semibold tracking-tight text-white">X-Ray</span>
              <span className="text-[10px] text-gray-500 hidden sm:block leading-none mt-0.5">Change Impact Analyzer</span>
            </div>
          </div>

          {/* Center breadcrumb — only on graph page */}
          {page === 'graph' && (
            <div className="hidden md:flex items-center gap-2 ml-6 text-xs text-gray-500">
              <span className="text-gray-600">Repository</span>
              <span className="text-gray-700">/</span>
              <span className="text-gray-300 font-medium">Dependency Graph</span>
            </div>
          )}

          {/* Right actions */}
          <div className="ml-auto flex items-center gap-3">
            {repoId && page === 'graph' && (
              <button
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] px-3 py-1.5 rounded-md transition-all duration-150"
                onClick={() => { setPage('upload'); setRepoId(null) }}
              >
                <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                New Repository
              </button>
            )}
          </div>
        </header>

        <main>
          {page === 'upload' && <UploadPage onRepoReady={handleRepoReady} />}
          {page === 'graph' && repoId && <GraphPage repoId={repoId} />}
        </main>
      </div>
      </ErrorBoundary>
    </QueryClientProvider>
  )
}

export default App
