// frontend/src/components/UploadZone.tsx
// Phase 2 — Drag-and-drop or click-to-upload zone for .zip files

import { useRef, useState } from 'react'

interface Props {
  onFile: (file: File) => void
  disabled?: boolean
}

export default function UploadZone({ onFile, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const file = files[0]
    if (!file.name.endsWith('.zip')) {
      alert('Please upload a .zip file')
      return
    }
    onFile(file)
  }

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); !disabled && setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => {
        e.preventDefault()
        setDragging(false)
        if (!disabled) handleFiles(e.dataTransfer.files)
      }}
      className={[
        'border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer select-none',
        dragging
          ? 'border-blue-500 bg-blue-950/30'
          : 'border-gray-700 hover:border-gray-500',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
        disabled={disabled}
      />
      <p className="text-3xl mb-3">📦</p>
      <p className="text-gray-300 font-medium">
        Drop a .zip file here, or click to browse
      </p>
      <p className="text-gray-500 text-sm mt-1">
        Python repositories only · Max {import.meta.env.VITE_MAX_MB ?? 50} MB
      </p>
    </div>
  )
}
