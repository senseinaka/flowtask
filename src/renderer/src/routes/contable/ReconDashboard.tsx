import { useState } from 'react'
import { BookOpen, ArrowLeftRight, Plus, Calendar } from 'lucide-react'
import { cn } from '../../components/ui/utils'

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

const SOURCES = [
  { label: 'Planilla Facturas + Clientes', detail: 'XLSX — fuente principal de facturas con desglose por medio de pago' },
  { label: 'Cupones de tarjeta',           detail: 'CSV (Latin-1) o XLSX — cupones de las procesadoras' },
  { label: 'Cobros ML Principal',          detail: 'XLS — operaciones de la cuenta principal de Mercado Pago' },
  { label: 'Cobros ML Secundaria',         detail: 'XLS — operaciones de la cuenta secundaria de Mercado Pago' },
]

export default function ReconDashboard() {
  const [showSources, setShowSources] = useState(false)

  const now  = new Date()
  const year = now.getFullYear()
  const mon  = now.getMonth() + 1

  return (
    <div className="flex flex-col h-full bg-slate-900">

      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-900/40 flex items-center justify-center">
            <BookOpen size={16} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Conciliador Contable</h1>
            <p className="text-xs text-slate-400">Naka Outdoors · Conciliación de ventas vs cobros reales</p>
          </div>
        </div>
        <button
          disabled
          className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Disponible en próxima fase"
        >
          <Plus size={14} />
          Nuevo período
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* Estado vacío */}
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Estado */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
              <ArrowLeftRight size={22} className="text-amber-400" />
            </div>
            <h2 className="text-white font-semibold mb-2">Sin períodos aún</h2>
            <p className="text-sm text-slate-400 max-w-sm mx-auto">
              Vas a poder conciliar las facturas de Naka Outdoors contra cupones de tarjeta
              y cobros de Mercado Pago, por período mensual.
            </p>
          </div>

          {/* Período sugerido */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={15} className="text-slate-400" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Período a conciliar</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-slate-700/50 rounded-lg px-4 py-3">
                <p className="text-sm text-slate-300 font-medium">
                  {MONTH_NAMES[mon - 2 < 0 ? 11 : mon - 2]} {mon - 2 < 0 ? year - 1 : year}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Mes anterior — más común para conciliar</p>
              </div>
              <div className="flex-1 bg-slate-700/50 rounded-lg px-4 py-3">
                <p className="text-sm text-slate-300 font-medium">
                  {MONTH_NAMES[mon - 1]} {year}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Mes actual</p>
              </div>
            </div>
          </div>

          {/* Fuentes de datos */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowSources((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-700/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ArrowLeftRight size={15} className="text-amber-400" />
                <span className="text-sm font-medium text-white">Fuentes de datos</span>
                <span className="text-xs text-slate-500">({SOURCES.length} archivos por período)</span>
              </div>
              <span className={cn(
                'text-xs text-slate-400 transition-transform',
                showSources && 'rotate-180'
              )}>▼</span>
            </button>

            {showSources && (
              <div className="border-t border-slate-700 divide-y divide-slate-700/50">
                {SOURCES.map((s, i) => (
                  <div key={i} className="px-5 py-3 flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-amber-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-amber-400">{i + 1}</span>
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium">{s.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{s.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Estados posibles */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Estados del resultado</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                ['conciliado',        '540 facturas — monto coincide exactamente'],
                ['dif_menor',         '23 facturas — diferencia aceptable (<5%)'],
                ['conciliado_monto',  '58 facturas — match por monto, no por nombre'],
                ['diferencia_monto',  '55 facturas — diferencia significativa'],
                ['rechazado_ml',      '12 facturas — pago rechazado en ML'],
                ['no_cobrado_ml',     '273 facturas — sin match en ML (efectivo, CTA CTE, etc.)'],
              ] as const).map(([estado, ejemplo]) => (
                <div key={estado} className="flex items-start gap-2 p-2 rounded-lg bg-slate-700/30">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
                    style={{ backgroundColor: {
                      conciliado: '#10b981', dif_menor: '#f59e0b',
                      conciliado_monto: '#3b82f6', diferencia_monto: '#f97316',
                      rechazado_ml: '#ef4444', no_cobrado_ml: '#94a3b8'
                    }[estado] }}
                  />
                  <div>
                    <p className="text-xs font-medium text-white">{estado.replace(/_/g, ' ')}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{ejemplo}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-600 mt-3">* Datos de ejemplo — mayo 2026</p>
          </div>

          {/* Próximos pasos */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Próximas fases</p>
            <div className="space-y-2 text-xs text-slate-500">
              <div className="flex items-center gap-2"><span className="w-5 h-5 rounded bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-400">2</span><span>Parsers de archivos (Flexxus, Cupones CSV/XLSX, ML Principal/Secundaria)</span></div>
              <div className="flex items-center gap-2"><span className="w-5 h-5 rounded bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-400">3</span><span>Motor de conciliación + IPC handlers</span></div>
              <div className="flex items-center gap-2"><span className="w-5 h-5 rounded bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-400">4</span><span>UI de carga de archivos + tabla de resultados</span></div>
              <div className="flex items-center gap-2"><span className="w-5 h-5 rounded bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-400">5</span><span>Override manual + auditoría + export XLSX</span></div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
