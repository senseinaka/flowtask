import { Cloud, CloudOff, RefreshCw, AlertTriangle } from 'lucide-react'
import { usePowerSyncStatus } from '../../hooks/usePowerSyncStatus'

function formatLastSync(timestamp: number | null): string {
  if (!timestamp) return 'nunca'
  const diffMs = Date.now() - timestamp
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'recién'
  if (diffMin < 60) return `hace ${diffMin} min`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `hace ${diffHr} h`
  return new Date(timestamp).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function SyncStatusBadge() {
  const status = usePowerSyncStatus()

  if (!status) return null

  const syncing = status.uploading || status.downloading || status.connecting

  let icon = <Cloud size={14} />
  let label = `Sincronizado · ${formatLastSync(status.lastSyncedAt)}`
  let className = 'text-emerald-400'
  let title = 'Estado de sincronización con la nube'

  if (status.configError) {
    icon = <AlertTriangle size={14} />
    label = 'Sync no configurado'
    className = 'text-amber-400'
    title = status.configError
  } else if (status.hasError) {
    icon = <AlertTriangle size={14} />
    label = 'Error de sincronización'
    className = 'text-amber-400'
    title = status.lastErrorMessage ?? title
  } else if (syncing) {
    icon = <RefreshCw size={14} className="animate-spin" />
    label = status.connecting ? 'Conectando...' : 'Sincronizando...'
    className = 'text-indigo-400'
  } else if (!status.connected) {
    icon = <CloudOff size={14} />
    label = `Sin conexión · ${formatLastSync(status.lastSyncedAt)}`
    className = 'text-slate-500'
    title = status.lastErrorMessage ?? title
  }

  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-900 border border-slate-700 ${className}`}
      title={title}
    >
      {icon}
      <span>{label}</span>
    </div>
  )
}
