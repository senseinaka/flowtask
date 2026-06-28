import { useState } from 'react'
import { X, Loader2, FileSpreadsheet, CheckCircle2 } from 'lucide-react'
import { cn } from '../../components/ui/utils'
import type { CashboxWithBalance } from '@shared/types'

function today(): string { return new Date().toISOString().slice(0, 10) }
function firstOfMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default function ReporteModal({
  box,
  onClose,
}: {
  box: CashboxWithBalance
  onClose: () => void
}) {
  const [dateFrom,  setDateFrom]  = useState(firstOfMonth())
  const [dateTo,    setDateTo]    = useState(today())
  const [loading,   setLoading]   = useState(false)
  const [savedPath, setSavedPath] = useState<string | null>(null)
  const [error,     setError]     = useState<string | null>(null)

  async function handleExport() {
    setError(null)
    setSavedPath(null)
    if (!dateFrom || !dateTo) { setError('Completá el rango de fechas.'); return }
    if (dateFrom > dateTo)    { setError('La fecha desde no puede ser posterior a la fecha hasta.'); return }

    setLoading(true)
    try {
      const result = await window.api.cajas.report.export(box.id, box.name, dateFrom, dateTo)
      if (result) setSavedPath(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al exportar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={14} className="text-emerald-400" />
              <p className="text-sm font-semibold text-slate-100">Exportar reporte</p>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">{box.name} · {box.company?.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          <p className="text-[11px] text-slate-500">
            Genera un Excel con tres hojas: Movimientos (filtrados por fecha), Diferencias y Conteos.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">
                Desde
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">
                Hasta
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {savedPath && (
            <div className="flex items-start gap-2 bg-emerald-900/20 border border-emerald-800/50 rounded-lg px-3 py-2">
              <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-emerald-300 font-medium">Archivo guardado</p>
                <p className="text-[10px] text-emerald-600 break-all mt-0.5">{savedPath}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end px-5 py-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg"
          >
            Cerrar
          </button>
          <button
            onClick={handleExport}
            disabled={loading}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors',
              'bg-emerald-900/40 text-emerald-300 border-emerald-700 hover:bg-emerald-900/60',
              loading && 'opacity-40 cursor-not-allowed'
            )}
          >
            {loading
              ? <><Loader2 size={13} className="animate-spin" /> Exportando…</>
              : <><FileSpreadsheet size={13} /> Exportar Excel</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}
