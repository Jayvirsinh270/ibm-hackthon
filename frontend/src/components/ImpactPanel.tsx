// frontend/src/components/ImpactPanel.tsx
// Shows impact analysis results: affected components, tests, risk

import RiskBadge from './RiskBadge'
import type { ImpactResult, RiskLevel } from '../types'

interface Props {
  result: ImpactResult
  loading?: boolean
}

function NodeList({ nodes, label }: { nodes: Array<Record<string, unknown>>, label: string }) {
  if (nodes.length === 0) return null
  return (
    <div className="mb-4">
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        {label} <span className="text-gray-600">({nodes.length})</span>
      </h4>
      <ul className="space-y-1">
        {nodes.map((n) => (
          <li key={n.id as string} className="flex items-center gap-2 text-sm text-gray-300">
            <span className="text-gray-600 text-xs">
              {n.type === 'function' ? '⚡' : n.type === 'class' ? '🔷' : n.type === 'test' ? '🧪' : '📄'}
            </span>
            <span className="font-mono">{n.label as string}</span>
            <span className="text-gray-600 text-xs truncate">{(n.module_name as string)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function ImpactPanel({ result, loading }: Props) {
  if (loading) {
    return (
      <div className="animate-pulse text-gray-500 text-sm p-4">
        Analysing impact…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Selected</p>
          <p className="font-semibold text-white font-mono">{result.selected_node_label}</p>
          <p className="text-xs text-gray-500">{result.selected_node_type}</p>
        </div>
        <RiskBadge level={result.risk_level as RiskLevel} score={result.risk_score} />
      </div>

      {/* Contributing factors */}
      {result.contributing_factors && result.contributing_factors.length > 0 && (
        <div className="bg-gray-900 rounded-lg p-3 text-xs text-gray-400 space-y-1">
          {result.contributing_factors.map((f, i) => (
            <p key={i}>• {f}</p>
          ))}
        </div>
      )}

      {/* Node lists */}
      <NodeList nodes={result.direct_affected}     label="Directly Affected" />
      <NodeList nodes={result.transitive_affected} label="Transitively Affected" />
      <NodeList nodes={result.related_tests}       label="Related Tests" />

      {result.direct_affected.length === 0 &&
       result.transitive_affected.length === 0 &&
       result.related_tests.length === 0 && (
        <p className="text-gray-600 text-sm">No affected components found.</p>
      )}

      <p className="text-xs text-gray-700 pt-2 border-t border-gray-800">
        🔬 Deterministic analysis · depth {result.max_depth} hops
      </p>
    </div>
  )
}
