import { useState, useEffect } from 'react'
import { X, Sparkles, UserPlus, RefreshCw, FolderOpen, CheckCircle2, AlertCircle } from 'lucide-react'
import { useGenerarDesdeUltimo, useConfirmarGenerar } from '../../hooks/useRrhh'
import type { GenerarDesdeUltimoResult } from '@shared/types'

interface Props {
  onClose: () => void
}

function fmtM(n: number) {
  return '$' + Math.round(n).toLocaleString('es-AR')
}

export default function GenerarNominaModal({ onClose }: Props) {
  const generarMutation  = useGenerarDesdeUltimo()
  const confirmarMutation = useConfirmarGenerar()

  const [preview, setPreview]       = useState<GenerarDesdeUltimoResult | null>(null)
  const [crearDrive, setCrearDrive] = useState(false)
  const [step, setStep]             = useState<'cargando' | 'preview' | 'listo' | 'error'>('cargando')
  const [resultado, setResultado]   = useState<{ creados: number; actualizados: number } | null>(null)

  useEffect(() => {
    generarMutation.mutate(undefined, {
      onSuccess: (data) => { setPreview(data); setStep('preview') },
      onError: () => setStep('error'),
    })
  }, [])

  function handleConfirmar() {
    if (!preview) return
    confirmarMutation.mutate(
      { input: { entries: preview.entries }, crearDrive },
      {
        onSuccess: (res) => { setResultado(res); setStep('listo') },
      }
    )
  }

  const nuevos     = preview?.entries.filter(e => e.esNuevo).length ?? 0
  const modificados = preview?.entries.filter(e => e.esModificado && !e.esNuevo).length ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={step !== 'listo' ? undefined : onClose} />
      <div className="relative flex flex-col w-[600px] max-h-[80vh] bg-slate-900 rounded-xl border border-slate-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-pink-400" />
            <h2 className="text-base font-semibold text-slate-100">Generar nómina desde última liquidación</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {step === 'cargando' && (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin" />
              <p className="text-sm">Analizando última liquidación...</p>
            </div>
          )}

          {step === 'error' && (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-red-400 p-6">
              <AlertCircle className="w-8 h-8" />
              <p className="text-sm text-center">
                {generarMutation.error?.message ?? 'Error al obtener la última liquidación. Asegurate de haber subido al menos un período de sueldos.'}
              </p>
            </div>
          )}

          {step === 'listo' && resultado && (
            <div className="flex flex-col items-center justify-center h-48 gap-3 p-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              <p className="text-base font-semibold text-slate-100">Nómina generada correctamente</p>
              <div className="flex gap-6 text-sm text-slate-400">
                <span><strong className="text-emerald-400">{resultado.creados}</strong> nuevos</span>
                <span><strong className="text-sky-400">{resultado.actualizados}</strong> actualizados</span>
              </div>
            </div>
          )}

          {step === 'preview' && preview && (
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3 text-sm text-slate-400 bg-slate-800 rounded-lg px-4 py-2.5">
                <span>Período: <strong className="text-slate-200">{preview.periodoLabel}</strong></span>
                <span className="border-l border-slate-600 pl-3">{preview.entries.length} colaboradores en la liquidación</span>
                {nuevos > 0 && <span className="border-l border-slate-600 pl-3 text-emerald-400">{nuevos} nuevos</span>}
                {modificados > 0 && <span className="border-l border-slate-600 pl-3 text-amber-400">{modificados} a actualizar</span>}
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-700">
                    <th className="pb-2 font-medium">Nombre</th>
                    <th className="pb-2 font-medium">Documento</th>
                    <th className="pb-2 font-medium text-right">Neto</th>
                    <th className="pb-2 font-medium text-center">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.entries.map((e, i) => (
                    <tr key={i} className="border-b border-slate-800">
                      <td className="py-2 text-slate-200">{e.nombre}</td>
                      <td className="py-2 font-mono text-xs text-slate-400">{e.documento}</td>
                      <td className="py-2 text-right font-mono text-slate-300">{fmtM(e.total_neto)}</td>
                      <td className="py-2 text-center">
                        {e.esNuevo ? (
                          <span className="flex items-center justify-center gap-1 text-emerald-400 text-xs">
                            <UserPlus className="w-3 h-3" /> Nuevo
                          </span>
                        ) : e.esModificado ? (
                          <span className="text-amber-400 text-xs">A actualizar</span>
                        ) : (
                          <span className="text-slate-600 text-xs">Sin cambios</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <label className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-800 rounded-lg cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={crearDrive}
                  onChange={e => setCrearDrive(e.target.checked)}
                  className="w-4 h-4 accent-pink-500"
                />
                <FolderOpen className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-300">Crear carpetas de legajo en Drive para colaboradores nuevos</span>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'preview' && (
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-700 flex-shrink-0">
            <button onClick={onClose} className="px-4 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleConfirmar}
              disabled={confirmarMutation.isPending}
              className="flex items-center gap-2 px-5 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {confirmarMutation.isPending ? 'Generando...' : 'Confirmar y generar'}
            </button>
          </div>
        )}

        {step === 'listo' && (
          <div className="flex justify-center px-5 py-3 border-t border-slate-700 flex-shrink-0">
            <button onClick={onClose} className="px-5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm transition-colors">
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
