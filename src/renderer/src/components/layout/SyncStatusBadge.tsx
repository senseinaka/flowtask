import { useState } from 'react'
import { Cloud, CloudOff, RefreshCw, AlertTriangle, Copy, Check, RotateCcw } from 'lucide-react'
import { usePowerSyncStatus } from '../../hooks/usePowerSyncStatus'

export function formatLastSync(timestamp: number | null): string {
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
  const [copied,       setCopied]       = useState(false)
  const [expanded,     setExpanded]     = useState(false)
  const [reconnecting, setReconnecting] = useState(false)

  if (!status) return null

  const syncing      = status.uploading || status.downloading || status.connecting
  const isDisconnected = !status.connected && !status.connecting

  let icon      = <Cloud size={14} />
  let label     = `Sincronizado · ${formatLastSync(status.lastSyncedAt)}`
  let className = 'text-emerald-400'
  let errorText: string | null = null

  if (status.configError) {
    icon      = <AlertTriangle size={14} />
    label     = 'Sync no configurado'
    className = 'text-amber-400'
    errorText = status.configError
  } else if (status.hasError) {
    icon      = <AlertTriangle size={14} />
    label     = 'Error de sincronización'
    className = 'text-amber-400'
    errorText = status.lastErrorMessage ?? null
  } else if (syncing) {
    icon      = <RefreshCw size={14} className="animate-spin" />
    label     = status.connecting ? 'Conectando...' : 'Sincronizando...'
    className = 'text-indigo-400'
  } else if (!status.connected) {
    icon      = <CloudOff size={14} />
    label     = `Sin conexión · ${formatLastSync(status.lastSyncedAt)}`
    className = 'text-slate-400'
    errorText = status.lastErrorMessage ?? 'Sin detalles del error de conexión.'
  }

  async function handleReconnect(e: React.MouseEvent) {
    e.stopPropagation()
    if (reconnecting) return
    setReconnecting(true)
    try {
      await window.api.powersync.reconnect()
    } catch (err) {
      console.error('[SyncStatusBadge] reconnect:', err)
    } finally {
      setReconnecting(false)
    }
  }

  function copyLog(e?: React.MouseEvent) {
    e?.stopPropagation()
    const text = errorText ?? `[PowerSync] ${label} — ${new Date().toISOString()}`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const hasDetail = !!errorText

  return (
    <div className="flex flex-col gap-1.5">
      {/* Badge principal */}
      <div
        onClick={() => hasDetail && setExpanded(p => !p)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-900 border border-slate-700 select-none ${className} ${hasDetail ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {icon}
        <span className="flex-1 truncate">{label}</span>
        {hasDetail && (
          <span className="text-[10px] opacity-60 ml-1">{expanded ? '▲' : '▼'}</span>
        )}
      </div>

      {/* Detalle expandible */}
      {hasDetail && expanded && (
        <div className="bg-slate-950 border border-amber-800/40 rounded-lg p-2.5 text-[10px] text-slate-300 font-mono">
          <p className="break-all leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
            {errorText}
          </p>
          <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-800">
            <button
              onClick={copyLog}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-200 transition-colors"
            >
              {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
              <span className="text-[10px] font-sans">{copied ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Botón reconectar — solo cuando está desconectado */}
      {isDisconnected && (
        <button
          onClick={handleReconnect}
          disabled={reconnecting}
          className="flex items-center justify-center gap-1.5 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors disabled:opacity-40"
        >
          <RotateCcw size={11} className={reconnecting ? 'animate-spin' : ''} />
          {reconnecting ? 'Reconectando...' : 'Reconectar'}
        </button>
      )}
    </div>
  )
}
