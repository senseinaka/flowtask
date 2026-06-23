import { useState } from 'react'
import { X, Upload, Download, AlertTriangle, CheckCircle, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react'
import { useExportTemplate, useParseImport, useConfirmImport } from '../../hooks/useRrhh'
import type { ImportParseResult, ImportParsedRow, LegajoDecision } from '@shared/types'

interface Props {
  onClose: () => void
}

type Step = 'upload' | 'preview' | 'legajos' | 'confirmar' | 'done'

const ESTADO_LABELS: Record<string, string> = {
  activo: 'Activo', inactivo: 'Inactivo', licencia: 'Licencia',
  suspendido: 'Suspendido', externo: 'Externo',
}
const CONTRATACION_LABELS: Record<string, string> = {
  relacion_dependencia: 'Rel. dependencia', monotributo: 'Monotributo',
  eventual: 'Eventual', otro: 'Otro',
}

function StatusBadge({ status }: { status: ImportParsedRow['status'] }) {
  if (status === 'create') return <span className="px-2 py-0.5 rounded text-xs bg-emerald-900/60 text-emerald-300 border border-emerald-800">Nuevo</span>
  if (status === 'update') return <span className="px-2 py-0.5 rounded text-xs bg-amber-900/60 text-amber-300 border border-amber-800">Actualizar</span>
  return <span className="px-2 py-0.5 rounded text-xs bg-red-900/60 text-red-300 border border-red-800">Error</span>
}

export default function ImportarNominaModal({ onClose }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [parseResult, setParseResult] = useState<ImportParseResult | null>(null)
  const [legajoDecisions, setLegajoDecisions] = useState<LegajoDecision[]>([])
  const [overwriteConfirmed, setOverwriteConfirmed] = useState(false)
  const [doneResult, setDoneResult] = useState<{ created: number; updated: number } | null>(null)

  const exportTemplate = useExportTemplate()
  const parseImport    = useParseImport()
  const confirmImport  = useConfirmImport()

  async function handleSelectFile() {
    const filePath = await window.api.rrhh.nomina.selectImportFile()
    if (!filePath) return
    const result = await parseImport.mutateAsync(filePath)
    setParseResult(result)

    // Inicializar decisiones de legajo: por defecto "mantener actual"
    const decisions: LegajoDecision[] = result.rows
      .filter(r => r.legajoConflict)
      .map(r => ({
        rowIndex: r.rowIndex,
        existingId: r.existingId!,
        nombre: r.nombre,
        existingLegajo: r.existingLegajo!,
        planillaLegajo: r.legajo,
        keep: true,
      }))
    setLegajoDecisions(decisions)
    setStep('preview')
  }

  function handleGoToLegajos() {
    if (legajoDecisions.length > 0) setStep('legajos')
    else setStep('confirmar')
  }

  function toggleDecision(rowIndex: number) {
    setLegajoDecisions(prev =>
      prev.map(d => d.rowIndex === rowIndex ? { ...d, keep: !d.keep } : d)
    )
  }

  async function handleConfirm() {
    if (!parseResult) return
    const result = await confirmImport.mutateAsync({
      rows: parseResult.rows,
      legajoDecisions,
    })
    setDoneResult(result)
    setStep('done')
  }

  const validRows   = parseResult?.rows.filter(r => r.status !== 'error') ?? []
  const errorRows   = parseResult?.rows.filter(r => r.status === 'error') ?? []
  const updateRows  = parseResult?.rows.filter(r => r.status === 'update') ?? []
  const hasOverwrites = updateRows.some(r => r.changedFields.length > 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative flex flex-col w-full max-w-3xl max-h-[90vh] bg-slate-900 rounded-xl border border-slate-700 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Importar colaboradores</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {step === 'upload'    && 'Paso 1: seleccionar archivo'}
              {step === 'preview'   && 'Paso 2: revisar datos'}
              {step === 'legajos'   && 'Paso 3: conflictos de legajo'}
              {step === 'confirmar' && 'Paso 4: confirmar importación'}
              {step === 'done'      && 'Importación completada'}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Step 1: Upload ── */}
          {step === 'upload' && (
            <div className="flex flex-col items-center justify-center gap-6 py-16 px-6">
              <div className="text-center">
                <p className="text-slate-300 text-sm mb-1">
                  Primero descargá la plantilla, completala y luego importala.
                </p>
                <p className="text-slate-500 text-xs">
                  Los campos con * son obligatorios. No incluyas columnas de sueldo.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => exportTemplate.mutate()}
                  disabled={exportTemplate.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm transition-colors disabled:opacity-50"
                >
                  {exportTemplate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Descargar plantilla
                </button>
                <button
                  onClick={handleSelectFile}
                  disabled={parseImport.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {parseImport.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Seleccionar archivo .xlsx
                </button>
              </div>
              {parseImport.isError && (
                <p className="text-red-400 text-xs">{String(parseImport.error)}</p>
              )}
            </div>
          )}

          {/* ── Step 2: Preview ── */}
          {step === 'preview' && parseResult && (
            <div className="p-5 space-y-4">
              {/* Resumen */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Total',    val: parseResult.stats.total,      cls: 'text-slate-200' },
                  { label: 'Nuevos',   val: parseResult.stats.toCreate,   cls: 'text-emerald-400' },
                  { label: 'Actualizar', val: parseResult.stats.toUpdate, cls: 'text-amber-400' },
                  { label: 'Errores',  val: parseResult.stats.withErrors, cls: 'text-red-400' },
                ].map(({ label, val, cls }) => (
                  <div key={label} className="bg-slate-800/60 rounded-lg p-3 text-center">
                    <div className={`text-2xl font-bold ${cls}`}>{val}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{label}</div>
                  </div>
                ))}
              </div>

              {/* Advertencia errores */}
              {errorRows.length > 0 && (
                <div className="bg-red-950/40 border border-red-800/60 rounded-lg p-3">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-red-300 text-xs font-medium">
                      {errorRows.length} {errorRows.length === 1 ? 'fila no se importará' : 'filas no se importarán'} por errores:
                    </p>
                  </div>
                  <ul className="space-y-0.5 pl-6">
                    {errorRows.map(r => (
                      <li key={r.rowIndex} className="text-xs text-red-400">
                        Fila {r.rowIndex + 1} — {r.nombre || '(sin nombre)'}: {r.errors.join(', ')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Advertencia sobreescritura */}
              {hasOverwrites && (
                <div className="bg-amber-950/40 border border-amber-800/60 rounded-lg p-3">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-amber-300 text-xs font-medium">
                      Los siguientes colaboradores tienen campos que se sobreescribirán:
                    </p>
                  </div>
                  <ul className="space-y-0.5 pl-6">
                    {updateRows.filter(r => r.changedFields.length > 0).map(r => (
                      <li key={r.rowIndex} className="text-xs text-amber-400">
                        {r.nombre}: {r.changedFields.join(', ')}
                      </li>
                    ))}
                  </ul>
                  <label className="flex items-center gap-2 mt-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overwriteConfirmed}
                      onChange={e => setOverwriteConfirmed(e.target.checked)}
                      className="accent-amber-500"
                    />
                    <span className="text-xs text-amber-300">Entendido, quiero sobreescribir estos campos</span>
                  </label>
                </div>
              )}

              {/* Tabla de filas válidas */}
              {validRows.length > 0 && (
                <div className="border border-slate-700 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-800">
                      <tr>
                        <th className="px-3 py-2 text-left text-slate-400 font-medium">Nombre</th>
                        <th className="px-3 py-2 text-left text-slate-400 font-medium">Doc.</th>
                        <th className="px-3 py-2 text-left text-slate-400 font-medium">Legajo</th>
                        <th className="px-3 py-2 text-left text-slate-400 font-medium">Sector</th>
                        <th className="px-3 py-2 text-left text-slate-400 font-medium">Estado</th>
                        <th className="px-3 py-2 text-left text-slate-400 font-medium">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validRows.map((r, i) => (
                        <tr key={r.rowIndex} className={i % 2 === 0 ? 'bg-slate-900' : 'bg-slate-800/40'}>
                          <td className="px-3 py-2 text-slate-200">{r.nombre}</td>
                          <td className="px-3 py-2 text-slate-400">{r.documento}</td>
                          <td className="px-3 py-2 text-slate-400">
                            {r.legajo || '—'}
                            {r.legajoConflict && (
                              <span className="ml-1 text-amber-400" title={`Conflicto: actual ${r.existingLegajo}`}>*</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-400">{r.sector || '—'}</td>
                          <td className="px-3 py-2 text-slate-400">{ESTADO_LABELS[r.estado_laboral] ?? r.estado_laboral || '—'}</td>
                          <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Legajo conflicts ── */}
          {step === 'legajos' && (
            <div className="p-5 space-y-4">
              <div className="bg-amber-950/40 border border-amber-800/60 rounded-lg p-3">
                <p className="text-amber-300 text-xs">
                  Los siguientes colaboradores tienen un legajo distinto en la planilla al que figura en el sistema.
                  Indicá qué valor conservar para cada uno.
                </p>
              </div>
              <div className="space-y-3">
                {legajoDecisions.map(d => (
                  <div key={d.rowIndex} className="bg-slate-800/60 rounded-lg p-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm text-slate-200 font-medium">{d.nombre}</div>
                      <div className="flex gap-4 mt-1 text-xs text-slate-500">
                        <span>Actual: <strong className="text-slate-300">{d.existingLegajo}</strong></span>
                        <span>Planilla: <strong className="text-amber-300">{d.planillaLegajo}</strong></span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => setLegajoDecisions(prev => prev.map(x => x.rowIndex === d.rowIndex ? { ...x, keep: true } : x))}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition-colors border ${
                          d.keep
                            ? 'bg-slate-600 border-slate-500 text-slate-200'
                            : 'bg-transparent border-slate-700 text-slate-500 hover:border-slate-600'
                        }`}
                      >
                        Mantener {d.existingLegajo}
                      </button>
                      <button
                        onClick={() => setLegajoDecisions(prev => prev.map(x => x.rowIndex === d.rowIndex ? { ...x, keep: false } : x))}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition-colors border ${
                          !d.keep
                            ? 'bg-amber-700 border-amber-600 text-white'
                            : 'bg-transparent border-slate-700 text-slate-500 hover:border-slate-600'
                        }`}
                      >
                        Usar {d.planillaLegajo}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 4: Confirm ── */}
          {step === 'confirmar' && parseResult && (
            <div className="p-5 space-y-4">
              <div className="bg-slate-800/60 rounded-lg p-5 text-center space-y-3">
                <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
                <div>
                  <p className="text-slate-200 font-medium">Todo listo para importar</p>
                  <p className="text-slate-400 text-sm mt-1">
                    Se importarán <strong className="text-emerald-300">{parseResult.stats.toCreate}</strong> nuevos y se actualizarán{' '}
                    <strong className="text-amber-300">{parseResult.stats.toUpdate}</strong> colaboradores.
                    {parseResult.stats.withErrors > 0 && (
                      <> Se omitirán <strong className="text-red-400">{parseResult.stats.withErrors}</strong> filas con errores.</>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Done ── */}
          {step === 'done' && doneResult && (
            <div className="p-5">
              <div className="bg-slate-800/60 rounded-lg p-8 text-center space-y-3">
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
                <p className="text-slate-100 text-lg font-semibold">Importacion completada</p>
                <p className="text-slate-400 text-sm">
                  {doneResult.created} colaboradores creados · {doneResult.updated} actualizados
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-700 flex-shrink-0">
          <div>
            {step !== 'upload' && step !== 'done' && (
              <button
                onClick={() => {
                  if (step === 'preview')   setStep('upload')
                  if (step === 'legajos')   setStep('preview')
                  if (step === 'confirmar') setStep(legajoDecisions.length > 0 ? 'legajos' : 'preview')
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {step === 'done' ? (
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium transition-colors"
              >
                Cerrar
              </button>
            ) : step === 'confirmar' ? (
              <>
                <button onClick={onClose} className="px-4 py-1.5 rounded text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={confirmImport.isPending}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {confirmImport.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Importar ahora
                </button>
              </>
            ) : step === 'preview' ? (
              <button
                onClick={handleGoToLegajos}
                disabled={hasOverwrites && !overwriteConfirmed}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : step === 'legajos' ? (
              <button
                onClick={() => setStep('confirmar')}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium transition-colors"
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
