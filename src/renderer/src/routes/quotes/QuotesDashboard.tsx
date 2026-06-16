import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, Plus, X, AlertTriangle, Calendar,
  List, Columns3, Clock, BarChart2, ArrowRight, Building2,
  CheckCircle2
} from 'lucide-react'
import dayjs from 'dayjs'
import {
  useQuotes,
  useQuoteCompanies,
  useCreateQuote,
  useUpdateQuote,
  useCreateQuoteCompany,
  useQuoteKPIs
} from '../../hooks/useQuotes'
import { useAuthSession } from '../../hooks/useCalendar'
import type { Quote, QuoteStatus, QuotePriority, CreateQuoteInput } from '@shared/types'
import {
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_COLORS,
  QUOTE_PRIORITY_LABELS,
  QUOTE_PRIORITY_COLORS,
  QUOTE_CHANNEL_LABELS
} from '@shared/types'

// ── Kanban columns (estados activos) ─────────────────────────────────────────

const KANBAN_COLUMNS: { status: QuoteStatus; label: string }[] = [
  { status: 'new',         label: 'Nuevo' },
  { status: 'analysis',    label: 'En Análisis' },
  { status: 'elaborating', label: 'Elaborando' },
  { status: 'sent',        label: 'Enviado' },
  { status: 'follow_up',   label: 'Seguimiento' }
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatValue(v: number | null | undefined): string {
  if (v == null) return '—'
  return '$' + v.toLocaleString('es-AR', { minimumFractionDigits: 0 })
}

function slaLabel(slaMs: number | null): { text: string; urgent: boolean } {
  if (!slaMs) return { text: '', urgent: false }
  const diff = slaMs - Date.now()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  if (diff < 0) return { text: `Vencido (${Math.abs(days)}d)`, urgent: true }
  if (days <= 1) return { text: `Vence hoy`, urgent: true }
  if (days <= 3) return { text: `${days}d SLA`, urgent: true }
  return { text: `${days}d SLA`, urgent: false }
}

// ── Priority Badge ────────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: QuotePriority }) {
  return (
    <span
      className="text-[10px] font-bold px-1.5 py-0.5 rounded"
      style={{
        background: QUOTE_PRIORITY_COLORS[priority] + '22',
        color: QUOTE_PRIORITY_COLORS[priority],
        border: `1px solid ${QUOTE_PRIORITY_COLORS[priority]}44`
      }}
    >
      {priority.toUpperCase()}
    </span>
  )
}

// ── Quote Card (Kanban) ───────────────────────────────────────────────────────

function QuoteCard({
  quote,
  companyName,
  onClick
}: {
  quote: Quote
  companyName: string
  onClick: () => void
}) {
  const { text: slaText, urgent } = slaLabel(quote.sla_due_at)

  return (
    <div
      onClick={onClick}
      className="bg-slate-800 border border-slate-700 rounded-xl p-3 cursor-pointer hover:border-violet-500/60 hover:bg-slate-750 transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-white leading-snug group-hover:text-violet-300 transition-colors line-clamp-2 flex-1">
          {quote.title}
        </p>
        <PriorityBadge priority={quote.priority as QuotePriority} />
      </div>

      {companyName && (
        <div className="flex items-center gap-1.5 mb-2">
          <Building2 size={11} className="text-slate-500 flex-shrink-0" />
          <span className="text-xs text-slate-400 truncate">{companyName}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mt-2">
        <span className="text-xs text-slate-400 font-medium">
          {formatValue(quote.estimated_value)}
        </span>

        {slaText && (
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
              urgent
                ? 'bg-red-900/40 text-red-400 border border-red-700/40'
                : 'bg-slate-700/60 text-slate-400'
            }`}
          >
            {slaText}
          </span>
        )}
      </div>

      {quote.next_follow_up_at && (
        <div className="flex items-center gap-1.5 mt-1.5">
          <Clock size={10} className="text-slate-500" />
          <span className="text-[10px] text-slate-500">
            Seguimiento: {dayjs(quote.next_follow_up_at).format('DD/MM')}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Kanban View ───────────────────────────────────────────────────────────────

function KanbanView({
  quotes,
  companyMap,
  onCardClick,
  onStatusDrop
}: {
  quotes: Quote[]
  companyMap: Record<string, string>
  onCardClick: (id: string) => void
  onStatusDrop: (id: string, status: QuoteStatus) => void
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<QuoteStatus | null>(null)

  const byStatus = useMemo(() => {
    const m: Record<QuoteStatus, Quote[]> = {} as Record<QuoteStatus, Quote[]>
    for (const col of KANBAN_COLUMNS) m[col.status] = []
    for (const q of quotes) {
      if (m[q.status]) m[q.status].push(q)
    }
    return m
  }, [quotes])

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-0">
      {KANBAN_COLUMNS.map((col) => (
        <div
          key={col.status}
          className={`flex-shrink-0 w-64 flex flex-col rounded-xl border transition-colors ${
            overCol === col.status
              ? 'border-violet-500/60 bg-violet-900/10'
              : 'border-slate-700 bg-slate-800/40'
          }`}
          onDragOver={(e) => { e.preventDefault(); setOverCol(col.status) }}
          onDragLeave={() => setOverCol(null)}
          onDrop={(e) => {
            e.preventDefault()
            setOverCol(null)
            if (dragId && dragId !== col.status) onStatusDrop(dragId, col.status)
            setDragId(null)
          }}
        >
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-700/60">
            <span className="text-xs font-semibold text-slate-300">{col.label}</span>
            <span className="text-xs text-slate-500 bg-slate-700/60 rounded-full px-1.5 py-0.5">
              {byStatus[col.status].length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {byStatus[col.status].map((q) => (
              <div
                key={q.id}
                draggable
                onDragStart={() => setDragId(q.id)}
                onDragEnd={() => setDragId(null)}
                className={dragId === q.id ? 'opacity-50' : ''}
              >
                <QuoteCard
                  quote={q}
                  companyName={companyMap[q.company_id] ?? ''}
                  onClick={() => onCardClick(q.id)}
                />
              </div>
            ))}
            {byStatus[col.status].length === 0 && (
              <p className="text-xs text-slate-600 text-center py-4">Sin presupuestos</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── List View ─────────────────────────────────────────────────────────────────

function ListView({
  quotes,
  companyMap,
  onRowClick
}: {
  quotes: Quote[]
  companyMap: Record<string, string>
  onRowClick: (id: string) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left text-xs text-slate-400 font-medium py-2 px-3">Pri.</th>
            <th className="text-left text-xs text-slate-400 font-medium py-2 px-3">Título</th>
            <th className="text-left text-xs text-slate-400 font-medium py-2 px-3">Empresa</th>
            <th className="text-left text-xs text-slate-400 font-medium py-2 px-3">Canal</th>
            <th className="text-left text-xs text-slate-400 font-medium py-2 px-3">Valor est.</th>
            <th className="text-left text-xs text-slate-400 font-medium py-2 px-3">Estado</th>
            <th className="text-left text-xs text-slate-400 font-medium py-2 px-3">SLA</th>
            <th className="text-left text-xs text-slate-400 font-medium py-2 px-3">Seguimiento</th>
          </tr>
        </thead>
        <tbody>
          {quotes.map((q) => {
            const { text: slaText, urgent } = slaLabel(q.sla_due_at)
            return (
              <tr
                key={q.id}
                onClick={() => onRowClick(q.id)}
                className="border-b border-slate-800 hover:bg-slate-800/60 cursor-pointer transition-colors"
              >
                <td className="py-2 px-3">
                  <PriorityBadge priority={q.priority as QuotePriority} />
                </td>
                <td className="py-2 px-3 text-white font-medium max-w-[200px] truncate">
                  {q.title}
                </td>
                <td className="py-2 px-3 text-slate-400 text-xs">
                  {companyMap[q.company_id] ?? '—'}
                </td>
                <td className="py-2 px-3 text-slate-400 text-xs">
                  {QUOTE_CHANNEL_LABELS[q.channel] ?? q.channel}
                </td>
                <td className="py-2 px-3 text-slate-300 text-xs font-medium">
                  {formatValue(q.estimated_value)}
                </td>
                <td className="py-2 px-3">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      background: QUOTE_STATUS_COLORS[q.status] + '22',
                      color: QUOTE_STATUS_COLORS[q.status]
                    }}
                  >
                    {QUOTE_STATUS_LABELS[q.status]}
                  </span>
                </td>
                <td className="py-2 px-3">
                  {slaText && (
                    <span className={`text-xs ${urgent ? 'text-red-400' : 'text-slate-500'}`}>
                      {slaText}
                    </span>
                  )}
                </td>
                <td className="py-2 px-3 text-slate-400 text-xs">
                  {q.next_follow_up_at ? dayjs(q.next_follow_up_at).format('DD/MM/YY') : '—'}
                </td>
              </tr>
            )
          })}
          {quotes.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center py-12 text-slate-500 text-sm">
                Sin presupuestos para mostrar
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ── Agenda View ───────────────────────────────────────────────────────────────

function AgendaView({
  quotes,
  companyMap,
  onItemClick
}: {
  quotes: Quote[]
  companyMap: Record<string, string>
  onItemClick: (id: string) => void
}) {
  const followUpToday = quotes.filter(
    (q) => q.next_follow_up_at && q.next_follow_up_at <= dayjs().endOf('day').valueOf()
  )
  const slaAlert = quotes.filter(
    (q) => q.sla_due_at && q.sla_due_at < Date.now() + 3 * 24 * 60 * 60 * 1000 &&
    ['new','analysis','elaborating','sent','follow_up'].includes(q.status)
  )

  const AgendaCard = ({ quote, tag }: { quote: Quote; tag: string }) => (
    <div
      onClick={() => onItemClick(quote.id)}
      className="flex items-center gap-3 p-3 bg-slate-800 border border-slate-700 rounded-xl hover:border-violet-500/60 cursor-pointer transition-colors"
    >
      <PriorityBadge priority={quote.priority as QuotePriority} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate">{quote.title}</p>
        <p className="text-xs text-slate-400">{companyMap[quote.company_id] ?? ''}</p>
      </div>
      <span className="text-xs text-slate-500 px-2 py-0.5 rounded-full bg-slate-700/60">
        {tag}
      </span>
      <ArrowRight size={14} className="text-slate-600" />
    </div>
  )

  if (followUpToday.length === 0 && slaAlert.length === 0) {
    return (
      <div className="text-center py-16">
        <CheckCircle2 size={40} className="text-emerald-600 mx-auto mb-3" />
        <p className="text-slate-400 font-medium">Todo al día</p>
        <p className="text-slate-500 text-sm mt-1">No hay seguimientos pendientes ni alertas SLA</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {followUpToday.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Clock size={12} /> Seguimientos para hoy ({followUpToday.length})
          </h3>
          <div className="space-y-2">
            {followUpToday.map((q) => (
              <AgendaCard
                key={q.id}
                quote={q}
                tag={q.next_follow_up_at ? dayjs(q.next_follow_up_at).format('DD/MM') : ''}
              />
            ))}
          </div>
        </div>
      )}
      {slaAlert.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <AlertTriangle size={12} /> Alertas SLA ({slaAlert.length})
          </h3>
          <div className="space-y-2">
            {slaAlert.map((q) => {
              const { text } = slaLabel(q.sla_due_at)
              return <AgendaCard key={q.id} quote={q} tag={text} />
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── KPIs View ─────────────────────────────────────────────────────────────────

function KPIsView() {
  const { data: kpis, isLoading } = useQuoteKPIs()

  if (isLoading) return <div className="text-center py-12 text-slate-500 text-sm">Cargando...</div>
  if (!kpis) return null

  const pipeline = ['new', 'analysis', 'elaborating', 'sent', 'follow_up'] as QuoteStatus[]
  const pipelineCount = pipeline.reduce((s, st) => s + (kpis.byStatus[st] ?? 0), 0)
  const closedCount = (kpis.byStatus.won ?? 0) + (kpis.byStatus.lost ?? 0)
  const winRate = closedCount > 0 ? Math.round(((kpis.byStatus.won ?? 0) / closedCount) * 100) : null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'En pipeline', value: pipelineCount, sub: `${kpis.total} total`, color: 'text-violet-400' },
          { label: 'Valor pipeline', value: '$' + (kpis.pipelineValue).toLocaleString('es-AR', { maximumFractionDigits: 0 }), sub: 'estimado', color: 'text-cyan-400' },
          { label: 'Tasa de cierre', value: winRate !== null ? `${winRate}%` : '—', sub: `${kpis.byStatus.won ?? 0} ganados / ${kpis.lostCount} perdidos`, color: 'text-emerald-400' },
          { label: 'Días promedio', value: kpis.avgDaysOpen !== null ? `${kpis.avgDaysOpen}d` : '—', sub: 'hasta cierre (ganados)', color: 'text-amber-400' }
        ].map((item) => (
          <div key={item.label} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-400 mb-1">{item.label}</p>
            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{item.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Distribución por estado</h3>
        <div className="space-y-2">
          {(Object.entries(kpis.byStatus) as [QuoteStatus, number][])
            .filter(([, count]) => count > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([status, count]) => (
              <div key={status} className="flex items-center gap-3">
                <div className="w-24 text-xs text-slate-400 flex-shrink-0">{QUOTE_STATUS_LABELS[status]}</div>
                <div className="flex-1 bg-slate-700 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${kpis.total > 0 ? (count / kpis.total) * 100 : 0}%`,
                      background: QUOTE_STATUS_COLORS[status]
                    }}
                  />
                </div>
                <span className="text-xs text-slate-400 w-6 text-right">{count}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

// ── Quick Create Modal ────────────────────────────────────────────────────────

function QuickCreateModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const { data: session } = useAuthSession()
  const { data: companies = [] } = useQuoteCompanies()
  const createQuote = useCreateQuote()
  const createCompany = useCreateQuoteCompany()

  const [title, setTitle]     = useState('')
  const [priority, setPriority] = useState<QuotePriority>('p3')
  const [channel, setChannel]   = useState('email')
  const [companyId, setCompanyId] = useState('')
  const [newCompanyName, setNewCompanyName] = useState('')
  const [addingCompany, setAddingCompany] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true)
    try {
      let finalCompanyId = companyId
      if (addingCompany && newCompanyName.trim()) {
        const company = await createCompany.mutateAsync({ name: newCompanyName.trim() })
        finalCompanyId = company.id
      }
      const userId = session?.userId ?? ''
      const data: CreateQuoteInput = {
        title: title.trim(),
        priority,
        channel: channel as CreateQuoteInput['channel'],
        company_id: finalCompanyId || undefined
      }
      const quote = await createQuote.mutateAsync({ data, userId })
      onClose()
      navigate(`/quotes/${quote.id}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h2 className="font-semibold text-white text-sm flex items-center gap-2">
            <FileText size={15} className="text-violet-400" />
            Nuevo presupuesto
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Título / Pedido *</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Presupuesto mochilas outdoor x200"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Prioridad</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as QuotePriority)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              >
                {(['p1','p2','p3','p4'] as QuotePriority[]).map((p) => (
                  <option key={p} value={p}>{QUOTE_PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Canal</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              >
                {Object.entries(QUOTE_CHANNEL_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Empresa / Cliente</label>
            {!addingCompany ? (
              <div className="flex gap-2">
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                >
                  <option value="">Sin empresa</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setAddingCompany(true)}
                  className="px-3 py-2 rounded-lg border border-slate-600 text-slate-400 hover:border-violet-500 hover:text-violet-400 text-xs transition-colors"
                >
                  <Plus size={13} />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="Nombre de la empresa"
                  className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                />
                <button
                  type="button"
                  onClick={() => { setAddingCompany(false); setNewCompanyName('') }}
                  className="px-3 py-2 rounded-lg border border-slate-600 text-slate-400 hover:text-white text-xs transition-colors"
                >
                  <X size={13} />
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:bg-slate-700 transition-colors">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 transition-colors"
            >
              {saving ? 'Creando...' : <>Crear y abrir <ArrowRight size={14} /></>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Filter Bar ────────────────────────────────────────────────────────────────

type DashboardTab = 'pipeline' | 'list' | 'agenda' | 'kpis'

// ── Main Component ────────────────────────────────────────────────────────────

export default function QuotesDashboard() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<DashboardTab>('pipeline')
  const [showCreate, setShowCreate] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')

  const filters = useMemo(() => {
    const f: { status?: string; priority?: string } = {}
    if (statusFilter) f.status = statusFilter
    if (priorityFilter) f.priority = priorityFilter
    return Object.keys(f).length > 0 ? f : undefined
  }, [statusFilter, priorityFilter])

  const { data: quotes = [], isLoading } = useQuotes(filters)
  const { data: companies = [] }         = useQuoteCompanies()
  const updateQuote = useUpdateQuote()
  const { data: session } = useAuthSession()

  const companyMap = useMemo(() =>
    Object.fromEntries(companies.map((c) => [c.id, c.name])),
    [companies]
  )

  const activeQuotes = quotes.filter((q) =>
    ['new','analysis','elaborating','sent','follow_up'].includes(q.status)
  )

  const handleStatusDrop = (id: string, status: QuoteStatus) => {
    const userId = session?.userId ?? ''
    updateQuote.mutate({ id, data: { status }, userId })
  }

  const tabs = [
    { key: 'pipeline' as DashboardTab, label: 'Pipeline', icon: Columns3 },
    { key: 'list'     as DashboardTab, label: 'Lista',    icon: List },
    { key: 'agenda'   as DashboardTab, label: 'Agenda',   icon: Calendar },
    { key: 'kpis'     as DashboardTab, label: 'KPIs',     icon: BarChart2 }
  ]

  return (
    <div className="flex-1 overflow-hidden flex flex-col p-6 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <FileText size={22} className="text-violet-400" />
          <div>
            <h1 className="text-lg font-bold text-white">Presupuestos</h1>
            <p className="text-xs text-slate-400">Pipeline de cotizaciones</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Nuevo presupuesto
        </button>
      </div>

      {/* Tabs + Filters */}
      <div className="flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex bg-slate-800 border border-slate-700 rounded-xl p-1 gap-1">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === key
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {tab !== 'kpis' && tab !== 'agenda' && (
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-violet-500"
            >
              <option value="">Todos los estados</option>
              {Object.entries(QUOTE_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-violet-500"
            >
              <option value="">Todas las prioridades</option>
              {(['p1','p2','p3','p4'] as QuotePriority[]).map((p) => (
                <option key={p} value={p}>{QUOTE_PRIORITY_LABELS[p]}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12 text-slate-500 text-sm">Cargando...</div>
        ) : tab === 'pipeline' ? (
          <KanbanView
            quotes={activeQuotes}
            companyMap={companyMap}
            onCardClick={(id) => navigate(`/quotes/${id}`)}
            onStatusDrop={handleStatusDrop}
          />
        ) : tab === 'list' ? (
          <div className="overflow-y-auto h-full">
            <ListView
              quotes={quotes}
              companyMap={companyMap}
              onRowClick={(id) => navigate(`/quotes/${id}`)}
            />
          </div>
        ) : tab === 'agenda' ? (
          <div className="overflow-y-auto h-full">
            <AgendaView
              quotes={quotes}
              companyMap={companyMap}
              onItemClick={(id) => navigate(`/quotes/${id}`)}
            />
          </div>
        ) : (
          <div className="overflow-y-auto h-full">
            <KPIsView />
          </div>
        )}
      </div>

      {showCreate && <QuickCreateModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
