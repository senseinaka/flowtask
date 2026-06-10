// ═══════════════════════════════════════════════════════════════════════════
// Programación de Pedidos — Exportación a Excel
// ═══════════════════════════════════════════════════════════════════════════
//
// Servicio "de I/O puro": recibe datos ya consultados y los formatea/escribe
// como planilla Excel. Sigue el mismo patrón que `finance-io.service.ts`.

import * as XLSX from 'xlsx'
import dayjs from 'dayjs'
import {
  PLANNING_TYPE_LABELS, PLANNING_STATUS_LABELS, PLANNING_RISK_LABELS,
  PLANNING_PRIORITY_LABELS, PLANNING_AI_REPORT_TYPE_LABELS
} from '@shared/types'
import type { ImportOrderPlanning, ImportOrderPlanningAIReport } from '@shared/types'

function fmtDate(ts: number | null): string {
  return ts ? dayjs(ts).format('DD/MM/YYYY') : ''
}

// ── Programaciones ────────────────────────────────────────────────────────────

function buildPlanningExportRows(plannings: ImportOrderPlanning[]): Record<string, string | number>[] {
  return plannings.map(p => ({
    'Marca':                    p.brand?.name ?? '',
    'Proveedor':                p.supplier?.name ?? '',
    'Tipo':                     PLANNING_TYPE_LABELS[p.planning_type],
    'Estado':                   PLANNING_STATUS_LABELS[p.status],
    'Riesgo':                   PLANNING_RISK_LABELS[p.risk_status],
    'Prioridad':                PLANNING_PRIORITY_LABELS[p.priority],
    'Disponibilidad comercial': fmtDate(p.target_commercial_availability_date),
    'Fecha recomendada pedido': fmtDate(p.recommended_order_date),
    'Límite de aprobación':     fmtDate(p.approval_deadline_date),
    'Recepción estimada':       fmtDate(p.estimated_reception_date),
    'Lead time total (días)':   p.total_lead_time_days,
    'Notas':                    p.notes ?? ''
  }))
}

export function writePlanningsExcel(filePath: string, plannings: ImportOrderPlanning[]): void {
  const rows = buildPlanningExportRows(plannings)
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 20 }, { wch: 12 }, { wch: 10 },
    { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 30 }
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Programaciones')
  XLSX.writeFile(wb, filePath, { bookType: 'xlsx' })
}

// ── Reportes IA ───────────────────────────────────────────────────────────────

function buildPlanningAIReportExportRows(
  reports: ImportOrderPlanningAIReport[],
  brandLabels: Record<string, string>,
  supplierLabels: Record<string, string>
): Record<string, string>[] {
  return reports.map(r => ({
    'Tipo de reporte': PLANNING_AI_REPORT_TYPE_LABELS[r.report_type],
    'Marca':           r.brand_id ? (brandLabels[r.brand_id] ?? '') : '',
    'Proveedor':       r.supplier_id ? (supplierLabels[r.supplier_id] ?? '') : '',
    'Período desde':   fmtDate(r.period_start_date),
    'Período hasta':   fmtDate(r.period_end_date),
    'Generado':        dayjs(r.created_at).format('DD/MM/YYYY HH:mm'),
    'Resumen':         r.summary ?? '',
    'Hallazgos':       r.findings ?? '',
    'Recomendaciones': r.recommendations ?? '',
    'Riesgos':         r.risks ?? ''
  }))
}

export function writePlanningAIReportsExcel(
  filePath: string, reports: ImportOrderPlanningAIReport[],
  brandLabels: Record<string, string> = {}, supplierLabels: Record<string, string> = {}
): void {
  const rows = buildPlanningAIReportExportRows(reports, brandLabels, supplierLabels)
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 26 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 18 },
    { wch: 40 }, { wch: 40 }, { wch: 40 }, { wch: 40 }
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Reportes IA')
  XLSX.writeFile(wb, filePath, { bookType: 'xlsx' })
}
