// frontend/src/components/UploadZone.tsx

import { useRef, useState } from 'react'

const MAX_MB = Number(import.meta.env.VITE_MAX_MB ?? 50)
const MAX_BYTES = MAX_MB * 1024 * 1024

interface Props {
  onFile: (file: File) => void
  disabled?: boolean
}

export default function UploadZone({ onFile, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [sizeError, setSizeError] = useState<string | null>(null)

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const file = files[0]
    setSizeError(null)

    if (!file.name.endsWith('.zip')) {
      setSizeError('Only .zip files are accepted.')
      return
    }
    if (file.size > MAX_BYTES) {
      setSizeError(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_MB} MB.`)
      if (inputRef.current) inputRef.current.value = ''
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
        'relative rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-200 cursor-pointer select-none group',
        dragging
          ? 'border-blue-500 bg-blue-500/[0.06] scale-[1.01]'
          : 'border-white/[0.10] hover:border-white/[0.20] bg-white/[0.02] hover:bg-white/[0.03]',
        disabled ? 'opacity-40 cursor-not-allowed' : '',
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

      {/* Icon */}
      <div className={[
        'w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center transition-all duration-200',
        dragging
          ? 'bg-blue-500/20 text-blue-300'
          : 'bg-white/[0.05] text-gray-400 group-hover:bg-white/[0.07] group-hover:text-gray-300',
      ].join(' ')}>
        <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7">
          <path d="M12 15V3m0 0L8 7m4-4l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M3 15v4a2 2 0 002 2h14a2 2 0 002-2v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      </div>

      <p className="text-base font-semibold text-gray-200 mb-1">
        {dragging ? 'Release to upload' : 'Drop your repository here'}
      </p>
      <p className="text-sm text-gray-500">
        or <span className="text-blue-400 group-hover:text-blue-300 transition-colors">click to browse</span>
      </p>
      <p className="text-xs text-gray-600 mt-3">
        .zip format only · Python projects · Max {MAX_MB} MB
      </p>

      {sizeError && (
        <div className="absolute inset-x-4 bottom-4 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-xs text-red-300 pointer-events-none">
          <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-red-400 flex-shrink-0">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M8 5v3M8 10v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          {sizeError}
        </div>
      )}
    </div>
  )
}
