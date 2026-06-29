import { randomUUID } from 'crypto'
import { getPowerSyncDb } from '../powersync'
import type {
  CashCompany, Cashbox, CashCategory,
  CashMovement, CashMovementAmount, CashCount,
  CashDifference, CashboxStatus, CashMovementListItem,
  PendingDifferenceItem,
} from '@shared/types'

const WORKSPACE_ID = 'd61a4071-1557-4f32-be5e-6443fb336bf5'

// ─── Empresas ─────────────────────────────────────────────────────────────────

export async function getCashCompanies(): Promise<CashCompany[]> {
  return getPowerSyncDb().getAll<CashCompany>(
    'SELECT * FROM cash_companies WHERE workspace_id = ? AND active = 1 ORDER BY sort_order ASC, name ASC',
    [WORKSPACE_ID]
  )
}

// ─── Cajas ────────────────────────────────────────────────────────────────────

export async function getCashboxes(): Promise<Cashbox[]> {
  return getPowerSyncDb().getAll<Cashbox>(
    'SELECT * FROM cashboxes WHERE workspace_id = ? AND active = 1 ORDER BY sort_order ASC, name ASC',
    [WORKSPACE_ID]
  )
}

// Editar nombre y descripción de una caja (lápiz editable en el dashboard).
export async function updateCashboxInfo(id: string, name: string, description: string): Promise<void> {
  await getPowerSyncDb().execute(
    'UPDATE cashboxes SET name = ?, description = ? WHERE id = ? AND workspace_id = ?',
    [name.trim(), description.trim(), id, WORKSPACE_ID]
  )
}

// Mueve una caja una posición dentro de su empresa (flechas ◀ ▶).
// Renormaliza el sort_order de todos los hermanos a 1..N en el nuevo orden,
// así queda consistente aunque venían empatados (default 0).
export async function moveCashbox(id: string, direction: 'up' | 'down'): Promise<void> {
  const db = getPowerSyncDb()
  const target = (await db.getAll<Cashbox>(
    'SELECT * FROM cashboxes WHERE id = ? AND workspace_id = ?',
    [id, WORKSPACE_ID]
  ))[0]
  if (!target) return

  const siblings = await db.getAll<Cashbox>(
    'SELECT * FROM cashboxes WHERE company_id = ? AND workspace_id = ? AND active = 1 ORDER BY sort_order ASC, name ASC',
    [target.company_id, WORKSPACE_ID]
  )
  const idx = siblings.findIndex(s => s.id === id)
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (idx < 0 || swapIdx < 0 || swapIdx >= siblings.length) return

  const reordered = [...siblings]
  ;[reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]]

  for (let i = 0; i < reordered.length; i++) {
    await db.execute(
      'UPDATE cashboxes SET sort_order = ? WHERE id = ? AND workspace_id = ?',
      [i + 1, reordered[i].id, WORKSPACE_ID]
    )
  }
}

export async function getCashbox(id: string): Promise<Cashbox | null> {
  const rows = await getPowerSyncDb().getAll<Cashbox>(
    'SELECT * FROM cashboxes WHERE id = ?', [id]
  )
  return rows[0] ?? null
}

export async function updateCashboxStatus(id: string, status: CashboxStatus): Promise<void> {
  await getPowerSyncDb().execute(
    'UPDATE cashboxes SET status = ? WHERE id = ?',
    [status, id]
  )
}

// ─── Saldos (calculados a partir de movimientos confirmados) ──────────────────

export async function getCashboxBalances(): Promise<{ cashbox_id: string; currency: string; balance: number }[]> {
  return getPowerSyncDb().getAll<{ cashbox_id: string; currency: string; balance: number }>(
    `SELECT m.cashbox_id, a.currency, COALESCE(SUM(a.amount), 0) AS balance
     FROM cash_movements m
     JOIN cash_movement_amounts a ON a.movement_id = m.id
     WHERE m.workspace_id = ? AND m.status = 'confirmed'
     GROUP BY m.cashbox_id, a.currency`,
    [WORKSPACE_ID]
  )
}

// ─── Último conteo por caja ───────────────────────────────────────────────────

export async function getCashboxLastCounts(): Promise<{ cashbox_id: string; last_count_at: string }[]> {
  return getPowerSyncDb().getAll<{ cashbox_id: string; last_count_at: string }>(
    `SELECT cashbox_id, MAX(created_at) AS last_count_at
     FROM cash_counts
     WHERE workspace_id = ? AND status IN ('confirmed', 'with_difference')
     GROUP BY cashbox_id`,
    [WORKSPACE_ID]
  )
}

// ─── Categorías ───────────────────────────────────────────────────────────────

export async function getCashCategories(type?: 'income' | 'expense'): Promise<CashCategory[]> {
  const where = type
    ? 'workspace_id = ? AND active = 1 AND (company_id = \'\' OR company_id IS NULL) AND type = ?'
    : 'workspace_id = ? AND active = 1 AND (company_id = \'\' OR company_id IS NULL)'
  const params = type ? [WORKSPACE_ID, type] : [WORKSPACE_ID]
  return getPowerSyncDb().getAll<CashCategory>(
    `SELECT * FROM cash_categories WHERE ${where} ORDER BY name`,
    params
  )
}

// ─── Movimientos ──────────────────────────────────────────────────────────────

export async function listCashMovements(cashboxId: string, limit = 50): Promise<CashMovement[]> {
  return getPowerSyncDb().getAll<CashMovement>(
    `SELECT * FROM cash_movements WHERE cashbox_id = ? AND workspace_id = ?
     ORDER BY created_at DESC LIMIT ?`,
    [cashboxId, WORKSPACE_ID, limit]
  )
}

export async function listCashMovementAmounts(movementId: string): Promise<CashMovementAmount[]> {
  return getPowerSyncDb().getAll<CashMovementAmount>(
    'SELECT * FROM cash_movement_amounts WHERE movement_id = ?',
    [movementId]
  )
}

// Historial enriquecido para el modal de movimientos: trae en UNA query la
// categoría, los montos (JSON array) y la cantidad de comprobantes adjuntos.
export async function getCashMovementsWithMeta(
  cashboxId: string,
  limit = 100
): Promise<CashMovementListItem[]> {
  return getPowerSyncDb().getAll<CashMovementListItem>(
    `SELECT m.id, m.cashbox_id, m.type, m.status, m.reference_date,
            m.category_id, c.name AS category_name, m.notes,
            m.created_by, m.created_at,
            COALESCE((
              SELECT json_group_array(json_object('currency', a.currency, 'amount', a.amount))
              FROM cash_movement_amounts a WHERE a.movement_id = m.id
            ), '[]') AS amounts_json,
            (
              SELECT COUNT(*) FROM cash_attachments att
              WHERE att.owner_type = 'movement' AND att.owner_id = m.id
            ) AS attachment_count
     FROM cash_movements m
     LEFT JOIN cash_categories c ON c.id = m.category_id
     WHERE m.cashbox_id = ? AND m.workspace_id = ?
     ORDER BY m.created_at DESC
     LIMIT ?`,
    [cashboxId, WORKSPACE_ID, limit]
  )
}

export async function createCashMovement(
  input: {
    cashbox_id: string
    type: CashMovement['type']
    reference_date: string
    category_id: string
    source_cashbox_id?: string
    dest_cashbox_id?: string
    notes?: string
    amounts: { currency: string; amount: number }[]
    created_by: string
  }
): Promise<string> {
  const db = getPowerSyncDb()
  const movementId = randomUUID()
  const now = new Date().toISOString()

  await db.execute(
    `INSERT INTO cash_movements
      (id, workspace_id, cashbox_id, type, status, reference_date, category_id,
       source_cashbox_id, dest_cashbox_id, notes, created_by, created_at, updated_at,
       confirmed_by, confirmed_at)
     VALUES (?,?,?,?,'confirmed',?,?,?,?,?,?,?,?,'','')`,
    [
      movementId, WORKSPACE_ID, input.cashbox_id, input.type,
      input.reference_date, input.category_id ?? '',
      input.source_cashbox_id ?? '', input.dest_cashbox_id ?? '',
      input.notes ?? '', input.created_by, now, now,
    ]
  )

  for (const { currency, amount } of input.amounts) {
    if (amount === 0) continue
    await db.execute(
      'INSERT INTO cash_movement_amounts (id, workspace_id, movement_id, currency, amount, created_at) VALUES (?,?,?,?,?,?)',
      [randomUUID(), WORKSPACE_ID, movementId, currency, amount, now]
    )
  }

  return movementId
}

// Crea dos movimientos de transferencia (salida en origen, entrada en destino).
// Los amounts recibidos son POSITIVOS; la función aplica el signo correspondiente.
export async function createTransfer(
  input: {
    source_cashbox_id: string
    dest_cashbox_id: string
    amounts: { currency: string; amount: number }[]
    notes?: string
    reference_date: string
    created_by: string
  }
): Promise<void> {
  const db    = getPowerSyncDb()
  const now   = new Date().toISOString()
  const srcId = randomUUID()
  const dstId = randomUUID()
  const notes = input.notes ?? ''

  const INSERT_MOVEMENT = `
    INSERT INTO cash_movements
      (id, workspace_id, cashbox_id, type, status, reference_date, category_id,
       source_cashbox_id, dest_cashbox_id, notes, created_by, created_at, updated_at,
       confirmed_by, confirmed_at)
    VALUES (?,?,?,'transfer','confirmed',?,?,?,?,?,?,?,?,'','')`

  // movimiento en la caja origen (sale dinero → amounts negativos)
  await db.execute(INSERT_MOVEMENT, [
    srcId, WORKSPACE_ID, input.source_cashbox_id,
    input.reference_date, '',
    input.source_cashbox_id, input.dest_cashbox_id,
    notes, input.created_by, now, now,
  ])

  // movimiento en la caja destino (entra dinero → amounts positivos)
  await db.execute(INSERT_MOVEMENT, [
    dstId, WORKSPACE_ID, input.dest_cashbox_id,
    input.reference_date, '',
    input.source_cashbox_id, input.dest_cashbox_id,
    notes, input.created_by, now, now,
  ])

  const INSERT_AMOUNT =
    'INSERT INTO cash_movement_amounts (id, workspace_id, movement_id, currency, amount, created_at) VALUES (?,?,?,?,?,?)'

  for (const { currency, amount } of input.amounts) {
    if (amount === 0) continue
    await db.execute(INSERT_AMOUNT, [randomUUID(), WORKSPACE_ID, srcId, currency, -Math.abs(amount), now])
    await db.execute(INSERT_AMOUNT, [randomUUID(), WORKSPACE_ID, dstId, currency,  Math.abs(amount), now])
  }
}

// ─── Reporte / export ────────────────────────────────────────────────────────

export async function getMovementsForReport(
  cashboxId: string,
  dateFrom:  string,
  dateTo:    string
): Promise<{
  fecha: string; tipo: string; categoria: string
  moneda: string; importe: number; notas: string; registrado_por: string
}[]> {
  return getPowerSyncDb().getAll(
    `SELECT m.reference_date AS fecha, m.type AS tipo,
            COALESCE(c.name, '') AS categoria,
            a.currency AS moneda, a.amount AS importe,
            m.notes AS notas, m.created_by AS registrado_por
     FROM cash_movements m
     LEFT JOIN cash_movement_amounts a ON a.movement_id = m.id
     LEFT JOIN cash_categories c ON c.id = m.category_id
     WHERE m.cashbox_id = ? AND m.workspace_id = ? AND m.status = 'confirmed'
       AND m.reference_date BETWEEN ? AND ?
     ORDER BY m.reference_date, m.created_at, a.currency`,
    [cashboxId, WORKSPACE_ID, dateFrom, dateTo]
  )
}

export async function getDifferencesForReport(cashboxId: string): Promise<{
  fecha: string; moneda: string; sistema: number; contado: number
  diferencia: number; estado: string; resolucion: string; resuelto_por: string
}[]> {
  return getPowerSyncDb().getAll(
    `SELECT created_at AS fecha, currency AS moneda,
            system_amount AS sistema, counted_amount AS contado,
            difference AS diferencia, status AS estado,
            resolution_notes AS resolucion, resolved_by AS resuelto_por
     FROM cash_differences
     WHERE cashbox_id = ? AND workspace_id = ?
     ORDER BY created_at DESC`,
    [cashboxId, WORKSPACE_ID]
  )
}

export async function getCountsForReport(cashboxId: string): Promise<{
  fecha: string; tipo: string; estado: string; contado_por: string; notas: string
}[]> {
  return getPowerSyncDb().getAll(
    `SELECT created_at AS fecha, count_type AS tipo,
            status AS estado, counted_by AS contado_por, notes AS notas
     FROM cash_counts
     WHERE cashbox_id = ? AND workspace_id = ?
     ORDER BY created_at DESC`,
    [cashboxId, WORKSPACE_ID]
  )
}

// ─── Resumen diario ───────────────────────────────────────────────────────────

export async function getDailyMovementsSummary(
  cashboxId: string,
  date: string
): Promise<{ type: string; currency: string; total: number }[]> {
  return getPowerSyncDb().getAll<{ type: string; currency: string; total: number }>(
    `SELECT m.type, a.currency, COALESCE(SUM(a.amount), 0) AS total
     FROM cash_movements m
     JOIN cash_movement_amounts a ON a.movement_id = m.id
     WHERE m.cashbox_id = ? AND m.workspace_id = ? AND m.status = 'confirmed'
       AND m.reference_date = ?
     GROUP BY m.type, a.currency`,
    [cashboxId, WORKSPACE_ID, date]
  )
}

// ─── Serie temporal para gráficos (flujo por mes) ─────────────────────────────
// Agrupa por mes (YYYY-MM) los importes de una moneda. Como los egresos se
// guardan con signo negativo (ver NuevoMovimientoModal), separamos por signo:
//   income  = todo lo que entró (amount > 0)   → ingresos + entradas de transfer
//   expense = todo lo que salió (amount < 0)    → egresos + salidas de transfer
//   net     = SUM(amount) = variación real del saldo en el período
// Si se pasa cashboxIds, limita a esas cajas (respeta el filtro de empresa).

export async function getCashFlowSeries(
  dateFrom: string,
  dateTo: string,
  cashboxIds?: string[],
  currency: string = 'ARS'
): Promise<{ period: string; income: number; expense: number; net: number }[]> {
  const conds: string[] = [
    'm.workspace_id = ?',
    "m.status = 'confirmed'",
    'a.currency = ?',
    'm.reference_date BETWEEN ? AND ?',
  ]
  const params: string[] = [WORKSPACE_ID, currency, dateFrom, dateTo]

  if (cashboxIds && cashboxIds.length > 0) {
    conds.push(`m.cashbox_id IN (${cashboxIds.map(() => '?').join(',')})`)
    params.push(...cashboxIds)
  }

  return getPowerSyncDb().getAll<{ period: string; income: number; expense: number; net: number }>(
    `SELECT substr(m.reference_date, 1, 7) AS period,
            COALESCE(SUM(CASE WHEN a.amount > 0 THEN a.amount  ELSE 0 END), 0) AS income,
            COALESCE(SUM(CASE WHEN a.amount < 0 THEN -a.amount ELSE 0 END), 0) AS expense,
            COALESCE(SUM(a.amount), 0) AS net
     FROM cash_movements m
     JOIN cash_movement_amounts a ON a.movement_id = m.id
     WHERE ${conds.join(' AND ')}
     GROUP BY period
     ORDER BY period`,
    params
  )
}

// ─── Permisos por caja ───────────────────────────────────────────────────────

import type { CashboxPermission } from '@shared/types'

export async function getCashboxPermissions(cashboxId: string): Promise<CashboxPermission[]> {
  return getPowerSyncDb().getAll<CashboxPermission>(
    'SELECT * FROM cashbox_permissions WHERE cashbox_id = ? AND workspace_id = ? ORDER BY user_id, permission_key',
    [cashboxId, WORKSPACE_ID]
  )
}

export async function grantCashboxPermission(input: {
  cashbox_id:     string
  user_id:        string
  permission_key: string
  granted_by:     string
}): Promise<void> {
  const id  = `${input.cashbox_id}.${input.user_id}.${input.permission_key}`
  const now = new Date().toISOString()
  await getPowerSyncDb().execute(
    `INSERT OR IGNORE INTO cashbox_permissions
      (id, workspace_id, cashbox_id, user_id, permission_key, granted_by, created_at)
     VALUES (?,?,?,?,?,?,?)`,
    [id, WORKSPACE_ID, input.cashbox_id, input.user_id, input.permission_key, input.granted_by, now]
  )
}

export async function revokeCashboxPermission(id: string): Promise<void> {
  await getPowerSyncDb().execute(
    'DELETE FROM cashbox_permissions WHERE id = ?', [id]
  )
}

// ─── Conteos ──────────────────────────────────────────────────────────────────

export async function listCashCounts(cashboxId: string, limit = 20): Promise<CashCount[]> {
  return getPowerSyncDb().getAll<CashCount>(
    `SELECT * FROM cash_counts WHERE cashbox_id = ? AND workspace_id = ?
     ORDER BY created_at DESC LIMIT ?`,
    [cashboxId, WORKSPACE_ID, limit]
  )
}

export async function createCashCount(
  input: {
    cashbox_id: string
    count_type: CashCount['count_type']
    notes: string
    counted_by: string
    details: { currency: string; denomination: number; quantity: number }[]
    has_difference: boolean
  }
): Promise<string> {
  const db = getPowerSyncDb()
  const countId = randomUUID()
  const now = new Date().toISOString()
  const status = input.has_difference ? 'with_difference' : 'confirmed'

  await db.execute(
    `INSERT INTO cash_counts
      (id, workspace_id, cashbox_id, count_type, status, counted_by, confirmed_by, notes, created_at)
     VALUES (?,?,?,?,?,?,'',?,?)`,
    [countId, WORKSPACE_ID, input.cashbox_id, input.count_type, status, input.counted_by, input.notes, now]
  )

  for (const d of input.details) {
    if (d.quantity === 0) continue
    await db.execute(
      'INSERT INTO cash_count_details (id, workspace_id, count_id, currency, denomination, quantity, created_at) VALUES (?,?,?,?,?,?,?)',
      [randomUUID(), WORKSPACE_ID, countId, d.currency, d.denomination, d.quantity, now]
    )
  }

  return countId
}

// ─── Diferencias ──────────────────────────────────────────────────────────────

export async function createCashDifference(
  input: {
    cashbox_id: string
    count_id: string
    currency: string
    system_amount: number
    counted_amount: number
  }
): Promise<void> {
  const diff = input.counted_amount - input.system_amount
  await getPowerSyncDb().execute(
    `INSERT INTO cash_differences
      (id, workspace_id, cashbox_id, count_id, currency, system_amount, counted_amount, difference,
       status, resolution_notes, resolved_by, created_at)
     VALUES (?,?,?,?,?,?,?,?,'pending','','',?)`,
    [
      randomUUID(), WORKSPACE_ID, input.cashbox_id, input.count_id,
      input.currency, input.system_amount, input.counted_amount, diff,
      new Date().toISOString(),
    ]
  )
}

export async function updateCashDifference(
  id: string,
  input: { status: 'resolved' | 'written_off'; resolution_notes: string; resolved_by: string }
): Promise<void> {
  await getPowerSyncDb().execute(
    'UPDATE cash_differences SET status = ?, resolution_notes = ?, resolved_by = ? WHERE id = ?',
    [input.status, input.resolution_notes, input.resolved_by, id]
  )
}

export async function listCashDifferences(cashboxId: string): Promise<CashDifference[]> {
  return getPowerSyncDb().getAll<CashDifference>(
    `SELECT * FROM cash_differences WHERE cashbox_id = ? AND workspace_id = ? ORDER BY created_at DESC`,
    [cashboxId, WORKSPACE_ID]
  )
}

// Todas las diferencias sin resolver (pending / under_review) de todo el workspace,
// con nombre de caja y empresa, para el banner de alertas de descuadre.
export async function listAllPendingDifferences(): Promise<PendingDifferenceItem[]> {
  return getPowerSyncDb().getAll<PendingDifferenceItem>(
    `SELECT d.*,
            b.name AS cashbox_name,
            COALESCE(co.name, '') AS company_name
       FROM cash_differences d
       JOIN cashboxes b       ON b.id = d.cashbox_id
       LEFT JOIN cash_companies co ON co.id = b.company_id
      WHERE d.workspace_id = ?
        AND d.status IN ('pending', 'under_review')
      ORDER BY d.created_at ASC`,
    [WORKSPACE_ID]
  )
}
