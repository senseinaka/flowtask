import { useState, useEffect, useRef } from 'react'
import {
  Wifi, WifiOff, Plus, Trash2, RefreshCw, Download, ChevronRight,
  CheckCircle2, AlertCircle, Settings, List, CreditCard,
  Eye, EyeOff, Loader2, PlugZap, CalendarRange, Copy,
  ExternalLink, FolderOpen, XCircle, LayoutDashboard,
  TrendingUp, Wallet, Clock, Undo2,
} from 'lucide-react'
import dayjs from 'dayjs'
import {
  useMpConnections, useCreateMpConnection, useDeleteMpConnection,
  useTestMpConnection, useUpdateMpToken, useStartMpOAuth,
  useMpJobs, useDownloadMpJob, usePollMpJob, useCancelMpJob, useRunMpSync,
  useOpenMpJobFile, useShowMpJobInFolder,
  useMpTransactions, useUpdateMpReconStatus, useMpTransactionStats,
  useMpReportConfig, useSetMpReportConfig, useMpDefaultConfig,
  useMpResumen,
} from '../../hooks/useMercadoPago'
import { usePermissions } from '../../hooks/usePermissions'
import { toast } from '../../store/toast.store'
import type {
  MpConnectionWithCreds, MpReportJob, MpTransaction,
  MpReconciliationStatus, MpReportConfig,
} from '@shared/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const JOB_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente', requested: 'Solicitado', ready_to_download: 'Listo',
  downloading: 'Descargando', processing: 'Procesando', completed: 'Completado', failed: 'Fallido',
}
const JOB_STATUS_COLOR: Record<string, string> = {
  pending: 'text-slate-400', requested: 'text-amber-400', ready_to_download: 'text-blue-400',
  downloading: 'text-blue-400', processing: 'text-amber-400', completed: 'text-emerald-400', failed: 'text-red-400',
}
const RECON_LABEL: Record<string, string> = {
  pending: 'Pendiente', suggested: 'Sugerido', confirmed: 'Confirmado',
  rejected: 'Rechazado', ignored: 'Ignorado', needs_review: 'Revisar',
}
const RECON_COLOR: Record<string, string> = {
  pending: 'text-slate-400', suggested: 'text-amber-400', confirmed: 'text-emerald-400',
  rejected: 'text-red-400', ignored: 'text-slate-500', needs_review: 'text-orange-400',
}
const TXN_TYPE_COLOR: Record<string, string> = {
  SETTLEMENT: 'text-emerald-400', REFUND: 'text-amber-400', CHARGEBACK: 'text-red-400',
  DISPUTE: 'text-orange-400', WITHDRAWAL: 'text-blue-400',
}

function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n)
}
function fmtDate(ms: number | string) {
  const d = typeof ms === 'number' ? dayjs(ms) : dayjs(ms)
  return d.isValid() ? d.format('DD/MM/YY HH:mm') : String(ms).slice(0, 10)
}

type Tab = 'resumen' | 'conexiones' | 'sincronizacion' | 'transacciones' | 'configuracion'

// ─── Componente principal ─────────────────────────────────────────────────────

export default function MPDashboard() {
  const [tab, setTab] = useState<Tab>('resumen')
  const [selectedConn, setSelectedConn] = useState<string | null>(null)
  const { canWrite } = usePermissions()

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'resumen',        label: 'Resumen',        icon: <LayoutDashboard size={15} /> },
    { key: 'conexiones',     label: 'Conexiones',    icon: <PlugZap size={15} /> },
    { key: 'sincronizacion', label: 'Sincronización', icon: <RefreshCw size={15} /> },
    { key: 'transacciones',  label: 'Transacciones',  icon: <List size={15} /> },
    { key: 'configuracion',  label: 'Configuración',  icon: <Settings size={15} /> },
  ]

  return (
    <div className="h-full flex flex-col bg-slate-900 text-slate-100">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-700">
        <CreditCard size={20} className="text-blue-400" />
        <h1 className="text-lg font-semibold">Mercado Pago</h1>
      </div>

      <div className="flex gap-1 px-6 pt-3 border-b border-slate-700">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-t transition-colors ${
              tab === t.key
                ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-800'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {tab === 'resumen' && (
          <ResumenTab selectedConn={selectedConn} />
        )}
        {tab === 'conexiones' && (
          <ConexionesTab
            selectedConn={selectedConn}
            onSelectConn={setSelectedConn}
            canWrite={canWrite('contable')}
          />
        )}
        {tab === 'sincronizacion' && (
          <SincronizacionTab selectedConn={selectedConn} canWrite={canWrite('contable')} />
        )}
        {tab === 'transacciones' && (
          <TransaccionesTab selectedConn={selectedConn} />
        )}
        {tab === 'configuracion' && (
          <ConfiguracionTab selectedConn={selectedConn} canWrite={canWrite('contable')} />
        )}
      </div>
    </div>
  )
}

// ─── Tab Resumen ──────────────────────────────────────────────────────────────

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  account_money: 'Dinero en cuenta', credit_card: 'Tarjeta de crédito', debit_card: 'Tarjeta de débito',
  visa: 'Visa', master: 'Mastercard', amex: 'Amex', cabal: 'Cabal', naranja: 'Naranja',
  debvisa: 'Visa débito', debmaster: 'Master débito', maestro: 'Maestro',
  rapipago: 'Rapipago', pagofacil: 'Pago Fácil', otro: 'Otro',
}

type ResumenPeriod = '7d' | '30d' | 'mes'

function KpiCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; accent: string
}) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={accent}>{icon}</span>
        <p className="text-xs text-slate-400">{label}</p>
      </div>
      <p className="text-xl font-semibold text-slate-100">{value}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}

function ResumenTab({ selectedConn }: { selectedConn: string | null }) {
  const { data: connections = [], isLoading } = useMpConnections()
  const connId = selectedConn ?? connections[0]?.id ?? null
  const [period, setPeriod] = useState<ResumenPeriod>('30d')

  const dateTo = dayjs().format('YYYY-MM-DD')
  const dateFrom = period === '7d' ? dayjs().subtract(6, 'day').format('YYYY-MM-DD')
    : period === '30d' ? dayjs().subtract(29, 'day').format('YYYY-MM-DD')
    : dayjs().startOf('month').format('YYYY-MM-DD')

  const { data: stats, isLoading: statsLoading } = useMpResumen(connId, dateFrom, dateTo)

  if (isLoading) return <div className="p-6 text-slate-400 text-sm">Cargando...</div>
  if (!connId) return (
    <div className="p-6 text-slate-500 text-sm">Conectá una cuenta en la tab Conexiones para ver el resumen.</div>
  )
  if (statsLoading || !stats) return <div className="p-6 text-slate-400 text-sm">Calculando resumen...</div>

  const activeConn = connections.find(c => c.id === connId)
  const sinDatos = stats.ventas.count === 0 && stats.liberaciones.length === 0 && stats.disponible_estimado === 0

  const maxDaily = Math.max(...stats.daily.map(d => d.amount), 1)
  const totalMethod = stats.by_method.reduce((s, m) => s + m.amount, 0)

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      {/* Selector de período */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1.5 p-0.5 bg-slate-800 rounded w-fit">
          {([['7d', '7 días'], ['30d', '30 días'], ['mes', 'Este mes']] as [ResumenPeriod, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setPeriod(key)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                period === key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
              {label}
            </button>
          ))}
        </div>
        {activeConn && <span className="text-xs text-slate-500">{activeConn.name} · datos de reportes importados</span>}
      </div>

      {sinDatos ? (
        <div className="border border-dashed border-slate-700 rounded-lg p-10 text-center text-slate-500">
          <LayoutDashboard size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Sin transacciones importadas para este período.</p>
          <p className="text-xs mt-1 text-slate-600">Corré una sincronización en la tab Sincronización para traer los datos.</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={<TrendingUp size={15} />} accent="text-emerald-400"
              label={`Ventas (${stats.ventas.count})`}
              value={fmtARS(stats.ventas.bruto)}
              sub={`Neto ${fmtARS(stats.ventas.neto)}`} />
            <KpiCard icon={<CreditCard size={15} />} accent="text-amber-400"
              label="Comisiones e impuestos"
              value={fmtARS(Math.abs(stats.ventas.fees) + Math.abs(stats.ventas.taxes))}
              sub={stats.ventas.bruto > 0 ? `${(((Math.abs(stats.ventas.fees) + Math.abs(stats.ventas.taxes)) / stats.ventas.bruto) * 100).toFixed(1)}% de lo vendido` : undefined} />
            <KpiCard icon={<Clock size={15} />} accent="text-blue-400"
              label="Por liberar"
              value={fmtARS(stats.por_liberar)}
              sub={stats.liberaciones.length > 0 ? `Próxima: ${dayjs(stats.liberaciones[0].date).format('DD/MM')}` : undefined} />
            <KpiCard icon={<Wallet size={15} />} accent="text-violet-400"
              label="Disponible estimado"
              value={fmtARS(stats.disponible_estimado)}
              sub="Liberado según reportes (incluye retiros)" />
          </div>

          {/* Devoluciones del período */}
          {stats.devoluciones.count > 0 && (
            <div className="flex items-center gap-2 bg-amber-950/30 border border-amber-800/40 rounded-lg px-4 py-2.5 text-sm">
              <Undo2 size={14} className="text-amber-400 flex-shrink-0" />
              <span className="text-amber-200">
                {stats.devoluciones.count} devolución{stats.devoluciones.count !== 1 ? 'es' : ''}/contracargo{stats.devoluciones.count !== 1 ? 's' : ''} en el período por {fmtARS(Math.abs(stats.devoluciones.total))}
              </span>
            </div>
          )}

          {/* Ventas por día */}
          {stats.daily.length > 0 && (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Ventas por día</p>
              <div className="flex items-end gap-1 h-28">
                {stats.daily.map(d => (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1 min-w-0 group"
                    title={`${dayjs(d.date).format('DD/MM')}: ${fmtARS(d.amount)} (${d.count} op.)`}>
                    <div className="w-full bg-blue-600/70 group-hover:bg-blue-500 rounded-t transition-colors"
                      style={{ height: `${Math.max((d.amount / maxDaily) * 100, 2)}%` }} />
                    <span className="text-[9px] text-slate-600 truncate">{dayjs(d.date).format('DD')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Calendario de liberaciones */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Calendario de liberaciones</p>
              {stats.liberaciones.length === 0 ? (
                <p className="text-sm text-slate-500">No hay liberaciones pendientes en los reportes importados.</p>
              ) : (
                <div className="space-y-1.5">
                  {stats.liberaciones.map(l => {
                    const d = dayjs(l.date)
                    const daysAway = d.diff(dayjs().startOf('day'), 'day')
                    return (
                      <div key={l.date} className="flex items-center justify-between py-1.5 px-2.5 bg-slate-900/50 rounded border border-slate-700/40">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-200">{d.format('dddd DD/MM')}</span>
                          <span className="text-[10px] text-slate-500">
                            {daysAway === 1 ? 'mañana' : `en ${daysAway} días`} · {l.count} op.
                          </span>
                        </div>
                        <span className="text-sm font-medium text-emerald-400">{fmtARS(l.amount)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Por medio de pago */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Por medio de pago</p>
              {stats.by_method.length === 0 ? (
                <p className="text-sm text-slate-500">Sin ventas en el período.</p>
              ) : (
                <div className="space-y-2">
                  {stats.by_method.map(m => {
                    const pct = totalMethod > 0 ? (m.amount / totalMethod) * 100 : 0
                    return (
                      <div key={m.method}>
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className="text-slate-300">{PAYMENT_METHOD_LABEL[m.method] ?? m.method} <span className="text-slate-600">({m.count})</span></span>
                          <span className="text-slate-400">{fmtARS(m.amount)}</span>
                        </div>
                        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Tab Conexiones ───────────────────────────────────────────────────────────

function ConexionesTab({
  selectedConn, onSelectConn, canWrite,
}: { selectedConn: string | null; onSelectConn: (id: string | null) => void; canWrite: boolean }) {
  const { data: connections = [], isLoading } = useMpConnections()
  const createConn   = useCreateMpConnection()
  const startOAuth   = useStartMpOAuth()
  const deleteConn   = useDeleteMpConnection()
  const testConn     = useTestMpConnection()
  const updateToken  = useUpdateMpToken()

  const [showForm, setShowForm]         = useState(false)
  const [authMode, setAuthMode]         = useState<'token' | 'oauth'>('oauth')
  const [formName, setFormName]         = useState('')
  const [formLabel, setFormLabel]       = useState('')
  const [formToken, setFormToken]       = useState('')
  const [showToken, setShowToken]       = useState(false)
  const [editTokenId, setEditTokenId]   = useState<string | null>(null)
  const [newToken, setNewToken]         = useState('')

  async function handleCreate() {
    if (!formName || !formToken) return
    const res = await createConn.mutateAsync({
      input: { name: formName, account_label: formLabel || formName, access_token: formToken, environment: 'production' },
      userId: '',
    })
    if (res.test.ok) toast.success(`Conectado${res.test.user_id ? ` · ID: ${res.test.user_id}` : ''}`)
    else toast.error(res.test.error || 'No se pudo verificar la conexión')
    setShowForm(false); setFormName(''); setFormLabel(''); setFormToken('')
  }

  async function handleOAuthConnect() {
    if (!formName) return
    try {
      const res = await startOAuth.mutateAsync({ name: formName, accountLabel: formLabel || formName, environment: 'production' })
      if (res.test.ok) toast.success(`Conectado${res.test.user_id ? ` · ID: ${res.test.user_id}` : ''}`)
      else toast.error(res.test.error || 'No se pudo verificar la conexión')
      setShowForm(false); setFormName(''); setFormLabel('')
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo completar la conexión OAuth')
    }
  }

  if (isLoading) return <div className="p-6 text-slate-400 text-sm">Cargando...</div>

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      {connections.length === 0 && !showForm && (
        <div className="text-center py-12 text-slate-500">
          <CreditCard size={40} className="mx-auto mb-3 opacity-30" />
          <p className="mb-4">No hay cuentas de Mercado Pago conectadas.</p>
          {canWrite && (
            <button onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm text-white transition-colors">
              Conectar cuenta
            </button>
          )}
        </div>
      )}

      {connections.map(conn => (
        <ConnectionCard
          key={conn.id}
          conn={conn}
          isSelected={selectedConn === conn.id}
          onSelect={() => onSelectConn(selectedConn === conn.id ? null : conn.id)}
          canWrite={canWrite}
          onDelete={() => deleteConn.mutate(conn.id)}
          onTest={async () => {
            const r = await testConn.mutateAsync(conn.id)
            if (r.ok) toast.success(`Conexión OK${r.user_id ? ` · ID: ${r.user_id}` : ''}`)
            else toast.error(r.error || 'No se pudo verificar la conexión')
          }}
          editTokenId={editTokenId}
          newToken={newToken}
          onSetEditToken={(id) => { setEditTokenId(id); setNewToken('') }}
          onNewTokenChange={setNewToken}
          onSaveToken={async () => {
            if (!editTokenId || !newToken) return
            const r = await updateToken.mutateAsync({ connectionId: editTokenId, newToken })
            if (r.ok) toast.success('Token actualizado y verificado')
            else toast.error(r.error || 'No se pudo verificar el nuevo token')
            setEditTokenId(null); setNewToken('')
          }}
          isSavingToken={updateToken.isPending}
        />
      ))}

      {showForm && (
        <div className="border border-blue-500/40 rounded-lg p-4 bg-slate-800 space-y-3">
          <p className="font-medium text-sm text-blue-400">Nueva conexión</p>

          <div className="flex gap-1.5 p-0.5 bg-slate-900 rounded w-fit">
            <button onClick={() => setAuthMode('oauth')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${authMode === 'oauth' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
              Conectar con OAuth
            </button>
            <button onClick={() => setAuthMode('token')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${authMode === 'token' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
              Access Token manual
            </button>
          </div>

          <input value={formName} onChange={e => setFormName(e.target.value)}
            placeholder="Nombre (ej: Naka Principal)"
            className="w-full px-3 py-2 bg-slate-700 rounded text-sm border border-slate-600 focus:border-blue-500 outline-none" />
          <input value={formLabel} onChange={e => setFormLabel(e.target.value)}
            placeholder="Etiqueta de cuenta (opcional)"
            className="w-full px-3 py-2 bg-slate-700 rounded text-sm border border-slate-600 focus:border-blue-500 outline-none" />

          {authMode === 'token' ? (
            <div className="relative">
              <input value={formToken} onChange={e => setFormToken(e.target.value)}
                type={showToken ? 'text' : 'password'}
                placeholder="Access Token (APP_USR-...)"
                className="w-full px-3 py-2 bg-slate-700 rounded text-sm border border-slate-600 focus:border-blue-500 outline-none pr-10" />
              <button onClick={() => setShowToken(v => !v)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200">
                {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Se abre el navegador para autorizar la cuenta desde Mercado Pago — no hace falta pegar ningún token acá.
            </p>
          )}

          <div className="flex gap-2">
            {authMode === 'token' ? (
              <button onClick={handleCreate} disabled={createConn.isPending || !formName || !formToken}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded text-sm text-white transition-colors flex items-center gap-1.5">
                {createConn.isPending && <Loader2 size={13} className="animate-spin" />}
                Conectar
              </button>
            ) : (
              <button onClick={handleOAuthConnect} disabled={startOAuth.isPending || !formName}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded text-sm text-white transition-colors flex items-center gap-1.5">
                {startOAuth.isPending ? <Loader2 size={13} className="animate-spin" /> : <PlugZap size={13} />}
                {startOAuth.isPending ? 'Esperando autorización...' : 'Conectar con OAuth'}
              </button>
            )}
            <button onClick={() => setShowForm(false)} disabled={startOAuth.isPending}
              className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm transition-colors disabled:opacity-50">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {connections.length > 0 && canWrite && !showForm && (
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-blue-400 transition-colors">
          <Plus size={14} /> Agregar cuenta
        </button>
      )}
    </div>
  )
}

function ConnectionCard({
  conn, isSelected, onSelect, canWrite, onDelete, onTest,
  editTokenId, newToken, onSetEditToken, onNewTokenChange, onSaveToken, isSavingToken,
}: {
  conn: MpConnectionWithCreds
  isSelected: boolean
  onSelect: () => void
  canWrite: boolean
  onDelete: () => void
  onTest: () => void
  editTokenId: string | null
  newToken: string
  onSetEditToken: (id: string | null) => void
  onNewTokenChange: (v: string) => void
  onSaveToken: () => void
  isSavingToken: boolean
}) {
  const isEditingToken = editTokenId === conn.id

  return (
    <div className={`border rounded-lg transition-colors ${isSelected ? 'border-blue-500/60 bg-slate-800' : 'border-slate-700 bg-slate-800/50'}`}>
      <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={onSelect}>
        {conn.status === 'active'
          ? <Wifi size={14} className="text-emerald-400" />
          : <WifiOff size={14} className={conn.status === 'error' ? 'text-red-400' : 'text-slate-500'} />
        }
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{conn.name}</p>
          <p className="text-xs text-slate-400">
            {conn.account_label}
            {conn.mercadopago_user_id ? ` · ID: ${conn.mercadopago_user_id}` : ''}
            {conn.last_sync_at ? ` · Sync: ${fmtDate(conn.last_sync_at)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${conn.has_token ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'}`}>
            {conn.has_token ? 'Token OK' : 'Sin token'}
          </span>
          <ChevronRight size={14} className={`text-slate-500 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
        </div>
      </div>

      {isSelected && (
        <div className="border-t border-slate-700 p-4 space-y-3">
          {isEditingToken ? (
            <div className="flex gap-2">
              <input value={newToken} onChange={e => onNewTokenChange(e.target.value)}
                type="password" placeholder="Nuevo Access Token"
                className="flex-1 px-3 py-1.5 bg-slate-700 rounded text-sm border border-slate-600 focus:border-blue-500 outline-none" />
              <button onClick={onSaveToken} disabled={isSavingToken || !newToken}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded text-sm text-white transition-colors flex items-center gap-1">
                {isSavingToken && <Loader2 size={12} className="animate-spin" />} Guardar
              </button>
              <button onClick={() => onSetEditToken(null)}
                className="px-3 py-1.5 text-slate-400 hover:text-slate-200 text-sm">✕</button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button onClick={onTest}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors">
                <RefreshCw size={12} /> Verificar conexión
              </button>
              {canWrite && (
                <>
                  <button onClick={() => onSetEditToken(conn.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors">
                    <Eye size={12} /> Actualizar token
                  </button>
                  <button onClick={onDelete}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded text-sm transition-colors">
                    <Trash2 size={12} /> Eliminar
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Tab Sincronización ───────────────────────────────────────────────────────

function SincronizacionTab({
  selectedConn, canWrite,
}: { selectedConn: string | null; canWrite: boolean }) {
  const { data: connections = [] } = useMpConnections()
  const connId = selectedConn ?? connections[0]?.id ?? null
  const { data: jobs = [], isLoading } = useMpJobs(connId)
  const runSync         = useRunMpSync()
  const downloadJob    = useDownloadMpJob()
  const pollJob        = usePollMpJob()
  const cancelJob      = useCancelMpJob()
  const openFile       = useOpenMpJobFile()
  const showInFolder   = useShowMpJobInFolder()

  const [dateFrom, setDateFrom] = useState(dayjs().subtract(7, 'day').format('YYYY-MM-DD'))
  const [dateTo, setDateTo]     = useState(dayjs().format('YYYY-MM-DD'))

  // Refs estables para evitar dependencias en effects
  const pollJobRef     = useRef(pollJob.mutate)
  const downloadJobRef = useRef(downloadJob.mutate)
  pollJobRef.current     = pollJob.mutate
  downloadJobRef.current = downloadJob.mutate

  // Auto-poll MP API mientras haya jobs en estado 'requested'
  // Check rápido a los 5s (reportes de 1 día suelen estar listos en segundos) y luego cada 15s
  const requestedKey = jobs.filter(j => j.status === 'requested').map(j => j.id).join(',')
  useEffect(() => {
    if (!requestedKey) return
    const ids = requestedKey.split(',')
    const quick = setTimeout(() => ids.forEach(id => pollJobRef.current(id)), 5_000)
    const timer  = setInterval(() => ids.forEach(id => pollJobRef.current(id)), 15_000)
    return () => { clearTimeout(quick); clearInterval(timer) }
  }, [requestedKey])

  // Auto-descarga cuando un job pasa a 'ready_to_download'
  const readyKey = jobs.filter(j => j.status === 'ready_to_download').map(j => j.id).join(',')
  useEffect(() => {
    if (!readyKey) return
    readyKey.split(',').forEach(id => downloadJobRef.current(id))
  }, [readyKey])

  async function handleSync() {
    if (!connId) return
    try {
      const res = await runSync.mutateAsync({ connectionId: connId, dateFrom, dateTo, requestedBy: 'manual' })
      if (res.status === 'failed') {
        toast.error(res.error_message || 'No se pudo sincronizar con Mercado Pago')
      } else if (res.status === 'requested') {
        toast.info('Mercado Pago todavía está generando el reporte — se va a importar solo cuando esté listo (mirá el Historial).')
      } else {
        toast.success(
          `Sincronizado: ${res.imported} transacciones nuevas` +
          (res.duplicated ? `, ${res.duplicated} ya existían` : '') +
          (res.errors ? `, ${res.errors} con error` : '')
        )
      }
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  if (!connId) return (
    <div className="p-6 text-slate-500 text-sm">Seleccioná una conexión en la tab Conexiones.</div>
  )

  const activeConn = connections.find(c => c.id === connId)

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2">
          <CalendarRange size={16} className="text-blue-400" />
          <p className="font-medium text-sm">Solicitar reporte de liquidación</p>
          {activeConn && <span className="text-xs text-slate-400">· {activeConn.name}</span>}
        </div>
        <div className="flex gap-3 flex-wrap">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Desde</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm focus:border-blue-500 outline-none" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Hasta</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm focus:border-blue-500 outline-none" />
          </div>
        </div>
        {canWrite && (
          <button onClick={handleSync} disabled={runSync.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded text-sm text-white transition-colors">
            {runSync.isPending ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {runSync.isPending ? 'Sincronizando...' : 'Sincronizar'}
          </button>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs text-slate-400 uppercase tracking-wider">Historial</p>
        {isLoading && <p className="text-slate-500 text-sm">Cargando...</p>}
        {!isLoading && jobs.length === 0 && <p className="text-slate-500 text-sm">No hay sincronizaciones todavía.</p>}
        {jobs.map(job => (
          <JobRow
            key={job.id} job={job} canWrite={canWrite}
            onDownload={() => downloadJob.mutate(job.id)}
            onPoll={() => pollJob.mutate(job.id)}
            onCancel={() => cancelJob.mutate(job.id)}
            onOpenFile={() => openFile.mutate(job.id)}
            onShowInFolder={() => showInFolder.mutate(job.id)}
            isPollPending={pollJob.isPending && pollJob.variables === job.id}
            isDownloadPending={downloadJob.isPending && downloadJob.variables === job.id}
            isCancelPending={cancelJob.isPending && cancelJob.variables === job.id}
            downloadError={downloadJob.isError && downloadJob.variables === job.id
              ? (downloadJob.error as Error)?.message
              : undefined}
          />
        ))}
      </div>
    </div>
  )
}

function JobRow({ job, onDownload, onPoll, onCancel, onOpenFile, onShowInFolder, canWrite, isPollPending = false, isDownloadPending = false, isCancelPending = false, downloadError }: {
  job: MpReportJob; onDownload: () => void; onPoll: () => void; onCancel: () => void
  onOpenFile: () => void; onShowInFolder: () => void
  canWrite: boolean; isPollPending?: boolean; isDownloadPending?: boolean; isCancelPending?: boolean; downloadError?: string
}) {
  const [copied, setCopied] = useState(false)
  const colorClass = JOB_STATUS_COLOR[job.status] ?? 'text-slate-400'
  const errorMsg = job.error_message || downloadError

  const copyError = () => {
    if (!errorMsg) return
    navigator.clipboard.writeText(errorMsg)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const fmtJobDate = (d: string) => d ? d.split('-').reverse().join('-') : ''

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden text-sm">
      <div className="flex items-center gap-3 p-3">
        <span className={`font-medium min-w-[110px] ${colorClass}`}>{JOB_STATUS_LABEL[job.status] ?? job.status}</span>
        <span className="text-slate-300 text-xs">{fmtJobDate(job.date_from)} → {fmtJobDate(job.date_to)}</span>
        {job.file_name && <span className="text-xs text-slate-500 truncate flex-1">{job.file_name}</span>}
        <span className="text-xs text-slate-500 ml-auto">{fmtDate(job.created_at)}</span>
        {canWrite && job.status === 'ready_to_download' && (
          <button onClick={onDownload} disabled={isDownloadPending}
            className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded text-white transition-colors flex items-center gap-1 shrink-0">
            {isDownloadPending ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
            {isDownloadPending ? 'Descargando...' : 'Descargar'}
          </button>
        )}
        {job.status === 'completed' && job.file_name && (
          <>
            <button onClick={onOpenFile} title="Abrir en Excel / app predeterminada"
              className="text-xs px-2 py-1 bg-emerald-700 hover:bg-emerald-600 rounded text-white transition-colors flex items-center gap-1 shrink-0">
              <ExternalLink size={11} /> Abrir
            </button>
            <button onClick={onShowInFolder} title="Mostrar en el Explorador de Windows"
              className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded transition-colors flex items-center gap-1 shrink-0 text-slate-300">
              <FolderOpen size={11} />
            </button>
          </>
        )}
        {canWrite && (job.status === 'requested' || job.status === 'pending') && (
          <>
            <button onClick={onPoll} disabled={isPollPending}
              className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded transition-colors flex items-center gap-1 shrink-0">
              {isPollPending ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
              {isPollPending ? 'Verificando...' : 'Verificar'}
            </button>
            <button onClick={onCancel} disabled={isCancelPending}
              className="text-xs px-2 py-1 bg-red-900/30 hover:bg-red-900/50 disabled:opacity-50 text-red-400 rounded transition-colors flex items-center gap-1 shrink-0">
              {isCancelPending ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />}
              Cancelar
            </button>
          </>
        )}
      </div>
      {(job.status === 'failed' || downloadError) && errorMsg && (
        <div className="flex items-start gap-2 px-3 pb-3 border-t border-slate-700 pt-2">
          <AlertCircle size={13} className="text-red-400 mt-0.5 shrink-0" />
          <span className="text-xs text-red-300 font-mono flex-1 break-all">{errorMsg}</span>
          <button onClick={copyError}
            className="text-xs px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded transition-colors flex items-center gap-1 shrink-0 text-slate-300">
            {copied ? <><CheckCircle2 size={11} className="text-emerald-400" /> Copiado</> : <><Copy size={11} /> Copiar</>}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Tab Transacciones ────────────────────────────────────────────────────────

const TXN_PAGE_SIZE = 200

function TransaccionesTab({ selectedConn }: { selectedConn: string | null }) {
  const { data: connections = [] } = useMpConnections()
  const connId = selectedConn ?? connections[0]?.id ?? null
  const { data: stats } = useMpTransactionStats(connId)

  const [search, setSearch]         = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [reconFilter, setReconFilter] = useState('')
  const [dateFrom, setDateFrom]     = useState('')
  const [dateTo, setDateTo]         = useState('')
  const [page, setPage]             = useState(0)

  // Volver a la primera página cada vez que cambian los filtros o la conexión.
  useEffect(() => setPage(0), [connId, search, typeFilter, reconFilter, dateFrom, dateTo])

  const { data: transactions = [], isLoading } = useMpTransactions({
    connection_id:        connId ?? undefined,
    search:               search || undefined,
    transaction_type:     typeFilter || undefined,
    reconciliation_status: (reconFilter || undefined) as MpReconciliationStatus | undefined,
    date_from:            dateFrom || undefined,
    date_to:              dateTo || undefined,
    limit: TXN_PAGE_SIZE,
    offset: page * TXN_PAGE_SIZE,
  })

  const updateRecon = useUpdateMpReconStatus()

  if (!connId) return (
    <div className="p-6 text-slate-500 text-sm">Seleccioná una conexión en la tab Conexiones.</div>
  )

  return (
    <div className="p-6 space-y-4">
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total" value={String(stats.total)} />
          {stats.by_recon.map(r => (
            <StatCard
              key={r.reconciliation_status}
              label={RECON_LABEL[r.reconciliation_status] ?? r.reconciliation_status}
              value={String(r.count)}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar referencia, pagador, descripción..."
          className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm focus:border-blue-500 outline-none w-64" />
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm focus:border-blue-500 outline-none" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm focus:border-blue-500 outline-none" />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm focus:border-blue-500 outline-none">
          <option value="">Todos los tipos</option>
          {['SETTLEMENT','REFUND','CHARGEBACK','DISPUTE','WITHDRAWAL','CASHBACK',
            'SETTLEMENT_SHIPPING','REFUND_SHIPPING','CHARGEBACK_SHIPPING'].map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select value={reconFilter} onChange={e => setReconFilter(e.target.value)}
          className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm focus:border-blue-500 outline-none">
          <option value="">Todos los estados</option>
          {Object.entries(RECON_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {isLoading && <p className="text-slate-500 text-sm">Cargando transacciones...</p>}
      {!isLoading && transactions.length === 0 && (
        <p className="text-slate-500 text-sm">No se encontraron transacciones con los filtros actuales.</p>
      )}
      {transactions.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700 text-left">
                <th className="pb-2 pr-3 font-medium">Fecha</th>
                <th className="pb-2 pr-3 font-medium">Tipo</th>
                <th className="pb-2 pr-3 font-medium text-right">Monto</th>
                <th className="pb-2 pr-3 font-medium text-right">Neto</th>
                <th className="pb-2 pr-3 font-medium">Referencia externa</th>
                <th className="pb-2 pr-3 font-medium">Pagador</th>
                <th className="pb-2 pr-3 font-medium">Conciliación</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {transactions.map(txn => (
                <TxnRow
                  key={txn.id} txn={txn}
                  onUpdateRecon={(s) => updateRecon.mutate({ id: txn.id, status: s })}
                />
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-slate-500">
              {transactions.length} transacciones · página {page + 1}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="text-xs px-2.5 py-1 bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors">
                Anterior
              </button>
              <button onClick={() => setPage(p => p + 1)} disabled={transactions.length < TXN_PAGE_SIZE}
                className="text-xs px-2.5 py-1 bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors">
                Siguiente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TxnRow({ txn, onUpdateRecon }: {
  txn: MpTransaction; onUpdateRecon: (s: MpReconciliationStatus) => void
}) {
  const typeColor  = TXN_TYPE_COLOR[txn.transaction_type] ?? 'text-slate-300'
  const reconColor = RECON_COLOR[txn.reconciliation_status] ?? 'text-slate-400'
  const [showMenu, setShowMenu] = useState(false)

  return (
    <tr className="hover:bg-slate-800/50 transition-colors">
      <td className="py-2 pr-3 text-slate-400">{txn.transaction_date.slice(0, 10)}</td>
      <td className={`py-2 pr-3 font-medium ${typeColor}`}>{txn.transaction_type}</td>
      <td className="py-2 pr-3 text-right">{fmtARS(txn.transaction_amount)}</td>
      <td className={`py-2 pr-3 text-right ${txn.settlement_net_amount < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
        {fmtARS(txn.settlement_net_amount)}
      </td>
      <td className="py-2 pr-3 text-slate-400 max-w-[160px] truncate" title={txn.external_reference}>
        {txn.external_reference || txn.source_id}
      </td>
      <td className="py-2 pr-3 text-slate-400 max-w-[120px] truncate" title={txn.payer_name}>
        {txn.payer_name}
      </td>
      <td className={`py-2 pr-3 ${reconColor}`}>
        {RECON_LABEL[txn.reconciliation_status] ?? txn.reconciliation_status}
      </td>
      <td className="py-2 relative">
        <button onClick={() => setShowMenu(v => !v)}
          className="text-slate-500 hover:text-slate-300 transition-colors px-1 text-base leading-none">
          ⋯
        </button>
        {showMenu && (
          <div className="absolute right-0 top-6 z-10 bg-slate-800 border border-slate-700 rounded shadow-xl text-sm w-40">
            {(['confirmed', 'rejected', 'needs_review', 'ignored'] as MpReconciliationStatus[]).map(s => (
              <button key={s} onClick={() => { onUpdateRecon(s); setShowMenu(false) }}
                className="block w-full text-left px-3 py-2 hover:bg-slate-700 transition-colors text-slate-300">
                {RECON_LABEL[s]}
              </button>
            ))}
            <button onClick={() => setShowMenu(false)}
              className="block w-full text-left px-3 py-2 hover:bg-slate-700 text-slate-500 border-t border-slate-700">
              Cerrar
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}

// ─── Tab Configuración ────────────────────────────────────────────────────────

// ─── Columnas conocidas del Settlement Report de MP ──────────────────────────
// stored: true = Summit tiene campo individual en mercadopago_transactions
// stored: false = aparece en el CSV y se guarda en raw_row_json únicamente

const MP_COLUMN_GROUPS: { group: string; cols: { id: string; label: string; stored: boolean }[] }[] = [
  { group: 'Identificadores', cols: [
    { id: 'SOURCE_ID',          label: 'ID del pago en MP',          stored: true },
    { id: 'EXTERNAL_REFERENCE', label: 'Referencia externa (tuya)',   stored: true },
    { id: 'ORDER_ID',           label: 'ID de orden',                 stored: true },
    { id: 'AUTHORIZATION_CODE', label: 'Código de autorización',      stored: true },
    { id: 'APPLICATION_ID',     label: 'ID de aplicación',            stored: true },
    { id: 'SHIPPING_ID',        label: 'ID de envío',                 stored: true },
  ]},
  { group: 'Fechas', cols: [
    { id: 'TRANSACTION_DATE',   label: 'Fecha de transacción',        stored: true },
    { id: 'SETTLEMENT_DATE',    label: 'Fecha de liquidación',         stored: true },
    { id: 'MONEY_RELEASE_DATE', label: 'Fecha de liberación del dinero', stored: true },
    { id: 'ACCREDITED_ON_DATE', label: 'Fecha de acreditación',       stored: false },
  ]},
  { group: 'Montos', cols: [
    { id: 'TRANSACTION_AMOUNT',          label: 'Monto bruto de transacción',   stored: true },
    { id: 'TRANSACTION_CURRENCY',        label: 'Moneda de transacción',         stored: true },
    { id: 'SETTLEMENT_NET_AMOUNT',       label: 'Monto neto liquidado',          stored: true },
    { id: 'SETTLEMENT_CURRENCY',         label: 'Moneda de liquidación',          stored: false },
    { id: 'FEE_AMOUNT',                  label: 'Comisión MP',                    stored: true },
    { id: 'TAXES_AMOUNT',                label: 'Impuestos (IVA, IIBB, etc.)',    stored: true },
    { id: 'FINANCING_FEE_AMOUNT',        label: 'Comisión de financiamiento',     stored: false },
    { id: 'SHIPPING_FEE_AMOUNT',         label: 'Comisión de envío',              stored: false },
    { id: 'COUPON_AMOUNT',               label: 'Descuento por cupón',            stored: false },
    { id: 'NET_CREDIT_AMOUNT',           label: 'Crédito neto',                   stored: false },
    { id: 'NET_DEBIT_AMOUNT',            label: 'Débito neto',                    stored: false },
    { id: 'GROSS_AMOUNT',                label: 'Monto bruto (alternativo)',       stored: false },
    { id: 'SELLER_AMOUNT',               label: 'Monto al vendedor',              stored: false },
    { id: 'MARKETPLACE_FEE_AMOUNT',      label: 'Comisión de marketplace',        stored: false },
    { id: 'ACCUMULATED_ORIGINAL_AMOUNT', label: 'Monto original acumulado',       stored: false },
  ]},
  { group: 'Método de pago', cols: [
    { id: 'PAYMENT_METHOD',      label: 'Medio de pago (Visa, Rapipago…)', stored: true },
    { id: 'PAYMENT_METHOD_TYPE', label: 'Tipo de medio (credit_card…)',     stored: true },
    { id: 'INSTALLMENTS',        label: 'Cuotas',                           stored: true },
    { id: 'LAST_FOUR_DIGITS',    label: 'Últimos 4 dígitos de tarjeta',     stored: true },
  ]},
  { group: 'Comprador', cols: [
    { id: 'PAYER_NAME',      label: 'Nombre del comprador',   stored: true },
    { id: 'PAYER_ID_TYPE',   label: 'Tipo de ID (DNI, CUIT)', stored: true },
    { id: 'PAYER_ID_NUMBER', label: 'Número de ID',            stored: true },
  ]},
  { group: 'Tienda / POS', cols: [
    { id: 'STORE_ID',   label: 'ID de tienda',    stored: true },
    { id: 'STORE_NAME', label: 'Nombre de tienda', stored: true },
    { id: 'POS_ID',     label: 'ID de caja',       stored: true },
    { id: 'POS_NAME',   label: 'Nombre de caja',   stored: true },
  ]},
  { group: 'Tipo y descripción', cols: [
    { id: 'TRANSACTION_TYPE', label: 'Tipo de transacción (payment, refund…)', stored: true },
    { id: 'DESCRIPTION',      label: 'Descripción del pago',                    stored: true },
    { id: 'RECORD_TYPE',      label: 'Tipo de registro (RESERVE, SETTLEMENT…)', stored: false },
  ]},
]

function ConfiguracionTab({
  selectedConn, canWrite,
}: { selectedConn: string | null; canWrite: boolean }) {
  const { data: connections = [] } = useMpConnections()
  const connId = selectedConn ?? connections[0]?.id ?? null
  const { data: defaultConfig } = useMpDefaultConfig()
  const { data: remoteConfig, isLoading } = useMpReportConfig(connId)
  const setConfig = useSetMpReportConfig()
  const [form, setForm] = useState<MpReportConfig | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const src = remoteConfig ?? defaultConfig
    if (src && !form) setForm({ ...src })
  }, [remoteConfig, defaultConfig])

  if (!connId) return (
    <div className="p-6 text-slate-500 text-sm">Seleccioná una conexión en la tab Conexiones.</div>
  )
  if (isLoading || !form) return <div className="p-6 text-slate-400 text-sm">Cargando configuración...</div>

  const upd = <K extends keyof MpReportConfig>(key: K, val: MpReportConfig[K]) =>
    setForm(f => f ? { ...f, [key]: val } : f)

  const hasCol = (col: string) => form.columns?.includes(col) ?? false
  const toggleCol = (col: string) =>
    upd('columns', hasCol(col) ? form.columns.filter(c => c !== col) : [...(form.columns ?? []), col])

  async function handleSave() {
    if (!connId || !form) return
    await setConfig.mutateAsync({ connectionId: connId, config: form })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const inp = 'px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm focus:border-blue-500 outline-none w-full disabled:opacity-50'

  const BOOL_FIELDS: [keyof MpReportConfig, string][] = [
    ['include_withdraw',      'Incluir retiros'],
    ['show_fee_prevision',    'Mostrar comisiones previstas'],
    ['show_chargeback_cancel','Contracargos cancelados'],
    ['refund_detailed',       'Devoluciones detalladas'],
    ['coupon_detailed',       'Cupones detallados'],
    ['shipping_detail',       'Detalle de envíos'],
  ]

  return (
    <div className="p-6 max-w-2xl space-y-6 overflow-y-auto">
      <p className="text-sm text-slate-400">
        Configuración aplicada a la API de Mercado Pago. Determina el formato y columnas de los reportes de liquidación.
      </p>

      {/* ─ Formato ─ */}
      <section className="space-y-2">
        <p className="text-xs text-slate-500 uppercase tracking-wider">Formato del reporte</p>
        <div className="bg-slate-800 border border-slate-700 rounded-lg divide-y divide-slate-700">
          <div className="flex items-center gap-4 px-4 py-3">
            <span className="text-slate-400 text-sm w-44 shrink-0">Prefijo de archivo</span>
            <input value={form.file_name_prefix} disabled={!canWrite}
              onChange={e => upd('file_name_prefix', e.target.value)} className={inp} />
          </div>
          <div className="flex items-center gap-4 px-4 py-3">
            <span className="text-slate-400 text-sm w-44 shrink-0">Timezone</span>
            <select value={form.display_timezone} disabled={!canWrite}
              onChange={e => upd('display_timezone', e.target.value)} className={inp}>
              <option value="America/Argentina/Buenos_Aires">America/Argentina/Buenos_Aires (GMT-3)</option>
              <option value="GMT-03">GMT-03</option>
              <option value="GMT-04">GMT-04</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
          <div className="flex items-center gap-4 px-4 py-3">
            <span className="text-slate-400 text-sm w-44 shrink-0">Separador</span>
            <select value={form.separator} disabled={!canWrite}
              onChange={e => upd('separator', e.target.value)} className={inp}>
              <option value=";">; (punto y coma — recomendado)</option>
              <option value=",">, (coma)</option>
            </select>
          </div>
          <div className="flex items-center gap-4 px-4 py-3">
            <span className="text-slate-400 text-sm w-44 shrink-0">Idioma de cabeceras</span>
            <select value={form.header_language} disabled={!canWrite}
              onChange={e => upd('header_language', e.target.value)} className={inp}>
              <option value="es">Español (es)</option>
              <option value="en">Inglés (en)</option>
              <option value="pt">Portugués (pt)</option>
            </select>
          </div>
          <div className="flex items-center gap-4 px-4 py-3">
            <span className="text-slate-400 text-sm w-44 shrink-0">Reporte automático</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Diario a las</span>
              <input type="number" min={0} max={23} disabled={!canWrite}
                value={form.frequency?.hour ?? 3}
                onChange={e => upd('frequency', { type: 'daily', hour: Math.max(0, Math.min(23, parseInt(e.target.value) || 0)) })}
                className="px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm focus:border-blue-500 outline-none w-16 text-center disabled:opacity-50" />
              <span className="text-sm text-slate-400">hs</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─ Opciones booleanas ─ */}
      <section className="space-y-2">
        <p className="text-xs text-slate-500 uppercase tracking-wider">Opciones</p>
        <div className="bg-slate-800 border border-slate-700 rounded-lg divide-y divide-slate-700">
          {BOOL_FIELDS.map(([key, label]) => (
            <label key={key} className="flex items-center justify-between px-4 py-3 text-sm cursor-pointer">
              <span className="text-slate-400">{label}</span>
              <input type="checkbox" checked={!!form[key]} disabled={!canWrite}
                onChange={() => upd(key, !form[key] as MpReportConfig[typeof key])}
                className="w-4 h-4 rounded accent-blue-500" />
            </label>
          ))}
        </div>
      </section>

      {/* ─ Columnas ─ */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500 uppercase tracking-wider">
            Columnas — <span className="text-blue-400 font-medium">{form.columns?.length ?? 0} seleccionadas</span>
          </p>
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            Summit almacena en campo propio
          </span>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-5">
          {MP_COLUMN_GROUPS.map(g => (
            <div key={g.group}>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-2">{g.group}</p>
              <div className="space-y-1">
                {g.cols.map(col => (
                  <label key={col.id} className="flex items-center gap-3 text-xs cursor-pointer select-none hover:bg-slate-700/40 rounded px-2 py-1">
                    <input type="checkbox" checked={hasCol(col.id)} disabled={!canWrite}
                      onChange={() => toggleCol(col.id)}
                      className="w-3.5 h-3.5 rounded accent-blue-500 shrink-0" />
                    <code className="text-blue-300 font-mono shrink-0">{col.id}</code>
                    <span className="text-slate-400">{col.label}</span>
                    {col.stored && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Summit guarda este campo" />}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs text-slate-500 border-t border-slate-700 pt-3">
            Todas las columnas del CSV se guardan siempre en <code className="text-blue-300">raw_row_json</code>.
            Las columnas sin punto verde son accesibles desde ahí pero no tienen filtro en la tab Transacciones.
          </p>
        </div>
      </section>

      {canWrite && (
        <div className="flex items-center gap-3 pb-4">
          <button onClick={handleSave} disabled={setConfig.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded text-sm text-white transition-colors">
            {setConfig.isPending ? <Loader2 size={13} className="animate-spin" /> : <Settings size={13} />}
            Aplicar configuración en Mercado Pago
          </button>
          {saved && (
            <span className="text-sm text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={13} /> Guardado
            </span>
          )}
        </div>
      )}

      <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-3 text-xs text-amber-300 mb-6">
        <strong>Nota:</strong> Aplicar sobreescribe la configuración en la cuenta de MP. El access token necesita permiso de escritura sobre reportes.
      </div>
    </div>
  )
}

// ─── Subcomponentes comunes ───────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  )
}
