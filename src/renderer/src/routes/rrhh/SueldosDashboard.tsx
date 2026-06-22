import { useState } from 'react'
import { Upload, FileText, AlertTriangle, CheckCircle2, X, Loader2, Trash2 } from 'lucide-react'
import { cn } from '../../components/ui/utils'
import { useReadPayrollPdf } from '../../hooks/usePdf'
import type { PayrollEmployee, PayrollExtractionResult, PayrollValidation } from '@shared/types'

function ValidationBadge({ validations, pageNum }: { validations: PayrollValidation[]; pageNum: number }) {
  const forPage = validations.filter(v =>
    v.field !== 'global'
  )
  if (forPage.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
        <CheckCircle2 size={12} /> OK
      </span>
    )
  }
  const errors = forPage.filter(v => v.severity === 'error')
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-xs',
      errors.length > 0 ? 'text-red-400' : 'text-amber-400'
    )}>
      <AlertTriangle size={12} />
      {errors.length > 0 ? `${errors.length} error${errors.length > 1 ? 'es' : ''}` : `${forPage.length} aviso${forPage.length > 1 ? 's' : ''}`}
    </span>
  )
}

function EmployeeRow({ emp, validations }: { emp: PayrollEmployee; validations: PayrollValidation[] }) {
  const [expanded, setExpanded] = useState(false)
  const myValidations = validations
  const hasIssues = myValidations.length > 0

  return (
    <>
      <tr
        className={cn(
          'border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer transition-colors',
          hasIssues && 'bg-amber-950/5'
        )}
        onClick={() => setExpanded(e => !e)}
      >
        <td className="px-4 py-2.5 text-xs text-slate-300 font-medium whitespace-nowrap">
          {emp.apellidoYNombres}
        </td>
        <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">{emp.documento}</td>
        <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">{emp.cuil}</td>
        <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">{emp.tareaDesempenada}</td>
        <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">{emp.fecha}</td>
        <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">{emp.periodoAbonado}</td>
        <td className="px-4 py-2.5 text-xs font-semibold text-emerald-400 whitespace-nowrap text-right">
          {emp.totalNeto}
        </td>
        <td className="px-4 py-2.5 text-xs">
          <ValidationBadge validations={myValidations} pageNum={emp.pageNum} />
        </td>
      </tr>
      {expanded && myValidations.length > 0 && (
        <tr className="border-b border-slate-700/50 bg-slate-800/40">
          <td colSpan={8} className="px-4 py-2">
            <ul className="space-y-0.5">
              {myValidations.map((v, i) => (
                <li key={i} className={cn(
                  'text-xs flex items-center gap-1.5',
                  v.severity === 'error' ? 'text-red-400' : 'text-amber-400'
                )}>
                  <AlertTriangle size={11} />
                  <span className="font-medium">{v.field}:</span> {v.message}
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  )
}

function ResultTable({ result }: { result: PayrollExtractionResult }) {
  const total = result.employees.reduce((s, e) => s + e.totalNetoRaw, 0)
  const totalFormatted = `$${Math.round(total).toLocaleString('es-AR').replace(/,/g, '.')},00`

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText size={16} className="text-slate-400" />
          <div>
            <p className="text-sm font-medium text-slate-200">{result.employees.length} empleado{result.employees.length !== 1 ? 's' : ''}</p>
            <p className="text-xs text-slate-500 font-mono">{result.hash.slice(0, 12)}…</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400 mb-0.5">Total nómina</p>
          <p className="text-lg font-bold text-emerald-400">{totalFormatted}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800/60">
              <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Apellido y Nombres</th>
              <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Documento</th>
              <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">CUIL</th>
              <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Tarea</th>
              <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Fecha</th>
              <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Período</th>
              <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-right">Total Neto</th>
              <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Estado</th>
            </tr>
          </thead>
          <tbody>
            {result.employees.map((emp) => (
              <EmployeeRow
                key={emp.pageNum}
                emp={emp}
                validations={result.validations}
              />
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-600">
        Hacé clic en una fila para ver detalles de validación. Procesado el {new Date(result.processedAt).toLocaleString('es-AR')}.
      </p>
    </div>
  )
}

export default function SueldosDashboard() {
  const [dragOver, setDragOver] = useState(false)
  const [result, setResult] = useState<PayrollExtractionResult | null>(null)
  const readPayroll = useReadPayrollPdf()

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    const rel = e.relatedTarget as Element | null
    if (rel && (e.currentTarget as Element).contains(rel)) return
    setDragOver(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) return
    const filePath = (file as File & { path?: string }).path ?? ''
    if (!filePath) return
    readPayroll.mutate(filePath, { onSuccess: setResult })
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const filePath = (file as File & { path?: string }).path ?? ''
    if (!filePath) return
    readPayroll.mutate(filePath, { onSuccess: setResult })
    e.target.value = ''
  }

  function reset() {
    setResult(null)
    readPayroll.reset()
  }

  return (
    <div className="h-full flex flex-col p-6 gap-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Sueldos</h1>
          <p className="text-xs text-slate-400 mt-0.5">Procesamiento de recibos de sueldo en PDF</p>
        </div>
        {result && (
          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-400 transition-colors"
          >
            <Trash2 size={13} />
            Limpiar
          </button>
        )}
      </div>

      {/* Drop zone */}
      {!result && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed transition-all duration-150 p-12',
            dragOver
              ? 'border-amber-500 bg-amber-950/10 scale-[1.01] shadow-xl shadow-amber-950/20'
              : 'border-slate-700 hover:border-slate-600 bg-slate-800/40'
          )}
        >
          {readPayroll.isPending ? (
            <>
              <Loader2 size={32} className="text-slate-400 animate-spin" />
              <p className="text-sm text-slate-400">Procesando PDF…</p>
            </>
          ) : dragOver ? (
            <>
              <Upload size={32} className="text-amber-400" />
              <p className="text-sm font-medium text-amber-300">Soltá el PDF aquí</p>
            </>
          ) : (
            <>
              <Upload size={32} className="text-slate-500" />
              <div className="text-center">
                <p className="text-sm text-slate-300">Arrastrá el PDF de sueldos aquí</p>
                <p className="text-xs text-slate-500 mt-1">o hacé clic para seleccionar</p>
              </div>
              <label className="cursor-pointer mt-1">
                <input
                  type="file"
                  accept=".pdf"
                  className="sr-only"
                  onChange={handleFileInput}
                />
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs text-slate-200 transition-colors">
                  <FileText size={13} />
                  Seleccionar PDF
                </span>
              </label>
            </>
          )}
        </div>
      )}

      {/* Error state */}
      {readPayroll.isError && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-950/20 border border-red-800/40">
          <X size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-medium text-red-300">Error al procesar el PDF</p>
            <p className="text-xs text-red-400/70 mt-0.5">{readPayroll.error?.message}</p>
          </div>
          <button onClick={reset} className="ml-auto text-red-400 hover:text-red-300">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Results */}
      {result && <ResultTable result={result} />}

      {/* Re-upload after result */}
      {result && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'flex items-center justify-center gap-2 rounded-xl border border-dashed p-4 transition-all duration-150 cursor-pointer',
            dragOver ? 'border-amber-500 bg-amber-950/10' : 'border-slate-700 hover:border-slate-600'
          )}
          onClick={() => document.getElementById('rrhh-file-input')?.click()}
        >
          <input id="rrhh-file-input" type="file" accept=".pdf" className="sr-only" onChange={handleFileInput} />
          {readPayroll.isPending
            ? <Loader2 size={14} className="text-slate-400 animate-spin" />
            : <Upload size={14} className="text-slate-500" />
          }
          <span className="text-xs text-slate-500">Cargar otro PDF</span>
        </div>
      )}
    </div>
  )
}
