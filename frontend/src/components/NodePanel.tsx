// frontend/src/components/NodePanel.tsx
// Sidebar showing selected node details + trigger impact analysis + AI panel

import ImpactPanel from './ImpactPanel'
import AIPanel from './AIPanel'
import type { GraphNode, ImpactResult, AIExplanation } from '../types'

interface Props {
  node: GraphNode
  repoId: string
  impactResult: ImpactResult | null
  impactLoading: boolean
  impactError: string | null
  onAnalyze: (nodeId: string, description: string) => void
  aiExplanation?: AIExplanation | null
  aiLoading?: boolean
  onAiRequest?: () => void
}

const TYPE_ICON: Record<string, string> = {
  file: '📄', class: '🔷', function: '⚡', test: '🧪',
}

export default function NodePanel({
  node,
  repoId: _repoId,
  impactResult,
  impactLoading,
  impactError,
  onAnalyze,
  aiExplanation,
  aiLoading,
  onAiRequest,
}: Props) {
  return (
    <div className="flex flex-col gap-4">

      {/* Node identity */}
      <div className="border border-gray-700 rounded-xl p-4 bg-gray-900">
        <div className="flex items-start gap-2 mb-3">
          <span className="text-xl mt-0.5">{TYPE_ICON[node.type] ?? '📄'}</span>
          <div className="min-w-0">
            <p className="font-semibold text-white truncate">{node.label}</p>
            <p className="text-xs text-gray-500 truncate">{node.module_name}</p>
            <p className="text-xs text-gray-600 mt-0.5 capitalize">{node.type}</p>
          </div>
        </div>
        {node.git_churn > 0 && (
          <p className="text-xs text-gray-500">
            🔄 {node.git_churn} git commit{node.git_churn !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Analyse Impact button */}
      <button
        onClick={() => onAnalyze(node.id, '')}
        disabled={impactLoading}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-wait
                   text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        {impactLoading ? 'Analysing…' : '⚡ Analyse Impact'}
      </button>

      {/* Impact error */}
      {impactError && (
        <p className="text-xs text-red-400 bg-red-900/20 rounded-lg px-3 py-2">{impactError}</p>
      )}

      {/* Impact results */}
      {(impactResult || impactLoading) && (
        <div className="border border-gray-700 rounded-xl p-4 bg-gray-900">
          <ImpactPanel result={impactResult!} loading={impactLoading} />
        </div>
      )}

      {/* AI panel — shown once impact result exists */}
      {impactResult && (
        <AIPanel
          explanation={aiExplanation}
          loading={aiLoading}
          onRequest={onAiRequest}
        />
      )}

    </div>
  )
}
