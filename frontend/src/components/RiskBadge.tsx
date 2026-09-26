// frontend/src/components/RiskBadge.tsx
// Visual risk level badge — HIGH / MEDIUM / LOW

import type { RiskLevel } from '../types'

interface Props {
  level: RiskLevel
  score?: number
}

const STYLES: Record<RiskLevel, string> = {
  HIGH:   'bg-red-900/40 text-red-300 border-red-700',
  MEDIUM: 'bg-yellow-900/40 text-yellow-300 border-yellow-700',
  LOW:    'bg-green-900/40 text-green-300 border-green-700',
}

const ICONS: Record<RiskLevel, string> = {
  HIGH: '🔴', MEDIUM: '🟡', LOW: '🟢',
}

export default function RiskBadge({ level, score }: Props) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${STYLES[level]}`}>
      {ICONS[level]} {level}
      {score !== undefined && (
        <span className="opacity-60">({(score * 100).toFixed(0)}%)</span>
      )}
    </span>
  )
}
