import { useState } from 'react'
import { Paperclip, Plus, X, Loader2, FileText, Image, File, CheckCircle2, AlertCircle, CloudUpload, ExternalLink } from 'lucide-react'
import { useKnowledgeEntryFiles, useUploadEntryFile, useDeleteEntryFile } from '../../hooks/useKnowledge'
import type { KnowledgeEntryFile } from '@shared/types'

function fmtFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileIcon({ mime, size = 12 }: { mime: string; size?: number }) {
  if (mime.startsWith('image/')) return <Image size={size} />
  if (mime.includes('pdf') || mime.includes('word') || mime.includes('text')) return <FileText size={size} />
  return <File size={size} />
}

function DriveStatusIcon({ status }: { status: string }) {
  if (status === 'synced')    return <CheckCircle2 size={10} className="text-green-500" />
  if (status === 'uploading') return <CloudUpload size={10} className="text-amber-400 animate-pulse" />
  if (status === 'error')     return <AlertCircle size={10} className="text-red-500" />
  return null
}

interface Props {
  entryId: string
  rootEntryId?: string
  compact?: boolean
}

export default function KnowledgeAttachmentStrip({ entryId, rootEntryId, compact = false }: Props) {
  const { data: files = [], isLoading } = useKnowledgeEntryFiles(entryId)
  const upload = useUploadEntryFile()
  const remove = useDeleteEntryFile()
  const [isDragging, setIsDragging] = useState(false)

  async function handleAttach() {
    const filePath = await window.api.knowledge.files.selectFile()
    if (!filePath) return
    upload.mutate({ entryId, filePath, rootEntryId })
  }

  function handleDelete(f: KnowledgeEntryFile, e: React.MouseEvent) {
    e.stopPropagation()
    remove.mutate({ id: f.id, entryId })
  }

  function handleOpenInDrive(f: KnowledgeEntryFile, e: React.MouseEvent) {
    e.stopPropagation()
    if (f.drive_file_id && f.drive_status === 'synced') {
      window.api.knowledge.files.openInDrive(f.drive_file_id)
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    if (!isDragging) setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false)
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    for (const file of Array.from(e.dataTransfer.files)) {
      const filePath = window.api.knowledge.files.getFilePath(file)
      if (filePath) upload.mutate({ entryId, filePath, rootEntryId })
    }
  }

  if (compact) {
    return (
      <div
        className="flex items-center gap-1 flex-wrap mt-1"
        onClick={e => e.stopPropagation()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}>
        {files.map(f => (
          <span key={f.id}
            onClick={e => handleOpenInDrive(f, e)}
            title={f.drive_status === 'synced' ? 'Abrir en Drive' : f.file_name}
            className={`flex items-center gap-1 text-[10px] bg-slate-700/60 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700 group ${f.drive_status === 'synced' ? 'cursor-pointer hover:border-teal-700 hover:text-teal-300' : ''}`}>
            <FileIcon mime={f.file_mime_type} size={10}/>
            <span className="truncate max-w-[100px]">{f.file_name}</span>
            <DriveStatusIcon status={f.drive_status}/>
            <button onClick={e => handleDelete(f, e)} className="text-slate-600 hover:text-red-400 ml-0.5 hidden group-hover:inline">
              <X size={9}/>
            </button>
          </span>
        ))}
        <button
          onClick={e => { e.stopPropagation(); handleAttach() }}
          disabled={upload.isPending}
          className="flex items-center gap-0.5 text-[10px] text-slate-600 hover:text-teal-400 transition-colors px-1 py-0.5 rounded hover:bg-slate-800">
          {upload.isPending ? <Loader2 size={10} className="animate-spin"/> : <Paperclip size={10}/>}
          {files.length === 0 && !upload.isPending && <span>Adjuntar</span>}
        </button>
      </div>
    )
  }

  return (
    <div className="mt-3 pt-2.5 border-t border-slate-800/60">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] uppercase tracking-widest text-slate-700 flex items-center gap-1">
          <Paperclip size={9}/>Adjuntos{files.length > 0 && ` (${files.length})`}
        </span>
        <button
          onClick={handleAttach}
          disabled={upload.isPending}
          className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-teal-400 transition-colors px-1.5 py-0.5 rounded hover:bg-slate-800">
          {upload.isPending ? <Loader2 size={10} className="animate-spin"/> : <Plus size={10}/>}
          {upload.isPending ? 'Subiendo...' : 'Adjuntar archivo'}
        </button>
      </div>
      {isLoading ? (
        <div className="text-[10px] text-slate-700">Cargando...</div>
      ) : files.length === 0 ? (
        <div
          onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={handleAttach}
          className={`w-full flex flex-col items-center gap-1 py-3 border border-dashed rounded-lg cursor-pointer transition-colors ${isDragging ? 'border-teal-600 bg-teal-900/10 text-teal-400' : 'border-slate-800 text-slate-700 hover:border-slate-600 hover:text-slate-500'}`}>
          <Paperclip size={14}/>
          <span className="text-[10px]">{isDragging ? 'Soltá para adjuntar' : 'Arrastrá o hacé clic para adjuntar'}</span>
        </div>
      ) : (
        <div
          className={`flex flex-col gap-1 rounded-lg transition-colors ${isDragging ? 'bg-teal-900/10 ring-1 ring-teal-700' : ''}`}
          onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
          {files.map(f => (
            <div key={f.id}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-800/50 border border-slate-800 group transition-colors ${f.drive_status === 'synced' ? 'hover:border-teal-800 cursor-pointer' : 'hover:border-slate-700'}`}
              onClick={e => handleOpenInDrive(f, e)}
              title={f.drive_status === 'synced' ? 'Abrir en Google Drive' : undefined}>
              <FileIcon mime={f.file_mime_type} size={13}/>
              <span className="flex-1 text-[11px] text-slate-300 truncate">{f.file_name}</span>
              <span className="text-[10px] text-slate-600 shrink-0">{fmtFileSize(f.file_size)}</span>
              <DriveStatusIcon status={f.drive_status}/>
              {f.drive_status === 'synced' && <ExternalLink size={9} className="text-slate-700 group-hover:text-teal-500 transition-colors shrink-0"/>}
              <button onClick={e => handleDelete(f, e)} className="text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                <X size={11}/>
              </button>
            </div>
          ))}
          <button onClick={handleAttach} disabled={upload.isPending}
            className="flex items-center gap-1.5 text-[10px] text-slate-600 hover:text-slate-400 mt-0.5 transition-colors px-1">
            {upload.isPending ? <Loader2 size={10} className="animate-spin"/> : <Plus size={10}/>}
            Adjuntar otro archivo
          </button>
        </div>
      )}
    </div>
  )
}
