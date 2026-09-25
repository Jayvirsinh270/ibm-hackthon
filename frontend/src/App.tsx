import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import UploadPage from './pages/UploadPage'
import GraphPage from './pages/GraphPage'

const queryClient = new QueryClient()

type Page = 'upload' | 'graph'

function App() {
  const [page, setPage] = useState<Page>('upload')
  const [repoId, setRepoId] = useState<string | null>(null)

  const handleRepoReady = (id: string) => {
    setRepoId(id)
    setPage('graph')
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <header className="border-b border-gray-800 px-6 py-3 flex items-center gap-3">
          <span className="text-lg font-semibold tracking-tight text-white">⬡ X-Ray</span>
          <span className="text-xs text-gray-500 hidden sm:block">
            Intelligent Change Impact Analyzer
          </span>
          {repoId && page === 'graph' && (
            <button
              className="ml-auto text-xs text-gray-400 hover:text-white"
              onClick={() => { setPage('upload'); setRepoId(null) }}
            >
              ← Upload another
            </button>
          )}
        </header>
        <main>
          {page === 'upload' && <UploadPage onRepoReady={handleRepoReady} />}
          {page === 'graph' && repoId && <GraphPage repoId={repoId} />}
        </main>
      </div>
    </QueryClientProvider>
  )
}

export default App
