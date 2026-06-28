import { useState, useMemo } from 'react'
import { Vault, RefreshCw, Building2, AlertTriangle, Clock, TrendingUp, CheckCircle2 } from 'lucide-react'
import { cn } from '../../components/ui/utils'
import { useCashboxesWithBalances, parseCurrencies, fmtAmount } from '../../hooks/useCajas'
import type { CashboxWithBalance, CashCurrency, CashboxStatus } from '@shared/types'
import { CASHBOX_STATUS_LABELS, CASHBOX_STATUS_COLORS } from '@shared/types'
import NuevoMovimientoModal from './NuevoMovimientoModal'
import ConteoRapidoModal from './ConteoRapidoModal'
import DiferenciasModal from './DiferenciasModal'
import PermisosModal from './PermisosModal'
import CierreDiarioModal from './CierreDiarioModal'
import ReporteModal from './ReporteModal'

type ActiveModal = 'income' | 'expense' | 'transfer' | 'count' | 'differences' | 'permissions' | 'close' | 'report' | null

const CURRENCY_SYMBOLS: Record<CashCurrency, string> = { ARS: '$', USD: 'USD', EUR: '€' }

function StatusBadge({ status }: { status: CashboxStatus }) {
  const color = CASHBOX_STATUS_COLORS[status]
  const label = CASHBOX_STATUS_LABELS[status]
  const Icon = status === 'ok' ? CheckCircle2
    : status === 'pending_count' ? Clock
    : status === 'with_difference' ? AlertTriangle
    : status === 'blocked' ? AlertTriangle
    : CheckCircle2
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ backgroundColor: `${color}20`, color }}
    >
      <Icon size={10} />
      {label}
    </span>
  )
}

function CashboxCard({
  box,
  selected,
  onClick,
}: {
  box: CashboxWithBalance
  selected: boolean
  onClick: () => void
}) {
  const currencies = parseCurrencies(box.currencies)
  const hasDiff = box.status === 'with_difference'
  const isPending = box.status === 'pending_count'

  return (
    <button
      onClick={onClick}
      className={cn(
        'text-left bg-slate-800 border rounded-xl p-4 transition-all duration-150 w-full',
        selected
          ? 'border-emerald-500 ring-1 ring-emerald-500/30'
          : hasDiff
          ? 'border-red-700/60 hover:border-red-600'
          : 'border-slate-700 hover:border-slate-500'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-100 truncate">{box.name}</p>
          {box.description && (
            <p className="text-[11px] text-slate-500 truncate mt-0.5">{box.description}</p>
          )}
        </div>
        <StatusBadge status={box.status} />
      </div>

      <div className="space-y-1 mb-3">
        {currencies.map(cur => {
          const bal = box.balances[cur] ?? 0
          const sym = CURRENCY_SYMBOLS[cur]
          return (
            <div key={cur} className="flex items-baseline gap-1.5">
              <span className="text-[10px] text-slate-500 w-7">{cur}</span>
              <span
                className={cn(
                  'text-sm font-mono font-medium',
                  cur === 'ARS' ? 'text-slate-100' : 'text-emerald-400'
                )}
              >
                {cur === 'ARS' ? `${sym}${fmtAmount(bal, cur)}` : `${sym} ${fmtAmount(bal, cur)}`}
              </span>
            </div>
          )
        })}
      </div>

      <div className="text-[10px] text-slate-600">
        {box.last_count_at
          ? `Último conteo: ${new Date(box.last_count_at).toLocaleDateString('es-AR')}`
          : isPending
          ? <span className="text-amber-600">Sin conteo registrado</span>
          : 'Sin conteos'}
      </div>
    </button>
  )
}

function CompanySection({
  company,
  boxes,
  selectedId,
  onSelect,
}: {
  company: { id: string; name: string }
  boxes: CashboxWithBalance[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  if (boxes.length === 0) return null
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Building2 size={12} className="text-slate-500" />
        <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
          {company.name}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {boxes.map(box => (
          <CashboxCard
            key={box.id}
            box={box}
            selected={selectedId === box.id}
            onClick={() => onSelect(box.id)}
          />
        ))}
      </div>
    </div>
  )
}

export default function CajasDashboard() {
  const { companies, cashboxes, isLoading } = useCashboxesWithBalances()
  const [companyFilter, setCompanyFilter] = useState<string>('all')
  const [selectedId, setSelectedId]       = useState<string | null>(null)
  const [activeModal, setActiveModal]     = useState<ActiveModal>(null)

  const selectedBox = useMemo(
    () => cashboxes.find(b => b.id === selectedId) ?? null,
    [cashboxes, selectedId]
  )

  // ── KPIs globales ──────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totals: Partial<Record<CashCurrency, number>> = {}
    let conDiferencia = 0
    let pendienteConteo = 0

    for (const box of cashboxes) {
      for (const [cur, amt] of Object.entries(box.balances) as [CashCurrency, number][]) {
        totals[cur] = (totals[cur] ?? 0) + amt
      }
      if (box.status === 'with_difference') conDiferencia++
      if (box.status === 'pending_count')   pendienteConteo++
    }
    return { totals, conDiferencia, pendienteConteo }
  }, [cashboxes])

  // ── Filtro empresa ──────────────────────────────────────────────────────────
  const filteredBoxes = useMemo(() =>
    companyFilter === 'all'
      ? cashboxes
      : cashboxes.filter(b => b.company_id === companyFilter),
    [cashboxes, companyFilter]
  )

  const boxesByCompany = useMemo(() => {
    const map: Record<string, CashboxWithBalance[]> = {}
    for (const box of filteredBoxes) {
      if (!map[box.company_id]) map[box.company_id] = []
      map[box.company_id].push(box)
    }
    return map
  }, [filteredBoxes])

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <RefreshCw size={20} className="animate-spin text-slate-500" />
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <Vault size={20} className="text-emerald-400" />
          <h1 className="text-base font-semibold text-slate-100">Cajas</h1>
        </div>
      </div>

      <div className="flex flex-col flex-1 overflow-y-auto p-6 gap-5">

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-3">
          <KpiCard
            label="Total ARS"
            value={`$${fmtAmount(kpis.totals.ARS ?? 0, 'ARS')}`}
            icon={TrendingUp}
            iconColor="text-emerald-400"
          />
          <KpiCard
            label="Total USD"
            value={`USD ${fmtAmount(kpis.totals.USD ?? 0, 'USD')}`}
            icon={TrendingUp}
            iconColor="text-sky-400"
          />
          <KpiCard
            label="Con diferencia"
            value={String(kpis.conDiferencia)}
            icon={AlertTriangle}
            iconColor={kpis.conDiferencia > 0 ? 'text-red-400' : 'text-slate-600'}
            valueColor={kpis.conDiferencia > 0 ? 'text-red-400' : undefined}
          />
          <KpiCard
            label="Conteo pendiente"
            value={String(kpis.pendienteConteo)}
            icon={Clock}
            iconColor={kpis.pendienteConteo > 0 ? 'text-amber-400' : 'text-slate-600'}
            valueColor={kpis.pendienteConteo > 0 ? 'text-amber-400' : undefined}
          />
        </div>

        {/* Tabs empresa */}
        <div className="flex gap-2">
          <TabBtn active={companyFilter === 'all'} onClick={() => setCompanyFilter('all')}>
            Todas las cajas
          </TabBtn>
          {companies.map(co => (
            <TabBtn
              key={co.id}
              active={companyFilter === co.id}
              onClick={() => setCompanyFilter(co.id)}
            >
              {co.name}
            </TabBtn>
          ))}
        </div>

        {/* Grilla por empresa */}
        {cashboxes.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-slate-500 text-sm">
            Sin cajas registradas. Corré el SQL de seed en Supabase.
          </div>
        ) : (
          <div className="space-y-6">
            {companies
              .filter(co => companyFilter === 'all' || co.id === companyFilter)
              .map(co => (
                <CompanySection
                  key={co.id}
                  company={co}
                  boxes={boxesByCompany[co.id] ?? []}
                  selectedId={selectedId}
                  onSelect={id => setSelectedId(prev => prev === id ? null : id)}
                />
              ))}
          </div>
        )}

        {/* Panel de acciones */}
        {selectedId && selectedBox && (
          <SelectedPanel
            box={selectedBox}
            onClose={() => { setSelectedId(null); setActiveModal(null) }}
            onAction={setActiveModal}
          />
        )}
      </div>

      {/* Modal movimiento */}
      {activeModal && activeModal !== 'count' && selectedBox && (
        <NuevoMovimientoModal
          box={selectedBox}
          allBoxes={cashboxes}
          initialTipo={activeModal}
          onClose={() => setActiveModal(null)}
          onSuccess={() => setActiveModal(null)}
        />
      )}

      {/* Modal conteo */}
      {activeModal === 'count' && selectedBox && (
        <ConteoRapidoModal
          box={selectedBox}
          onClose={() => setActiveModal(null)}
          onSuccess={() => setActiveModal(null)}
        />
      )}

      {/* Modal reporte */}
      {activeModal === 'report' && selectedBox && (
        <ReporteModal
          box={selectedBox}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Modal cierre diario */}
      {activeModal === 'close' && selectedBox && (
        <CierreDiarioModal
          box={selectedBox}
          onClose={() => setActiveModal(null)}
          onSuccess={() => setActiveModal(null)}
        />
      )}

      {/* Modal permisos */}
      {activeModal === 'permissions' && selectedBox && (
        <PermisosModal
          box={selectedBox}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Modal diferencias */}
      {activeModal === 'differences' && selectedBox && (
        <DiferenciasModal
          box={selectedBox}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  )
}

function KpiCard({
  label, value, icon: Icon, iconColor, valueColor,
}: {
  label: string
  value: string
  icon: React.ElementType
  iconColor?: string
  valueColor?: string
}) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={13} className={iconColor ?? 'text-slate-500'} />
        <span className="text-[11px] text-slate-400">{label}</span>
      </div>
      <p className={cn('text-xl font-semibold font-mono', valueColor ?? 'text-slate-100')}>
        {value}
      </p>
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-1.5 rounded-full text-xs font-medium border transition-colors',
        active
          ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700'
          : 'bg-transparent text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-200'
      )}
    >
      {children}
    </button>
  )
}

function SelectedPanel({
  box,
  onClose,
  onAction,
}: {
  box: CashboxWithBalance
  onClose: () => void
  onAction: (tipo: ActiveModal) => void
}) {
  const currencies = parseCurrencies(box.currencies)
  return (
    <div className="bg-slate-800/80 border border-emerald-700/40 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-sm font-medium text-slate-100">{box.name}</span>
          <span className="text-xs text-slate-500 ml-2">{box.company?.name}</span>
          {currencies.length > 1 && (
            <span className="text-[10px] text-slate-600 ml-2">· {currencies.join(' · ')}</span>
          )}
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg leading-none">×</button>
      </div>
      <div className="flex gap-2 flex-wrap">
        <ActionBtn label="Ingresar"   color="emerald" onClick={() => onAction('income')} />
        <ActionBtn label="Egresar"    color="red"     onClick={() => onAction('expense')} />
        <ActionBtn label="Transferir" color="sky"     onClick={() => onAction('transfer')} />
        <ActionBtn label="Contar caja"  color="slate" onClick={() => onAction('count')} />
        <ActionBtn label="Cierre diario" color="sky"   onClick={() => onAction('close')} />
        <ActionBtn label="Diferencias"  color="slate" onClick={() => onAction('differences')} />
        <ActionBtn label="Permisos"     color="slate" onClick={() => onAction('permissions')} />
        <ActionBtn label="Exportar"     color="slate" onClick={() => onAction('report')} />
      </div>
    </div>
  )
}

function ActionBtn({
  label, color, onClick, disabled,
}: {
  label: string
  color: 'emerald' | 'red' | 'sky' | 'slate'
  onClick?: () => void
  disabled?: boolean
}) {
  const colorCls = {
    emerald: 'bg-emerald-900/40 text-emerald-300 border-emerald-700 hover:bg-emerald-900/60',
    red:     'bg-red-900/30 text-red-300 border-red-800 hover:bg-red-900/50',
    sky:     'bg-sky-900/30 text-sky-300 border-sky-800 hover:bg-sky-900/50',
    slate:   'bg-slate-700/50 text-slate-400 border-slate-600 hover:bg-slate-700',
  }[color]
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'px-3 py-1.5 rounded-lg text-xs border transition-colors',
        colorCls,
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      {label}
    </button>
  )
}
