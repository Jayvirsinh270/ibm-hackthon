// frontend/src/components/FileTree.tsx
// Phase 2 — Render a nested directory tree from the API response

interface Props {
  tree: Record<string, unknown>
  depth?: number
}

export default function FileTree({ tree, depth = 0 }: Props) {
  const indent = depth * 16

  return (
    <ul className="text-sm font-mono">
      {Object.entries(tree).map(([name, children]) => {
        const isDir = children !== null && typeof children === 'object'
        return (
          <li key={name} style={{ paddingLeft: indent }}>
            {isDir ? (
              <>
                <span className="text-yellow-400">📁 {name}/</span>
                <FileTree tree={children as Record<string, unknown>} depth={depth + 1} />
              </>
            ) : (
              <span className="text-gray-300">
                {name.endsWith('_test.py') || name.startsWith('test_')
                  ? '🧪'
                  : '🐍'}{' '}
                {name}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
