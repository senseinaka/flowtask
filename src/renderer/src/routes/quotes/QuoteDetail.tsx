import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Building2, Phone, Mail, Globe, ChevronDown,
  Check, X, Clock, MessageSquare, AlertTriangle, DollarSign,
  User, Send, FileText, Edit2
} from 'lucide-react'
import dayjs from 'dayjs'
import {
  useQuote,
  useUpdateQuote,
  useDeleteQuote,
  useQuoteActivities,
  useAddQuoteActivity,
  useQuoteCompanies,
  useQuoteContacts
} from '../../hooks/useQuotes'
import { useAuthSession } from '../../hooks/useCalendar'
import QuoteNotePanel from './QuoteNotePanel'
import type {
  Quote,
  QuoteStatus,
  QuotePriority,
  QuoteActivityType,
  UpdateQuoteInput
} from '@shared/types'
import {
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_COLORS,
  QUOTE_PRIORITY_LABELS,
  QUOTE_PRIORITY_COLORS,
  QUOTE_CHANNEL_LABELS
} from '@shared/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatValue(v: number | null | undefined): string {
  if (v == null) return '—'
  return '$' + v.toLocaleString('es-AR', { minimumFractionDigits: 0 })
}

function parsePayload(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw) } catch { return {} }
}

// ── Status Dropdown ───────────────────────────────────────────────────────────

function StatusDropdown({
  current,
  onChange
}: {
  current: QuoteStatus
  onChange: (s: QuoteStatus) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const statuses: QuoteStatus[] = ['new','analysis','elaborating','sent','follow_up','won','lost','archived','postponed']

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors"
        style={{
          background: QUOTE_STATUS_COLORS[current] + '22',
          color: QUOTE_STATUS_COLORS[current],
          borderColor: QUOTE_STATUS_COLORS[current] + '44'
        }}
      >
        {QUOTE_STATUS_LABELS[current]}
        <ChevronDown size={13} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-20 py-1 min-w-[160px]">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => { onChange(s); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-700 transition-colors flex items-center gap-2"
              style={{ color: QUOTE_STATUS_COLORS[s] }}
            >
              {current === s && <Check size={12} />}
              {current !== s && <span className="w-3" />}
              {QUOTE_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Activity Timeline Item ────────────────────────────────────────────────────

function ActivityItem({
  type,
  payload: rawPayload,
  createdAt,
  userId: _userId
}: {
  type: QuoteActivityType
  payload: string
  createdAt: number
  userId: string
}) {
  const payload = parsePayload(rawPayload)
  const time = dayjs(createdAt).format('DD/MM HH:mm')

  const renderContent = () => {
    switch (type) {
      case 'comment':
        return (
          <div className="bg-slate-700/60 rounded-xl px-3 py-2 text-sm text-slate-200">
            {String(payload.text ?? '')}
          </div>
        )
      case 'status_change':
        return (
          <p className="text-xs text-slate-400">
            Cambió estado de{' '}
            <span style={{ color: QUOTE_STATUS_COLORS[payload.from as QuoteStatus] }}>
              {QUOTE_STATUS_LABELS[payload.from as QuoteStatus] ?? String(payload.from)}
            </span>
            {' → '}
            <span style={{ color: QUOTE_STATUS_COLORS[payload.to as QuoteStatus] }}>
              {QUOTE_STATUS_LABELS[payload.to as QuoteStatus] ?? String(payload.to)}
            </span>
          </p>
        )
      case 'assignment':
        return (
          <p className="text-xs text-slate-400">
            Asignó responsable: <span className="text-slate-300">{String(payload.to || '—')}</span>
          </p>
        )
      case 'value_update':
        return (
          <p className="text-xs text-slate-400">
            Actualizó valor: <span className="text-slate-300">{formatValue(payload.from as number)}</span>
            {' → '}
            <span className="text-emerald-400">{formatValue(payload.to as number)}</span>
          </p>
        )
      case 'follow_up_set':
        return (
          <p className="text-xs text-slate-400">
            Próximo seguimiento:{' '}
            <span className="text-slate-300">
              {payload.date ? dayjs(payload.date as number).format('DD/MM/YYYY') : '—'}
            </span>
          </p>
        )
      case 'lost_reason_set':
        return (
          <p className="text-xs text-slate-400">
            Motivo de pérdida: <span className="text-red-400">{String(payload.reason ?? '')}</span>
          </p>
        )
      case 'system':
        return (
          <p className="text-xs text-slate-500 italic">{String(payload.text ?? '')}</p>
        )
      default:
        return <p className="text-xs text-slate-500">{type}</p>
    }
  }

  const isComment = type === 'comment'

  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 mt-1">
        {isComment ? (
          <div className="w-7 h-7 rounded-full bg-violet-700/50 border border-violet-600/50 flex items-center justify-center">
            <MessageSquare size={12} className="text-violet-300" />
          </div>
        ) : (
          <div className="w-7 h-7 rounded-full bg-slate-700/60 border border-slate-600/40 flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        {renderContent()}
        <p className="text-[10px] text-slate-600 mt-1">{time}</p>
      </div>
    </div>
  )
}

// ── Lost Reason Modal ─────────────────────────────────────────────────────────

function LostReasonModal({
  onConfirm,
  onCancel
}: {
  onConfirm: (reason: string) => void
  onCancel: () => void
}) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-sm p-6 space-y-4">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-400" />
          Motivo de pérdida
        </h3>
        <textarea
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="¿Por qué se perdió este presupuesto?"
          rows={3}
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 resize-none"
        />
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:bg-slate-700 transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => reason.trim() && onConfirm(reason.trim())}
            disabled={!reason.trim()}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-red-700 hover:bg-red-600 text-white disabled:opacity-50 transition-colors"
          >
            Confirmar pérdida
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Editable Field ────────────────────────────────────────────────────────────

function EditableField({
  label,
  value,
  onSave,
  type = 'text',
  placeholder
}: {
  label: string
  value: string | number | null | undefined
  onSave: (v: string) => void
  type?: 'text' | 'number' | 'date' | 'textarea'
  placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value ?? ''))

  useEffect(() => { setDraft(String(value ?? '')) }, [value])

  const handleSave = () => {
    setEditing(false)
    if (draft !== String(value ?? '')) onSave(draft)
  }

  const displayVal = type === 'date' && value
    ? dayjs(Number(value)).format('DD/MM/YYYY')
    : value

  return (
    <div>
      <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      {editing ? (
        <div className="flex gap-2">
          {type === 'textarea' ? (
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={handleSave}
              rows={3}
              className="flex-1 bg-slate-700 border border-violet-500 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none resize-none"
            />
          ) : (
            <input
              autoFocus
              type={type === 'date' ? 'date' : type}
              value={type === 'date' && draft ? dayjs(Number(draft)).format('YYYY-MM-DD') : draft}
              onChange={(e) => {
                if (type === 'date') {
                  setDraft(e.target.value ? String(dayjs(e.target.value).valueOf()) : '')
                } else {
                  setDraft(e.target.value)
                }
              }}
              onBlur={handleSave}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
              className="flex-1 bg-slate-700 border border-violet-500 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none"
            />
          )}
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="w-full text-left text-sm text-slate-300 hover:text-white group flex items-center gap-1"
        >
          <span className={!displayVal ? 'text-slate-600 italic' : ''}>
            {displayVal || placeholder || 'Sin valor'}
          </span>
          <Edit2 size={11} className="opacity-0 group-hover:opacity-100 text-slate-500 transition-opacity ml-1" />
        </button>
      )}
    </div>
  )
}

// ── Value with IVA Field ──────────────────────────────────────────────────────

function ValueWithIvaField({
  label,
  value,
  onSave,
}: {
  label: string
  value: number | null | undefined
  onSave: (v: number | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(String(value ?? ''))

  useEffect(() => { setDraft(String(value ?? '')) }, [value])

  const handleSave = () => {
    setEditing(false)
    const parsed = draft ? parseFloat(draft) : null
    if (parsed !== (value ?? null)) onSave(parsed)
  }

  const withIva = value != null ? Math.round(value * 1.21 * 100) / 100 : null

  return (
    <div>
      <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      {editing ? (
        <div className="flex items-center gap-1">
          <span className="text-sm text-slate-400">$</span>
          <input
            autoFocus
            type="number"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
            className="flex-1 bg-slate-700 border border-violet-500 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none"
          />
          <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">+ IVA</span>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="w-full text-left group flex items-center gap-1"
        >
          <span className="text-sm text-slate-400 shrink-0">$</span>
          <span className={`text-sm flex-1 ${value == null ? 'text-slate-600 italic' : 'text-slate-300 hover:text-white'}`}>
            {value != null ? value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : 'Sin valor'}
          </span>
          {value != null && <span className="text-[11px] text-slate-600 shrink-0">+ IVA</span>}
          <Edit2 size={11} className="opacity-0 group-hover:opacity-100 text-slate-500 transition-opacity ml-1 shrink-0" />
        </button>
      )}
      {withIva != null && (
        <p className="text-[11px] text-slate-600 mt-0.5 pl-1">
          Con IVA: <span className="text-slate-400">${withIva.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
        </p>
      )}
    </div>
  )
}

// ── Follow-up Days Field ──────────────────────────────────────────────────────

const QUICK_DAYS = [1, 3, 7, 14, 28]

function FollowUpDaysField({
  value,
  onSave,
}: {
  value: number | null | undefined
  onSave: (v: number | null) => void
}) {
  const [customDays, setCustomDays] = useState('')

  const setDays = (days: number) => {
    onSave(Date.now() + days * 24 * 60 * 60 * 1000)
    setCustomDays('')
  }

  const handleCustom = () => {
    const d = parseInt(customDays)
    if (!isNaN(d) && d > 0) setDays(d)
    setCustomDays('')
  }

  const now       = Date.now()
  const isOverdue = value != null && value < now
  const isDueToday = value != null && value >= now && value < now + 24 * 60 * 60 * 1000
  const isDueSoon  = value != null && !isOverdue && !isDueToday && value < now + 3 * 24 * 60 * 60 * 1000

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <label className="text-[10px] text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Clock size={10}/> Próximo seguimiento
        </label>
        {isOverdue  && <span className="text-[9px] text-red-400 bg-red-900/30 px-1.5 py-0.5 rounded-full border border-red-800/40">Vencido</span>}
        {isDueToday && <span className="text-[9px] text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded-full border border-amber-800/40">Hoy</span>}
        {isDueSoon  && <span className="text-[9px] text-yellow-400 bg-yellow-900/30 px-1.5 py-0.5 rounded-full border border-yellow-800/40">Pronto</span>}
      </div>

      <div className="flex flex-wrap gap-1 mb-2">
        {QUICK_DAYS.map(d => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className="text-[11px] px-2 py-1 rounded-lg bg-slate-800 text-slate-400 hover:bg-violet-900/40 hover:text-violet-300 border border-slate-700 hover:border-violet-700/60 transition-colors"
          >
            {d}d
          </button>
        ))}
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={customDays}
            onChange={(e) => setCustomDays(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCustom() }}
            onBlur={handleCustom}
            placeholder="…"
            min={1}
            className="w-12 bg-slate-800 border border-slate-700 rounded-lg px-1.5 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-violet-500 text-center"
          />
          <span className="text-[11px] text-slate-600">días</span>
        </div>
      </div>

      {value != null ? (
        <div className="flex items-center gap-2">
          <p className={`text-[12px] ${isOverdue ? 'text-red-400' : isDueToday ? 'text-amber-400' : 'text-slate-400'}`}>
            {dayjs(value).format('DD/MM/YYYY')}
          </p>
          <button
            onClick={() => onSave(null)}
            className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors leading-none"
          >
            ×
          </button>
        </div>
      ) : (
        <p className="text-[11px] text-slate-600 italic">Sin fecha programada</p>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function QuoteDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: session } = useAuthSession()
  const userId = session?.userId ?? ''

  const { data: quote, isLoading } = useQuote(id)
  const { data: activities = [] }  = useQuoteActivities(id)
  const { data: companies = [] }   = useQuoteCompanies()
  const { data: contacts = [] }    = useQuoteContacts(quote?.company_id)

  const updateQuote      = useUpdateQuote()
  const deleteQuote      = useDeleteQuote()
  const addActivity      = useAddQuoteActivity()

  const [commentText, setCommentText]       = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [showLostModal, setShowLostModal]   = useState(false)
  const [confirmDelete, setConfirmDelete]   = useState(false)
  const [pendingStatus, setPendingStatus]   = useState<QuoteStatus | null>(null)
  const [rightTab, setRightTab]             = useState<'activity' | 'notes'>('activity')

  const activitiesEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    activitiesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activities.length])

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-slate-500 text-sm">Cargando...</p>
    </div>
  )
  if (!quote) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3">
      <FileText size={40} className="text-slate-600" />
      <p className="text-slate-400">Presupuesto no encontrado</p>
      <button onClick={() => navigate('/quotes')} className="text-violet-400 text-sm hover:underline">
        Volver a Presupuestos
      </button>
    </div>
  )

  const company = companies.find((c) => c.id === quote.company_id)
  const contact = contacts.find((c) => c.id === quote.contact_id)

  const update = (data: UpdateQuoteInput) => {
    updateQuote.mutate({ id: quote.id, data, userId })
  }

  const handleStatusChange = (status: QuoteStatus) => {
    if (status === 'lost') {
      setPendingStatus(status)
      setShowLostModal(true)
    } else {
      update({ status })
    }
  }

  const handleLostConfirm = (reason: string) => {
    update({ status: pendingStatus ?? 'lost', lost_reason: reason })
    setShowLostModal(false)
    setPendingStatus(null)
  }

  const handleComment = async () => {
    if (!commentText.trim() || sendingComment) return
    setSendingComment(true)
    try {
      await addActivity.mutateAsync({
        quote_id: quote.id,
        user_id: userId,
        type: 'comment',
        payload: { text: commentText.trim() }
      })
      setCommentText('')
    } finally {
      setSendingComment(false)
    }
  }

  const handleDelete = async () => {
    await deleteQuote.mutateAsync(quote.id)
    navigate('/quotes')
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => navigate('/quotes')}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-base font-semibold text-white flex-1 truncate">{quote.title}</h1>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <StatusDropdown current={quote.status as QuoteStatus} onChange={handleStatusChange} />

          <select
            value={quote.priority}
            onChange={(e) => update({ priority: e.target.value as QuotePriority })}
            className="bg-transparent border rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none"
            style={{
              borderColor: QUOTE_PRIORITY_COLORS[quote.priority as QuotePriority] + '60',
              color: QUOTE_PRIORITY_COLORS[quote.priority as QuotePriority]
            }}
          >
            {(['p1','p2','p3','p4'] as QuotePriority[]).map((p) => (
              <option key={p} value={p}>{QUOTE_PRIORITY_LABELS[p]}</option>
            ))}
          </select>

          <select
            value={quote.channel}
            onChange={(e) => update({ channel: e.target.value as Quote['channel'] })}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-violet-500"
          >
            {Object.entries(QUOTE_CHANNEL_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          <span className="text-xs text-slate-500 ml-auto">
            Creado {dayjs(quote.created_at).format('DD/MM/YYYY')}
          </span>

          {confirmDelete ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-red-400">¿Eliminar?</span>
              <button onClick={handleDelete} className="p-1 rounded bg-red-700 hover:bg-red-600 text-white">
                <Check size={12} />
              </button>
              <button onClick={() => setConfirmDelete(false)} className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-white">
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-slate-600 hover:text-red-400 transition-colors px-2 py-1"
            >
              Eliminar
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden flex gap-0">
        {/* Left panel — data */}
        <div className="w-72 border-r border-slate-800 flex flex-col overflow-y-auto flex-shrink-0 p-4 space-y-5">

          {/* Title inline edit */}
          <div>
            <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">Título / Pedido</label>
            <EditableField
              label=""
              value={quote.title}
              onSave={(v) => update({ title: v })}
              placeholder="Título del presupuesto"
            />
          </div>

          {/* Company */}
          <div>
            <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Building2 size={10} /> Empresa / Cliente
            </label>
            <select
              value={quote.company_id}
              onChange={(e) => update({ company_id: e.target.value })}
              className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-violet-500"
            >
              <option value="">Sin empresa</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {company?.website && (
              <a href={company.website} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-violet-400 mt-1 transition-colors">
                <Globe size={10} /> {company.website.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>

          {/* Contact */}
          {quote.company_id && (
            <div>
              <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <User size={10} /> Contacto
              </label>
              <select
                value={quote.contact_id}
                onChange={(e) => update({ contact_id: e.target.value })}
                className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-violet-500"
              >
                <option value="">Sin contacto</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.role ? ` · ${c.role}` : ''}</option>
                ))}
              </select>
              {contact && (
                <div className="mt-1.5 space-y-0.5">
                  {contact.email && (
                    <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-violet-400 transition-colors">
                      <Mail size={10} /> {contact.email}
                    </a>
                  )}
                  {contact.phone && (
                    <p className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Phone size={10} /> {contact.phone}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Values */}
          <div className="space-y-3 border-t border-slate-800 pt-4">
            <label className="block text-[10px] text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign size={10} /> Valores
            </label>
            <ValueWithIvaField
              label="Valor estimado sin IVA"
              value={quote.estimated_value}
              onSave={(v) => update({ estimated_value: v })}
            />
            <ValueWithIvaField
              label="Valor presupuestado sin IVA"
              value={quote.budgeted_value}
              onSave={(v) => update({ budgeted_value: v })}
            />
            {(quote.status === 'won') && (
              <EditableField
                label="Valor ganado"
                value={quote.won_value}
                onSave={(v) => update({ won_value: v ? parseFloat(v) : null })}
                type="number"
                placeholder="$ 0"
              />
            )}
          </div>

          {/* Follow-up */}
          <div className="border-t border-slate-800 pt-4">
            <FollowUpDaysField
              value={quote.next_follow_up_at}
              onSave={(v) => update({ next_follow_up_at: v })}
            />
          </div>

          {/* Lost reason */}
          {quote.status === 'lost' && quote.lost_reason && (
            <div className="border-t border-slate-800 pt-4">
              <label className="block text-[10px] text-red-500 uppercase tracking-wider mb-1">Motivo de pérdida</label>
              <p className="text-sm text-slate-400">{quote.lost_reason}</p>
            </div>
          )}

          {/* Notes */}
          <div className="border-t border-slate-800 pt-4">
            <EditableField
              label="Notas internas"
              value={quote.notes}
              onSave={(v) => update({ notes: v })}
              type="textarea"
              placeholder="Agregar notas..."
            />
          </div>
        </div>

        {/* Right panel — tabs */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-slate-800 flex-shrink-0">
            <button
              onClick={() => setRightTab('activity')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 ${rightTab === 'activity' ? 'border-violet-500 text-violet-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
              <Clock size={11}/> Actividad
            </button>
            <button
              onClick={() => setRightTab('notes')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 ${rightTab === 'notes' ? 'border-teal-500 text-teal-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
              <FileText size={11}/> Notas y archivos
            </button>
          </div>

          {rightTab === 'notes' ? (
            <QuoteNotePanel quoteId={quote.id} userId={userId}/>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {activities.map((a) => (
                  <ActivityItem
                    key={a.id}
                    type={a.type as QuoteActivityType}
                    payload={a.payload}
                    createdAt={a.created_at}
                    userId={a.user_id}
                  />
                ))}
                {activities.length === 0 && (
                  <p className="text-center text-slate-600 text-sm py-8">Sin actividad aún</p>
                )}
                <div ref={activitiesEndRef} />
              </div>

              {/* Comment input */}
              <div className="px-5 py-3 border-t border-slate-800 flex-shrink-0">
                <div className="flex gap-2">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleComment()
                    }}
                    placeholder="Agregar comentario (Ctrl+Enter para enviar)..."
                    rows={2}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 resize-none"
                  />
                  <button
                    onClick={handleComment}
                    disabled={!commentText.trim() || sendingComment}
                    className="self-end p-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 transition-colors"
                  >
                    <Send size={15} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showLostModal && (
        <LostReasonModal
          onConfirm={handleLostConfirm}
          onCancel={() => { setShowLostModal(false); setPendingStatus(null) }}
        />
      )}
    </div>
  )
}
