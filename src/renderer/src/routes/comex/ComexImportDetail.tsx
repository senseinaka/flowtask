import React, { useState, useRef, useEffect, useCallback } from 'react'
import { toast } from '../../store/toast.store'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Package, Trash2, Check, X, Plus,
  FileText, DollarSign, Ship, ChevronDown, Edit2,
  FolderOpen, Loader2, Mail, Copy, Upload, CloudOff, Cloud, AlertCircle, ExternalLink, Paperclip,
  ShieldCheck, Shield, ClipboardList, CheckCircle2, Clock, ChevronRight, Bot, Sparkles,
  ChevronsDown, ChevronsUp, Landmark, FileSpreadsheet, FileDown, Receipt, PackageOpen
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
  useComexSepaimpoPayments,
  useCreateComexSepaimpoPayment,
  useDeleteComexSepaimpoPayment,
  useComexSuppliers,
  useComexCustoms,
  useUpsertComexCustoms,
  useComexFreightOperators,
  useComexDespachantes,
  useComexQuotesByImport,
  useCreateComexQuote,
  useUpdateComexQuote,
  useDeleteComexQuote,
  useComexQuoteFiles,
  useUploadComexQuoteFile,
  useDeleteComexQuoteFile,
  useCreateComexDocument,
  useUpdateComexDocument,
  useDeleteComexDocument,
  useUploadComexDocument,
  useUploadNewComexDocument,
  useComexInalCerts,
  useUploadInalCert,
  useDeleteInalCert,
  useInalVeps,
  useUploadInalVep,
  useDeleteInalVep,
  useInalVepLiveUpdates
} from '../../hooks/useComex'
import CustomsSection from './CustomsSection'
import CostsSection from './CostsSection'
import {
  IMPORT_STATUS_LABELS,
  IMPORT_STATUS_COLORS,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  FREIGHT_QUOTE_STATUS_LABELS,
  FREIGHT_QUOTE_STATUS_COLORS,
  CARGO_TYPE_LABELS,
  INCOTERMS,
  CARGO_STATUS_LABELS,
  FORWARDER_STATUS_LABELS,
  CARGO_COLOR,
  FORWARDER_COLOR,
  isReadyToShip
} from '@shared/types'
import type {
  ImportStatus, DocumentType, DocumentStatus, DriveDocStatus,
  PaymentMethod, ComexImport, ComexDocument, ComexInalCert,
  InalLCStatus,
  ComexFreightOperator, CargoType, ComexLogisticsQuote, ComexQuoteFile, ComexCustoms,
  ComexImportPlFile,
  UpsertComexCustomsInput,
  CargoStatus, ForwarderStatus
} from '@shared/types'
import { cn, formatBytes } from '../../components/ui/utils'
import { sanitizeHtml } from '../../lib/sanitize'
import WhatsAppCargaModal from '../../components/whatsapp/WhatsAppCargaModal'
import { useAnalyzeComexDocument, useAIConfigured, useAnalyzeDespacho, useAnalyzeBL, useAnalyzePlFile } from '../../hooks/useAI'
import {
  useUploadDespacho, useDeleteDespacho,
  useComexTributos, useCreateComexTributo, useUpdateComexTributo,
  useDeleteComexTributo, useUpsertComexTributos,
  useComexExtraCosts, useCreateComexExtraCost, useUpdateComexExtraCost,
  useDeleteComexExtraCost, useUploadExtraCostInvoice,
  useComexProformas, useComexFacturasComerciales,
  useCreateComexProforma, useUpdateComexProforma,
  useDeleteComexProforma, useUploadProforma
} from '../../hooks/useComex'
import { useAnalyzeExtraCost, useAnalyzeProforma } from '../../hooks/useAI'
import type { ComexProforma, ExtractedProforma } from '@shared/types'
import type {
  ComexImportTributo, ComexImportExtraCost,
  ExtraCostCategory, EXTRA_COST_CATEGORY_LABELS as ECL
} from '@shared/types'
import {
  EXTRA_COST_CATEGORIES, EXTRA_COST_CATEGORY_LABELS
} from '@shared/types'
import type { AIAnalysisResult, ExtractedDespacho, ExtractedFactura } from '@shared/types'

const ALL_STATUSES = Object.keys(IMPORT_STATUS_LABELS) as ImportStatus[]
// 'listo_para_embarcar' es un estado derivado (carga armada + forwarder seleccionado,
// ver isReadyToShip) — nunca se elige a mano, solo lo setea el auto-avance.
const MANUALLY_SELECTABLE_STATUSES = ALL_STATUSES.filter((s) => s !== 'listo_para_embarcar')
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
  label, value, onSave, prefix = '', suffix = '', placeholder = '—'
}: {
  label: string
  value: number | null | undefined
  onSave: (v: number | null) => void
  prefix?: string
  suffix?: string
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
        {value != null ? `${prefix}${value.toLocaleString('es-AR')}${suffix}` : placeholder}
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

/** Combined sent-toggle + DD/MM date — para "Docs enviados a X" */
function EditableSentDate({
  label, sent, date, onSentChange, onDateSave
}: {
  label: string
  sent: 0 | 1
  date: number | null | undefined
  onSentChange: (sent: boolean) => void
  onDateSave: (ts: number | null) => void
}) {
  const year = new Date().getFullYear()
  // localDay/localMonth persisten entre campo día → campo mes (date aún no guardado)
  const [localDay,   setLocalDay]   = useState(() => date ? String(dayjs(date).date())      : '')
  const [localMonth, setLocalMonth] = useState(() => date ? String(dayjs(date).month() + 1) : '')
  const [editingField, setEditingField] = useState<'day' | 'month' | null>(null)
  const [draft, setDraft] = useState('')
  const monthRef   = useRef<HTMLInputElement>(null)
  const skipBlurRef = useRef(false)  // evita que el blur del auto-advance cierre el campo mes

  // Sincronizar desde prop cuando no estamos editando (ej: sync externo)
  useEffect(() => {
    if (editingField !== null) return
    setLocalDay(date ? String(dayjs(date).date())      : '')
    setLocalMonth(date ? String(dayjs(date).month() + 1) : '')
  }, [date]) // eslint-disable-line react-hooks/exhaustive-deps

  function tryBuildTs(d: string, m: string): number | null {
    const dd = parseInt(d, 10), mm = parseInt(m, 10)
    if (!dd || !mm || dd < 1 || dd > 31 || mm < 1 || mm > 12) return null
    const ts = dayjs(`${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`)
    return ts.isValid() ? ts.valueOf() : null
  }

  function advanceToMonth(dayVal: string) {
    const d = dayVal || localDay
    setLocalDay(d)
    const ts = tryBuildTs(d, localMonth)
    if (ts) onDateSave(ts)
    skipBlurRef.current = true
    setDraft(localMonth)
    setEditingField('month')
    setTimeout(() => monthRef.current?.focus(), 30)
  }

  const isSent = Boolean(sent)

  return (
    <div>
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">{label}</p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            if (isSent) {
              onSentChange(false); onDateSave(null)
              setLocalDay(''); setLocalMonth('')
            } else {
              onSentChange(true)
            }
          }}
          className={cn(
            'w-[18px] h-[18px] flex-shrink-0 rounded border transition-colors flex items-center justify-center',
            isSent ? 'bg-cyan-600 border-cyan-600' : 'border-slate-600 hover:border-slate-400'
          )}
        >
          {isSent && <Check size={10} strokeWidth={3} className="text-white" />}
        </button>

        <div className="flex items-center gap-1">
          {editingField === 'day' ? (
            <input
              autoFocus
              type="text"
              inputMode="numeric"
              maxLength={2}
              placeholder="DD"
              value={draft}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 2)
                setDraft(v)
                if (v.length === 2) advanceToMonth(v)
              }}
              onBlur={() => {
                if (skipBlurRef.current) { skipBlurRef.current = false; return }
                if (draft) setLocalDay(draft)
                const ts = tryBuildTs(draft || localDay, localMonth)
                if (ts) onDateSave(ts)
                setEditingField(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === '/' || e.key === 'Tab') {
                  e.preventDefault(); advanceToMonth(draft)
                }
                if (e.key === 'Escape') setEditingField(null)
              }}
              className="w-8 bg-slate-700 border border-cyan-600 rounded px-1 py-0.5 text-xs text-white text-center focus:outline-none"
            />
          ) : (
            <button
              disabled={!isSent}
              onClick={() => { if (isSent) { setDraft(localDay); setEditingField('day') } }}
              className={cn(
                'w-8 h-[22px] rounded border text-[11px] text-center transition-colors',
                !isSent    ? 'border-slate-800 text-slate-700 cursor-default'
                : localDay  ? 'border-slate-600 bg-slate-700/40 text-slate-200 hover:border-cyan-600 hover:text-cyan-300'
                            : 'border-dashed border-slate-600 text-slate-600 hover:border-cyan-600'
              )}
            >
              {localDay || 'DD'}
            </button>
          )}

          <span className={cn('text-xs', !isSent ? 'text-slate-800' : 'text-slate-500')}>/</span>

          {editingField === 'month' ? (
            <input
              ref={monthRef}
              autoFocus
              type="text"
              inputMode="numeric"
              maxLength={2}
              placeholder="MM"
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 2))}
              onBlur={() => {
                if (draft) setLocalMonth(draft)
                const ts = tryBuildTs(localDay, draft || localMonth)
                if (ts) onDateSave(ts)
                setEditingField(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (draft) setLocalMonth(draft)
                  const ts = tryBuildTs(localDay, draft || localMonth)
                  if (ts) onDateSave(ts)
                  setEditingField(null)
                }
                if (e.key === 'Escape') setEditingField(null)
              }}
              className="w-8 bg-slate-700 border border-cyan-600 rounded px-1 py-0.5 text-xs text-white text-center focus:outline-none"
            />
          ) : (
            <button
              disabled={!isSent}
              onClick={() => { if (isSent) { setDraft(localMonth); setEditingField('month') } }}
              className={cn(
                'w-8 h-[22px] rounded border text-[11px] text-center transition-colors',
                !isSent     ? 'border-slate-800 text-slate-700 cursor-default'
                : localMonth ? 'border-slate-600 bg-slate-700/40 text-slate-200 hover:border-cyan-600 hover:text-cyan-300'
                             : 'border-dashed border-slate-600 text-slate-600 hover:border-cyan-600'
              )}
            >
              {localMonth || 'MM'}
            </button>
          )}

          {isSent && <span className="text-[10px] text-slate-600 ml-0.5">{year}</span>}
        </div>
      </div>
    </div>
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
  return (
    <div>
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">{label}</p>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className="w-full appearance-none bg-transparent hover:bg-slate-700/50 focus:bg-slate-700
                     border border-transparent hover:border-slate-600 focus:border-cyan-600
                     rounded-lg px-2.5 py-1 pr-6 text-sm text-slate-200
                     cursor-pointer focus:outline-none transition-colors"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-slate-800 text-slate-200">
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
      </div>
    </div>
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

const CARGO_STEPS = Object.keys(CARGO_STATUS_LABELS) as CargoStatus[]
const FORWARDER_STEPS = Object.keys(FORWARDER_STATUS_LABELS) as ForwarderStatus[]

// Construye el array de pasos posicionando 'paid' dinámicamente según payment_terms y payment_due_date
function buildTimelineSteps(imp: ComexImport): ImportStatus[] {
  const base: ImportStatus[] = [
    'planning', 'ordered', 'preparacion_embarque', 'listo_para_embarcar', 'shipped', 'transit',
    'arrived', 'customs', 'oficializado', 'carga_deposito', 'delivered'
  ]

  if (!imp.payment_terms || imp.payment_terms === 'anticipado') {
    // Posición fija entre 'ordered' y 'preparacion_embarque' (comportamiento original)
    base.splice(2, 0, 'paid')
    return base
  }

  // a_plazo: interpolar según payment_due_date
  if (!imp.payment_due_date) {
    base.push('paid') // sin fecha → al final
    return base
  }

  const due = imp.payment_due_date
  const shipDate    = imp.actual_ship_date ?? imp.ship_date
  const arrivalDate = imp.aviso_arribo_date ?? (imp.eta_4 ?? imp.eta_3 ?? imp.eta_2 ?? imp.arrival_date)

  if (shipDate && due <= shipDate) {
    base.splice(base.indexOf('shipped'), 0, 'paid')
  } else if (arrivalDate && due <= arrivalDate) {
    base.splice(base.indexOf('transit'), 0, 'paid')
  } else {
    base.splice(base.indexOf('customs'), 0, 'paid')
  }

  return base
}

function getMainStepIdx(status: ImportStatus, steps: ImportStatus[]): number {
  return steps.indexOf(status)
}

// Fecha asociada a cada paso principal
function getStepDate(step: ImportStatus, imp: ComexImport): { ts: number | null; isEstimate?: boolean } {
  switch (step) {
    case 'planning':             return { ts: imp.created_at }
    case 'ordered':              return { ts: imp.order_date }
    case 'paid':                 return { ts: imp.payment_date }
    case 'preparacion_embarque': return { ts: null }
    case 'listo_para_embarcar':  return { ts: null }
    case 'shipped':              return { ts: imp.actual_ship_date ?? imp.ship_date, isEstimate: !imp.actual_ship_date }
    case 'transit':              return { ts: imp.actual_ship_date ?? imp.ship_date, isEstimate: !imp.actual_ship_date }
    case 'arrived':              return { ts: imp.aviso_arribo_date ?? (imp.eta_4 ?? imp.eta_3 ?? imp.eta_2 ?? imp.arrival_date), isEstimate: !imp.aviso_arribo_date }
    case 'customs':              return { ts: imp.traslado_deposito_date }
    case 'oficializado':         return { ts: imp.oficializacion_import_date }
    case 'carga_deposito':       return { ts: imp.carga_deposito_date }
    case 'delivered':            return { ts: imp.actual_arrival_date }
    default:                     return { ts: null }
  }
}

// ── Nodo compuesto: "Preparación para embarque" (dos ramas paralelas) ─────────
// Estado de carga y gestión de forwarder avanzan de forma independiente — no hay
// dependencia entre ambas ramas. Cuando ambas llegan a su estado final (y el pago
// está resuelto si corresponde), la operación pasa sola a 'listo_para_embarcar'
// (ver el useEffect de auto-transición más abajo en este archivo).
function PreparacionEmbarqueNode({ imp, mainDone, mainActive, idx, onUpdateCargo, onUpdateForwarder }: {
  imp: ComexImport
  mainDone: boolean
  mainActive: boolean
  idx: number
  onUpdateCargo: (s: CargoStatus) => void
  onUpdateForwarder: (s: ForwarderStatus) => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const mainColor = IMPORT_STATUS_COLORS.preparacion_embarque

  const cargoStatus     = imp.cargo_status ?? 'en_armado'
  const forwarderStatus = imp.forwarder_status ?? 'sin_cotizar'
  const cargoIdx        = CARGO_STEPS.indexOf(cargoStatus)
  const forwarderIdx    = FORWARDER_STEPS.indexOf(forwarderStatus)

  return (
    <div
      ref={containerRef}
      className="relative z-10 flex flex-col items-center flex-1 min-w-0 gap-1"
    >
      {/* Botón principal — toggle del panel */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Ver estado de carga y forwarder"
        className="flex flex-col items-center gap-1 w-full group"
      >
        <div
          className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all duration-200 flex-shrink-0',
            mainActive ? 'shadow-md scale-110' :
            mainDone   ? 'opacity-90' :
            open       ? 'border-indigo-500/70 bg-indigo-500/10' :
            'border-slate-600 bg-slate-800 group-hover:border-slate-500'
          )}
          style={mainDone || mainActive ? {
            borderColor: mainColor,
            backgroundColor: mainDone ? mainColor + '33' : mainColor + '22',
            boxShadow: mainActive || open ? `0 0 10px ${mainColor}55` : undefined
          } : {}}
        >
          {mainDone && !mainActive ? (
            <Check size={12} style={{ color: mainColor }} />
          ) : (
            <span
              className="text-[9px] font-bold"
              style={mainActive ? { color: mainColor } : { color: '#475569' }}
            >
              {idx + 1}
            </span>
          )}
        </div>

        {/* Estado real de cada rama — una línea entera por rama, sin partir palabras.
            Absolute para que el ancho del texto no empuje el layout del timeline: el
            texto puede pisar el espacio libre de los nodos vecinos, hay margen de sobra. */}
        <div className="relative w-full" style={{ height: '22px' }}>
          <span
            className="absolute left-1/2 top-0 -translate-x-1/2 text-[8px] font-medium leading-tight whitespace-nowrap"
            style={{ color: CARGO_COLOR }}
          >
            {CARGO_STATUS_LABELS[cargoStatus]}
          </span>
          <span
            className="absolute left-1/2 top-[11px] -translate-x-1/2 text-[8px] font-medium leading-tight whitespace-nowrap"
            style={{ color: FORWARDER_COLOR }}
          >
            {FORWARDER_STATUS_LABELS[forwarderStatus]}
          </span>
        </div>

        <ChevronDown
          size={8}
          className="transition-transform duration-200"
          style={{
            color: mainDone || mainActive ? mainColor + '99' : '#475569',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)'
          }}
        />
      </button>

      {/* Panel de dos columnas — Estado de carga | Forwarder (ramas paralelas, sin dependencia) */}
      <div
        className={cn(
          'absolute top-full mt-0.5 left-1/2 -translate-x-1/2 z-20',
          'bg-slate-900 border border-indigo-900/50 rounded-lg shadow-xl shadow-black/50',
          'transition-all duration-150 origin-top',
          open ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
        )}
        style={{ width: '300px' }}
      >
        {/* Flecha apuntando hacia arriba */}
        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-1.5 overflow-hidden">
          <div className="w-3 h-3 bg-slate-900 border-l border-t border-indigo-900/50 rotate-45 translate-y-1/2 mx-auto" />
        </div>

        <div className="grid grid-cols-2 gap-3 px-2.5 py-2.5">
          {/* Columna: Estado de carga */}
          <div>
            <p className="text-[8px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: CARGO_COLOR }}>
              Estado de carga
            </p>
            <div className="space-y-1">
              {CARGO_STEPS.map((s, i) => {
                const done   = cargoIdx > i
                const active = cargoStatus === s

                return (
                  <button
                    key={s}
                    onClick={(e) => { e.stopPropagation(); onUpdateCargo(s) }}
                    className="w-full flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-slate-800 transition-colors"
                  >
                    <div
                      className={cn(
                        'w-3.5 h-3.5 rounded-full flex-shrink-0 flex items-center justify-center transition-all',
                        done   ? '' :
                        active ? 'border-2 scale-110' :
                        'border border-slate-600'
                      )}
                      style={done || active ? {
                        borderColor: CARGO_COLOR,
                        backgroundColor: done ? CARGO_COLOR + '44' : CARGO_COLOR + '22',
                        boxShadow: active ? `0 0 6px ${CARGO_COLOR}66` : undefined
                      } : {}}
                    >
                      {done && !active && <Check size={7} style={{ color: CARGO_COLOR }} />}
                    </div>
                    <span
                      className={cn('text-[9px] leading-tight text-left', active ? 'font-bold' : '')}
                      style={done || active ? { color: CARGO_COLOR } : { color: '#94a3b8' }}
                    >
                      {CARGO_STATUS_LABELS[s]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Columna: Gestión de forwarder */}
          <div>
            <p className="text-[8px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: FORWARDER_COLOR }}>
              Forwarder
            </p>
            <div className="space-y-1">
              {FORWARDER_STEPS.map((s, i) => {
                const done   = forwarderIdx > i
                const active = forwarderStatus === s

                return (
                  <button
                    key={s}
                    onClick={(e) => { e.stopPropagation(); onUpdateForwarder(s) }}
                    className="w-full flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-slate-800 transition-colors"
                  >
                    <div
                      className={cn(
                        'w-3.5 h-3.5 rounded-full flex-shrink-0 flex items-center justify-center transition-all',
                        done   ? '' :
                        active ? 'border-2 scale-110' :
                        'border border-slate-600'
                      )}
                      style={done || active ? {
                        borderColor: FORWARDER_COLOR,
                        backgroundColor: done ? FORWARDER_COLOR + '44' : FORWARDER_COLOR + '22',
                        boxShadow: active ? `0 0 6px ${FORWARDER_COLOR}66` : undefined
                      } : {}}
                    >
                      {done && !active && <Check size={7} style={{ color: FORWARDER_COLOR }} />}
                    </div>
                    <span
                      className={cn('text-[9px] leading-tight text-left', active ? 'font-bold' : '')}
                      style={done || active ? { color: FORWARDER_COLOR } : { color: '#94a3b8' }}
                    >
                      {FORWARDER_STATUS_LABELS[s]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {imp.status === 'preparacion_embarque' && !isReadyToShip(imp) && (
          <p className="px-2.5 pb-2 text-[8px] text-slate-500 leading-snug">
            Al llegar a Carga armada + Forwarder seleccionado (y el pago resuelto, si aplica), pasa sola a "Listo para embarcar".
          </p>
        )}
      </div>
    </div>
  )
}

function ImportTimeline({ currentStatus, onChangeStatus, onUpdateCargoStatus, onUpdateForwarderStatus, imp }: {
  currentStatus: ImportStatus
  onChangeStatus: (s: ImportStatus) => void
  onUpdateCargoStatus: (s: CargoStatus) => void
  onUpdateForwarderStatus: (s: ForwarderStatus) => void
  imp: ComexImport
}) {
  const steps = buildTimelineSteps(imp)
  const currentMainIdx = getMainStepIdx(currentStatus, steps)

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 pb-6">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-4">
        Progreso de la operación
      </p>

      <div className="relative">
        {/* Línea base */}
        <div className="absolute left-0 right-0 h-0.5 bg-slate-700" style={{ top: '14px', margin: '0 5%' }} />
        {/* Progreso completado */}
        <div
          className="absolute h-0.5 bg-gradient-to-r from-slate-600 via-cyan-700 to-cyan-600 transition-all duration-700"
          style={{
            top: '14px',
            left: '5%',
            width: currentMainIdx === 0 ? '0%' : `${(currentMainIdx / (steps.length - 1)) * 90}%`
          }}
        />

        {/* Pasos */}
        <div className="relative flex">
          {steps.map((step, idx) => {
            // El nodo "preparacion_embarque" se renderiza como nodo compuesto (carga + forwarder)
            if (step === 'preparacion_embarque') {
              const mainDone   = currentMainIdx > idx
              const mainActive = currentMainIdx === idx
              return (
                <PreparacionEmbarqueNode
                  key={step}
                  imp={imp}
                  mainDone={mainDone}
                  mainActive={mainActive}
                  idx={idx}
                  onUpdateCargo={onUpdateCargoStatus}
                  onUpdateForwarder={onUpdateForwarderStatus}
                />
              )
            }

            const done    = idx < currentMainIdx
            const active  = idx === currentMainIdx
            const future  = idx > currentMainIdx
            const color   = IMPORT_STATUS_COLORS[step]
            const { ts, isEstimate } = getStepDate(step, imp)
            const dateLabel = ts ? dayjs(ts).format('DD/MM/YY') : null
            const labelLines = IMPORT_STATUS_LABELS[step].split(' ')

            // Posición dinámica: en pago diferido, este nodo no tiene lugar fijo —
            // se calculó según vencimiento (payment_due_date). Se marca con borde
            // punteado + relojito para no confundirlo con un nodo de posición fija.
            const isDynamicPaid = step === 'paid' && imp.payment_terms === 'a_plazo'
            const dynamicTooltip = !isDynamicPaid ? '' :
              imp.payment_due_date
                ? ` — posición calculada: vence ${dayjs(imp.payment_due_date).format('DD/MM/YY')}${imp.payment_deferred_days != null ? ` (${imp.payment_deferred_days} días desde factura)` : ''}`
                : ' — posición pendiente: falta fecha de factura o días para calcular el vencimiento, por ahora va al final'

            return (
              <button
                key={step}
                onClick={() => onChangeStatus(step)}
                title={IMPORT_STATUS_LABELS[step] + dynamicTooltip}
                className="relative z-10 flex flex-col items-center flex-1 gap-1 group"
              >
                {/* Círculo */}
                <div
                  className={cn(
                    'relative w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all duration-200 flex-shrink-0',
                    isDynamicPaid && 'border-dashed',
                    active  ? 'shadow-md scale-110' :
                    done    ? 'opacity-90' :
                    'border-slate-600 bg-slate-800 group-hover:border-slate-500'
                  )}
                  style={done || active ? {
                    borderColor: color,
                    backgroundColor: done ? color + '33' : color + '22',
                    boxShadow: active ? `0 0 10px ${color}55` : undefined
                  } : {}}
                >
                  {done ? (
                    <Check size={12} style={{ color }} />
                  ) : (
                    <span className="text-[9px] font-bold" style={active ? { color } : { color: '#475569' }}>
                      {idx + 1}
                    </span>
                  )}
                  {isDynamicPaid && (
                    <span
                      className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-slate-800 border flex items-center justify-center"
                      style={{ borderColor: done || active ? color : '#475569' }}
                    >
                      <Clock size={7} style={{ color: done || active ? color : '#475569' }} />
                    </span>
                  )}
                </div>

                {/* Label */}
                <div className="flex flex-col items-center gap-0">
                  {labelLines.map((line, i) => (
                    <span
                      key={i}
                      className={cn(
                        'text-[8px] leading-tight text-center transition-colors',
                        active ? 'font-bold' : done ? '' : 'text-slate-600 group-hover:text-slate-400'
                      )}
                      style={active || done ? { color } : {}}
                    >
                      {line}
                    </span>
                  ))}
                </div>

                {/* Fecha (+ hora para carga_deposito) */}
                <div className="flex flex-col items-center">
                  {dateLabel ? (
                    <span className={cn(
                      'text-[7px] leading-none font-mono transition-colors',
                      active  ? 'font-semibold' :
                      future  ? 'italic' :
                      ''
                    )}
                    style={{
                      color: active  ? color :
                             done    ? color + 'bb' :
                             isEstimate ? '#475569' :
                             '#475569'
                    }}>
                      {isEstimate && future ? '~' : ''}{dateLabel}
                    </span>
                  ) : (
                    <span className="text-[7px] text-slate-700">—</span>
                  )}
                  {/* Hora del turno solo para carga_deposito */}
                  {step === 'carga_deposito' && imp.carga_deposito_time && (
                    <span className="text-[7px] font-mono mt-0.5" style={{ color: active ? color : color + 'aa' }}>
                      🕐 {imp.carga_deposito_time}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
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
      toast.error(err instanceof Error ? err.message : 'Error al analizar el documento')
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

type SectionKey = 'costos'|'datos'|'pago'|'anmat'|'flete_int'|'despacho'|'tributos'|'deposito'|'despachante'|'flete_local'|'productos'|'presupuestos'|'proformas'|'facturas'|'pl'|'bl'

const ALL_SECTION_KEYS: SectionKey[] = [
  'costos','datos','pago','anmat','flete_int','despacho','tributos',
  'deposito','despachante','flete_local','productos','presupuestos','proformas','facturas','pl'
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
            <span className="text-[11px] text-right max-w-[300px] truncate">{summary}</span>
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

// ── Proforma Section ─────────────────────────────────────────────────────────

function ProformaSection({ imp }: { imp: ComexImport }) {
  const qc              = useQueryClient()
  const { data: proformas = [] } = useComexProformas(imp.id)
  const createPf        = useCreateComexProforma()
  const updatePf        = useUpdateComexProforma()
  const deletePf        = useDeleteComexProforma()
  const uploadPf        = useUploadProforma()
  const analyzeAI       = useAnalyzeProforma()
  const { data: aiConfigured } = useAIConfigured()

  const [analyzingId,   setAnalyzingId]   = useState<string | null>(null)
  const [aiResult,      setAiResult]      = useState<{ proformaId: string; data: ExtractedProforma } | null>(null)
  const [applying,      setApplying]      = useState(false)
  const [applySuccess,  setApplySuccess]  = useState<string | null>(null)
  const [confirmDel,    setConfirmDel]    = useState<string | null>(null)

  const today = dayjs()
  // Idea C: proforma antigua si la más reciente tiene >30 días
  const latest = proformas.length > 0 ? proformas[proformas.length - 1] : null
  const isStale = latest?.fecha_proforma
    ? dayjs(latest.fecha_proforma).isBefore(today.subtract(30, 'day'))
    : false

  const fmt2    = (n: number, mon: string) =>
    `${mon} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const fmtDate = (s: string | null) => s ? dayjs(s).format('DD/MM/YY') : '—'

  // Total seleccionadas (idea D: mezcla de monedas)
  const selected     = proformas.filter(p => p.incluir_en_total === 1 && p.importe != null)
  const currencies   = [...new Set(selected.map(p => p.moneda))]
  const mixedCurrency = currencies.length > 1
  const totalSelected = !mixedCurrency && selected.length > 0
    ? { importe: selected.reduce((s, p) => s + (p.importe ?? 0), 0), moneda: currencies[0] ?? 'USD' }
    : null

  const [createError, setCreateError] = useState<string | null>(null)
  const [isDragOver,  setIsDragOver]  = useState(false)
  const dragCounter = useRef(0)

  const doCreateAndUpload = async (filePath: string) => {
    setCreateError(null)
    try {
      const pf = await createPf.mutateAsync({
        import_id: imp.id, numero: 0, fecha_proforma: null, importe: null,
        moneda: imp.currency || 'USD', nro_proforma: '', descripcion: '',
        incluir_en_total: 1, stored_name: null, original_name: null,
        drive_file_id: null, drive_folder_id: null, drive_status: 'none'
      })
      uploadPf.mutate({ proformaId: pf.id, filePath, importId: imp.id })
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Error al crear proforma')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const fp = window.api.getPathForFile(file)
    if (fp) doCreateAndUpload(fp)
  }

  const handleAddProforma = async () => {
    setCreateError(null)
    try {
      const fp = await window.api.comex.proformas.selectFile()
      if (fp) {
        await doCreateAndUpload(fp)
      } else {
        // Si no eligió archivo, crear igual la proforma vacía
        await createPf.mutateAsync({
          import_id: imp.id, numero: 0, fecha_proforma: null, importe: null,
          moneda: imp.currency || 'USD', nro_proforma: '', descripcion: '',
          incluir_en_total: 1, stored_name: null, original_name: null,
          drive_file_id: null, drive_folder_id: null, drive_status: 'none'
        })
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Error al crear proforma')
    }
  }

  const handleUpload = async (pfId: string) => {
    const fp = await window.api.comex.proformas.selectFile()
    if (!fp) return
    uploadPf.mutate({ proformaId: pfId, filePath: fp, importId: imp.id })
  }

  const handleAnalyze = async (pfId: string) => {
    setAnalyzingId(pfId)
    try {
      const result = await analyzeAI.mutateAsync(pfId)
      const d = result.structured as ExtractedProforma
      if (d) setAiResult({ proformaId: pfId, data: d })
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error al analizar') }
    finally { setAnalyzingId(null) }
  }

  const handleApplyAI = async () => {
    if (!aiResult) return
    setApplying(true)
    try {
      const d  = aiResult.data
      const pf = proformas.find(p => p.id === aiResult.proformaId)
      if (!pf) return

      // Actualizar proforma con datos extraídos
      const patch: Partial<ComexProforma> = {}
      if (d.importe_total != null) patch.importe        = d.importe_total
      if (d.moneda)                patch.moneda         = d.moneda
      if (d.fecha)                 patch.fecha_proforma  = d.fecha
      if (d.nro_proforma)          patch.nro_proforma    = d.nro_proforma
      if (d.descripcion)           patch.descripcion     = d.descripcion
      await window.api.comex.proformas.update(pf.id, patch)

      // Renombrar carpeta Drive con la fecha extraída (Idea: sin fecha → con fecha)
      if (d.fecha && pf.drive_folder_id) {
        window.api.comex.proformas.renameDriveFolder(pf.id).catch(() => {})
      }

      // Aplicar valor proforma al import si está seleccionada
      if (pf.incluir_en_total === 1 && d.importe_total != null) {
        const newSelected = proformas
          .filter(p => p.incluir_en_total === 1 || p.id === pf.id)
          .map(p => p.id === pf.id ? { ...p, ...patch } : p)
        const allSameCurrency = new Set(newSelected.map(p => p.moneda)).size === 1
        if (allSameCurrency) {
          const total = newSelected.reduce((s, p) => s + (p.importe ?? 0), 0)
          await window.api.comex.imports.update(imp.id, {
            estimated_value: total,
            currency: d.moneda ?? imp.currency
          })
          qc.invalidateQueries({ queryKey: ['comex-import', imp.id] })
        }
      }

      qc.invalidateQueries({ queryKey: ['comex-proformas', imp.id, 'proforma'] })
      setAiResult(null)
      const msg = d.importe_total != null
        ? `✓ Proforma actualizada — ${d.moneda ?? ''} ${d.importe_total?.toLocaleString('es-AR', { minimumFractionDigits: 2 })} aplicado`
        : '✓ Datos de la proforma aplicados correctamente'
      setApplySuccess(msg)
      setTimeout(() => setApplySuccess(null), 4000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al aplicar')
    } finally { setApplying(false) }
  }

  const handleToggle = async (pf: ComexProforma) => {
    const newVal = pf.incluir_en_total === 1 ? 0 : 1
    await window.api.comex.proformas.update(pf.id, { incluir_en_total: newVal as 0 | 1 })
    qc.invalidateQueries({ queryKey: ['comex-proformas', imp.id, 'proforma'] })
  }

  const handleApplyTotal = async () => {
    if (!totalSelected) return
    await window.api.comex.imports.update(imp.id, {
      estimated_value: totalSelected.importe,
      currency:        totalSelected.moneda
    })
    qc.invalidateQueries({ queryKey: ['comex-import', imp.id] })
    const msg = `✓ Valor proforma actualizado — ${totalSelected.moneda} ${totalSelected.importe.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
    setApplySuccess(msg)
    setTimeout(() => setApplySuccess(null), 4000)
  }

  // Idea B: tendencia
  const trend = proformas.length >= 2 && proformas[proformas.length-1].importe != null && proformas[proformas.length-2].importe != null
    ? ((proformas[proformas.length-1].importe! - proformas[proformas.length-2].importe!) / proformas[proformas.length-2].importe! * 100)
    : null

  return (
    <div
      className={cn(
        'space-y-3 rounded-xl transition-colors',
        isDragOver && 'outline outline-2 outline-cyan-500/60 bg-cyan-950/10'
      )}
      onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setIsDragOver(true) }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => { dragCounter.current--; if (dragCounter.current === 0) setIsDragOver(false) }}
      onDrop={handleDrop}
    >
      {/* Overlay visual cuando se arrastra */}
      {isDragOver && (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-cyan-400 font-medium">
          <Upload size={16} /> Soltá para agregar como nueva proforma
        </div>
      )}

      {/* Banner de éxito al aplicar */}
      {applySuccess && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-900/30 border border-emerald-700/50 rounded-lg text-xs text-emerald-300 font-medium">
          <Check size={14} className="text-emerald-400 flex-shrink-0" />
          {applySuccess}
        </div>
      )}

      {/* Idea C: Alerta proforma antigua */}
      {proformas.length > 0 && isStale && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-900/20 border border-amber-800/40 rounded-lg text-xs text-amber-400">
          <AlertCircle size={13} className="flex-shrink-0" />
          La proforma más reciente tiene más de 30 días — verificá si hay una versión actualizada.
        </div>
      )}

      {/* Lista de proformas */}
      <div className="space-y-2">
        {proformas.map((pf, idx) => {
          const isLatest  = idx === proformas.length - 1
          const isChecked = pf.incluir_en_total === 1

          return (
            <div key={pf.id} className={cn(
              'border rounded-xl overflow-hidden transition-colors',
              isChecked ? 'border-cyan-700/50 bg-slate-800' : 'border-slate-700/50 bg-slate-800/50'
            )}>
              <div className="flex items-center gap-3 px-3 py-2.5">
                {/* Checkbox */}
                <button
                  onClick={() => handleToggle(pf)}
                  className={cn(
                    'w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors',
                    isChecked ? 'bg-cyan-600 border-cyan-600' : 'border-slate-600 hover:border-slate-400'
                  )}
                >
                  {isChecked && <Check size={10} className="text-white" />}
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-200">
                      Proforma {pf.numero}
                    </span>
                    {pf.fecha_proforma && (
                      <span className="text-[10px] text-slate-500">{fmtDate(pf.fecha_proforma)}</span>
                    )}
                    {/* Idea A: badge "Activa" en la última */}
                    {isLatest && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-cyan-900/50 text-cyan-400 border border-cyan-800/50">
                        Activa
                      </span>
                    )}
                    {pf.nro_proforma && (
                      <span className="text-[10px] text-slate-600 font-mono">{pf.nro_proforma}</span>
                    )}
                  </div>
                  {pf.descripcion && (
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">{pf.descripcion}</p>
                  )}
                </div>

                {/* Importe */}
                <div className="text-right flex-shrink-0">
                  {pf.importe != null ? (
                    <p className={cn('text-sm font-bold', isChecked ? 'text-cyan-300' : 'text-slate-400')}>
                      {fmt2(pf.importe, pf.moneda)}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-600 italic">Sin valor</p>
                  )}
                  {/* Idea B: tendencia vs anterior */}
                  {isLatest && trend != null && (
                    <p className={cn('text-[10px] font-medium', trend > 0 ? 'text-red-400' : 'text-emerald-400')}>
                      {trend > 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}% vs anterior
                    </p>
                  )}
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {pf.stored_name ? (
                    <>
                      <button onClick={() => window.api.comex.proformas.open(pf.id)}
                        title="Abrir PDF" className="p-1.5 rounded text-slate-500 hover:text-cyan-400 hover:bg-slate-700 transition-colors">
                        <FolderOpen size={13} />
                      </button>
                      {pf.drive_file_id && (
                        <button onClick={() => window.api.shell.open(`https://drive.google.com/file/d/${pf.drive_file_id}/view`)}
                          title="Ver en Drive" className="p-1.5 rounded text-slate-500 hover:text-cyan-400 hover:bg-slate-700 transition-colors">
                          <ExternalLink size={13} />
                        </button>
                      )}
                      {aiConfigured && (
                        <button onClick={() => handleAnalyze(pf.id)} disabled={analyzingId === pf.id}
                          title="Extraer datos con IA" className="p-1.5 rounded text-slate-500 hover:text-violet-400 hover:bg-slate-700 transition-colors disabled:opacity-40">
                          {analyzingId === pf.id ? <Loader2 size={13} className="animate-spin text-violet-400" /> : <Sparkles size={13} />}
                        </button>
                      )}
                    </>
                  ) : (
                    <button onClick={() => handleUpload(pf.id)} disabled={uploadPf.isPending}
                      title="Subir PDF" className="p-1.5 rounded text-slate-500 hover:text-cyan-400 hover:bg-slate-700 transition-colors">
                      {uploadPf.isPending ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                    </button>
                  )}
                  {confirmDel === pf.id ? (
                    <>
                      <button onClick={() => { deletePf.mutate({ id: pf.id, importId: imp.id }); setConfirmDel(null) }}
                        className="p-1.5 rounded bg-red-600 hover:bg-red-500 text-white"><Check size={11} /></button>
                      <button onClick={() => setConfirmDel(null)}
                        className="p-1.5 rounded bg-slate-700 text-slate-400"><X size={11} /></button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmDel(pf.id)}
                      className="p-1.5 rounded text-slate-600 hover:text-red-400 hover:bg-slate-700 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Drive status */}
              {pf.stored_name && (
                <div className="flex items-center gap-2 px-3 pb-2 text-[10px] text-slate-600">
                  <FileText size={10} />
                  <span className="truncate">{pf.original_name}</span>
                  {pf.drive_status === 'synced'    && <span className="text-emerald-500 flex-shrink-0">☁ Drive</span>}
                  {pf.drive_status === 'uploading' && <span className="flex items-center gap-1 text-blue-400"><Loader2 size={10} className="animate-spin" /> Subiendo...</span>}
                  {pf.drive_status === 'error'     && (
                    <button
                      onClick={async () => {
                        try {
                          await window.api.comex.proformas.syncDrive(pf.id)
                          qc.invalidateQueries({ queryKey: ['comex-proformas', imp.id] })
                        } catch (err) {
                          toast.error(`Error Drive: ${err instanceof Error ? err.message : 'Error desconocido'}`)
                        }
                      }}
                      className="flex items-center gap-1 text-amber-400 hover:text-amber-300 transition-colors flex-shrink-0"
                      title="Click para reintentar la subida a Drive"
                    >
                      <AlertCircle size={10} /> Error Drive — Reintentar
                    </button>
                  )}
                  {pf.drive_status === 'none' && imp.drive_folder_id && (
                    <button
                      onClick={async () => {
                        try {
                          await window.api.comex.proformas.syncDrive(pf.id)
                          qc.invalidateQueries({ queryKey: ['comex-proformas', imp.id] })
                        } catch (err) {
                          toast.error(`Error Drive: ${err instanceof Error ? err.message : 'Error desconocido'}`)
                        }
                      }}
                      className="flex items-center gap-1 text-slate-600 hover:text-cyan-400 transition-colors flex-shrink-0"
                      title="Subir a Drive"
                    >
                      <Cloud size={10} /> Subir a Drive
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {proformas.length === 0 && (
          <p className="text-xs text-slate-500 italic py-2">Sin proformas. Hacé click en "+ Nueva proforma" para subir la primera.</p>
        )}
      </div>

      {/* Total + aplicar */}
      {selected.length > 0 && (
        <div className="border border-slate-700/50 rounded-xl p-3 space-y-2 bg-slate-900/30">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {selected.length} proforma{selected.length !== 1 ? 's' : ''} seleccionada{selected.length !== 1 ? 's' : ''}
            </span>
            {totalSelected && (
              <span className="text-sm font-bold text-cyan-300">
                {fmt2(totalSelected.importe, totalSelected.moneda)}
              </span>
            )}
          </div>
          {/* Idea D: alerta mezcla de monedas */}
          {mixedCurrency && (
            <p className="text-[10px] text-amber-400 flex items-center gap-1">
              <AlertCircle size={11} />
              Monedas distintas ({currencies.join(', ')}) — no se puede sumar directamente. Seleccioná solo las de la misma moneda.
            </p>
          )}
          {totalSelected && (
            <button
              onClick={handleApplyTotal}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold bg-cyan-700 hover:bg-cyan-600 text-white transition-colors"
            >
              <Check size={12} /> Aplicar {fmt2(totalSelected.importe, totalSelected.moneda)} como "Valor proforma"
            </button>
          )}
        </div>
      )}

      {/* Botón agregar + hint drag & drop */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <button
            onClick={handleAddProforma}
            disabled={createPf.isPending || uploadPf.isPending}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-cyan-400 transition-colors disabled:opacity-40"
          >
            {createPf.isPending || uploadPf.isPending
              ? <><Loader2 size={12} className="animate-spin" /> Procesando...</>
              : <><Plus size={12} /> Nueva proforma</>
            }
          </button>
          <span className="text-[11px] text-slate-700 italic">
            o arrastrá el PDF aquí
          </span>
        </div>
        {createError && (
          <p className="text-[11px] text-red-400 flex items-center gap-1">
            <AlertCircle size={11} /> {createError}
          </p>
        )}
      </div>

      {/* Panel resultado IA */}
      {aiResult && (
        <div className="rounded-lg border border-violet-700/40 bg-violet-950/20 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-violet-900/20 border-b border-violet-700/30">
            <div className="flex items-center gap-1.5">
              <Bot size={12} className="text-violet-400" />
              <span className="text-[11px] font-semibold text-violet-300">Proforma extraída por IA</span>
            </div>
            <button onClick={() => setAiResult(null)} className="text-slate-500 hover:text-slate-300"><X size={12} /></button>
          </div>
          <div className="px-3 py-2.5 space-y-2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
              {aiResult.data.proveedor    && <><span className="text-slate-500">Proveedor</span><span className="text-slate-200 font-medium">{aiResult.data.proveedor}</span></>}
              {aiResult.data.nro_proforma && <><span className="text-slate-500">N° Proforma</span><span className="text-slate-200">{aiResult.data.nro_proforma}</span></>}
              {aiResult.data.fecha        && <><span className="text-slate-500">Fecha</span><span className="text-slate-200">{formatFieldValue(aiResult.data.fecha)}</span></>}
              {aiResult.data.descripcion  && <><span className="text-slate-500">Descripción</span><span className="text-slate-300 truncate">{aiResult.data.descripcion}</span></>}
            </div>
            {aiResult.data.importe_total != null && (
              <div className="border-t border-violet-700/30 pt-2">
                <div className="flex justify-between text-[11px]">
                  <span className="text-emerald-400 font-semibold">Total proforma</span>
                  <span className="text-emerald-300 font-bold">
                    {fmt2(aiResult.data.importe_total, aiResult.data.moneda ?? 'USD')}
                  </span>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1 border-t border-violet-800/30">
              <button onClick={() => setAiResult(null)} className="px-2.5 py-1 rounded text-[11px] text-slate-400 hover:text-white">Descartar</button>
              <button onClick={handleApplyAI} disabled={applying}
                className="flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-medium bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50">
                {applying ? <><Loader2 size={11} className="animate-spin" />Aplicando...</> : <><Check size={11} />Aplicar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Facturas Comerciales Section ─────────────────────────────────────────────

function FacturasComercialSection({ imp, proformasData }: { imp: ComexImport; proformasData: ComexProforma[] }) {
  const qc              = useQueryClient()
  const { data: facturas = [] } = useComexFacturasComerciales(imp.id)
  const createPf        = useCreateComexProforma()
  const updatePf        = useUpdateComexProforma()
  const deletePf        = useDeleteComexProforma()
  const uploadPf        = useUploadProforma()
  const analyzeAI       = useAnalyzeProforma()
  const { data: aiConfigured } = useAIConfigured()

  const [analyzingId,   setAnalyzingId]   = useState<string | null>(null)
  const [aiResult,      setAiResult]      = useState<{ proformaId: string; data: ExtractedProforma } | null>(null)
  const [applying,      setApplying]      = useState(false)
  const [applySuccess,  setApplySuccess]  = useState<string | null>(null)
  const [confirmDel,    setConfirmDel]    = useState<string | null>(null)
  const [isDragOver,    setIsDragOver]    = useState(false)
  const dragCounter     = useRef(0)
  const [createError,   setCreateError]   = useState<string | null>(null)

  const today = dayjs()
  const latest = facturas.length > 0 ? facturas[facturas.length - 1] : null
  const isStale = latest?.fecha_proforma
    ? dayjs(latest.fecha_proforma).isBefore(today.subtract(30, 'day')) : false

  const fmt2    = (n: number, mon: string) =>
    `${mon} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const fmtDate = (s: string | null) => s ? dayjs(s).format('DD/MM/YY') : '—'

  const selected     = facturas.filter(p => p.incluir_en_total === 1 && p.importe != null)
  const currencies   = [...new Set(selected.map(p => p.moneda))]
  const mixedCurrency = currencies.length > 1
  const totalSelected = !mixedCurrency && selected.length > 0
    ? { importe: selected.reduce((s, p) => s + (p.importe ?? 0), 0), moneda: currencies[0] ?? imp.currency }
    : null

  // Idea A: comparativo proforma vs factura
  const proformaSelected = proformasData.filter(p => p.incluir_en_total === 1 && p.importe != null)
  const proformaCurrencies = [...new Set(proformaSelected.map(p => p.moneda))]
  const proformaTotal = !mixedCurrency && proformaSelected.length > 0 && proformaCurrencies.length === 1
    ? { importe: proformaSelected.reduce((s, p) => s + (p.importe ?? 0), 0), moneda: proformaCurrencies[0] }
    : null
  const canCompare = proformaTotal && totalSelected && proformaTotal.moneda === totalSelected.moneda
  const diffPct    = canCompare ? ((totalSelected!.importe - proformaTotal!.importe) / proformaTotal!.importe) * 100 : null

  const doCreateAndUpload = async (filePath: string) => {
    setCreateError(null)
    try {
      const pf = await createPf.mutateAsync({
        import_id: imp.id, tipo: 'factura', numero: 0, fecha_proforma: null, importe: null,
        moneda: imp.currency || 'USD', nro_proforma: '', descripcion: '',
        incluir_en_total: 1, stored_name: null, original_name: null,
        drive_file_id: null, drive_folder_id: null, drive_status: 'none'
      })
      uploadPf.mutate({ proformaId: pf.id, filePath, importId: imp.id, tipo: 'factura' })
    } catch (err) { setCreateError(err instanceof Error ? err.message : 'Error') }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); dragCounter.current = 0; setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const fp = window.api.getPathForFile(file)
    if (fp) doCreateAndUpload(fp)
  }

  const handleAddFactura = async () => {
    setCreateError(null)
    try {
      const fp = await window.api.comex.proformas.selectFile()
      if (fp) { await doCreateAndUpload(fp) }
      else {
        await createPf.mutateAsync({
          import_id: imp.id, tipo: 'factura', numero: 0, fecha_proforma: null, importe: null,
          moneda: imp.currency || 'USD', nro_proforma: '', descripcion: '',
          incluir_en_total: 1, stored_name: null, original_name: null,
          drive_file_id: null, drive_folder_id: null, drive_status: 'none'
        })
      }
    } catch (err) { setCreateError(err instanceof Error ? err.message : 'Error') }
  }

  const handleAnalyze = async (pfId: string) => {
    setAnalyzingId(pfId)
    try {
      const result = await analyzeAI.mutateAsync(pfId)
      const d = result.structured as ExtractedProforma
      if (d) {
        // Idea B: si hay una sola factura, aplicar automáticamente
        const pf = facturas.find(p => p.id === pfId)
        if (facturas.length === 1 && d.importe_total != null && pf?.incluir_en_total === 1) {
          await window.api.comex.proformas.update(pfId, {
            importe: d.importe_total, moneda: d.moneda ?? pf.moneda,
            fecha_proforma: d.fecha ?? null, nro_proforma: d.nro_proforma ?? '',
            descripcion: d.descripcion ?? ''
          })
          if (d.fecha && pf.drive_folder_id) window.api.comex.proformas.renameDriveFolder(pfId).catch(() => {})
          await window.api.comex.imports.update(imp.id, {
            actual_value: d.importe_total,
            currency: d.moneda ?? imp.currency
          })
          qc.invalidateQueries({ queryKey: ['comex-proformas', imp.id, 'factura'] })
          qc.invalidateQueries({ queryKey: ['comex-import', imp.id] })
        } else {
          setAiResult({ proformaId: pfId, data: d })
        }
      }
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error al analizar') }
    finally { setAnalyzingId(null) }
  }

  const handleApplyAI = async () => {
    if (!aiResult) return
    setApplying(true)
    try {
      const d  = aiResult.data
      const pf = facturas.find(p => p.id === aiResult.proformaId)
      if (!pf) return

      const patch: Partial<ComexProforma> = {}
      if (d.importe_total != null) patch.importe        = d.importe_total
      if (d.moneda)                patch.moneda         = d.moneda
      if (d.fecha)                 patch.fecha_proforma  = d.fecha
      if (d.nro_proforma)          patch.nro_proforma    = d.nro_proforma
      if (d.descripcion)           patch.descripcion     = d.descripcion
      await window.api.comex.proformas.update(pf.id, patch)

      if (d.fecha && pf.drive_folder_id)
        window.api.comex.proformas.renameDriveFolder(pf.id).catch(() => {})

      if (pf.incluir_en_total === 1 && d.importe_total != null) {
        const newSelected = facturas
          .filter(p => p.incluir_en_total === 1 || p.id === pf.id)
          .map(p => p.id === pf.id ? { ...p, ...patch } : p)
        const allSame = new Set(newSelected.map(p => p.moneda)).size === 1
        if (allSame) {
          const total = newSelected.reduce((s, p) => s + (p.importe ?? 0), 0)
          await window.api.comex.imports.update(imp.id, {
            actual_value: total,
            currency: d.moneda ?? imp.currency
          })
          qc.invalidateQueries({ queryKey: ['comex-import', imp.id] })
        }
      }

      qc.invalidateQueries({ queryKey: ['comex-proformas', imp.id, 'factura'] })
      setAiResult(null)
      // Feedback de éxito
      const msg = d.importe_total != null
        ? `✓ Factura actualizada — ${d.moneda ?? ''} ${d.importe_total?.toLocaleString('es-AR', { minimumFractionDigits: 2 })} aplicado`
        : '✓ Datos de la factura aplicados correctamente'
      setApplySuccess(msg)
      setTimeout(() => setApplySuccess(null), 4000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al aplicar')
    } finally { setApplying(false) }
  }

  const handleToggle = async (pf: ComexProforma) => {
    await window.api.comex.proformas.update(pf.id, { incluir_en_total: pf.incluir_en_total === 1 ? 0 : 1 })
    qc.invalidateQueries({ queryKey: ['comex-proformas', imp.id, 'factura'] })
  }

  const handleApplyTotal = async () => {
    if (!totalSelected) return
    await window.api.comex.imports.update(imp.id, {
      actual_value: totalSelected.importe,
      currency:     totalSelected.moneda
    })
    qc.invalidateQueries({ queryKey: ['comex-import', imp.id] })
    const msg = `✓ Valor factura actualizado — ${totalSelected.moneda} ${totalSelected.importe.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
    setApplySuccess(msg)
    setTimeout(() => setApplySuccess(null), 4000)
  }

  return (
    <div
      className={cn('space-y-3 rounded-xl transition-colors', isDragOver && 'outline outline-2 outline-teal-500/60 bg-teal-950/10')}
      onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setIsDragOver(true) }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => { dragCounter.current--; if (dragCounter.current === 0) setIsDragOver(false) }}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-teal-400 font-medium">
          <Upload size={16} /> Soltá para agregar como nueva factura
        </div>
      )}

      {/* Banner de éxito al aplicar */}
      {applySuccess && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-900/30 border border-emerald-700/50 rounded-lg text-xs text-emerald-300 font-medium">
          <Check size={14} className="text-emerald-400 flex-shrink-0" />
          {applySuccess}
        </div>
      )}

      {/* Idea C: alerta proforma antigua */}
      {facturas.length > 0 && isStale && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-900/20 border border-amber-800/40 rounded-lg text-xs text-amber-400">
          <AlertCircle size={13} /> La factura más reciente tiene más de 30 días.
        </div>
      )}

      {/* Idea A: comparativo proforma vs factura */}
      {canCompare && diffPct !== null && (
        <div className={cn(
          'flex items-center justify-between px-3 py-2 rounded-lg border text-xs',
          Math.abs(diffPct) <= 5 ? 'bg-emerald-900/20 border-emerald-800/40' :
          Math.abs(diffPct) <= 10 ? 'bg-amber-900/20 border-amber-800/40' : 'bg-red-900/20 border-red-800/40'
        )}>
          <div className="space-y-0.5">
            <p className="text-slate-400">Proforma: <span className="text-slate-200 font-medium">{fmt2(proformaTotal!.importe, proformaTotal!.moneda)}</span></p>
            <p className="text-slate-400">Factura:  <span className="text-slate-200 font-medium">{fmt2(totalSelected!.importe, totalSelected!.moneda)}</span></p>
          </div>
          <span className={cn('font-bold text-sm',
            Math.abs(diffPct) <= 5 ? 'text-emerald-400' :
            Math.abs(diffPct) <= 10 ? 'text-amber-400' : 'text-red-400'
          )}>
            {diffPct > 0 ? '▲' : '▼'} {Math.abs(diffPct).toFixed(1)}%
            <p className="text-[10px] font-normal text-slate-500 text-right">
              {Math.abs(diffPct) <= 5 ? 'Dentro del rango' : Math.abs(diffPct) <= 10 ? 'Diferencia moderada' : 'Diferencia alta'}
            </p>
          </span>
        </div>
      )}

      {/* Lista */}
      <div className="space-y-2">
        {facturas.map((pf, idx) => {
          const isLatest  = idx === facturas.length - 1
          const isChecked = pf.incluir_en_total === 1
          // Idea C: verificar referencia con proformas
          const refMatch = pf.nro_proforma
            ? proformasData.some(pr => pr.nro_proforma === pf.nro_proforma)
            : null

          return (
            <div key={pf.id} className={cn('border rounded-xl overflow-hidden transition-colors',
              isChecked ? 'border-teal-700/50 bg-slate-800' : 'border-slate-700/50 bg-slate-800/50'
            )}>
              <div className="flex items-center gap-3 px-3 py-2.5">
                <button onClick={() => handleToggle(pf)}
                  className={cn('w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors',
                    isChecked ? 'bg-teal-600 border-teal-600' : 'border-slate-600 hover:border-slate-400'
                  )}>
                  {isChecked && <Check size={10} className="text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-200">Factura {pf.numero}</span>
                    {pf.fecha_proforma && <span className="text-[10px] text-slate-500">{fmtDate(pf.fecha_proforma)}</span>}
                    {isLatest && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-teal-900/50 text-teal-400 border border-teal-800/50">Activa</span>}
                    {pf.nro_proforma && <span className="text-[10px] text-slate-600 font-mono">{pf.nro_proforma}</span>}
                    {refMatch === true  && <span className="text-[9px] text-emerald-400">✓ Ref. coincide</span>}
                    {refMatch === false && <span className="text-[9px] text-amber-400">⚠ Ref. sin proforma</span>}
                  </div>
                  {pf.descripcion && <p className="text-[10px] text-slate-500 truncate mt-0.5">{pf.descripcion}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  {pf.importe != null
                    ? <p className={cn('text-sm font-bold', isChecked ? 'text-teal-300' : 'text-slate-400')}>{fmt2(pf.importe, pf.moneda)}</p>
                    : <p className="text-xs text-slate-600 italic">Sin valor</p>
                  }
                  {isLatest && facturas.length >= 2 && (() => {
                    const prev = facturas[facturas.length - 2]
                    if (prev?.importe && pf.importe) {
                      const t = ((pf.importe - prev.importe) / prev.importe) * 100
                      return <p className={cn('text-[10px] font-medium', t > 0 ? 'text-red-400' : 'text-emerald-400')}>
                        {t > 0 ? '▲' : '▼'} {Math.abs(t).toFixed(1)}% vs anterior
                      </p>
                    }
                    return null
                  })()}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {pf.stored_name ? (
                    <>
                      <button onClick={() => window.api.comex.proformas.open(pf.id)} title="Abrir PDF"
                        className="p-1.5 rounded text-slate-500 hover:text-teal-400 hover:bg-slate-700 transition-colors"><FolderOpen size={13} /></button>
                      {pf.drive_file_id && (
                        <button onClick={() => window.api.shell.open(`https://drive.google.com/file/d/${pf.drive_file_id}/view`)} title="Ver en Drive"
                          className="p-1.5 rounded text-slate-500 hover:text-teal-400 hover:bg-slate-700 transition-colors"><ExternalLink size={13} /></button>
                      )}
                      {aiConfigured && (
                        <button onClick={() => handleAnalyze(pf.id)} disabled={analyzingId === pf.id} title="Extraer con IA"
                          className="p-1.5 rounded text-slate-500 hover:text-violet-400 hover:bg-slate-700 transition-colors disabled:opacity-40">
                          {analyzingId === pf.id ? <Loader2 size={13} className="animate-spin text-violet-400" /> : <Sparkles size={13} />}
                        </button>
                      )}
                    </>
                  ) : (
                    <button onClick={async () => { const fp = await window.api.comex.proformas.selectFile(); if (fp) uploadPf.mutate({ proformaId: pf.id, filePath: fp, importId: imp.id, tipo: 'factura' }) }}
                      className="p-1.5 rounded text-slate-500 hover:text-teal-400 hover:bg-slate-700 transition-colors"><Upload size={13} /></button>
                  )}
                  {confirmDel === pf.id ? (
                    <>
                      <button onClick={() => { deletePf.mutate({ id: pf.id, importId: imp.id, tipo: 'factura' }); setConfirmDel(null) }} className="p-1.5 rounded bg-red-600 hover:bg-red-500 text-white"><Check size={11} /></button>
                      <button onClick={() => setConfirmDel(null)} className="p-1.5 rounded bg-slate-700 text-slate-400"><X size={11} /></button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmDel(pf.id)} className="p-1.5 rounded text-slate-600 hover:text-red-400 hover:bg-slate-700 transition-colors"><Trash2 size={13} /></button>
                  )}
                </div>
              </div>
              {pf.stored_name && (
                <div className="flex items-center gap-2 px-3 pb-2 text-[10px] text-slate-600">
                  <FileText size={10} />
                  <span className="truncate">{pf.original_name}</span>
                  {pf.drive_status === 'synced'    && <span className="text-emerald-500 flex-shrink-0">☁ Drive</span>}
                  {pf.drive_status === 'uploading' && <Loader2 size={10} className="animate-spin text-blue-400" />}
                  {pf.drive_status === 'error'     && (
                    <button onClick={async () => { try { await window.api.comex.proformas.syncDrive(pf.id); qc.invalidateQueries({ queryKey: ['comex-proformas', imp.id, 'factura'] }) } catch (err) { toast.error(`Error Drive: ${err instanceof Error ? err.message : 'Error Drive'}`) } }}
                      className="flex items-center gap-1 text-amber-400 hover:text-amber-300 flex-shrink-0">
                      <AlertCircle size={10} /> Error Drive — Reintentar
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {facturas.length === 0 && <p className="text-xs text-slate-500 italic py-2">Sin facturas. Hacé click en "+ Nueva factura" o arrastrá el PDF.</p>}
      </div>

      {/* Total + aplicar */}
      {selected.length > 0 && (
        <div className="border border-slate-700/50 rounded-xl p-3 space-y-2 bg-slate-900/30">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">{selected.length} factura{selected.length !== 1 ? 's' : ''} seleccionada{selected.length !== 1 ? 's' : ''}</span>
            {totalSelected && <span className="text-sm font-bold text-teal-300">{fmt2(totalSelected.importe, totalSelected.moneda)}</span>}
          </div>
          {mixedCurrency && <p className="text-[10px] text-amber-400 flex items-center gap-1"><AlertCircle size={11} />Monedas distintas — seleccioná solo las de la misma moneda.</p>}
          {totalSelected && (
            <button onClick={handleApplyTotal}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold bg-teal-700 hover:bg-teal-600 text-white transition-colors">
              <Check size={12} /> Aplicar {fmt2(totalSelected.importe, totalSelected.moneda)} como "Valor factura"
            </button>
          )}
        </div>
      )}

      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <button onClick={handleAddFactura} disabled={createPf.isPending || uploadPf.isPending}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-teal-400 transition-colors disabled:opacity-40">
            {createPf.isPending || uploadPf.isPending ? <><Loader2 size={12} className="animate-spin" /> Procesando...</> : <><Plus size={12} /> Nueva factura</>}
          </button>
          <span className="text-[11px] text-slate-700 italic">o arrastrá el PDF aquí</span>
        </div>
        {createError && <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertCircle size={11} /> {createError}</p>}
      </div>

      {/* Panel IA */}
      {aiResult && (
        <div className="rounded-lg border border-violet-700/40 bg-violet-950/20 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-violet-900/20 border-b border-violet-700/30">
            <div className="flex items-center gap-1.5"><Bot size={12} className="text-violet-400" /><span className="text-[11px] font-semibold text-violet-300">Factura extraída por IA</span></div>
            <button onClick={() => setAiResult(null)} className="text-slate-500 hover:text-slate-300"><X size={12} /></button>
          </div>
          <div className="px-3 py-2.5 space-y-2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
              {aiResult.data.proveedor    && <><span className="text-slate-500">Proveedor</span><span className="text-slate-200 font-medium">{aiResult.data.proveedor}</span></>}
              {aiResult.data.nro_proforma && <><span className="text-slate-500">N° Factura</span><span className="text-slate-200">{aiResult.data.nro_proforma}</span></>}
              {aiResult.data.fecha        && <><span className="text-slate-500">Fecha</span><span className="text-slate-200">{formatFieldValue(aiResult.data.fecha)}</span></>}
              {aiResult.data.descripcion  && <><span className="text-slate-500">Descripción</span><span className="text-slate-300 truncate">{aiResult.data.descripcion}</span></>}
            </div>
            {aiResult.data.importe_total != null && (
              <div className="border-t border-violet-700/30 pt-2 flex justify-between text-[11px]">
                <span className="text-emerald-400 font-semibold">Total factura</span>
                <span className="text-emerald-300 font-bold">{fmt2(aiResult.data.importe_total, aiResult.data.moneda ?? imp.currency)}</span>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1 border-t border-violet-800/30">
              <button onClick={() => setAiResult(null)} className="px-2.5 py-1 rounded text-[11px] text-slate-400 hover:text-white">Descartar</button>
              <button onClick={handleApplyAI} disabled={applying}
                className="flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-medium bg-teal-600 hover:bg-teal-500 text-white disabled:opacity-50">
                {applying ? <><Loader2 size={11} className="animate-spin" />Aplicando...</> : <><Check size={11} />Aplicar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Cost Dashboard ────────────────────────────────────────────────────────────

function CostDashboard({ importId, imp }: { importId: string; imp: ComexImport }) {
  const qc                      = useQueryClient()
  const { data: customs }       = useComexCustoms(importId)
  const { data: tributos = [] } = useComexTributos(importId)
  const { data: extras = [] }   = useComexExtraCosts(importId)
  const { data: inalVeps = [] } = useInalVeps(imp.inal_required === 1 ? importId : null)

  const cotiz    = customs?.dolar_aduana ?? 0
  const currency = imp.currency || 'USD'
  const isEur    = currency === 'EUR'

  // TC EUR/ARS: cotización directa BNA (cuántos ARS vale 1 EUR)
  const [tcEurArs,    setTcEurArs]    = useState<number>(imp.tc_eur_ars ?? 0)
  const [bnaLoading,  setBnaLoading]  = useState(false)
  const [bnaMsg,      setBnaMsg]      = useState<string | null>(null)
  const [tcEditing,   setTcEditing]   = useState(false)
  const [tcInput,     setTcInput]     = useState(String(imp.tc_eur_ars ?? ''))

  // ⚠ Debe declararse ANTES de cualquier return condicional (reglas de hooks)
  const lastSavedPct = useRef<number | null>(null)

  // Sincronizar si el import cambia externamente
  useEffect(() => {
    if (imp.tc_eur_ars && imp.tc_eur_ars !== tcEurArs) {
      setTcEurArs(imp.tc_eur_ars)
      setTcInput(String(imp.tc_eur_ars))
    }
  }, [imp.tc_eur_ars])  // eslint-disable-line react-hooks/exhaustive-deps

  const fmt  = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtM = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`

  // ── Base valor factura ────────────────────────────────────────────────────────
  const actualValue = imp.actual_value  // en imp.currency

  const baseARS = (() => {
    if (!actualValue) return null
    if (!isEur) return cotiz > 0 ? actualValue * cotiz : null  // USD × cotiz_aduana
    if (tcEurArs > 0) return actualValue * tcEurArs            // EUR × tc_eur_ars → ARS directo
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
    // Flete internacional: siempre visible aunque sea $0
    { id: '_fi', categoria: 'flete_internacional' as const, concepto: 'Flete internacional', importe: fleteIntARS, moneda: 'ARS' as const, tipo_cambio: null },
    // Flete local: siempre visible aunque sea $0
    { id: '_fl', categoria: 'flete_local' as const, concepto: 'Flete local', importe: fleteLocARS, moneda: 'ARS' as const, tipo_cambio: null },
    ...otrosOrden
  ] as ComexImportExtraCost[]

  const vepTotalARS    = imp.inal_required === 1 ? inalVeps.reduce((s, v) => s + (v.importe_total ?? 0), 0) : 0
  const totalCostosARS = totalDerechosARS + totalExtraARS + vepTotalARS
  const pct            = baseARS && baseARS > 0 ? (totalCostosARS / baseARS) * 100 : null
  const barColor       = pct == null ? 'bg-slate-600' : pct < 15 ? 'bg-emerald-500' : pct < 25 ? 'bg-amber-500' : 'bg-red-500'

  // ── Auto-guardar cost_pct en el import ────────────────────────────────────────
  // (useEffect debe estar ANTES del return null — lastSavedPct ya está declarado arriba)
  useEffect(() => {
    if (pct == null) return
    const rounded = Math.round(pct * 100) / 100
    if (lastSavedPct.current === rounded) return
    lastSavedPct.current = rounded
    window.api.comex.imports.update(importId, { cost_pct: rounded })
      .then(() => qc.invalidateQueries({ queryKey: ['comex-imports'] }))
      .catch(console.error)
  }, [pct, importId])  // eslint-disable-line react-hooks/exhaustive-deps

  if (!actualValue && totalCostosARS === 0) return null

  // ── Consultar BNA (devuelve EUR/ARS directamente) ────────────────────────────
  const handleConsultarBNA = async () => {
    const ofic = customs?.oficializacion_date
    if (!ofic) {
      setBnaMsg('⚠ No hay fecha de oficialización cargada en el despacho. Cargala primero.')
      return
    }

    setBnaLoading(true); setBnaMsg(null)
    try {
      const dateStr = dayjs(ofic).format('YYYY-MM-DD')
      const result  = await window.api.bna.getEurArs(dateStr)

      if (!result) {
        setBnaMsg(`⚠ Sin cotización BNA para el ${dayjs(ofic).format('DD/MM/YYYY')} ni los 7 días anteriores. Ingresalo manualmente.`)
        return
      }

      const rounded = Math.round(result.eurArs * 100) / 100
      setTcEurArs(rounded)
      setTcInput(String(rounded))

      // Armar mensaje según si encontró la fecha exacta o tuvo que retroceder
      const fechaLabel = dayjs(result.fechaBNA).format('DD/MM/YYYY')
      if (result.esFechaExacta) {
        setBnaMsg(`✓ BNA ${fechaLabel}: $${fmt(rounded)} / EUR (venta)`)
      } else {
        const pedidaLabel = dayjs(ofic).format('DD/MM/YYYY')
        setBnaMsg(`✓ BNA ${fechaLabel}: $${fmt(rounded)} / EUR (venta) — la fecha ${pedidaLabel} era feriado/fin de semana, se usó el día hábil anterior`)
      }

      await window.api.comex.imports.update(importId, { tc_eur_ars: rounded })
      qc.invalidateQueries({ queryKey: ['comex-import', importId] })
    } catch (err) {
      setBnaMsg(`⚠ Error al consultar BNA: ${err instanceof Error ? err.message : 'desconocido'}. Ingresalo manualmente.`)
    } finally {
      setBnaLoading(false)
    }
  }

  const handleSaveTc = async () => {
    const val = Number(tcInput.replace(',', '.'))
    if (!val || isNaN(val)) return
    setTcEurArs(val)
    setTcEditing(false)
    await window.api.comex.imports.update(importId, { tc_eur_ars: val })
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
              {actualValue != null && (
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {!isEur
                    ? cotiz > 0 ? `${currency} ${fmt(actualValue)} × $${fmt(cotiz)}` : `${currency} ${fmt(actualValue)}`
                    : tcEurArs > 0
                      ? `EUR ${fmt(actualValue)} × $${fmt(tcEurArs)} ARS/EUR`
                      : `EUR ${fmt(actualValue)} — falta TC EUR/ARS`
                  }
                </p>
              )}
            </div>
            <span className="font-semibold text-slate-200 flex-shrink-0">
              {baseARS != null ? fmtM(baseARS) : '—'}
            </span>
          </div>

          {/* Panel EUR/ARS — solo si la factura es en EUR */}
          {isEur && (
            <div className="bg-amber-950/20 border border-amber-800/30 rounded-lg px-3 py-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] text-amber-400 font-medium">
                  TC EUR/ARS (BNA — fecha oficialización)
                </span>
                <div className="flex items-center gap-1.5">
                  {tcEditing ? (
                    <>
                      <input
                        autoFocus
                        value={tcInput}
                        onChange={e => setTcInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveTc(); if (e.key === 'Escape') setTcEditing(false) }}
                        placeholder="1644.12"
                        className="w-24 bg-slate-800 border border-amber-600 rounded px-2 py-1 text-xs text-white focus:outline-none"
                      />
                      <button onClick={handleSaveTc} className="p-1 rounded bg-amber-600 hover:bg-amber-500 text-white"><Check size={12} /></button>
                      <button onClick={() => setTcEditing(false)} className="p-1 rounded bg-slate-700 text-slate-400"><X size={12} /></button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-mono text-amber-300">
                        {tcEurArs > 0 ? `$${fmt(tcEurArs)}` : 'Sin definir'}
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
              {bnaMsg && <p className="text-[10px] text-amber-500">{bnaMsg}</p>}
              {tcEurArs > 0 && actualValue != null && (
                <p className="text-[10px] text-slate-500">
                  EUR {fmt(actualValue)} × ${fmt(tcEurArs)} = <span className="text-emerald-600 font-medium">{fmtM(actualValue * tcEurArs)} ARS</span>
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
            const ars   = costToARS(c, cotiz)
            const cero  = ars === 0
            return (
              <div key={c.id} className={cn('flex items-center justify-between text-xs', cero && 'opacity-50')}>
                <div className="flex items-center gap-2">
                  <span className={cero ? 'text-slate-500' : 'text-slate-400'}>
                    {EXTRA_COST_CATEGORY_LABELS[c.categoria]}
                  </span>
                  {cero && (
                    <span className="text-[10px] text-slate-600 italic">Sin factura</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {baseARS && !cero && (
                    <span className="text-slate-600 w-12 text-right">{((ars / baseARS) * 100).toFixed(1)}%</span>
                  )}
                  {baseARS && cero && <span className="w-12" />}
                  <span className={cn('w-28 text-right', cero ? 'text-slate-600' : 'text-slate-300')}>
                    {cero ? '$0' : fmtM(ars)}
                  </span>
                </div>
              </div>
            )
          })}
          {imp.inal_required === 1 && vepTotalARS > 0 && (
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">VEP Libre Circulación ANMAT</span>
              </div>
              <div className="flex items-center gap-3">
                {baseARS && (
                  <span className="text-slate-600 w-12 text-right">{((vepTotalARS / baseARS) * 100).toFixed(1)}%</span>
                )}
                <span className="text-violet-300 w-28 text-right">{fmtM(vepTotalARS)}</span>
              </div>
            </div>
          )}
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
      toast.error(err instanceof Error ? err.message : 'Error al analizar')
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

      if (d.proveedor)               newData.proveedor      = d.proveedor
      if (d.nro_factura)             newData.nro_factura    = d.nro_factura
      if (d.fecha)                   newData.fecha_factura  = dayjs(d.fecha).valueOf()
      if (d.cae)                     newData.cae            = d.cae
      if (d.moneda)                  newData.moneda         = d.moneda as 'ARS' | 'USD'

      // Importe neto como costo principal (IVA es recuperable)
      // Para facturas Exentas, importe_neto = importe_total cuando no hay campo separado
      const importe = d.importe_neto ?? d.importe_total
      if (importe != null) newData.importe = importe

      // Tipo de cambio — solo para facturas en moneda extranjera
      if (d.tipo_cambio_consignado != null && d.moneda !== 'ARS') {
        newData.tipo_cambio = d.tipo_cambio_consignado
      }

      // Importe en pesos
      if (d.moneda === 'ARS') {
        // Ya está en pesos: importe_ars = importe_neto
        newData.importe_ars = importe ?? undefined
        newData.moneda      = 'ARS'
      } else if (d.importe_ars != null) {
        newData.importe_ars = d.importe_ars
      } else if (importe != null && d.tipo_cambio_consignado != null) {
        newData.importe_ars = Math.round(importe * d.tipo_cambio_consignado * 100) / 100
      }

      // BL / HBL reference
      if (d.bl_referencia) newData.bl_referencia = d.bl_referencia

      if (d.importe_total != null) newData.importe_total = d.importe_total
      if (d.iva != null)           newData.importe_iva   = d.iva

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
                {cost.moneda === 'USD' && (
                  <p className="text-[10px] text-amber-600/80">
                    {cost.tipo_cambio
                      ? `× $${fmt(cost.tipo_cambio)} = $${Math.round(cost.importe * cost.tipo_cambio).toLocaleString('es-AR')} ARS`
                      : cotiz > 0 ? `× $${fmt(cotiz)} (cotiz. aduana) = $${fmt(arsAmt)} ARS` : ''
                    }
                  </p>
                )}
                {/* ARS: ya está en pesos, mostrar solo confirmación */}
                {cost.moneda === 'ARS' && cost.importe > 0 && (
                  <p className="text-[10px] text-slate-500">en pesos</p>
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
                {(() => {
                  // Para facturas exentas: el costo real es importe_total (no hay neto gravado separado)
                  const costoBase   = (facturaResult.importe_neto ?? 0) > 0
                    ? facturaResult.importe_neto!
                    : (facturaResult.importe_total ?? null)
                  const costoLabel  = (facturaResult.importe_neto ?? 0) > 0 ? 'Neto gravado' : 'Total (exento)'
                  const arsCalculado = costoBase != null && tc ? Math.round(costoBase * tc) : null
                  const arsExplicito = facturaResult.importe_ars

                  return costoBase != null ? (
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-emerald-400 font-semibold">{costoLabel} — costo real</span>
                        <span className="text-emerald-300 font-bold">{fmtM(costoBase)}</span>
                      </div>
                      {/* Desglose: moneda × TC = ARS (solo para USD/EUR) */}
                      {esFx && tc && mon !== 'ARS' && (
                        <div className="flex justify-end text-[10px] text-amber-600 font-medium">
                          {mon} {fmt2(costoBase)} × ${fmt2(tc)} = ${(arsExplicito ?? arsCalculado ?? 0).toLocaleString('es-AR')} ARS
                        </div>
                      )}
                      {/* ARS: ya está en pesos, solo confirmar */}
                      {mon === 'ARS' && (
                        <div className="flex justify-end text-[10px] text-slate-500">
                          Factura en pesos — sin conversión de TC
                        </div>
                      )}
                    </div>
                  ) : null
                })()}
                {facturaResult.iva != null && facturaResult.iva > 0 && (
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">IVA (recuperable)</span>
                    <span className="text-slate-400">{fmtM(facturaResult.iva)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-1 border-t border-violet-800/30">
                <button onClick={() => setFacturaResult(null)} className="px-2.5 py-1 rounded text-[11px] text-slate-400 hover:text-white transition-colors">Descartar</button>
                <button onClick={handleApplyFactura} disabled={applying}
                  className="flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-medium bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 transition-colors">
                  {applying
                    ? <><Loader2 size={11} className="animate-spin" /> Aplicando...</>
                    : <><Check size={11} /> Aplicar</>
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
  const qc           = useQueryClient()
  const uploadInv    = useUploadExtraCostInvoice()
  const updateCost   = useUpdateComexExtraCost()
  const deleteCost   = useDeleteComexExtraCost()
  const analyzeInv   = useAnalyzeExtraCost()
  const { data: customs }      = useComexCustoms(importId)
  const { data: extras  = [] } = useComexExtraCosts(importId)
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
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error al analizar') }
    finally { setAnalyzing(false) }
  }

  const handleApply = async () => {
    if (!aiResult) return
    setApplying(true)
    try {
      const d      = aiResult
      const fx     = aiResult as import('@shared/types').ExtractedFacturaLocal

      // Debug: log para verificar qué está en aiResult
      console.log('[Despachante apply] aiResult:', JSON.stringify({
        proveedor: d.proveedor,
        nro_factura: d.nro_factura,
        importe_neto: d.importe_neto,
        importe_total: d.importe_total,
        moneda: d.moneda,
        flete_local_items: fx.flete_local_items,
      }, null, 2))

      const patch: Partial<ComexImportExtraCost> = {}

      // ── Campos de identificación ──────────────────────────────────────────
      if (d.proveedor)   patch.proveedor   = d.proveedor
      if (d.nro_factura) patch.nro_factura = d.nro_factura
      if (d.fecha)       patch.fecha_factura = dayjs(d.fecha).valueOf()
      if (d.cae)         patch.cae         = d.cae
      if (d.moneda)      patch.moneda      = d.moneda as 'ARS' | 'USD'

      // ── Flete local items: mover al Flete local antes de calcular el importe ──
      const fleteLocalItems = fx.flete_local_items?.filter(i => i.importe_neto > 0) ?? []
      const totalFleteLocal = fleteLocalItems.reduce((s, i) => s + i.importe_neto, 0)

      if (fleteLocalItems.length > 0 && totalFleteLocal > 0) {
        // Consultar directamente la API para tener datos frescos (no depender del cache)
        const allExtras = await window.api.comex.extraCosts.list(importId)
        const fleteLocalCost = allExtras.find((e: import('@shared/types').ComexImportExtraCost) => e.categoria === 'flete_local')

        if (fleteLocalCost) {
          await window.api.comex.extraCosts.update(fleteLocalCost.id, {
            importe:    totalFleteLocal,
            moneda:     'ARS',
            concepto:   'Flete local',
            proveedor:  d.proveedor ?? '',
            nro_factura: d.nro_factura ?? '',
            fecha_factura: d.fecha ? dayjs(d.fecha).valueOf() : null,
            items_json: JSON.stringify(fleteLocalItems.map(i => ({ concepto: i.concepto, importe: i.importe_neto }))),
          })
          qc.invalidateQueries({ queryKey: ['comex-extra-costs', importId] })
          qc.invalidateQueries({ queryKey: ['comex-import', importId] })
        }
      }

      // ── Importe principal: neto gravado si existe, sino total (facturas Exentas) ──
      // Restar los ítems de flete del importe del despachante (ya se movieron al flete local)
      const importeBase = (d.importe_neto != null && d.importe_neto > 0)
        ? d.importe_neto
        : (d.importe_total ?? null)
      const importe = importeBase != null ? Math.max(importeBase - totalFleteLocal, 0) : null
      if (importe != null) patch.importe = importe

      // ── Tipo de cambio: solo para facturas en moneda extranjera ──────────
      if (fx.tipo_cambio_consignado != null && d.moneda !== 'ARS') {
        patch.tipo_cambio = fx.tipo_cambio_consignado
      }

      // ── Importe en pesos ──────────────────────────────────────────────────
      if (d.moneda === 'ARS') {
        patch.importe_ars = importe ?? undefined   // ya está en pesos
      } else if (fx.importe_ars != null) {
        patch.importe_ars = fx.importe_ars          // devuelto explícito por la IA
      } else if (importe != null && fx.tipo_cambio_consignado != null) {
        patch.importe_ars = Math.round(importe * fx.tipo_cambio_consignado * 100) / 100
      }

      // ── Otros campos ─────────────────────────────────────────────────────
      if (d.referencia_despacho)   patch.referencia_despacho = d.referencia_despacho
      if (d.iva != null)           patch.importe_iva         = d.iva
      if (d.importe_total != null) patch.importe_total       = d.importe_total
      if (d.items?.length)         patch.items_json          = JSON.stringify(d.items)
      if (fx.bl_referencia)        patch.bl_referencia       = fx.bl_referencia
      if (fx.percepciones != null)    patch.percepciones    = fx.percepciones
      if (fx.percepcion_caba != null) patch.percepcion_caba = fx.percepcion_caba
      if (fx.percepcion_bsas != null) patch.percepcion_bsas = fx.percepcion_bsas
      if (fx.fecha_ingreso)           patch.fecha_ingreso   = fx.fecha_ingreso
      if (fx.fecha_egreso)            patch.fecha_egreso    = fx.fecha_egreso
      if (fx.nro_contenedor)          patch.nro_contenedor  = fx.nro_contenedor
      if (fx.canal_deposito)          patch.canal_deposito  = fx.canal_deposito

      // ── Datos de carga → propagar a customs ──────────────────────────────
      const customsPatch: Record<string, unknown> = {}
      if (fx.cant_bultos_deposito   != null) customsPatch.cant_bultos   = fx.cant_bultos_deposito
      if (fx.peso_bruto_kg_deposito != null) customsPatch.peso_bruto_kg = fx.peso_bruto_kg_deposito
      if (fx.volumen_m3_deposito    != null) customsPatch.volumen_m3    = fx.volumen_m3_deposito
      if (Object.keys(customsPatch).length > 0) {
        window.api.comex.customs.upsert(importId, customsPatch as Parameters<typeof window.api.comex.customs.upsert>[1])
          .catch(console.error)
      }

      // Persistir en DB — log para debug
      console.log('[Despachante apply] patch keys:', Object.keys(patch))
      console.log('[Despachante apply] patch.importe:', patch.importe)
      console.log('[Despachante apply] localCost.id:', localCost.id)

      if (Object.keys(patch).length) {
        try {
          await window.api.comex.extraCosts.update(localCost.id, patch)
          console.log('[Despachante apply] ✓ update OK')
          qc.invalidateQueries({ queryKey: ['comex-extra-costs', importId] })
          qc.invalidateQueries({ queryKey: ['comex-import', importId] })
        } catch (err) {
          console.error('[Despachante apply] ✗ update FAILED:', err)
          toast.error(`Error al guardar: ${err instanceof Error ? err.message : String(err)}`)
          return
        }
      }

      // Actualizar pantalla y cerrar modal DESPUÉS de guardar en DB
      setLocalCost(prev => ({ ...prev, ...patch }))
      setAiResult(null)

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
          {localCost.importe > 0 && (() => {
            const isUSD = localCost.moneda === 'USD'
            const fmt2  = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            // Si hay importe_ars calculado, mostrarlo como equivalente
            const arsAmt = localCost.importe_ars
              ?? (isUSD && localCost.tipo_cambio ? Math.round(localCost.importe * localCost.tipo_cambio) : null)

            return (
              <span className="text-xs font-semibold text-white flex items-center gap-1">
                {isUSD
                  ? <><span className="text-amber-300">USD {fmt2(localCost.importe)}</span>
                      {arsAmt && <span className="text-slate-400 font-normal">= ${fmtInt(arsAmt)}</span>}
                    </>
                  : `$${fmtInt(localCost.importe)}`
                }
              </span>
            )
          })()}
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
              const isUSD  = localCost.moneda === 'USD'
              const tc     = localCost.tipo_cambio
              // Para ARS: entero. Para USD: 2 decimales con símbolo de moneda
              const fmtAmt = (n: number) => isUSD
                ? `USD ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : `$${Math.round(n).toLocaleString('es-AR')}`
              const fmtArs = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`
              const fmt2   = fmtAmt   // alias para backward compat

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
                    {/* TC consignado — solo para facturas USD/EUR */}
                    {isUSD && tc && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">TC consignado</span>
                        <span className="text-amber-400 font-semibold">
                          ${tc.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} / USD
                        </span>
                      </div>
                    )}
                    {/* BL / HBL */}
                    {localCost.bl_referencia && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">BL / HBL</span>
                        <span className="text-cyan-400 font-mono">{localCost.bl_referencia}</span>
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
                          <span className="text-slate-300 flex-shrink-0">{fmt2(item.importe)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Totales */}
                  {(localCost.importe > 0 || localCost.importe_iva != null) && (
                    <div className="border-t border-slate-700/40 px-3 py-2 space-y-0.5">
                      {localCost.importe > 0 && (
                        <div className="space-y-0.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-emerald-400 font-semibold">
                              {isUSD ? 'Total USD (costo real)' : 'Neto gravado (costo real)'}
                            </span>
                            <span className="text-emerald-300 font-bold">{fmtAmt(localCost.importe)}</span>
                          </div>
                          {/* Desglose USD × TC = ARS */}
                          {isUSD && tc && (
                            <div className="flex justify-end text-[10px] text-amber-500/80">
                              USD {localCost.importe.toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2})}
                              {' × '}
                              ${tc.toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2})}
                              {' = '}
                              {fmtArs(localCost.importe_ars ?? localCost.importe * tc)} ARS
                            </div>
                          )}
                        </div>
                      )}
                      {localCost.importe_iva != null && localCost.importe_iva > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">IVA (recuperable)</span>
                          <span className="text-slate-400">{fmtAmt(localCost.importe_iva)}</span>
                        </div>
                      )}
                      {localCost.percepcion_caba != null && localCost.percepcion_caba > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Percep. IIBB CABA</span>
                          <span className="text-slate-400">{fmtAmt(localCost.percepcion_caba)}</span>
                        </div>
                      )}
                      {localCost.percepcion_bsas != null && localCost.percepcion_bsas > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Percep. IIBB BS AS</span>
                          <span className="text-slate-400">{fmtAmt(localCost.percepcion_bsas)}</span>
                        </div>
                      )}
                      {/* Otras percepciones no identificadas */}
                      {localCost.percepciones != null && localCost.percepciones > 0 &&
                       (localCost.percepcion_caba ?? 0) + (localCost.percepcion_bsas ?? 0) < localCost.percepciones - 0.01 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Otras percepciones</span>
                          <span className="text-slate-400">{fmtAmt(localCost.percepciones - (localCost.percepcion_caba ?? 0) - (localCost.percepcion_bsas ?? 0))}</span>
                        </div>
                      )}
                      {localCost.importe_total != null && !isUSD && (
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Total factura</span>
                          <span className="text-slate-300">{fmtAmt(localCost.importe_total)}</span>
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
                      {fx.fecha_ingreso  && fx.fecha_ingreso !== 'null'  && <><span className="text-slate-500">Ingreso</span><span className="text-slate-300">{formatFieldValue(fx.fecha_ingreso)}</span></>}
                      {fx.fecha_egreso   && fx.fecha_egreso  !== 'null'  && <><span className="text-slate-500">Egreso</span><span className="text-slate-300">{formatFieldValue(fx.fecha_egreso)}</span></>}
                      {fx.nro_contenedor && <><span className="text-slate-500">Contenedor</span><span className="text-slate-300 font-mono text-[10px]">{fx.nro_contenedor}</span></>}
                      {/* Datos de carga extraídos de la línea "AMPARADA POR" */}
                      {fx.cant_bultos_deposito   != null && <><span className="text-slate-500">Bultos</span><span className="text-emerald-400 font-semibold">{fx.cant_bultos_deposito} cajas</span></>}
                      {fx.peso_bruto_kg_deposito != null && <><span className="text-slate-500">Peso bruto</span><span className="text-emerald-400 font-semibold">{fx.peso_bruto_kg_deposito.toLocaleString('es-AR')} kg</span></>}
                      {fx.volumen_m3_deposito    != null && <><span className="text-slate-500">Volumen</span><span className="text-emerald-400 font-semibold">{fx.volumen_m3_deposito} m³</span></>}
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

                {/* Notificación de ítems de Flete local detectados */}
                {(() => {
                  const fx = aiResult as import('@shared/types').ExtractedFacturaLocal
                  const fleteItems = fx.flete_local_items?.filter(i => i.importe_neto > 0) ?? []
                  if (fleteItems.length === 0) return null
                  const total = fleteItems.reduce((s, i) => s + i.importe_neto, 0)
                  const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  return (
                    <div className="rounded-lg bg-cyan-950/30 border border-cyan-700/40 px-3 py-2.5 space-y-1.5">
                      <p className="text-[11px] font-semibold text-cyan-300 flex items-center gap-1.5">
                        <Ship size={11} />
                        Se detectaron ítems de Flete local — se copiarán automáticamente
                      </p>
                      {fleteItems.map((item, i) => (
                        <div key={i} className="flex justify-between text-[10px]">
                          <span className="text-slate-400">{item.concepto}</span>
                          <div className="text-right">
                            <span className="text-cyan-400">${fmt(item.importe_neto)}</span>
                            {item.iva_porcentaje != null && item.iva_porcentaje > 0 && (
                              <span className="text-slate-600 ml-1.5">+ IVA {item.iva_porcentaje}% (recuperable)</span>
                            )}
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-between text-[11px] border-t border-cyan-800/40 pt-1.5">
                        <span className="text-cyan-300 font-semibold">Total Flete local neto</span>
                        <span className="text-cyan-300 font-bold">${fmt(total)}</span>
                      </div>
                      <p className="text-[10px] text-slate-600">
                        IVA no incluido — es crédito fiscal recuperable. Se registra solo el neto.
                      </p>
                    </div>
                  )
                })()}

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
                      : <><Check size={11} /> Aplicar</>
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
      toast.error('Primero subí el PDF del despacho en la sección "Despacho de Aduana".')
      return
    }
    setLoadingAI(true)
    try {
      const result = await analyzeDespacho.mutateAsync({ importId: imp.id, page: 1 })
      const d = result.structured as import('@shared/types').ExtractedDespacho
      if (!d?.tributos?.length) { toast.error('No se encontraron tributos en el despacho.'); return }
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
      toast.error(err instanceof Error ? err.message : 'Error al analizar')
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

// ── PL File Card — una tarjeta por archivo PL ───────────────────────────────

function PLFileCard({
  file, importId, customs, plIndex, qc,
  onDeleted, onUpdated
}: {
  file:     ComexImportPlFile
  importId: string
  customs:  ComexCustoms | null
  plIndex:  number
  qc:       ReturnType<typeof useQueryClient>
  onDeleted: () => void
  onUpdated: (files: ComexImportPlFile[]) => void
}) {
  const analyzePlFile            = useAnalyzePlFile()
  const { data: aiConfigured }   = useAIConfigured()
  const [aiResult,  setAiResult] = useState<import('@shared/types').ExtractedPL | null>(null)
  const [analyzing, setAnalyzing]= useState(false)
  const [applying,  setApplying] = useState(false)
  const [confirmDel,setConfirmDel]=useState(false)
  const fmtNum = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 3 })

  const savedData: import('@shared/types').ExtractedPL | null = (() => {
    if (!file.extracted_json) return null
    try { return JSON.parse(file.extracted_json) } catch { return null }
  })()

  const handleAnalyze = async () => {
    setAnalyzing(true)
    try {
      const result = await analyzePlFile.mutateAsync(file.id)
      const d = result.structured as import('@shared/types').ExtractedPL
      if (d) setAiResult(d)
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error al analizar') }
    finally { setAnalyzing(false) }
  }

  const handleApplyIndividual = async () => {
    if (!aiResult) return
    setApplying(true)
    try {
      const files = await window.api.comex.plFiles.updateExtracted(file.id, JSON.stringify(aiResult))
      if (files) onUpdated(files)
      setAiResult(null)
    } finally { setApplying(false) }
  }

  const handleDelete = async () => {
    const files = await window.api.comex.plFiles.delete(file.id)
    if (files) onUpdated(files)
    onDeleted()
  }

  const isXLS = (name: string | null) => name ? /\.(xls|xlsx)$/i.test(name) : false
  const label = `PL ${plIndex + 1}`

  return (
    <div className="rounded-lg border border-emerald-800/30 bg-slate-900/40 overflow-hidden">
      {/* Mini-header del archivo */}
      <div className="flex items-center justify-between px-3 py-2 bg-emerald-950/20 border-b border-emerald-800/20">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">{label}</span>
          {isXLS(file.original_name) && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-400 font-medium">XLS</span>
          )}
          {file.drive_status === 'synced'    && <span className="flex items-center gap-0.5 text-[9px] text-emerald-400"><Cloud size={9} /> Drive</span>}
          {file.drive_status === 'uploading' && <span className="flex items-center gap-0.5 text-[9px] text-blue-400"><Loader2 size={9} className="animate-spin" /> Subiendo</span>}
          {file.drive_status === 'error'     && <span className="flex items-center gap-0.5 text-[9px] text-red-400"><AlertCircle size={9} /> Error</span>}
        </div>
        <div className="flex items-center gap-1">
          {file.drive_file_id && (
            <button onClick={() => window.api.shell.open(`https://drive.google.com/file/d/${file.drive_file_id}/view`)}
              title="Ver en Drive" className="p-1 rounded text-slate-500 hover:text-emerald-400 hover:bg-slate-700 transition-colors">
              <ExternalLink size={11} />
            </button>
          )}
          <button onClick={() => window.api.comex.plFiles.open(file.id)}
            title="Abrir" className="p-1 rounded text-slate-500 hover:text-emerald-400 hover:bg-slate-700 transition-colors">
            <FolderOpen size={11} />
          </button>
          {confirmDel ? (
            <>
              <button onClick={handleDelete}
                className="p-1 rounded bg-red-600 hover:bg-red-500 text-white transition-colors">
                <Check size={11} />
              </button>
              <button onClick={() => setConfirmDel(false)}
                className="p-1 rounded bg-slate-700 text-slate-400 transition-colors">
                <X size={11} />
              </button>
            </>
          ) : (
            <button onClick={() => setConfirmDel(true)} title="Eliminar"
              className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors">
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>

      <div className="px-3 py-2.5 space-y-2">
        <p className="text-[11px] text-slate-300 truncate font-medium">{file.original_name ?? 'Packing List'}</p>

        {/* Datos guardados */}
        {savedData && !aiResult && (() => {
          const d = savedData
          const isNum = (v: unknown): v is number => typeof v === 'number'
          return (
            <div className="rounded bg-slate-800/60 px-2.5 py-2">
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
                {isNum(d.cant_cartons)  && <><span className="text-slate-500">Cajas</span><span className="text-emerald-300 font-semibold">{d.cant_cartons}</span></>}
                {isNum(d.cant_pallets)  && <><span className="text-slate-500">Pallets</span><span className="text-emerald-300 font-semibold">{d.cant_pallets}</span></>}
                {isNum(d.peso_bruto_kg) && <><span className="text-slate-500">Peso</span><span className="text-emerald-300 font-semibold">{fmtNum(d.peso_bruto_kg)} kg</span></>}
                {isNum(d.volumen_m3)    && <><span className="text-slate-500">Volumen</span><span className="text-emerald-300 font-semibold">{fmtNum(d.volumen_m3)} m³</span></>}
                {d.nro_contenedor && d.nro_contenedor !== 'null' && <><span className="text-slate-500">Cont.</span><span className="text-slate-300 font-mono text-[9px]">{d.nro_contenedor}</span></>}
              </div>
              {d.descripcion_carga && d.descripcion_carga !== 'null' && (
                <p className="text-[9px] text-slate-500 italic mt-1">{d.descripcion_carga}</p>
              )}
            </div>
          )
        })()}

        {/* Resultado IA pendiente de aplicar */}
        {aiResult && (() => {
          const d = aiResult
          return (
            <div className="rounded border border-violet-700/40 bg-violet-950/20 overflow-hidden">
              <div className="flex items-center justify-between px-2.5 py-1.5 bg-violet-900/20 border-b border-violet-700/30">
                <div className="flex items-center gap-1.5">
                  <Bot size={10} className="text-violet-400" />
                  <span className="text-[10px] font-semibold text-violet-300">Datos extraídos por IA</span>
                </div>
                <button onClick={() => setAiResult(null)} className="text-slate-500 hover:text-slate-300"><X size={10} /></button>
              </div>
              <div className="px-2.5 py-2 space-y-1.5">
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
                  {typeof d.cant_cartons  === 'number' && <><span className="text-slate-500">Cajas</span><span className="text-emerald-400 font-semibold">{d.cant_cartons}</span></>}
                  {typeof d.cant_pallets  === 'number' && <><span className="text-slate-500">Pallets</span><span className="text-emerald-400 font-semibold">{d.cant_pallets}</span></>}
                  {typeof d.peso_bruto_kg === 'number' && <><span className="text-slate-500">Peso</span><span className="text-emerald-400 font-semibold">{(d.peso_bruto_kg).toLocaleString('es-AR', { maximumFractionDigits: 3 })} kg</span></>}
                  {typeof d.volumen_m3    === 'number' && <><span className="text-slate-500">Volumen</span><span className="text-emerald-400 font-semibold">{(d.volumen_m3).toLocaleString('es-AR', { maximumFractionDigits: 3 })} m³</span></>}
                  {d.nro_contenedor && d.nro_contenedor !== 'null' && <><span className="text-slate-500">Cont.</span><span className="text-slate-300 font-mono text-[9px]">{d.nro_contenedor}</span></>}
                </div>
                <div className="flex justify-end gap-1.5 pt-1 border-t border-violet-800/30">
                  <button onClick={() => setAiResult(null)} className="px-2 py-0.5 rounded text-[10px] text-slate-400 hover:text-white transition-colors">Descartar</button>
                  <button onClick={handleApplyIndividual} disabled={applying}
                    className="flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-medium bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 transition-colors">
                    {applying ? <><Loader2 size={9} className="animate-spin" /> Guardando...</> : <><Check size={9} /> Guardar</>}
                  </button>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Botón IA */}
        {aiConfigured && (
          <button onClick={handleAnalyze} disabled={analyzing}
            className={cn(
              'w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors',
              analyzing ? 'bg-violet-800/50 text-violet-300 cursor-wait' : 'bg-violet-800/60 hover:bg-violet-700 text-violet-200'
            )}
          >
            {analyzing
              ? <><Loader2 size={11} className="animate-spin" /> Analizando...</>
              : <><Sparkles size={11} /> {savedData ? 'Reanalizar' : 'Extraer con IA'}</>
            }
          </button>
        )}
      </div>
    </div>
  )
}

// ── PL - Packing List Section (multi-documento) ──────────────────────────────

function PLSection({
  imp, importId, customs, onUpdate
}: {
  imp:      ComexImport
  importId: string
  customs:  ComexCustoms | null
  onUpdate: (data: Partial<ComexImport>) => void
}) {
  const qc = useQueryClient()
  const { data: aiConfigured } = useAIConfigured()

  const [plFiles,     setPlFiles]     = useState<ComexImportPlFile[]>([])
  const [loading,     setLoading]     = useState(true)
  const [uploading,   setUploading]   = useState(false)
  const [applying,    setApplying]    = useState(false)
  const [isDragOver,  setIsDragOver]  = useState(false)
  const dragCounter = useRef(0)

  const fmtNum = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 3 })

  // Cargar lista inicial
  useEffect(() => {
    window.api.comex.plFiles.list(importId)
      .then(setPlFiles)
      .finally(() => setLoading(false))
  }, [importId])

  const invalidateParentQuery = () =>
    qc.invalidateQueries({ queryKey: ['comex-import-pl-files', importId] })

  const handleUploadFile = async (filePath?: string, fileBuffer?: ArrayBuffer, fileName?: string) => {
    setUploading(true)
    try {
      const files = await window.api.comex.plFiles.upload({
        importId,
        importFolderId: imp.pl_folder_id ?? imp.drive_folder_id ?? null,
        filePath,
        fileBuffer,
        fileName,
      })
      if (files) { setPlFiles(files); invalidateParentQuery() }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir')
    } finally {
      setUploading(false)
    }
  }

  const handleSelectFile = async () => {
    const fp = await window.api.comex.pl.selectFile()
    if (fp) handleUploadFile(fp)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); dragCounter.current = 0; setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const fp = window.api.getPathForFile(file)
    if (fp) {
      handleUploadFile(fp)
    } else {
      file.arrayBuffer().then(buf => handleUploadFile(undefined, buf, file.name))
    }
  }

  // Totales sumados de todos los PLs con datos extraídos
  const totals = (() => {
    const filesWithData = plFiles.filter(f => f.extracted_json)
    if (!filesWithData.length) return null
    let peso = 0, vol = 0, pallets = 0, cartons = 0, hasPeso = false, hasVol = false, hasPallets = false, hasCartons = false
    for (const f of filesWithData) {
      try {
        const d = JSON.parse(f.extracted_json!) as import('@shared/types').ExtractedPL
        if (typeof d.peso_bruto_kg === 'number') { peso    += d.peso_bruto_kg; hasPeso    = true }
        if (typeof d.volumen_m3    === 'number') { vol     += d.volumen_m3;    hasVol     = true }
        if (typeof d.cant_pallets  === 'number') { pallets += d.cant_pallets;  hasPallets = true }
        if (typeof d.cant_cartons  === 'number') { cartons += d.cant_cartons;  hasCartons = true }
      } catch { /* ignore */ }
    }
    return { peso: hasPeso ? peso : null, vol: hasVol ? vol : null, pallets: hasPallets ? pallets : null, cartons: hasCartons ? cartons : null, count: filesWithData.length }
  })()

  const handleApplyTotals = async () => {
    if (!totals) return
    setApplying(true)
    try {
      const customsPatch: Record<string, unknown> = {}

      // Siempre sobreescribir con los totales sumados de todos los PLs
      if (totals.pallets != null) customsPatch.cant_pallets  = totals.pallets
      if (totals.cartons != null) customsPatch.cant_cartons  = totals.cartons
      if (totals.peso    != null) customsPatch.peso_bruto_kg = totals.peso
      if (totals.vol     != null) customsPatch.volumen_m3    = totals.vol

      // Contenedor: tomar del primer PL que lo tenga
      for (const f of plFiles) {
        if (!f.extracted_json) continue
        try {
          const d = JSON.parse(f.extracted_json) as import('@shared/types').ExtractedPL
          if (d.nro_contenedor && d.nro_contenedor !== 'null') { customsPatch.nro_contenedor = d.nro_contenedor; break }
        } catch { /* ignore */ }
      }

      if (Object.keys(customsPatch).length) {
        await window.api.comex.customs.upsert(importId, customsPatch as Parameters<typeof window.api.comex.customs.upsert>[1])
        qc.invalidateQueries({ queryKey: ['comex-customs', importId] })
      }
    } finally { setApplying(false) }
  }

  return (
    <div
      className={cn('rounded-xl border-2 transition-colors', isDragOver ? 'border-emerald-500 bg-emerald-950/20' : 'border-emerald-800/30 bg-slate-800/30')}
      onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setIsDragOver(true) }}
      onDragLeave={(e) => { e.preventDefault(); if (--dragCounter.current <= 0) setIsDragOver(false) }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-emerald-950/30 border-b border-emerald-800/30">
        <div className="flex items-center gap-2">
          <Package size={14} className="text-emerald-400" />
          <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">PL - Packing List</h3>
          {plFiles.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 font-medium">{plFiles.length} archivo{plFiles.length > 1 ? 's' : ''}</span>
          )}
        </div>
        {uploading && (
          <span className="flex items-center gap-1 text-[10px] text-blue-400"><Loader2 size={11} className="animate-spin" /> Subiendo...</span>
        )}
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-slate-600 text-xs">
            <Loader2 size={14} className="animate-spin mr-2" /> Cargando...
          </div>
        ) : (
          <>
            {/* Tarjetas de archivos */}
            {plFiles.length > 0 && (
              <div className="space-y-2">
                {plFiles.map((f, i) => (
                  <PLFileCard
                    key={f.id}
                    file={f}
                    importId={importId}
                    customs={customs}
                    plIndex={i}
                    qc={qc}
                    onDeleted={() => { setPlFiles(prev => prev.filter(x => x.id !== f.id)); invalidateParentQuery() }}
                    onUpdated={(files) => { setPlFiles(files); invalidateParentQuery() }}
                  />
                ))}
              </div>
            )}

            {/* Totales (cuando hay 2+ PLs con datos, o 1 con datos para consistencia) */}
            {totals && plFiles.length >= 2 && (
              <div className="rounded-lg border border-emerald-700/40 bg-emerald-950/20 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-emerald-900/20 border-b border-emerald-700/30">
                  <span className="text-[11px] font-bold text-emerald-300">Totales ({totals.count} PL{totals.count > 1 ? 's' : ''})</span>
                </div>
                <div className="px-3 py-2.5">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
                    {totals.cartons  != null && <><span className="text-slate-400">Cajas</span><span className="text-emerald-200 font-bold">{totals.cartons}</span></>}
                    {totals.pallets  != null && <><span className="text-slate-400">Pallets</span><span className="text-emerald-200 font-bold">{totals.pallets}</span></>}
                    {totals.peso     != null && <><span className="text-slate-400">Peso bruto</span><span className="text-emerald-200 font-bold">{fmtNum(totals.peso)} kg</span></>}
                    {totals.vol      != null && <><span className="text-slate-400">Volumen</span><span className="text-emerald-200 font-bold">{fmtNum(totals.vol)} m³</span></>}
                  </div>
                </div>
              </div>
            )}

            {/* Botón Aplicar totales a Aduana */}
            {totals && (
              <button onClick={handleApplyTotals} disabled={applying}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-semibold transition-colors',
                  applying ? 'bg-emerald-800/50 text-emerald-300 cursor-wait' : 'bg-emerald-700/60 hover:bg-emerald-600/70 text-emerald-100'
                )}
              >
                {applying
                  ? <><Loader2 size={12} className="animate-spin" /> Aplicando...</>
                  : <><Check size={12} /> Aplicar {plFiles.length >= 2 ? 'totales' : 'datos'} a Datos de la carga</>
                }
              </button>
            )}

            {/* Zona drag-drop para agregar más PLs */}
            <div
              className={cn(
                'flex flex-col items-center justify-center py-4 px-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors',
                isDragOver
                  ? 'border-emerald-500 bg-emerald-950/30 text-emerald-300'
                  : 'border-slate-700 hover:border-emerald-700 text-slate-500'
              )}
              onClick={handleSelectFile}
            >
              {uploading
                ? <><Loader2 size={16} className="animate-spin mb-1" /><span className="text-xs">Subiendo...</span></>
                : <><Upload size={16} className="mb-1" /><span className="text-xs font-medium">{isDragOver ? 'Soltar aquí...' : plFiles.length === 0 ? 'Arrastrá o hacé click para subir el Packing List' : 'Agregar otro PL'}</span><span className="text-[10px] mt-0.5">PDF, XLS, XLSX</span></>
              }
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── BL - Bill of Lading Section ───────────────────────────────────────────────

function BLSection({
  imp, importId, customs, onUpdate
}: {
  imp:      ComexImport
  importId: string
  customs:  import('@shared/types').ComexCustoms | null
  onUpdate: (data: Partial<ComexImport>) => void
}) {
  const qc          = useQueryClient()
  const analyzeBL   = useAnalyzeBL()
  const { data: aiConfigured } = useAIConfigured()

  const [aiResult,      setAiResult]      = useState<import('@shared/types').ExtractedBL | null>(null)
  const [analyzing,     setAnalyzing]     = useState(false)
  const [applying,      setApplying]      = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDragOver,    setIsDragOver]    = useState(false)
  const [alerts,        setAlerts]        = useState<string[]>([])
  const dragCounter = useRef(0)

  const hasFile = !!imp.bl_stored_name
  const fmtNum  = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 3 })

  const handleUpload = async (filePath: string) => {
    const result = await window.api.comex.bl.upload(importId, filePath)
    onUpdate(result as Partial<ComexImport>)
    qc.invalidateQueries({ queryKey: ['comex-import', importId] })
  }

  const handleSelectFile = async () => {
    const fp = await window.api.comex.bl.selectFile()
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
    setAnalyzing(true); setAlerts([])
    try {
      const result = await analyzeBL.mutateAsync(importId)
      const d = result.structured as import('@shared/types').ExtractedBL
      if (d) setAiResult(d)
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error al analizar') }
    finally { setAnalyzing(false) }
  }

  // Helper: normaliza valores que la IA puede devolver como string "null"
  const cleanBLField = <T,>(v: T): T | null =>
    (v === 'null' || v === null || v === undefined) ? null : v

  const handleApply = async () => {
    if (!aiResult) return
    setApplying(true); setAlerts([])
    try {
      // Sanitizar campos donde la IA a veces devuelve el string "null"
      const d: import('@shared/types').ExtractedBL = {
        ...aiResult,
        cant_pallets:  typeof aiResult.cant_pallets  === 'string' ? null : aiResult.cant_pallets,
        cant_cartons:  typeof aiResult.cant_cartons  === 'string' ? null : aiResult.cant_cartons,
        peso_bruto_kg: typeof aiResult.peso_bruto_kg === 'string' ? null : aiResult.peso_bruto_kg,
        volumen_m3:    typeof aiResult.volumen_m3    === 'string' ? null : aiResult.volumen_m3,
        bl_number:     cleanBLField(aiResult.bl_number),
        nro_contenedor:cleanBLField(aiResult.nro_contenedor),
        consignor:     cleanBLField(aiResult.consignor),
        buque:         cleanBLField(aiResult.buque),
        puerto_embarque:cleanBLField(aiResult.puerto_embarque),
        puerto_descarga:cleanBLField(aiResult.puerto_descarga),
        fecha_emision: cleanBLField(aiResult.fecha_emision),
        descripcion_carga:cleanBLField(aiResult.descripcion_carga),
      }
      const newAlerts: string[] = []

      // 1. Guardar JSON completo + bl_number en la importación
      const importPatch: Partial<ComexImport> = {
        bl_extracted_json: JSON.stringify(d),
      }
      if (d.bl_number && !imp.bl_number) {
        importPatch.bl_number = d.bl_number
      } else if (d.bl_number && imp.bl_number && d.bl_number !== imp.bl_number) {
        newAlerts.push(`⚠ BL del documento (${d.bl_number}) difiere del guardado (${imp.bl_number})`)
      }
      await window.api.comex.imports.update(importId, importPatch)
      qc.invalidateQueries({ queryKey: ['comex-import', importId] })
      qc.invalidateQueries({ queryKey: ['comex-imports'] })

      // 2. Actualizar datos de carga en customs
      const customsPatch: Record<string, unknown> = {}

      // Pallets
      if (d.cant_pallets != null) {
        if (!customs?.cant_pallets) {
          customsPatch.cant_pallets = d.cant_pallets
        } else if (Math.abs(d.cant_pallets - customs.cant_pallets) > 0.1) {
          newAlerts.push(`⚠ Pallets del BL (${d.cant_pallets}) difiere del despacho (${customs.cant_pallets})`)
        }
      }
      // Cajas / cartones
      if (d.cant_cartons != null) {
        customsPatch.cant_cartons = d.cant_cartons
      }
      // Peso bruto
      if (d.peso_bruto_kg != null) {
        if (!customs?.peso_bruto_kg) {
          customsPatch.peso_bruto_kg = d.peso_bruto_kg
        } else {
          const diff = Math.abs(d.peso_bruto_kg - customs.peso_bruto_kg)
          const pct  = diff / customs.peso_bruto_kg * 100
          if (pct > 2) {
            newAlerts.push(`⚠ Peso BL (${fmtNum(d.peso_bruto_kg)} kg) difiere ${pct.toFixed(1)}% del despacho (${fmtNum(customs.peso_bruto_kg)} kg)`)
          }
        }
      }
      // Volumen
      if (d.volumen_m3 != null) {
        if (!customs?.volumen_m3) {
          customsPatch.volumen_m3 = d.volumen_m3
        } else {
          const diff = Math.abs(d.volumen_m3 - customs.volumen_m3)
          const pct  = diff / customs.volumen_m3 * 100
          if (pct > 2) {
            newAlerts.push(`⚠ Volumen BL (${fmtNum(d.volumen_m3)} m³) difiere ${pct.toFixed(1)}% del despacho (${fmtNum(customs.volumen_m3)} m³)`)
          }
        }
      }
      // Contenedor
      if (d.nro_contenedor) {
        customsPatch.nro_contenedor = d.nro_contenedor
      }

      if (Object.keys(customsPatch).length) {
        await window.api.comex.customs.upsert(importId, customsPatch as Parameters<typeof window.api.comex.customs.upsert>[1])
        qc.invalidateQueries({ queryKey: ['comex-customs', importId] })
      }

      setAlerts(newAlerts)
      setAiResult(null)
    } finally { setApplying(false) }
  }

  return (
    <div
      className={cn('rounded-xl border-2 transition-colors', isDragOver ? 'border-sky-500 bg-sky-950/20' : 'border-sky-800/30 bg-slate-800/30')}
      onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setIsDragOver(true) }}
      onDragLeave={(e) => { e.preventDefault(); if (--dragCounter.current <= 0) setIsDragOver(false) }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-sky-950/30 border-b border-sky-800/30">
        <div className="flex items-center gap-2 flex-wrap">
          <FileText size={14} className="text-sky-400" />
          <h3 className="text-xs font-bold text-sky-300 uppercase tracking-wider">BL - Bill of Lading</h3>
          {hasFile && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 font-medium">Archivo adjunto</span>
          )}
          {imp.bl_number && (
            <span className="text-xs font-mono text-sky-400">{imp.bl_number}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {imp.bl_drive_status === 'synced'    && <span className="flex items-center gap-1 text-[10px] text-emerald-400"><Cloud size={11} /> En Drive</span>}
          {imp.bl_drive_status === 'uploading' && <span className="flex items-center gap-1 text-[10px] text-blue-400"><Loader2 size={11} className="animate-spin" /> Subiendo...</span>}
          {imp.bl_drive_status === 'error'     && <span className="flex items-center gap-1 text-[10px] text-red-400"><AlertCircle size={11} /> Error Drive</span>}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {!hasFile ? (
          <div
            className="flex flex-col items-center justify-center py-6 px-4 rounded-xl border-2 border-dashed border-slate-700 cursor-pointer hover:border-sky-600 transition-colors"
            onClick={handleSelectFile}
          >
            <Upload size={22} className="text-slate-600 mb-2" />
            <p className="text-sm text-slate-400 font-medium">
              {isDragOver ? 'Soltar aquí...' : 'Arrastrá o hacé click para subir el BL'}
            </p>
            <p className="text-xs text-slate-600 mt-0.5">PDF, PNG, JPG</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Fila del archivo */}
            <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-900/60 rounded-lg border border-slate-700">
              <FileText size={15} className="text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{imp.bl_original_name ?? 'BL'}</p>
              </div>
              {imp.bl_drive_file_id && (
                <button onClick={() => window.api.shell.open(`https://drive.google.com/file/d/${imp.bl_drive_file_id}/view`)}
                  title="Ver en Drive" className="p-1.5 rounded text-slate-500 hover:text-sky-400 hover:bg-slate-700 transition-colors">
                  <ExternalLink size={13} />
                </button>
              )}
              <button onClick={() => window.api.comex.bl.open(importId)}
                title="Abrir" className="p-1.5 rounded text-slate-500 hover:text-sky-400 hover:bg-slate-700 transition-colors">
                <FolderOpen size={13} />
              </button>
              <button onClick={handleSelectFile} title="Reemplazar"
                className="p-1.5 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors">
                <Upload size={13} />
              </button>
              {confirmDelete ? (
                <>
                  <button onClick={async () => { const r = await window.api.comex.bl.delete(importId); onUpdate(r as Partial<ComexImport>); qc.invalidateQueries({ queryKey: ['comex-import', importId] }); setConfirmDelete(false) }}
                    className="p-1.5 rounded bg-red-600 hover:bg-red-500 text-white transition-colors">
                    <Check size={13} />
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="p-1.5 rounded bg-slate-700 text-slate-400 transition-colors">
                    <X size={13} />
                  </button>
                </>
              ) : (
                <button onClick={() => setConfirmDelete(true)} title="Eliminar"
                  className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors">
                  <Trash2 size={13} />
                </button>
              )}
            </div>

            {/* Datos guardados del BL — siempre visible si existen */}
            {imp.bl_extracted_json && !aiResult && (() => {
              let d: import('@shared/types').ExtractedBL | null = null
              try { d = JSON.parse(imp.bl_extracted_json) } catch { return null }
              if (!d) return null
              const fmt2 = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 3 })
              const isNum = (v: unknown): v is number => typeof v === 'number'
              return (
                <div className="rounded-lg bg-slate-900/50 border border-sky-800/30 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-sky-950/30 border-b border-sky-800/20">
                    <span className="text-[11px] font-semibold text-sky-400">Datos del BL</span>
                    <span className="text-[10px] text-slate-600">Aplicado</span>
                  </div>
                  <div className="px-3 py-2.5 space-y-2">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
                      {d.bl_number        && <><span className="text-slate-500">N° BL</span><span className="text-sky-300 font-semibold font-mono">{d.bl_number}</span></>}
                      {d.fecha_emision    && d.fecha_emision !== 'null'   && <><span className="text-slate-500">Fecha emisión</span><span className="text-slate-300">{d.fecha_emision}</span></>}
                      {d.buque            && d.buque !== 'null'           && <><span className="text-slate-500">Buque</span><span className="text-slate-300">{d.buque}</span></>}
                      {d.consignor        && d.consignor !== 'null'       && <><span className="text-slate-500">Consignante</span><span className="text-slate-300 text-[10px]">{d.consignor}</span></>}
                      {d.puerto_embarque  && d.puerto_embarque !== 'null' && <><span className="text-slate-500">Puerto carga</span><span className="text-slate-300">{d.puerto_embarque}</span></>}
                      {d.puerto_descarga  && d.puerto_descarga !== 'null' && <><span className="text-slate-500">Puerto descarga</span><span className="text-slate-300">{d.puerto_descarga}</span></>}
                      {d.nro_contenedor   && d.nro_contenedor !== 'null'  && <><span className="text-slate-500">Contenedor</span><span className="text-slate-300 font-mono text-[10px]">{d.nro_contenedor}</span></>}
                      {isNum(d.cant_cartons)  && <><span className="text-slate-500">Cajas</span><span className="text-sky-300 font-semibold">{d.cant_cartons}</span></>}
                      {isNum(d.cant_pallets)  && <><span className="text-slate-500">Pallets</span><span className="text-sky-300 font-semibold">{d.cant_pallets}</span></>}
                      {isNum(d.peso_bruto_kg) && <><span className="text-slate-500">Peso bruto</span><span className="text-sky-300 font-semibold">{fmt2(d.peso_bruto_kg)} kg</span></>}
                      {isNum(d.volumen_m3)    && <><span className="text-slate-500">Volumen</span><span className="text-sky-300 font-semibold">{fmt2(d.volumen_m3)} m³</span></>}
                    </div>
                    {d.descripcion_carga && d.descripcion_carga !== 'null' && (
                      <p className="text-[10px] text-slate-500 italic">{d.descripcion_carga}</p>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Botón analizar con IA */}
            {aiConfigured && (
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors',
                  analyzing ? 'bg-violet-800/50 text-violet-300 cursor-wait' : 'bg-violet-700 hover:bg-violet-600 text-white'
                )}
              >
                {analyzing ? <><Loader2 size={15} className="animate-spin" /> Analizando BL...</> : <><Sparkles size={15} /> {imp.bl_extracted_json ? 'Reanalizar BL' : 'Extraer datos con IA'}</>}
              </button>
            )}

            {/* Alertas de discrepancia */}
            {alerts.length > 0 && (
              <div className="space-y-1">
                {alerts.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-2 bg-amber-900/20 border border-amber-700/30 rounded-lg text-xs text-amber-300">
                    <AlertCircle size={13} className="flex-shrink-0 mt-0.5 text-amber-400" />
                    <span>{a}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Panel resultado IA */}
            {aiResult && (() => {
              const d = aiResult
              const fmt2 = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 3 })
              return (
                <div className="rounded-lg border border-violet-700/40 bg-violet-950/20 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-violet-900/20 border-b border-violet-700/30">
                    <div className="flex items-center gap-2">
                      <Bot size={12} className="text-violet-400" />
                      <span className="text-[11px] font-semibold text-violet-300">BL extraído por IA</span>
                    </div>
                    <button onClick={() => setAiResult(null)} className="text-slate-500 hover:text-slate-300"><X size={12} /></button>
                  </div>
                  <div className="px-3 py-2.5 space-y-2">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
                      {d.bl_number        && d.bl_number !== 'null'           && <><span className="text-slate-500">N° BL</span><span className="text-sky-300 font-semibold font-mono">{d.bl_number}</span></>}
                      {d.fecha_emision    && d.fecha_emision !== 'null'       && <><span className="text-slate-500">Fecha emisión</span><span className="text-slate-200">{d.fecha_emision}</span></>}
                      {d.buque            && d.buque !== 'null'               && <><span className="text-slate-500">Buque</span><span className="text-slate-200">{d.buque}</span></>}
                      {d.consignor        && d.consignor !== 'null'           && <><span className="text-slate-500">Consignante</span><span className="text-slate-200 text-[10px]">{d.consignor}</span></>}
                      {d.puerto_embarque  && d.puerto_embarque !== 'null'     && <><span className="text-slate-500">Puerto carga</span><span className="text-slate-200">{d.puerto_embarque}</span></>}
                      {d.puerto_descarga  && d.puerto_descarga !== 'null'     && <><span className="text-slate-500">Puerto descarga</span><span className="text-slate-200">{d.puerto_descarga}</span></>}
                      {d.nro_contenedor   && d.nro_contenedor !== 'null'      && <><span className="text-slate-500">Contenedor</span><span className="text-slate-300 font-mono text-[10px]">{d.nro_contenedor}</span></>}
                      {typeof d.cant_cartons  === 'number' && <><span className="text-slate-500">Cajas</span><span className="text-emerald-400 font-semibold">{d.cant_cartons} cajas</span></>}
                      {typeof d.cant_pallets  === 'number' && <><span className="text-slate-500">Pallets</span><span className="text-emerald-400 font-semibold">{d.cant_pallets} pallets</span></>}
                      {typeof d.peso_bruto_kg === 'number' && <><span className="text-slate-500">Peso bruto</span><span className="text-emerald-400 font-semibold">{fmt2(d.peso_bruto_kg)} kg</span></>}
                      {typeof d.volumen_m3    === 'number' && <><span className="text-slate-500">Volumen</span><span className="text-emerald-400 font-semibold">{fmt2(d.volumen_m3)} m³</span></>}
                    </div>
                    {d.descripcion_carga && (
                      <p className="text-[10px] text-slate-500 italic">{d.descripcion_carga}</p>
                    )}
                    <div className="flex justify-end gap-2 pt-1 border-t border-violet-800/30">
                      <button onClick={() => setAiResult(null)} className="px-2.5 py-1 rounded text-[11px] text-slate-400 hover:text-white transition-colors">Descartar</button>
                      <button onClick={handleApply} disabled={applying}
                        className="flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-medium bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 transition-colors">
                        {applying ? <><Loader2 size={11} className="animate-spin" /> Aplicando...</> : <><Check size={11} /> Aplicar</>}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}

function DespachoSection({ imp }: { imp: ComexImport }) {
  const uploadDespacho = useUploadDespacho()
  const deleteDespacho = useDeleteDespacho()
  const analyzeDespacho = useAnalyzeDespacho()
  const { data: aiConfigured } = useAIConfigured()

  const [aiResult,       setAiResult]       = useState<AIAnalysisResult | null>(null)
  const [analyzedPage,   setAnalyzedPage]   = useState<number>(1)
  const [suggestPage2,   setSuggestPage2]   = useState(false)
  const [confirmDelete,  setConfirmDelete]  = useState(false)
  const [isDragOver,     setIsDragOver]     = useState(false)
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

  // Detecta si el resultado tiene muy pocos datos útiles (despacho escaneado
  // con datos en pág 2, o primera hoja sin sección de liquidación).
  // Usa los nombres reales de ExtractedDespacho (no los de la DB de customs).
  const resultHasFewFields = (result: AIAnalysisResult): boolean => {
    if (result.operation !== 'extract_despacho') return false
    const d = result.structured as Record<string, unknown> | null | undefined
    if (!d) return true   // sin datos → definitivamente pocos campos
    const keyFields = ['numero_despacho', 'fob_total', 'cotizacion_dolar', 'fecha_oficializacion']
    const nullCount = keyFields.filter(k => d[k] == null).length
    return nullCount >= 3  // 3 o más campos clave vacíos → sugiere pág 2
  }

  const handleAnalyze = async (page = 1) => {
    setSuggestPage2(false)
    setAnalyzedPage(page)
    try {
      const result = await analyzeDespacho.mutateAsync({ importId: imp.id, page })
      setAiResult(result)
      if (page === 1 && resultHasFewFields(result)) setSuggestPage2(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al analizar')
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

            {/* Botón IA principal */}
            {aiConfigured && (
              <div className="space-y-2">
                <button
                  onClick={() => handleAnalyze(1)}
                  disabled={analyzeDespacho.isPending}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors',
                    analyzeDespacho.isPending
                      ? 'bg-violet-800/50 text-violet-300 cursor-wait'
                      : 'bg-violet-700 hover:bg-violet-600 text-white'
                  )}
                >
                  {analyzeDespacho.isPending ? (
                    <><Loader2 size={15} className="animate-spin" /> Analizando pág. {analyzedPage}...</>
                  ) : (
                    <><Sparkles size={15} /> Extraer datos con IA (pág. 1)</>
                  )}
                </button>

                {/* Sugerencia de pág. 2 si la primera hoja tuvo pocos datos */}
                {suggestPage2 && !analyzeDespacho.isPending && (
                  <div className="flex items-start gap-2 bg-amber-950/30 border border-amber-700/30 rounded-lg px-3 py-2">
                    <span className="text-amber-400 text-xs mt-0.5">⚠</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-amber-300 font-medium">Pocos datos en pág. 1</p>
                      <p className="text-[11px] text-amber-500 mt-0.5">
                        Este despacho puede tener los datos en la segunda hoja.
                      </p>
                      <button
                        onClick={() => handleAnalyze(2)}
                        className="mt-1.5 text-[11px] font-semibold text-amber-400 hover:text-amber-300 underline"
                      >
                        Reintentar con pág. 2 →
                      </button>
                    </div>
                  </div>
                )}

                {/* Acceso directo a pág. 2 (siempre disponible) */}
                {!analyzeDespacho.isPending && !suggestPage2 && (
                  <button
                    onClick={() => handleAnalyze(2)}
                    className="w-full text-center text-[11px] text-slate-500 hover:text-slate-300 transition-colors py-1"
                  >
                    Analizar pág. 2 en su lugar
                  </button>
                )}
              </div>
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
      if (d.fecha_oficializacion) {
        customs.oficializacion_date = dayjs(d.fecha_oficializacion).valueOf()
        // Copiar al import para la auto-sugerencia de "Oficializado"
        await window.api.comex.imports.update(importId, {
          oficializacion_import_date: dayjs(d.fecha_oficializacion).valueOf()
        })
        qc.invalidateQueries({ queryKey: ['comex-import', importId] })
      }
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
      if (d.total_bultos   != null)   customs.cant_bultos         = d.total_bultos
      await window.api.comex.customs.upsert(importId, customs)
      qc.invalidateQueries({ queryKey: ['comex-customs', importId] })

      // Valor FOB para SEPAIMPO BCRA: se toma UNA sola vez del despacho — si ya
      // estaba seteado (de un despacho anterior), snapshotSepaimpoFobIfMissing
      // no lo pisa, para no mover un valor ya usado en pagos declarados al BCRA.
      if (d.fob_total != null) {
        const fobCurrency = d.fob_divisa ? (d.fob_divisa === 'DOL' ? 'USD' : d.fob_divisa) : 'USD'
        await window.api.comex.sepaimpo.snapshotFob(importId, d.fob_total, fobCurrency)
        qc.invalidateQueries({ queryKey: ['comex-import', importId] })
      }

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

// ── Quote row expandible ──────────────────────────────────────────────────────

function QuoteRow({
  q, importId, imp, onSelect, onReject, onRestore, onDelete, onUpdate
}: {
  q: ComexLogisticsQuote
  importId: string
  imp: ComexImport
  onSelect: () => void
  onReject: () => void
  onRestore: () => void
  onDelete: () => void
  onUpdate: (data: Partial<ComexLogisticsQuote>) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [htmlDraft, setHtmlDraft] = useState(q.quote_html ?? '')
  const [previewHtml, setPreviewHtml] = useState(false)
  const [receivedDate, setReceivedDate] = useState(
    q.quote_received_at ? dayjs(q.quote_received_at).format('YYYY-MM-DD') : ''
  )
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const { data: files = [] } = useComexQuoteFiles(expanded ? q.id : null)
  const uploadFile = useUploadComexQuoteFile()
  const deleteFile = useDeleteComexQuoteFile()
  const [isDragOver, setIsDragOver] = useState(false)

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.size > 0)
    for (const file of dropped) {
      try {
        const buf = await file.arrayBuffer()
        uploadFile.mutate({
          quoteId: q.id,
          importId,
          importTitle: imp.title,
          importFolderId: imp.drive_folder_id ?? null,
          fileBuffer: buf,
          fileName: file.name,
        })
      } catch { /* directorio o archivo ilegible — ignorar */ }
    }
  }

  const statusColor = FREIGHT_QUOTE_STATUS_COLORS[q.status]
  const isSelected  = q.status === 'selected'
  const isRejected  = q.status === 'rejected'
  const isRequested = q.status === 'requested'

  async function handleSaveQuote() {
    setSaving(true)
    setSaveError(null)
    try {
      onUpdate({
        quote_html: htmlDraft,
        quote_received_at: receivedDate ? dayjs(receivedDate).valueOf() : null,
        status: q.status === 'requested' ? 'quoted' : q.status,
      })
      // Dar feedback visual brevemente
      await new Promise((r) => setTimeout(r, 600))
    } catch (e) {
      setSaveError((e as Error).message ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpload() {
    setUploadError(null)
    try {
      await uploadFile.mutateAsync({
        quoteId: q.id,
        importId,
        importTitle: imp.title,
        importFolderId: imp.drive_folder_id ?? null,
      })
    } catch (e) {
      setUploadError((e as Error).message ?? 'Error al subir el archivo')
    }
  }

  return (
    <div className={cn(
      'border rounded-lg transition-colors',
      isSelected ? 'border-emerald-600/50 bg-emerald-950/20' :
      isRejected  ? 'border-slate-700/30 opacity-60' : 'border-slate-700/50'
    )}>
      {/* Header row */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <ChevronRight size={14} className={cn('text-slate-500 transition-transform shrink-0', expanded && 'rotate-90')} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-semibold text-slate-200">{q.operator_name}</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: statusColor + '22', color: statusColor }}>
              {FREIGHT_QUOTE_STATUS_LABELS[q.status]}
            </span>
            {q.cargo_type && <span className="text-[10px] text-slate-500">{CARGO_TYPE_LABELS[q.cargo_type] ?? q.cargo_type}</span>}
            {files.length > 0 && (
              <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                <Paperclip size={9} /> {files.length}
              </span>
            )}
          </div>
          {q.contact && <p className="text-[10px] text-slate-500 mt-0.5">{q.contact}</p>}
          {isRequested && q.rfq_sent_at && (
            <p className="text-[10px] text-slate-600 mt-0.5">
              Solicitud enviada {dayjs(q.rfq_sent_at).format('DD/MM/YYYY HH:mm')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {q.quote_amount ? (
            <span className="text-sm font-semibold text-cyan-400">
              {q.currency} {q.quote_amount.toLocaleString('es-AR')}
            </span>
          ) : isRequested ? (
            <span className="text-[10px] text-slate-500 italic">Esperando respuesta</span>
          ) : null}
          {isSelected && (
            <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
              <Check size={11} /> Seleccionado
            </span>
          )}
          <button onClick={onDelete} className="text-slate-700 hover:text-red-400 transition-colors">
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-slate-700/50 p-3 space-y-3">
          {/* Cotización recibida */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] font-medium text-slate-400">Cotización recibida</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewHtml((v) => !v)}
                  className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {previewHtml ? 'Editar' : 'Preview'}
                </button>
                <input
                  type="date"
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                  className="bg-slate-900 border border-slate-600 rounded px-2 py-0.5 text-[10px] text-white focus:outline-none focus:border-cyan-500"
                  title="Fecha de recepción"
                />
              </div>
            </div>
            {previewHtml ? (
              <div
                className="w-full min-h-[120px] max-h-[320px] overflow-auto rounded border border-slate-600 bg-white p-2 text-xs"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(htmlDraft) }}
              />
            ) : (
              <textarea
                value={htmlDraft}
                onChange={(e) => setHtmlDraft(e.target.value)}
                placeholder="Pegá el HTML de la cotización recibida por email..."
                rows={6}
                className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-[11px] text-slate-300 font-mono focus:outline-none focus:border-cyan-500 resize-y"
              />
            )}
            <div className="flex justify-end items-center gap-2 mt-1.5">
              {saveError && <span className="text-[10px] text-red-400">{saveError}</span>}
              <button
                onClick={handleSaveQuote}
                disabled={saving}
                className="text-[10px] px-2.5 py-1 rounded bg-cyan-700 hover:bg-cyan-600 text-white transition-colors disabled:opacity-50"
              >
                {saving ? 'Guardando…' : 'Guardar cotización'}
              </button>
            </div>
          </div>

          {/* Archivos */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] font-medium text-slate-400">Archivos</p>
              <button
                onClick={handleUpload}
                disabled={uploadFile.isPending}
                className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-cyan-400 transition-colors disabled:opacity-50"
              >
                {uploadFile.isPending
                  ? <Loader2 size={10} className="animate-spin" />
                  : <Upload size={10} />}
                Agregar archivo
              </button>
            </div>
            {uploadError && <p className="text-[10px] text-red-400 mb-1.5">{uploadError}</p>}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false) }}
              onDrop={handleDrop}
              className={cn(
                'rounded-lg border border-dashed transition-colors',
                isDragOver
                  ? 'border-cyan-500 bg-cyan-950/30'
                  : files.length > 0 ? 'border-transparent' : 'border-slate-700/40'
              )}
            >
              {isDragOver ? (
                <p className="text-[10px] text-cyan-400 text-center py-3">Soltá para subir</p>
              ) : files.length === 0 ? (
                <p className="text-[10px] text-slate-600 italic text-center py-2">
                  Sin archivos adjuntos · arrastrá archivos acá
                </p>
              ) : (
                <div className="space-y-1 py-1">
                  {files.map((f: ComexQuoteFile) => (
                    <div key={f.id} className="flex items-center gap-2 group px-1">
                      <Paperclip size={10} className="text-slate-500 shrink-0" />
                      <span className="text-[11px] text-slate-300 flex-1 truncate">{f.file_name}</span>
                      {f.file_size && (
                        <span className="text-[10px] text-slate-600 shrink-0">{formatBytes(f.file_size)}</span>
                      )}
                      {f.drive_file_id && (
                        <button
                          onClick={() => window.api.comex.quotes.files.open(f.drive_file_id)}
                          className="text-slate-600 hover:text-cyan-400 transition-colors opacity-0 group-hover:opacity-100"
                          title="Abrir en Drive"
                        >
                          <ExternalLink size={10} />
                        </button>
                      )}
                      <button
                        onClick={() => deleteFile.mutate({ fileId: f.id, driveFileId: f.drive_file_id, quoteId: q.id })}
                        className="text-slate-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-700/40">
            <div className="flex items-center gap-2">
              {isRejected && (
                <button onClick={onRestore} className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
                  Restaurar
                </button>
              )}
              {!isRejected && !isSelected && (
                <button onClick={onReject} className="text-[10px] text-slate-500 hover:text-red-400 transition-colors">
                  Rechazar
                </button>
              )}
            </div>
            {!isSelected && !isRejected && !isRequested && (
              <button
                onClick={onSelect}
                className="text-[10px] px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
              >
                ✓ Seleccionar este operador
              </button>
            )}
          </div>
        </div>
      )}
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
  const updateQuote  = useUpdateComexQuote()
  const updateImport = useUpdateComexImport()
  const deleteQuote  = useDeleteComexQuote()
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

  const select = (q: ComexLogisticsQuote) => {
    updateQuote.mutate({ id: q.id, importId, data: { status: 'selected' } })
    if (q.operator_id) {
      updateImport.mutate({ id: importId, data: { freight_operator_id: q.operator_id } })
    }
  }

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

      {/* Quote list */}
      {quotes.length === 0 && !showManual ? (
        <p className="text-xs text-slate-500">
          Sin presupuestos. Usá{' '}
          <button onClick={() => setShowRFQ(true)} className="text-cyan-400 hover:underline">Solicitar cotizaciones</button>
          {' '}para enviar emails a tus operadores.
        </p>
      ) : (
        <div className="space-y-2 mt-1">
          {quotes.map((q) => (
            <QuoteRow
              key={q.id}
              q={q}
              importId={importId}
              imp={imp}
              onSelect={() => select(q)}
              onReject={() => reject(q)}
              onRestore={() => restore(q)}
              onDelete={() => deleteQuote.mutate({ id: q.id, importId })}
              onUpdate={(data) => updateQuote.mutate({ id: q.id, importId, data })}
            />
          ))}
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

// ── Payment section ──────────────────────────────────────────────────────────

function InlineDaysInput({ value, onSave }: { value: number | null; onSave: (v: number | null) => void }) {
  const [draft, setDraft] = useState(value != null ? String(value) : '')
  useEffect(() => { setDraft(value != null ? String(value) : '') }, [value])

  const commit = () => {
    const n = parseInt(draft, 10)
    // El atributo HTML min={0} no bloquea tipear/pegar un negativo — se valida acá.
    onSave(isNaN(n) || n < 0 ? null : n)
  }

  return (
    <input
      type="number"
      min={0}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      className="w-14 bg-slate-900 border border-slate-600 rounded px-1.5 py-1 text-xs text-white text-center focus:outline-none focus:border-cyan-500"
    />
  )
}

function PaymentSection({ imp, onUpdate }: {
  imp: ComexImport
  onUpdate: (data: Partial<ComexImport>) => void
}) {
  const importId = imp.id
  const { data: payments = [] } = useComexPayments(importId)
  const { data: allDocs  = [] } = useComexDocuments(importId)
  const createDoc = useCreateComexDocument(importId)
  const uploadDoc = useUploadComexDocument(importId)
  const deleteDoc = useDeleteComexDocument(importId)
  const { data: customs } = useComexCustoms(importId)
  const { data: sepaimpoPayments = [] } = useComexSepaimpoPayments(importId)
  const createSepaimpo = useCreateComexSepaimpoPayment()
  const deleteSepaimpo = useDeleteComexSepaimpoPayment()
  const [addingSepaimpo, setAddingSepaimpo] = useState(false)
  const [sepaimpoForm, setSepaimpoForm] = useState({ importe: '', fecha_pago: '', numero_operacion: '', tipo_cambio: '' })

  const paymentDocs = allDocs.filter(d => d.type === 'payment_receipt')

  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    amount: '', currency: 'USD',
    payment_date: '', bank: '', reference: ''
  })

  const handleAddPayment = async () => {
    if (!form.amount) return
    await window.api.comex.payments.create({
      import_id: importId,
      amount: Number(form.amount),
      currency: form.currency,
      exchange_rate: null,
      payment_date: form.payment_date ? dayjs(form.payment_date).valueOf() : null,
      method: 'wire',
      bank: form.bank,
      reference: form.reference,
      status: 'completed',
      notes: ''
    })
    if (!imp.payment_date && form.payment_date) {
      onUpdate({ payment_date: dayjs(form.payment_date).valueOf() })
    }
    setForm({ amount: '', currency: 'USD', payment_date: '', bank: '', reference: '' })
    setAdding(false)
  }

  const handleAttachDoc = async () => {
    const filePath = await window.api.comex.documents.selectFile()
    if (!filePath) return
    const name = filePath.split(/[/\\]/).pop() ?? 'Comprobante'
    const doc = await window.api.comex.documents.create({
      import_id: importId,
      type: 'payment_receipt',
      name,
      drive_file_id: null,
      status: 'received',
      notes: '',
      received_at: Date.now()
    })
    uploadDoc.mutate({ docId: doc.id, filePath, folderId: imp.drive_folder_id, importTitle: imp.title })
  }

  const totalUSD = payments.reduce((s, p) => {
    const fx = p.exchange_rate ?? 1
    return s + (p.currency === 'USD' ? p.amount : p.amount / fx)
  }, 0)

  const inputCls = 'bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500'

  return (
    <div className="space-y-5 p-4">

      {/* Condición de pago — réplica visual del toggle en Proveedores/Marcas */}
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Condición de pago</p>
        <div className="flex items-center gap-2 flex-wrap">
          {(['anticipado', 'a_plazo'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { if (imp.payment_terms !== t) onUpdate({ payment_terms: t }) }}
              className={cn(
                'text-xs font-semibold px-3 py-1.5 rounded-md border transition-all',
                imp.payment_terms === t
                  ? t === 'anticipado'
                    ? 'bg-emerald-900/40 text-emerald-400 border-emerald-700/50'
                    : 'bg-violet-900/40 text-violet-400 border-violet-700/50'
                  : 'bg-transparent text-slate-500 border-slate-700 hover:border-slate-500'
              )}
            >
              {t === 'anticipado' ? 'Pago anticipado' : 'Pago diferido'}
            </button>
          ))}

          {imp.payment_terms === 'a_plazo' && (
            <>
              {/* payment_due_date NO se calcula acá — lo deriva updateImport() del lado del
                  servidor a partir de la fila ya commiteada, para no depender del prop `imp`
                  (cache de React Query) que puede estar stale si se edita este campo y el de
                  al lado en rápida sucesión. Ver comex.ts:updateImport. */}
              <div className="flex items-center gap-1.5 ml-1 pl-2 border-l border-slate-700">
                <span className="text-[10px] text-slate-500">Días desde factura</span>
                <InlineDaysInput
                  value={imp.payment_deferred_days}
                  onSave={(days) => onUpdate({ payment_deferred_days: days })}
                />
              </div>
              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-700">
                <span className="text-[10px] text-slate-500">Fecha de factura</span>
                <EditableDate
                  label=""
                  value={imp.invoice_date}
                  onSave={(v) => onUpdate({ invoice_date: v })}
                />
              </div>
              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-700">
                <span className="text-[10px] text-slate-500">Vencimiento</span>
                <EditableDate label="" value={imp.payment_due_date} onSave={(v) => onUpdate({ payment_due_date: v })} />
              </div>
            </>
          )}
        </div>
        {imp.payment_terms === 'a_plazo' && (
          <p className="text-[9px] text-slate-600 mt-1.5">
            {imp.invoice_date && imp.payment_deferred_days != null
              ? `→ vencimiento calculado: ${imp.payment_deferred_days} días desde la factura. Podés sobreescribirlo a mano si hace falta.`
              : '→ falta la fecha de factura (o los días) para calcular el vencimiento — mientras tanto, el nodo "Pago realizado" del timeline queda al final.'}
          </p>
        )}
      </div>

      {/* Fecha de pago efectivo */}
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Fecha de pago</p>
        <EditableDate label="" value={imp.payment_date} onSave={(v) => onUpdate({ payment_date: v })} />
      </div>

      {/* Transferencias registradas */}
      {payments.length > 0 && (
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Transferencias</p>
          <div className="space-y-1.5">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-1.5 px-3 bg-slate-900/50 rounded-lg border border-slate-700/40 group">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-200">
                    {p.currency} {p.amount.toLocaleString('es-AR')}
                    {p.bank ? <span className="text-slate-400 font-normal"> · {p.bank}</span> : null}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {p.payment_date ? dayjs(p.payment_date).format('DD/MM/YY') : '—'}
                    {p.reference ? ` · Ref: ${p.reference}` : ''}
                  </p>
                </div>
                <button onClick={() => window.api.comex.payments.delete(p.id)} className="text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
            {totalUSD > 0 && (
              <div className="flex justify-end pt-1">
                <span className="text-xs text-cyan-400 font-semibold">
                  Total: ~USD {Math.round(totalUSD).toLocaleString('es-AR')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Comprobantes */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Comprobantes</p>
          <div className="flex gap-3">
            <button onClick={() => setAdding(v => !v)} className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors">
              <Plus size={10} /> Registrar pago
            </button>
            <button onClick={handleAttachDoc} className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors">
              <Paperclip size={10} /> Adjuntar archivo
            </button>
          </div>
        </div>

        {paymentDocs.length === 0 ? (
          <p className="text-xs text-slate-600 italic">Sin comprobantes adjuntos.</p>
        ) : (
          <div className="space-y-1">
            {paymentDocs.map((doc) => (
              <div key={doc.id} className="flex items-center gap-2 py-1.5 px-3 bg-slate-900/50 rounded-lg border border-slate-700/40 group">
                <FileText size={11} className="text-slate-500 flex-shrink-0" />
                <span className="text-xs text-slate-300 flex-1 truncate">{doc.name}</span>
                {doc.drive_status === 'synced' && (
                  <Cloud size={9} className="text-emerald-500 flex-shrink-0" />
                )}
                {doc.drive_file_id && (
                  <button
                    onClick={() => window.api.shell.open(`https://drive.google.com/file/d/${doc.drive_file_id}/view`)}
                    className="text-slate-600 hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-all"
                  ><ExternalLink size={10} /></button>
                )}
                <button
                  onClick={() => deleteDoc.mutate(doc.id)}
                  className="text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                ><X size={10} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Registro de pagos SEPAIMPO BCRA */}
      {(() => {
        const fobValue    = imp.sepaimpo_fob_value
        const fobCurrency = imp.sepaimpo_fob_currency ?? 'USD'
        const totalPagado = sepaimpoPayments.reduce((s, p) => s + p.importe, 0)
        const saldo       = fobValue != null ? fobValue - totalPagado : null

        const handleAddSepaimpo = async () => {
          if (!sepaimpoForm.importe) return
          await createSepaimpo.mutateAsync({
            import_id: importId,
            importe: Number(sepaimpoForm.importe),
            fecha_pago: sepaimpoForm.fecha_pago ? dayjs(sepaimpoForm.fecha_pago).valueOf() : null,
            numero_operacion: sepaimpoForm.numero_operacion,
            tipo_cambio: sepaimpoForm.tipo_cambio ? Number(sepaimpoForm.tipo_cambio) : null
          })
          setSepaimpoForm({ importe: '', fecha_pago: '', numero_operacion: '', tipo_cambio: '' })
          setAddingSepaimpo(false)
        }

        return (
          <div className="border border-amber-700/40 bg-amber-950/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Landmark size={14} className="text-amber-400" />
                <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Registro de pagos Sepaimpo BCRA</p>
              </div>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-500/40">BCRA</span>
            </div>

            <div className="flex items-center gap-6 mb-1">
              <div>
                <p className="text-[9px] text-slate-400 uppercase tracking-wider">Valor FOB despacho</p>
                <p className={cn('text-lg font-semibold mt-0.5', fobValue != null ? 'text-slate-100' : 'text-slate-600')}>
                  {fobValue != null ? `${fobCurrency} ${fobValue.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '—'}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-slate-400 uppercase tracking-wider">N° de despacho</p>
                <p className={cn('text-sm mt-1 font-mono', customs?.despacho_number ? 'text-slate-300' : 'text-slate-600 font-sans')}>
                  {customs?.despacho_number || '—'}
                </p>
              </div>
            </div>
            {(fobValue == null || !customs?.despacho_number) && (
              <p className="text-[9px] text-slate-500 italic mb-2">Se autocompletan al subir el despacho</p>
            )}

            <div className="border-t border-amber-700/20 pt-2.5">
              {sepaimpoPayments.length > 0 && (
                <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_auto] gap-2 text-[9px] text-slate-500 mb-1.5 px-0.5">
                  <span></span><span>IMPORTE</span><span>FECHA</span><span>N° OPERACIÓN</span><span>T.C. ($)</span><span></span>
                </div>
              )}
              <div className="space-y-1">
                {sepaimpoPayments.map((p, i) => (
                  <div key={p.id} className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_auto] gap-2 items-center text-xs py-1 px-0.5 border-t border-slate-800/60 group">
                    <span className="text-slate-600 text-[10px]">{i + 1}</span>
                    <span className="text-slate-200">{fobCurrency} {p.importe.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    <span className="text-slate-400">{p.fecha_pago ? dayjs(p.fecha_pago).format('DD/MM/YYYY') : '—'}</span>
                    <span className="text-slate-400 font-mono">{p.numero_operacion || '—'}</span>
                    <span className="text-slate-400">{p.tipo_cambio != null ? `$${p.tipo_cambio.toLocaleString('es-AR')}` : '—'}</span>
                    <button
                      onClick={() => deleteSepaimpo.mutate({ id: p.id, importId })}
                      className="text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    ><Trash2 size={11} /></button>
                  </div>
                ))}
              </div>

              {addingSepaimpo ? (
                <div className="mt-2 p-2.5 bg-slate-900/60 rounded-lg space-y-2 border border-slate-700">
                  <div className="grid grid-cols-2 gap-2">
                    <input autoFocus type="number" value={sepaimpoForm.importe}
                      onChange={(e) => setSepaimpoForm(p => ({ ...p, importe: e.target.value }))}
                      placeholder={`Importe (${fobCurrency})`} className={inputCls} />
                    <input type="date" value={sepaimpoForm.fecha_pago}
                      onChange={(e) => setSepaimpoForm(p => ({ ...p, fecha_pago: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={sepaimpoForm.numero_operacion}
                      onChange={(e) => setSepaimpoForm(p => ({ ...p, numero_operacion: e.target.value }))}
                      placeholder="N° de operación" className={inputCls} />
                    <input type="number" value={sepaimpoForm.tipo_cambio}
                      onChange={(e) => setSepaimpoForm(p => ({ ...p, tipo_cambio: e.target.value }))}
                      placeholder="Tipo de cambio ($)" className={inputCls} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setAddingSepaimpo(false)} className="text-xs text-slate-400 hover:text-white px-2 py-1">Cancelar</button>
                    <button onClick={handleAddSepaimpo} className="text-xs bg-amber-600 hover:bg-amber-500 text-white px-3 py-1 rounded">Agregar</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddingSepaimpo(true)} className="flex items-center gap-1.5 text-[10px] text-amber-400 hover:text-amber-300 mt-2">
                  <Plus size={11} /> Agregar pago
                </button>
              )}
            </div>

            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-amber-700/20">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Saldo disponible para transferir</span>
              <span className={cn('text-sm font-bold', saldo == null ? 'text-slate-600' : saldo > 0 ? 'text-emerald-400' : 'text-slate-400')}>
                {saldo != null ? `${fobCurrency} ${saldo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '—'}
              </span>
            </div>
          </div>
        )
      })()}

      {/* Notas de pago */}
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Notas</p>
        <EditableText
          label=""
          value={imp.payment_notes ?? ''}
          onSave={(v) => onUpdate({ payment_notes: v })}
          placeholder="Sin notas — click para agregar"
          multiline
        />
      </div>

      {/* Formulario de registro de pago */}
      {adding && (
        <div className="p-3 bg-slate-900/60 rounded-lg space-y-2 border border-slate-700">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Nueva transferencia</p>
          <div className="grid grid-cols-2 gap-2">
            <input autoFocus type="number" value={form.amount}
              onChange={(e) => setForm(p => ({ ...p, amount: e.target.value }))}
              placeholder="Monto" className={inputCls} />
            <select value={form.currency}
              onChange={(e) => setForm(p => ({ ...p, currency: e.target.value }))}
              className={inputCls}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={form.payment_date}
              onChange={(e) => setForm(p => ({ ...p, payment_date: e.target.value }))}
              className={inputCls} />
            <input value={form.bank}
              onChange={(e) => setForm(p => ({ ...p, bank: e.target.value }))}
              placeholder="Banco" className={inputCls} />
          </div>
          <input value={form.reference}
            onChange={(e) => setForm(p => ({ ...p, reference: e.target.value }))}
            placeholder="N° de operación / referencia"
            className={cn(inputCls, 'w-full')} />
          <div className="flex justify-end gap-2">
            <button onClick={() => setAdding(false)} className="text-xs text-slate-400 hover:text-white px-2 py-1">Cancelar</button>
            <button onClick={handleAddPayment} className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1 rounded">Registrar</button>
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
  const { data: imp, isLoading }    = useComexImport(id ?? null)
  const { data: suppliers    = [] } = useComexSuppliers()
  const { data: customs }           = useComexCustoms(id ?? null)
  const { data: items        = [] } = useComexItems(id ?? null)
  const { data: operators    = [] } = useComexFreightOperators()
  const { data: despachantes = [] } = useComexDespachantes()
  const qc = useQueryClient()
  const update = useUpdateComexImport()
  const deleteImport = useDeleteComexImport()
  const upsertCustoms = useUpsertComexCustoms()

  // PL files multi-documento
  const { data: plFilesList = [] } = useQuery({
    queryKey: ['comex-import-pl-files', id],
    queryFn:  () => window.api.comex.plFiles.list(id!),
    enabled:  !!id,
  })

  // Datos para resúmenes de secciones colapsadas
  const { data: tributos   = [] } = useComexTributos(id ?? null)
  const { data: extras     = [] } = useComexExtraCosts(id ?? null)
  const { data: proformasD = [] } = useComexProformas(id ?? null)
  const { data: facturasD  = [] } = useComexFacturasComerciales(id ?? null)
  const { data: quotesData = [] } = useComexQuotesByImport(id ?? null)

  // Estado de secciones — por defecto abiertas las más importantes
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({
    costos:      true,
    datos:       true,
    pago:        true,
    anmat:       false,
    flete_int:   false,
    despacho:    false,
    tributos:    false,
    deposito:    false,
    despachante: false,
    flete_local: false,
    productos:   false,
    presupuestos: false,
    proformas:   false,
    facturas:    false,
    pl:          false,
    bl:          false,
  })

  const toggle   = (key: SectionKey) => setSections(s => ({ ...s, [key]: !s[key] }))
  const allOpen  = ALL_SECTION_KEYS.every(k => sections[k])
  const expandAll  = () => setSections(Object.fromEntries(ALL_SECTION_KEYS.map(k => [k, true])) as Record<SectionKey, boolean>)
  const collapseAll = () => setSections(Object.fromEntries(ALL_SECTION_KEYS.map(k => [k, false])) as Record<SectionKey, boolean>)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [driveLoading, setDriveLoading] = useState(false)
  const [driveError, setDriveError] = useState<string | null>(null)
  const [exportingXlsx, setExportingXlsx] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)

  const handleExportXlsx = async () => {
    if (!id) return
    setExportingXlsx(true)
    try { await window.api.comex.imports.exportXlsx(id) }
    finally { setExportingXlsx(false) }
  }

  const handleExportPdf = async () => {
    if (!id) return
    setExportingPdf(true)
    try { await window.api.comex.imports.exportPdf(id) }
    finally { setExportingPdf(false) }
  }

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

  // ── Estado modal WhatsApp (SIEMPRE antes de cualquier return) ───────────────
  const [showWaCargaModal, setShowWaCargaModal] = useState(false)

  // ── Auto-transición por fechas (SIEMPRE antes de cualquier return) ──────────
  useEffect(() => {
    if (!imp) return   // imp puede ser null mientras carga
    const now    = Date.now()
    const status = imp.status as ImportStatus
    // preparacion_embarque ⇄ listo_para_embarcar según si ambas ramas (carga + forwarder)
    // están en su estado final y el pago está resuelto (si corresponde) — bidireccional:
    // si ya está en listo_para_embarcar y el usuario retrocede una rama, vuelve sola a
    // preparacion_embarque, para no quedar "pegada" en un estado que ya no es cierto.
    // Ver isReadyToShip().
    if (status === 'preparacion_embarque' && isReadyToShip(imp)) {
      update.mutate({ id: imp.id, data: { status: 'listo_para_embarcar' } })
      return
    }
    if (status === 'listo_para_embarcar' && !isReadyToShip(imp)) {
      update.mutate({ id: imp.id, data: { status: 'preparacion_embarque' } })
      return
    }
    // transit → arrived cuando llega el aviso de arribo
    if (status === 'transit' && imp.aviso_arribo_date && imp.aviso_arribo_date <= now) {
      update.mutate({ id: imp.id, data: { status: 'arrived' } })
      return
    }
    // arrived → customs (Traslado a depósito) cuando llega la fecha de traslado
    if (status === 'arrived' && imp.traslado_deposito_date && imp.traslado_deposito_date <= now) {
      update.mutate({ id: imp.id, data: { status: 'customs' } })
      return
    }
    // oficializado → carga_deposito: cuando llega el turno de carga (fecha + hora exacta)
    if (status === 'oficializado' && imp.carga_deposito_date) {
      let turnoTs = imp.carga_deposito_date
      if (imp.carga_deposito_time) {
        const [hh, mm] = imp.carga_deposito_time.split(':').map(Number)
        const d = new Date(imp.carga_deposito_date)
        d.setHours(hh, mm, 0, 0)
        turnoTs = d.getTime()
      }
      if (turnoTs <= now) {
        update.mutate({ id: imp.id, data: { status: 'carga_deposito' } })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imp?.id, imp?.status, imp?.cargo_status, imp?.forwarder_status, imp?.payment_terms, imp?.payment_date, imp?.aviso_arribo_date, imp?.traslado_deposito_date, imp?.carga_deposito_date, imp?.carga_deposito_time])

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

  // ── Helper summaries uniformes ────────────────────────────────────────────
  const sm = {
    ok:    (text: string) => (
      <span className="flex items-center gap-1.5">
        <span className="text-emerald-400 font-bold">✓</span>
        <span className="text-slate-300">{text}</span>
      </span>
    ),
    warn:  (text: string) => (
      <span className="flex items-center gap-1.5">
        <span className="text-amber-400">⚠</span>
        <span className="text-slate-400">{text}</span>
      </span>
    ),
    alert: (text: string) => (
      <span className="flex items-center gap-1.5">
        <span className="text-red-400 animate-pulse">●</span>
        <span className="text-red-400">{text}</span>
      </span>
    ),
    none:  (text: string) => <span className="text-slate-600">{text}</span>,
    info:  (text: string) => <span className="text-slate-400">{text}</span>,
  }

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

          {/* Envíos partidos: estado + marcar como última parte */}
          {imp.multi_part_status !== 'none' && (
            <div className="flex items-center gap-2 pt-0.5">
              <span className={cn(
                'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full',
                imp.multi_part_status === 'open' ? 'bg-amber-900/40 text-amber-400' : 'bg-slate-700 text-slate-400'
              )}>
                <PackageOpen size={10} />
                {imp.multi_part_status === 'open' ? 'Parte abierta' : 'Última parte'}
              </span>
              <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={imp.multi_part_status === 'closed'}
                  onChange={(e) => upd({ multi_part_status: e.target.checked ? 'closed' : 'open' })}
                  className="rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-0"
                />
                Es la última parte
              </label>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Export buttons */}
          <button
            onClick={handleExportPdf}
            disabled={exportingPdf}
            title="Exportar a PDF"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
          >
            {exportingPdf ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
            PDF
          </button>
          <button
            onClick={handleExportXlsx}
            disabled={exportingXlsx}
            title="Exportar a Excel"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
          >
            {exportingXlsx ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />}
            Excel
          </button>

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
              {MANUALLY_SELECTABLE_STATUSES.map((s) => (
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
        onUpdateCargoStatus={(s) => upd({ cargo_status: s })}
        onUpdateForwarderStatus={(s) => upd({ forwarder_status: s })}
        imp={imp}
      />

      {/* ── Meta panel ── */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-4">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
          Datos generales — click en cualquier campo para editar
        </p>

        {/* ── Row 0: Operaciones — Forwarder / Despachante / BL / Despacho ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pb-3 border-b border-slate-700/50">
          {/* Ref. Mail Forwarder */}
          <EditableText
            label="Ref. Mail forwarder"
            value={imp.forwarder_ref_mail ?? ''}
            onSave={(v) => upd({ forwarder_ref_mail: v })}
            placeholder="—"
          />

          {/* Forwarder — dropdown de operadores */}
          <EditableSelect
            label="Forwarder"
            value={imp.freight_operator_id ?? ''}
            options={[
              { value: '', label: '— Sin forwarder —' },
              ...operators.map((o) => ({ value: o.id, label: o.name }))
            ]}
            onChange={(v) => upd({ freight_operator_id: v || null })}
          />

          {/* Despachante — dropdown de despachantes (Comex Despachantes) */}
          <EditableSelect
            label="Despachante"
            value={imp.despachante ?? ''}
            options={[
              { value: '', label: '— Sin asignar —' },
              ...despachantes.map((d) => ({ value: d.name, label: d.name }))
            ]}
            onChange={(v) => upd({ despachante: v })}
          />

          {/* BL N° */}
          <EditableText
            label="BL N°"
            value={imp.bl_number ?? ''}
            onSave={(v) => upd({ bl_number: v })}
            placeholder="—"
          />

          {/* Despacho — read-only del customs, editable como texto */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Despacho</p>
            <p className={cn(
              'text-sm mt-0.5 font-mono',
              imp._despacho_number ? 'text-slate-200' : 'text-slate-600 italic'
            )}>
              {imp._despacho_number || '—'}
            </p>
          </div>
        </div>

        {/* Row 1: Estado / Incoterm / Proveedor / Moneda */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <EditableSelect
            label="Estado"
            value={imp.status as ImportStatus}
            options={MANUALLY_SELECTABLE_STATUSES.map((s) => ({ value: s, label: IMPORT_STATUS_LABELS[s] }))}
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
                if (supplier.payment_condition) {
                  updates.payment_terms = supplier.payment_condition === 'diferido' ? 'a_plazo' : 'anticipado'
                  if (supplier.payment_deferred_days != null) updates.payment_deferred_days = supplier.payment_deferred_days
                }
                const ports = supplier.port_of_origin
                  ? supplier.port_of_origin.split('|').map((p) => p.trim()).filter(Boolean)
                  : []
                updates.origin_port = supplier.default_port_of_origin && ports.includes(supplier.default_port_of_origin)
                  ? supplier.default_port_of_origin
                  : (ports.length === 1 ? ports[0] : '')
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
          <EditableDate label="ETD — Fecha salida estimada" value={imp.ship_date}    onSave={(v) => upd({ ship_date: v })} />
        </div>

        {/* Row 4b: Fecha del depósito del proveedor */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <EditableDate
              label="Carga armada en depósito"
              value={imp.carga_armada_date}
              onSave={(v) => upd({ carga_armada_date: v, cargo_status: v ? 'carga_armada' : 'en_armado' as CargoStatus })}
            />
            <p className="text-[9px] text-slate-600 mt-0.5 pl-0.5">→ avanza/retrocede Estado de carga junto con la fecha</p>
          </div>
        </div>

        {/* Row 4c: Envío de documentación */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <EditableSentDate
            label="Docs enviados al despachante"
            sent={imp.docs_to_despachante ?? 0}
            date={imp.docs_to_despachante_date}
            onSentChange={(v) => upd({ docs_to_despachante: v ? 1 : 0 })}
            onDateSave={(ts) => upd({ docs_to_despachante_date: ts })}
          />
          <EditableSentDate
            label="Docs enviados a compras"
            sent={imp.docs_to_compras ?? 0}
            date={imp.docs_to_compras_date}
            onSentChange={(v) => upd({ docs_to_compras: v ? 1 : 0 })}
            onDateSave={(ts) => upd({ docs_to_compras_date: ts })}
          />
        </div>

        {/* ── Datos de carga — siempre visible, editable manualmente ── */}
        {(() => {
          const depositoFiscal = extras.find(e => e.categoria === 'deposito_fiscal' && e.proveedor?.trim())
          const bultos  = customs?.cant_bultos   // del despacho OM-1993 (solo lectura)

          const saveCustoms = (data: Partial<UpsertComexCustomsInput>) => {
            if (!id) return
            upsertCustoms.mutate({ importId: id, data })
          }

          // Desglose por PL (solo los que tienen datos extraídos)
          const plsConDatos = plFilesList
            .map((f, i) => {
              if (!f.extracted_json) return null
              try {
                const d = JSON.parse(f.extracted_json) as import('@shared/types').ExtractedPL
                return { label: `PL ${i + 1}`, d }
              } catch { return null }
            })
            .filter((x): x is { label: string; d: import('@shared/types').ExtractedPL } => x !== null)

          const fmtN = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 3 })

          return (
            <div className="rounded-lg border border-slate-700/40 bg-slate-800/40 px-4 py-3 space-y-2.5">
              {/* Header */}
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-2">
                <span className="text-slate-500">📦</span>
                Datos de carga
              </p>

              {/* Desglose por Packing List */}
              {plsConDatos.length > 0 && (
                <div className="rounded-lg border border-emerald-800/30 bg-emerald-950/10 overflow-hidden">
                  {/* Encabezados de columnas */}
                  <div className="grid grid-cols-5 gap-0 text-[9px] text-slate-500 uppercase tracking-wider font-semibold px-3 py-1.5 border-b border-emerald-800/20 bg-emerald-950/20">
                    <span></span>
                    <span>Cajas</span>
                    <span>Pallets</span>
                    <span>Peso bruto</span>
                    <span>Volumen</span>
                  </div>
                  {/* Filas por PL */}
                  {plsConDatos.map(({ label, d }) => (
                    <div key={label} className="grid grid-cols-5 gap-0 text-[11px] px-3 py-1.5 border-b border-emerald-800/10 last:border-b-0">
                      <span className="text-emerald-400 font-bold text-[10px]">{label}</span>
                      <span className="text-slate-300">{typeof d.cant_cartons  === 'number' ? d.cant_cartons  : '—'}</span>
                      <span className="text-slate-300">{typeof d.cant_pallets  === 'number' ? d.cant_pallets  : '—'}</span>
                      <span className="text-slate-300">{typeof d.peso_bruto_kg === 'number' ? `${fmtN(d.peso_bruto_kg)} kg` : '—'}</span>
                      <span className="text-slate-300">{typeof d.volumen_m3    === 'number' ? `${fmtN(d.volumen_m3)} m³`    : '—'}</span>
                    </div>
                  ))}
                  {/* Fila totales (solo si hay 2+ PLs) */}
                  {plsConDatos.length >= 2 && (() => {
                    let cajas = 0, pallets = 0, peso = 0, vol = 0
                    let hC = false, hP = false, hPe = false, hV = false
                    for (const { d } of plsConDatos) {
                      if (typeof d.cant_cartons  === 'number') { cajas   += d.cant_cartons;  hC  = true }
                      if (typeof d.cant_pallets  === 'number') { pallets += d.cant_pallets;  hP  = true }
                      if (typeof d.peso_bruto_kg === 'number') { peso    += d.peso_bruto_kg; hPe = true }
                      if (typeof d.volumen_m3    === 'number') { vol     += d.volumen_m3;    hV  = true }
                    }
                    return (
                      <div className="grid grid-cols-5 gap-0 text-[11px] px-3 py-1.5 bg-emerald-900/20 border-t border-emerald-700/30">
                        <span className="text-emerald-300 font-bold text-[10px]">Total</span>
                        <span className="text-emerald-200 font-bold">{hC  ? cajas             : '—'}</span>
                        <span className="text-emerald-200 font-bold">{hP  ? pallets           : '—'}</span>
                        <span className="text-emerald-200 font-bold">{hPe ? `${fmtN(peso)} kg` : '—'}</span>
                        <span className="text-emerald-200 font-bold">{hV  ? `${fmtN(vol)} m³`  : '—'}</span>
                      </div>
                    )
                  })()}
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-5 gap-x-4 gap-y-3">

                {/* Depósito fiscal — solo lectura */}
                <div className="md:col-span-1">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Depósito fiscal</p>
                  {depositoFiscal ? (
                    <div className="mt-0.5">
                      <p className="text-sm font-semibold text-cyan-300">{depositoFiscal.proveedor}</p>
                      {(() => {
                        const isValidDate = (d: string | null | undefined) =>
                          !!d && d !== 'null' && /^\d{4}-\d{2}-\d{2}$/.test(d)
                        const ingreso = isValidDate(depositoFiscal.fecha_ingreso) ? depositoFiscal.fecha_ingreso! : null
                        const egreso  = isValidDate(depositoFiscal.fecha_egreso)  ? depositoFiscal.fecha_egreso!  : null
                        if (!ingreso && !egreso) return null
                        const fmt = (d: string) => d.split('-').reverse().join('/')
                        return (
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {ingreso && <>Ingreso: {fmt(ingreso)}</>}
                            {ingreso && egreso && ' · '}
                            {egreso  && <>Egreso: {fmt(egreso)}</>}
                          </p>
                        )
                      })()}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600 italic mt-0.5">—</p>
                  )}
                </div>

                {/* Peso bruto — editable */}
                <div>
                  <EditableNumber
                    label="Peso bruto"
                    value={customs?.peso_bruto_kg ?? null}
                    suffix=" kg"
                    onSave={(v) => saveCustoms({ peso_bruto_kg: v })}
                  />
                </div>

                {/* Volumen — editable */}
                <div>
                  <EditableNumber
                    label="Volumen"
                    value={customs?.volumen_m3 ?? null}
                    suffix=" m³"
                    onSave={(v) => saveCustoms({ volumen_m3: v })}
                  />
                </div>

                {/* Cajas — editable */}
                <div>
                  <EditableNumber
                    label="Cajas"
                    value={customs?.cant_cartons ?? null}
                    suffix=" cajas"
                    onSave={(v) => saveCustoms({ cant_cartons: v })}
                  />
                  {customs?.cant_cartons != null && bultos != null && customs.cant_cartons !== bultos && (
                    <p className="text-[9px] text-amber-500 mt-0.5">
                      Desp.: {bultos}
                    </p>
                  )}
                </div>

                {/* Pallets — editable */}
                <div>
                  <EditableNumber
                    label="Pallets"
                    value={customs?.cant_pallets ?? null}
                    suffix=" pallets"
                    onSave={(v) => saveCustoms({ cant_pallets: v })}
                  />
                </div>

              </div>
            </div>
          )
        })()}

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

        {/* ── Fechas operativas de llegada ── */}
        <div className="rounded-lg border border-cyan-800/30 bg-cyan-950/10 p-3 space-y-3">
          <p className="text-[10px] text-cyan-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
            <span>⚓</span> Fechas operativas de llegada
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                Fecha aviso arribo
              </label>
              <p className="text-[10px] text-slate-600 mb-1.5">Dispara automáticamente el estado → Arribado</p>
              <EditableDate
                label=""
                value={imp.aviso_arribo_date}
                onSave={(v) => upd({ aviso_arribo_date: v })}
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                Fecha traslado a depósito fiscal
              </label>
              <p className="text-[10px] text-slate-600 mb-1.5">Dispara automáticamente → Traslado a depósito</p>
              <EditableDate
                label=""
                value={imp.traslado_deposito_date}
                onSave={(v) => upd({ traslado_deposito_date: v })}
              />
            </div>
          </div>

          {/* Chip sugerencia Oficializado */}
          {imp.oficializacion_import_date && imp.status === 'customs' && (
            <div className="flex items-center justify-between gap-3 px-3 py-2 bg-pink-950/20 border border-pink-800/30 rounded-lg mt-1">
              <div className="flex items-center gap-2">
                <span className="text-pink-400">✓</span>
                <span className="text-xs text-pink-300">
                  Despacho oficializado el {dayjs(imp.oficializacion_import_date).format('DD/MM/YYYY')}
                </span>
              </div>
              <button onClick={() => upd({ status: 'oficializado' })}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold bg-pink-700 hover:bg-pink-600 text-white transition-colors flex-shrink-0">
                Marcar como Oficializado
              </button>
            </div>
          )}

          {/* Turno de carga en depósito fiscal */}
          <div className="border-t border-cyan-800/20 pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] text-teal-400 uppercase tracking-wider font-semibold">
                🏭 Turno de carga en depósito fiscal
              </label>
              {imp.carga_deposito_date && (
                <button
                  onClick={() => setShowWaCargaModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-semibold bg-emerald-700/40 hover:bg-emerald-700/70 text-emerald-300 border border-emerald-700/50 transition-colors"
                >
                  📲 Avisar al equipo por WhatsApp
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-600">
              Cuando llegue esta fecha y hora → avanza automáticamente a "Carga en depósito"
            </p>
            {showWaCargaModal && (
              <WhatsAppCargaModal imp={imp} customs={customs ?? null} onClose={() => setShowWaCargaModal(false)} />
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">Fecha del turno</label>
                <EditableDate label="" value={imp.carga_deposito_date} onSave={(v) => upd({ carga_deposito_date: v })} />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">Hora del turno</label>
                <input
                  type="time"
                  value={imp.carga_deposito_time ?? ''}
                  onChange={e => upd({ carga_deposito_time: e.target.value || null })}
                  className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-teal-500 font-mono"
                />
              </div>
            </div>

            {/* Botón confirmación de recepción cuando el status es carga_deposito */}
            {imp.status === 'carga_deposito' && (
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-teal-950/30 border border-teal-700/40 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-teal-400 text-base">🏭</span>
                  <div>
                    <p className="text-xs text-teal-300 font-semibold">Turno de carga pasado</p>
                    {imp.carga_deposito_date && (
                      <p className="text-[10px] text-teal-600">
                        {dayjs(imp.carga_deposito_date).format('DD/MM/YYYY')}
                        {imp.carga_deposito_time ? ` a las ${imp.carga_deposito_time}` : ''}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => upd({ status: 'delivered', actual_arrival_date: Date.now() })}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-bold bg-teal-600 hover:bg-teal-500 text-white transition-colors flex-shrink-0"
                >
                  ✓ Confirmar recepción en depósito
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Notas — al final de Datos generales */}
        <div className="pt-3 border-t border-slate-700/50">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">Notas</p>
          <EditableText label="" value={imp.notes} onSave={(v) => upd({ notes: v })} placeholder="Sin notas — click para agregar" multiline />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECCIONES COLAPSABLES — en el orden definido
      ════════════════════════════════════════════════════════════════════════ */}

      {/* 0. Pago */}
      {(() => {
        const isPaid = !!imp.payment_date
        const isDue  = !!imp.payment_due_date && !isPaid
        const payoSummary = isPaid
          ? sm.ok(`Pagado · ${dayjs(imp.payment_date!).format('DD/MM/YY')}`)
          : isDue
            ? sm.warn(`Pago diferido · vence ${dayjs(imp.payment_due_date!).format('DD/MM/YY')}`)
            : imp.payment_terms === 'a_plazo'
              ? sm.info(`Pago diferido${imp.payment_deferred_days != null ? ` · ${imp.payment_deferred_days} días desde factura` : ''}`)
              : imp.payment_terms === 'anticipado'
                ? sm.info('Pago anticipado · sin fecha de pago')
                : sm.none('Sin condición configurada')
        return (
          <CollapsibleSection label="Pago" icon={DollarSign} accentColor="border-l-emerald-600"
            isOpen={sections.pago} onToggle={() => toggle('pago')} summary={payoSummary}>
            <PaymentSection imp={imp} onUpdate={upd} />
          </CollapsibleSection>
        )
      })()}

      {/* 1. Resumen de costos */}
      {(() => {
        const pct = imp.cost_pct
        const costSummary = pct == null
          ? sm.none('Sin datos de costo')
          : pct < 25
            ? sm.ok(`${pct.toFixed(1)}% sobre valor factura`)
            : pct < 35
              ? sm.warn(`${pct.toFixed(1)}% sobre valor factura`)
              : sm.alert(`${pct.toFixed(1)}% — costo alto`)
        return (
          <CollapsibleSection label="Resumen de costos" icon={DollarSign} accentColor="border-l-amber-600"
            isOpen={sections.costos} onToggle={() => toggle('costos')} summary={costSummary}>
            <div className="p-4"><CostDashboard importId={imp.id} imp={imp} /></div>
          </CollapsibleSection>
        )
      })()}

      {/* 2. Proformas */}
      {(() => {
        const fmtVal = (n: number, mon: string) =>
          `${mon} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

        const selected   = proformasD.filter(p => p.incluir_en_total === 1 && p.importe != null)
        const currencies = [...new Set(selected.map(p => p.moneda))]
        const latest     = proformasD.length > 0 ? proformasD[proformasD.length - 1] : null
        const latestDate = latest?.fecha_proforma
          ? dayjs(latest.fecha_proforma).format('DD/MM/YY')
          : null

        const proformaSummary = proformasD.length === 0
          ? sm.none('Sin proformas')
          : selected.length === 0
            ? sm.warn(`${proformasD.length} proforma${proformasD.length !== 1 ? 's' : ''} · Sin valor`)
            : sm.ok([
                `${proformasD.length} proforma${proformasD.length !== 1 ? 's' : ''}`,
                currencies.length === 1
                  ? `· ${fmtVal(selected.reduce((s, p) => s + (p.importe ?? 0), 0), currencies[0])}`
                  : `· ${selected.length} seleccionadas`,
                latestDate ? `· última: ${latestDate}` : ''
              ].filter(Boolean).join(' '))

        return (
          <CollapsibleSection
            label="Proformas"
            icon={FileText}
            accentColor="border-l-teal-600"
            isOpen={sections.proformas}
            onToggle={() => toggle('proformas')}
            summary={proformaSummary}
          >
            <div className="p-4"><ProformaSection imp={imp} /></div>
          </CollapsibleSection>
        )
      })()}

      {/* 3. Facturas comerciales */}
      {(() => {
        const fmtV = (n: number, mon: string) => `${mon} ${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`
        const selFact    = facturasD.filter(p => p.incluir_en_total === 1 && p.importe != null)
        const currFact   = [...new Set(selFact.map(p => p.moneda))]
        const hasValFact = selFact.length > 0
        const latestFact = facturasD.length > 0 ? facturasD[facturasD.length - 1] : null
        const latestDate = latestFact?.fecha_proforma ? dayjs(latestFact.fecha_proforma).format('DD/MM/YY') : null

        const badge = facturasD.length === 0 && proformasD.length > 0
          ? sm.warn('Sin factura — proforma cargada')
          : facturasD.length === 0
            ? sm.none('Sin facturas')
            : !hasValFact
              ? sm.warn(`${facturasD.length} factura${facturasD.length !== 1 ? 's' : ''} · Sin valor`)
              : sm.ok([
                  `${facturasD.length} factura${facturasD.length !== 1 ? 's' : ''}`,
                  currFact.length === 1 ? `· ${fmtV(selFact.reduce((s,p) => s + (p.importe ?? 0), 0), currFact[0])}` : `· ${selFact.length} seleccionada${selFact.length !== 1 ? 's' : ''}`,
                  latestDate ? `· última: ${latestDate}` : ''
                ].filter(Boolean).join(' '))

        return (
          <CollapsibleSection label="Facturas comerciales" icon={FileText} accentColor="border-l-teal-600"
            isOpen={sections.facturas} onToggle={() => toggle('facturas')}
            summary={<span className="flex items-center gap-2">{badge}</span>}>
            <div className="p-4">
              <FacturasComercialSection imp={imp} proformasData={proformasD} />
            </div>
          </CollapsibleSection>
        )
      })()}

      {/* 4. PL - Packing List */}
      {(() => {
        let plSummary: React.ReactNode
        if (plFilesList.length === 0) {
          plSummary = sm.none('Sin Packing List')
        } else {
          const withData = plFilesList.filter(f => f.extracted_json)
          if (withData.length > 0) {
            let peso = 0, cartons = 0, hasPeso = false, hasCartons = false
            for (const f of withData) {
              try {
                const d = JSON.parse(f.extracted_json!) as import('@shared/types').ExtractedPL
                if (typeof d.peso_bruto_kg === 'number') { peso    += d.peso_bruto_kg; hasPeso    = true }
                if (typeof d.cant_cartons  === 'number') { cartons += d.cant_cartons;  hasCartons = true }
              } catch { /* noop */ }
            }
            const parts: string[] = [`${plFilesList.length} PL${plFilesList.length > 1 ? 's' : ''}`]
            if (hasCartons) parts.push(`${cartons} cajas`)
            if (hasPeso)    parts.push(`${peso.toLocaleString('es-AR', { maximumFractionDigits: 0 })} kg`)
            plSummary = sm.ok(parts.join(' · '))
          } else {
            plSummary = sm.ok(`${plFilesList.length} archivo${plFilesList.length > 1 ? 's' : ''} cargado${plFilesList.length > 1 ? 's' : ''}`)
          }
        }
        return (
          <CollapsibleSection label="PL - Packing List" icon={Package} accentColor="border-l-emerald-600"
            isOpen={sections.pl} onToggle={() => toggle('pl')} summary={plSummary}>
            <div className="p-4"><PLSection imp={imp} importId={imp.id} customs={customs ?? null} onUpdate={(data) => upd(data)} /></div>
          </CollapsibleSection>
        )
      })()}

      {/* 5. BL - Bill of Lading */}
      {(() => {
        const blSummary = imp.bl_stored_name
          ? imp.bl_number
            ? sm.ok(`BL ${imp.bl_number}`)
            : sm.ok('Archivo cargado')
          : sm.none('Sin BL')
        return (
          <CollapsibleSection label="BL - Bill of Lading" icon={FileText} accentColor="border-l-sky-600"
            isOpen={sections.bl} onToggle={() => toggle('bl')} summary={blSummary}>
            <div className="p-4"><BLSection imp={imp} importId={imp.id} customs={customs ?? null} onUpdate={(data) => upd(data)} /></div>
          </CollapsibleSection>
        )
      })()}

      {/* 5. Certificaciones ANMAT */}
      {(() => {
        const inalSummary = imp.inal_required !== 1
          ? sm.none('Sin INAL requerido')
          : imp.inal_lc_status === 'finalizado'
            ? sm.ok('INAL · Finalizado')
            : imp.inal_lc_status === 'en_tramite'
              ? sm.warn('INAL · En trámite')
              : imp.inal_lc_status === 'mail_enviado'
                ? sm.info('INAL · Mail enviado al gestor')
                : sm.warn('INAL · Pendiente')
        return (
          <CollapsibleSection label="Certificaciones ANMAT · INAL" icon={ShieldCheck} accentColor="border-l-emerald-600"
            isOpen={sections.anmat} onToggle={() => toggle('anmat')} summary={inalSummary}>
            <div className="p-4"><InalSection imp={imp} onUpdate={(data) => upd(data)} /></div>
          </CollapsibleSection>
        )
      })()}

      {/* 3. Flete internacional */}
      {(() => {
        const fleteIntExtras = extras.filter(c => c.categoria === 'flete_internacional')
        const fleteIntTotal  = fleteIntExtras.reduce((s, c) => s + costToARS(c, customs?.dolar_aduana ?? 0), 0)
        const hasPDF         = fleteIntExtras.some(c => c.stored_name)
        const fleteIntSummary = fleteIntTotal > 0
          ? sm.ok(`${fleteIntExtras.length} factura${fleteIntExtras.length !== 1 ? 's' : ''} · $${Math.round(fleteIntTotal).toLocaleString('es-AR')} ARS`)
          : hasPDF
            ? sm.warn(`${fleteIntExtras.length} factura${fleteIntExtras.length !== 1 ? 's' : ''} sin analizar`)
            : sm.none('Sin facturas')
        return (
          <CollapsibleSection label="Flete internacional" icon={Ship} accentColor="border-l-blue-600"
            isOpen={sections.flete_int} onToggle={() => toggle('flete_int')} summary={fleteIntSummary}>
            <div className="p-4"><FleteSection imp={imp} categoria="flete_internacional" /></div>
          </CollapsibleSection>
        )
      })()}

      {/* 4. Despacho de Aduana (PDF + campos aduaneros) — sección unificada */}
      {(() => {
        const hasPDF       = !!imp.despacho_stored_name
        const hasData      = !!customs?.despacho_number
        const dataParts    = [
          customs?.despacho_number,
          customs?.oficializacion_date ? dayjs(customs.oficializacion_date).format('DD/MM/YYYY') : null,
          hasPDF ? '📄 PDF' : null,
          imp.despacho_drive_status === 'synced' ? '☁ Drive' : null,
        ].filter(Boolean).join(' · ')
        const despSummary  = !hasPDF && !hasData
          ? sm.none('Sin despacho adjunto')
          : hasPDF && !hasData
            ? sm.warn(dataParts || 'PDF sin analizar')
            : sm.ok(dataParts)
        return (
          <CollapsibleSection label="Despacho de Aduana" icon={Landmark} accentColor="border-l-cyan-600"
            isOpen={sections.despacho} onToggle={() => toggle('despacho')} summary={despSummary}>
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
        const derechosUSD     = tributos.filter(t => esCostoReal(t.codigo)).reduce((s, t) => s + t.importe_usd, 0)
        const tributosSummary = tributos.length > 0
          ? sm.ok(`${tributos.length} conceptos · USD ${derechosUSD.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`)
          : imp.despacho_stored_name
            ? sm.warn('Sin tributos — analizá el despacho')
            : sm.none('Sin datos')
        return (
          <CollapsibleSection label="Tributos, impuestos y derechos" icon={DollarSign} accentColor="border-l-amber-600"
            isOpen={sections.tributos} onToggle={() => toggle('tributos')} summary={tributosSummary}>
            <div className="p-4"><TributosSection imp={imp} /></div>
          </CollapsibleSection>
        )
      })()}

      {/* 6. Depósito fiscal */}
      {(() => {
        const depositoCost    = extras.find(c => c.categoria === 'deposito_fiscal')
        const depositoSummary = depositoCost?.importe > 0
          ? sm.ok(`${depositoCost.proveedor || 'Sin proveedor'} · $${Math.round(depositoCost.importe).toLocaleString('es-AR')}`)
          : depositoCost?.stored_name
            ? sm.warn('PDF sin analizar')
            : sm.none('Sin factura')
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
        const despachanteCost    = extras.find(c => c.categoria === 'despachante')
        const despachanteSummary = despachanteCost?.importe > 0
          ? sm.ok(`${despachanteCost.proveedor || 'Sin proveedor'} · $${Math.round(despachanteCost.importe).toLocaleString('es-AR')}`)
          : despachanteCost?.stored_name
            ? sm.warn('PDF sin analizar')
            : sm.none('Sin factura')
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
        const fleteLocExtras  = extras.filter(c => c.categoria === 'flete_local')
        const fleteLocTotal   = fleteLocExtras.reduce((s, c) => s + costToARS(c, customs?.dolar_aduana ?? 0), 0)
        const fleteLocHasPDF  = fleteLocExtras.some(c => c.stored_name)
        const fleteLocSummary = fleteLocTotal > 0
          ? sm.ok(`${fleteLocExtras.length} factura${fleteLocExtras.length !== 1 ? 's' : ''} · $${Math.round(fleteLocTotal).toLocaleString('es-AR')} ARS`)
          : fleteLocHasPDF
            ? sm.warn(`${fleteLocExtras.length} factura${fleteLocExtras.length !== 1 ? 's' : ''} sin analizar`)
            : sm.none('Sin facturas')
        return (
          <CollapsibleSection label="Flete local" icon={Ship} accentColor="border-l-blue-600"
            isOpen={sections.flete_local} onToggle={() => toggle('flete_local')} summary={fleteLocSummary}>
            <div className="p-4"><FleteSection imp={imp} categoria="flete_local" /></div>
          </CollapsibleSection>
        )
      })()}

      {/* 9. Productos */}
      {(() => {
        const prodTotal   = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
        const prodSummary = items.length > 0
          ? sm.ok(`${items.length} ítem${items.length !== 1 ? 's' : ''} · ${imp.currency} ${prodTotal.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`)
          : sm.none('Sin ítems')
        return (
          <CollapsibleSection label="Productos" icon={Package} accentColor="border-l-slate-500"
            isOpen={sections.productos} onToggle={() => toggle('productos')} summary={prodSummary}>
            <div className="p-4"><ItemsSection importId={imp.id} /></div>
          </CollapsibleSection>
        )
      })()}

      {/* 10. Presupuestos logísticos */}
      {(() => {
        const selected  = quotesData.find(q => q.status === 'selected')
        const requested = quotesData.filter(q => q.status === 'requested').length
        const quoted    = quotesData.filter(q => q.status === 'quoted').length
        const presupSummary = quotesData.length === 0
          ? sm.none('Sin cotizaciones')
          : selected
            ? sm.ok(`${quotesData.length} cotizacion${quotesData.length !== 1 ? 'es' : ''} · ${selected.operator_name} seleccionado`)
            : requested > 0
              ? sm.info(`${requested} solicitud${requested !== 1 ? 'es' : ''} enviada${requested !== 1 ? 's' : ''} · esperando respuesta`)
              : quoted > 0
                ? sm.warn(`${quoted} cotización${quoted !== 1 ? 'es' : ''} recibida${quoted !== 1 ? 's' : ''} · sin seleccionar`)
                : sm.info(`${quotesData.length} cotizacion${quotesData.length !== 1 ? 'es' : ''}`)
        return (
          <CollapsibleSection label="Presupuestos logísticos" icon={Ship} accentColor="border-l-slate-500"
            isOpen={sections.presupuestos} onToggle={() => toggle('presupuestos')} summary={presupSummary}>
            <div className="p-4">
              <QuotesSection importId={imp.id} imp={imp} customs={customs} items={items} />
            </div>
          </CollapsibleSection>
        )
      })()}

    </div>
  )
}

// ── INAL / ANMAT Section ──────────────────────────────────────────────────────

const INAL_LC_FLOW: InalLCStatus[] = ['pendiente', 'mail_enviado', 'vep_pagado', 'en_tramite', 'finalizado']
const INAL_LC_LABELS: Record<InalLCStatus, string> = {
  pendiente:    'Pendiente',
  mail_enviado: 'Mail enviado a gestor',
  vep_pagado:   'VEP pagado',
  en_tramite:   'En trámite',
  finalizado:   'Finalizado'
}
const INAL_LC_COLORS: Record<InalLCStatus, string> = {
  pendiente:    '#64748b',   // slate
  mail_enviado: '#60a5fa',   // blue
  vep_pagado:   '#a78bfa',   // violet
  en_tramite:   '#f59e0b',   // amber
  finalizado:   '#22c55e'    // green
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

  // Upload states PL / Xls
  const [uploadingPL,  setUploadingPL]  = useState(false)
  const [uploadingXls, setUploadingXls] = useState(false)

  const { data: certs = [] } = useComexInalCerts(inalOn ? imp.id : null)
  const { data: facturas = [] } = useComexFacturasComerciales(inalOn ? imp.id : null)
  const uploadCert = useUploadInalCert(imp.id)
  const deleteCert = useDeleteInalCert(imp.id)

  const vepFlowIndex = INAL_LC_FLOW.indexOf('vep_pagado')
  const lcFlowIndex = INAL_LC_FLOW.indexOf(lcStatus)
  const showVeps = inalOn && lcFlowIndex >= vepFlowIndex
  const { data: veps = [] } = useInalVeps(showVeps ? imp.id : null)
  const uploadVep = useUploadInalVep(imp.id)
  const deleteVep = useDeleteInalVep(imp.id)
  useInalVepLiveUpdates(showVeps ? imp.id : null)

  const [vepUploading, setVepUploading] = useState(false)
  const [vepUploadProgress, setVepUploadProgress] = useState<{ current: number; total: number } | null>(null)
  const [isDragOverVep, setIsDragOverVep] = useState(false)
  const dragCounterVep = useRef(0)

  const vepTotal = veps.reduce((s, v) => s + (v.importe_total ?? 0), 0)

  const uploadVepFiles = async (filePaths: string[]) => {
    if (!filePaths.length) return
    setVepUploading(true)
    setVepUploadProgress({ current: 0, total: filePaths.length })
    let folderId = imp.inal_lc_cert_folder_id ?? null
    try {
      for (let i = 0; i < filePaths.length; i++) {
        setVepUploadProgress({ current: i + 1, total: filePaths.length })
        const result = await uploadVep.mutateAsync({
          filePath: filePaths[i],
          importFolderId: imp.drive_folder_id ?? null,
          vepFolderId: folderId
        })
        // Persist the folder ID returned so subsequent files land in the same folder
        if (result.vepFolderId) folderId = result.vepFolderId
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir el VEP')
    } finally {
      setVepUploading(false)
      setVepUploadProgress(null)
    }
  }

  const handleSelectVeps = async () => {
    const filePaths = await window.api.comex.inal.veps.selectFiles()
    await uploadVepFiles(filePaths)
  }

  const handleDropVep = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragCounterVep.current = 0
    setIsDragOverVep(false)
    const files = Array.from(e.dataTransfer.files)
    const paths = files.map(f => window.api.getPathForFile(f)).filter(Boolean) as string[]
    await uploadVepFiles(paths)
  }

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
    // Soportar múltiples archivos arrastrados
    const files = Array.from(e.dataTransfer.files)
    for (const file of files) {
      const fp = window.api.getPathForFile(file)
      if (fp) handleUpload(fp)
    }
  }

  const handleSelectFile = async () => {
    // Selección múltiple de archivos
    const filePaths = await window.api.comex.inal.certs.selectFiles()
    for (const fp of filePaths) {
      handleUpload(fp)
    }
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
              Certificaciones ANMAT · INAL
            </p>
            <p className="text-[10px] text-slate-600">Libre Circulación para importaciones con INAL</p>
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

          {/* ── Documentos para el gestor ── */}
          {(() => {
            type DocKey = 'factura' | 'bl' | 'pl' | 'xls' | 'certs'

            const items: Array<{ key: DocKey; label: string; ok: boolean; desc: string; driveStatus: string | null }> = [
              { key: 'factura', label: 'Factura comercial',   ok: !!imp.inal_factura_stored_name, desc: imp.inal_factura_original_name ?? 'Subir para carpeta INAL',         driveStatus: imp.inal_factura_drive_status },
              { key: 'bl',      label: 'BL - Bill of Lading', ok: !!imp.inal_bl_stored_name,      desc: imp.inal_bl_original_name      ?? 'Subir para carpeta INAL',         driveStatus: imp.inal_bl_drive_status },
              { key: 'pl',      label: 'Packing List',         ok: !!imp.inal_pl_stored_name,      desc: imp.inal_pl_original_name      ?? 'Subir el packing list',          driveStatus: imp.inal_pl_drive_status },
              { key: 'xls',     label: 'Xls resumen INAL',    ok: !!imp.inal_xls_stored_name,     desc: imp.inal_xls_original_name     ?? 'Excel con pesos por producto',    driveStatus: imp.inal_xls_drive_status },
              { key: 'certs',   label: 'Certificados INAL',   ok: certs.length > 0,               desc: certs.length > 0 ? `${certs.length} certificado${certs.length !== 1 ? 's' : ''} cargado${certs.length !== 1 ? 's' : ''}` : 'Subir uno o más certificados', driveStatus: null },
            ]
            const readyCount = items.filter(i => i.ok).length
            const pct = Math.round((readyCount / items.length) * 100)

            const getApi = (key: DocKey) => {
              if (key === 'factura') return window.api.comex.inal.factura
              if (key === 'bl')      return window.api.comex.inal.blcopy
              if (key === 'pl')      return window.api.comex.inal.pl
              if (key === 'xls')     return window.api.comex.inal.xls
              return null
            }

            const handleUploadDoc = async (key: DocKey) => {
              const api = getApi(key)
              if (!api) return
              const fp = await api.selectFile()
              if (!fp) return
              if (key === 'pl')  setUploadingPL(true)
              if (key === 'xls') setUploadingXls(true)
              try {
                const updated = await api.upload(imp.id, fp)
                onUpdate(updated as Partial<ComexImport>)
                qc.invalidateQueries({ queryKey: ['comex-import', imp.id] })
              } finally {
                if (key === 'pl')  setUploadingPL(false)
                if (key === 'xls') setUploadingXls(false)
              }
            }

            const handleDeleteDoc = async (key: DocKey) => {
              const api = getApi(key)
              if (!api) return
              const updated = await api.delete(imp.id)
              onUpdate(updated as Partial<ComexImport>)
              qc.invalidateQueries({ queryKey: ['comex-import', imp.id] })
            }

            const isUploadingDoc = (key: DocKey) => key === 'pl' ? uploadingPL : key === 'xls' ? uploadingXls : false

            return (
              <div className="rounded-xl border border-emerald-800/30 bg-emerald-950/10 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-emerald-800/20 bg-emerald-950/20">
                  <div className="flex items-center gap-2">
                    <ClipboardList size={13} className="text-emerald-400" />
                    <span className="text-[11px] font-semibold text-emerald-300">Documentos para el gestor de Libre Circulación</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className={cn('text-[10px] font-semibold', readyCount === items.length ? 'text-emerald-400' : 'text-slate-500')}>
                      {readyCount}/{items.length}
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-slate-800/60">
                  {items.map((item) => {
                    const isCerts = item.key === 'certs'
                    return (
                      <div key={item.key} className="flex items-start gap-3 px-3 py-2">
                        <div className={cn('w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                          item.ok ? 'bg-emerald-900/60 border border-emerald-600/60' : 'bg-slate-800 border border-slate-600')}>
                          {item.ok ? <Check size={11} className="text-emerald-400" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className={cn('text-xs font-medium', item.ok ? 'text-slate-200' : 'text-slate-400')}>{item.label}</p>
                          <p className="text-[10px] text-slate-600 truncate">{item.desc}</p>

                          {/* Certs: lista de archivos subidos */}
                          {isCerts && certs.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {certs.map((cert) => (
                                <div key={cert.id} className="flex items-center gap-1.5">
                                  <FileText size={9} className="text-slate-600 flex-shrink-0" />
                                  <span className="text-[9px] text-slate-500 truncate max-w-[180px]">{cert.original_name}</span>
                                  {cert.drive_status === 'synced'    && <Cloud size={9} className="text-emerald-500 flex-shrink-0" />}
                                  {cert.drive_status === 'uploading' && <Loader2 size={9} className="text-blue-400 animate-spin flex-shrink-0" />}
                                  <button onClick={() => deleteCert.mutate(cert.id)}
                                    className="text-slate-700 hover:text-red-400 transition-colors flex-shrink-0">
                                    <X size={9} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Acciones: upload para todos los ítems */}
                        <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                          {!isCerts && item.driveStatus === 'synced'    && <Cloud size={11} className="text-emerald-400" />}
                          {!isCerts && item.driveStatus === 'uploading' && <Loader2 size={11} className="text-blue-400 animate-spin" />}
                          {!isCerts && item.driveStatus === 'error'     && <AlertCircle size={11} className="text-red-400" />}

                          {isCerts ? (
                            /* Certs: botón agregar (permite múltiples) */
                            <button
                              onClick={handleSelectFile}
                              disabled={uploadCert.isPending}
                              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 disabled:opacity-50 transition-colors"
                            >
                              {uploadCert.isPending ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                              {certs.length > 0 ? 'Agregar' : 'Subir'}
                            </button>
                          ) : item.ok ? (
                            <>
                              <button onClick={() => getApi(item.key)?.open(imp.id)}
                                className="p-1 rounded text-slate-500 hover:text-cyan-400 hover:bg-slate-700 transition-colors" title="Abrir">
                                <FolderOpen size={11} />
                              </button>
                              <button onClick={() => handleUploadDoc(item.key)}
                                className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors" title="Reemplazar">
                                <Upload size={11} />
                              </button>
                              <button onClick={() => handleDeleteDoc(item.key)}
                                className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors" title="Eliminar">
                                <Trash2 size={11} />
                              </button>
                            </>
                          ) : (
                            <button onClick={() => handleUploadDoc(item.key)} disabled={isUploadingDoc(item.key)}
                              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 disabled:opacity-50 transition-colors">
                              {isUploadingDoc(item.key) ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
                              Subir
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

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
                      ) : s === 'vep_pagado' && (current || done) ? (
                        <Receipt size={11} />
                      ) : s === 'mail_enviado' && (current || done) ? (
                        <Mail size={11} />
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

          {/* ── Comprobantes VEP ANMAT ── */}
          {showVeps && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">
                  Comprobantes VEP ANMAT
                </p>
                {veps.length > 0 && (
                  <span className="text-[10px] text-violet-300 font-medium">
                    Total: ${vepTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>

              {/* Drop zone */}
              <div
                onDragEnter={(e) => { e.preventDefault(); dragCounterVep.current++; setIsDragOverVep(true) }}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={() => { dragCounterVep.current--; if (dragCounterVep.current === 0) setIsDragOverVep(false) }}
                onDrop={handleDropVep}
                onClick={!vepUploading ? handleSelectVeps : undefined}
                className={cn(
                  'border-2 border-dashed rounded-lg px-4 py-5 flex flex-col items-center gap-1.5 transition-colors',
                  vepUploading
                    ? 'border-violet-600/50 bg-violet-900/10 cursor-default'
                    : isDragOverVep
                      ? 'border-violet-500 bg-violet-900/20 cursor-copy'
                      : 'border-slate-600 hover:border-violet-500 hover:bg-violet-900/10 cursor-pointer'
                )}
              >
                {vepUploading ? (
                  <>
                    <Loader2 size={16} className="animate-spin text-violet-400" />
                    <p className="text-xs text-violet-300 font-medium">
                      {vepUploadProgress
                        ? `Subiendo ${vepUploadProgress.current} de ${vepUploadProgress.total}...`
                        : 'Subiendo...'}
                    </p>
                  </>
                ) : isDragOverVep ? (
                  <>
                    <Upload size={16} className="text-violet-400" />
                    <p className="text-xs text-violet-300 font-medium">Soltar para subir</p>
                  </>
                ) : (
                  <>
                    <Receipt size={16} className="text-slate-500" />
                    <p className="text-xs text-slate-400">
                      Arrastrá uno o varios comprobantes VEP
                    </p>
                    <p className="text-[10px] text-slate-600">o hacé click para seleccionar</p>
                    {imp.drive_folder_id && (
                      <p className="text-[10px] text-slate-600 mt-0.5">Se subirán a la carpeta "VEP ANMAT" en Drive</p>
                    )}
                  </>
                )}
              </div>

              {/* Lista de VEPs */}
              {veps.length > 0 && (
                <div className="space-y-1">
                  {veps.map((vep: import('@shared/types').ComexInalVep) => (
                    <div key={vep.id} className="flex items-center gap-2 px-3 py-2 bg-slate-700/40 rounded-lg group">
                      <Receipt size={12} className="text-violet-400 flex-shrink-0" />
                      <span className="flex-1 text-xs text-slate-300 truncate">{vep.original_name}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {vep.ai_status === 'processing' && (
                          <span className="flex items-center gap-1 text-[10px] text-amber-400">
                            <Loader2 size={10} className="animate-spin" /> Extrayendo...
                          </span>
                        )}
                        {vep.ai_status === 'done' && vep.importe_total != null && (
                          <span className="text-[10px] text-violet-300 font-medium">
                            ${vep.importe_total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </span>
                        )}
                        {vep.ai_status === 'error' && (
                          <span className="text-[10px] text-red-400">Error IA</span>
                        )}
                        {vep.drive_status === 'synced' && <Cloud size={11} className="text-emerald-400" />}
                        {vep.drive_status === 'uploading' && <Loader2 size={11} className="text-cyan-400 animate-spin" />}
                        {vep.drive_status === 'error' && <CloudOff size={11} className="text-red-400" />}
                      </div>
                      <button
                        onClick={() => deleteVep.mutate(vep.id)}
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
