// ═══════════════════════════════════════════════════════════════════════════
// Finanzas Personales — Fase 5: Importación / Exportación de archivos
// ═══════════════════════════════════════════════════════════════════════════
//
// Servicio "de I/O puro": lee y escribe archivos (Excel/CSV/PDF) sin tocar la
// base de datos. El parseo de import devuelve filas crudas normalizadas; el
// matching contra conceptos y la detección de duplicados vive en
// `database/queries/finance.ts` (necesita la DB). La exportación recibe los
// datos ya consultados y solo se encarga de darles formato y escribirlos.

import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
// Import nombrado (no default): el bundle del proceso principal usa `require`
// crudo para esta dependencia externa y no desenvuelve `.default` — con el
// import por defecto, "autoTable" termina siendo el objeto del módulo entero
// en runtime ("autoTable is not a function"), aunque tipe bien en TS.
import { autoTable } from 'jspdf-autotable'
import fs from 'fs'
import dayjs from 'dayjs'
import {
  FINANCE_STATUS_LABELS, FINANCE_PAYMENT_METHOD_LABELS
} from '@shared/types'
import type {
  FinanceMovement, FinanceMovementStatus, FinanceMonthSummary, FinanceCategoryBreakdownItem
} from '@shared/types'

// ── Importación: parseo de Excel/CSV ──────────────────────────────────────────
//
// El usuario puede traer planillas con encabezados en español con variantes
// razonables (con/sin acentos, mayúsculas, sinónimos). Se reconocen por
// coincidencia parcial sobre el encabezado normalizado, así "Monto", "Importe",
// "Monto ($)" o "amount" matchean igual. Filas sin nombre de concepto se ignoran.

export interface ParsedImportRow {
  rawConceptName: string
  amount:         number | null
  status:         FinanceMovementStatus
  paymentDate:    number | null
  notes:          string
}

const DIACRITICS_RE = new RegExp('[̀-ͯ]', 'g')

function normalizeText(s: string): string {
  return s.toString().trim().toLowerCase()
    .normalize('NFD').replace(DIACRITICS_RE, '')   // quita acentos/diacríticos
}

function parseStatus(raw: unknown): FinanceMovementStatus {
  const v = normalizeText(String(raw ?? ''))
  if (v.startsWith('pag'))       return 'paid'
  if (v.startsWith('venc'))      return 'overdue'
  if (v.startsWith('sin estado') || v.startsWith('sin_estado')) return 'no_status'
  return 'pending'
}

/** Acepta números, "$ 12.345,67", "12345.67", "12,345.67", etc. */
function parseAmount(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null

  let s = String(raw).trim().replace(/[^\d.,-]/g, '')
  if (!s) return null

  const lastComma = s.lastIndexOf(',')
  const lastDot   = s.lastIndexOf('.')
  if (lastComma > lastDot) {
    // formato es-AR: "." separa miles, "," son decimales → "12.345,67"
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (lastDot > lastComma) {
    // formato en-US: "," separa miles, "." son decimales → "12,345.67"
    s = s.replace(/,/g, '')
  }
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

/** Acepta números de serie de Excel y fechas en texto DD/MM/YYYY, YYYY-MM-DD, etc. */
function parseDateValue(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null

  if (typeof raw === 'number') {
    const parsed = XLSX.SSF.parse_date_code(raw)
    if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d).getTime()
    return null
  }

  const s = String(raw).trim()
  let m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime()

  m = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime()

  const fallback = new Date(s)
  return Number.isNaN(fallback.getTime()) ? null : fallback.getTime()
}

/** Lee la primera hoja del archivo (Excel u hoja única de CSV) y normaliza cada fila. */
export function parseFinanceImportFile(filePath: string): ParsedImportRow[] {
  const wb = XLSX.readFile(filePath)
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return []
  const ws  = wb.Sheets[sheetName]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

  const rows: ParsedImportRow[] = []
  for (const row of raw) {
    let rawConceptName = ''
    let status:      FinanceMovementStatus = 'pending'
    let paymentDate: number | null = null
    let notes = ''

    // El archivo exportado trae "Monto estimado" Y "Monto real" como columnas
    // separadas — ambas matchean "monto", y "Monto real" suele venir vacío para
    // movimientos pendientes (se exporta después de "Monto estimado", así que
    // pisaba el valor válido con null). Se rastrean por separado y se prioriza
    // el monto real; si no hay, se cae al estimado — así una fila pendiente con
    // "Monto real" vacío importa igual con su monto estimado en vez de quedar
    // marcada "Monto inválido".
    let amountEstimated: number | null = null
    let amountReal:      number | null = null
    let amountGeneric:   number | null = null

    for (const [key, value] of Object.entries(row)) {
      const h = normalizeText(key)
      if (h.includes('concepto') || h.includes('nombre')) {
        rawConceptName = String(value).trim()
      } else if (h.includes('monto') || h.includes('importe')) {
        const parsed = parseAmount(value)
        if      (h.includes('estimad'))                                          amountEstimated = parsed
        else if (h.includes('real') || h.includes('actual') || h.includes('pagad')) amountReal = parsed
        else                                                                      amountGeneric = parsed
      }
      else if (h.includes('estado') || h.includes('status'))                 status = parseStatus(value)
      else if (h.includes('fecha'))                                          paymentDate = parseDateValue(value)
      else if (h.includes('nota') || h.includes('observac'))                 notes = String(value).trim()
    }

    const amount = amountReal ?? amountGeneric ?? amountEstimated

    if (!rawConceptName) continue   // fila vacía o sin concepto reconocible: se ignora
    rows.push({ rawConceptName, amount, status, paymentDate, notes })
  }
  return rows
}

// ── Exportación: Excel / CSV de movimientos ──────────────────────────────────

function fmtDate(ts: number | null): string {
  return ts ? dayjs(ts).format('DD/MM/YYYY') : ''
}

/**
 * Genera las filas con encabezados en español — simétricos a los que reconoce
 * la importación.
 *
 * `paymentMethodLabels` es un mapa dinámico (id → nombre) armado por el caller
 * a partir de la tabla gestionable `finance_payment_methods` — este servicio es
 * "de I/O puro" y no consulta la DB, así que no puede resolver por su cuenta
 * los métodos de pago personalizados que el usuario haya creado. Si no se pasa
 * (o el id no aparece, p.ej. datos viejos), cae al mapa estático de los 6
 * métodos "de fábrica" como fallback.
 */
function buildMovementExportRows(
  movements: FinanceMovement[],
  paymentMethodLabels: Record<string, string> = FINANCE_PAYMENT_METHOD_LABELS
): Record<string, string | number>[] {
  return movements.map(m => ({
    'Concepto':             m.concept?.name ?? '',
    'Categoría':            m.concept?.category?.name ?? '',
    'Cuenta':               m.concept?.account?.name ?? '',
    'Monto estimado':       m.amount_estimated,
    'Monto real':           m.amount_actual ?? '',
    'Estado':               FINANCE_STATUS_LABELS[m.status],
    'Forma de pago':        paymentMethodLabels[m.payment_method] ?? FINANCE_PAYMENT_METHOD_LABELS[m.payment_method] ?? m.payment_method,
    'Fecha de pago':        fmtDate(m.payment_date),
    'Fecha de vencimiento': fmtDate(m.due_date),
    'Notas':                m.notes ?? ''
  }))
}

export function writeFinanceMovementsFile(
  filePath: string, format: 'xlsx' | 'csv', movements: FinanceMovement[],
  paymentMethodLabels?: Record<string, string>
): void {
  const rows = buildMovementExportRows(movements, paymentMethodLabels)
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 28 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 14 },
    { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 30 }
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Movimientos')
  XLSX.writeFile(wb, filePath, { bookType: format === 'csv' ? 'csv' : 'xlsx' })
}

// ── Exportación: PDF resumen del mes ──────────────────────────────────────────

export interface FinancePdfSummaryInput {
  month:     number
  year:      number
  summary:   FinanceMonthSummary
  breakdown: FinanceCategoryBreakdownItem[]
  movements: FinanceMovement[]
}

function fmtCurrency(amount: number | null | undefined): string {
  const value = amount ?? 0
  return value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

export function writeFinanceSummaryPdf(filePath: string, data: FinancePdfSummaryInput): void {
  const { month, year, summary, breakdown, movements } = data
  const monthLabel = dayjs(new Date(year, month - 1, 1)).format('MMMM YYYY')

  const doc = new jsPDF()

  doc.setFontSize(17)
  doc.setTextColor(30)
  doc.text(`Resumen financiero — ${monthLabel}`, 14, 18)
  doc.setFontSize(9)
  doc.setTextColor(120)
  doc.text(`Generado el ${dayjs().format('DD/MM/YYYY HH:mm')} · Summit / Finanzas Personales`, 14, 24)

  autoTable(doc, {
    startY: 30,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 1.5 },
    columnStyles: { 0: { fontStyle: 'bold', textColor: [60, 60, 60] }, 1: { halign: 'right' } },
    body: [
      ['Total estimado del mes', fmtCurrency(summary.totalEstimated)],
      ['Total real del mes',     fmtCurrency(summary.totalActual)],
      ['Pagado',                 fmtCurrency(summary.totalPaid)],
      ['Pendiente',              fmtCurrency(summary.totalPending)],
      ['Vencido',                fmtCurrency(summary.totalOverdue)],
      ...(summary.diffPercent !== null
        ? [['Variación vs. mes anterior', `${summary.diffPercent > 0 ? '+' : ''}${summary.diffPercent.toFixed(1)}%`]]
        : [])
    ]
  })

  let cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

  if (breakdown.length) {
    doc.setFontSize(12)
    doc.setTextColor(30)
    doc.text('Gasto por categoría', 14, cursorY)
    autoTable(doc, {
      startY: cursorY + 4,
      head: [['Categoría', 'Movimientos', 'Total', '% del mes']],
      body: breakdown.map(b => [
        `${b.categoryIcon}  ${b.categoryName}`,
        String(b.count),
        fmtCurrency(b.totalActual),
        `${b.percent.toFixed(1)}%`
      ]),
      headStyles: { fillColor: [99, 102, 241], textColor: 255 },
      styles: { fontSize: 9 },
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } }
    })
    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  }

  if (movements.length) {
    if (cursorY > 250) { doc.addPage(); cursorY = 18 }
    doc.setFontSize(12)
    doc.setTextColor(30)
    doc.text('Detalle de movimientos', 14, cursorY)
    autoTable(doc, {
      startY: cursorY + 4,
      head: [['Concepto', 'Categoría', 'Estado', 'Monto', 'Vencimiento']],
      body: movements.map(m => [
        m.concept?.name ?? '',
        m.concept?.category?.name ?? '',
        FINANCE_STATUS_LABELS[m.status],
        fmtCurrency(m.amount_actual ?? m.amount_estimated),
        m.due_date ? fmtDate(m.due_date) : '—'
      ]),
      headStyles: { fillColor: [99, 102, 241], textColor: 255 },
      styles: { fontSize: 8 },
      columnStyles: { 3: { halign: 'right' } },
      didParseCell: (hookData) => {
        if (hookData.section === 'body' && hookData.column.index === 2) {
          const status = movements[hookData.row.index]?.status
          if (status === 'paid')      hookData.cell.styles.textColor = [16, 185, 129]
          if (status === 'overdue')   hookData.cell.styles.textColor = [239, 68, 68]
          if (status === 'pending')   hookData.cell.styles.textColor = [245, 158, 11]
          if (status === 'no_status') hookData.cell.styles.textColor = [100, 116, 139]
        }
      }
    })
  }

  const buffer = Buffer.from(doc.output('arraybuffer'))
  fs.writeFileSync(filePath, buffer)
}
