import { readPdf } from './pdf-reader.service'
import type { PayrollEmployee, PayrollExtractionResult, PayrollValidation, PdfTextItem } from '@shared/types'

const Y_TOL = 5   // pixels of y-coordinate tolerance for grouping rows
const X_TOL = 15  // pixels of x-coordinate tolerance for field matching

// Known approximate coordinates (left half, y from bottom of page)
// Measured from "Muestra sueldos.pdf" — A4 landscape 842×595
const COORDS = {
  apellido:       { y: 499, x: 28  },
  documento:      { y: 499, x: 163 },
  cuil:           { y: 527, x: 333 },
  fecha:          { y: 450, x: 205 },
  tarea:          { y: 450, x: 256 },
  periodo:        { y: 436, x: 77  },
  totalNetoLabel: { y: 60,  x: 283 },
  totalNetoValue: { y: 59,  x: 361 },
}

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

function findTotalNeto(rows: Map<number, PdfTextItem[]>): { raw: number; formatted: string } {
  // Find "TOTAL NETO" label row, then grab the numeric value to its right
  for (const [rowY, items] of rows) {
    const rowText = items.map(i => i.str).join(' ')
    if (!rowText.includes('TOTAL') && !rowText.includes('NETO')) continue
    if (!near(rowY, COORDS.totalNetoLabel.y, Y_TOL * 3)) continue

    const sorted = items.sort((a, b) => a.x - b.x)
    // Value is the item furthest right (after label)
    const labelIdx = sorted.findIndex(i => i.str.includes('NETO') || i.str.includes('TOTAL'))
    const valueItems = labelIdx >= 0 ? sorted.slice(labelIdx + 1) : sorted.filter(i => /\d/.test(i.str))
    const rawStr = valueItems.map(i => i.str).join('').trim()
    const num = parseFloat(rawStr.replace(/[^\d.]/g, ''))
    if (!isNaN(num) && num > 0) return { raw: num, formatted: formatNeto(num) }
  }
  return { raw: 0, formatted: '' }
}

function formatNeto(n: number): string {
  // Argentine format: $1.493.735,00
  const [intPart, decPart] = n.toFixed(2).split('.')
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `$${intFormatted},${decPart}`
}

function extractEmployee(pageNum: number, items: PdfTextItem[], pageWidth: number): PayrollEmployee | null {
  const leftItems = items.filter(i => i.x < pageWidth / 2)
  const rows = groupByRow(leftItems)

  const apellido = findNearestStr(rows, COORDS.apellido.y, COORDS.apellido.x)
  const documento = findNearestStr(rows, COORDS.documento.y, COORDS.documento.x)
  const cuil = findNearestStr(rows, COORDS.cuil.y, COORDS.cuil.x)
  const fecha = findNearestStr(rows, COORDS.fecha.y, COORDS.fecha.x)
  const tarea = findTextAtOrAfterX(rows, COORDS.tarea.y, COORDS.tarea.x)
  const periodo = findTextAtOrAfterX(rows, COORDS.periodo.y, COORDS.periodo.x)
  const { raw: totalNetoRaw, formatted: totalNeto } = findTotalNeto(rows)

  // If we can't find a name this page is probably blank/invalid
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
