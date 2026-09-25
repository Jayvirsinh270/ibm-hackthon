// frontend/src/pages/GraphPage.tsx
// Phase 1 stub — will be built out in Phases 4–8

interface Props {
  repoId: string
}

export default function GraphPage({ repoId }: Props) {
  return (
    <div className="max-w-2xl mx-auto mt-20 px-6 text-center">
      <h2 className="text-xl font-semibold mb-2">Graph View</h2>
      <p className="text-gray-400 text-sm">
        Repository: <code className="text-gray-300">{repoId}</code>
      </p>
      <p className="text-gray-600 mt-6 text-sm">
        Graph visualization — coming in Phase 7
      </p>
    </div>
  )
}
