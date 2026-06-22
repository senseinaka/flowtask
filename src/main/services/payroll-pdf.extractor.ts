import { readPdf } from './pdf-reader.service'
import type { PayrollEmployee, PayrollExtractionResult, PayrollValidation, PdfTextItem } from '@shared/types'

const Y_TOL = 5

// Year must start with "20" to avoid false positives on CUITs like 30-71201832-8
const PERIODO_PATTERN = /\b(\d{1,2})\s*[-–]\s*(20\d{2})\b/

function near(a: number, b: number, tol: number) {
  return Math.abs(a - b) <= tol
}

function groupByRow(items: PdfTextItem[]): Map<number, PdfTextItem[]> {
  const rows = new Map<number, PdfTextItem[]>()
  for (const item of items) {
    if (!item.str.trim()) continue
    let key: number | null = null
    for (const k of rows.keys()) {
      if (near(item.y, k, Y_TOL)) { key = k; break }
    }
    if (key === null) { rows.set(item.y, [item]) }
    else { rows.get(key)!.push(item) }
  }
  return rows
}

// Rows sorted top-to-bottom (descending y, since y=0 is bottom of PDF page)
function topToBottom(rows: Map<number, PdfTextItem[]>): [number, PdfTextItem[]][] {
  return [...rows.entries()].sort((a, b) => b[0] - a[0])
}

// Normalize for label matching: uppercase, single spaces, no diacritics
function norm(s: string): string {
  return s.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ')
}

// Find the first (topmost) row+item matching any label variant
function findLabel(
  rows: Map<number, PdfTextItem[]>,
  labels: string[]
): { y: number; x: number } | null {
  const nl = labels.map(norm)
  for (const [y, items] of topToBottom(rows)) {
    for (const item of items) {
      const t = norm(item.str)
      if (nl.some(l => t === l || t.includes(l))) return { y, x: item.x }
    }
  }
  return null
}

// Value in the row BELOW the label, within xTol pixels horizontally and maxYGap vertically
function valueBelow(
  rows: Map<number, PdfTextItem[]>,
  pos: { y: number; x: number },
  xTol = 60,
  maxYGap = 25
): string {
  for (const [y, items] of topToBottom(rows)) {
    if (y > pos.y - Y_TOL) continue    // skip same row and above
    if (pos.y - y > maxYGap) break      // too far below

    const best = [...items]
      .filter(i => Math.abs(i.x - pos.x) <= xTol && i.str.trim())
      .sort((a, b) => Math.abs(a.x - pos.x) - Math.abs(b.x - pos.x))

    if (best.length) return best[0].str.trim()
  }
  return ''
}

// Value to the RIGHT of the label in the same row
function valueRight(
  rows: Map<number, PdfTextItem[]>,
  pos: { y: number; x: number },
  minOffset = 5
): string {
  for (const [y, items] of topToBottom(rows)) {
    if (!near(y, pos.y, Y_TOL)) continue

    const right = [...items]
      .filter(i => i.x > pos.x + minOffset && i.str.trim())
      .sort((a, b) => a.x - b.x)

    if (right.length) return right[0].str.trim()
  }
  return ''
}

// Convenience wrappers
function fieldBelow(rows: Map<number, PdfTextItem[]>, labels: string[], xTol = 60, maxYGap = 25): string {
  const pos = findLabel(rows, labels)
  return pos ? valueBelow(rows, pos, xTol, maxYGap) : ''
}

function fieldRight(rows: Map<number, PdfTextItem[]>, labels: string[]): string {
  const pos = findLabel(rows, labels)
  return pos ? valueRight(rows, pos) : ''
}

// Period: scan page top-to-bottom for "N - 20YY" pattern
function findPeriodo(rows: Map<number, PdfTextItem[]>): string {
  for (const [, items] of topToBottom(rows)) {
    for (const item of items) {
      if (PERIODO_PATTERN.test(item.str)) return item.str.trim()
    }
  }
  return ''
}

// Total neto: find "TOTAL NETO" label, take the numeric value to its right
function findTotalNeto(rows: Map<number, PdfTextItem[]>): { raw: number; formatted: string } {
  const pos = findLabel(rows, ['TOTAL NETO'])
  if (!pos) return { raw: 0, formatted: '' }

  // Value is the rightmost number-looking item in the same row group
  for (const [y, items] of topToBottom(rows)) {
    if (!near(y, pos.y, Y_TOL)) continue

    const nums = [...items]
      .filter(i => i.x > pos.x + 5 && /^\d[\d.,]*$/.test(i.str.trim()))
      .sort((a, b) => a.x - b.x)

    if (nums.length) {
      // PDF uses dot as decimal separator ("1473433.00")
      const num = parseFloat(nums[0].str.replace(/[^\d.]/g, ''))
      if (!isNaN(num) && num > 1000) return { raw: num, formatted: formatNeto(num) }
    }
  }
  return { raw: 0, formatted: '' }
}

function formatNeto(n: number): string {
  const [intPart, decPart] = n.toFixed(2).split('.')
  return `$${intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${decPart}`
}

function extractEmployee(pageNum: number, items: PdfTextItem[], pageWidth: number): PayrollEmployee | null {
  // Each page has the same employee printed twice (left and right halves)
  const leftItems = items.filter(i => i.x < pageWidth / 2)
  const leftRows  = groupByRow(leftItems)

  // Column-header fields: label is above value in adjacent row
  const apellido     = fieldBelow(leftRows, ['APELLIDO Y NOMBRE', 'NOMBRE Y APELLIDO'], 80)
  const documento    = fieldBelow(leftRows, ['DOCUMENTO', 'D.N.I', 'DNI'], 60)
  const legajo       = fieldBelow(leftRows, ['LEGAJO'], 60)
  // Categoría gives a broader group (ADMINISTRATIVO, OPERARIO) — better for filtering
  const tarea        = fieldBelow(leftRows, ['CATEGORÍA', 'CATEGORIA', 'CATEGORY'], 60)
                    || fieldBelow(leftRows, ['TAREA DESEMPE'], 60)
  const fechaIngreso = fieldBelow(leftRows, ['INGRESO'], 50)
  // "Fecha" row contains Período code / Fecha / Tarea Desempeñada — pick Fecha by x proximity
  const fecha        = fieldBelow(leftRows, ['FECHA'], 40, 20)

  // Inline fields: label and value share a row
  const cuil         = fieldRight(leftRows, ['C.U.I.L.', 'C.U.I.L', 'CUIL'])
  const periodo      = findPeriodo(leftRows)
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
  if (!emp.documento)        v.push({ field: 'documento',        message: 'Sin documento', severity: 'error' })
  if (!emp.cuil)             v.push({ field: 'cuil',             message: 'Sin CUIL', severity: 'warning' })
  if (!emp.periodoAbonado)   v.push({ field: 'periodoAbonado',   message: 'Sin período', severity: 'warning' })
  if (emp.totalNetoRaw <= 0) v.push({ field: 'totalNeto',        message: 'Total neto inválido o cero', severity: 'error' })
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
