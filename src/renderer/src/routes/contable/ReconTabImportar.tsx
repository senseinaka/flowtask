import { useState, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Upload, FileCheck2, AlertCircle, Loader2, X, Check } from 'lucide-react'
import type { ReconImportSource, ReconImport } from '@shared/types'
import { RECON_SOURCE_LABELS } from '@shared/types'
import { useReconImports } from '../../hooks/useRecon'
import { cn } from '../../components/ui/utils'

const SOURCES: { key: ReconImportSource; color: string; ext: string; accepts: string[] }[] = [
  { key: 'flexxus',       color: '#f59e0b', ext: 'XLSX', accepts: ['.xlsx'] },
  { key: 'ml_principal',  color: '#3b82f6', ext: 'XLS',  accepts: ['.xls', '.xlsx'] },
  { key: 'ml_secundaria', color: '#8b5cf6', ext: 'XLS',  accepts: ['.xls', '.xlsx'] },
  { key: 'cupones_csv',   color: '#10b981', ext: 'CSV',  accepts: ['.csv'] },
  { key: 'cupones_xlsx',  color: '#06b6d4', ext: 'XLSX', accepts: ['.xlsx', '.xls'] },
]

function fmtDate(ms: number) {
  return new Date(ms).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
  })
}
function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

interface Pending { source: ReconImportSource; filePath: string; filename: string; size: number }
type Feedback = { ok: boolean; msg: string }

export default function ReconTabImportar({
  periodId, userId
}: {
  periodId: string
  userId: string
}) {
  const qc = useQueryClient()
  const { data: imports = [], refetch } = useReconImports(periodId)
  const [dragOver,  setDragOver]  = useState<ReconImportSource | null>(null)
  const [dragError, setDragError] = useState<ReconImportSource | null>(null)
  const [importing, setImporting] = useState<ReconImportSource | null>(null)
  const [pending,   setPending]   = useState<Pending | null>(null)
  const [feedback,  setFeedback]  = useState<Record<string, Feedback>>({})

  const lastBySource = useMemo(() => {
    const map: Record<string, ReconImport> = {}
    for (const imp of imports) {
      if (!map[imp.source] || imp.imported_at > map[imp.source].imported_at)
        map[imp.source] = imp
    }
    return map
  }, [imports])

  function validateExt(source: ReconImportSource, name: string) {
    const src = SOURCES.find(s => s.key === source)!
    const ext = '.' + (name.split('.').pop() ?? '').toLowerCase()
    return src.accepts.includes(ext)
  }

  function setFb(source: ReconImportSource, fb: Feedback) {
    setFeedback(prev => ({ ...prev, [source]: fb }))
    setTimeout(() => setFeedback(prev => { const n = {...prev}; delete n[source]; return n }), 5000)
  }

  async function processResult(source: ReconImportSource, result: Awaited<ReturnType<typeof window.api.recon.imports.importFile>>) {
    if (result.canceled) return
    if (result.ok) {
      setFb(source, { ok: true, msg: `${result.count} filas importadas · ${result.filename}` })
      await refetch()
      qc.invalidateQueries({ queryKey: ['recon-invoices', periodId] })
      qc.invalidateQueries({ queryKey: ['recon-mlops', periodId] })
    } else {
      setFb(source, { ok: false, msg: result.error ?? 'Error desconocido' })
    }
  }

  async function handlePick(source: ReconImportSource) {
    setImporting(source)
    try { await processResult(source, await window.api.recon.imports.importFile(periodId, source, userId)) }
    finally { setImporting(null) }
  }

  async function confirmPending() {
    if (!pending) return
    const { source, filePath } = pending
    setPending(null)
    setImporting(source)
    try { await processResult(source, await window.api.recon.imports.importFile(periodId, source, userId, filePath)) }
    finally { setImporting(null) }
  }

  function handleDragOver(e: React.DragEvent, source: ReconImportSource) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(source)
  }
  function handleDragLeave(e: React.DragEvent, source: ReconImportSource) {
    const rel = e.relatedTarget as Element | null
    if (rel && (e.currentTarget as Element).contains(rel)) return
    if (dragOver === source) setDragOver(null)
  }
  function handleDrop(e: React.DragEvent, source: ReconImportSource) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(null)
    const file = e.dataTransfer.files[0]
    if (!file) return
    if (!validateExt(source, file.name)) {
      setDragError(source)
      setTimeout(() => setDragError(null), 2500)
      return
    }
    const filePath = (file as File & { path?: string }).path ?? ''
    if (!filePath) {
      setFb(source, { ok: false, msg: 'No se pudo obtener la ruta del archivo' })
      return
    }
    setPending({ source, filePath, filename: file.name, size: file.size })
  }

  return (
    <div className="space-y-2.5">
      <p className="text-xs text-slate-400 mb-4">
        Arrastrá los archivos directamente sobre cada card, o usá "Cargar" para abrir el selector.
      </p>

      {SOURCES.map(src => {
        const last = lastBySource[src.key]
        const isLoading = importing === src.key
        const isDragOver  = dragOver  === src.key
        const isDragError = dragError === src.key
        const fb = feedback[src.key]
        const ok = last?.status === 'ok'

        return (
          <div
            key={src.key}
            onDragOver={e => handleDragOver(e, src.key)}
            onDragLeave={e => handleDragLeave(e, src.key)}
            onDrop={e => handleDrop(e, src.key)}
            className={cn(
              'relative bg-slate-800 border rounded-xl p-4 flex items-start gap-3 transition-all duration-150',
              isDragError  ? 'border-red-500 bg-red-950/20'
                : isDragOver ? 'border-amber-500 bg-amber-950/10 scale-[1.01] shadow-lg shadow-amber-950/20'
                : 'border-slate-700'
            )}
          >
            {/* Drag overlay */}
            {isDragOver && (
              <div className="absolute inset-0 rounded-xl flex items-center justify-center pointer-events-none z-10">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <Upload size={18} className="text-amber-400" />
                  </div>
                  <span className="text-xs text-amber-300 font-medium">Soltar para cargar</span>
                </div>
              </div>
            )}
            {isDragError && (
              <div className="absolute inset-0 rounded-xl flex items-center justify-center pointer-events-none z-10 bg-red-950/40">
                <div className="flex flex-col items-center gap-1">
                  <AlertCircle size={18} className="text-red-400" />
                  <span className="text-xs text-red-300 font-medium">
                    Formato incorrecto — se espera {src.ext}
                  </span>
                </div>
              </div>
            )}

            {/* Ext badge */}
            <div
              className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-bold mt-0.5"
              style={{ backgroundColor: src.color + '22', color: src.color }}
            >
              {src.ext}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{RECON_SOURCE_LABELS[src.key]}</p>
              {last ? (
                <>
                  <p className={cn('text-xs mt-0.5', ok ? 'text-emerald-400' : 'text-red-400')}>
                    {ok ? `${last.row_count} filas · ${fmtDate(last.imported_at)}` : `Error: ${last.error_msg}`}
                  </p>
                  {last.filename && (
                    <p className="text-[10px] text-slate-600 truncate mt-0.5">{last.filename}</p>
                  )}
                </>
              ) : (
                <p className="text-xs text-slate-500 mt-0.5">Sin importar</p>
              )}
              {fb && (
                <div className={cn('flex items-center gap-1.5 mt-1.5 text-xs', fb.ok ? 'text-emerald-400' : 'text-red-400')}>
                  {fb.ok ? <FileCheck2 size={11} /> : <AlertCircle size={11} />}
                  {fb.msg}
                </div>
              )}
            </div>

            <button
              onClick={() => handlePick(src.key)}
              disabled={isLoading}
              className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded-lg transition-colors disabled:opacity-50"
            >
              {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              Cargar
            </button>
          </div>
        )
      })}

      {/* Confirmation modal for drag & drop */}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-80 shadow-2xl">
            <h3 className="text-white font-semibold text-sm mb-1">Confirmar carga</h3>
            <p className="text-xs text-slate-400 mb-4">
              Fuente: <span className="text-amber-300">{RECON_SOURCE_LABELS[pending.source]}</span>
            </p>
            <div className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2.5 mb-4">
              <p className="text-xs text-white font-mono truncate">{pending.filename}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{fmtSize(pending.size)}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPending(null)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
              >
                <X size={12} /> Cancelar
              </button>
              <button
                onClick={confirmPending}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Check size={12} /> Cargar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
