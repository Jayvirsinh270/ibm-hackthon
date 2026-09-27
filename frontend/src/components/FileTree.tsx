// frontend/src/components/FileTree.tsx
// Rich, collapsible hierarchical file tree with badges and file-type icons.

import { useState } from 'react'

interface Props {
  tree: Record<string, unknown>
  depth?: number
}

function countTotalFiles(node: unknown): number {
  if (node === null) return 1
  if (typeof node === 'object' && node !== null) {
    return Object.values(node as Record<string, unknown>).reduce<number>(
      (acc, child) => acc + countTotalFiles(child),
      0
    )
  }
  return 0
}

function getFileIcon(name: string) {
  const isTest = name.endsWith('_test.py') || name.startsWith('test_') || name.includes('.test.') || name.includes('.spec.')
  if (isTest) {
    return (
      <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400">
        <path d="M9 2L5 8h3l-1 6 5-7H9l1-5z" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.2"/>
      </svg>
    )
  }

  if (name.endsWith('.py')) {
    return (
      <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 flex-shrink-0 text-cyan-400">
        <path d="M7 2h2a2 2 0 012 2v2H6V5a1 1 0 011-1h0zm2 12H7a2 2 0 01-2-2v-2h5v1a1 1 0 01-1 1h0z" stroke="currentColor" strokeWidth="1.2"/>
        <circle cx="8" cy="3.5" r="0.5" fill="currentColor"/>
        <circle cx="8" cy="12.5" r="0.5" fill="currentColor"/>
      </svg>
    )
  }

  if (name.endsWith('.js') || name.endsWith('.ts') || name.endsWith('.jsx') || name.endsWith('.tsx')) {
    return (
      <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 flex-shrink-0 text-yellow-400">
        <path d="M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M6 11V7m4 4V7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    )
  }

  if (name.endsWith('.html')) {
    return (
      <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 flex-shrink-0 text-orange-400">
        <path d="M2.5 2.5l1.5 11 4 1.5 4-1.5 1.5-11H2.5z" stroke="currentColor" strokeWidth="1.2"/>
      </svg>
    )
  }

  if (name.endsWith('.css')) {
    return (
      <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 flex-shrink-0 text-blue-400">
        <path d="M3 2h10l-1 11-4 1.5L4 13 3 2z" stroke="currentColor" strokeWidth="1.2"/>
      </svg>
    )
  }

  if (name.endsWith('.dart')) {
    return (
      <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 flex-shrink-0 text-teal-400">
        <path d="M2 8l6-6 6 6-6 6-6-6z" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.2"/>
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 flex-shrink-0 text-gray-500">
      <path d="M3 13V3a1 1 0 011-1h5l4 4v7a1 1 0 01-1 1H4a1 1 0 01-1-1z" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M9 2v4h4" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  )
}

export default function FileTree({ tree, depth = 0 }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const toggle = (name: string) => {
    setCollapsed(prev => ({ ...prev, [name]: !prev[name] }))
  }

  const indent = depth * 14

  return (
    <ul className="text-xs font-mono space-y-0.5">
      {Object.entries(tree).map(([name, children]) => {
        const isDir = children !== null && typeof children === 'object'
        const isCollapsed = Boolean(collapsed[name])
        const fileCount = isDir ? countTotalFiles(children) : 0

        return (
          <li key={name} style={{ paddingLeft: indent }}>
            {isDir ? (
              <div>
                <div
                  onClick={() => toggle(name)}
                  className="flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-white/[0.04] text-amber-300/90 cursor-pointer select-none transition-colors group"
                >
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    className={`w-3 h-3 text-gray-500 group-hover:text-gray-300 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                  >
                    <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 flex-shrink-0 text-amber-400">
                    <path d="M1.5 4.5A1 1 0 012.5 3.5H6l1.5 1.5H13.5a1 1 0 011 1V12a1 1 0 01-1 1H2.5a1 1 0 01-1-1V4.5z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.2"/>
                  </svg>
                  <span className="font-semibold text-gray-200">{name}/</span>
                  <span className="text-[10px] text-gray-500 ml-auto bg-white/[0.04] px-1.5 py-0.5 rounded font-mono">
                    {fileCount} {fileCount === 1 ? 'file' : 'files'}
                  </span>
                </div>
                {!isCollapsed && (
                  <FileTree tree={children as Record<string, unknown>} depth={depth + 1} />
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 py-0.5 px-1.5 rounded hover:bg-white/[0.02] text-gray-300">
                {getFileIcon(name)}
                <span className="truncate">{name}</span>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
