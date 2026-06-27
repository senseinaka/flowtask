import { useState, useMemo, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Upload, FileCheck2, AlertCircle, Loader2, Trash2, FileText, MousePointerClick } from 'lucide-react'
import type { ReconImportSource, ReconImport } from '@shared/types'
import { RECON_SOURCE_LABELS } from '@shared/types'
import { useReconImports, useClearReconSource } from '../../hooks/useRecon'
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

type Feedback = { ok: boolean; msg: string }

function ImportLogRow({
  imp, onClear, clearing
}: {
  imp: ReconImport
  onClear: () => void
  clearing: boolean
}) {
  const ok      = imp.status === 'ok'
  const allDup  = ok && imp.row_count === 0 && imp.skipped_count > 0
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/60 border border-slate-700/40 rounded-lg">
      <FileText size={11} className={ok ? (allDup ? 'text-amber-400' : 'text-emerald-400') : 'text-red-400'} />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-slate-300 truncate font-mono">{imp.filename || '(sin nombre)'}</p>
        {ok ? (
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {imp.row_count > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-400 font-medium">
                +{imp.row_count} nuevas
              </span>
            )}
            {imp.skipped_count > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-500">
                {imp.skipped_count} repetidas
              </span>
            )}
            {allDup && (
              <span className="text-[10px] text-amber-500">archivo ya cargado</span>
            )}
            <span className="text-[10px] text-slate-600">· {fmtDate(imp.imported_at)}</span>
          </div>
        ) : (
          <p className="text-[10px] text-red-400">Error: {imp.error_msg}</p>
        )}
      </div>
      <button
        onClick={onClear}
        disabled={clearing}
        title="Quitar datos de esta fuente"
        className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
      >
        {clearing ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
      </button>
    </div>
  )
}

// ── DropZone ──────────────────────────────────────────────────────────────────
// Zona de drop explícita con dashed border; maneja sus propios eventos D&D
// para evitar conflictos con la estructura anidada del card.

function DropZone({
  source, ext, color,
  onDrop, onError,
}: {
  source: ReconImportSource
  ext: string
  color: string
  onDrop: (file: File) => void
  onError: () => void
}) {
  const [over, setOver] = useState(false)
  const enterCount = useRef(0)

  function accepts(name: string) {
    const src = SOURCES.find(s => s.key === source)!
    return src.accepts.includes('.' + (name.split('.').pop() ?? '').toLowerCase())
  }

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    enterCount.current++
    setOver(true)
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    enterCount.current--
    if (enterCount.current === 0) setOver(false)
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    enterCount.current = 0
    setOver(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    if (!accepts(file.name)) { onError(); return }
    onDrop(file)
  }

  return (
    <div
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={handleDrop}
      className={cn(
        'mx-3 mb-3 mt-1 rounded-lg border-2 border-dashed px-4 py-3 flex items-center justify-center gap-2 transition-all duration-150 select-none',
        over
          ? 'border-amber-500 bg-amber-500/10 scale-[1.01]'
          : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/30'
      )}
      style={{ cursor: 'copy' }}
    >
      <Upload size={13} className={over ? 'text-amber-400' : 'text-slate-500'} />
      <span className={cn('text-[11px]', over ? 'text-amber-300 font-medium' : 'text-slate-500')}>
        {over ? 'Soltar para cargar' : `Arrastrá un .${ext.toLowerCase()} aquí`}
      </span>
      {!over && (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded font-bold"
          style={{ backgroundColor: color + '22', color }}
        >
          {ext}
        </span>
      )}
    </div>
  )
}

// ── Principal ─────────────────────────────────────────────────────────────────

export default function ReconTabImportar({
  periodId, userId
}: {
  periodId: string
  userId: string
}) {
  const qc = useQueryClient()
  const { data: imports = [], refetch } = useReconImports(periodId)
  const clearSource = useClearReconSource()

  const [importing,   setImporting]   = useState<ReconImportSource | null>(null)
  const [feedback,    setFeedback]    = useState<Record<string, Feedback>>({})
  const [clearingKey, setClearingKey] = useState<string | null>(null)
  const [dropError,   setDropError]   = useState<ReconImportSource | null>(null)

  const importsBySource = useMemo(() => {
    const map: Record<string, ReconImport[]> = {}
    for (const imp of imports) {
      if (!map[imp.source]) map[imp.source] = []
      map[imp.source].push(imp)
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => b.imported_at - a.imported_at)
    }
    return map
  }, [imports])

  function setFb(source: ReconImportSource, fb: Feedback) {
    setFeedback(prev => ({ ...prev, [source]: fb }))
    setTimeout(() => setFeedback(prev => { const n = {...prev}; delete n[source]; return n }), 6000)
  }

  async function processResult(
    source: ReconImportSource,
    result: Awaited<ReturnType<typeof window.api.recon.imports.importFile>>
  ) {
    if (result.canceled) return
    if (result.ok) {
      const skipped = result.skipped ?? 0
      const msg = skipped > 0
        ? `${result.count} nuevas · ${skipped} duplicadas ignoradas · ${result.filename}`
        : `${result.count} filas importadas · ${result.filename}`
      setFb(source, { ok: true, msg })
      await refetch()
      qc.invalidateQueries({ queryKey: ['recon-invoices', periodId] })
      qc.invalidateQueries({ queryKey: ['recon-mlops', periodId] })
      qc.invalidateQueries({ queryKey: ['recon-results-all'] })
    } else {
      setFb(source, { ok: false, msg: result.error ?? 'Error desconocido' })
    }
  }

  async function handlePick(source: ReconImportSource) {
    setImporting(source)
    try { await processResult(source, await window.api.recon.imports.importFile(periodId, source, userId)) }
    finally { setImporting(null) }
  }

  async function handleClearSource(source: ReconImportSource) {
    setClearingKey(source)
    try {
      await clearSource.mutateAsync({ periodId, source })
      await refetch()
      qc.invalidateQueries({ queryKey: ['recon-results', periodId] })
      qc.invalidateQueries({ queryKey: ['recon-results-all'] })
      qc.invalidateQueries({ queryKey: ['recon-kpis', periodId] })
    } finally {
      setClearingKey(null)
    }
  }

  async function handleFileDrop(source: ReconImportSource, file: File) {
    setImporting(source)
    try {
      const buf    = await file.arrayBuffer()
      const result = await window.api.recon.imports.importFileBuffer(
        periodId, source, userId, new Uint8Array(buf), file.name
      )
      await processResult(source, result)
    } catch {
      setFb(source, { ok: false, msg: 'No se pudo leer el archivo' })
    } finally {
      setImporting(null)
    }
  }

  function handleDropError(source: ReconImportSource) {
    const src = SOURCES.find(s => s.key === source)!
    setDropError(source)
    setFb(source, { ok: false, msg: `Formato incorrecto — se espera ${src.ext}` })
    setTimeout(() => setDropError(null), 2500)
  }

  return (
    <div className="space-y-3">

      {/* Leyenda D&D */}
      <div className="flex items-start gap-2.5 bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 mb-1">
        <MousePointerClick size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-400">
          Podés <span className="text-amber-300 font-medium">arrastrar y soltar</span> archivos directamente
          sobre la zona punteada de cada fuente, o usar el botón <strong className="text-slate-300">Cargar</strong>.
          Cada archivo que sumes agrega solo los datos nuevos; los duplicados se ignoran automáticamente.
        </p>
      </div>

      {SOURCES.map(src => {
        const srcImports = importsBySource[src.key] ?? []
        const totalNew   = srcImports.filter(i => i.status === 'ok').reduce((s, i) => s + i.row_count, 0)
        const isLoading  = importing === src.key
        const fb         = feedback[src.key]
        const isClearing = clearingKey === src.key
        const hasError   = dropError === src.key

        return (
          <div
            key={src.key}
            className={cn(
              'bg-slate-800 border rounded-xl transition-all duration-150',
              hasError ? 'border-red-500' : 'border-slate-700'
            )}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/60">
              <div
                className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-bold"
                style={{ backgroundColor: src.color + '22', color: src.color }}
              >
                {src.ext}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{RECON_SOURCE_LABELS[src.key]}</p>
                {totalNew > 0 && (
                  <p className="text-[10px] text-emerald-500">{totalNew} filas cargadas en total</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {srcImports.length > 0 && (
                  <button
                    onClick={() => handleClearSource(src.key)}
                    disabled={isClearing}
                    title="Limpiar todos los datos de esta fuente"
                    className="flex items-center gap-1 px-2 py-1.5 text-xs text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-40"
                  >
                    {isClearing ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                    Limpiar todo
                  </button>
                )}
                <button
                  onClick={() => handlePick(src.key)}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded-lg transition-colors disabled:opacity-50"
                >
                  {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  Cargar
                </button>
              </div>
            </div>

            {/* Lista de archivos importados */}
            {srcImports.length > 0 && (
              <div className="px-3 pt-2.5 space-y-1.5">
                {srcImports.map(imp => (
                  <ImportLogRow
                    key={imp.id}
                    imp={imp}
                    onClear={() => handleClearSource(src.key)}
                    clearing={isClearing}
                  />
                ))}
              </div>
            )}

            {/* Zona de drop explícita */}
            <DropZone
              source={src.key}
              ext={src.ext}
              color={src.color}
              onDrop={file => handleFileDrop(src.key, file)}
              onError={() => handleDropError(src.key)}
            />

            {/* Feedback */}
            {fb && (
              <div className={cn(
                'flex items-center gap-1.5 mx-3 mb-3 -mt-1 px-3 py-2 rounded-lg text-xs',
                fb.ok ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/20 text-red-400'
              )}>
                {fb.ok ? <FileCheck2 size={11} /> : <AlertCircle size={11} />}
                {fb.msg}
              </div>
            )}
          </div>
        )
      })}

    </div>
  )
}
