import { useState, useEffect, useRef } from 'react'
import {
  Wifi, WifiOff, Plus, Trash2, RefreshCw, Download, ChevronRight,
  CheckCircle2, AlertCircle, Settings, List, CreditCard,
  Eye, EyeOff, Loader2, PlugZap, CalendarRange, Copy,
  ExternalLink, FolderOpen,
} from 'lucide-react'
import dayjs from 'dayjs'
import {
  useMpConnections, useCreateMpConnection, useDeleteMpConnection,
  useTestMpConnection, useUpdateMpToken,
  useMpJobs, useRequestMpReport, useDownloadMpJob, usePollMpJob,
  useOpenMpJobFile, useShowMpJobInFolder,
  useMpTransactions, useUpdateMpReconStatus, useMpTransactionStats,
  useMpReportConfig, useSetMpReportConfig, useMpDefaultConfig,
} from '../../hooks/useMercadoPago'
import { usePermissions } from '../../hooks/usePermissions'
import type {
  MpConnectionWithCreds, MpReportJob, MpTransaction,
  MpReconciliationStatus,
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

type Tab = 'conexiones' | 'sincronizacion' | 'transacciones' | 'configuracion'

// ─── Componente principal ─────────────────────────────────────────────────────

export default function MPDashboard() {
  const [tab, setTab] = useState<Tab>('conexiones')
  const [selectedConn, setSelectedConn] = useState<string | null>(null)
  const { canWrite } = usePermissions()

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
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

// ─── Tab Conexiones ───────────────────────────────────────────────────────────

function ConexionesTab({
  selectedConn, onSelectConn, canWrite,
}: { selectedConn: string | null; onSelectConn: (id: string | null) => void; canWrite: boolean }) {
  const { data: connections = [], isLoading } = useMpConnections()
  const createConn   = useCreateMpConnection()
  const deleteConn   = useDeleteMpConnection()
  const testConn     = useTestMpConnection()
  const updateToken  = useUpdateMpToken()

  const [showForm, setShowForm]         = useState(false)
  const [formName, setFormName]         = useState('')
  const [formLabel, setFormLabel]       = useState('')
  const [formToken, setFormToken]       = useState('')
  const [showToken, setShowToken]       = useState(false)
  const [editTokenId, setEditTokenId]   = useState<string | null>(null)
  const [newToken, setNewToken]         = useState('')
  const [testMsg, setTestMsg]           = useState<string | null>(null)

  async function handleCreate() {
    if (!formName || !formToken) return
    const res = await createConn.mutateAsync({
      input: { name: formName, account_label: formLabel || formName, access_token: formToken, environment: 'production' },
      userId: '',
    })
    setTestMsg(res.test.ok ? `Conectado · ID: ${res.test.user_id ?? ''}` : `Error: ${res.test.error}`)
    setShowForm(false); setFormName(''); setFormLabel(''); setFormToken('')
  }

  if (isLoading) return <div className="p-6 text-slate-400 text-sm">Cargando...</div>

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      {testMsg && (
        <div className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-300">{testMsg}</div>
      )}

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
            setTestMsg(r.ok ? `OK · ID: ${r.user_id ?? ''}` : `Error: ${r.error}`)
          }}
          editTokenId={editTokenId}
          newToken={newToken}
          onSetEditToken={(id) => { setEditTokenId(id); setNewToken('') }}
          onNewTokenChange={setNewToken}
          onSaveToken={async () => {
            if (!editTokenId || !newToken) return
            const r = await updateToken.mutateAsync({ connectionId: editTokenId, newToken })
            setTestMsg(r.ok ? 'Token actualizado y verificado' : `Error: ${r.error}`)
            setEditTokenId(null); setNewToken('')
          }}
          isSavingToken={updateToken.isPending}
        />
      ))}

      {showForm && (
        <div className="border border-blue-500/40 rounded-lg p-4 bg-slate-800 space-y-3">
          <p className="font-medium text-sm text-blue-400">Nueva conexión</p>
          <input value={formName} onChange={e => setFormName(e.target.value)}
            placeholder="Nombre (ej: Naka Principal)"
            className="w-full px-3 py-2 bg-slate-700 rounded text-sm border border-slate-600 focus:border-blue-500 outline-none" />
          <input value={formLabel} onChange={e => setFormLabel(e.target.value)}
            placeholder="Etiqueta de cuenta (opcional)"
            className="w-full px-3 py-2 bg-slate-700 rounded text-sm border border-slate-600 focus:border-blue-500 outline-none" />
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
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={createConn.isPending || !formName || !formToken}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded text-sm text-white transition-colors flex items-center gap-1.5">
              {createConn.isPending && <Loader2 size={13} className="animate-spin" />}
              Conectar
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm transition-colors">
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
  const requestReport  = useRequestMpReport()
  const downloadJob    = useDownloadMpJob()
  const pollJob        = usePollMpJob()
  const openFile       = useOpenMpJobFile()
  const showInFolder   = useShowMpJobInFolder()

  const [dateFrom, setDateFrom] = useState(dayjs().subtract(7, 'day').format('YYYY-MM-DD'))
  const [dateTo, setDateTo]     = useState(dayjs().format('YYYY-MM-DD'))
  const [syncMsg, setSyncMsg]   = useState<string | null>(null)

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
    setSyncMsg('Solicitando reporte a Mercado Pago...')
    try {
      await requestReport.mutateAsync({ connectionId: connId, dateFrom, dateTo, requestedBy: 'manual' })
      setSyncMsg('Reporte solicitado. Mercado Pago lo generará en unos minutos — el historial se actualiza automáticamente.')
    } catch (err) {
      setSyncMsg((err as Error).message)
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
        {syncMsg && (
          <p className="text-xs text-slate-300 bg-slate-700/50 px-3 py-2 rounded">{syncMsg}</p>
        )}
        {canWrite && (
          <button onClick={handleSync} disabled={requestReport.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded text-sm text-white transition-colors">
            {requestReport.isPending ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {requestReport.isPending ? 'Solicitando...' : 'Sincronizar'}
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
            onOpenFile={() => openFile.mutate(job.id)}
            onShowInFolder={() => showInFolder.mutate(job.id)}
            isPollPending={pollJob.isPending && pollJob.variables === job.id}
            isDownloadPending={downloadJob.isPending && downloadJob.variables === job.id}
            downloadError={downloadJob.isError && downloadJob.variables === job.id
              ? (downloadJob.error as Error)?.message
              : undefined}
          />
        ))}
      </div>
    </div>
  )
}

function JobRow({ job, onDownload, onPoll, onOpenFile, onShowInFolder, canWrite, isPollPending = false, isDownloadPending = false, downloadError }: {
  job: MpReportJob; onDownload: () => void; onPoll: () => void
  onOpenFile: () => void; onShowInFolder: () => void
  canWrite: boolean; isPollPending?: boolean; isDownloadPending?: boolean; downloadError?: string
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
          <button onClick={onPoll} disabled={isPollPending}
            className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded transition-colors flex items-center gap-1 shrink-0">
            {isPollPending ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            {isPollPending ? 'Verificando...' : 'Verificar'}
          </button>
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

function TransaccionesTab({ selectedConn }: { selectedConn: string | null }) {
  const { data: connections = [] } = useMpConnections()
  const connId = selectedConn ?? connections[0]?.id ?? null
  const { data: stats } = useMpTransactionStats(connId)

  const [search, setSearch]         = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [reconFilter, setReconFilter] = useState('')
  const [dateFrom, setDateFrom]     = useState('')
  const [dateTo, setDateTo]         = useState('')

  const { data: transactions = [], isLoading } = useMpTransactions({
    connection_id:        connId ?? undefined,
    search:               search || undefined,
    transaction_type:     typeFilter || undefined,
    reconciliation_status: (reconFilter || undefined) as MpReconciliationStatus | undefined,
    date_from:            dateFrom || undefined,
    date_to:              dateTo || undefined,
    limit: 200,
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
          <p className="text-xs text-slate-500 mt-2">{transactions.length} transacciones (máx. 200)</p>
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
