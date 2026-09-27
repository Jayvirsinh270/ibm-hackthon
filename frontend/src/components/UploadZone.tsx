// frontend/src/components/UploadZone.tsx

import { useRef, useState } from 'react'

const MAX_MB = Number(import.meta.env.VITE_MAX_MB ?? 50)
const MAX_BYTES = MAX_MB * 1024 * 1024

interface Props {
  onFile: (file: File) => void
  onFolder?: (folderName: string, files: File[]) => void
  disabled?: boolean
}

export default function UploadZone({ onFile, onFolder, disabled }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [sizeError, setSizeError] = useState<string | null>(null)

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const file = files[0]
    setSizeError(null)

    if (!file.name.endsWith('.zip')) {
      setSizeError('Only .zip files or directories are accepted.')
      return
    }
    if (file.size > MAX_BYTES) {
      setSizeError(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_MB} MB.`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    onFile(file)
  }

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return
    setSizeError(null)

    const filesArray = Array.from(fileList)
    const firstRel = filesArray[0].webkitRelativePath || ''
    const folderName = firstRel.split('/')[0] || 'uploaded-project'

    if (onFolder) {
      onFolder(folderName, filesArray)
    }
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); !disabled && setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => {
        e.preventDefault()
        setDragging(false)
        if (!disabled) handleFiles(e.dataTransfer.files)
      }}
      className={[
        'relative rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-200 select-none group',
        dragging
          ? 'border-blue-500 bg-blue-500/[0.06] scale-[1.01]'
          : 'border-white/[0.10] hover:border-white/[0.20] bg-white/[0.02]',
        disabled ? 'opacity-40 cursor-not-allowed' : '',
      ].join(' ')}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
        disabled={disabled}
      />

      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is standard across modern Chromium, Safari, and Firefox
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        onChange={handleFolderChange}
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
      <p className="text-sm text-gray-400 mb-5">
        Upload a project archive (.zip) or select an uncompressed folder
      </p>

      {/* Dual action buttons */}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => !disabled && fileInputRef.current?.click()}
          disabled={disabled}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600 border border-blue-500/30 hover:border-blue-500 text-blue-300 hover:text-white text-xs font-semibold transition-all shadow-sm"
        >
          <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
            <path d="M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          Choose .ZIP Archive
        </button>

        <button
          type="button"
          onClick={() => !disabled && folderInputRef.current?.click()}
          disabled={disabled}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] hover:border-white/[0.2] text-gray-300 hover:text-white text-xs font-semibold transition-all"
        >
          <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-amber-400">
            <path d="M1.5 4.5A1 1 0 012.5 3.5H6l1.5 1.5H13.5a1 1 0 011 1V12a1 1 0 01-1 1H2.5a1 1 0 01-1-1V4.5z" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.2"/>
          </svg>
          Select Folder Directly
        </button>
      </div>

      <p className="text-xs text-gray-600 mt-4">
        Supports all Python codebases · Client-side AST indexing · Max {MAX_MB} MB
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
