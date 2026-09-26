// frontend/src/components/RiskBadge.tsx

import type { RiskLevel } from '../types'

interface Props {
  level: RiskLevel
  score?: number
}

const CONFIG: Record<RiskLevel, { bg: string; border: string; text: string; dot: string; label: string }> = {
  HIGH:   { bg: 'bg-red-500/10',    border: 'border-red-500/25',    text: 'text-red-300',    dot: 'bg-red-400',    label: 'High Risk'   },
  MEDIUM: { bg: 'bg-amber-500/10',  border: 'border-amber-500/25',  text: 'text-amber-300',  dot: 'bg-amber-400',  label: 'Medium Risk' },
  LOW:    { bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', text: 'text-emerald-300', dot: 'bg-emerald-400', label: 'Low Risk'  },
}

export default function RiskBadge({ level, score }: Props) {
  const c = CONFIG[level] ?? CONFIG.LOW
  return (
    <span className={`inline-flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg border ${c.bg} ${c.border}`}>
      <span className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
        <span className={`text-xs font-semibold ${c.text}`}>{level}</span>
      </span>
      {score !== undefined && (
        <span className={`text-[10px] font-medium ${c.text} opacity-60 tabular-nums`}>
          {(score * 100).toFixed(0)}% risk
        </span>
      )}
    </span>
  )
}
