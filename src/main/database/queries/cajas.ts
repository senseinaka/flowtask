import { randomUUID } from 'crypto'
import { getPowerSyncDb } from '../powersync'
import type {
  CashCompany, Cashbox, CashCategory,
  CashMovement, CashMovementAmount, CashCount, CashCountDetail,
  CashDifference, CashboxStatus,
} from '@shared/types'

const WORKSPACE_ID = 'd61a4071-1557-4f32-be5e-6443fb336bf5'

// ─── Empresas ─────────────────────────────────────────────────────────────────

export async function getCashCompanies(): Promise<CashCompany[]> {
  return getPowerSyncDb().getAll<CashCompany>(
    'SELECT * FROM cash_companies WHERE workspace_id = ? AND active = 1 ORDER BY name',
    [WORKSPACE_ID]
  )
}

// ─── Cajas ────────────────────────────────────────────────────────────────────

export async function getCashboxes(): Promise<Cashbox[]> {
  return getPowerSyncDb().getAll<Cashbox>(
    'SELECT * FROM cashboxes WHERE workspace_id = ? AND active = 1 ORDER BY company_id, name',
    [WORKSPACE_ID]
  )
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

export async function listCashDifferences(cashboxId: string): Promise<CashDifference[]> {
  return getPowerSyncDb().getAll<CashDifference>(
    `SELECT * FROM cash_differences WHERE cashbox_id = ? AND workspace_id = ? ORDER BY created_at DESC`,
    [cashboxId, WORKSPACE_ID]
  )
}
