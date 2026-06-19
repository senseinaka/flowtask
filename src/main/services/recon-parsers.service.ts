import * as XLSX from 'xlsx'

// ── Tipos de retorno (sin id ni period_id — los agrega la capa de queries) ───

export interface ParsedInvoice {
  comprobante:           string
  tipo:                  string
  concepto:              string
  total:                 number
  importe_tarjetas:      number
  importe_efectivo:      number
  importe_transferencia: number
  importe_cta_cte:       number
  importe_otros:         number
}

export interface ParsedCupon {
  cupon:         string
  plan:          string
  total:         number
  nombre:        string
  condicion:     string
  fecha_ingreso: string   // YYYY-MM-DD o vacío
  cuotas:        number
}

export interface ParsedMLOp {
  operation_id:       string
  status:             string
  status_detail:      string
  transaction_amount: number
  mp_fee:             number
  shipping_cost:      number
  counterpart_name:   string
  external_reference: string
  reason:             string
  date_created:       number | null
  date_approved:      number | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function num(raw: unknown): number {
  if (raw === null || raw === undefined || raw === '') return 0
  if (typeof raw === 'number') return isNaN(raw) ? 0 : raw

  const s = String(raw).trim().replace(/[$\s%]/g, '')
  if (!s) return 0

  const dotCount  = (s.match(/\./g) || []).length
  const lastComma = s.lastIndexOf(',')
  const lastDot   = s.lastIndexOf('.')

  // Coma después del último punto → coma es decimal: "1.234,56", "269.900,00"
  if (lastComma > lastDot) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
  }

  if (dotCount === 1 && lastDot > lastComma) {
    const afterDot = s.slice(lastDot + 1)
    // Un solo punto con ≤2 dígitos después → decimal estilo US: "269900.00"
    if (afterDot.length <= 2) {
      return parseFloat(s.replace(/,/g, '')) || 0
    }
    // Un solo punto con 3+ dígitos → separador de miles europeo: "269.900"
    return parseFloat(s.replace(/\./g, '')) || 0
  }

  // Múltiples puntos → todos son miles: "1.234.567"
  if (dotCount > 1) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
  }

  return parseFloat(s.replace(',', '.')) || 0
}

function str(raw: unknown): string {
  if (raw === null || raw === undefined) return ''
  return String(raw).trim()
}

function stripExcelEq(s: string): string {
  if (s.startsWith('="') && s.endsWith('"')) return s.slice(2, -1)
  return s
}

function excelSerialToMs(serial: number): number {
  return (serial - 25569) * 86400 * 1000
}

function parseDate(raw: unknown): number | null {
  if (!raw) return null
  if (typeof raw === 'number') return excelSerialToMs(raw)
  if (typeof raw === 'string') {
    const d = new Date(raw)
    return isNaN(d.getTime()) ? null : d.getTime()
  }
  return null
}

function formatDateStr(raw: unknown): string {
  const ms = parseDate(raw)
  if (!ms) return ''
  return new Date(ms).toISOString().slice(0, 10)
}

// Detecta índice de columna en un array de headers por palabras clave
function findCol(headers: string[], keywords: string[]): number {
  for (const kw of keywords) {
    const idx = headers.findIndex(h => h.includes(kw.toLowerCase()))
    if (idx !== -1) return idx
  }
  return -1
}

// ── 1. FLEXXUS / FONDOS VTAS WEB (XLSX) ──────────────────────────────────────
//
// Layout:
//   fila 1-3  → metadata (empresa, título, periodo/caja)
//   "INGRESOS"
//   "Ingresos Varios"  → sección vacía, ignorar
//     header + 0,00 fila + TOTALES
//   "Ingresos Ventas"  ← sección objetivo
//     header: Comprobante | Concepto | (vacío) | Total | Cta.Cte | Efectivo | Ch.Prop | Ch.Terc | Tarjetas | Docum | C.Contab | Trans.B | Otros
//     FA xxxx | cliente | ... valores ...
//     TOTALES
//   "EGRESOS" → parar

export function parseFlexxus(buffer: Buffer): ParsedInvoice[] {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  // raw: true → celdas numéricas retornan el número real (ej 269900, no "269.900,00")
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null }) as unknown[][]

  // Buscar sección "Ingresos Ventas" y luego su fila de header
  let headerRowIdx = -1
  let inVentas = false

  for (let i = 0; i < rows.length; i++) {
    const cell0 = str(rows[i][0])
    if (/^ingresos\s+ventas$/i.test(cell0)) {
      inVentas = true
      continue
    }
    if (inVentas && /^comprobante$/i.test(cell0)) {
      headerRowIdx = i
      break
    }
    // Si llegamos a EGRESOS sin encontrar header, parar
    if (inVentas && /^egresos$/i.test(cell0)) break
  }

  if (headerRowIdx === -1) {
    throw new Error('Flexxus: no se encontró la sección "Ingresos Ventas" con su header')
  }

  const hdr = rows[headerRowIdx].map(h => str(h).toLowerCase())
  const C_CONC  = findCol(hdr, ['concepto'])
  const C_TOT   = findCol(hdr, ['total'])
  const C_CTA   = findCol(hdr, ['cta.', 'cta '])
  const C_EFEC  = findCol(hdr, ['efectivo'])
  const C_TARJ  = findCol(hdr, ['tarjetas'])
  const C_TRANS = findCol(hdr, ['trans.', 'trans '])
  const C_OTROS = findCol(hdr, ['otros'])

  const COMPROBANTE_RE = /^(FA|NCB|NCA|FB|REM)\s/i
  const result: ParsedInvoice[] = []

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const r   = rows[i]
    const c0  = str(r[0])
    if (/^totales/i.test(c0) || /^egresos/i.test(c0)) break
    if (!COMPROBANTE_RE.test(c0)) continue

    result.push({
      comprobante:           c0,
      tipo:                  c0.split(/\s/)[0].toUpperCase(),
      concepto:              C_CONC  !== -1 ? str(r[C_CONC])  : '',
      total:                 C_TOT   !== -1 ? num(r[C_TOT])   : 0,
      importe_tarjetas:      C_TARJ  !== -1 ? num(r[C_TARJ])  : 0,
      importe_efectivo:      C_EFEC  !== -1 ? num(r[C_EFEC])  : 0,
      importe_transferencia: C_TRANS !== -1 ? num(r[C_TRANS]) : 0,
      importe_cta_cte:       C_CTA   !== -1 ? num(r[C_CTA])   : 0,
      importe_otros:         C_OTROS !== -1 ? num(r[C_OTROS]) : 0,
    })
  }

  if (result.length === 0) {
    throw new Error('Flexxus: la sección "Ingresos Ventas" no contiene facturas')
  }

  return result
}

// ── 2. CUPONES CSV (Latin-1, semicolon, con ="...") ───────────────────────────
//
// Exportación de procesadora de tarjetas.
// Encoding: ISO-8859-1 / Latin-1.
// Las celdas están envueltas en ="..." (formato CSV de Excel).
// Col de header detectada dinámicamente.

export function parseCuponesCSV(buffer: Buffer): ParsedCupon[] {
  const text  = buffer.toString('latin1')
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []

  const hdr = lines[0].split(';').map(h => stripExcelEq(str(h)).toLowerCase())

  const C_CUPON  = findCol(hdr, ['cupón', 'cupon', 'número cup', 'nro cup'])
  const C_PLAN   = findCol(hdr, ['plan'])
  const C_TOTAL  = findCol(hdr, ['total', 'importe', 'monto'])
  const C_NOMBRE = findCol(hdr, ['nombre', 'titular', 'cliente'])
  const C_CONDIC = findCol(hdr, ['condici'])
  const C_FECHA  = findCol(hdr, ['fecha'])
  const C_CUOTAS = findCol(hdr, ['cuota'])

  const result: ParsedCupon[] = []

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(';').map(p => stripExcelEq(str(p)))
    if (parts.length < 3) continue

    const cupon = C_CUPON !== -1 ? parts[C_CUPON] : ''
    const total = C_TOTAL !== -1 ? num(parts[C_TOTAL]) : 0
    if (!cupon && total === 0) continue

    result.push({
      cupon,
      plan:          C_PLAN   !== -1 ? parts[C_PLAN]   : '',
      total,
      nombre:        C_NOMBRE !== -1 ? parts[C_NOMBRE] : '',
      condicion:     C_CONDIC !== -1 ? parts[C_CONDIC] : '',
      fecha_ingreso: C_FECHA  !== -1 ? parts[C_FECHA]  : '',
      cuotas:        C_CUOTAS !== -1 ? Math.round(num(parts[C_CUOTAS])) || 1 : 1,
    })
  }

  return result
}

// ── 3. CUPONES XLSX ───────────────────────────────────────────────────────────
//
// Planilla 3 — "Cupones + medio de pago.xlsx"
// Tiene sección "TARJETAS DE CREDITO" encima del header real.
// Header: Número Cupón | Plan de Tarjeta | ... | Fecha Ingreso | Condición | ... | Cuotas | Total

export function parseCuponesXLSX(buffer: Buffer): ParsedCupon[] {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null }) as unknown[][]

  // Buscar fila de header (tiene "cup" o "plan")
  let headerRowIdx = -1
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const r = rows[i].map(c => str(c).toLowerCase())
    if (r.some(c => c.includes('cup') || c.includes('plan'))) {
      headerRowIdx = i
      break
    }
  }
  if (headerRowIdx === -1) {
    throw new Error('Cupones XLSX: no se encontró la fila de encabezados')
  }

  const hdr = rows[headerRowIdx].map(c => str(c).toLowerCase())
  const C_CUPON  = findCol(hdr, ['número cup', 'nro cup', 'cupon', 'cupón'])
  const C_PLAN   = findCol(hdr, ['plan'])
  const C_TOTAL  = findCol(hdr, ['total', 'importe', 'monto'])
  const C_NOMBRE = findCol(hdr, ['nombre', 'titular', 'cliente'])
  const C_CONDIC = findCol(hdr, ['condici'])
  const C_FECHA  = findCol(hdr, ['fecha'])
  const C_CUOTAS = findCol(hdr, ['cuota'])

  const result: ParsedCupon[] = []

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const r         = rows[i]
    const cuponRaw  = C_CUPON !== -1 ? r[C_CUPON] : null
    const totalRaw  = C_TOTAL !== -1 ? r[C_TOTAL] : null
    const total     = num(totalRaw)
    if (!cuponRaw && total === 0) continue

    result.push({
      cupon:         str(cuponRaw),
      plan:          C_PLAN   !== -1 ? str(r[C_PLAN])   : '',
      total,
      nombre:        C_NOMBRE !== -1 ? str(r[C_NOMBRE]) : '',
      condicion:     C_CONDIC !== -1 ? str(r[C_CONDIC]) : '',
      fecha_ingreso: C_FECHA  !== -1 ? formatDateStr(r[C_FECHA]) : '',
      cuotas:        C_CUOTAS !== -1 ? Math.round(num(r[C_CUOTAS])) || 1 : 1,
    })
  }

  return result
}

// ── 4. MERCADO PAGO XLS ───────────────────────────────────────────────────────
//
// Dos cuentas (principal y secundaria) con columnas en DISTINTO ORDEN.
// Se detectan dinámicamente por nombre de header.
//
// Principal:   date_created | ... | counterpart_name | ... | reason | external_reference | operation_id | status | ...
// Secundaria:  date_created | date_approved | ... | counterpart_name | ... | operation_id | status | status_detail |
//              operation_type | transaction_amount | mercadopago_fee | marketplace_fee | shipping_cost
//
// mp_fee viene como número negativo en las exportaciones → Math.abs().

export function parseML(buffer: Buffer): ParsedMLOp[] {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null }) as unknown[][]

  if (rows.length < 2) return []

  // Buscar fila de header (primera que tenga 'operation_id' o 'status')
  let headerRowIdx = 0
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const r = rows[i].map(c => str(c).toLowerCase())
    if (r.some(c => c.includes('operation') || c.includes('status'))) {
      headerRowIdx = i
      break
    }
  }

  const hdr = rows[headerRowIdx].map(c => str(c).toLowerCase())
  const C_OPID    = findCol(hdr, ['operation_id'])
  const C_STATUS  = findCol(hdr, ['status'])
  const C_DETAIL  = findCol(hdr, ['status_detail'])
  const C_AMOUNT  = findCol(hdr, ['transaction_amount'])
  const C_FEE     = findCol(hdr, ['mercadopago_fee', 'mp_fee'])
  const C_SHIP    = findCol(hdr, ['shipping_cost'])
  const C_NAME    = findCol(hdr, ['counterpart_name'])
  const C_REF     = findCol(hdr, ['external_reference'])
  const C_REASON  = findCol(hdr, ['reason'])
  const C_CREATED  = findCol(hdr, ['date_created'])
  const C_APPROVED = findCol(hdr, ['date_approved'])

  if (C_OPID === -1) {
    throw new Error('ML: no se encontró la columna "operation_id" en el archivo')
  }

  const result: ParsedMLOp[] = []

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const r = rows[i]
    if (!r || r.every(c => c === null)) continue

    const opId = C_OPID !== -1 ? str(r[C_OPID]) : ''
    if (!opId) continue

    const fee  = C_FEE  !== -1 ? Math.abs(num(r[C_FEE]))  : 0
    const ship = C_SHIP !== -1 ? Math.abs(num(r[C_SHIP])) : 0

    result.push({
      operation_id:       opId,
      status:             C_STATUS   !== -1 ? str(r[C_STATUS])   : '',
      status_detail:      C_DETAIL   !== -1 ? str(r[C_DETAIL])   : '',
      transaction_amount: C_AMOUNT   !== -1 ? num(r[C_AMOUNT])   : 0,
      mp_fee:             fee,
      shipping_cost:      ship,
      counterpart_name:   C_NAME     !== -1 ? str(r[C_NAME])     : '',
      external_reference: C_REF      !== -1 ? str(r[C_REF])      : '',
      reason:             C_REASON   !== -1 ? str(r[C_REASON])   : '',
      date_created:       C_CREATED  !== -1 ? parseDate(r[C_CREATED])  : null,
      date_approved:      C_APPROVED !== -1 ? parseDate(r[C_APPROVED]) : null,
    })
  }

  return result
}
