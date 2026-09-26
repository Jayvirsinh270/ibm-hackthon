// frontend/src/components/FileTree.tsx

interface Props {
  tree: Record<string, unknown>
  depth?: number
}

export default function FileTree({ tree, depth = 0 }: Props) {
  const indent = depth * 14

  return (
    <ul className="text-xs font-mono space-y-0.5">
      {Object.entries(tree).map(([name, children]) => {
        const isDir = children !== null && typeof children === 'object'
        const isTest = name.endsWith('_test.py') || name.startsWith('test_')
        return (
          <li key={name} style={{ paddingLeft: indent }}>
            {isDir ? (
              <>
                <div className="flex items-center gap-1.5 py-0.5 text-amber-400/80">
                  <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 flex-shrink-0">
                    <path d="M1.5 4.5A1 1 0 012.5 3.5H6l1.5 1.5H13.5a1 1 0 011 1V12a1 1 0 01-1 1H2.5a1 1 0 01-1-1V4.5z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1"/>
                  </svg>
                  <span>{name}/</span>
                </div>
                <FileTree tree={children as Record<string, unknown>} depth={depth + 1} />
              </>
            ) : (
              <div className={[
                'flex items-center gap-1.5 py-0.5',
                isTest ? 'text-emerald-400/70' : 'text-gray-400',
              ].join(' ')}>
                {isTest ? (
                  <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 flex-shrink-0 text-emerald-500">
                    <path d="M9 2L5 8h3l-1 6 5-7H9l1-5z" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 flex-shrink-0 text-blue-400/60">
                    <path d="M3 12V4.5L8 2l5 2.5V12L8 14.5 3 12z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1"/>
                  </svg>
                )}
                <span>{name}</span>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
