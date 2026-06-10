import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Sparkles, FileText, Trash2, AlertTriangle, Lightbulb, ListChecks, Tag, Building2, Download } from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
dayjs.locale('es')

import {
  useComexBrands, useComexSuppliers,
  useComexPlanningAIReports, useGenerateComexPlanningAIReport, useDeleteComexPlanningAIReport,
  useExportComexPlanningAIReports
} from '../../hooks/useComex'
import { PLANNING_AI_REPORT_TYPES, PLANNING_AI_REPORT_TYPE_LABELS } from '@shared/types'
import type { PlanningAIReportType } from '@shared/types'

export default function ComexPlanningAIReports() {
  const navigate = useNavigate()

  const [reportType, setReportType] = useState<PlanningAIReportType>(PLANNING_AI_REPORT_TYPES[0])
  const [brandId, setBrandId] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')

  const { data: brands = [] } = useComexBrands()
  const { data: suppliers = [] } = useComexSuppliers()
  const { data: reports = [], isLoading } = useComexPlanningAIReports({ reportType })
  const generateReport = useGenerateComexPlanningAIReport()
  const deleteReport = useDeleteComexPlanningAIReport()
  const exportReports = useExportComexPlanningAIReports()

  const handleGenerate = () => {
    generateReport.mutate({
      reportType,
      brandId: brandId || null,
      supplierId: supplierId || null,
      periodStartDate: periodStart ? dayjs(periodStart).valueOf() : null,
      periodEndDate: periodEnd ? dayjs(periodEnd).endOf('day').valueOf() : null
    })
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/comex/plannings')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <Sparkles size={20} className="text-cyan-400" />
          <div>
            <h1 className="text-lg font-bold text-white">Reportes automáticos (IA)</h1>
            <p className="text-xs text-slate-400">Análisis generados por IA sobre la programación de pedidos</p>
          </div>
        </div>
        <button
          onClick={() => exportReports.mutate(reports)}
          disabled={exportReports.isPending || reports.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Download size={16} />
          Exportar
        </button>
      </div>

      {/* Generador */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Tipo de reporte</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as PlanningAIReportType)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            >
              {PLANNING_AI_REPORT_TYPES.map((t) => (
                <option key={t} value={t}>{PLANNING_AI_REPORT_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Marca (opcional)</label>
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="">Todas las marcas</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Proveedor (opcional)</label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="">Todos los proveedores</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Desde</label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Hasta</label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          {generateReport.isError ? (
            <p className="text-xs text-red-400">No se pudo generar el reporte. Verificá la configuración de IA e intentá nuevamente.</p>
          ) : <span />}
          <button
            onClick={handleGenerate}
            disabled={generateReport.isPending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Sparkles size={14} className={generateReport.isPending ? 'animate-pulse' : ''} />
            {generateReport.isPending ? 'Generando...' : 'Generar reporte'}
          </button>
        </div>
      </div>

      {/* Listado de reportes */}
      {isLoading ? (
        <div className="text-slate-500 text-sm">Cargando...</div>
      ) : reports.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
          <FileText size={36} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">Sin reportes generados</p>
          <p className="text-slate-500 text-sm mt-1">Generá un reporte de "{PLANNING_AI_REPORT_TYPE_LABELS[reportType]}" con el botón de arriba.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div key={report.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">{PLANNING_AI_REPORT_TYPE_LABELS[report.report_type]}</h3>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                    <span>{dayjs(report.created_at).format('DD/MM/YYYY HH:mm')}</span>
                    {report.brand_id && (
                      <span className="flex items-center gap-1">
                        <Tag size={10} />
                        {brands.find((b) => b.id === report.brand_id)?.name ?? '—'}
                      </span>
                    )}
                    {report.supplier_id && (
                      <span className="flex items-center gap-1">
                        <Building2 size={10} />
                        {suppliers.find((s) => s.id === report.supplier_id)?.name ?? '—'}
                      </span>
                    )}
                    {(report.period_start_date || report.period_end_date) && (
                      <span>
                        {report.period_start_date ? dayjs(report.period_start_date).format('DD/MM/YY') : '…'}
                        {' – '}
                        {report.period_end_date ? dayjs(report.period_end_date).format('DD/MM/YY') : '…'}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteReport.mutate(report.id)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors shrink-0"
                  title="Eliminar reporte"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {report.summary && (
                <p className="text-sm text-slate-300">{report.summary}</p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                {report.findings && (
                  <ReportBlock icon={ListChecks} title="Hallazgos" content={report.findings} color="text-cyan-400" />
                )}
                {report.recommendations && (
                  <ReportBlock icon={Lightbulb} title="Recomendaciones" content={report.recommendations} color="text-emerald-400" />
                )}
                {report.risks && (
                  <ReportBlock icon={AlertTriangle} title="Riesgos" content={report.risks} color="text-amber-400" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ReportBlock({ icon: Icon, title, content, color }: { icon: typeof ListChecks; title: string; content: string; color: string }) {
  return (
    <div className="bg-slate-900/60 border border-slate-700/60 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon size={12} className={color} />
        <span className="text-[10px] uppercase tracking-wider text-slate-500">{title}</span>
      </div>
      <div className="text-xs text-slate-300 whitespace-pre-line space-y-0.5">{content}</div>
    </div>
  )
}
