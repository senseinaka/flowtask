import { randomUUID } from 'crypto'
import { getDb } from '../db'
import type {
  ReconPeriod, ReconImport, ReconInvoice, ReconCupon, ReconMLOp, ReconResult, ReconResultEnriched, ReconKPIs,
  CreateReconPeriodInput, ReconPeriodStatus, ReconEstado, ReconImportSource, ReconResultFilters
} from '@shared/types'
import type { ParsedInvoice, ParsedCupon, ParsedMLOp } from '../../services/recon-parsers.service'

const WORKSPACE_ID = 'd61a4071-1557-4f32-be5e-6443fb336bf5'

// ── Períodos ──────────────────────────────────────────────────────────────────

export function listReconPeriods(): ReconPeriod[] {
  return getDb().prepare(`
    SELECT * FROM recon_periods WHERE workspace_id = ?
    ORDER BY period_year DESC, period_month DESC
  `).all(WORKSPACE_ID) as ReconPeriod[]
}

export function getReconPeriod(id: string): ReconPeriod | null {
  return getDb().prepare('SELECT * FROM recon_periods WHERE id = ?').get(id) as ReconPeriod | null
}

export function createReconPeriod(data: CreateReconPeriodInput, createdBy: string): ReconPeriod {
  const db  = getDb()
  const id  = randomUUID()
  const now = Date.now()
  db.prepare(`
    INSERT INTO recon_periods
      (id, workspace_id, period_month, period_year, status, notes, created_by, closed_by, created_at)
    VALUES (?, ?, ?, ?, 'draft', ?, ?, '', ?)
  `).run(id, WORKSPACE_ID, data.period_month, data.period_year, data.notes ?? '', createdBy, now)
  return db.prepare('SELECT * FROM recon_periods WHERE id = ?').get(id) as ReconPeriod
}

export function updateReconPeriodStatus(id: string, status: ReconPeriodStatus, closedBy = ''): void {
  const db  = getDb()
  const now = Date.now()
  if (status === 'closed') {
    db.prepare(`UPDATE recon_periods SET status = ?, closed_by = ?, closed_at = ? WHERE id = ?`)
      .run(status, closedBy, now, id)
  } else {
    db.prepare('UPDATE recon_periods SET status = ? WHERE id = ?').run(status, id)
  }
}

export function deleteReconPeriod(id: string): void {
  getDb().prepare('DELETE FROM recon_periods WHERE id = ?').run(id)
}

// ── Registro de imports ───────────────────────────────────────────────────────

export function listReconImports(periodId: string): ReconImport[] {
  return getDb().prepare(`
    SELECT * FROM recon_imports WHERE period_id = ? ORDER BY imported_at DESC
  `).all(periodId) as ReconImport[]
}

export function logReconImport(data: {
  period_id:    string
  source:       ReconImportSource
  filename:     string
  row_count:    number
  skipped_count: number
  status:       'ok' | 'error' | 'warning'
  error_msg:    string
  imported_by:  string
}): ReconImport {
  const db  = getDb()
  const id  = randomUUID()
  const now = Date.now()
  db.prepare(`
    INSERT INTO recon_imports
      (id, period_id, source, filename, row_count, skipped_count, status, error_msg, imported_at, imported_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.period_id, data.source, data.filename, data.row_count, data.skipped_count,
         data.status, data.error_msg, now, data.imported_by)
  return db.prepare('SELECT * FROM recon_imports WHERE id = ?').get(id) as ReconImport
}

// ── Acceso a datos del período ────────────────────────────────────────────────

export function listReconInvoices(periodId: string): ReconInvoice[] {
  return getDb().prepare(`
    SELECT * FROM recon_invoices WHERE period_id = ? ORDER BY comprobante ASC
  `).all(periodId) as ReconInvoice[]
}

export function listReconCupones(periodId: string): ReconCupon[] {
  return getDb().prepare(`
    SELECT * FROM recon_cupones WHERE period_id = ? ORDER BY fecha_ingreso ASC, cupon ASC
  `).all(periodId) as ReconCupon[]
}

export function listReconMLOps(periodId: string): ReconMLOp[] {
  return getDb().prepare(`
    SELECT * FROM recon_ml_ops WHERE period_id = ? ORDER BY date_approved ASC
  `).all(periodId) as ReconMLOp[]
}

// ── Bulk inserts ──────────────────────────────────────────────────────────────

export function bulkInsertInvoices(
  periodId: string,
  rows: ParsedInvoice[],
  source: string
): { inserted: number; skipped: number } {
  const db   = getDb()
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO recon_invoices
      (id, period_id, comprobante, tipo, concepto, total, fecha,
       importe_tarjetas, importe_efectivo, importe_transferencia, importe_cta_cte, importe_otros, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  let inserted = 0
  db.transaction(() => {
    for (const r of rows) {
      const res = stmt.run(
        randomUUID(), periodId, r.comprobante, r.tipo, r.concepto, r.total, r.fecha ?? '',
        r.importe_tarjetas, r.importe_efectivo, r.importe_transferencia,
        r.importe_cta_cte, r.importe_otros, source
      )
      inserted += res.changes
    }
  })()
  return { inserted, skipped: rows.length - inserted }
}

export function bulkInsertCupones(
  periodId: string,
  rows: ParsedCupon[]
): { inserted: number; skipped: number } {
  const db   = getDb()
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO recon_cupones
      (id, period_id, cupon, plan, total, nombre, condicion, fecha_ingreso, cuotas)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  let inserted = 0
  db.transaction(() => {
    for (const r of rows) {
      const res = stmt.run(randomUUID(), periodId, r.cupon, r.plan, r.total,
                           r.nombre, r.condicion, r.fecha_ingreso, r.cuotas)
      inserted += res.changes
    }
  })()
  return { inserted, skipped: rows.length - inserted }
}

export function bulkInsertMLOps(
  periodId: string,
  rows: ParsedMLOp[],
  cuenta: string
): { inserted: number; skipped: number } {
  const db   = getDb()
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO recon_ml_ops
      (id, period_id, operation_id, status, status_detail,
       transaction_amount, mp_fee, shipping_cost, counterpart_name,
       external_reference, reason, date_created, date_approved, cuenta)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  let inserted = 0
  db.transaction(() => {
    for (const r of rows) {
      const res = stmt.run(
        randomUUID(), periodId, r.operation_id, r.status, r.status_detail,
        r.transaction_amount, r.mp_fee, r.shipping_cost, r.counterpart_name,
        r.external_reference, r.reason, r.date_created, r.date_approved, cuenta
      )
      inserted += res.changes
    }
  })()
  return { inserted, skipped: rows.length - inserted }
}

export function clearReconSource(periodId: string, source: string): number {
  const db = getDb()
  db.prepare('DELETE FROM recon_imports  WHERE period_id = ? AND source = ?').run(periodId, source)
  const res = db.prepare('DELETE FROM recon_invoices WHERE period_id = ? AND source = ?').run(periodId, source)
  return res.changes
}

export function clearReconCupones(periodId: string): number {
  const db = getDb()
  db.prepare(`DELETE FROM recon_imports WHERE period_id = ? AND source IN ('cupones_csv','cupones_xlsx')`).run(periodId)
  const res = db.prepare('DELETE FROM recon_cupones WHERE period_id = ?').run(periodId)
  return res.changes
}

export function clearReconMLOps(periodId: string, cuenta: string): number {
  const db    = getDb()
  const src   = cuenta === 'principal' ? 'ml_principal' : 'ml_secundaria'
  db.prepare('DELETE FROM recon_imports  WHERE period_id = ? AND source = ?').run(periodId, src)
  const res = db.prepare('DELETE FROM recon_ml_ops WHERE period_id = ? AND cuenta = ?').run(periodId, cuenta)
  return res.changes
}

// ── Resultados ────────────────────────────────────────────────────────────────

export function listReconResults(periodId: string, estado?: ReconEstado): ReconResult[] {
  const db = getDb()
  if (estado) {
    return db.prepare(`
      SELECT * FROM recon_results WHERE period_id = ? AND estado = ?
      ORDER BY rowid ASC
    `).all(periodId, estado) as ReconResult[]
  }
  return db.prepare(`
    SELECT * FROM recon_results WHERE period_id = ? ORDER BY rowid ASC
  `).all(periodId) as ReconResult[]
}

export function listAllReconResults(filters?: ReconResultFilters): ReconResultEnriched[] {
  const wheres: string[] = ['rp.workspace_id = ?']
  const params: unknown[] = [WORKSPACE_ID]

  if (filters?.periodMonth !== undefined) {
    wheres.push('rp.period_month = ?')
    params.push(filters.periodMonth)
  }
  if (filters?.periodYear !== undefined) {
    wheres.push('rp.period_year = ?')
    params.push(filters.periodYear)
  }
  if (filters?.estado) {
    wheres.push('r.estado = ?')
    params.push(filters.estado)
  }

  return getDb().prepare(`
    SELECT
      r.*,
      rp.period_month, rp.period_year,
      ri.comprobante, ri.concepto, ri.total, ri.importe_tarjetas, ri.fecha,
      ml.operation_id, ml.transaction_amount, ml.counterpart_name
    FROM recon_results r
    JOIN  recon_periods  rp ON rp.id = r.period_id
    LEFT JOIN recon_invoices ri ON ri.id = r.invoice_id
    LEFT JOIN recon_ml_ops   ml ON ml.id = r.ml_op_id
    WHERE ${wheres.join(' AND ')}
    ORDER BY rp.period_year DESC, rp.period_month DESC, r.rowid ASC
  `).all(...params) as ReconResultEnriched[]
}

export function updateReconResult(id: string, data: {
  estado?:      ReconEstado
  notes?:       string
  override_by?: string
}): void {
  const db   = getDb()
  const now  = Date.now()
  const sets: string[] = []
  const vals: unknown[] = []
  if (data.estado      !== undefined) { sets.push('estado = ?');      vals.push(data.estado) }
  if (data.notes       !== undefined) { sets.push('notes = ?');        vals.push(data.notes) }
  if (data.override_by !== undefined) {
    sets.push('override_by = ?', 'override_at = ?')
    vals.push(data.override_by, now)
  }
  if (sets.length === 0) return
  vals.push(id)
  db.prepare(`UPDATE recon_results SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
}

// ── Motor de conciliación ─────────────────────────────────────────────────────

const REJECTED_STATUSES = new Set(['rejected', 'cancelled', 'refunded', 'charged_back'])

interface ResultInsert {
  invoice_id:       string | null
  cupon_id:         string | null
  ml_op_id:         string | null
  estado:           ReconEstado
  diferencia:       number
  match_score:      number
  match_method:     string
  no_cobrado_razon: string
}

export function runReconEngine(periodId: string): { inserted: number } {
  const db = getDb()

  const invoices = db.prepare(
    'SELECT * FROM recon_invoices WHERE period_id = ?'
  ).all(periodId) as ReconInvoice[]

  const mlOps = db.prepare(
    'SELECT * FROM recon_ml_ops WHERE period_id = ?'
  ).all(periodId) as ReconMLOp[]

  const usedMlIds  = new Set<string>()
  const usedInvIds = new Set<string>()
  const results: ResultInsert[] = []

  // ── Nivel 1: external_reference == comprobante ────────────────────────────
  for (const inv of invoices) {
    if (inv.importe_tarjetas === 0) continue
    const match = mlOps.find(op =>
      !usedMlIds.has(op.id) &&
      !REJECTED_STATUSES.has(op.status) &&
      op.external_reference &&
      op.external_reference.trim() === inv.comprobante.trim()
    )
    if (!match) continue
    usedMlIds.add(match.id)
    usedInvIds.add(inv.id)

    const diff = inv.importe_tarjetas - match.transaction_amount
    const pct  = Math.abs(diff) / Math.max(inv.importe_tarjetas, 0.01)
    results.push({
      invoice_id: inv.id, cupon_id: null, ml_op_id: match.id,
      estado:       pct < 0.01 ? 'conciliado' : pct < 0.05 ? 'dif_menor' : 'diferencia_monto',
      diferencia:   diff,
      match_score:  1.0,
      match_method: 'external_reference',
      no_cobrado_razon: '',
    })
  }

  // ── Nivel 2: monto exacto ≤1% ─────────────────────────────────────────────
  for (const inv of invoices) {
    if (usedInvIds.has(inv.id) || inv.importe_tarjetas === 0) continue
    const match = mlOps.find(op =>
      !usedMlIds.has(op.id) &&
      !REJECTED_STATUSES.has(op.status) &&
      Math.abs(op.transaction_amount - inv.importe_tarjetas) /
        Math.max(inv.importe_tarjetas, 0.01) < 0.01
    )
    if (!match) continue
    usedMlIds.add(match.id)
    usedInvIds.add(inv.id)
    results.push({
      invoice_id: inv.id, cupon_id: null, ml_op_id: match.id,
      estado:       'conciliado_monto',
      diferencia:   inv.importe_tarjetas - match.transaction_amount,
      match_score:  0.9,
      match_method: 'amount_exact',
      no_cobrado_razon: '',
    })
  }

  // ── Nivel 3: monto fuzzy ≤5% ─────────────────────────────────────────────
  for (const inv of invoices) {
    if (usedInvIds.has(inv.id) || inv.importe_tarjetas === 0) continue
    const candidates = mlOps
      .filter(op => !usedMlIds.has(op.id) && !REJECTED_STATUSES.has(op.status))
      .map(op => ({
        op,
        pct: Math.abs(op.transaction_amount - inv.importe_tarjetas) /
               Math.max(inv.importe_tarjetas, 0.01),
      }))
      .filter(c => c.pct <= 0.05)
      .sort((a, b) => a.pct - b.pct)

    const best = candidates[0]
    if (!best) continue
    usedMlIds.add(best.op.id)
    usedInvIds.add(inv.id)
    results.push({
      invoice_id: inv.id, cupon_id: null, ml_op_id: best.op.id,
      estado:       'dif_menor',
      diferencia:   inv.importe_tarjetas - best.op.transaction_amount,
      match_score:  1 - best.pct,
      match_method: 'amount_fuzzy',
      no_cobrado_razon: '',
    })
  }

  // ── Facturas sin match ────────────────────────────────────────────────────
  for (const inv of invoices) {
    if (usedInvIds.has(inv.id)) continue
    if (inv.importe_tarjetas === 0) {
      let razon = ''
      if (inv.importe_efectivo > 0)         razon = 'Efectivo'
      else if (inv.importe_cta_cte > 0)     razon = 'Cta. Cte.'
      else if (inv.importe_transferencia > 0) razon = 'Transferencia'
      else if (inv.importe_otros > 0)        razon = 'Otros'
      results.push({
        invoice_id: inv.id, cupon_id: null, ml_op_id: null,
        estado: 'no_cobrado_ml', diferencia: 0,
        match_score: 0, match_method: '', no_cobrado_razon: razon,
      })
    } else {
      results.push({
        invoice_id: inv.id, cupon_id: null, ml_op_id: null,
        estado: 'pendiente', diferencia: inv.importe_tarjetas,
        match_score: 0, match_method: '', no_cobrado_razon: '',
      })
    }
  }

  // ── Ops ML sin match ──────────────────────────────────────────────────────
  for (const op of mlOps) {
    if (usedMlIds.has(op.id)) continue
    results.push({
      invoice_id: null, cupon_id: null, ml_op_id: op.id,
      estado:     REJECTED_STATUSES.has(op.status) ? 'rechazado_ml' : 'pendiente',
      diferencia: -op.transaction_amount,
      match_score: 0, match_method: '', no_cobrado_razon: '',
    })
  }

  // ── Persist ───────────────────────────────────────────────────────────────
  const stmt = db.prepare(`
    INSERT INTO recon_results
      (id, period_id, invoice_id, cupon_id, ml_op_id, estado, diferencia,
       match_score, match_method, no_cobrado_razon, override_by, override_at, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', NULL, '')
  `)

  db.transaction(() => {
    db.prepare('DELETE FROM recon_results WHERE period_id = ?').run(periodId)
    for (const r of results) {
      stmt.run(
        randomUUID(), periodId,
        r.invoice_id, r.cupon_id, r.ml_op_id,
        r.estado, r.diferencia, r.match_score, r.match_method,
        r.no_cobrado_razon
      )
    }
  })()

  return { inserted: results.length }
}

// ── KPIs ──────────────────────────────────────────────────────────────────────

export function getReconKPIs(periodId: string): ReconKPIs {
  const db = getDb()

  const rows = db.prepare(`
    SELECT r.estado,
           COUNT(*) as cnt,
           SUM(COALESCE(i.importe_tarjetas, 0) + COALESCE(ABS(r.diferencia) * CASE WHEN r.invoice_id IS NULL THEN 1 ELSE 0 END, 0)) as monto
    FROM recon_results r
    LEFT JOIN recon_invoices i ON i.id = r.invoice_id
    WHERE r.period_id = ?
    GROUP BY r.estado
  `).all(periodId) as { estado: ReconEstado; cnt: number; monto: number }[]

  const byEstado: ReconKPIs['byEstado'] = {}
  let total = 0
  let totalMonto = 0
  let conciliadoMonto = 0
  let pendienteMonto  = 0

  for (const row of rows) {
    byEstado[row.estado] = { count: row.cnt, monto: row.monto ?? 0 }
    total      += row.cnt
    totalMonto += row.monto ?? 0
    if (['conciliado', 'dif_menor', 'conciliado_monto'].includes(row.estado)) {
      conciliadoMonto += row.monto ?? 0
    }
    if (['pendiente', 'diferencia_monto'].includes(row.estado)) {
      pendienteMonto += row.monto ?? 0
    }
  }

  return { total, byEstado, totalMonto, conciliadoMonto, pendienteMonto }
}
