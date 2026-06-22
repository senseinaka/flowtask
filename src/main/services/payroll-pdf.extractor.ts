import { readPdf } from './pdf-reader.service'
import type { PayrollEmployee, PayrollExtractionResult, PayrollValidation, PdfTextItem } from '@shared/types'

const Y_TOL = 5   // pixels of y-coordinate tolerance for grouping rows
const X_TOL = 15  // pixels of x-coordinate tolerance for field matching

// Coordinates calibrated for "RECIBOS ABRIL 2026.pdf" (842×595 A4 landscape)
// Each page has ONE employee printed twice (left half + right half mirror).
// We read only the left half (x < pageWidth/2).
const COORDS = {
  apellido:     { y: 507, x: 16  },
  documento:    { y: 507, x: 151 },
  legajo:       { y: 507, x: 392 },
  tarea:        { y: 458, x: 245 },
  fecha:        { y: 458, x: 194 },
  cuil:         { y: 535, x: 322 },
  fechaIngreso: { y: 483, x: 17  },
  periodo:      { y: 444, x: 66  },
  totalNeto:    { y: 48,  x: 350 },
}

// Year must start with "20" (20XX) to avoid false positives on CUITs like 30-71201832-8
const PERIODO_PATTERN = /\b(\d{1,2})\s*[-–]\s*(20\d{2})\b/

// Fallback label lists (searched on full page when coordinate extraction fails)
const LEGAJO_LABELS  = ['LEGAJO', 'LEG.', 'NRO.LEG', 'NRO. LEG', 'N°LEG', 'NROLEG', 'LEG']
const INGRESO_LABELS = ['F.INGRESO', 'FEC.ING', 'FECHA ING', 'F. ING', 'F.ING.', 'FECINGR']

function near(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol
}

function groupByRow(items: PdfTextItem[]): Map<number, PdfTextItem[]> {
  const rows = new Map<number, PdfTextItem[]>()
  for (const item of items) {
    if (!item.str.trim()) continue
    let foundKey: number | null = null
    for (const key of rows.keys()) {
      if (near(item.y, key, Y_TOL)) { foundKey = key; break }
    }
    if (foundKey === null) {
      rows.set(item.y, [item])
    } else {
      rows.get(foundKey)!.push(item)
    }
  }
  return rows
}

function findNearestStr(rows: Map<number, PdfTextItem[]>, targetY: number, targetX: number): string {
  for (const [rowY, items] of rows) {
    if (!near(rowY, targetY, Y_TOL)) continue
    const sorted = [...items].sort((a, b) => Math.abs(a.x - targetX) - Math.abs(b.x - targetX))
    if (sorted.length && near(sorted[0].x, targetX, X_TOL * 3)) {
      return sorted[0].str.trim()
    }
  }
  return ''
}

function findTextAtOrAfterX(rows: Map<number, PdfTextItem[]>, targetY: number, minX: number): string {
  for (const [rowY, items] of rows) {
    if (!near(rowY, targetY, Y_TOL)) continue
    const rightItems = items.filter(i => i.x >= minX).sort((a, b) => a.x - b.x)
    if (rightItems.length) return rightItems[0].str.trim()
  }
  return ''
}

// Find a label in any row, return the next non-empty token to its right in the same row.
// Used as fallback when coordinate extraction yields nothing.
function findValueByLabel(rows: Map<number, PdfTextItem[]>, labels: string[]): string {
  for (const [_y, items] of rows) {
    const sorted = [...items].sort((a, b) => a.x - b.x)
    for (let i = 0; i < sorted.length; i++) {
      const text = sorted[i].str.trim().toUpperCase().replace(/\s+/g, '')
      if (labels.some(l => text === l.replace(/\s+/g, '') || text.startsWith(l.replace(/\s+/g, '')))) {
        for (let j = i + 1; j < sorted.length; j++) {
          const val = sorted[j].str.trim()
          if (val) return val
        }
      }
    }
  }
  return ''
}

// 3-level cascade to find the "Período Abonado" value
function findPeriodoAbonado(allRows: Map<number, PdfTextItem[]>, coordResult: string): string {
  // 1. Coordinate result already has the expected pattern
  if (PERIODO_PATTERN.test(coordResult)) return coordResult

  // 2. Full-page scan — first item matching "N - 20YY"
  const allItems = [...allRows.values()].flat().sort((a, b) => b.y - a.y)
  for (const item of allItems) {
    if (PERIODO_PATTERN.test(item.str)) return item.str.trim()
  }

  return coordResult
}

function findTotalNeto(rows: Map<number, PdfTextItem[]>): { raw: number; formatted: string } {
  for (const [_rowY, items] of rows) {
    const rowText = items.map(i => i.str.toUpperCase()).join(' ')
    // Require BOTH words to avoid matching "SUBTOTAL" rows
    if (!rowText.includes('TOTAL') || !rowText.includes('NETO')) continue

    const sorted = [...items].sort((a, b) => a.x - b.x)
    // The numeric value is the rightmost item that looks like a number
    const numItems = sorted.filter(i => /^\d[\d.,]*$/.test(i.str.trim()))
    if (numItems.length) {
      const rawStr = numItems[numItems.length - 1].str.trim()
      // PDF uses dot as decimal separator (e.g. "1473433.00")
      const num = parseFloat(rawStr.replace(/[^\d.]/g, ''))
      if (!isNaN(num) && num > 1000) return { raw: num, formatted: formatNeto(num) }
    }
  }
  return { raw: 0, formatted: '' }
}

function formatNeto(n: number): string {
  const [intPart, decPart] = n.toFixed(2).split('.')
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `$${intFormatted},${decPart}`
}

function extractEmployee(pageNum: number, items: PdfTextItem[], pageWidth: number): PayrollEmployee | null {
  const leftItems = items.filter(i => i.x < pageWidth / 2)
  const leftRows  = groupByRow(leftItems)
  const allRows   = groupByRow(items)   // full page for label fallbacks

  const apellido   = findNearestStr(leftRows, COORDS.apellido.y, COORDS.apellido.x)
  const documento  = findNearestStr(leftRows, COORDS.documento.y, COORDS.documento.x)
  const cuil       = findNearestStr(leftRows, COORDS.cuil.y, COORDS.cuil.x)
  const fecha      = findNearestStr(leftRows, COORDS.fecha.y, COORDS.fecha.x)
  const tarea      = findTextAtOrAfterX(leftRows, COORDS.tarea.y, COORDS.tarea.x)
  const periodoRaw = findTextAtOrAfterX(leftRows, COORDS.periodo.y, COORDS.periodo.x)
  const periodo    = findPeriodoAbonado(allRows, periodoRaw)

  // Coordinate-based first, label-based fallback
  const legajo       = findNearestStr(leftRows, COORDS.legajo.y, COORDS.legajo.x)
                    || findValueByLabel(allRows, LEGAJO_LABELS)
  const fechaIngreso = findNearestStr(leftRows, COORDS.fechaIngreso.y, COORDS.fechaIngreso.x)
                    || findValueByLabel(allRows, INGRESO_LABELS)

  const { raw: totalNetoRaw, formatted: totalNeto } = findTotalNeto(leftRows)

  if (!apellido) return null

  return {
    pageNum,
    apellidoYNombres: apellido,
    documento,
    cuil,
    fecha,
    periodoAbonado: periodo,
    tareaDesempenada: tarea,
    totalNeto,
    totalNetoRaw,
    legajo,
    fechaIngreso,
  }
}

function validateEmployee(emp: PayrollEmployee): PayrollValidation[] {
  const v: PayrollValidation[] = []
  if (!emp.apellidoYNombres) v.push({ field: 'apellidoYNombres', message: 'Sin nombre', severity: 'error' })
  if (!emp.documento) v.push({ field: 'documento', message: 'Sin documento', severity: 'error' })
  if (!emp.cuil) v.push({ field: 'cuil', message: 'Sin CUIL', severity: 'warning' })
  if (!emp.fecha) v.push({ field: 'fecha', message: 'Sin fecha', severity: 'warning' })
  if (!emp.periodoAbonado) v.push({ field: 'periodoAbonado', message: 'Sin período', severity: 'warning' })
  if (!emp.tareaDesempenada) v.push({ field: 'tareaDesempenada', message: 'Sin tarea', severity: 'warning' })
  if (emp.totalNetoRaw <= 0) v.push({ field: 'totalNeto', message: 'Total neto inválido o cero', severity: 'error' })
  return v
}

export async function extractPayroll(filePath: string): Promise<PayrollExtractionResult> {
  const pdfResult = await readPdf(filePath)
  const employees: PayrollEmployee[] = []
  const validations: PayrollValidation[] = []

  for (const page of pdfResult.pages) {
    const emp = extractEmployee(page.pageNum, page.items, page.width)
    if (emp) {
      employees.push(emp)
      validations.push(...validateEmployee(emp))
    }
  }

  return {
    filePath,
    hash: pdfResult.hash,
    employees,
    validations,
    processedAt: Date.now(),
  }
}
