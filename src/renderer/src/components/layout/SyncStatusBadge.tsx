import { useState } from 'react'
import { Cloud, CloudOff, RefreshCw, AlertTriangle, Copy, Check } from 'lucide-react'
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
  const [copied, setCopied] = useState(false)

  if (!status) return null

  const syncing = status.uploading || status.downloading || status.connecting

  let icon = <Cloud size={14} />
  let label = `Sincronizado · ${formatLastSync(status.lastSyncedAt)}`
  let className = 'text-emerald-400'
  let errorText: string | null = null

  if (status.configError) {
    icon = <AlertTriangle size={14} />
    label = 'Sync no configurado'
    className = 'text-amber-400'
    errorText = status.configError
  } else if (status.hasError) {
    icon = <AlertTriangle size={14} />
    label = 'Error de sincronización'
    className = 'text-amber-400'
    errorText = status.lastErrorMessage ?? null
  } else if (syncing) {
    icon = <RefreshCw size={14} className="animate-spin" />
    label = status.connecting ? 'Conectando...' : 'Sincronizando...'
    className = 'text-indigo-400'
  } else if (!status.connected) {
    icon = <CloudOff size={14} />
    label = `Sin conexión · ${formatLastSync(status.lastSyncedAt)}`
    className = 'text-slate-500'
    errorText = status.lastErrorMessage ?? null
  }

  function copyLog(e?: React.MouseEvent) {
    e?.preventDefault()
    const text = errorText ?? `[PowerSync] ${label} — ${new Date().toISOString()}`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="relative group">
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-900 border border-slate-700 cursor-default select-none ${className}`}
        onContextMenu={copyLog}
      >
        {icon}
        <span>{copied ? '✓ Copiado' : label}</span>
      </div>

      {/* Tooltip con detalle del error */}
      {errorText && (
        <div className="absolute bottom-full right-0 mb-2 w-96 bg-slate-950 border border-slate-700 rounded-xl p-3 text-[11px] text-slate-300 font-mono hidden group-hover:block z-50 shadow-2xl">
          <div className="flex items-start gap-2">
            <p className="flex-1 break-all leading-relaxed whitespace-pre-wrap">{errorText}</p>
            <button
              onClick={copyLog}
              className="shrink-0 mt-0.5 p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-200 transition-colors"
              title="Copiar log"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            </button>
          </div>
          <p className="text-slate-600 mt-2 text-[10px] font-sans">Click derecho en el badge para copiar</p>
        </div>
      )}
    </div>
  )
}
