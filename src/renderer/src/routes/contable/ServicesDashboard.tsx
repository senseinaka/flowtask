import { useMemo, useState } from 'react'
import {
  Repeat, Plus, Search, Pencil, Trash2, Ban, Receipt, ShieldCheck,
  CalendarClock, Wallet, RefreshCw, PlayCircle, ExternalLink,
} from 'lucide-react'
import { usePermissions } from '../../hooks/usePermissions'
import {
  useServices, useSetServiceStatus, useDeleteService,
} from '../../hooks/useAccountingServices'
import type {
  AccountingService, ServiceStatus, BillingFrequency,
} from '@shared/types'
import {
  CATEGORY_OPTIONS, STATUS_OPTIONS, STATUS_LABEL, STATUS_BADGE,
  FREQUENCY_OPTIONS, FREQUENCY_LABEL, MONTHS_PER_PERIOD, CURRENCY_OPTIONS,
  dueStatus, fmtMoney,
} from './services.constants'
import { useCatalog } from '../../hooks/useServiceCatalog'
import ServiceFormModal from './ServiceFormModal'
import ServicePaymentsModal from './ServicePaymentsModal'

// ─── Resumen ────────────────────────────────────────────────────────────────────

function computeSummary(services: AccountingService[]) {
  const active = services.filter(s => s.status === 'activo')
  const monthly: Record<string, number> = {}
  const annual: Record<string, number> = {}
  for (const s of active) {
    const m = MONTHS_PER_PERIOD[s.billing_frequency]
    if (!m) continue
    monthly[s.currency] = (monthly[s.currency] ?? 0) + s.amount / m
    annual[s.currency] = (annual[s.currency] ?? 0) + (s.amount * 12) / m
  }
  return {
    monthly, annual,
    activeCount: active.length,
    dueSoon: active.filter(s => ['overdue', 'd7', 'd15', 'd30'].includes(dueStatus(s.next_due_date).key)).length,
    overdue: active.filter(s => dueStatus(s.next_due_date).key === 'overdue').length,
    autoRenew: active.filter(s => s.auto_renewal === 1).length,
    insurance: active.filter(s => s.category === 'seguro').length,
  }
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ServicesDashboard() {
  const { canWrite } = usePermissions()
  const write = canWrite('contable')
  const { data: services = [], isLoading } = useServices()
  const setStatus = useSetServiceStatus()
  const del = useDeleteService()

  const { data: catalogCategories = [] } = useCatalog('category')

  const categoryLabelMap = useMemo(() => {
    const map: Record<string, string> = Object.fromEntries(
      CATEGORY_OPTIONS.map(o => [o.value, o.label])
    )
    for (const c of catalogCategories) map[c.value] = c.label
    return map
  }, [catalogCategories])

  const [tab, setTab] = useState<'todos' | 'vencimientos'>('todos')
  const [search, setSearch] = useState('')
  const [fCategory, setFCategory] = useState('')
  const [fStatus, setFStatus] = useState<ServiceStatus | ''>('')
  const [fCurrency, setFCurrency] = useState('')
  const [fFreq, setFFreq] = useState<BillingFrequency | ''>('')
  const [fAuto, setFAuto] = useState<'all' | 'yes' | 'no'>('all')
  const [fOwner, setFOwner] = useState('')
  const [due, setDue] = useState<'all' | 'overdue' | 'due30'>('all')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AccountingService | null>(null)
  const [payService, setPayService] = useState<AccountingService | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const owners = useMemo(
    () => Array.from(new Set(services.map(s => s.internal_owner).filter(Boolean))).sort(),
    [services]
  )
  const summary = useMemo(() => computeSummary(services), [services])

  const filtered = useMemo(() => {
    let list = services
    if (fCategory) list = list.filter(s => s.category === fCategory)
    if (fStatus) list = list.filter(s => s.status === fStatus)
    if (fCurrency) list = list.filter(s => s.currency === fCurrency)
    if (fFreq) list = list.filter(s => s.billing_frequency === fFreq)
    if (fAuto !== 'all') list = list.filter(s => (s.auto_renewal === 1) === (fAuto === 'yes'))
    if (fOwner) list = list.filter(s => s.internal_owner === fOwner)
    if (due === 'overdue') list = list.filter(s => dueStatus(s.next_due_date).key === 'overdue')
    if (due === 'due30') list = list.filter(s => ['overdue', 'd7', 'd15', 'd30'].includes(dueStatus(s.next_due_date).key))
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(s =>
        [s.name, s.provider, s.notes, s.policy_number, s.contact_name, s.internal_owner, s.contact_email]
          .some(v => (v || '').toLowerCase().includes(q))
      )
    }
    if (tab === 'vencimientos') {
      list = [...list]
        .filter(s => s.next_due_date && s.status !== 'cancelado')
        .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date))
    }
    return list
  }, [services, fCategory, fStatus, fCurrency, fFreq, fAuto, fOwner, due, search, tab])

  const openNew = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (s: AccountingService) => { setEditing(s); setFormOpen(true) }

  const clearFilters = () => {
    setFCategory(''); setFStatus(''); setFCurrency(''); setFFreq(''); setFAuto('all'); setFOwner(''); setDue('all'); setSearch('')
  }
  const hasFilters = !!(fCategory || fStatus || fCurrency || fFreq || fAuto !== 'all' || fOwner || due !== 'all' || search)

  return (
    <div className="h-full flex flex-col bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-700">
        <Repeat size={20} className="text-emerald-400" />
        <div className="flex-1">
          <h1 className="text-lg font-semibold leading-tight">Servicios</h1>
          <p className="text-xs text-slate-400">Control de abonos, suscripciones, pólizas y vencimientos recurrentes</p>
        </div>
        {write && (
          <button onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-sm text-white transition-colors">
            <Plus size={15} /> Nuevo servicio
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-5">
          {/* Cards de resumen */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <SummaryCard label="Total mensual estimado" icon={<Wallet size={15} className="text-emerald-400" />}>
              <MoneyLines map={summary.monthly} />
            </SummaryCard>
            <SummaryCard label="Total anual estimado" icon={<Wallet size={15} className="text-blue-400" />}>
              <MoneyLines map={summary.annual} />
            </SummaryCard>
            <SummaryCard label="Servicios activos" icon={<Repeat size={15} className="text-emerald-400" />}>
              <span className="text-2xl font-semibold">{summary.activeCount}</span>
            </SummaryCard>
            <SummaryCard label="Vencimientos próximos" icon={<CalendarClock size={15} className="text-amber-400" />}>
              <span className="text-2xl font-semibold">{summary.dueSoon}</span>
              {summary.overdue > 0 && <span className="block text-xs text-red-400">{summary.overdue} vencido(s)</span>}
            </SummaryCard>
            <SummaryCard label="Renovaciones automáticas" icon={<RefreshCw size={15} className="text-blue-400" />}>
              <span className="text-2xl font-semibold">{summary.autoRenew}</span>
            </SummaryCard>
            <SummaryCard label="Pólizas de seguro" icon={<ShieldCheck size={15} className="text-violet-400" />}>
              <span className="text-2xl font-semibold">{summary.insurance}</span>
            </SummaryCard>
          </div>

          {/* Tabs + filtros rápidos */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
              <TabBtn active={tab === 'todos'} onClick={() => setTab('todos')}>Todos</TabBtn>
              <TabBtn active={tab === 'vencimientos'} onClick={() => setTab('vencimientos')}>Vencimientos</TabBtn>
            </div>
            <div className="w-px h-6 bg-slate-700 mx-1" />
            <QuickFilter active={fCategory === 'seguro'} onClick={() => setFCategory(fCategory === 'seguro' ? '' : 'seguro')}>
              <ShieldCheck size={12} /> Solo seguros
            </QuickFilter>
            <QuickFilter active={fCategory === 'software'} onClick={() => setFCategory(fCategory === 'software' ? '' : 'software')}>
              Solo software
            </QuickFilter>
            <QuickFilter active={fAuto === 'yes'} onClick={() => setFAuto(fAuto === 'yes' ? 'all' : 'yes')}>
              <RefreshCw size={12} /> Auto-renovación
            </QuickFilter>
            <QuickFilter active={due === 'due30'} onClick={() => setDue(due === 'due30' ? 'all' : 'due30')}>
              <CalendarClock size={12} /> Próximos
            </QuickFilter>
            <QuickFilter active={due === 'overdue'} onClick={() => setDue(due === 'overdue' ? 'all' : 'overdue')}>
              Vencidos
            </QuickFilter>
          </div>

          {/* Filtros detallados + búsqueda */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar nombre, proveedor, póliza, contacto..."
                className="pl-8 pr-3 py-1.5 w-72 bg-slate-800 border border-slate-700 rounded text-sm focus:border-emerald-500 outline-none" />
            </div>
            <FilterSelect
              value={fCategory}
              onChange={setFCategory}
              placeholder="Categoría"
              options={catalogCategories.length > 0
                ? catalogCategories.map(c => ({ value: c.value, label: c.label }))
                : CATEGORY_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
            />
            <FilterSelect value={fStatus} onChange={v => setFStatus(v as ServiceStatus | '')} placeholder="Estado"
              options={STATUS_OPTIONS} />
            <FilterSelect value={fFreq} onChange={v => setFFreq(v as BillingFrequency | '')} placeholder="Frecuencia"
              options={FREQUENCY_OPTIONS} />
            <FilterSelect value={fCurrency} onChange={setFCurrency} placeholder="Moneda"
              options={CURRENCY_OPTIONS.map(c => ({ value: c, label: c }))} />
            {owners.length > 0 && (
              <FilterSelect value={fOwner} onChange={setFOwner} placeholder="Responsable"
                options={owners.map(o => ({ value: o, label: o }))} />
            )}
            {hasFilters && (
              <button onClick={clearFilters} className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1">Limpiar</button>
            )}
            <span className="ml-auto text-xs text-slate-500">{filtered.length} servicio(s)</span>
          </div>

          {/* Tabla */}
          {isLoading ? (
            <div className="text-slate-400 text-sm py-12 text-center">Cargando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Repeat size={40} className="mx-auto mb-3 opacity-30" />
              <p className="mb-4">{services.length === 0 ? 'No hay servicios cargados todavía.' : 'Ningún servicio coincide con los filtros.'}</p>
              {write && services.length === 0 && (
                <button onClick={openNew} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-sm text-white transition-colors">
                  Cargar primer servicio
                </button>
              )}
            </div>
          ) : (
            <div className="border border-slate-700 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                    <th className="text-left font-medium px-3 py-2.5">Servicio</th>
                    <th className="text-left font-medium px-3 py-2.5">Categoría</th>
                    <th className="text-left font-medium px-3 py-2.5">Proveedor</th>
                    <th className="text-right font-medium px-3 py-2.5">Valor</th>
                    <th className="text-left font-medium px-3 py-2.5">Frecuencia</th>
                    <th className="text-left font-medium px-3 py-2.5">Próximo venc.</th>
                    <th className="text-center font-medium px-3 py-2.5">Auto</th>
                    <th className="text-left font-medium px-3 py-2.5">Estado</th>
                    <th className="text-left font-medium px-3 py-2.5">Responsable</th>
                    <th className="text-right font-medium px-3 py-2.5">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => {
                    const d = dueStatus(s.next_due_date)
                    return (
                      <tr key={s.id} className="border-t border-slate-800 hover:bg-slate-800/40">
                        <td className="px-3 py-2.5">
                          <button onClick={() => openEdit(s)} className="font-medium text-slate-100 hover:text-emerald-400 text-left flex items-center gap-1.5">
                            {s.category === 'seguro' && <ShieldCheck size={13} className="text-violet-400 shrink-0" />}
                            {s.name || '(sin nombre)'}
                          </button>
                          {s.category === 'seguro' && s.policy_number && (
                            <span className="block text-xs text-slate-500">Póliza {s.policy_number}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-slate-300">{categoryLabelMap[s.category] ?? s.category}</td>
                        <td className="px-3 py-2.5 text-slate-300">{s.provider || '—'}</td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap font-medium">{fmtMoney(s.amount, s.currency)}</td>
                        <td className="px-3 py-2.5 text-slate-300">{FREQUENCY_LABEL[s.billing_frequency]}</td>
                        <td className="px-3 py-2.5">
                          {s.next_due_date
                            ? <span className={`inline-block px-2 py-0.5 rounded text-xs border ${d.badge}`}>{d.label}</span>
                            : <span className="text-slate-600 text-xs">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {s.auto_renewal === 1 ? <RefreshCw size={14} className="inline text-blue-400" /> : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs border ${STATUS_BADGE[s.status]}`}>{STATUS_LABEL[s.status]}</span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-300">{s.internal_owner || '—'}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            {s.provider_portal_url && (
                              <IconBtn title="Abrir portal del proveedor" onClick={() => window.api.shell.open(s.provider_portal_url)}>
                                <ExternalLink size={14} />
                              </IconBtn>
                            )}
                            {write && (
                              <>
                                <IconBtn title="Registrar pago / renovación" onClick={() => setPayService(s)}>
                                  <Receipt size={14} className="text-emerald-400" />
                                </IconBtn>
                                <IconBtn title="Editar" onClick={() => openEdit(s)}>
                                  <Pencil size={14} />
                                </IconBtn>
                                {s.status !== 'cancelado' ? (
                                  <IconBtn title="Marcar como cancelado" onClick={() => setStatus.mutate({ id: s.id, status: 'cancelado' })}>
                                    <Ban size={14} className="text-amber-400" />
                                  </IconBtn>
                                ) : (
                                  <IconBtn title="Reactivar" onClick={() => setStatus.mutate({ id: s.id, status: 'activo' })}>
                                    <PlayCircle size={14} className="text-emerald-400" />
                                  </IconBtn>
                                )}
                                {confirmDelete === s.id ? (
                                  <button onClick={() => { del.mutate(s.id); setConfirmDelete(null) }}
                                    className="text-xs px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-white">¿Borrar?</button>
                                ) : (
                                  <IconBtn title="Eliminar" onClick={() => setConfirmDelete(s.id)}>
                                    <Trash2 size={14} className="text-red-400" />
                                  </IconBtn>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {formOpen && (
        <ServiceFormModal service={editing} onClose={() => setFormOpen(false)} />
      )}
      {payService && (
        <ServicePaymentsModal service={payService} canWrite={write} onClose={() => setPayService(null)} />
      )}
    </div>
  )
}

// ─── Subcomponentes ─────────────────────────────────────────────────────────────

function SummaryCard({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5">{icon} {label}</div>
      <div className="text-slate-100">{children}</div>
    </div>
  )
}

function MoneyLines({ map }: { map: Record<string, number> }) {
  const entries = Object.entries(map).filter(([, v]) => v > 0)
  if (entries.length === 0) return <span className="text-slate-500 text-sm">—</span>
  return (
    <div className="space-y-0.5">
      {entries.map(([ccy, v]) => (
        <div key={ccy} className="text-base font-semibold leading-tight">{fmtMoney(v, ccy)}</div>
      ))}
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${active ? 'bg-slate-700 text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}>
      {children}
    </button>
  )
}

function QuickFilter({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-full border transition-colors ${
        active ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
      }`}>
      {children}
    </button>
  )
}

function FilterSelect({ value, onChange, placeholder, options }: {
  value: string; onChange: (v: string) => void; placeholder: string; options: { value: string; label: string }[]
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className={`px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm outline-none focus:border-emerald-500 ${value ? 'text-slate-100' : 'text-slate-500'}`}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o.value} value={o.value} className="text-slate-100">{o.label}</option>)}
    </select>
  )
}

function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button title={title} onClick={onClick}
      className="p-1.5 rounded hover:bg-slate-700 text-slate-300 transition-colors">
      {children}
    </button>
  )
}
