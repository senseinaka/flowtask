import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Package, Trash2, Check, X, Plus,
  FileText, DollarSign, Ship, ChevronDown, Edit2,
  FolderOpen, Loader2, Mail, Copy, Upload, CloudOff, Cloud, AlertCircle, ExternalLink, Paperclip,
  ShieldCheck, Shield, ClipboardList, CheckCircle2, Clock, ChevronRight, Bot, Sparkles,
  ChevronsDown, ChevronsUp, Landmark
} from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
dayjs.locale('es')

import {
  useComexImport,
  useUpdateComexImport,
  useDeleteComexImport,
  useComexItems,
  useComexDocuments,
  useComexPayments,
  useComexSuppliers,
  useComexCustoms,
  useComexFreightOperators,
  useComexQuotesByImport,
  useCreateComexQuote,
  useUpdateComexQuote,
  useDeleteComexQuote,
  useCreateComexDocument,
  useUpdateComexDocument,
  useDeleteComexDocument,
  useUploadComexDocument,
  useUploadNewComexDocument,
  useComexInalCerts,
  useUploadInalCert,
  useDeleteInalCert
} from '../../hooks/useComex'
import CustomsSection from './CustomsSection'
import CostsSection from './CostsSection'
import {
  IMPORT_STATUS_LABELS,
  IMPORT_STATUS_COLORS,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_COLORS,
  CARGO_TYPE_LABELS,
  INCOTERMS
} from '@shared/types'
import type {
  ImportStatus, DocumentType, DocumentStatus, DriveDocStatus,
  QuoteStatus, PaymentMethod, ComexImport, ComexDocument, ComexInalCert,
  InalLCStatus,
  ComexFreightOperator, CargoType, ComexLogisticsQuote, ComexCustoms
} from '@shared/types'
import { cn, formatBytes } from '../../components/ui/utils'
import { useAnalyzeComexDocument, useAIConfigured, useAnalyzeDespacho } from '../../hooks/useAI'
import {
  useUploadDespacho, useDeleteDespacho,
  useComexTributos, useCreateComexTributo, useUpdateComexTributo,
  useDeleteComexTributo, useUpsertComexTributos,
  useComexExtraCosts, useCreateComexExtraCost, useUpdateComexExtraCost,
  useDeleteComexExtraCost, useUploadExtraCostInvoice
} from '../../hooks/useComex'
import { useAnalyzeExtraCost } from '../../hooks/useAI'
import type {
  ComexImportTributo, ComexImportExtraCost,
  ExtraCostCategory, EXTRA_COST_CATEGORY_LABELS as ECL
} from '@shared/types'
import {
  EXTRA_COST_CATEGORIES, EXTRA_COST_CATEGORY_LABELS
} from '@shared/types'
import type { AIAnalysisResult, ExtractedDespacho, ExtractedFactura } from '@shared/types'

const ALL_STATUSES = Object.keys(IMPORT_STATUS_LABELS) as ImportStatus[]
const CURRENCIES = ['USD', 'EUR', 'CNY', 'GBP', 'JPY']   // for quotes/payments
const IMPORT_CURRENCIES = ['USD', 'EUR']                  // for import's own currency

// ── Editable primitives ───────────────────────────────────────────────────────

/** Click-to-edit text field */
function EditableText({
  label, value, onSave, placeholder = '—', multiline = false
}: {
  label: string
  value: string | null | undefined
  onSave: (v: string) => void
  placeholder?: string
  multiline?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

  const start = () => { setDraft(value ?? ''); setEditing(true) }
  const commit = () => { onSave(draft); setEditing(false) }
  const cancel = () => setEditing(false)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  const sharedInputClass =
    'w-full bg-slate-700 border border-cyan-600 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-400'

  if (editing) {
    return (
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={draft}
            rows={3}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Escape') cancel() }}
            className={cn(sharedInputClass, 'resize-none')}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
            className={sharedInputClass}
          />
        )}
      </div>
    )
  }

  return (
    <button onClick={start} className="text-left group w-full">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={cn('text-sm mt-0.5 group-hover:text-cyan-300 transition-colors', value ? 'text-slate-200' : 'text-slate-600 italic')}>
        {value?.trim() || placeholder}
        <Edit2 size={10} className="inline ml-1.5 opacity-0 group-hover:opacity-60 transition-opacity" />
      </p>
    </button>
  )
}

/** Click-to-edit number field */
function EditableNumber({
  label, value, onSave, prefix = '', placeholder = '—'
}: {
  label: string
  value: number | null | undefined
  onSave: (v: number | null) => void
  prefix?: string
  placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const start = () => { setDraft(value != null ? String(value) : ''); setEditing(true) }
  const commit = () => { onSave(draft.trim() ? Number(draft) : null); setEditing(false) }
  const cancel = () => setEditing(false)

  if (editing) {
    return (
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
        <input
          autoFocus
          type="number"
          step="0.01"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
          className="w-full bg-slate-700 border border-cyan-600 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-400"
        />
      </div>
    )
  }

  return (
    <button onClick={start} className="text-left group w-full">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={cn('text-sm mt-0.5 group-hover:text-cyan-300 transition-colors', value != null ? 'text-slate-200' : 'text-slate-600 italic')}>
        {value != null ? `${prefix}${value.toLocaleString('es-AR')}` : placeholder}
        <Edit2 size={10} className="inline ml-1.5 opacity-0 group-hover:opacity-60 transition-opacity" />
      </p>
    </button>
  )
}

/** Click-to-edit date field */
function EditableDate({
  label, value, onSave, placeholder = '—'
}: {
  label: string
  value: number | null | undefined
  onSave: (v: number | null) => void
  placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const tsToDate = (ts: number | null | undefined) =>
    ts ? dayjs(ts).format('YYYY-MM-DD') : ''

  const start = () => { setDraft(tsToDate(value)); setEditing(true) }

  const commit = () => {
    // Only save if the draft is a valid full date (YYYY-MM-DD = 10 chars)
    if (draft.length === 10 && dayjs(draft).isValid()) {
      onSave(dayjs(draft).valueOf())
    } else if (draft === '') {
      onSave(null)
    }
    setEditing(false)
  }

  const cancel = () => setEditing(false)

  if (editing) {
    return (
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
        <input
          autoFocus
          type="date"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') cancel()
          }}
          className="w-full bg-slate-700 border border-cyan-600 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-400"
        />
      </div>
    )
  }

  return (
    <button onClick={start} className="text-left group w-full">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={cn('text-sm mt-0.5 group-hover:text-cyan-300 transition-colors', value ? 'text-slate-200' : 'text-slate-600 italic')}>
        {value ? dayjs(value).format('DD/MM/YYYY') : placeholder}
        <Edit2 size={10} className="inline ml-1.5 opacity-0 group-hover:opacity-60 transition-opacity" />
      </p>
    </button>
  )
}

/** Click-to-edit select */
function EditableSelect<T extends string>({
  label, value, options, onChange
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
        <select
          autoFocus
          value={value}
          onChange={(e) => { onChange(e.target.value as T); setEditing(false) }}
          onBlur={() => setEditing(false)}
          className="w-full bg-slate-700 border border-cyan-600 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <button onClick={() => setEditing(true)} className="text-left group w-full">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm text-slate-200 mt-0.5 group-hover:text-cyan-300 transition-colors">
        {options.find((o) => o.value === value)?.label ?? value}
        <Edit2 size={10} className="inline ml-1.5 opacity-0 group-hover:opacity-60 transition-opacity" />
      </p>
    </button>
  )
}

/** Editable title (large heading) */
function EditableTitle({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const start = () => { setDraft(value); setEditing(true) }
  const commit = () => { if (draft.trim()) onSave(draft.trim()); setEditing(false) }
  const cancel = () => setEditing(false)

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
        className="text-xl font-bold text-white bg-slate-700 border border-cyan-600 rounded-lg px-3 py-1.5 w-full focus:outline-none focus:border-cyan-400"
      />
    )
  }

  return (
    <button onClick={start} className="text-left group">
      <h1 className="text-xl font-bold text-white group-hover:text-cyan-300 transition-colors">
        {value}
        <Edit2 size={13} className="inline ml-2 opacity-0 group-hover:opacity-50 transition-opacity" />
      </h1>
    </button>
  )
}

// ── Import Timeline ───────────────────────────────────────────────────────────

const TIMELINE_STEPS: ImportStatus[] = [
  'planning', 'ordered', 'paid', 'production', 'shipped', 'transit', 'customs', 'delivered'
]

function ImportTimeline({ currentStatus, onChangeStatus }: {
  currentStatus: ImportStatus
  onChangeStatus: (s: ImportStatus) => void
}) {
  const currentIdx = TIMELINE_STEPS.indexOf(currentStatus)

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-3">
        Progreso de la operación
      </p>
      <div className="relative flex items-center">
        {/* Connecting line */}
        <div className="absolute left-0 right-0 h-0.5 bg-slate-700 top-4 mx-4" />
        {/* Progress fill */}
        <div
          className="absolute h-0.5 bg-cyan-600 top-4 left-4 transition-all duration-500"
          style={{
            width: currentIdx === 0
              ? '0%'
              : `${(currentIdx / (TIMELINE_STEPS.length - 1)) * (100 - (100 / (TIMELINE_STEPS.length - 1) / 2))}%`
          }}
        />

        {TIMELINE_STEPS.map((step, idx) => {
          const done = idx < currentIdx
          const active = idx === currentIdx
          const color = IMPORT_STATUS_COLORS[step]

          return (
            <button
              key={step}
              onClick={() => onChangeStatus(step)}
              title={IMPORT_STATUS_LABELS[step]}
              className="relative z-10 flex flex-col items-center flex-1 gap-1.5 group"
            >
              {/* Circle */}
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-200',
                  active
                    ? 'border-current shadow-lg shadow-current/30 scale-110'
                    : done
                    ? 'border-current opacity-80'
                    : 'border-slate-600 bg-slate-800 group-hover:border-slate-500'
                )}
                style={
                  done || active
                    ? { borderColor: color, backgroundColor: done ? color + '30' : color + '20' }
                    : {}
                }
              >
                {done ? (
                  <Check size={13} style={{ color }} />
                ) : (
                  <span
                    className="text-[10px] font-bold"
                    style={active ? { color } : { color: '#475569' }}
                  >
                    {idx + 1}
                  </span>
                )}
              </div>

              {/* Label */}
              <span
                className={cn(
                  'text-[9px] text-center leading-tight max-w-[52px] transition-colors',
                  active ? 'font-semibold' : done ? 'opacity-70' : 'text-slate-600 group-hover:text-slate-400'
                )}
                style={active || done ? { color } : {}}
              >
                {IMPORT_STATUS_LABELS[step]}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, action }: {
  icon: React.ElementType
  title: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
        <Icon size={14} className="text-cyan-400" />
        {title}
      </h3>
      {action}
    </div>
  )
}

// ── Items section ─────────────────────────────────────────────────────────────

function ItemsSection({ importId }: { importId: string }) {
  const { data: items = [] } = useComexItems(importId)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    description: '', hs_code: '', quantity: '', unit: 'unidad', unit_price: '', currency: 'USD'
  })

  const handleAdd = async () => {
    if (!form.description.trim()) return
    await window.api.comex.items.create({
      import_id: importId,
      description: form.description,
      hs_code: form.hs_code,
      quantity: Number(form.quantity) || 1,
      unit: form.unit,
      unit_price: Number(form.unit_price) || 0,
      currency: form.currency
    })
    setForm({ description: '', hs_code: '', quantity: '', unit: 'unidad', unit_price: '', currency: 'USD' })
    setAdding(false)
  }

  const total = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <SectionHeader
        icon={Package}
        title="Productos"
        action={
          <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300">
            <Plus size={12} /> Agregar
          </button>
        }
      />

      {items.length === 0 && !adding ? (
        <p className="text-xs text-slate-500">Sin productos cargados aún.</p>
      ) : (
        <div className="space-y-1">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 text-xs py-1.5 border-b border-slate-700/50 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-slate-200 font-medium truncate">{item.description}</p>
                {item.hs_code && <p className="text-slate-500">HS: {item.hs_code}</p>}
              </div>
              <span className="text-slate-400">{item.quantity} {item.unit}</span>
              <span className="text-slate-300">{item.currency} {item.unit_price.toLocaleString('es-AR')}</span>
              <button onClick={() => window.api.comex.items.delete(item.id)} className="text-slate-600 hover:text-red-400 transition-colors">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {items.length > 0 && (
            <div className="flex justify-end pt-1">
              <span className="text-xs text-cyan-400 font-semibold">
                Total: USD {total.toLocaleString('es-AR')}
              </span>
            </div>
          )}
        </div>
      )}

      {adding && (
        <div className="mt-3 p-3 bg-slate-900/50 rounded-lg space-y-2 border border-slate-600">
          <input
            autoFocus
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="Descripción del producto"
            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              value={form.hs_code}
              onChange={(e) => setForm((p) => ({ ...p, hs_code: e.target.value }))}
              placeholder="HS Code"
              className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
            <input
              type="number"
              value={form.quantity}
              onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
              placeholder="Cantidad"
              className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
            <input
              value={form.unit}
              onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
              placeholder="Unidad"
              className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              value={form.unit_price}
              onChange={(e) => setForm((p) => ({ ...p, unit_price: e.target.value }))}
              placeholder="Precio unitario"
              className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
            <select
              value={form.currency}
              onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
              className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setAdding(false)} className="text-xs text-slate-400 hover:text-white px-2 py-1">Cancelar</button>
            <button onClick={handleAdd} className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1 rounded">Agregar</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Documents section ─────────────────────────────────────────────────────────

function DriveBadge({ status }: { status: DriveDocStatus }) {
  if (status === 'synced')    return <Cloud size={11} className="text-emerald-400 shrink-0" title="Sincronizado con Drive" />
  if (status === 'uploading') return <Loader2 size={11} className="text-blue-400 animate-spin shrink-0" title="Subiendo a Drive..." />
  if (status === 'error')     return <AlertCircle size={11} className="text-red-400 shrink-0" title="Error al subir a Drive" />
  return <CloudOff size={11} className="text-slate-600 shrink-0" title="No sincronizado" />
}

const STATUS_CYCLE: Record<DocumentStatus, DocumentStatus> = {
  pending: 'received', received: 'approved', approved: 'pending'
}

const STATUS_COLOR: Record<DocumentStatus, string> = {
  pending:  'text-yellow-400 hover:text-yellow-300',
  received: 'text-blue-400 hover:text-blue-300',
  approved: 'text-emerald-400 hover:text-emerald-300'
}

function DocumentsSection({
  importId, folderId, importTitle
}: {
  importId: string
  folderId: string | null
  importTitle: string
}) {
  const { data: docs = [] } = useComexDocuments(importId)
  const createDoc  = useCreateComexDocument(importId)
  const updateDoc  = useUpdateComexDocument(importId)
  const deleteDoc  = useDeleteComexDocument(importId)
  const uploadDoc  = useUploadComexDocument(importId)
  const uploadNew  = useUploadNewComexDocument(importId)

  // IA
  const { data: aiConfigured } = useAIConfigured()
  const analyzeDoc = useAnalyzeComexDocument()
  const [aiResult, setAiResult] = useState<{ doc: ComexDocument; result: AIAnalysisResult } | null>(null)
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)

  const handleAnalyze = async (doc: ComexDocument) => {
    setAnalyzingId(doc.id)
    try {
      const result = await analyzeDoc.mutateAsync({ docId: doc.id })
      setAiResult({ doc, result })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al analizar el documento')
    } finally {
      setAnalyzingId(null)
    }
  }

  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    type: 'invoice' as DocumentType,
    name: '',
    status: 'pending' as DocumentStatus
  })
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounter = useRef(0)   // counts nested dragenter/dragleave to avoid flicker

  const docTypes = Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]

  // Add metadata-only document
  const handleAdd = () => {
    if (!form.name.trim()) return
    createDoc.mutate({
      import_id: importId,
      type: form.type,
      name: form.name,
      drive_file_id: null,
      status: form.status,
      notes: '',
      received_at: form.status !== 'pending' ? Date.now() : null
    }, {
      onSuccess: () => {
        setForm({ type: 'invoice', name: '', status: 'pending' })
        setAdding(false)
      }
    })
  }

  // Attach / replace file on an existing row
  const handleAttachFile = async (doc: ComexDocument) => {
    const filePath = await window.api.comex.documents.selectFile()
    if (!filePath) return
    uploadDoc.mutate({ docId: doc.id, filePath, folderId, importTitle })
  }

  // Drop a file → auto-create document
  // NOTE: file.path was removed in Electron 32+; use window.api.getPathForFile instead
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const filePath = window.api.getPathForFile(file)
    if (!filePath) return
    uploadNew.mutate({ filePath, folderId, importTitle })
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    setIsDragOver(true)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()   // required to allow drop
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setIsDragOver(false)
  }

  const isUploading = uploadDoc.isPending || uploadNew.isPending

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <SectionHeader
        icon={FileText}
        title="Documentos"
        action={
          <button
            onClick={() => setAdding((v) => !v)}
            className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
          >
            <Plus size={12} /> Agregar
          </button>
        }
      />

      {/* Drag-and-drop zone */}
      <div
        onDrop={handleDrop}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'mb-3 border-2 border-dashed rounded-lg px-3 py-3 flex items-center gap-2 transition-colors cursor-default',
          isDragOver ? 'border-cyan-500 bg-cyan-900/20' : 'border-slate-700 hover:border-slate-500'
        )}
      >
        {isUploading
          ? <Loader2 size={14} className="text-cyan-400 animate-spin shrink-0" />
          : <Upload size={14} className={cn('shrink-0', isDragOver ? 'text-cyan-400' : 'text-slate-500')} />
        }
        <div className="min-w-0 select-none">
          <p className="text-xs text-slate-400">
            {isUploading ? 'Subiendo archivo…' : isDragOver ? 'Soltá el archivo' : 'Arrastrá un archivo aquí'}
          </p>
          <p className="text-[10px] text-slate-600">Crea una entrada nueva con el archivo adjunto</p>
        </div>
      </div>

      {/* Error feedback */}
      {(uploadNew.isError || uploadDoc.isError) && (
        <p className="text-xs text-red-400 mb-2">
          Error al subir el archivo. Revisá que la ruta sea accesible.
        </p>
      )}

      {/* Document rows */}
      {docs.map((doc) => (
        <div key={doc.id} className="flex items-center gap-2 py-2 border-b border-slate-700/50 last:border-0 group">
          <DriveBadge status={doc.drive_status ?? 'none'} />

          <div className="flex-1 min-w-0">
            {doc.local_stored_name ? (
              <button
                onClick={() => window.api.comex.documents.open(doc.id)}
                className="text-xs font-medium text-cyan-400 hover:text-cyan-300 truncate block text-left"
                title={doc.name}
              >
                {doc.name}
              </button>
            ) : (
              <p className="text-xs font-medium text-slate-200 truncate">{doc.name}</p>
            )}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500">{DOCUMENT_TYPE_LABELS[doc.type]}</span>
              {doc.size_bytes != null && (
                <span className="text-[10px] text-slate-600">· {formatBytes(doc.size_bytes)}</span>
              )}
            </div>
          </div>

          {/* Open in Drive */}
          {doc.drive_file_id && (
            <button
              onClick={() => window.api.shell.open(`https://drive.google.com/file/d/${doc.drive_file_id}/view`)}
              title="Ver en Drive"
              className="text-slate-600 hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-all"
            >
              <ExternalLink size={11} />
            </button>
          )}

          {/* Attach / replace file */}
          <button
            onClick={() => handleAttachFile(doc)}
            title={doc.local_stored_name ? 'Reemplazar archivo' : 'Adjuntar archivo'}
            disabled={uploadDoc.isPending}
            className="text-slate-600 hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-30"
          >
            <Paperclip size={11} />
          </button>

          {/* Extraer datos con IA */}
          {aiConfigured && doc.local_stored_name && (
            <button
              onClick={() => handleAnalyze(doc)}
              disabled={analyzingId === doc.id}
              title="Extraer datos con IA"
              className="text-slate-600 hover:text-violet-400 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
            >
              {analyzingId === doc.id
                ? <Loader2 size={11} className="animate-spin text-violet-400" />
                : <Sparkles size={11} />
              }
            </button>
          )}

          {/* Cycle status */}
          <button
            onClick={() => updateDoc.mutate({ id: doc.id, data: { status: STATUS_CYCLE[doc.status] } })}
            className={cn('text-xs font-medium transition-colors shrink-0', STATUS_COLOR[doc.status])}
            title="Click para cambiar estado"
          >
            {DOCUMENT_STATUS_LABELS[doc.status]}
          </button>

          {/* Delete */}
          <button
            onClick={() => deleteDoc.mutate(doc.id)}
            className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
          >
            <Trash2 size={11} />
          </button>
        </div>
      ))}

      {docs.length === 0 && !adding && (
        <p className="text-xs text-slate-500">Sin documentos cargados.</p>
      )}

      {/* Add-without-file form */}
      {adding && (
        <div className="mt-3 p-3 bg-slate-900/50 rounded-lg space-y-2 border border-slate-600">
          <select
            value={form.type}
            onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as DocumentType }))}
            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
          >
            {docTypes.map((t) => <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>)}
          </select>
          <input
            autoFocus
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false) }}
            placeholder="Nombre del documento"
            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
          />
          <select
            value={form.status}
            onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as DocumentStatus }))}
            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="pending">Pendiente</option>
            <option value="received">Recibido</option>
            <option value="approved">Aprobado</option>
          </select>
          <div className="flex justify-end gap-2">
            <button onClick={() => setAdding(false)} className="text-xs text-slate-400 hover:text-white px-2 py-1">Cancelar</button>
            <button
              onClick={handleAdd}
              disabled={createDoc.isPending}
              className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1 rounded disabled:opacity-50"
            >
              Agregar
            </button>
          </div>
        </div>
      )}

      {/* AI Extraction Modal */}
      {aiResult && (
        <AIExtractionModal
          doc={aiResult.doc}
          result={aiResult.result}
          importId={importId}
          onClose={() => setAiResult(null)}
        />
      )}
    </div>
  )
}

// ── CollapsibleSection ────────────────────────────────────────────────────────

type SectionKey = 'costos'|'datos'|'anmat'|'flete_int'|'despacho'|'tributos'|'deposito'|'despachante'|'flete_local'|'productos'|'presupuestos'

const ALL_SECTION_KEYS: SectionKey[] = [
  'costos','datos','anmat','flete_int','despacho','tributos',
  'deposito','despachante','flete_local','productos','presupuestos'
]

function CollapsibleSection({
  label, icon: Icon, accentColor = 'border-slate-700',
  isOpen, onToggle, summary, children
}: {
  label: string
  icon: React.ElementType
  accentColor?: string
  isOpen: boolean
  onToggle: () => void
  summary?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className={cn('bg-slate-800 rounded-xl border-l-4 border border-slate-700 overflow-hidden', accentColor)}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Icon size={14} className="text-slate-400 flex-shrink-0" />
          <span className="text-[11px] font-bold text-white uppercase tracking-wider">{label}</span>
        </div>
        <div className="flex items-center gap-3">
          {!isOpen && summary && (
            <span className="text-[11px] text-slate-500 text-right max-w-[300px] truncate">{summary}</span>
          )}
          <ChevronDown
            size={14}
            className={cn('text-slate-500 transition-transform duration-200 flex-shrink-0', isOpen && 'rotate-180')}
          />
        </div>
      </button>
      {isOpen && (
        <div className="border-t border-slate-700/50">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TRIBUTOS_RECUPERABLES = new Set(['415', '422', '424', '900'])
const esCostoReal = (codigo: string) => !TRIBUTOS_RECUPERABLES.has(codigo.trim())

// ── Cost Dashboard ────────────────────────────────────────────────────────────

function CostDashboard({ importId, imp }: { importId: string; imp: ComexImport }) {
  const qc                      = useQueryClient()
  const { data: customs }       = useComexCustoms(importId)
  const { data: tributos = [] } = useComexTributos(importId)
  const { data: extras = [] }   = useComexExtraCosts(importId)

  const cotiz    = customs?.dolar_aduana ?? 0
  const currency = imp.currency || 'USD'
  const isEur    = currency === 'EUR'

  // TC EUR/USD: usa el guardado en el import, o vacío para que el usuario consulte
  const [tcEurUsd,    setTcEurUsd]    = useState<number>(imp.tc_eur_usd ?? 0)
  const [bnaLoading,  setBnaLoading]  = useState(false)
  const [bnaMsg,      setBnaMsg]      = useState<string | null>(null)
  const [tcEditing,   setTcEditing]   = useState(false)
  const [tcInput,     setTcInput]     = useState(String(imp.tc_eur_usd ?? ''))

  // Sincronizar si el import cambia externamente
  useEffect(() => {
    if (imp.tc_eur_usd && imp.tc_eur_usd !== tcEurUsd) {
      setTcEurUsd(imp.tc_eur_usd)
      setTcInput(String(imp.tc_eur_usd))
    }
  }, [imp.tc_eur_usd])

  const fmt  = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtM = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`

  // ── Base valor factura ────────────────────────────────────────────────────────
  const actualValue = imp.actual_value  // en imp.currency

  const baseARS = (() => {
    if (!actualValue || !cotiz) return null
    if (!isEur) return actualValue * cotiz                     // USD directo
    if (tcEurUsd > 0) return actualValue * tcEurUsd * cotiz   // EUR → USD → ARS
    return null
  })()

  // ── Tributos ──────────────────────────────────────────────────────────────────
  const totalDerechosUSD = tributos.filter(t => esCostoReal(t.codigo)).reduce((s, t) => s + t.importe_usd, 0)
  const totalDerechosARS = cotiz > 0 ? totalDerechosUSD * cotiz : 0

  // ── Extras agrupados y ordenados ──────────────────────────────────────────────
  const DASHBOARD_ORDER = ['flete_internacional','flete_local','despachante','deposito_fiscal','gastos_bancarios','libre_circulacion','otro']
  const totalExtraARS   = extras.reduce((s, c) => s + costToARS(c, cotiz), 0)

  const fleteIntARS  = extras.filter(c => c.categoria === 'flete_internacional').reduce((s, c) => s + costToARS(c, cotiz), 0)
  const fleteLocARS  = extras.filter(c => c.categoria === 'flete_local').reduce((s, c) => s + costToARS(c, cotiz), 0)
  const otrosOrden   = [...extras.filter(c => c.categoria !== 'flete_internacional' && c.categoria !== 'flete_local')]
    .sort((a, b) => (DASHBOARD_ORDER.indexOf(a.categoria) + 99) - (DASHBOARD_ORDER.indexOf(b.categoria) + 99))

  const lineas = [
    ...(fleteIntARS > 0 ? [{ id: '_fi', categoria: 'flete_internacional' as const, concepto: 'Flete internacional', importe: fleteIntARS, moneda: 'ARS' as const, tipo_cambio: null }] : []),
    ...(fleteLocARS > 0 ? [{ id: '_fl', categoria: 'flete_local' as const,         concepto: 'Flete local',         importe: fleteLocARS, moneda: 'ARS' as const, tipo_cambio: null }] : []),
    ...otrosOrden
  ] as ComexImportExtraCost[]

  const totalCostosARS = totalDerechosARS + totalExtraARS
  const pct            = baseARS && baseARS > 0 ? (totalCostosARS / baseARS) * 100 : null
  const barColor       = pct == null ? 'bg-slate-600' : pct < 15 ? 'bg-emerald-500' : pct < 25 ? 'bg-amber-500' : 'bg-red-500'

  if (!actualValue && totalCostosARS === 0) return null

  // ── Auto-guardar cost_pct en el import ────────────────────────────────────────
  const lastSavedPct = useRef<number | null>(null)
  useEffect(() => {
    if (pct == null) return
    const rounded = Math.round(pct * 100) / 100
    if (lastSavedPct.current === rounded) return
    lastSavedPct.current = rounded
    window.api.comex.imports.update(importId, { cost_pct: rounded })
      .then(() => qc.invalidateQueries({ queryKey: ['comex-imports'] }))
      .catch(console.error)
  }, [pct, importId])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Consultar BNA ─────────────────────────────────────────────────────────────
  const handleConsultarBNA = async () => {
    if (!cotiz) { setBnaMsg('Primero cargá el tipo de cambio del despacho.'); return }
    const ofic = customs?.oficializacion_date
    if (!ofic) { setBnaMsg('Sin fecha de oficialización en el despacho.'); return }

    setBnaLoading(true); setBnaMsg(null)
    try {
      const dateStr = dayjs(ofic).format('YYYY-MM-DD')
      const result  = await window.api.bna.getEurUsd(dateStr, cotiz)
      if (!result) { setBnaMsg('No se pudo obtener el TC del BNA. Ingresalo manualmente.'); return }

      const rounded = Math.round(result.eurUsd * 10000) / 10000
      setTcEurUsd(rounded)
      setTcInput(String(rounded))
      setBnaMsg(`EUR/ARS BNA ${dateStr}: $${fmt(result.eurArs)} → EUR/USD: ${rounded.toFixed(4)}`)

      // Guardar en DB
      await window.api.comex.imports.update(importId, { tc_eur_usd: rounded })
      qc.invalidateQueries({ queryKey: ['comex-import', importId] })
    } catch { setBnaMsg('Error al consultar BNA.') }
    finally   { setBnaLoading(false) }
  }

  const handleSaveTc = async () => {
    const val = Number(tcInput.replace(',', '.'))
    if (!val || isNaN(val)) return
    setTcEurUsd(val)
    setTcEditing(false)
    await window.api.comex.imports.update(importId, { tc_eur_usd: val })
    qc.invalidateQueries({ queryKey: ['comex-import', importId] })
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-700/40 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <DollarSign size={14} className="text-cyan-400" />
          <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Resumen de costos</span>
        </div>
        {pct != null && (
          <span className={cn('text-sm font-bold', pct < 15 ? 'text-emerald-400' : pct < 25 ? 'text-amber-400' : 'text-red-400')}>
            {pct.toFixed(1)}% sobre valor factura
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Barra */}
        {pct != null && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Costo importación / valor factura</span>
              <span className="font-semibold">{pct.toFixed(2)}%</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full transition-all duration-700', barColor)}
                style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
          </div>
        )}

        {/* ── Base valor factura ── */}
        <div className="space-y-2 pb-2 border-b border-slate-700/50">
          {/* Fila principal */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-400 font-medium">Base valor factura</p>
              {actualValue != null && cotiz > 0 && (
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {!isEur
                    ? `${currency} ${fmt(actualValue)} × $${fmt(cotiz)}`
                    : tcEurUsd > 0
                      ? `EUR ${fmt(actualValue)} × ${tcEurUsd.toFixed(4)} USD × $${fmt(cotiz)}`
                      : `EUR ${fmt(actualValue)} — falta TC EUR/USD`
                  }
                </p>
              )}
            </div>
            <span className="font-semibold text-slate-200 flex-shrink-0">
              {baseARS != null ? fmtM(baseARS) : '—'}
            </span>
          </div>

          {/* Panel EUR/USD — solo si la factura es en EUR */}
          {isEur && (
            <div className="bg-amber-950/20 border border-amber-800/30 rounded-lg px-3 py-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] text-amber-400 font-medium">TC EUR/USD (BNA fecha oficialización)</span>
                <div className="flex items-center gap-1.5">
                  {tcEditing ? (
                    <>
                      <input
                        autoFocus
                        value={tcInput}
                        onChange={e => setTcInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveTc(); if (e.key === 'Escape') setTcEditing(false) }}
                        placeholder="1.1836"
                        className="w-20 bg-slate-800 border border-amber-600 rounded px-2 py-1 text-xs text-white focus:outline-none"
                      />
                      <button onClick={handleSaveTc} className="p-1 rounded bg-amber-600 hover:bg-amber-500 text-white"><Check size={12} /></button>
                      <button onClick={() => setTcEditing(false)} className="p-1 rounded bg-slate-700 text-slate-400"><X size={12} /></button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-mono text-amber-300">
                        {tcEurUsd > 0 ? tcEurUsd.toFixed(4) : 'Sin definir'}
                      </span>
                      <button onClick={() => setTcEditing(true)}
                        className="p-1 rounded text-slate-500 hover:text-amber-400 hover:bg-slate-700 transition-colors">
                        <Edit2 size={11} />
                      </button>
                    </>
                  )}
                  <button
                    onClick={handleConsultarBNA}
                    disabled={bnaLoading}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-amber-700 hover:bg-amber-600 text-white disabled:opacity-50 transition-colors"
                  >
                    {bnaLoading ? <Loader2 size={11} className="animate-spin" /> : '🌐'}
                    {bnaLoading ? 'Consultando...' : 'Consultar BNA'}
                  </button>
                </div>
              </div>
              {bnaMsg && (
                <p className="text-[10px] text-amber-500">{bnaMsg}</p>
              )}
              {tcEurUsd > 0 && actualValue != null && cotiz > 0 && (
                <p className="text-[10px] text-slate-500">
                  EUR {fmt(actualValue)} × {tcEurUsd.toFixed(4)} = USD {fmt(actualValue * tcEurUsd)} · × ${fmt(cotiz)} = {fmtM(actualValue * tcEurUsd * cotiz)} ARS
                </p>
              )}
            </div>
          )}
        </div>

        {/* Desglose costos */}
        <div className="space-y-1">
          {totalDerechosARS > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Derechos, tasas y aranceles</span>
              <div className="flex items-center gap-3">
                {baseARS && <span className="text-slate-600 w-12 text-right">{((totalDerechosARS / baseARS) * 100).toFixed(1)}%</span>}
                <span className="text-amber-300 w-28 text-right">{fmtM(totalDerechosARS)}</span>
              </div>
            </div>
          )}
          {lineas.map(c => {
            const ars = costToARS(c, cotiz)
            return (
              <div key={c.id} className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{EXTRA_COST_CATEGORY_LABELS[c.categoria]}</span>
                <div className="flex items-center gap-3">
                  {baseARS && <span className="text-slate-600 w-12 text-right">{((ars / baseARS) * 100).toFixed(1)}%</span>}
                  <span className="text-slate-300 w-28 text-right">{fmtM(ars)}</span>
                </div>
              </div>
            )
          })}
          {totalCostosARS > 0 && (
            <div className="flex items-center justify-between text-xs pt-2 mt-1 border-t border-slate-700/50">
              <span className="font-semibold text-slate-200">Total costos</span>
              <div className="flex items-center gap-3">
                {baseARS && pct != null && (
                  <span className={cn('font-semibold w-12 text-right', pct < 15 ? 'text-emerald-400' : pct < 25 ? 'text-amber-400' : 'text-red-400')}>
                    {pct.toFixed(1)}%
                  </span>
                )}
                <span className="font-bold text-slate-100 w-28 text-right">{fmtM(totalCostosARS)}</span>
              </div>
            </div>
          )}
        </div>

        {tributos.some(t => !esCostoReal(t.codigo)) && (
          <p className="text-[10px] text-slate-600 italic border-t border-slate-700/30 pt-2">
            IVA, Ganancias e Ingresos Brutos no incluidos (créditos fiscales recuperables)
          </p>
        )}
      </div>
    </div>
  )
}

// ── Extra costs section ───────────────────────────────────────────────────────

function ExtraCostRow({
  cost, importId, cotiz
}: {
  cost: ComexImportExtraCost
  importId: string
  cotiz: number
}) {
  const update      = useUpdateComexExtraCost()
  const del         = useDeleteComexExtraCost()
  const uploadInv   = useUploadExtraCostInvoice()
  const analyzeInv  = useAnalyzeExtraCost()
  const { data: aiConfigured } = useAIConfigured()

  const [editing,       setEditing]       = useState(false)
  const [confirm,       setConfirm]       = useState(false)
  const [analyzingAI,   setAnalyzingAI]   = useState(false)
  const [facturaResult, setFacturaResult] = useState<import('@shared/types').ExtractedFacturaLocal | null>(null)
  const [applying,      setApplying]      = useState(false)

  const [form, setForm] = useState({
    concepto:    cost.concepto,
    proveedor:   cost.proveedor,
    nro_factura: cost.nro_factura,
    importe:     String(cost.importe),
    moneda:      cost.moneda as 'ARS' | 'USD'
  })

  const arsAmt = cost.moneda === 'USD' && cotiz > 0 ? cost.importe * cotiz : cost.importe
  const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtInt = (n: number) => Math.round(n).toLocaleString('es-AR')

  const handleSave = async () => {
    await update.mutateAsync({
      id: cost.id, importId,
      data: {
        concepto:    form.concepto.trim(),
        proveedor:   form.proveedor.trim(),
        nro_factura: form.nro_factura.trim(),
        importe:     Number(form.importe) || 0,
        moneda:      form.moneda
      }
    })
    setEditing(false)
  }

  const handleUpload = async () => {
    const fp = await window.api.comex.extraCosts.selectFile()
    if (!fp) return
    uploadInv.mutate({ costId: cost.id, filePath: fp, importId })
  }

  const handleAnalyzeAI = async () => {
    setAnalyzingAI(true)
    try {
      const result = await analyzeInv.mutateAsync(cost.id)
      const d = result.structured as import('@shared/types').ExtractedFacturaLocal
      if (d) setFacturaResult(d)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al analizar')
    } finally {
      setAnalyzingAI(false)
    }
  }

  const handleApplyFactura = async () => {
    if (!facturaResult) return
    setApplying(true)
    try {
      const d = facturaResult
      const newData: Partial<ComexImportExtraCost> = {}
      if (d.proveedor)   newData.proveedor   = d.proveedor
      if (d.nro_factura) newData.nro_factura = d.nro_factura
      if (d.moneda)      newData.moneda      = d.moneda as 'ARS' | 'USD'
      // Usar NETO GRAVADO como costo (IVA es recuperable)
      if (d.importe_neto != null) newData.importe = d.importe_neto
      if (d.concepto && !newData.concepto) newData.concepto = d.concepto
      if (Object.keys(newData).length > 0) {
        await update.mutateAsync({ id: cost.id, importId, data: newData })
      }
      setFacturaResult(null)
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="border border-slate-700/50 rounded-lg p-3 space-y-2 group">
      <div className="flex items-start gap-3">
        {/* Label categoría */}
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider w-28 flex-shrink-0 mt-0.5">
          {EXTRA_COST_CATEGORY_LABELS[cost.categoria]}
        </span>

        {/* Datos del costo */}
        {editing ? (
          <div className="flex-1 grid grid-cols-2 gap-2">
            <input value={form.concepto} onChange={e => setForm(p => ({ ...p, concepto: e.target.value }))}
              placeholder="Concepto"
              className="col-span-2 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500" />
            <input value={form.proveedor} onChange={e => setForm(p => ({ ...p, proveedor: e.target.value }))}
              placeholder="Proveedor / emisor"
              className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500" />
            <input value={form.nro_factura} onChange={e => setForm(p => ({ ...p, nro_factura: e.target.value }))}
              placeholder="N° factura"
              className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500" />
            <div className="flex gap-1">
              <input type="number" value={form.importe} onChange={e => setForm(p => ({ ...p, importe: e.target.value }))}
                placeholder="Importe" step="0.01"
                className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500" />
              <select value={form.moneda} onChange={e => setForm(p => ({ ...p, moneda: e.target.value as 'ARS' | 'USD' }))}
                className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500">
                <option>ARS</option>
                <option>USD</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} className="flex items-center gap-1 px-2 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs">
                <Check size={11} /> Guardar
              </button>
              <button onClick={() => setEditing(false)} className="px-2 py-1 rounded bg-slate-700 text-slate-400 text-xs">Cancelar</button>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-slate-200 truncate">
                  {cost.concepto || EXTRA_COST_CATEGORY_LABELS[cost.categoria]}
                </p>
                {cost.proveedor && <p className="text-[11px] text-slate-500">{cost.proveedor}{cost.nro_factura && ` · ${cost.nro_factura}`}</p>}
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-sm font-semibold text-slate-200">
                  {cost.moneda === 'USD' ? `USD ${fmt(cost.importe)}` : `$${fmt(cost.importe)}`}
                </p>
                {cost.moneda === 'USD' && cotiz > 0 && (
                  <p className="text-[10px] text-slate-500">${fmt(arsAmt)} ARS</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Acciones */}
        {!editing && (
          <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Factura adjunta */}
            {cost.stored_name ? (
              <>
                <button onClick={() => window.api.comex.extraCosts.openFile(cost.id)}
                  title="Abrir factura" className="p-1 rounded text-slate-500 hover:text-cyan-400 hover:bg-slate-700">
                  <FolderOpen size={12} />
                </button>
                {cost.drive_file_id && (
                  <button onClick={() => window.api.shell.open(`https://drive.google.com/file/d/${cost.drive_file_id}/view`)}
                    title="Ver en Drive" className="p-1 rounded text-slate-500 hover:text-cyan-400 hover:bg-slate-700">
                    <ExternalLink size={12} />
                  </button>
                )}
                {aiConfigured && (
                  <button onClick={handleAnalyzeAI} disabled={analyzingAI}
                    title="Extraer datos con IA" className="p-1 rounded text-slate-500 hover:text-violet-400 hover:bg-slate-700 disabled:opacity-50">
                    {analyzingAI ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  </button>
                )}
              </>
            ) : (
              <button onClick={handleUpload} disabled={uploadInv.isPending}
                title="Subir factura" className="p-1 rounded text-slate-500 hover:text-cyan-400 hover:bg-slate-700">
                {uploadInv.isPending ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
              </button>
            )}
            <button onClick={() => setEditing(true)}
              className="p-1 rounded text-slate-500 hover:text-cyan-400 hover:bg-slate-700"><Edit2 size={12} /></button>
            {confirm ? (
              <>
                <button onClick={() => del.mutate({ id: cost.id, importId })} className="p-1 rounded bg-red-600 hover:bg-red-500 text-white"><Check size={11} /></button>
                <button onClick={() => setConfirm(false)} className="p-1 rounded bg-slate-700 text-slate-400"><X size={11} /></button>
              </>
            ) : (
              <button onClick={() => setConfirm(true)} className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700"><Trash2 size={12} /></button>
            )}
          </div>
        )}
      </div>

      {/* Drive status */}
      {cost.stored_name && (
        <div className="flex items-center gap-1.5 pl-[7.5rem]">
          <FileText size={10} className="text-slate-600" />
          <span className="text-[10px] text-slate-600 truncate">{cost.original_name}</span>
          {cost.drive_status === 'synced'    && <Cloud size={10} className="text-emerald-500 flex-shrink-0" />}
          {cost.drive_status === 'uploading' && <Loader2 size={10} className="text-blue-400 animate-spin flex-shrink-0" />}
          {cost.drive_status === 'error'     && <AlertCircle size={10} className="text-red-400 flex-shrink-0" />}
        </div>
      )}

      {/* Panel resultado IA */}
      {facturaResult && (() => {
        const mon   = facturaResult.moneda ?? 'ARS'
        const tc    = facturaResult.tipo_cambio_consignado ?? null
        const esFx  = mon !== 'ARS'
        const fmt2  = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        const fmtM  = (n: number) => esFx ? `${mon} ${fmt2(n)}` : `$${fmt2(n)}`
        const arsEq = (n: number) => tc ? ` = $${Math.round(n * tc).toLocaleString('es-AR')} ARS` : ''
        const netoLabel = facturaResult.importe_neto != null
          ? `${fmtM(facturaResult.importe_neto)}${arsEq(facturaResult.importe_neto)}`
          : '—'

        return (
          <div className="mt-2 rounded-lg border border-violet-700/40 bg-violet-950/20 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-violet-900/20 border-b border-violet-700/30">
              <div className="flex items-center gap-2">
                <Bot size={12} className="text-violet-400" />
                <span className="text-[11px] font-semibold text-violet-300">Factura extraída por IA</span>
                {esFx && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-900/50 text-amber-400 font-medium">{mon}</span>}
              </div>
              <button onClick={() => setFacturaResult(null)} className="text-slate-500 hover:text-slate-300"><X size={12} /></button>
            </div>
            <div className="px-3 py-2 space-y-2">
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
                {facturaResult.proveedor   && <><span className="text-slate-500">Proveedor</span><span className="text-slate-200 font-medium">{facturaResult.proveedor}</span></>}
                {facturaResult.nro_factura && <><span className="text-slate-500">N° Factura</span><span className="text-slate-200">{facturaResult.tipo_factura} {facturaResult.nro_factura}</span></>}
                {facturaResult.fecha       && <><span className="text-slate-500">Fecha</span><span className="text-slate-200">{formatFieldValue(facturaResult.fecha)}</span></>}
                {facturaResult.cae         && <><span className="text-slate-500">CAE N°</span><span className="text-slate-200">{facturaResult.cae}</span></>}
                {esFx && tc && <><span className="text-slate-500">TC consignado</span><span className="text-amber-400 font-medium">${fmt2(tc)} / {mon}</span></>}
                {facturaResult.referencia_despacho && <><span className="text-slate-500">Despacho ref.</span><span className="text-cyan-400 font-medium">{facturaResult.referencia_despacho}</span></>}
                {facturaResult.bl_referencia && <><span className="text-slate-500">BL / Ref</span><span className="text-cyan-400">{facturaResult.bl_referencia}</span></>}
              </div>
              {facturaResult.items && facturaResult.items.length > 0 && (
                <div className="border-t border-violet-800/30 pt-2 space-y-0.5">
                  {facturaResult.items.map((item, i) => (
                    <div key={i} className="flex justify-between gap-3 text-[11px]">
                      <span className="text-slate-400 flex-1 leading-tight">{item.concepto}</span>
                      <span className="text-slate-300 flex-shrink-0">{fmtM(item.importe)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="border-t border-violet-700/30 pt-2 space-y-1.5">
                {facturaResult.importe_neto != null && (
                  <div className="space-y-0.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-emerald-400 font-semibold">Neto gravado (costo real)</span>
                      <span className="text-emerald-300 font-bold">{fmtM(facturaResult.importe_neto)}</span>
                    </div>
                    {esFx && tc && <div className="flex justify-end text-[10px] text-emerald-600">= ${Math.round(facturaResult.importe_neto * tc).toLocaleString('es-AR')} ARS</div>}
                  </div>
                )}
                {facturaResult.iva != null && facturaResult.iva > 0 && (
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">IVA (recuperable)</span>
                    <span className="text-slate-400">{fmtM(facturaResult.iva)}</span>
                  </div>
                )}
                {facturaResult.importe_total != null && (
                  <div className="space-y-0.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Total factura</span>
                      <span className="text-slate-300">{fmtM(facturaResult.importe_total)}</span>
                    </div>
                    {esFx && tc && <div className="flex justify-end text-[10px] text-slate-600">= ${Math.round(facturaResult.importe_total * tc).toLocaleString('es-AR')} ARS</div>}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-1 border-t border-violet-800/30">
                <button onClick={() => setFacturaResult(null)} className="px-2.5 py-1 rounded text-[11px] text-slate-400 hover:text-white transition-colors">Descartar</button>
                <button onClick={handleApplyFactura} disabled={applying}
                  className="flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-medium bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 transition-colors">
                  {applying
                    ? <><Loader2 size={11} className="animate-spin" /> Aplicando...</>
                    : <><Check size={11} /> Aplicar {netoLabel}</>
                  }
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ── Fixed Cost Section (Despachante / Flete / Depósito) ──────────────────────

function FixedCostSection({ cost, importId }: { cost: ComexImportExtraCost; importId: string }) {
  const uploadInv    = useUploadExtraCostInvoice()
  const updateCost   = useUpdateComexExtraCost()
  const deleteCost   = useDeleteComexExtraCost()
  const analyzeInv   = useAnalyzeExtraCost()
  const { data: customs }      = useComexCustoms(importId)
  const { data: aiConfigured } = useAIConfigured()

  // Estado local para reflejo inmediato sin esperar el refetch de la query
  const [localCost,     setLocalCost]     = useState<ComexImportExtraCost>(cost)
  const [aiResult,      setAiResult]      = useState<import('@shared/types').ExtractedFacturaLocal | null>(null)
  const [analyzing,     setAnalyzing]     = useState(false)
  const [applying,      setApplying]      = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDragOver,    setIsDragOver]    = useState(false)
  const dragCounter = useRef(0)

  // Sincronizar cuando la prop externa se actualiza (ej: upload cambia drive_status)
  useEffect(() => { setLocalCost(cost) }, [cost])

  const hasFile  = !!localCost.stored_name
  const label    = EXTRA_COST_CATEGORY_LABELS[localCost.categoria]
  const fmtInt   = (n: number) => Math.round(n).toLocaleString('es-AR')

  const handleUpload = (filePath: string) =>
    uploadInv.mutate({ costId: cost.id, filePath, importId })

  const handleSelectFile = async () => {
    const fp = await window.api.comex.extraCosts.selectFile()
    if (fp) handleUpload(fp)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); dragCounter.current = 0; setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const fp = window.api.getPathForFile(file)
    if (fp) handleUpload(fp)
  }

  const handleAnalyze = async () => {
    setAnalyzing(true)
    try {
      const result = await analyzeInv.mutateAsync(cost.id)
      const d = result.structured as import('@shared/types').ExtractedFacturaLocal
      if (d) setAiResult(d)
    } catch (err) { alert(err instanceof Error ? err.message : 'Error al analizar') }
    finally { setAnalyzing(false) }
  }

  const handleApply = async () => {
    if (!aiResult) return
    setApplying(true)
    try {
      const patch: Partial<ComexImportExtraCost> = {}
      // Campos básicos
      if (aiResult.proveedor)             patch.proveedor            = aiResult.proveedor
      if (aiResult.nro_factura)           patch.nro_factura          = aiResult.nro_factura
      if (aiResult.moneda)                patch.moneda               = aiResult.moneda as 'ARS' | 'USD'
      if (aiResult.importe_neto != null)  patch.importe              = aiResult.importe_neto
      if (aiResult.fecha)                          patch.fecha_factura        = dayjs(aiResult.fecha).valueOf()
      // Campos adicionales de factura
      if (aiResult.cae)                            patch.cae                  = aiResult.cae
      if (aiResult.referencia_despacho)            patch.referencia_despacho  = aiResult.referencia_despacho
      if (aiResult.iva != null)                    patch.importe_iva          = aiResult.iva
      if (aiResult.importe_total != null)          patch.importe_total        = aiResult.importe_total
      if (aiResult.items?.length)                  patch.items_json           = JSON.stringify(aiResult.items)
      // Campos de flete
      // Campos de flete y depósito
      const fxResult = aiResult as import('@shared/types').ExtractedFacturaLocal
      if (fxResult.tipo_cambio_consignado != null) patch.tipo_cambio    = fxResult.tipo_cambio_consignado
      if (fxResult.bl_referencia)                  patch.bl_referencia  = fxResult.bl_referencia
      if (fxResult.importe_ars != null)            patch.importe_ars    = fxResult.importe_ars
      if (fxResult.percepciones != null)    patch.percepciones    = fxResult.percepciones
      if (fxResult.percepcion_caba != null) patch.percepcion_caba = fxResult.percepcion_caba
      if (fxResult.percepcion_bsas != null) patch.percepcion_bsas = fxResult.percepcion_bsas
      if (fxResult.fecha_ingreso)                  patch.fecha_ingreso  = fxResult.fecha_ingreso
      if (fxResult.fecha_egreso)                   patch.fecha_egreso   = fxResult.fecha_egreso
      if (fxResult.nro_contenedor)                 patch.nro_contenedor = fxResult.nro_contenedor
      if (fxResult.canal_deposito)                 patch.canal_deposito = fxResult.canal_deposito

      // Actualizar pantalla inmediatamente
      setLocalCost(prev => ({ ...prev, ...patch }))
      setAiResult(null)

      // Persistir en DB
      if (Object.keys(patch).length) {
        updateCost.mutateAsync({ id: localCost.id, importId, data: patch }).catch(console.error)
      }
    } finally { setApplying(false) }
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-700/20 border-b border-slate-700/50">
        <div className="flex items-center gap-2 flex-wrap">
          <FileText size={14} className="text-slate-400" />
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">{label}</h3>
          {hasFile && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 font-medium">
              Factura adjunta
            </span>
          )}
          {localCost.importe > 0 && (
            <span className="text-xs font-semibold text-white">
              ${fmtInt(localCost.importe)}
            </span>
          )}
          {localCost.proveedor && (
            <span className="text-[11px] text-slate-400 italic">{localCost.proveedor}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {localCost.drive_status === 'synced'    && <span className="flex items-center gap-1 text-[10px] text-emerald-400"><Cloud size={11} /> En Drive</span>}
          {localCost.drive_status === 'uploading' && <span className="flex items-center gap-1 text-[10px] text-blue-400"><Loader2 size={11} className="animate-spin" /> Subiendo...</span>}
          {localCost.drive_status === 'error'     && <span className="flex items-center gap-1 text-[10px] text-red-400"><AlertCircle size={11} /> Error Drive</span>}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {!hasFile ? (
          /* ── Sin factura: zona de drop ── */
          <div
            onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setIsDragOver(true) }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={() => { dragCounter.current--; if (dragCounter.current === 0) setIsDragOver(false) }}
            onDrop={handleDrop}
            onClick={handleSelectFile}
            className={cn(
              'border-2 border-dashed rounded-xl px-4 py-5 flex flex-col items-center gap-2 transition-colors cursor-pointer',
              isDragOver
                ? 'border-slate-400 bg-slate-700/30'
                : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/20'
            )}
          >
            {uploadInv.isPending
              ? <Loader2 size={22} className="text-slate-400 animate-spin" />
              : <Upload size={22} className={isDragOver ? 'text-slate-300' : 'text-slate-500'} />
            }
            <div className="text-center">
              <p className="text-sm text-slate-300">
                {uploadInv.isPending ? 'Subiendo factura...' : `Subir factura de ${label.toLowerCase()}`}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Arrastrá el PDF o hacé click para seleccionar
              </p>
            </div>
          </div>
        ) : (
          /* ── Con factura: fila del archivo + acciones ── */
          <div className="space-y-3">
            <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-900/60 rounded-lg border border-slate-700">
              <FileText size={15} className="text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">
                  {localCost.original_name ?? 'Factura adjunta'}
                </p>
                {(localCost.proveedor || localCost.nro_factura) && (
                  <p className="text-[10px] text-slate-400">
                    {localCost.proveedor}{localCost.nro_factura ? ` · ${localCost.nro_factura}` : ''}
                  </p>
                )}
              </div>
              {localCost.drive_file_id && (
                <button
                  onClick={() => window.api.shell.open(`https://drive.google.com/file/d/${localCost.drive_file_id}/view`)}
                  title="Ver en Drive" className="p-1.5 rounded text-slate-500 hover:text-cyan-400 hover:bg-slate-700 transition-colors">
                  <ExternalLink size={13} />
                </button>
              )}
              <button onClick={() => window.api.comex.extraCosts.openFile(localCost.id)}
                title="Abrir PDF" className="p-1.5 rounded text-slate-500 hover:text-cyan-400 hover:bg-slate-700 transition-colors">
                <FolderOpen size={13} />
              </button>
              <button onClick={handleSelectFile} disabled={uploadInv.isPending}
                title="Reemplazar" className="p-1.5 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-40">
                <Upload size={13} />
              </button>
              {confirmDelete ? (
                <>
                  <button onClick={() => { deleteCost.mutate({ id: localCost.id, importId }); setConfirmDelete(false) }}
                    className="p-1.5 rounded bg-red-600 hover:bg-red-500 text-white transition-colors">
                    <Check size={13} />
                  </button>
                  <button onClick={() => setConfirmDelete(false)}
                    className="p-1.5 rounded bg-slate-700 text-slate-400 transition-colors">
                    <X size={13} />
                  </button>
                </>
              ) : (
                <button onClick={() => setConfirmDelete(true)}
                  title="Eliminar" className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors">
                  <Trash2 size={13} />
                </button>
              )}
            </div>

            {/* Datos guardados de la factura */}
            {(localCost.proveedor || localCost.nro_factura || localCost.importe > 0 || localCost.items_json) && (() => {
              const items: Array<{ concepto: string; importe: number }> =
                localCost.items_json ? JSON.parse(localCost.items_json) : []
              const fmt2 = (n: number) => Math.round(n).toLocaleString('es-AR')

              // Verificación de correspondencia con el despacho
              const refNorm = localCost.referencia_despacho?.replace(/[\s\-_]/g, '').toUpperCase() ?? ''
              const despNorm = (customs?.despacho_number ?? '').replace(/[\s\-_]/g, '').toUpperCase()
              const despachoOk    = refNorm && despNorm && refNorm === despNorm
              const despachoWrong = refNorm && despNorm && refNorm !== despNorm
              const despachoNone  = refNorm && !despNorm

              return (
                <div className="rounded-lg bg-slate-900/50 border border-slate-700/50 overflow-hidden">
                  {/* Cabecera de la factura */}
                  <div className="px-3 py-2 space-y-0.5">
                    {localCost.proveedor && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Proveedor</span>
                        <span className="text-slate-200 font-medium text-right">{localCost.proveedor}</span>
                      </div>
                    )}
                    {localCost.nro_factura && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">N° Factura</span>
                        <span className="text-slate-300">{localCost.nro_factura}</span>
                      </div>
                    )}
                    {localCost.fecha_factura && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Fecha</span>
                        <span className="text-slate-300">{dayjs(localCost.fecha_factura).format('DD/MM/YYYY')}</span>
                      </div>
                    )}
                    {localCost.cae && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">CAE N°</span>
                        <span className="text-slate-400 text-right">{localCost.cae}</span>
                      </div>
                    )}

                    {/* Campos de depósito fiscal */}
                    {localCost.canal_deposito && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Canal</span>
                        <span className="text-slate-300">{localCost.canal_deposito}</span>
                      </div>
                    )}
                    {localCost.fecha_ingreso && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Ingreso</span>
                        <span className="text-slate-300">{localCost.fecha_ingreso}</span>
                      </div>
                    )}
                    {localCost.fecha_egreso && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Egreso</span>
                        <span className="text-slate-300">{localCost.fecha_egreso}</span>
                      </div>
                    )}
                    {localCost.nro_contenedor && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Contenedor</span>
                        <span className="text-slate-300 font-mono text-[10px]">{localCost.nro_contenedor}</span>
                      </div>
                    )}

                    {/* Verificación despacho */}
                    {localCost.referencia_despacho && (
                      <div className="flex items-center justify-between text-xs mt-0.5">
                        <span className="text-slate-500">Despacho ref.</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-cyan-400 font-medium">{localCost.referencia_despacho}</span>
                          {despachoOk    && <span className="text-[10px] text-emerald-400 font-medium">✓ Coincide</span>}
                          {despachoWrong && <span className="text-[10px] text-red-400 font-medium">✗ No coincide con {customs?.despacho_number}</span>}
                          {despachoNone  && <span className="text-[10px] text-amber-400">Sin despacho cargado</span>}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Ítems */}
                  {items.length > 0 && (
                    <div className="border-t border-slate-700/40 px-3 py-2 space-y-0.5">
                      {items.map((item, i) => (
                        <div key={i} className="flex justify-between text-[11px]">
                          <span className="text-slate-400 flex-1 truncate pr-2">{item.concepto}</span>
                          <span className="text-slate-300 flex-shrink-0">${fmt2(item.importe)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Totales */}
                  {(localCost.importe > 0 || localCost.importe_iva != null) && (
                    <div className="border-t border-slate-700/40 px-3 py-2 space-y-0.5">
                      {localCost.importe > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-emerald-400 font-semibold">Neto gravado (costo real)</span>
                          <span className="text-emerald-300 font-bold">${fmt2(localCost.importe)}</span>
                        </div>
                      )}
                      {localCost.importe_iva != null && localCost.importe_iva > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">IVA (recuperable)</span>
                          <span className="text-slate-400">${fmt2(localCost.importe_iva)}</span>
                        </div>
                      )}
                      {localCost.percepcion_caba != null && localCost.percepcion_caba > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Percep. IIBB CABA</span>
                          <span className="text-slate-400">${fmt2(localCost.percepcion_caba)}</span>
                        </div>
                      )}
                      {localCost.percepcion_bsas != null && localCost.percepcion_bsas > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Percep. IIBB BS AS</span>
                          <span className="text-slate-400">${fmt2(localCost.percepcion_bsas)}</span>
                        </div>
                      )}
                      {/* Otras percepciones no identificadas */}
                      {localCost.percepciones != null && localCost.percepciones > 0 &&
                       (localCost.percepcion_caba ?? 0) + (localCost.percepcion_bsas ?? 0) < localCost.percepciones - 0.01 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Otras percepciones</span>
                          <span className="text-slate-400">${fmt2(localCost.percepciones - (localCost.percepcion_caba ?? 0) - (localCost.percepcion_bsas ?? 0))}</span>
                        </div>
                      )}
                      {localCost.importe_total != null && (
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Total factura</span>
                          <span className="text-slate-300">${fmt2(localCost.importe_total)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Advertencia si el despacho no coincide */}
            {(() => {
              const refNorm  = localCost.referencia_despacho?.replace(/[\s\-_]/g, '').toUpperCase() ?? ''
              const despNorm = (customs?.despacho_number ?? '').replace(/[\s\-_]/g, '').toUpperCase()
              if (refNorm && despNorm && refNorm !== despNorm) {
                return (
                  <div className="flex items-start gap-2 px-3 py-2 bg-red-900/20 border border-red-700/40 rounded-lg text-xs text-red-300">
                    <AlertCircle size={14} className="flex-shrink-0 mt-0.5 text-red-400" />
                    <div>
                      <p className="font-semibold">La factura no corresponde a este despacho</p>
                      <p className="text-red-400 mt-0.5">
                        Factura ref.: <span className="font-mono">{localCost.referencia_despacho}</span>
                        {' '}— Despacho cargado: <span className="font-mono">{customs?.despacho_number}</span>
                      </p>
                    </div>
                  </div>
                )
              }
              return null
            })()}

            {/* Botón IA */}
            {aiConfigured && (
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors',
                  analyzing
                    ? 'bg-violet-800/50 text-violet-300 cursor-wait'
                    : 'bg-violet-700 hover:bg-violet-600 text-white'
                )}
              >
                {analyzing
                  ? <><Loader2 size={15} className="animate-spin" /> Analizando con Claude...</>
                  : <><Sparkles size={15} /> {localCost.importe > 0 ? 'Reanalizar factura' : 'Extraer datos con IA'}</>
                }
              </button>
            )}
          </div>
        )}

        {/* Panel de resultados IA */}
        {aiResult && (() => {
          const mon = aiResult.moneda ?? 'ARS'
          const tc  = (aiResult as import('@shared/types').ExtractedFacturaLocal).tipo_cambio_consignado ?? null
          const esFx = mon !== 'ARS'
          const fmt2 = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          const fmtMonto  = (n: number) => esFx ? `${mon} ${fmt2(n)}` : `$${fmt2(n)}`
          const arsEquiv  = (n: number) => tc ? ` = $${Math.round(n * tc).toLocaleString('es-AR')} ARS` : ''
          const netoLabel = aiResult.importe_neto != null
            ? `${fmtMonto(aiResult.importe_neto)}${arsEquiv(aiResult.importe_neto)}`
            : '—'

          return (
            <div className="rounded-lg border border-violet-700/40 bg-violet-950/20 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-violet-900/20 border-b border-violet-700/30">
                <div className="flex items-center gap-2">
                  <Bot size={12} className="text-violet-400" />
                  <span className="text-[11px] font-semibold text-violet-300">Factura extraída por IA</span>
                  {esFx && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-900/50 text-amber-400 font-medium">
                      {mon}
                    </span>
                  )}
                </div>
                <button onClick={() => setAiResult(null)} className="text-slate-500 hover:text-slate-300"><X size={12} /></button>
              </div>
              <div className="px-3 py-2.5 space-y-2">
                {/* Datos generales */}
                {(() => {
                  const fx = aiResult as import('@shared/types').ExtractedFacturaLocal
                  return (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
                      {aiResult.proveedor   && <><span className="text-slate-500">Proveedor</span><span className="text-slate-200 font-medium">{aiResult.proveedor}</span></>}
                      {aiResult.nro_factura && <><span className="text-slate-500">N° Factura</span><span className="text-slate-200">{aiResult.tipo_factura} {aiResult.nro_factura}</span></>}
                      {aiResult.fecha       && <><span className="text-slate-500">Fecha</span><span className="text-slate-200">{formatFieldValue(aiResult.fecha)}</span></>}
                      {esFx && tc           && <><span className="text-slate-500">TC consignado</span><span className="text-amber-400 font-medium">${fmt2(tc)} / {mon}</span></>}
                      {fx.bl_referencia     && <><span className="text-slate-500">BL</span><span className="text-cyan-400">{fx.bl_referencia}</span></>}
                      {aiResult.referencia_despacho && (
                        <>
                          <span className="text-slate-500">Despacho ref.</span>
                          <span className="text-cyan-400 font-medium">{aiResult.referencia_despacho}</span>
                        </>
                      )}
                      {/* Campos específicos de depósito */}
                      {fx.canal_deposito && <><span className="text-slate-500">Canal</span><span className="text-slate-300">{fx.canal_deposito}</span></>}
                      {fx.fecha_ingreso  && <><span className="text-slate-500">Ingreso</span><span className="text-slate-300">{formatFieldValue(fx.fecha_ingreso)}</span></>}
                      {fx.fecha_egreso   && <><span className="text-slate-500">Egreso</span><span className="text-slate-300">{formatFieldValue(fx.fecha_egreso)}</span></>}
                      {fx.nro_contenedor && <><span className="text-slate-500">Contenedor</span><span className="text-slate-300 font-mono text-[10px]">{fx.nro_contenedor}</span></>}
                    </div>
                  )
                })()}

                {/* Ítems */}
                {aiResult.items && aiResult.items.length > 0 && (
                  <div className="border-t border-violet-800/30 pt-2 space-y-0.5">
                    {aiResult.items.map((item, i) => (
                      <div key={i} className="flex items-start justify-between gap-3 text-[11px]">
                        <span className="text-slate-400 flex-1 leading-tight">{item.concepto}</span>
                        <span className="text-slate-300 flex-shrink-0">{fmtMonto(item.importe)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Totales con equivalente ARS */}
                <div className="border-t border-violet-700/30 pt-2 space-y-1.5">
                  {aiResult.importe_neto != null && (
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-emerald-400 font-semibold">Neto gravado (costo real)</span>
                        <span className="text-emerald-300 font-bold">{fmtMonto(aiResult.importe_neto)}</span>
                      </div>
                      {esFx && tc && (
                        <div className="flex justify-end text-[10px] text-emerald-600">
                          = ${Math.round(aiResult.importe_neto * tc).toLocaleString('es-AR')} ARS
                        </div>
                      )}
                    </div>
                  )}
                  {aiResult.iva != null && aiResult.iva > 0 && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">IVA (recuperable)</span>
                      <span className="text-slate-400">{fmtMonto(aiResult.iva)}</span>
                    </div>
                  )}
                  {(() => {
                    const fx   = aiResult as import('@shared/types').ExtractedFacturaLocal
                    const caba = fx.percepcion_caba
                    const bsas = fx.percepcion_bsas
                    const tot  = fx.percepciones
                    if (!caba && !bsas && !tot) return null
                    return (
                      <>
                        {caba != null && caba > 0 && (
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-500">Percep. IIBB CABA</span>
                            <span className="text-slate-400">{fmtMonto(caba)}</span>
                          </div>
                        )}
                        {bsas != null && bsas > 0 && (
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-500">Percep. IIBB BS AS</span>
                            <span className="text-slate-400">{fmtMonto(bsas)}</span>
                          </div>
                        )}
                        {/* Si hay otras percepciones además de CABA y BS AS */}
                        {tot != null && tot > 0 && (caba ?? 0) + (bsas ?? 0) < tot - 0.01 && (
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-500">Otras percepciones</span>
                            <span className="text-slate-400">{fmtMonto(tot - (caba ?? 0) - (bsas ?? 0))}</span>
                          </div>
                        )}
                      </>
                    )
                  })()}
                  {aiResult.importe_total != null && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Total factura</span>
                      <span className="text-slate-300">{fmtMonto(aiResult.importe_total)}</span>
                    </div>
                  )}
                  {esFx && tc && aiResult.importe_total != null && (
                    <div className="flex justify-end text-[10px] text-slate-600">
                      = ${Math.round(aiResult.importe_total * tc).toLocaleString('es-AR')} ARS
                    </div>
                  )}
                </div>

                {/* Botones */}
                <div className="flex justify-end gap-2 pt-1 border-t border-violet-800/30">
                  <button onClick={() => setAiResult(null)}
                    className="px-2.5 py-1 rounded text-[11px] text-slate-400 hover:text-white transition-colors">
                    Descartar
                  </button>
                  <button onClick={handleApply} disabled={applying}
                    className="flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-medium bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 transition-colors">
                    {applying
                      ? <><Loader2 size={11} className="animate-spin" /> Aplicando...</>
                      : <><Check size={11} /> Aplicar {netoLabel}</>
                    }
                  </button>
                </div>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}

const FIXED_CATEGORIES = ['despachante', 'deposito_fiscal'] as const  // flete va aparte

/** Convierte un costo a ARS usando el TC propio de la factura o el TC del despacho como fallback */
function costToARS(c: ComexImportExtraCost, cotiz: number): number {
  if (c.moneda === 'ARS') return c.importe
  const tc = c.tipo_cambio ?? (c.moneda === 'USD' ? cotiz : 0)
  return tc > 0 ? c.importe * tc : c.importe
}

// ── Flete Section (múltiples facturas) ───────────────────────────────────────

function FleteSection({
  imp, categoria
}: {
  imp: ComexImport
  categoria: 'flete_internacional' | 'flete_local'
}) {
  const { data: allCosts = [] } = useComexExtraCosts(imp.id)
  const { data: customs }       = useComexCustoms(imp.id)
  const createCost              = useCreateComexExtraCost()

  const cotiz      = customs?.dolar_aduana ?? 0
  // Los registros de flete son manejados por ExtraCostsSection (auto-crea si faltan)
  const fleteCosts = allCosts.filter(c => c.categoria === categoria)
  const totalARS   = fleteCosts.reduce((s, c) => s + costToARS(c, cotiz), 0)
  const fmtInt     = (n: number) => Math.round(n).toLocaleString('es-AR')
  const label      = EXTRA_COST_CATEGORY_LABELS[categoria]

  // Moneda por defecto: internacional = USD, local = ARS
  const defaultMoneda = categoria === 'flete_internacional' ? 'USD' : 'ARS'

  const handleAddInvoice = async () => {
    await createCost.mutateAsync({
      import_id: imp.id, categoria,
      concepto: `${label} ${fleteCosts.length + 1}`, proveedor: '', nro_factura: '',
      fecha_factura: null, importe: 0, moneda: defaultMoneda,
      stored_name: null, original_name: null,
      drive_file_id: null, drive_folder_id: fleteCosts[0]?.drive_folder_id ?? null,
      drive_status: 'none', sort_order: fleteCosts.length,
      cae: null, referencia_despacho: null, importe_iva: null,
      importe_total: null, items_json: null,
      tipo_cambio: null, bl_referencia: null, importe_ars: null
    })
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-700/20 border-b border-slate-700/50">
        <div className="flex items-center gap-2 flex-wrap">
          <FileText size={14} className="text-slate-400" />
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">{label}</h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-500">
            {fleteCosts.length} factura{fleteCosts.length !== 1 ? 's' : ''}
          </span>
          {totalARS > 0 && (
            <span className="text-xs font-semibold text-white">${fmtInt(totalARS)} ARS</span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Una tarjeta por factura */}
        {fleteCosts.map((cost, idx) => (
          <div key={cost.id}>
            {fleteCosts.length > 1 && (
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
                Factura {idx + 1}
              </p>
            )}
            <FixedCostSection cost={cost} importId={imp.id} />
          </div>
        ))}

        {/* Total si hay más de una factura */}
        {fleteCosts.length > 1 && totalARS > 0 && (
          <div className="flex justify-between items-center pt-2 border-t border-slate-700/50">
            <span className="text-xs font-semibold text-slate-300">Total flete</span>
            <span className="text-sm font-bold text-white">${fmtInt(totalARS)} ARS</span>
          </div>
        )}

        {/* Agregar otra factura */}
        <button
          onClick={handleAddInvoice}
          disabled={createCost.isPending}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-cyan-400 transition-colors disabled:opacity-40"
        >
          <Plus size={12} /> Agregar otra factura de {label.toLowerCase()}
        </button>
      </div>
    </div>
  )
}

function ExtraCostsSection({ imp }: { imp: ComexImport }) {
  const { data: costs = [], isLoading } = useComexExtraCosts(imp.id)
  const { data: customs }               = useComexCustoms(imp.id)
  const createCost                      = useCreateComexExtraCost()
  const initialized                     = useRef(false)

  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState<{ categoria: ExtraCostCategory; concepto: string; importe: string; moneda: 'ARS' | 'USD' }>({
    categoria: 'gastos_bancarios', concepto: '', importe: '', moneda: 'ARS'
  })

  const cotiz = customs?.dolar_aduana ?? 0

  // Auto-crear registros faltantes para importaciones existentes
  useEffect(() => {
    if (isLoading || initialized.current) return
    initialized.current = true

    const allFixed = [...FIXED_CATEGORIES, 'flete_internacional', 'flete_local'] as string[]
    const missing  = allFixed.filter(cat => !costs.some(c => c.categoria === cat))
    if (!missing.length) return

    missing.forEach((cat, idx) => {
      const label = EXTRA_COST_CATEGORY_LABELS[cat as ExtraCostCategory] ?? cat
      createCost.mutate({
        import_id: imp.id, categoria: cat as ExtraCostCategory,
        concepto: label, proveedor: '', nro_factura: '',
        fecha_factura: null, importe: 0, moneda: cat === 'flete_internacional' ? 'USD' : 'ARS',
        stored_name: null, original_name: null,
        drive_file_id: null, drive_folder_id: null,
        drive_status: 'none', sort_order: costs.length + idx,
        cae: null, referencia_despacho: null, importe_iva: null,
        importe_total: null, items_json: null,
        tipo_cambio: null, bl_referencia: null, importe_ars: null,
        percepciones: null, fecha_ingreso: null, fecha_egreso: null,
        nro_contenedor: null, canal_deposito: null
      })
    })
  }, [isLoading])  // eslint-disable-line react-hooks/exhaustive-deps

  // Costos fijos sin flete (despachante + depósito) — se muestran como tarjetas individuales
  const fixedCosts = (FIXED_CATEGORIES as readonly string[])
    .map(cat => costs.find(c => c.categoria === cat))
    .filter((c): c is ComexImportExtraCost => !!c)

  // Costos extras: todo lo que no es fijo ni flete (ninguno de los dos tipos)
  const otherCosts = costs.filter(
    c => !(FIXED_CATEGORIES as readonly string[]).includes(c.categoria)
      && c.categoria !== 'flete_internacional'
      && c.categoria !== 'flete_local'
  )

  const totalARS = costs.reduce((s, c) =>
    s + (c.moneda === 'USD' && cotiz > 0 ? c.importe * cotiz : c.importe), 0)

  const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    await createCost.mutateAsync({
      import_id: imp.id,
      categoria: addForm.categoria,
      concepto:  addForm.concepto.trim() || EXTRA_COST_CATEGORY_LABELS[addForm.categoria],
      proveedor: '', nro_factura: '', fecha_factura: null,
      importe: Number(addForm.importe) || 0, moneda: addForm.moneda,
      stored_name: null, original_name: null,
      drive_file_id: null, drive_folder_id: null,
      drive_status: 'none', sort_order: costs.length
    })
    setAddForm({ categoria: 'gastos_bancarios', concepto: '', importe: '', moneda: 'ARS' })
    setShowAdd(false)
  }

  return (
    <div className="space-y-3">
      {/* ── Tarjetas para costos fijos ── */}
      {fixedCosts.map(c => (
        <FixedCostSection key={c.id} cost={c} importId={imp.id} />
      ))}

      {/* ── Filas para costos extra (gastos bancarios, otros) ── */}
      {(otherCosts.length > 0 || showAdd) && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
          <SectionHeader
            icon={FileText}
            title="Otros costos"
            action={
              <button onClick={() => setShowAdd(v => !v)}
                className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300">
                <Plus size={12} /> Agregar
              </button>
            }
          />
          <div className="space-y-2">
            {otherCosts.map(c => <ExtraCostRow key={c.id} cost={c} importId={imp.id} cotiz={cotiz} />)}
          </div>
          {showAdd && (
            <form onSubmit={handleAdd} className="border border-slate-600 rounded-lg p-3 space-y-2 bg-slate-900/40">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1 uppercase tracking-wider">Categoría</label>
                  <select value={addForm.categoria}
                    onChange={e => setAddForm(p => ({ ...p, categoria: e.target.value as ExtraCostCategory }))}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500">
                    {EXTRA_COST_CATEGORIES.filter(c => !(FIXED_CATEGORIES as readonly string[]).includes(c)).map(c => (
                      <option key={c} value={c}>{EXTRA_COST_CATEGORY_LABELS[c]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1 uppercase tracking-wider">Concepto</label>
                  <input autoFocus value={addForm.concepto}
                    onChange={e => setAddForm(p => ({ ...p, concepto: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Escape') setShowAdd(false) }}
                    placeholder={EXTRA_COST_CATEGORY_LABELS[addForm.categoria]}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500" />
                </div>
                <div className="flex gap-1">
                  <div className="flex-1">
                    <label className="block text-[10px] text-slate-500 mb-1 uppercase tracking-wider">Importe</label>
                    <input type="number" value={addForm.importe} step="0.01"
                      onChange={e => setAddForm(p => ({ ...p, importe: e.target.value }))}
                      placeholder="0"
                      className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1 uppercase tracking-wider">Moneda</label>
                    <select value={addForm.moneda}
                      onChange={e => setAddForm(p => ({ ...p, moneda: e.target.value as 'ARS' | 'USD' }))}
                      className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500">
                      <option>ARS</option><option>USD</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowAdd(false)} className="text-xs text-slate-400 hover:text-white px-2 py-1">Cancelar</button>
                <button type="submit" disabled={createCost.isPending}
                  className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1 rounded disabled:opacity-50">
                  Agregar
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Botón para agregar otros costos si la sección no está visible */}
      {otherCosts.length === 0 && !showAdd && (
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-cyan-400 transition-colors">
          <Plus size={12} /> Agregar otro costo (gastos bancarios, etc.)
        </button>
      )}

      {/* Total */}
      {totalARS > 0 && (
        <div className="flex justify-between items-center px-1">
          <span className="text-xs text-slate-500">Total costos adicionales</span>
          <span className="text-sm font-semibold text-slate-200">${fmt(totalARS)}</span>
        </div>
      )}
    </div>
  )
}

// ── Tributos Section ─────────────────────────────────────────────────────────

function TributoRow({
  tributo, importId, cotiz
}: {
  tributo: ComexImportTributo
  importId: string
  cotiz: number
}) {
  const update = useUpdateComexTributo()
  const del    = useDeleteComexTributo()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    codigo:     tributo.codigo,
    concepto:   tributo.concepto,
    porcentaje: tributo.porcentaje != null ? String(tributo.porcentaje) : '',
    importe_usd: String(tributo.importe_usd)
  })

  const fmt = (n: number) =>
    n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    await update.mutateAsync({
      id: tributo.id, importId,
      data: {
        codigo:     form.codigo.trim(),
        concepto:   form.concepto.trim(),
        porcentaje: form.porcentaje ? Number(form.porcentaje) : null,
        importe_usd: Number(form.importe_usd) || 0
      }
    })
    setEditing(false)
  }

  if (editing) {
    return (
      <tr className="bg-slate-700/30">
        <td className="px-2 py-1">
          <input autoFocus value={form.codigo} onChange={e => setForm(p => ({ ...p, codigo: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Escape') setEditing(false) }}
            className="w-14 bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-amber-500" />
        </td>
        <td className="px-2 py-1">
          <input value={form.concepto} onChange={e => setForm(p => ({ ...p, concepto: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Escape') setEditing(false) }}
            className="w-full bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-amber-500" />
        </td>
        <td className="px-2 py-1 text-right">
          <input type="number" value={form.porcentaje} onChange={e => setForm(p => ({ ...p, porcentaje: e.target.value }))}
            placeholder="—"
            className="w-14 bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5 text-xs text-white text-right focus:outline-none focus:border-amber-500" />
        </td>
        <td className="px-2 py-1 text-right">
          <input type="number" value={form.importe_usd} onChange={e => setForm(p => ({ ...p, importe_usd: e.target.value }))}
            step="0.01"
            className="w-24 bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5 text-xs text-white text-right focus:outline-none focus:border-amber-500" />
        </td>
        <td className="px-2 py-1 text-right text-xs text-slate-500">
          {cotiz > 0 ? fmt((Number(form.importe_usd) || 0) * cotiz) : '—'}
        </td>
        <td className="px-2 py-1">
          <div className="flex gap-1">
            <button onClick={handleSave} className="p-1 rounded bg-amber-600 hover:bg-amber-500 text-white"><Check size={11} /></button>
            <button onClick={() => setEditing(false)} className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-white"><X size={11} /></button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="group hover:bg-slate-700/20 transition-colors">
      <td className="px-2 py-1.5 text-[11px] text-slate-500 font-mono">{tributo.codigo}</td>
      <td className="px-2 py-1.5 text-xs text-slate-300">{tributo.concepto}</td>
      <td className="px-2 py-1.5 text-xs text-slate-400 text-right">
        {tributo.porcentaje != null ? `${tributo.porcentaje}%` : '—'}
      </td>
      <td className="px-2 py-1.5 text-xs text-amber-300 text-right">{fmt(tributo.importe_usd)}</td>
      <td className="px-2 py-1.5 text-xs text-slate-300 text-right">
        {cotiz > 0 ? fmt(tributo.importe_usd * cotiz) : '—'}
      </td>
      <td className="px-2 py-1.5">
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setEditing(true)} className="p-1 rounded text-slate-500 hover:text-amber-400 hover:bg-slate-700"><Edit2 size={11} /></button>
          <button onClick={() => del.mutate({ id: tributo.id, importId })} className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700"><Trash2 size={11} /></button>
        </div>
      </td>
    </tr>
  )
}

function TributosSection({ imp }: { imp: ComexImport }) {
  const { data: tributos = [] }    = useComexTributos(imp.id)
  const { data: customs }          = useComexCustoms(imp.id)
  const createTributo              = useCreateComexTributo()
  const upsertTributos             = useUpsertComexTributos()
  const analyzeDespacho            = useAnalyzeDespacho()
  const { data: aiConfigured }     = useAIConfigured()

  const cotiz = customs?.dolar_aduana ?? 0
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ codigo: '', concepto: '', porcentaje: '', importe_usd: '' })
  const [loadingAI, setLoadingAI] = useState(false)

  const totalUSD = tributos.reduce((s, t) => s + t.importe_usd, 0)
  const totalARS = cotiz > 0 ? totalUSD * cotiz : null

  const fmt = (n: number) =>
    n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.concepto.trim()) return
    await createTributo.mutateAsync({
      import_id:   imp.id,
      codigo:      form.codigo.trim(),
      concepto:    form.concepto.trim(),
      porcentaje:  form.porcentaje ? Number(form.porcentaje) : null,
      importe_usd: Number(form.importe_usd) || 0,
      sort_order:  tributos.length
    })
    setForm({ codigo: '', concepto: '', porcentaje: '', importe_usd: '' })
    setAdding(false)
  }

  const handleImportFromAI = async () => {
    if (!imp.despacho_stored_name) {
      alert('Primero subí el PDF del despacho en la sección "Despacho de Aduana".')
      return
    }
    setLoadingAI(true)
    try {
      const result = await analyzeDespacho.mutateAsync(imp.id)
      const d = result.structured as import('@shared/types').ExtractedDespacho
      if (!d?.tributos?.length) { alert('No se encontraron tributos en el despacho.'); return }
      await upsertTributos.mutateAsync({
        importId: imp.id,
        tributos: d.tributos.map((t, i) => ({
          import_id:   imp.id,
          codigo:      t.codigo,
          concepto:    t.concepto,
          porcentaje:  t.porcentaje ?? null,
          importe_usd: t.importe_usd,
          sort_order:  i
        }))
      })
      // También aplicar cotización si la tenemos
      if (d.cotizacion_dolar != null) {
        await window.api.comex.customs.upsert(imp.id, { dolar_aduana: d.cotizacion_dolar })
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al analizar')
    } finally {
      setLoadingAI(false)
    }
  }

  return (
    <div className="bg-slate-800 border-2 border-amber-700/40 rounded-xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-amber-950/30 border-b border-amber-700/30">
        <div className="flex items-center gap-2">
          <DollarSign size={15} className="text-amber-400" />
          <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wider">
            Tributos, impuestos y derechos
          </h3>
          {tributos.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-900/50 text-amber-400 font-medium">
              {tributos.length} conceptos
            </span>
          )}
        </div>
        {/* Tipo de cambio referencia */}
        {cotiz > 0 && (
          <span className="text-[10px] text-amber-600">
            TC: ${fmt(cotiz)} / USD
          </span>
        )}
      </div>

      <div className="p-4">
        {tributos.length === 0 && !adding ? (
          /* Estado vacío */
          <div className="text-center py-6 space-y-3">
            <DollarSign size={32} className="text-amber-800 mx-auto" />
            <p className="text-sm text-slate-400">Sin tributos cargados</p>
            <p className="text-xs text-slate-500">
              Podés importarlos desde el despacho con IA o cargarlos manualmente
            </p>
          </div>
        ) : (
          /* Tabla unificada */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <colgroup>
                <col style={{ width: '4rem' }} />
                <col />
                <col style={{ width: '4.5rem' }} />
                <col style={{ width: '7rem' }} />
                <col style={{ width: '8.5rem' }} />
                <col style={{ width: '3.5rem' }} />
              </colgroup>
              <thead>
                <tr className="border-b border-amber-800/30">
                  <th className="px-2 pb-2 text-[10px] text-amber-600 uppercase tracking-wider">Cód</th>
                  <th className="px-2 pb-2 text-[10px] text-amber-600 uppercase tracking-wider">Concepto</th>
                  <th className="px-2 pb-2 text-[10px] text-amber-600 uppercase tracking-wider text-right">%</th>
                  <th className="px-2 pb-2 text-[10px] text-amber-600 uppercase tracking-wider text-right">USD</th>
                  <th className="px-2 pb-2 text-[10px] text-amber-600 uppercase tracking-wider text-right">ARS</th>
                  <th />
                </tr>
              </thead>

              {/* ── Derechos, tasas y aranceles ── */}
              <tbody className="divide-y divide-slate-700/20">
                {tributos.filter(t => esCostoReal(t.codigo)).map(t => (
                  <TributoRow key={t.id} tributo={t} importId={imp.id} cotiz={cotiz} />
                ))}
                {adding && (
                  <tr className="bg-slate-700/20">
                    <td className="px-2 py-1">
                      <input autoFocus value={form.codigo}
                        onChange={e => setForm(p => ({ ...p, codigo: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Escape') setAdding(false) }}
                        placeholder="010"
                        className="w-full bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-amber-500" />
                    </td>
                    <td className="px-2 py-1">
                      <input value={form.concepto}
                        onChange={e => setForm(p => ({ ...p, concepto: e.target.value }))}
                        placeholder="Nombre del tributo"
                        className="w-full bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-amber-500" />
                    </td>
                    <td className="px-2 py-1">
                      <input type="number" value={form.porcentaje}
                        onChange={e => setForm(p => ({ ...p, porcentaje: e.target.value }))}
                        placeholder="—"
                        className="w-full bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5 text-xs text-white text-right focus:outline-none focus:border-amber-500" />
                    </td>
                    <td className="px-2 py-1">
                      <input type="number" value={form.importe_usd} step="0.01"
                        onChange={e => setForm(p => ({ ...p, importe_usd: e.target.value }))}
                        placeholder="0.00"
                        className="w-full bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5 text-xs text-white text-right focus:outline-none focus:border-amber-500" />
                    </td>
                    <td className="px-2 py-1 text-right text-xs text-slate-500">
                      {cotiz > 0 && form.importe_usd ? fmt(Number(form.importe_usd) * cotiz) : '—'}
                    </td>
                    <td className="px-2 py-1">
                      <div className="flex gap-1">
                        <button onClick={handleAdd} className="p-1 rounded bg-amber-600 hover:bg-amber-500 text-white"><Check size={11} /></button>
                        <button onClick={() => setAdding(false)} className="p-1 rounded bg-slate-700 text-slate-400"><X size={11} /></button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>

              {/* Subtotal derechos */}
              {tributos.some(t => esCostoReal(t.codigo)) && (() => {
                const usd = tributos.filter(t => esCostoReal(t.codigo)).reduce((s, t) => s + t.importe_usd, 0)
                return (
                  <tbody>
                    <tr className="border-t border-amber-700/30 bg-amber-950/10">
                      <td colSpan={3} className="px-2 py-1.5 text-xs font-semibold text-amber-400">
                        Derechos, tasas y aranceles
                      </td>
                      <td className="px-2 py-1.5 text-xs font-semibold text-amber-400 text-right">{fmt(usd)}</td>
                      <td className="px-2 py-1.5 text-xs font-semibold text-amber-300 text-right">
                        {cotiz > 0 ? fmt(usd * cotiz) : '—'}
                      </td>
                      <td />
                    </tr>
                  </tbody>
                )
              })()}

              {/* ── IVA e impuestos recuperables ── */}
              {tributos.some(t => !esCostoReal(t.codigo)) && (
                <>
                  <tbody>
                    <tr>
                      <td colSpan={6} className="px-2 pt-3 pb-1">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-600 inline-block" />
                          IVA e impuestos recuperables (no impactan en costo)
                        </span>
                      </td>
                    </tr>
                  </tbody>
                  <tbody className="divide-y divide-slate-700/20">
                    {tributos.filter(t => !esCostoReal(t.codigo)).map(t => (
                      <TributoRow key={t.id} tributo={t} importId={imp.id} cotiz={cotiz} />
                    ))}
                  </tbody>
                  {(() => {
                    const usd = tributos.filter(t => !esCostoReal(t.codigo)).reduce((s, t) => s + t.importe_usd, 0)
                    return (
                      <tbody>
                        <tr className="border-t border-slate-700/40 bg-slate-700/10">
                          <td colSpan={3} className="px-2 py-1.5 text-xs font-semibold text-slate-400">
                            Subtotal recuperable
                          </td>
                          <td className="px-2 py-1.5 text-xs font-semibold text-slate-400 text-right">{fmt(usd)}</td>
                          <td className="px-2 py-1.5 text-xs font-semibold text-slate-400 text-right">
                            {cotiz > 0 ? fmt(usd * cotiz) : '—'}
                          </td>
                          <td />
                        </tr>
                      </tbody>
                    )
                  })()}
                </>
              )}

              {/* Total general */}
              {tributos.length > 1 && (
                <tfoot>
                  <tr className="border-t-2 border-amber-700/50">
                    <td colSpan={3} className="px-2 py-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
                      Total tributos
                    </td>
                    <td className="px-2 py-2 text-sm font-bold text-amber-300 text-right">{fmt(totalUSD)} USD</td>
                    <td className="px-2 py-2 text-sm font-bold text-amber-200 text-right">
                      {totalARS != null ? `$${fmt(totalARS)}` : '—'}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* Botones de acción */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-700/50">
          <button
            onClick={() => setAdding(true)}
            disabled={adding}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors disabled:opacity-50"
          >
            <Plus size={12} /> Agregar tributo
          </button>

          {aiConfigured && imp.despacho_stored_name && (
            <button
              onClick={handleImportFromAI}
              disabled={loadingAI}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-700 hover:bg-amber-600 text-white transition-colors disabled:opacity-50"
            >
              {loadingAI
                ? <><Loader2 size={12} className="animate-spin" /> Analizando...</>
                : <><Sparkles size={12} /> Importar desde despacho</>
              }
            </button>
          )}

          {!imp.despacho_stored_name && aiConfigured && (
            <span className="text-[11px] text-slate-500 italic">
              Subí el PDF del despacho para importar tributos automáticamente
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Despacho Section ─────────────────────────────────────────────────────────

function DespachoSection({ imp }: { imp: ComexImport }) {
  const uploadDespacho = useUploadDespacho()
  const deleteDespacho = useDeleteDespacho()
  const analyzeDespacho = useAnalyzeDespacho()
  const { data: aiConfigured } = useAIConfigured()

  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounter = useRef(0)

  const hasFile = !!imp.despacho_stored_name

  const handleUpload = async (filePath: string) => {
    await uploadDespacho.mutateAsync({ importId: imp.id, filePath })
  }

  const handleSelectFile = async () => {
    const fp = await window.api.comex.despacho.selectFile()
    if (fp) handleUpload(fp)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const fp = window.api.getPathForFile(file)
    if (fp) handleUpload(fp)
  }

  const handleAnalyze = async () => {
    try {
      const result = await analyzeDespacho.mutateAsync(imp.id)
      setAiResult(result)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al analizar')
    }
  }

  const driveStatus = imp.despacho_drive_status ?? 'none'

  return (
    <div className="bg-slate-800 border-2 border-cyan-800/50 rounded-xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-cyan-950/40 border-b border-cyan-800/30">
        <div className="flex items-center gap-2">
          <FileText size={15} className="text-cyan-400" />
          <h3 className="text-sm font-bold text-cyan-300 uppercase tracking-wider">
            Despacho de Aduana
          </h3>
          {hasFile && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-900/60 text-cyan-400 font-medium">
              PDF adjunto
            </span>
          )}
        </div>
        {/* Drive status */}
        {hasFile && (
          <div className="flex items-center gap-1.5">
            {driveStatus === 'synced' && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                <Cloud size={11} /> En Drive
              </span>
            )}
            {driveStatus === 'uploading' && (
              <span className="flex items-center gap-1 text-[10px] text-blue-400">
                <Loader2 size={11} className="animate-spin" /> Subiendo...
              </span>
            )}
            {driveStatus === 'error' && (
              <span className="flex items-center gap-1 text-[10px] text-red-400">
                <AlertCircle size={11} /> Error Drive
              </span>
            )}
            {driveStatus === 'none' && imp.drive_folder_id && (
              <span className="text-[10px] text-slate-500">Sin sincronizar</span>
            )}
          </div>
        )}
      </div>

      <div className="p-4">
        {!hasFile ? (
          /* ── Sin despacho: zona de drop ── */
          <div
            onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setIsDragOver(true) }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={() => { dragCounter.current--; if (dragCounter.current === 0) setIsDragOver(false) }}
            onDrop={handleDrop}
            className={cn(
              'border-2 border-dashed rounded-xl px-6 py-8 flex flex-col items-center gap-3 transition-colors cursor-pointer',
              isDragOver
                ? 'border-cyan-400 bg-cyan-900/20'
                : 'border-slate-600 hover:border-cyan-700 hover:bg-slate-700/30'
            )}
            onClick={handleSelectFile}
          >
            {uploadDespacho.isPending ? (
              <Loader2 size={28} className="text-cyan-400 animate-spin" />
            ) : (
              <Upload size={28} className={cn(isDragOver ? 'text-cyan-400' : 'text-slate-500')} />
            )}
            <div className="text-center">
              <p className="text-sm font-medium text-slate-300">
                {uploadDespacho.isPending ? 'Subiendo despacho...' : 'Subir despacho (Hoja 1)'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Arrastrá el PDF o hacé click para seleccionar
                {imp.drive_folder_id && ' · Se guardará en Drive automáticamente'}
              </p>
            </div>
          </div>
        ) : (
          /* ── Con despacho: acciones ── */
          <div className="space-y-3">
            {/* Fila del archivo */}
            <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-900/60 rounded-lg border border-slate-700">
              <FileText size={16} className="text-cyan-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">
                  {imp.despacho_original_name ?? 'Despacho adjunto'}
                </p>
                {imp.drive_folder_id && driveStatus === 'synced' && imp.despacho_drive_file_id && (
                  <p className="text-[10px] text-emerald-400">Guardado en subcarpeta "Despacho" en Drive</p>
                )}
              </div>

              {/* Abrir en Drive */}
              {imp.despacho_drive_file_id && (
                <button
                  onClick={() => window.api.shell.open(`https://drive.google.com/file/d/${imp.despacho_drive_file_id}/view`)}
                  title="Ver en Drive"
                  className="p-1.5 rounded text-slate-500 hover:text-cyan-400 hover:bg-slate-700 transition-colors"
                >
                  <ExternalLink size={13} />
                </button>
              )}

              {/* Abrir localmente */}
              <button
                onClick={() => window.api.comex.despacho.open(imp.id)}
                title="Abrir PDF"
                className="p-1.5 rounded text-slate-500 hover:text-cyan-400 hover:bg-slate-700 transition-colors"
              >
                <FolderOpen size={13} />
              </button>

              {/* Reemplazar */}
              <button
                onClick={handleSelectFile}
                disabled={uploadDespacho.isPending}
                title="Reemplazar PDF"
                className="p-1.5 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
              >
                <Upload size={13} />
              </button>

              {/* Eliminar con confirmación */}
              {confirmDelete ? (
                <>
                  <button
                    onClick={async () => { await deleteDespacho.mutateAsync(imp.id); setConfirmDelete(false) }}
                    className="p-1.5 rounded bg-red-600 hover:bg-red-500 text-white transition-colors"
                  >
                    <Check size={13} />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="p-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                  >
                    <X size={13} />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  title="Eliminar despacho"
                  className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>

            {/* Botón IA */}
            {aiConfigured && (
              <button
                onClick={handleAnalyze}
                disabled={analyzeDespacho.isPending}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors',
                  analyzeDespacho.isPending
                    ? 'bg-violet-800/50 text-violet-300 cursor-wait'
                    : 'bg-violet-700 hover:bg-violet-600 text-white'
                )}
              >
                {analyzeDespacho.isPending ? (
                  <><Loader2 size={15} className="animate-spin" /> Analizando con Claude...</>
                ) : (
                  <><Sparkles size={15} /> Extraer datos con IA</>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal de resultados IA */}
      {aiResult && (
        <AIExtractionModal
          doc={{ id: '', import_id: imp.id, type: 'customs_declaration', name: imp.despacho_original_name ?? 'Despacho', drive_file_id: null, status: 'received', notes: '', received_at: null, created_at: 0, local_stored_name: imp.despacho_stored_name, size_bytes: null, mime_type: null, drive_status: 'none' }}
          result={aiResult}
          importId={imp.id}
          onClose={() => setAiResult(null)}
        />
      )}
    </div>
  )
}

// ── AI Extraction Modal ───────────────────────────────────────────────────────

function formatFieldValue(value: unknown): string {
  if (Array.isArray(value)) return `${value.length} ítem${value.length !== 1 ? 's' : ''}`
  const s = String(value)
  // YYYY-MM-DD → DD/MM/YYYY
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-')
    return `${d}/${m}/${y}`
  }
  return s
}

function FieldRow({ label, value }: { label: string; value: unknown }) {
  if (value == null || value === '') return null
  const display = formatFieldValue(value)
  return (
    <div className="flex items-start gap-3 py-1.5 border-b border-slate-700/40 last:border-0">
      <span className="text-[10px] text-slate-500 uppercase tracking-wide w-32 flex-shrink-0 pt-px">{label}</span>
      <span className="text-xs text-slate-200 flex-1 break-words">{display}</span>
    </div>
  )
}

function AIExtractionModal({
  doc, result, importId, onClose
}: {
  doc: ComexDocument
  result: AIAnalysisResult
  importId: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [applying, setApplying] = useState(false)
  const [applied,  setApplied]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const isDespacho = result.operation === 'extract_despacho'
  const isFactura  = result.operation === 'extract_factura'
  const data       = result.structured as (ExtractedDespacho & ExtractedFactura) | null

  const fieldCount = data
    ? Object.values(data).filter(v =>
        v != null && v !== '' && (Array.isArray(v) ? v.length > 0 : true)
      ).length
    : 0

  const applyDespacho = async () => {
    if (!data) return
    setApplying(true); setError(null)
    try {
      const d = data as ExtractedDespacho

      // 1. Campos aduaneros
      const customs: Record<string, unknown> = {}
      if (d.numero_despacho)          customs.despacho_number    = d.numero_despacho
      if (d.despachante)              customs.despachante         = d.despachante
      if (d.fecha_oficializacion)     customs.oficializacion_date = dayjs(d.fecha_oficializacion).valueOf()
      if (d.bl_numero)                customs.bl_number           = d.bl_numero
      // Agente de Transporte Aduanero → carrier (campo "Carrier / Naviera", read-only)
      if (d.agente_transporte)        customs.carrier             = d.agente_transporte
      // Canal aduanero → canal (read-only)
      if (d.canal)                    customs.canal               = d.canal
      // Ref. mail naviera (naviera_ref) se completa manualmente, no se toca desde el despacho
      // fob_total del despacho → fob_declared (campo "FOB despacho", read-only)
      // fob_invoice (Valor factura) queda editable y no se toca desde el despacho
      if (d.fob_total      != null)   customs.fob_declared        = d.fob_total
      if (d.fob_divisa)               customs.fob_currency        = d.fob_divisa === 'DOL' ? 'USD' : d.fob_divisa
      if (d.cotizacion_dolar != null) customs.dolar_aduana        = d.cotizacion_dolar
      if (d.peso_bruto_kg  != null)   customs.peso_bruto_kg       = d.peso_bruto_kg
      await window.api.comex.customs.upsert(importId, customs)
      qc.invalidateQueries({ queryKey: ['comex-customs', importId] })

      // 2. Tributos — reemplaza todos con los extraídos del despacho
      if (d.tributos?.length > 0) {
        await window.api.comex.tributos.upsert(importId, d.tributos.map((t, i) => ({
          import_id:   importId,
          codigo:      t.codigo,
          concepto:    t.concepto,
          porcentaje:  t.porcentaje ?? null,
          importe_usd: t.importe_usd,
          sort_order:  i
        })))
        qc.invalidateQueries({ queryKey: ['comex-tributos', importId] })
      }

      setApplied(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al aplicar')
    } finally {
      setApplying(false)
    }
  }

  const applyFactura = async () => {
    if (!data) return
    setApplying(true); setError(null)
    try {
      const d = data as ExtractedFactura
      const imp: Record<string, unknown> = {}
      if (d.currency)      imp.currency      = d.currency
      if (d.incoterm)      imp.incoterm       = d.incoterm
      if (d.port_of_origin) imp.origin_port   = d.port_of_origin
      if (d.total != null)  imp.actual_value  = d.total
      if (Object.keys(imp).length > 0) {
        await window.api.comex.imports.update(importId, imp)
        qc.invalidateQueries({ queryKey: ['comex-import', importId] })
      }
      setApplied(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al aplicar')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-700">
          <div className="w-8 h-8 rounded-lg bg-violet-900/50 flex items-center justify-center flex-shrink-0">
            <Bot size={15} className="text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Datos extraídos por IA</p>
            <p className="text-[10px] text-slate-400 truncate">
              {doc.name} · {result.model} · {result.tokens_used.toLocaleString()} tokens
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Banner */}
        <div className={cn(
          'px-5 py-2.5 border-b text-xs font-medium',
          fieldCount > 0
            ? 'bg-violet-900/20 border-violet-800/30 text-violet-300'
            : 'bg-slate-700/30 border-slate-700 text-slate-400'
        )}>
          {fieldCount > 0
            ? `✓ ${fieldCount} campo${fieldCount !== 1 ? 's' : ''} encontrado${fieldCount !== 1 ? 's' : ''}. Revisá los datos y aplicá.`
            : 'No se encontraron datos reconocibles. Probá cambiando el tipo de documento.'}
        </div>

        {/* Fields */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-0.5">
          {isDespacho && data && (() => {
            const d = data as ExtractedDespacho
            const cotiz = d.cotizacion_dolar ?? 0
            const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            return (
              <>
                {/* ── Datos generales ── */}
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5 mt-1">
                  Identificación y operación
                </p>
                <FieldRow label="N° despacho"    value={d.numero_despacho} />
                <FieldRow label="Oficialización" value={d.fecha_oficializacion} />
                <FieldRow label="Fecha arribo"   value={d.fecha_arribo} />
                <FieldRow label="Canal"          value={d.canal} />
                <FieldRow label="Despachante"           value={d.despachante} />
                <FieldRow label="Agente de transporte"  value={d.agente_transporte} />
                <FieldRow label="Vendedor"              value={d.vendedor} />
                <FieldRow label="BL / AWB"              value={d.bl_numero} />
                <FieldRow label="Buque"                 value={d.buque} />
                <FieldRow label="País de origen" value={d.origen_pais} />
                <FieldRow label="Incoterm"       value={d.incoterm} />
                <FieldRow label="FOB"            value={d.fob_total != null ? `${d.fob_divisa ?? ''} ${fmt(d.fob_total)}` : null} />
                <FieldRow label="Peso bruto"     value={d.peso_bruto_kg != null ? `${fmt(d.peso_bruto_kg)} kg` : null} />
                <FieldRow label="Bultos"         value={d.total_bultos} />
                <FieldRow label="N° factura"     value={d.nro_factura} />
                <FieldRow label="Tipo de cambio" value={d.cotizacion_dolar != null ? `$ ${fmt(d.cotizacion_dolar)} / USD` : null} />

                {/* ── TRIBUTOS — recuadro prominente ── */}
                {d.tributos?.length > 0 && (
                  <div className="mt-4 rounded-xl border-2 border-amber-500/40 bg-amber-950/20 overflow-hidden">
                    {/* Header del recuadro */}
                    <div className="flex items-center justify-between px-3 py-2 bg-amber-900/30 border-b border-amber-500/30">
                      <div className="flex items-center gap-2">
                        <DollarSign size={13} className="text-amber-400" />
                        <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                          Tributos de importación
                        </span>
                      </div>
                      <span className="text-[10px] text-amber-500">columna TOTAL del despacho · en USD</span>
                    </div>

                    {/* Tabla de tributos */}
                    <div className="px-3 py-2">
                      <div className="space-y-0">
                        {/* Header */}
                        <div className="grid grid-cols-[2rem_1fr_3.5rem_3.5rem_4rem] gap-1 pb-1 border-b border-amber-800/40 mb-1">
                          <span className="text-[9px] text-amber-600 uppercase">Cód</span>
                          <span className="text-[9px] text-amber-600 uppercase">Concepto</span>
                          <span className="text-[9px] text-amber-600 uppercase text-right">%</span>
                          <span className="text-[9px] text-amber-600 uppercase text-right">USD</span>
                          <span className="text-[9px] text-amber-600 uppercase text-right">ARS</span>
                        </div>
                        {/* Filas */}
                        {d.tributos.map((t, i) => (
                          <div key={i} className="grid grid-cols-[2rem_1fr_3.5rem_3.5rem_4rem] gap-1 py-0.5">
                            <span className="text-[10px] text-slate-500">{t.codigo}</span>
                            <span className="text-[10px] text-slate-300 truncate">{t.concepto}</span>
                            <span className="text-[10px] text-slate-400 text-right">
                              {t.porcentaje != null ? `${t.porcentaje}%` : '—'}
                            </span>
                            <span className="text-[10px] text-amber-300 text-right font-mono">
                              {fmt(t.importe_usd)}
                            </span>
                            <span className="text-[10px] text-slate-400 text-right font-mono">
                              {cotiz > 0 ? fmt(t.importe_usd * cotiz) : '—'}
                            </span>
                          </div>
                        ))}
                        {/* Total */}
                        {d.total_tributos_usd != null && (
                          <div className="grid grid-cols-[2rem_1fr_3.5rem_3.5rem_4rem] gap-1 pt-1.5 mt-1 border-t border-amber-500/30">
                            <span />
                            <span className="text-[10px] font-bold text-amber-300">TOTAL</span>
                            <span />
                            <span className="text-[10px] font-bold text-amber-300 text-right font-mono">
                              {fmt(d.total_tributos_usd)}
                            </span>
                            <span className="text-[10px] font-bold text-amber-200 text-right font-mono">
                              {cotiz > 0 ? fmt(d.total_tributos_usd * cotiz) : '—'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tipo de cambio usado */}
                    {cotiz > 0 && (
                      <div className="px-3 py-1.5 bg-amber-900/20 border-t border-amber-800/30">
                        <span className="text-[9px] text-amber-600">
                          Conversión: 1 USD = $ {fmt(cotiz)} ARS (Cotiz del despacho)
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )
          })()}

          {isFactura && data && (
            <>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2 mt-1">Factura comercial</p>
              <FieldRow label="Proveedor"      value={(data as ExtractedFactura).supplier_name} />
              <FieldRow label="N° factura"     value={(data as ExtractedFactura).invoice_number} />
              <FieldRow label="Fecha"          value={(data as ExtractedFactura).invoice_date} />
              <FieldRow label="Moneda"         value={(data as ExtractedFactura).currency} />
              <FieldRow label="Incoterm"       value={(data as ExtractedFactura).incoterm} />
              <FieldRow label="Puerto origen"  value={(data as ExtractedFactura).port_of_origin} />
              <FieldRow label="Subtotal"       value={(data as ExtractedFactura).subtotal} />
              <FieldRow label="Flete"          value={(data as ExtractedFactura).freight} />
              <FieldRow label="Total"          value={(data as ExtractedFactura).total} />
              <FieldRow label="Cond. de pago"  value={(data as ExtractedFactura).payment_terms} />
              {(data as ExtractedFactura).items?.length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">
                    Ítems ({(data as ExtractedFactura).items.length})
                  </p>
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {(data as ExtractedFactura).items.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px] bg-slate-900/50 rounded px-2 py-1">
                        <span className="flex-1 text-slate-300 truncate">{item.description}</span>
                        {item.hs_code && <span className="text-slate-600 flex-shrink-0">HS: {item.hs_code}</span>}
                        <span className="text-slate-500 flex-shrink-0">{item.quantity} × {item.unit_price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {!isDespacho && !isFactura && (
            <div className="py-1">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">Análisis</p>
              <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans leading-relaxed bg-slate-900/50 rounded-lg p-3">
                {result.content}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-700">
          <div className="flex-1">
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-sm text-slate-400 hover:text-white transition-colors">
              Cerrar
            </button>
            {(isDespacho || isFactura) && fieldCount > 0 && (
              <button
                onClick={isDespacho ? applyDespacho : applyFactura}
                disabled={applying || applied}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  applied
                    ? 'bg-emerald-700/40 text-emerald-300 cursor-default'
                    : 'bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50'
                )}
              >
                {applying
                  ? <><Loader2 size={13} className="animate-spin" />Aplicando...</>
                  : applied
                    ? <><Check size={13} />Aplicado</>
                    : <><Sparkles size={13} />Aplicar {isDespacho ? 'al despacho' : 'a la importación'}</>
                }
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── RFQ Modal ─────────────────────────────────────────────────────────────────

type RFQStep = 1 | 2 | 3

interface RFQShipmentData {
  cargo_type: CargoType
  origin_port: string
  dest_port: string
  incoterm: string
  peso_kg: string
  volumen_m3: string
  cant_pallets: string
  etd: string
  description: string
}

function buildEmailBody(op: { name: string; contact_name: string }, data: RFQShipmentData, importTitle: string): string {
  const contact = op.contact_name ? `Estimado/a ${op.contact_name},` : 'Estimados,'
  const etdLine = data.etd ? `📅 ETD estimada: ${data.etd}` : ''
  const pallets = data.cant_pallets ? `🗃️  Pallets: ${data.cant_pallets}` : ''

  return `${contact}

Les contactamos para solicitar cotización de flete para el siguiente embarque:

📦 Mercadería: ${data.description || '(ver detalle)'}
🚢 Tipo de carga: ${CARGO_TYPE_LABELS[data.cargo_type]}
🌐 Origen: ${data.origin_port || '—'}
🇦🇷 Destino: ${data.dest_port || 'Buenos Aires (ARBUE)'}
📋 Incoterm: ${data.incoterm || '—'}
⚖️  Peso bruto: ${data.peso_kg || '—'} kg
📐 Volumen: ${data.volumen_m3 || '—'} m³${pallets ? '\n' + pallets : ''}${etdLine ? '\n' + etdLine : ''}

Por favor envíen cotización indicando servicios incluidos, validez y condiciones.

Quedamos a la espera. Muchas gracias.`
}

function RFQModal({
  importId, importTitle, imp, customs, items, onClose
}: {
  importId: string
  importTitle: string
  imp: ComexImport
  customs: ComexCustoms | null | undefined
  items: Array<{ description: string }>
  onClose: () => void
}) {
  const { data: operators = [] } = useComexFreightOperators()
  const createQuote = useCreateComexQuote()

  const [step, setStep] = useState<RFQStep>(1)
  const [selectedOpIds, setSelectedOpIds] = useState<Set<string>>(new Set())
  const [adHocOps, setAdHocOps] = useState<Array<{ id: string; name: string; contact_name: string; email: string }>>([])
  const [adHocForm, setAdHocForm] = useState({ name: '', contact_name: '', email: '' })
  const [activeTab, setActiveTab] = useState(0)
  const [copied, setCopied] = useState<string | null>(null)

  const [shipment, setShipment] = useState<RFQShipmentData>({
    cargo_type: 'LCL',
    origin_port: imp.origin_port || customs?.carrier || imp.origin_country || '',
    dest_port: 'Buenos Aires (ARBUE)',
    incoterm: imp.incoterm ?? '',
    peso_kg: customs?.peso_bruto_kg != null ? String(customs.peso_bruto_kg) : '',
    volumen_m3: customs?.volumen_m3 != null ? String(customs.volumen_m3) : '',
    cant_pallets: customs?.cant_pallets != null ? String(customs.cant_pallets) : '',
    etd: customs?.etd ? dayjs(customs.etd).format('DD/MM/YYYY') : (imp.ship_date ? dayjs(imp.ship_date).format('DD/MM/YYYY') : ''),
    description: items.map((i) => i.description).filter(Boolean).join(', ')
  })

  // All recipients: selected from directory + ad-hoc
  const allRecipients = [
    ...operators.filter((o) => selectedOpIds.has(o.id)).map((o) => ({
      id: o.id, name: o.name, contact_name: o.contact_name, email: o.email, fromDir: true
    })),
    ...adHocOps.map((o) => ({ ...o, fromDir: false }))
  ]

  const toggleOp = (id: string) =>
    setSelectedOpIds((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const addAdHoc = () => {
    if (!adHocForm.name.trim()) return
    setAdHocOps((p) => [...p, { id: `adhoc-${Date.now()}`, ...adHocForm }])
    setAdHocForm({ name: '', contact_name: '', email: '' })
  }

  const handleSend = async () => {
    const now = Date.now()
    for (const r of allRecipients) {
      const emailText = buildEmailBody(r, shipment, importTitle)
      await createQuote.mutateAsync({
        import_id: importId,
        operator_id: r.fromDir ? r.id : null,
        operator_name: r.name,
        contact: r.contact_name,
        cargo_type: shipment.cargo_type,
        quote_amount: null,
        currency: 'USD',
        services_included: '',
        valid_until: null,
        status: 'requested',
        rfq_sent_at: now,
        rfq_email_text: emailText,
        notes: ''
      } as Parameters<typeof window.api.comex.quotes.create>[0])
    }
    onClose()
  }

  const openMailto = (r: typeof allRecipients[0]) => {
    const body = buildEmailBody(r, shipment, importTitle)
    const subject = encodeURIComponent(`Solicitud de cotización de flete – ${importTitle}`)
    const bodyEnc = encodeURIComponent(body)
    const email = r.email ? r.email : ''
    window.api.shell.open(`mailto:${email}?subject=${subject}&body=${bodyEnc}`)
  }

  const copyText = (r: typeof allRecipients[0]) => {
    const body = buildEmailBody(r, shipment, importTitle)
    navigator.clipboard.writeText(body)
    setCopied(r.id)
    setTimeout(() => setCopied(null), 2000)
  }

  const inputCls = 'w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
          <div>
            <h2 className="font-semibold text-white">Solicitar cotizaciones de flete</h2>
            <p className="text-xs text-slate-400 mt-0.5">{importTitle}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-6 py-3 border-b border-slate-700/50 shrink-0">
          {(['1. Operadores', '2. Embarque', '3. Emails'] as const).map((label, i) => (
            <div key={i} className="flex items-center">
              <div className={cn('flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full transition-colors',
                step === i + 1 ? 'bg-cyan-600 text-white' : step > i + 1 ? 'text-emerald-400' : 'text-slate-500')}>
                {step > i + 1 && <Check size={11} />}
                {label}
              </div>
              {i < 2 && <div className="w-6 h-px bg-slate-700 mx-1" />}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── Step 1: Select operators ── */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">Seleccioná los operadores del directorio y/o agregá uno nuevo.</p>

              {/* Directory */}
              {operators.length > 0 && (
                <div className="space-y-1.5">
                  {operators.map((op) => (
                    <label key={op.id}
                      className={cn('flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                        selectedOpIds.has(op.id) ? 'border-cyan-600 bg-cyan-950/30' : 'border-slate-700 hover:border-slate-600')}>
                      <input type="checkbox" checked={selectedOpIds.has(op.id)} onChange={() => toggleOp(op.id)}
                        className="w-4 h-4 accent-cyan-500" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{op.name}</p>
                        {op.contact_name && <p className="text-[10px] text-slate-400">{op.contact_name}</p>}
                      </div>
                      {op.email && <p className="text-[10px] text-slate-500 truncate max-w-[160px]">{op.email}</p>}
                    </label>
                  ))}
                </div>
              )}

              {/* Ad-hoc */}
              <div className="border border-dashed border-slate-600 rounded-lg p-3 space-y-2">
                <p className="text-xs text-slate-500">Agregar operador sin guardar en directorio</p>
                <div className="grid grid-cols-3 gap-2">
                  <input value={adHocForm.name} onChange={(e) => setAdHocForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Nombre" className={inputCls} />
                  <input value={adHocForm.contact_name} onChange={(e) => setAdHocForm((p) => ({ ...p, contact_name: e.target.value }))}
                    placeholder="Contacto" className={inputCls} />
                  <input value={adHocForm.email} onChange={(e) => setAdHocForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="Email" className={inputCls} />
                </div>
                {adHocOps.map((o) => (
                  <div key={o.id} className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900 rounded px-2 py-1">
                    <span className="flex-1">{o.name} {o.email && `<${o.email}>`}</span>
                    <button onClick={() => setAdHocOps((p) => p.filter((x) => x.id !== o.id))} className="text-slate-600 hover:text-red-400">
                      <X size={11} />
                    </button>
                  </div>
                ))}
                <button onClick={addAdHoc} disabled={!adHocForm.name.trim()}
                  className="text-xs text-cyan-400 hover:text-cyan-300 disabled:opacity-40 flex items-center gap-1">
                  <Plus size={11} /> Agregar
                </button>
              </div>

              <p className="text-xs text-slate-500">{allRecipients.length} operador{allRecipients.length !== 1 ? 'es' : ''} seleccionado{allRecipients.length !== 1 ? 's' : ''}</p>
            </div>
          )}

          {/* ── Step 2: Shipment data ── */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">Datos que se incluirán en el email. Editables antes de enviar.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Tipo de carga</label>
                  <select value={shipment.cargo_type} onChange={(e) => setShipment((p) => ({ ...p, cargo_type: e.target.value as CargoType }))}
                    className={inputCls}>
                    {(Object.keys(CARGO_TYPE_LABELS) as CargoType[]).map((k) => (
                      <option key={k} value={k}>{CARGO_TYPE_LABELS[k]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Incoterm</label>
                  <select value={shipment.incoterm} onChange={(e) => setShipment((p) => ({ ...p, incoterm: e.target.value }))}
                    className={inputCls}>
                    {INCOTERMS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Puerto de origen</label>
                  <input value={shipment.origin_port} onChange={(e) => setShipment((p) => ({ ...p, origin_port: e.target.value }))}
                    placeholder="Shenzhen (CNSZX)" className={inputCls} />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Puerto de destino</label>
                  <input value={shipment.dest_port} onChange={(e) => setShipment((p) => ({ ...p, dest_port: e.target.value }))}
                    placeholder="Buenos Aires (ARBUE)" className={inputCls} />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Peso bruto (kg)</label>
                  <input value={shipment.peso_kg} onChange={(e) => setShipment((p) => ({ ...p, peso_kg: e.target.value }))}
                    placeholder="—" className={inputCls} />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Volumen (m³)</label>
                  <input value={shipment.volumen_m3} onChange={(e) => setShipment((p) => ({ ...p, volumen_m3: e.target.value }))}
                    placeholder="—" className={inputCls} />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Pallets</label>
                  <input value={shipment.cant_pallets} onChange={(e) => setShipment((p) => ({ ...p, cant_pallets: e.target.value }))}
                    placeholder="—" className={inputCls} />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">ETD estimada</label>
                  <input value={shipment.etd} onChange={(e) => setShipment((p) => ({ ...p, etd: e.target.value }))}
                    placeholder="DD/MM/AAAA" className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Descripción de mercadería</label>
                  <textarea value={shipment.description} onChange={(e) => setShipment((p) => ({ ...p, description: e.target.value }))}
                    rows={2} placeholder="Detalle de la mercadería..."
                    className={inputCls + ' resize-none'} />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Emails ── */}
          {step === 3 && (
            <div className="space-y-4">
              {allRecipients.length === 0 ? (
                <p className="text-sm text-slate-500 italic">Sin operadores seleccionados.</p>
              ) : (
                <>
                  {/* Tab bar */}
                  {allRecipients.length > 1 && (
                    <div className="flex gap-1 flex-wrap">
                      {allRecipients.map((r, i) => (
                        <button key={r.id} onClick={() => setActiveTab(i)}
                          className={cn('px-3 py-1 rounded-lg text-xs font-medium transition-colors',
                            activeTab === i ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white')}>
                          {r.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {allRecipients[activeTab] && (() => {
                    const r = allRecipients[activeTab]
                    const body = buildEmailBody(r, shipment, importTitle)
                    return (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-white">{r.name}</p>
                            {r.email && <p className="text-xs text-slate-400">{r.contact_name} · {r.email}</p>}
                            {!r.email && r.contact_name && <p className="text-xs text-slate-400">{r.contact_name}</p>}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => openMailto(r)}
                              title={r.email ? 'Abrir en cliente de email' : 'Sin email — agregá uno primero'}
                              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                                r.email ? 'bg-cyan-600 hover:bg-cyan-500 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed')}
                            >
                              <Mail size={12} /> Abrir en email
                            </button>
                            <button
                              onClick={() => copyText(r)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                            >
                              {copied === r.id ? <Check size={12} /> : <Copy size={12} />}
                              {copied === r.id ? 'Copiado' : 'Copiar texto'}
                            </button>
                          </div>
                        </div>
                        <pre className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-xs text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                          {body}
                        </pre>
                      </div>
                    )
                  })()}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700 shrink-0">
          <button onClick={step === 1 ? onClose : () => setStep((s) => (s - 1) as RFQStep)}
            className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-700 transition-colors">
            {step === 1 ? 'Cancelar' : '← Atrás'}
          </button>
          <div className="flex gap-2">
            {step < 3 ? (
              <button
                onClick={() => setStep((s) => (s + 1) as RFQStep)}
                disabled={step === 1 && allRecipients.length === 0}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 transition-colors"
              >
                Siguiente →
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={createQuote.isPending || allRecipients.length === 0}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-colors"
              >
                {createQuote.isPending ? 'Registrando...' : `Registrar ${allRecipients.length} solicitud${allRecipients.length !== 1 ? 'es' : ''}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Quotes section (upgraded) ─────────────────────────────────────────────────

function QuotesSection({
  importId, imp, customs, items
}: {
  importId: string
  imp: ComexImport
  customs: ComexCustoms | null | undefined
  items: Array<{ description: string }>
}) {
  const { data: quotes = [] } = useComexQuotesByImport(importId)
  const updateQuote = useUpdateComexQuote()
  const deleteQuote = useDeleteComexQuote()
  const [showRFQ, setShowRFQ] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const createQuote = useCreateComexQuote()
  const [manualForm, setManualForm] = useState({
    operator_name: '', contact: '', quote_amount: '', currency: 'USD', services_included: '', notes: ''
  })

  const handleManualAdd = async () => {
    if (!manualForm.operator_name.trim()) return
    await createQuote.mutateAsync({
      import_id: importId, operator_id: null,
      operator_name: manualForm.operator_name, contact: manualForm.contact,
      cargo_type: 'LCL', quote_amount: manualForm.quote_amount ? Number(manualForm.quote_amount) : null,
      currency: manualForm.currency, services_included: manualForm.services_included,
      valid_until: null, status: 'quoted', rfq_sent_at: null, rfq_email_text: '', notes: manualForm.notes
    } as Parameters<typeof window.api.comex.quotes.create>[0])
    setManualForm({ operator_name: '', contact: '', quote_amount: '', currency: 'USD', services_included: '', notes: '' })
    setShowManual(false)
  }

  const select = (q: ComexLogisticsQuote) =>
    updateQuote.mutate({ id: q.id, importId, data: { status: 'selected' } })

  const reject = (q: ComexLogisticsQuote) =>
    updateQuote.mutate({ id: q.id, importId, data: { status: 'rejected' } })

  const restore = (q: ComexLogisticsQuote) =>
    updateQuote.mutate({ id: q.id, importId, data: { status: 'quoted' } })

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <SectionHeader
        icon={Ship}
        title="Presupuestos logísticos"
        action={
          <div className="flex items-center gap-2">
            <button onClick={() => setShowManual(true)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-cyan-300 transition-colors">
              <Plus size={12} /> Manual
            </button>
            <button onClick={() => setShowRFQ(true)}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-colors">
              <Mail size={11} /> Solicitar cotizaciones
            </button>
          </div>
        }
      />

      {/* Quote table */}
      {quotes.length === 0 && !showManual ? (
        <p className="text-xs text-slate-500">
          Sin presupuestos. Usá{' '}
          <button onClick={() => setShowRFQ(true)} className="text-cyan-400 hover:underline">Solicitar cotizaciones</button>
          {' '}para enviar emails a tus operadores.
        </p>
      ) : (
        <div className="space-y-2 mt-1">
          {quotes.map((q) => {
            const statusColor = QUOTE_STATUS_COLORS[q.status]
            const isSelected = q.status === 'selected'
            const isRejected = q.status === 'rejected'
            const isRequested = q.status === 'requested'
            return (
              <div key={q.id}
                className={cn('border rounded-lg p-3 transition-colors',
                  isSelected ? 'border-emerald-600/50 bg-emerald-950/20' :
                  isRejected ? 'border-slate-700/30 opacity-50' : 'border-slate-700/50')}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-semibold text-slate-200">{q.operator_name}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: statusColor + '22', color: statusColor }}>
                        {QUOTE_STATUS_LABELS[q.status]}
                      </span>
                      {q.cargo_type && <span className="text-[10px] text-slate-500">{CARGO_TYPE_LABELS[q.cargo_type] ?? q.cargo_type}</span>}
                    </div>
                    {q.contact && <p className="text-[10px] text-slate-500 mt-0.5">{q.contact}</p>}
                    {q.services_included && <p className="text-[10px] text-slate-500 mt-0.5">{q.services_included}</p>}
                    {isRequested && q.rfq_sent_at && (
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        Solicitud enviada {dayjs(q.rfq_sent_at).format('DD/MM/YYYY HH:mm')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {q.quote_amount ? (
                      <span className="text-sm font-semibold text-cyan-400">
                        {q.currency} {q.quote_amount.toLocaleString('es-AR')}
                      </span>
                    ) : isRequested ? (
                      <span className="text-[10px] text-slate-500 italic">Esperando respuesta</span>
                    ) : null}
                    {!isSelected && !isRejected && !isRequested && (
                      <button onClick={() => select(q)}
                        className="text-[10px] px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors">
                        Seleccionar
                      </button>
                    )}
                    {isSelected && (
                      <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                        <Check size={11} /> Seleccionado
                      </span>
                    )}
                    {!isRejected && !isSelected && (
                      <button onClick={() => reject(q)} className="text-[10px] text-slate-600 hover:text-red-400 transition-colors">
                        Rechazar
                      </button>
                    )}
                    {isRejected && (
                      <button onClick={() => restore(q)} className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors">
                        Restaurar
                      </button>
                    )}
                    <button onClick={() => deleteQuote.mutate({ id: q.id, importId })}
                      className="text-slate-700 hover:text-red-400 transition-colors">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Manual add form */}
      {showManual && (
        <div className="mt-3 p-3 bg-slate-900/50 rounded-lg space-y-2 border border-slate-600">
          <input autoFocus value={manualForm.operator_name}
            onChange={(e) => setManualForm((p) => ({ ...p, operator_name: e.target.value }))}
            placeholder="Nombre del operador"
            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500" />
          <div className="grid grid-cols-2 gap-2">
            <input value={manualForm.contact} onChange={(e) => setManualForm((p) => ({ ...p, contact: e.target.value }))}
              placeholder="Contacto"
              className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500" />
            <div className="flex gap-1">
              <input type="number" value={manualForm.quote_amount}
                onChange={(e) => setManualForm((p) => ({ ...p, quote_amount: e.target.value }))}
                placeholder="Monto"
                className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500" />
              <select value={manualForm.currency} onChange={(e) => setManualForm((p) => ({ ...p, currency: e.target.value }))}
                className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500">
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <textarea value={manualForm.services_included}
            onChange={(e) => setManualForm((p) => ({ ...p, services_included: e.target.value }))}
            placeholder="Servicios incluidos..." rows={2}
            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 resize-none" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowManual(false)} className="text-xs text-slate-400 hover:text-white px-2 py-1">Cancelar</button>
            <button onClick={handleManualAdd} className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1 rounded">Agregar</button>
          </div>
        </div>
      )}

      {/* RFQ Modal */}
      {showRFQ && (
        <RFQModal
          importId={importId}
          importTitle={imp.title}
          imp={imp}
          customs={customs}
          items={items}
          onClose={() => setShowRFQ(false)}
        />
      )}
    </div>
  )
}

// ── Payments section ──────────────────────────────────────────────────────────

function PaymentsSection({ importId }: { importId: string }) {
  const { data: payments = [] } = useComexPayments(importId)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    amount: '', currency: 'USD', exchange_rate: '',
    payment_date: '', method: 'wire' as PaymentMethod,
    bank: '', reference: '', notes: ''
  })

  const handleAdd = async () => {
    if (!form.amount) return
    await window.api.comex.payments.create({
      import_id: importId,
      amount: Number(form.amount),
      currency: form.currency,
      exchange_rate: form.exchange_rate ? Number(form.exchange_rate) : null,
      payment_date: form.payment_date ? dayjs(form.payment_date).valueOf() : null,
      method: form.method,
      bank: form.bank,
      reference: form.reference,
      status: 'completed',
      notes: form.notes
    })
    setForm({ amount: '', currency: 'USD', exchange_rate: '', payment_date: '', method: 'wire', bank: '', reference: '', notes: '' })
    setAdding(false)
  }

  const totalUSD = payments.reduce((s, p) => {
    const fx = p.exchange_rate ?? 1
    return s + (p.currency === 'USD' ? p.amount : p.amount / fx)
  }, 0)

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <SectionHeader
        icon={DollarSign}
        title="Pagos"
        action={
          <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300">
            <Plus size={12} /> Registrar pago
          </button>
        }
      />

      {payments.length === 0 && !adding ? (
        <p className="text-xs text-slate-500">Sin pagos registrados.</p>
      ) : (
        <div className="space-y-1.5">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-1.5 border-b border-slate-700/50 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-200">
                  {p.currency} {p.amount.toLocaleString('es-AR')}
                </p>
                <p className="text-[10px] text-slate-500">
                  {PAYMENT_METHOD_LABELS[p.method]}
                  {p.payment_date ? ` · ${dayjs(p.payment_date).format('DD/MM/YY')}` : ''}
                  {p.reference ? ` · Ref: ${p.reference}` : ''}
                </p>
              </div>
              <button onClick={() => window.api.comex.payments.delete(p.id)} className="text-slate-600 hover:text-red-400 transition-colors">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {payments.length > 0 && (
            <div className="flex justify-end pt-1">
              <span className="text-xs text-cyan-400 font-semibold">
                Total: ~USD {Math.round(totalUSD).toLocaleString('es-AR')}
              </span>
            </div>
          )}
        </div>
      )}

      {adding && (
        <div className="mt-3 p-3 bg-slate-900/50 rounded-lg space-y-2 border border-slate-600">
          <div className="grid grid-cols-2 gap-2">
            <input
              autoFocus
              type="number"
              value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              placeholder="Monto"
              className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
            <select
              value={form.currency}
              onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
              className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={form.method}
              onChange={(e) => setForm((p) => ({ ...p, method: e.target.value as PaymentMethod }))}
              className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
              ))}
            </select>
            <input
              type="date"
              value={form.payment_date}
              onChange={(e) => setForm((p) => ({ ...p, payment_date: e.target.value }))}
              className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={form.bank}
              onChange={(e) => setForm((p) => ({ ...p, bank: e.target.value }))}
              placeholder="Banco"
              className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
            <input
              value={form.reference}
              onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))}
              placeholder="Referencia / número"
              className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setAdding(false)} className="text-xs text-slate-400 hover:text-white px-2 py-1">Cancelar</button>
            <button onClick={handleAdd} className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1 rounded">Registrar</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Detail View ──────────────────────────────────────────────────────────

export default function ComexImportDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: imp, isLoading } = useComexImport(id ?? null)
  const { data: suppliers = [] } = useComexSuppliers()
  const { data: customs }        = useComexCustoms(id ?? null)
  const { data: items = [] }     = useComexItems(id ?? null)
  const qc = useQueryClient()
  const update = useUpdateComexImport()
  const deleteImport = useDeleteComexImport()

  // Datos para resúmenes de secciones colapsadas
  const { data: tributos = [] } = useComexTributos(id ?? null)
  const { data: extras   = [] } = useComexExtraCosts(id ?? null)

  // Estado de secciones — por defecto abiertas las más importantes
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({
    costos:      true,
    datos:       true,
    anmat:       false,
    flete_int:   false,
    despacho:    true,
    tributos:    false,
    deposito:    false,
    despachante: false,
    flete_local: false,
    productos:   false,
    presupuestos: false,
  })

  const toggle   = (key: SectionKey) => setSections(s => ({ ...s, [key]: !s[key] }))
  const allOpen  = ALL_SECTION_KEYS.every(k => sections[k])
  const expandAll  = () => setSections(Object.fromEntries(ALL_SECTION_KEYS.map(k => [k, true])) as Record<SectionKey, boolean>)
  const collapseAll = () => setSections(Object.fromEntries(ALL_SECTION_KEYS.map(k => [k, false])) as Record<SectionKey, boolean>)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [driveLoading, setDriveLoading] = useState(false)
  const [driveError, setDriveError] = useState<string | null>(null)

  // Refrescar cuando Drive crea las carpetas automáticamente
  useEffect(() => {
    const handler = (importId: unknown) => {
      if (importId === id) {
        qc.invalidateQueries({ queryKey: ['comex-import', id] })
        qc.invalidateQueries({ queryKey: ['comex-extra-costs', id] })
      }
    }
    window.api.on('comex:import:folderReady', handler)
    return () => window.api.off('comex:import:folderReady')
  }, [id, qc])

  const handleDriveFolder = async () => {
    if (!imp) return
    setDriveError(null)

    // Already linked → just open it
    if (imp.drive_folder_id) {
      window.api.comex.drive.openFolder(imp.drive_folder_id)
      return
    }

    // Check auth first
    const authed = await window.api.comex.drive.isAuthenticated()
    if (!authed) {
      setDriveError('Conectá Google Drive en Configuración primero.')
      return
    }

    setDriveLoading(true)
    try {
      const result = await window.api.comex.drive.createFolder(imp.id, imp.title)
      // Update local query cache (the DB was already updated in IPC)
      update.mutate({ id: imp.id, data: { drive_folder_id: result.folderId } })
      window.api.shell.open(result.url)
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : 'Error al crear carpeta')
    } finally {
      setDriveLoading(false)
    }
  }

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center text-slate-500">Cargando...</div>
  }

  if (!imp) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-3">
        <p>Importación no encontrada.</p>
        <button onClick={() => navigate('/comex/imports')} className="text-cyan-400 hover:underline text-sm">
          Volver a importaciones
        </button>
      </div>
    )
  }

  const upd = (data: Partial<ComexImport>) => update.mutate({ id: imp.id, data })

  const statusColor = IMPORT_STATUS_COLORS[imp.status as ImportStatus]

  const handleDelete = async () => {
    await deleteImport.mutateAsync(imp.id)
    navigate('/comex/imports')
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">

      {/* Back + expand/collapse all */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/comex/imports')}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <ArrowLeft size={13} />
          Importaciones
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={expandAll}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
            title="Expandir todas las secciones"
          >
            <ChevronsDown size={13} />
            Expandir todo
          </button>
          <button
            onClick={collapseAll}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
            title="Colapsar todas las secciones"
          >
            <ChevronsUp size={13} />
            Colapsar
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-1">
          {/* Status badge */}
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: statusColor + '22', color: statusColor }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
              {IMPORT_STATUS_LABELS[imp.status as ImportStatus]}
            </span>
            {imp.incoterm && (
              <span className="text-[10px] text-slate-500 bg-slate-700 px-2 py-0.5 rounded-full">
                {imp.incoterm}
              </span>
            )}
          </div>

          {/* Editable title */}
          <EditableTitle value={imp.title} onSave={(v) => upd({ title: v })} />

          {imp.supplier && (
            <p className="text-sm text-slate-400">{imp.supplier.name} · {imp.supplier.country}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Drive folder button */}
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={handleDriveFolder}
              disabled={driveLoading}
              title={imp.drive_folder_id ? 'Abrir carpeta en Drive' : 'Crear carpeta en Drive'}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                imp.drive_folder_id
                  ? 'bg-emerald-700/40 hover:bg-emerald-700/60 text-emerald-300'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
              )}
            >
              {driveLoading
                ? <Loader2 size={13} className="animate-spin" />
                : <FolderOpen size={13} />
              }
              {imp.drive_folder_id ? 'Abrir en Drive' : 'Crear carpeta Drive'}
            </button>
            {driveError && (
              <p className="text-[10px] text-red-400 max-w-[180px] text-right">{driveError}</p>
            )}
          </div>

          {/* Status dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs text-slate-200 transition-colors">
              Cambiar estado
              <ChevronDown size={12} />
            </button>
            <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-10 hidden group-hover:block min-w-[180px]">
              {ALL_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => upd({ status: s })}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-slate-700 transition-colors first:rounded-t-xl last:rounded-b-xl',
                    imp.status === s ? 'text-cyan-300' : 'text-slate-300'
                  )}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: IMPORT_STATUS_COLORS[s] }} />
                  {IMPORT_STATUS_LABELS[s]}
                  {imp.status === s && <Check size={11} className="ml-auto" />}
                </button>
              ))}
            </div>
          </div>

          {/* Delete */}
          {showDeleteConfirm ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-red-400">¿Eliminar?</span>
              <button onClick={handleDelete} className="p-1.5 rounded bg-red-600 hover:bg-red-500 text-white">
                <Check size={12} />
              </button>
              <button onClick={() => setShowDeleteConfirm(false)} className="p-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white">
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── Timeline ── */}
      <ImportTimeline
        currentStatus={imp.status as ImportStatus}
        onChangeStatus={(s) => upd({ status: s })}
      />

      {/* ── Meta panel ── */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-4">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
          Datos generales — click en cualquier campo para editar
        </p>

        {/* Row 1: Estado / Incoterm / Proveedor / Moneda */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <EditableSelect
            label="Estado"
            value={imp.status as ImportStatus}
            options={ALL_STATUSES.map((s) => ({ value: s, label: IMPORT_STATUS_LABELS[s] }))}
            onChange={(v) => upd({ status: v })}
          />
          <EditableSelect
            label="Incoterm"
            value={(imp.incoterm || 'FOB') as typeof INCOTERMS[number]}
            options={INCOTERMS.map((t) => ({ value: t, label: t }))}
            onChange={(v) => upd({ incoterm: v })}
          />
          <EditableSelect
            label="Proveedor"
            value={imp.supplier_id ?? ''}
            options={[
              { value: '', label: 'Sin proveedor' },
              ...suppliers.map((s) => ({ value: s.id, label: s.name }))
            ]}
            onChange={(v) => {
              const supplier = v ? suppliers.find((s) => s.id === v) : undefined
              const updates: Partial<ComexImport> = { supplier_id: v || null }
              if (supplier) {
                if (supplier.incoterms_preferred) updates.incoterm = supplier.incoterms_preferred
                if (supplier.country) updates.origin_country = supplier.country
                const ports = supplier.port_of_origin
                  ? supplier.port_of_origin.split('|').map((p) => p.trim()).filter(Boolean)
                  : []
                updates.origin_port = ports.length === 1 ? ports[0] : ''
              }
              upd(updates)
            }}
          />
          <EditableSelect
            label="Moneda"
            value={imp.currency || 'USD'}
            options={IMPORT_CURRENCIES.map((c) => ({ value: c, label: c }))}
            onChange={(v) => upd({ currency: v })}
          />
        </div>

        {/* Row 2: País (readonly) / Marca (readonly) / Puerto de embarque / [vacío] */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* País de origen — read-only, derivado del proveedor */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">País de origen</p>
            <p className={cn('text-sm mt-0.5', (imp.supplier?.country || imp.origin_country) ? 'text-slate-200' : 'text-slate-600 italic')}>
              {imp.supplier?.country || imp.origin_country || '—'}
            </p>
          </div>
          {/* Marca — read-only, derivada del proveedor */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Marca</p>
            <p className={cn('text-sm mt-0.5', imp.supplier?.brand ? 'text-slate-200' : 'text-slate-600 italic')}>
              {imp.supplier?.brand || '—'}
            </p>
          </div>
          {/* Puerto de embarque */}
          {(() => {
            const supplierPorts = imp.supplier?.port_of_origin
              ? imp.supplier.port_of_origin.split('|').map((p) => p.trim()).filter(Boolean)
              : []
            return (
              <EditableSelect
                label="Puerto de embarque"
                value={imp.origin_port ?? ''}
                options={[
                  { value: '', label: '— Sin puerto —' },
                  ...supplierPorts.map((p) => ({ value: p, label: p }))
                ]}
                onChange={(v) => upd({ origin_port: v })}
              />
            )
          })()}
        </div>

        {/* Row 3: Valores */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <EditableNumber
            label="Valor proforma"
            value={imp.estimated_value}
            onSave={(v) => upd({ estimated_value: v })}
            prefix={`${imp.currency} `}
          />
          <EditableNumber
            label="Valor factura"
            value={imp.actual_value}
            onSave={(v) => upd({ actual_value: v })}
            prefix={`${imp.currency} `}
          />
        </div>

        {/* Row 4: Fechas operativas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <EditableDate label="Fecha pedido enviado"        value={imp.order_date}   onSave={(v) => upd({ order_date: v })} />
          <EditableDate label="Fecha de pago"               value={imp.payment_date} onSave={(v) => upd({ payment_date: v })} />
          <EditableDate label="ETD — Fecha salida estimada" value={imp.ship_date}    onSave={(v) => upd({ ship_date: v })} />
        </div>

        {/* ETA — Fecha llegada estimada */}
        {(() => {
          const etas: { label: string; key: keyof ComexImport }[] = [
            { label: 'ETA 1', key: 'arrival_date' },
            { label: 'ETA 2', key: 'eta_2' },
            { label: 'ETA 3', key: 'eta_3' },
            { label: 'ETA 4', key: 'eta_4' },
          ]
          const etaValues = etas.map(({ key }) => imp[key] as number | null)
          const lastFilledIdx = etaValues.reduce<number>((last, v, i) => (v != null ? i : last), -1)
          return (
            <div className="rounded-lg border border-slate-700/60 bg-slate-700/20 p-3 space-y-2">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium flex items-center gap-2">
                <span className="w-1 h-3 rounded-full bg-cyan-500/70 inline-block" />
                ETA — Fecha llegada estimada
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {etas.map(({ label, key }, idx) => {
                  const isCurrent = idx === lastFilledIdx && imp[key] != null
                  return (
                    <div key={key} className={cn('rounded-lg px-2.5 py-2 transition-colors', isCurrent ? 'bg-cyan-900/30 ring-1 ring-cyan-600/50' : 'bg-slate-800/80')}>
                      <EditableDate label={label} value={imp[key] as number | null} onSave={(v) => upd({ [key]: v })} />
                      {isCurrent && <span className="text-[9px] text-cyan-400 mt-1 block font-medium tracking-wide">▲ estimada actual</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* Notas — al final de Datos generales */}
        <div className="pt-3 border-t border-slate-700/50">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">Notas</p>
          <EditableText label="" value={imp.notes} onSave={(v) => upd({ notes: v })} placeholder="Sin notas — click para agregar" multiline />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECCIONES COLAPSABLES — en el orden definido
      ════════════════════════════════════════════════════════════════════════ */}

      {/* 1. Resumen de costos */}
      {(() => {
        const costSummary = imp.cost_pct != null ? `${imp.cost_pct.toFixed(1)}% sobre valor factura` : undefined
        return (
          <CollapsibleSection label="Resumen de costos" icon={DollarSign} accentColor="border-l-amber-600"
            isOpen={sections.costos} onToggle={() => toggle('costos')} summary={costSummary}>
            <div className="p-4"><CostDashboard importId={imp.id} imp={imp} /></div>
          </CollapsibleSection>
        )
      })()}

      {/* 2. Certificaciones ANMAT */}
      {(() => {
        const inalSummary = imp.inal_required === 1
          ? `Requiere INAL · ${imp.inal_lc_status === 'finalizado' ? 'Finalizado' : imp.inal_lc_status === 'en_tramite' ? 'En trámite' : 'Pendiente'}`
          : 'Sin INAL requerido'
        return (
          <CollapsibleSection label="Certificaciones ANMAT" icon={ShieldCheck} accentColor="border-l-emerald-600"
            isOpen={sections.anmat} onToggle={() => toggle('anmat')} summary={inalSummary}>
            <div className="p-4"><InalSection imp={imp} onUpdate={(data) => upd(data)} /></div>
          </CollapsibleSection>
        )
      })()}

      {/* 3. Flete internacional */}
      {(() => {
        const fleteIntExtras = extras.filter(c => c.categoria === 'flete_internacional')
        const fleteIntTotal  = fleteIntExtras.reduce((s, c) => s + costToARS(c, customs?.dolar_aduana ?? 0), 0)
        const fleteIntSummary = fleteIntTotal > 0
          ? `${fleteIntExtras.length} factura${fleteIntExtras.length !== 1 ? 's' : ''} · $${Math.round(fleteIntTotal).toLocaleString('es-AR')} ARS`
          : 'Sin facturas'
        return (
          <CollapsibleSection label="Flete internacional" icon={Ship} accentColor="border-l-blue-600"
            isOpen={sections.flete_int} onToggle={() => toggle('flete_int')} summary={fleteIntSummary}>
            <div className="p-4"><FleteSection imp={imp} categoria="flete_internacional" /></div>
          </CollapsibleSection>
        )
      })()}

      {/* 4. Despacho de Aduana (PDF + campos aduaneros) — sección unificada */}
      {(() => {
        const despSummary = [
          customs?.despacho_number,
          customs?.oficializacion_date ? dayjs(customs.oficializacion_date).format('DD/MM/YYYY') : null,
          imp.despacho_stored_name ? '📄 PDF' : null,
          imp.drive_folder_id && imp.despacho_drive_status === 'synced' ? '☁ Drive' : null,
        ].filter(Boolean).join(' · ')
        return (
          <CollapsibleSection label="Despacho de Aduana" icon={Landmark} accentColor="border-l-cyan-600"
            isOpen={sections.despacho} onToggle={() => toggle('despacho')} summary={despSummary || 'Sin despacho adjunto'}>
            {/* PDF del despacho */}
            <DespachoSection imp={imp} />
            {/* Separador */}
            <div className="mx-4 border-t border-slate-700/30 pt-1 pb-0">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider px-0 py-2 font-semibold">
                Despacho & Aduanas — click en cualquier campo para editar
              </p>
            </div>
            {/* Campos del despacho (sin container propio) */}
            <CustomsSection importId={imp.id} inner />
          </CollapsibleSection>
        )
      })()}

      {/* 5. Tributos, impuestos y derechos */}
      {(() => {
        const derechosUSD = tributos.filter(t => esCostoReal(t.codigo)).reduce((s, t) => s + t.importe_usd, 0)
        const tributosSummary = tributos.length > 0
          ? `${tributos.length} conceptos · USD ${derechosUSD.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
          : 'Sin datos'
        return (
          <CollapsibleSection label="Tributos, impuestos y derechos" icon={DollarSign} accentColor="border-l-amber-600"
            isOpen={sections.tributos} onToggle={() => toggle('tributos')} summary={tributosSummary}>
            <div className="p-4"><TributosSection imp={imp} /></div>
          </CollapsibleSection>
        )
      })()}

      {/* 6. Depósito fiscal */}
      {(() => {
        const depositoCost = extras.find(c => c.categoria === 'deposito_fiscal')
        const depositoSummary = depositoCost?.importe > 0
          ? `${depositoCost.proveedor || 'Sin proveedor'} · $${Math.round(depositoCost.importe).toLocaleString('es-AR')}`
          : 'Sin factura'
        return (
          <CollapsibleSection label="Depósito fiscal" icon={Package} accentColor="border-l-violet-600"
            isOpen={sections.deposito} onToggle={() => toggle('deposito')} summary={depositoSummary}>
            <div className="p-4">
              {depositoCost
                ? <FixedCostSection cost={depositoCost} importId={imp.id} />
                : <p className="text-xs text-slate-500">Sin datos de depósito fiscal.</p>}
            </div>
          </CollapsibleSection>
        )
      })()}

      {/* 7. Despachante */}
      {(() => {
        const despachanteCost = extras.find(c => c.categoria === 'despachante')
        const despachanteSummary = despachanteCost?.importe > 0
          ? `${despachanteCost.proveedor || 'Sin proveedor'} · $${Math.round(despachanteCost.importe).toLocaleString('es-AR')}`
          : 'Sin factura'
        return (
          <CollapsibleSection label="Despachante" icon={FileText} accentColor="border-l-violet-600"
            isOpen={sections.despachante} onToggle={() => toggle('despachante')} summary={despachanteSummary}>
            <div className="p-4">
              {despachanteCost
                ? <FixedCostSection cost={despachanteCost} importId={imp.id} />
                : <p className="text-xs text-slate-500">Sin datos del despachante.</p>}
            </div>
          </CollapsibleSection>
        )
      })()}

      {/* 8. Flete local */}
      {(() => {
        const fleteLocExtras = extras.filter(c => c.categoria === 'flete_local')
        const fleteLocTotal  = fleteLocExtras.reduce((s, c) => s + costToARS(c, customs?.dolar_aduana ?? 0), 0)
        const fleteLocSummary = fleteLocTotal > 0
          ? `${fleteLocExtras.length} factura${fleteLocExtras.length !== 1 ? 's' : ''} · $${Math.round(fleteLocTotal).toLocaleString('es-AR')} ARS`
          : 'Sin facturas'
        return (
          <CollapsibleSection label="Flete local" icon={Ship} accentColor="border-l-blue-600"
            isOpen={sections.flete_local} onToggle={() => toggle('flete_local')} summary={fleteLocSummary}>
            <div className="p-4"><FleteSection imp={imp} categoria="flete_local" /></div>
          </CollapsibleSection>
        )
      })()}

      {/* 9. Productos */}
      {(() => {
        const prodSummary = items.length > 0
          ? `${items.length} ítem${items.length !== 1 ? 's' : ''} · ${imp.currency} ${items.reduce((s,i) => s + i.quantity * i.unit_price, 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
          : 'Sin ítems'
        return (
          <CollapsibleSection label="Productos" icon={Package} accentColor="border-l-slate-500"
            isOpen={sections.productos} onToggle={() => toggle('productos')} summary={prodSummary}>
            <div className="p-4"><ItemsSection importId={imp.id} /></div>
          </CollapsibleSection>
        )
      })()}

      {/* 10. Presupuestos logísticos */}
      <CollapsibleSection label="Presupuestos logísticos" icon={Ship} accentColor="border-l-slate-500"
        isOpen={sections.presupuestos} onToggle={() => toggle('presupuestos')}>
        <div className="p-4">
          <QuotesSection importId={imp.id} imp={imp} customs={customs} items={items} />
        </div>
      </CollapsibleSection>

    </div>
  )
}

// ── INAL / ANMAT Section ──────────────────────────────────────────────────────

const INAL_LC_FLOW: InalLCStatus[] = ['pendiente', 'en_tramite', 'finalizado']
const INAL_LC_LABELS: Record<InalLCStatus, string> = {
  pendiente:   'Pendiente',
  en_tramite:  'En trámite',
  finalizado:  'Finalizado'
}
const INAL_LC_COLORS: Record<InalLCStatus, string> = {
  pendiente:  '#64748b',   // slate
  en_tramite: '#f59e0b',   // amber
  finalizado: '#22c55e'    // green
}

function InalSection({
  imp,
  onUpdate
}: {
  imp: ComexImport
  onUpdate: (data: Partial<ComexImport>) => void
}) {
  const inalOn = imp.inal_required === 1
  const lcStatus: InalLCStatus = (imp.inal_lc_status as InalLCStatus) || 'pendiente'
  const lcColor = INAL_LC_COLORS[lcStatus]

  // Drag state for cert upload
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounter = useRef(0)

  const { data: certs = [] } = useComexInalCerts(inalOn ? imp.id : null)
  const uploadCert = useUploadInalCert(imp.id)
  const deleteCert = useDeleteInalCert(imp.id)

  // Effective ETA: last non-null in ETA4 → ETA3 → ETA2 → ETA1 → ETD
  const effectiveEta =
    imp.eta_4 ?? imp.eta_3 ?? imp.eta_2 ?? imp.arrival_date ?? imp.ship_date ?? null
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000
  const taskDue = effectiveEta ? effectiveEta - SEVEN_DAYS : null
  const taskScheduled = imp.inal_lc_task_scheduled === 1
  const taskId = imp.inal_lc_task_id ?? null
  const taskTitle = `Tramitar Libre Circulación de "${imp.title}"`
  const queryClient = useQueryClient()

  // Fallback: busca la tarea por título cuando no tenemos el ID guardado
  const resolveTaskId = useCallback(async (): Promise<string | null> => {
    if (taskId) return taskId
    const all = await window.api.tasks.list()
    return all.find((t) => t.title === taskTitle)?.id ?? null
  }, [taskId, taskTitle])

  const handleScheduleTask = async () => {
    if (!taskDue) return
    try {
      const task = await window.api.tasks.create({
        title: taskTitle,
        due_date: taskDue,
        priority: 2,
        status: 'pending'
      })
      onUpdate({ inal_lc_task_scheduled: 1, inal_lc_task_id: task.id })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    } catch (err) {
      console.error('[INAL] Error creando tarea:', err)
    }
  }

  const handleRescheduleTask = async () => {
    if (!taskDue) return
    try {
      const id = await resolveTaskId()
      if (id) {
        await window.api.tasks.update(id, { due_date: taskDue })
        // Guardar el ID si no lo teníamos
        onUpdate({ inal_lc_task_scheduled: 1, inal_lc_task_id: id })
      } else {
        // No existe — crear nueva
        const task = await window.api.tasks.create({
          title: taskTitle,
          due_date: taskDue,
          priority: 2,
          status: 'pending'
        })
        onUpdate({ inal_lc_task_scheduled: 1, inal_lc_task_id: task.id })
      }
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    } catch (err) {
      console.error('[INAL] Error reprogramando tarea:', err)
    }
  }

  const handleDeleteTask = async () => {
    try {
      const id = await resolveTaskId()
      if (id) await window.api.tasks.delete(id)
    } catch { /* ya no existe */ }
    onUpdate({ inal_lc_task_scheduled: 0, inal_lc_task_id: null })
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
  }

  const handleUpload = (filePath: string) => {
    uploadCert.mutate({
      filePath,
      importTitle: imp.title,
      importFolderId: imp.drive_folder_id,
      certFolderId: imp.inal_lc_cert_folder_id
    })
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const fp = window.api.getPathForFile(file)
    if (fp) handleUpload(fp)
  }

  const handleSelectFile = async () => {
    const fp = await window.api.comex.documents.selectFile()
    if (fp) handleUpload(fp)
  }

  const advanceLCStatus = () => {
    const idx = INAL_LC_FLOW.indexOf(lcStatus)
    if (idx < INAL_LC_FLOW.length - 1) {
      onUpdate({ inal_lc_status: INAL_LC_FLOW[idx + 1] })
    }
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
              Certificaciones ANMAT
            </p>
            <p className="text-[10px] text-slate-600">Envases líquidos y alimentos</p>
          </div>
        </div>
        {/* Lleva INAL toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Lleva INAL:</span>
          <div className="flex rounded-lg overflow-hidden border border-slate-600">
            <button
              onClick={() => onUpdate({ inal_required: 1 })}
              className={cn(
                'px-3 py-1 text-xs font-medium transition-colors',
                inalOn
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:text-white'
              )}
            >
              Sí
            </button>
            <button
              onClick={() => onUpdate({ inal_required: 0 })}
              className={cn(
                'px-3 py-1 text-xs font-medium transition-colors',
                !inalOn
                  ? 'bg-slate-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:text-white'
              )}
            >
              No
            </button>
          </div>
        </div>
      </div>

      {/* Content — solo visible si INAL está activo */}
      {inalOn && (
        <div className="space-y-4 pt-1 border-t border-slate-700">

          {/* ── Emisión Libre Circulación ── */}
          <div className="space-y-3">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">
              Emisión Libre Circulación
            </p>

            {/* Estado flow */}
            <div className="flex items-center gap-1.5">
              {INAL_LC_FLOW.map((s, idx) => {
                const current = s === lcStatus
                const done = INAL_LC_FLOW.indexOf(lcStatus) > idx
                return (
                  <React.Fragment key={s}>
                    <button
                      onClick={() => onUpdate({ inal_lc_status: s })}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                        current
                          ? 'border-transparent text-white'
                          : done
                            ? 'border-slate-600 text-slate-400 bg-slate-700/50'
                            : 'border-slate-700 text-slate-500 hover:text-slate-300 bg-slate-800'
                      )}
                      style={current ? { backgroundColor: lcColor + '33', borderColor: lcColor, color: lcColor } : {}}
                    >
                      {s === 'finalizado' && done ? (
                        <CheckCircle2 size={11} />
                      ) : s === 'en_tramite' && (current || done) ? (
                        <Clock size={11} />
                      ) : null}
                      {INAL_LC_LABELS[s]}
                    </button>
                    {idx < INAL_LC_FLOW.length - 1 && (
                      <ChevronRight size={11} className="text-slate-600 flex-shrink-0" />
                    )}
                  </React.Fragment>
                )
              })}
            </div>

            {/* Tarea de tramitación */}
            <div className="bg-slate-700/30 rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-2">
                <ClipboardList size={13} className={cn('mt-0.5 flex-shrink-0', taskScheduled ? 'text-emerald-400' : 'text-slate-500')} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 truncate">
                    Tramitar Libre Circulación de &ldquo;{imp.title}&rdquo;
                  </p>
                  {taskDue ? (
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Vence: <span className="text-slate-300">{dayjs(taskDue).format('DD/MM/YYYY')}</span>
                      {' '}<span className="text-slate-600">(7 días antes de la ETA más reciente)</span>
                    </p>
                  ) : (
                    <p className="text-[10px] text-amber-500 mt-0.5">
                      Configurá al menos una ETA para calcular el vencimiento
                    </p>
                  )}
                </div>
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-2 pl-5">
                {!taskScheduled ? (
                  <button
                    onClick={handleScheduleTask}
                    disabled={!taskDue}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus size={11} /> Programar tarea
                  </button>
                ) : (
                  <>
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                      <CheckCircle2 size={12} /> Programada
                    </span>
                    <button
                      onClick={handleRescheduleTask}
                      disabled={!taskDue}
                      className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg bg-slate-600 hover:bg-slate-500 text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Reprogramar
                    </button>
                    <button
                      onClick={handleDeleteTask}
                      className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg bg-red-900/40 hover:bg-red-900/70 text-red-400 transition-colors"
                    >
                      <Trash2 size={10} /> Eliminar
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── Certificados (solo cuando finalizado) ── */}
          {lcStatus === 'finalizado' && (
            <div className="space-y-2">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">
                Certificados INAL
              </p>

              {/* Drop zone */}
              <div
                onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setIsDragOver(true) }}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={() => { dragCounter.current--; if (dragCounter.current === 0) setIsDragOver(false) }}
                onDrop={handleDrop}
                className={cn(
                  'border-2 border-dashed rounded-lg p-4 text-center transition-colors',
                  isDragOver
                    ? 'border-emerald-500 bg-emerald-900/20'
                    : 'border-slate-600 hover:border-slate-500'
                )}
              >
                {uploadCert.isPending ? (
                  <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                    <Loader2 size={14} className="animate-spin" /> Subiendo...
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400">Arrastrá un certificado o</p>
                    <button
                      onClick={handleSelectFile}
                      className="text-xs text-cyan-400 hover:text-cyan-300 underline"
                    >
                      seleccioná un archivo
                    </button>
                    {imp.drive_folder_id && (
                      <p className="text-[10px] text-slate-600 mt-1">Se subirá a la carpeta "Certificados INAL" en Drive</p>
                    )}
                  </div>
                )}
              </div>

              {/* Cert list */}
              {certs.length > 0 && (
                <div className="space-y-1">
                  {certs.map((cert: ComexInalCert) => (
                    <div key={cert.id} className="flex items-center gap-2 px-3 py-2 bg-slate-700/40 rounded-lg group">
                      <FileText size={12} className="text-slate-400 flex-shrink-0" />
                      <span className="flex-1 text-xs text-slate-300 truncate">{cert.original_name}</span>
                      {cert.size_bytes && (
                        <span className="text-[10px] text-slate-500">{formatBytes(cert.size_bytes)}</span>
                      )}
                      {cert.drive_status === 'synced' && <Cloud size={12} className="text-emerald-400" />}
                      {cert.drive_status === 'uploading' && <Loader2 size={12} className="text-cyan-400 animate-spin" />}
                      {cert.drive_status === 'error' && <CloudOff size={12} className="text-red-400" />}
                      <button
                        onClick={() => deleteCert.mutate(cert.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
