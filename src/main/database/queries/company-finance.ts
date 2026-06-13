import { randomUUID } from 'crypto'
import { getPowerSyncDb } from '../powersync'
import type {
  FinanceAccount, FinanceCategory, FinanceConcept, FinanceMovement,
  FinanceMovementEntry, CreateFinanceMovementEntryInput, UpdateFinanceMovementEntryInput,
  FinancePaymentMethodEntity, CreateFinancePaymentMethodInput,
  CreateFinanceAccountInput, CreateFinanceCategoryInput,
  CreateFinanceConceptInput, CreateFinanceMovementInput,
  FinanceMonthSummary, FinanceMonthInsight, FinanceMovementStatus, FinancePaymentMethod,
  FinanceCategoryBreakdownItem, FinanceHistoryEntry, FinanceRankingConcept, FinanceRankingIncrease,
  FinanceImportIssue, FinanceImportPreviewItem, FinanceImportPreviewResult,
  FinanceImportConfirmItem, FinanceImportResult
} from '@shared/types'
import type { ParsedImportRow } from '../../services/finance-io.service'

const WORKSPACE_ID = 'd61a4071-1557-4f32-be5e-6443fb336bf5'

/** Contexto mínimo compartido por PowerSyncDatabase y por Transaction (writeTransaction). */
type SqlCtx = {
  execute: (sql: string, params?: unknown[]) => Promise<unknown>
  get: <T>(sql: string, params?: unknown[]) => Promise<T>
}

// ── Accounts ──────────────────────────────────────────────────────────────────

export async function listCompanyFinanceAccounts(): Promise<FinanceAccount[]> {
  return getPowerSyncDb().getAll<FinanceAccount>(`
    SELECT * FROM company_finance_accounts ORDER BY is_default DESC, name ASC
  `)
}

export async function createCompanyFinanceAccount(data: CreateFinanceAccountInput): Promise<FinanceAccount> {
  const db  = getPowerSyncDb()
  const id  = randomUUID()
  const now = Date.now()
  await db.execute(`
    INSERT INTO company_finance_accounts (id, name, icon, color, is_default, created_at, updated_at, workspace_id)
    VALUES (?, ?, ?, ?, 0, ?, ?, ?)
  `, [id, data.name, data.icon ?? '💰', data.color ?? '#10b981', now, now, WORKSPACE_ID])
  return (await db.getOptional<FinanceAccount>('SELECT * FROM company_finance_accounts WHERE id = ?', [id]))!
}

export async function updateCompanyFinanceAccount(
  id: string, data: Partial<CreateFinanceAccountInput>
): Promise<FinanceAccount> {
  const db  = getPowerSyncDb()
  const now = Date.now()
  const sets: string[] = []
  const vals: unknown[] = []
  if (data.name  !== undefined) { sets.push('name = ?');  vals.push(data.name)  }
  if (data.icon  !== undefined) { sets.push('icon = ?');  vals.push(data.icon)  }
  if (data.color !== undefined) { sets.push('color = ?'); vals.push(data.color) }
  sets.push('updated_at = ?'); vals.push(now); vals.push(id)
  await db.execute(`UPDATE company_finance_accounts SET ${sets.join(', ')} WHERE id = ?`, vals)
  return (await db.getOptional<FinanceAccount>('SELECT * FROM company_finance_accounts WHERE id = ?', [id]))!
}

export async function deleteCompanyFinanceAccount(id: string): Promise<void> {
  await getPowerSyncDb().execute('DELETE FROM company_finance_accounts WHERE id = ?', [id])
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function listCompanyFinanceCategories(): Promise<FinanceCategory[]> {
  return getPowerSyncDb().getAll<FinanceCategory>(`
    SELECT * FROM company_finance_categories ORDER BY is_default DESC, name ASC
  `)
}

export async function createCompanyFinanceCategory(data: CreateFinanceCategoryInput): Promise<FinanceCategory> {
  const db  = getPowerSyncDb()
  const id  = randomUUID()
  const now = Date.now()
  await db.execute(`
    INSERT INTO company_finance_categories (id, name, icon, color, is_default, created_at, updated_at, workspace_id)
    VALUES (?, ?, ?, ?, 0, ?, ?, ?)
  `, [id, data.name, data.icon ?? '📁', data.color ?? '#6366f1', now, now, WORKSPACE_ID])
  return (await db.getOptional<FinanceCategory>('SELECT * FROM company_finance_categories WHERE id = ?', [id]))!
}

export async function updateCompanyFinanceCategory(
  id: string, data: Partial<CreateFinanceCategoryInput>
): Promise<FinanceCategory> {
  const db  = getPowerSyncDb()
  const now = Date.now()
  const sets: string[] = []
  const vals: unknown[] = []
  if (data.name  !== undefined) { sets.push('name = ?');  vals.push(data.name)  }
  if (data.icon  !== undefined) { sets.push('icon = ?');  vals.push(data.icon)  }
  if (data.color !== undefined) { sets.push('color = ?'); vals.push(data.color) }
  sets.push('updated_at = ?'); vals.push(now); vals.push(id)
  await db.execute(`UPDATE company_finance_categories SET ${sets.join(', ')} WHERE id = ?`, vals)
  return (await db.getOptional<FinanceCategory>('SELECT * FROM company_finance_categories WHERE id = ?', [id]))!
}

export async function deleteCompanyFinanceCategory(id: string): Promise<void> {
  await getPowerSyncDb().execute('DELETE FROM company_finance_categories WHERE id = ?', [id])
}

// ── Payment methods ───────────────────────────────────────────────────────────
// Mismo patrón CRUD que cuentas/categorías — entidad gestionable que respalda
// los ids de texto libre guardados en `payment_method` (concepts y movements).

export async function listCompanyFinancePaymentMethods(): Promise<FinancePaymentMethodEntity[]> {
  return getPowerSyncDb().getAll<FinancePaymentMethodEntity>(`
    SELECT * FROM company_finance_payment_methods ORDER BY is_default DESC, name ASC
  `)
}

export async function createCompanyFinancePaymentMethod(data: CreateFinancePaymentMethodInput): Promise<FinancePaymentMethodEntity> {
  const db  = getPowerSyncDb()
  const id  = randomUUID()
  const now = Date.now()
  await db.execute(`
    INSERT INTO company_finance_payment_methods (id, name, icon, color, is_default, created_at, updated_at, workspace_id)
    VALUES (?, ?, ?, ?, 0, ?, ?, ?)
  `, [id, data.name, data.icon ?? '💳', data.color ?? '#64748b', now, now, WORKSPACE_ID])
  return (await db.getOptional<FinancePaymentMethodEntity>('SELECT * FROM company_finance_payment_methods WHERE id = ?', [id]))!
}

export async function updateCompanyFinancePaymentMethod(
  id: string, data: Partial<CreateFinancePaymentMethodInput>
): Promise<FinancePaymentMethodEntity> {
  const db  = getPowerSyncDb()
  const now = Date.now()
  const sets: string[] = []
  const vals: unknown[] = []
  if (data.name  !== undefined) { sets.push('name = ?');  vals.push(data.name)  }
  if (data.icon  !== undefined) { sets.push('icon = ?');  vals.push(data.icon)  }
  if (data.color !== undefined) { sets.push('color = ?'); vals.push(data.color) }
  sets.push('updated_at = ?'); vals.push(now); vals.push(id)
  await db.execute(`UPDATE company_finance_payment_methods SET ${sets.join(', ')} WHERE id = ?`, vals)
  return (await db.getOptional<FinancePaymentMethodEntity>('SELECT * FROM company_finance_payment_methods WHERE id = ?', [id]))!
}

export async function deleteCompanyFinancePaymentMethod(id: string): Promise<void> {
  await getPowerSyncDb().execute('DELETE FROM company_finance_payment_methods WHERE id = ?', [id])
}

// ── Concepts ──────────────────────────────────────────────────────────────────

type ConceptRow = FinanceConcept & {
  cat_name: string; cat_icon: string; cat_color: string
  cat_is_default: number; cat_created_at: number; cat_updated_at: number
  acc_name: string; acc_icon: string; acc_color: string
  acc_is_default: number; acc_created_at: number; acc_updated_at: number
}

function hydrateConcept(r: ConceptRow): FinanceConcept {
  return {
    ...r,
    category: {
      id: r.category_id, name: r.cat_name, icon: r.cat_icon, color: r.cat_color,
      is_default: r.cat_is_default, created_at: r.cat_created_at, updated_at: r.cat_updated_at
    },
    account: {
      id: r.account_id, name: r.acc_name, icon: r.acc_icon, color: r.acc_color,
      is_default: r.acc_is_default, created_at: r.acc_created_at, updated_at: r.acc_updated_at
    }
  }
}

const CONCEPT_SELECT = `
  SELECT co.*,
         cat.name as cat_name, cat.icon as cat_icon, cat.color as cat_color,
         cat.is_default as cat_is_default, cat.created_at as cat_created_at, cat.updated_at as cat_updated_at,
         acc.name as acc_name, acc.icon as acc_icon, acc.color as acc_color,
         acc.is_default as acc_is_default, acc.created_at as acc_created_at, acc.updated_at as acc_updated_at
  FROM company_finance_concepts co
  LEFT JOIN company_finance_categories cat ON cat.id = co.category_id
  LEFT JOIN company_finance_accounts   acc ON acc.id = co.account_id
`

export async function listCompanyFinanceConcepts(opts?: { activeOnly?: boolean }): Promise<FinanceConcept[]> {
  const db = getPowerSyncDb()
  const where = opts?.activeOnly ? 'WHERE co.is_active = 1' : ''
  const rows = await db.getAll<ConceptRow>(`${CONCEPT_SELECT} ${where} ORDER BY co.name ASC`)
  return rows.map(hydrateConcept)
}

export async function getCompanyFinanceConcept(id: string): Promise<FinanceConcept | null> {
  const db = getPowerSyncDb()
  const r = await db.getOptional<ConceptRow>(`${CONCEPT_SELECT} WHERE co.id = ?`, [id])
  return r ? hydrateConcept(r) : null
}

export async function createCompanyFinanceConcept(data: CreateFinanceConceptInput): Promise<FinanceConcept> {
  const db  = getPowerSyncDb()
  const id  = randomUUID()
  const now = Date.now()
  await db.execute(`
    INSERT INTO company_finance_concepts
      (id, category_id, account_id, name, default_amount, expense_type, payment_method, recurrence, recurrence_month, tracks_multiple_entries, is_active, notes, created_at, updated_at, workspace_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
  `, [
    id, data.category_id, data.account_id, data.name,
    data.default_amount ?? 0,
    data.expense_type ?? 'fixed',
    data.payment_method ?? 'transfer',
    data.recurrence ?? 'monthly',
    data.recurrence_month ?? null,
    data.tracks_multiple_entries ?? 0,
    data.notes ?? '', now, now, WORKSPACE_ID
  ])
  return (await getCompanyFinanceConcept(id))!
}

export async function updateCompanyFinanceConcept(
  id: string, data: Partial<CreateFinanceConceptInput> & { is_active?: number }
): Promise<FinanceConcept> {
  const db  = getPowerSyncDb()
  const now = Date.now()
  const allowed = ['category_id', 'account_id', 'name', 'default_amount',
                   'expense_type', 'payment_method', 'recurrence', 'recurrence_month',
                   'tracks_multiple_entries', 'notes', 'is_active'] as const
  const sets: string[] = []
  const vals: unknown[] = []
  for (const key of allowed) {
    if (data[key] !== undefined) {
      sets.push(`${key} = ?`)
      vals.push(data[key])
    }
  }
  sets.push('updated_at = ?'); vals.push(now); vals.push(id)
  await db.execute(`UPDATE company_finance_concepts SET ${sets.join(', ')} WHERE id = ?`, vals)
  return (await getCompanyFinanceConcept(id))!
}

export async function deleteCompanyFinanceConcept(id: string): Promise<void> {
  await getPowerSyncDb().execute('DELETE FROM company_finance_concepts WHERE id = ?', [id])
}

// ── Movements ─────────────────────────────────────────────────────────────────

type MovementRow = FinanceMovement & {
  c_name: string; c_category_id: string; c_account_id: string; c_default_amount: number
  c_expense_type: string; c_payment_method: string; c_recurrence: string; c_recurrence_month: number | null
  c_tracks_multiple_entries: number
  c_is_active: number; c_notes: string; c_created_at: number; c_updated_at: number
  cat_name: string; cat_icon: string; cat_color: string
  acc_name: string; acc_icon: string; acc_color: string
  entries_count: number
}

function hydrateMovement(r: MovementRow): FinanceMovement {
  return {
    id: r.id, concept_id: r.concept_id, month: r.month, year: r.year,
    amount_estimated: r.amount_estimated, amount_actual: r.amount_actual,
    status: r.status, payment_method: r.payment_method,
    payment_date: r.payment_date, due_date: r.due_date, notes: r.notes,
    created_at: r.created_at, updated_at: r.updated_at,
    entries_count: r.entries_count,
    concept: {
      id: r.concept_id, category_id: r.c_category_id, account_id: r.c_account_id,
      name: r.c_name, default_amount: r.c_default_amount,
      expense_type: r.c_expense_type as FinanceConcept['expense_type'],
      payment_method: r.c_payment_method as FinancePaymentMethod,
      recurrence: r.c_recurrence as FinanceConcept['recurrence'],
      recurrence_month: r.c_recurrence_month,
      tracks_multiple_entries: r.c_tracks_multiple_entries,
      is_active: r.c_is_active, notes: r.c_notes,
      created_at: r.c_created_at, updated_at: r.c_updated_at,
      category: { id: r.c_category_id, name: r.cat_name, icon: r.cat_icon, color: r.cat_color, is_default: 0, created_at: 0, updated_at: 0 },
      account:  { id: r.c_account_id,  name: r.acc_name,  icon: r.acc_icon,  color: r.acc_color,  is_default: 0, created_at: 0, updated_at: 0 }
    }
  }
}

const MOVEMENT_BASE_SELECT = `
  SELECT m.*,
         c.name as c_name, c.category_id as c_category_id, c.account_id as c_account_id,
         c.default_amount as c_default_amount, c.expense_type as c_expense_type,
         c.payment_method as c_payment_method, c.recurrence as c_recurrence,
         c.recurrence_month as c_recurrence_month,
         c.tracks_multiple_entries as c_tracks_multiple_entries,
         c.is_active as c_is_active, c.notes as c_notes,
         c.created_at as c_created_at, c.updated_at as c_updated_at,
         cat.name as cat_name, cat.icon as cat_icon, cat.color as cat_color,
         acc.name as acc_name, acc.icon as acc_icon, acc.color as acc_color,
         (SELECT COUNT(*) FROM company_finance_movement_entries fme WHERE fme.movement_id = m.id) as entries_count
  FROM company_finance_movements m
  JOIN company_finance_concepts c ON c.id = m.concept_id
  LEFT JOIN company_finance_categories cat ON cat.id = c.category_id
  LEFT JOIN company_finance_accounts   acc ON acc.id = c.account_id
`

export async function listCompanyFinanceMovements(month: number, year: number): Promise<FinanceMovement[]> {
  const db = getPowerSyncDb()
  const rows = await db.getAll<MovementRow>(`
    ${MOVEMENT_BASE_SELECT}
    WHERE m.month = ? AND m.year = ?
    ORDER BY cat.name ASC, c.name ASC
  `, [month, year])
  const movements = rows.map(hydrateMovement)
  await attachPreviousMonthAmounts(db, movements, month, year)
  return movements
}

/**
 * Completa `previous_month_amount` de cada movimiento con lo realmente pagado
 * (amount_actual) por el mismo concepto en el mes calendario inmediatamente
 * anterior — solo cuando hubo un pago registrado (si no, queda en null y la
 * tabla muestra "—"). Es lo que alimenta la columna "Mes anterior" — pensada
 * para comparar de un vistazo "cuánto pagué la última vez" vs. lo de este mes.
 */
async function attachPreviousMonthAmounts(
  db: { getAll: <T>(sql: string, params?: unknown[]) => Promise<T[]> },
  movements: FinanceMovement[], month: number, year: number
): Promise<void> {
  if (!movements.length) return
  const prevDate = new Date(year, month - 2, 1)
  const rows = await db.getAll<{ concept_id: string; amount_actual: number }>(`
    SELECT concept_id, amount_actual FROM company_finance_movements
    WHERE month = ? AND year = ? AND amount_actual IS NOT NULL
  `, [prevDate.getMonth() + 1, prevDate.getFullYear()])
  const byConceptId = new Map(rows.map(r => [r.concept_id, r.amount_actual]))
  for (const m of movements) {
    m.previous_month_amount = byConceptId.get(m.concept_id) ?? null
  }
}

/**
 * Movimientos "vivos" para la vista de Próximos pagos: no pagados y con fecha de
 * vencimiento cargada, sin importar el período. Se agrupan por urgencia en el cliente
 * (computado al vuelo, igual que con los vencimientos — ver getMovementUrgency).
 */
export async function listUpcomingCompanyFinanceMovements(): Promise<FinanceMovement[]> {
  const db = getPowerSyncDb()
  const rows = await db.getAll<MovementRow>(`
    ${MOVEMENT_BASE_SELECT}
    WHERE m.status != 'paid' AND m.due_date IS NOT NULL
    ORDER BY m.due_date ASC
  `)
  return rows.map(hydrateMovement)
}

export async function getCompanyFinanceMovement(id: string): Promise<FinanceMovement | null> {
  const db = getPowerSyncDb()
  const r = await db.getOptional<MovementRow>(`${MOVEMENT_BASE_SELECT} WHERE m.id = ?`, [id])
  return r ? hydrateMovement(r) : null
}

export async function createCompanyFinanceMovement(data: CreateFinanceMovementInput): Promise<FinanceMovement> {
  const db  = getPowerSyncDb()
  const id  = randomUUID()
  const now = Date.now()
  await db.execute(`
    INSERT INTO company_finance_movements
      (id, concept_id, month, year, amount_estimated, amount_actual, status, payment_method, payment_date, due_date, notes, created_at, updated_at, workspace_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id, data.concept_id, data.month, data.year,
    data.amount_estimated ?? 0,
    data.amount_actual ?? null,
    data.status ?? 'pending',
    data.payment_method ?? 'transfer',
    data.payment_date ?? null,
    data.due_date ?? null,
    data.notes ?? '', now, now, WORKSPACE_ID
  ])
  return (await getCompanyFinanceMovement(id))!
}

export async function updateCompanyFinanceMovement(
  id: string, data: Partial<CreateFinanceMovementInput>
): Promise<FinanceMovement> {
  const db  = getPowerSyncDb()
  const now = Date.now()
  const allowed = ['concept_id', 'month', 'year', 'amount_estimated', 'amount_actual',
                   'status', 'payment_method', 'payment_date', 'due_date', 'notes'] as const
  const sets: string[] = []
  const vals: unknown[] = []
  for (const key of allowed) {
    if (data[key] !== undefined) {
      sets.push(`${key} = ?`)
      vals.push(data[key] ?? null)
    }
  }
  sets.push('updated_at = ?'); vals.push(now); vals.push(id)
  await db.execute(`UPDATE company_finance_movements SET ${sets.join(', ')} WHERE id = ?`, vals)
  return (await getCompanyFinanceMovement(id))!
}

/** Edición rápida desde la tabla principal: monto real, estado, fechas y notas. */
export async function quickUpdateCompanyFinanceMovement(id: string, data: {
  amount_actual?: number | null
  status?:        FinanceMovementStatus
  payment_date?:  number | null
  due_date?:      number | null
  notes?:         string
}): Promise<FinanceMovement> {
  return updateCompanyFinanceMovement(id, data)
}

export async function deleteCompanyFinanceMovement(id: string): Promise<void> {
  await getPowerSyncDb().execute('DELETE FROM company_finance_movements WHERE id = ?', [id])
}

// ── Registro de cargas — conceptos multi-carga (Opción C) ────────────────────
//
// Para conceptos con tracks_multiple_entries=1 (ej. "Nafta", "Supermercado":
// gastos variables que ocurren más de una vez al mes), el movimiento mensual
// no tiene "un monto" sino una sub-lista de "cargas" — cada una con su fecha,
// monto y nota — y `amount_actual` se recalcula automáticamente como la suma.
// Como son gastos que se pagan al momento (efectivo/débito/crédito, sin
// vencimiento), apenas hay al menos una carga el movimiento pasa a "Pagado"
// solo; si se borran todas, vuelve a "Pendiente" con monto vacío.

export async function listMovementEntries(movementId: string): Promise<FinanceMovementEntry[]> {
  return getPowerSyncDb().getAll<FinanceMovementEntry>(`
    SELECT * FROM company_finance_movement_entries
    WHERE movement_id = ?
    ORDER BY COALESCE(entry_date, created_at) ASC, created_at ASC
  `, [movementId])
}

/** Recalcula amount_actual / status / payment_date del movimiento padre a partir de la suma de sus cargas. */
async function recalcMovementFromEntries(db: SqlCtx, movementId: string): Promise<void> {
  const now = Date.now()
  const agg = await db.get<{ total: number; n: number; lastDate: number | null }>(`
    SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS n,
           MAX(COALESCE(entry_date, created_at)) AS lastDate
    FROM company_finance_movement_entries
    WHERE movement_id = ?
  `, [movementId])

  if (agg.n > 0) {
    await db.execute(`
      UPDATE company_finance_movements
      SET amount_actual = ?, status = 'paid', payment_date = ?, updated_at = ?
      WHERE id = ?
    `, [agg.total, agg.lastDate, now, movementId])
  } else {
    await db.execute(`
      UPDATE company_finance_movements
      SET amount_actual = NULL, status = 'pending', payment_date = NULL, updated_at = ?
      WHERE id = ?
    `, [now, movementId])
  }
}

export async function addMovementEntry(data: CreateFinanceMovementEntryInput): Promise<FinanceMovementEntry> {
  const db  = getPowerSyncDb()
  const id  = randomUUID()
  const now = Date.now()
  await db.writeTransaction(async (tx) => {
    await tx.execute(`
      INSERT INTO company_finance_movement_entries (id, movement_id, amount, entry_date, note, created_at, updated_at, workspace_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, data.movement_id, data.amount, data.entry_date ?? now, data.note ?? '', now, now, WORKSPACE_ID])
    await recalcMovementFromEntries(tx, data.movement_id)
  })
  return (await db.getOptional<FinanceMovementEntry>('SELECT * FROM company_finance_movement_entries WHERE id = ?', [id]))!
}

export async function updateMovementEntry(id: string, data: UpdateFinanceMovementEntryInput): Promise<FinanceMovementEntry> {
  const db  = getPowerSyncDb()
  const now = Date.now()
  const existing = await db.getOptional<FinanceMovementEntry>('SELECT * FROM company_finance_movement_entries WHERE id = ?', [id])
  if (!existing) throw new Error('La carga que intentás editar ya no existe.')

  await db.writeTransaction(async (tx) => {
    const sets: string[] = []
    const vals: unknown[] = []
    if (data.amount !== undefined)     { sets.push('amount = ?');     vals.push(data.amount) }
    if (data.entry_date !== undefined) { sets.push('entry_date = ?'); vals.push(data.entry_date) }
    if (data.note !== undefined)       { sets.push('note = ?');       vals.push(data.note) }
    sets.push('updated_at = ?'); vals.push(now); vals.push(id)
    await tx.execute(`UPDATE company_finance_movement_entries SET ${sets.join(', ')} WHERE id = ?`, vals)
    await recalcMovementFromEntries(tx, existing.movement_id)
  })
  return (await db.getOptional<FinanceMovementEntry>('SELECT * FROM company_finance_movement_entries WHERE id = ?', [id]))!
}

export async function removeMovementEntry(id: string): Promise<void> {
  const db = getPowerSyncDb()
  const existing = await db.getOptional<{ movement_id: string }>('SELECT movement_id FROM company_finance_movement_entries WHERE id = ?', [id])
  if (!existing) return
  await db.writeTransaction(async (tx) => {
    await tx.execute('DELETE FROM company_finance_movement_entries WHERE id = ?', [id])
    await recalcMovementFromEntries(tx, existing.movement_id)
  })
}

// ── Generación de movimientos / "crear nuevo mes" (Fase 4) ───────────────────
//
// Decide si corresponde generar un movimiento para `concept` en el período
// (month, year) dado, según su recurrencia:
//  - mensual / quincenal: siempre — se trackean como una entrada agregada por
//    mes (el sistema está organizado en períodos mensuales; lo quincenal queda
//    representado por el monto total del mes, igual que hoy se hace con todo
//    lo demás — la recurrencia sirve también como filtro/etiqueta informativa)
//  - anual: solo en su mes correspondiente (recurrence_month si se configuró,
//    o el mes de alta del concepto como fallback razonable)
//  - puntual: solo una vez en toda la vida del concepto — se omite si ya existe
//    CUALQUIER movimiento suyo, sin importar el período (antes este chequeo
//    miraba únicamente el período pedido y por eso conceptos "puntuales" como
//    "Uniformes" o "Pintura" se regeneraban mes a mes)
async function shouldGenerateMovement(db: SqlCtx, concept: FinanceConcept, month: number): Promise<boolean> {
  switch (concept.recurrence) {
    case 'annual': {
      const targetMonth = concept.recurrence_month ?? (new Date(concept.created_at).getMonth() + 1)
      return month === targetMonth
    }
    case 'one_time': {
      const already = await db.get<{ found: number } | null>(
        "SELECT 1 as found FROM company_finance_movements WHERE concept_id = ? LIMIT 1", [concept.id]
      ).catch(() => null)
      return !already
    }
    case 'monthly':
    case 'biweekly':
    default:
      return true
  }
}

/**
 * Motor común de generación de movimientos para un período, a partir de los
 * conceptos activos que correspondan según su recurrencia (ver `shouldGenerateMovement`).
 * Omite los que ya tengan un movimiento cargado para ese período.
 *
 * `estimateSource` controla de dónde sale el `amount_estimated` inicial:
 *  - 'default'  → el monto habitual configurado en el concepto (`default_amount`)
 *  - 'previous' → el monto real (o estimado si no se cargó aún) del mismo
 *                 concepto en el mes inmediatamente anterior — proyecta gastos
 *                 variables (servicios, tarjetas) con cifras más realistas que
 *                 la fija del concepto
 */
async function generateMovements(month: number, year: number, estimateSource: 'default' | 'previous'): Promise<FinanceMovement[]> {
  const db  = getPowerSyncDb()
  const now = Date.now()
  const concepts = await listCompanyFinanceConcepts({ activeOnly: true })
  const existingRows = await db.getAll<{ concept_id: string }>(
    'SELECT concept_id FROM company_finance_movements WHERE month = ? AND year = ?', [month, year]
  )
  const existing = new Set(existingRows.map(r => r.concept_id))

  let prevByConceptId: Map<string, FinanceMovement> | null = null
  if (estimateSource === 'previous') {
    const prevDate = new Date(year, month - 2, 1)
    const prevMovements = await listCompanyFinanceMovements(prevDate.getMonth() + 1, prevDate.getFullYear())
    prevByConceptId = new Map(prevMovements.map(m => [m.concept_id, m]))
  }

  for (const concept of concepts) {
    if (existing.has(concept.id)) continue
    if (!(await shouldGenerateMovement(db, concept, month))) continue

    let amountEstimated = concept.default_amount
    if (prevByConceptId) {
      const prev = prevByConceptId.get(concept.id)
      if (prev) amountEstimated = prev.amount_actual ?? prev.amount_estimated
    }

    // Estado inicial según si el concepto es recurrente o no:
    //  - recurrente (mensual/quincenal/anual) → "pendiente": sabemos que va a pasar
    //  - puntual / variable sin patrón fijo   → "sin estado": puede no llegar a ocurrir
    // La fecha de vencimiento arranca vacía siempre — se carga manualmente si aplica
    // (ver request: "por default, un movimiento nuevo no debe tener vencimiento").
    const initialStatus = initialStatusForConcept(concept)

    await db.execute(`
      INSERT INTO company_finance_movements
        (id, concept_id, month, year, amount_estimated, amount_actual, status, payment_method, payment_date, due_date, notes, created_at, updated_at, workspace_id)
      VALUES (?, ?, ?, ?, ?, NULL, ?, ?, NULL, NULL, '', ?, ?, ?)
    `, [randomUUID(), concept.id, month, year, amountEstimated, initialStatus, concept.payment_method, now, now, WORKSPACE_ID])
  }
  return listCompanyFinanceMovements(month, year)
}

/**
 * Estado inicial de un movimiento recién generado, según la recurrencia de su
 * concepto. Los recurrentes (se sabe que van a pasar) arrancan en "pending";
 * los puntuales/variables (pueden no llegar a ocurrir) arrancan en "no_status"
 * para no acumular pendientes que en realidad son "todavía no sabemos".
 */
function initialStatusForConcept(concept: FinanceConcept): FinanceMovementStatus {
  switch (concept.recurrence) {
    case 'monthly':
    case 'biweekly':
    case 'annual':
      return 'pending'
    case 'one_time':
    default:
      return 'no_status'
  }
}

/**
 * Genera los movimientos del mes a partir del monto habitual de cada concepto
 * activo (omite los que ya existan, y respeta la recurrencia de cada uno).
 * Es la opción "desde cero" de crear un nuevo mes.
 */
export async function generateMovementsForMonth(month: number, year: number): Promise<FinanceMovement[]> {
  return generateMovements(month, year, 'default')
}

/**
 * Genera los movimientos del mes igual que `generateMovementsForMonth`, pero
 * usa como estimación inicial el monto real del mes anterior (o su estimado si
 * todavía no se cargó un real) en lugar del monto fijo del concepto. Es la
 * opción "Crear nuevo mes desde mes anterior": sirve para arrancar el mes con
 * proyecciones más ajustadas a la realidad reciente en gastos variables.
 */
export async function generateMovementsFromPreviousMonth(month: number, year: number): Promise<FinanceMovement[]> {
  return generateMovements(month, year, 'previous')
}

// ── Resumen del mes (dashboard) ───────────────────────────────────────────────

function sumActual(movements: FinanceMovement[]): number {
  return movements.reduce((acc, m) => acc + (m.amount_actual ?? m.amount_estimated), 0)
}

export async function getCompanyFinanceMonthSummary(month: number, year: number): Promise<FinanceMonthSummary> {
  const movements = await listCompanyFinanceMovements(month, year)

  const totalEstimated = movements.reduce((acc, m) => acc + m.amount_estimated, 0)
  const totalActual    = sumActual(movements)
  const totalPaid      = movements.filter(m => m.status === 'paid').reduce((acc, m) => acc + (m.amount_actual ?? m.amount_estimated), 0)
  const totalPending   = movements.filter(m => m.status === 'pending').reduce((acc, m) => acc + (m.amount_actual ?? m.amount_estimated), 0)
  const totalOverdue   = movements.filter(m => m.status === 'overdue').reduce((acc, m) => acc + (m.amount_actual ?? m.amount_estimated), 0)

  // Mes anterior (para comparación)
  const prevDate  = new Date(year, month - 2, 1)
  const prevMonth = prevDate.getMonth() + 1
  const prevYear  = prevDate.getFullYear()
  const prevMovements = await listCompanyFinanceMovements(prevMonth, prevYear)
  const prevMonthTotalActual = prevMovements.length ? sumActual(prevMovements) : null

  const diffAmount  = prevMonthTotalActual !== null ? totalActual - prevMonthTotalActual : null
  const diffPercent = (diffAmount !== null && prevMonthTotalActual) ? (diffAmount / prevMonthTotalActual) * 100 : null

  // Próximos vencimientos: pendientes con due_date dentro de los próx. 7 días
  const now      = Date.now()
  const weekLater = now + 7 * 24 * 60 * 60 * 1000
  const upcomingDueCount = movements.filter(m =>
    m.status !== 'paid' && m.due_date !== null && m.due_date >= now && m.due_date <= weekLater
  ).length

  // Mayor aumento respecto al mes anterior (por concepto)
  let biggestIncrease: FinanceMonthSummary['biggestIncrease'] = null
  if (prevMovements.length) {
    const prevByConceptId = new Map(prevMovements.map(m => [m.concept_id, m.amount_actual ?? m.amount_estimated]))
    for (const m of movements) {
      const prevAmount = prevByConceptId.get(m.concept_id)
      if (prevAmount === undefined || prevAmount <= 0) continue
      const currentAmount = m.amount_actual ?? m.amount_estimated
      const diff    = currentAmount - prevAmount
      const percent = (diff / prevAmount) * 100
      if (!biggestIncrease || diff > biggestIncrease.diffAmount) {
        biggestIncrease = { conceptName: m.concept?.name ?? '', diffAmount: diff, diffPercent: percent }
      }
    }
  }

  // Categoría con mayor gasto del mes
  let topCategory: FinanceMonthSummary['topCategory'] = null
  const totalsByCategory = new Map<string, number>()
  for (const m of movements) {
    const name = m.concept?.category?.name ?? 'Sin categoría'
    const amount = m.amount_actual ?? m.amount_estimated
    totalsByCategory.set(name, (totalsByCategory.get(name) ?? 0) + amount)
  }
  for (const [categoryName, total] of totalsByCategory) {
    if (!topCategory || total > topCategory.total) topCategory = { categoryName, total }
  }

  return {
    month, year,
    totalEstimated, totalActual, totalPaid, totalPending, totalOverdue,
    prevMonthTotalActual, diffAmount, diffPercent,
    upcomingDueCount, biggestIncrease, topCategory
  }
}

// ── Notas y análisis IA del mes (Dashboard) ───────────────────────────────────
//
// Único rincón de "summary/analytics" que SÍ persiste — es contenido del
// usuario (notas explicando variaciones) y un resultado guardado a pedido
// (análisis comparativo de IA), no algo derivable de los movimientos. Una fila
// por (month, year): el UNIQUE de la tabla permite upsert limpio vía
// ON CONFLICT, sin necesidad de un SELECT previo para decidir INSERT vs UPDATE.

/** Devuelve las notas/análisis guardados para el mes, o null si todavía no se guardó nada. */
export async function getCompanyFinanceMonthInsight(month: number, year: number): Promise<FinanceMonthInsight | null> {
  return getPowerSyncDb().getOptional<FinanceMonthInsight>(
    'SELECT * FROM company_finance_month_insights WHERE month = ? AND year = ?', [month, year]
  )
}

/** Guarda (crea o actualiza) las notas del usuario para el mes — no toca el análisis de IA si ya existe uno. */
export async function saveCompanyFinanceMonthNotes(month: number, year: number, notes: string): Promise<FinanceMonthInsight> {
  const db  = getPowerSyncDb()
  const now = Date.now()
  await db.execute(`
    INSERT INTO company_finance_month_insights (id, month, year, notes, ai_analysis, ai_generated_at, created_at, updated_at, workspace_id)
    VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?)
    ON CONFLICT(month, year) DO UPDATE SET notes = excluded.notes, updated_at = excluded.updated_at
  `, [randomUUID(), month, year, notes, now, now, WORKSPACE_ID])
  return (await getCompanyFinanceMonthInsight(month, year))!
}

/**
 * Persiste el análisis comparativo de IA — se llama recién cuando el usuario
 * hace click en "Guardar" sobre el análisis recién generado (ver
 * `compareCompanyFinanceMonths` en ai.service): la generación en sí NO guarda nada,
 * así el usuario puede revisar la conclusión antes de decidir conservarla.
 * No toca `notes` si ya existe una fila para el mes.
 */
export async function saveCompanyFinanceMonthAIAnalysis(month: number, year: number, analysis: string): Promise<FinanceMonthInsight> {
  const db  = getPowerSyncDb()
  const now = Date.now()
  await db.execute(`
    INSERT INTO company_finance_month_insights (id, month, year, notes, ai_analysis, ai_generated_at, created_at, updated_at, workspace_id)
    VALUES (?, ?, ?, '', ?, ?, ?, ?, ?)
    ON CONFLICT(month, year) DO UPDATE SET ai_analysis = excluded.ai_analysis, ai_generated_at = excluded.ai_generated_at, updated_at = excluded.updated_at
  `, [randomUUID(), month, year, analysis, now, now, now, WORKSPACE_ID])
  return (await getCompanyFinanceMonthInsight(month, year))!
}

// ── Visualización / análisis (Fase 3) ─────────────────────────────────────────
//
// Mismo criterio que getCompanyFinanceMonthSummary: todo se agrega al vuelo a partir de
// listCompanyFinanceMovements, sin guardar nada derivado — así nunca queda desactualizado.

/** Desglose del gasto del mes por categoría: totales, % del total y top 5 conceptos de cada una. */
export async function getCompanyFinanceCategoryBreakdown(month: number, year: number): Promise<FinanceCategoryBreakdownItem[]> {
  const movements   = await listCompanyFinanceMovements(month, year)
  const totalActual = sumActual(movements)

  type Bucket = {
    categoryId: string | null; name: string; icon: string; color: string
    totalEstimated: number; totalActual: number; count: number
    concepts: Map<string, { name: string; amount: number }>
  }
  const buckets = new Map<string, Bucket>()

  for (const m of movements) {
    const cat = m.concept?.category
    const key = cat?.id ?? '__none__'
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = {
        categoryId: cat?.id ?? null, name: cat?.name ?? 'Sin categoría',
        icon: cat?.icon ?? '📁', color: cat?.color ?? '#64748b',
        totalEstimated: 0, totalActual: 0, count: 0, concepts: new Map()
      }
      buckets.set(key, bucket)
    }
    const amount = m.amount_actual ?? m.amount_estimated
    bucket.totalEstimated += m.amount_estimated
    bucket.totalActual    += amount
    bucket.count          += 1
    const prev = bucket.concepts.get(m.concept_id)
    bucket.concepts.set(m.concept_id, { name: m.concept?.name ?? '', amount: (prev?.amount ?? 0) + amount })
  }

  const result: FinanceCategoryBreakdownItem[] = []
  for (const bucket of buckets.values()) {
    const topConcepts = [...bucket.concepts.entries()]
      .map(([conceptId, c]) => ({ conceptId, conceptName: c.name, amount: c.amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
    result.push({
      categoryId: bucket.categoryId, categoryName: bucket.name,
      categoryIcon: bucket.icon, categoryColor: bucket.color,
      totalEstimated: bucket.totalEstimated, totalActual: bucket.totalActual, count: bucket.count,
      percent: totalActual > 0 ? (bucket.totalActual / totalActual) * 100 : 0,
      topConcepts
    })
  }
  return result.sort((a, b) => b.totalActual - a.totalActual)
}

/**
 * Serie histórica de los últimos `monthsBack` meses, terminando en (month, year) inclusive,
 * en orden cronológico ascendente. `diffPercent` compara cada mes contra el calendario
 * inmediatamente anterior (igual criterio que prevMonthTotalActual en el resumen mensual).
 */
export async function getCompanyFinanceHistory(month: number, year: number, monthsBack: number): Promise<FinanceHistoryEntry[]> {
  const entries: FinanceHistoryEntry[] = []
  let prevMovements: FinanceMovement[] | null = null

  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1)
    const m = d.getMonth() + 1
    const y = d.getFullYear()
    const movements = await listCompanyFinanceMovements(m, y)

    const totalEstimated = movements.reduce((acc, mv) => acc + mv.amount_estimated, 0)
    const totalActual    = sumActual(movements)
    const totalPaid      = movements.filter(mv => mv.status === 'paid').reduce((acc, mv) => acc + (mv.amount_actual ?? mv.amount_estimated), 0)
    const totalPending   = movements.filter(mv => mv.status === 'pending').reduce((acc, mv) => acc + (mv.amount_actual ?? mv.amount_estimated), 0)
    const totalOverdue   = movements.filter(mv => mv.status === 'overdue').reduce((acc, mv) => acc + (mv.amount_actual ?? mv.amount_estimated), 0)

    const prevTotalActual = prevMovements && prevMovements.length ? sumActual(prevMovements) : null
    const diffPercent = (prevTotalActual !== null && prevTotalActual > 0)
      ? ((totalActual - prevTotalActual) / prevTotalActual) * 100
      : null

    entries.push({
      month: m, year: y, totalEstimated, totalActual, totalPaid, totalPending, totalOverdue, diffPercent,
      movementsCount: movements.length
    })
    prevMovements = movements
  }
  return entries
}

/** Ranking "Top conceptos": los gastos individuales más altos del mes (por defecto, los 8 primeros). */
export async function getCompanyFinanceTopConcepts(month: number, year: number, limit = 8): Promise<FinanceRankingConcept[]> {
  const movements   = await listCompanyFinanceMovements(month, year)
  const totalActual = sumActual(movements)

  return movements
    .map(m => {
      const amount = m.amount_actual ?? m.amount_estimated
      return {
        conceptId:     m.concept_id,
        conceptName:   m.concept?.name ?? '',
        categoryName:  m.concept?.category?.name ?? 'Sin categoría',
        categoryIcon:  m.concept?.category?.icon ?? '📁',
        categoryColor: m.concept?.category?.color ?? '#64748b',
        amount,
        percent: totalActual > 0 ? (amount / totalActual) * 100 : 0
      }
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
}

/**
 * Ranking "Mayores aumentos": conceptos cuyo monto subió más (en valor absoluto) respecto
 * al mes calendario anterior. Solo incluye conceptos presentes en ambos períodos.
 */
export async function getCompanyFinanceTopIncreases(month: number, year: number, limit = 8): Promise<FinanceRankingIncrease[]> {
  const movements = await listCompanyFinanceMovements(month, year)

  const prevDate = new Date(year, month - 2, 1)
  const prevMovements = await listCompanyFinanceMovements(prevDate.getMonth() + 1, prevDate.getFullYear())
  if (!prevMovements.length) return []

  const prevByConceptId = new Map(prevMovements.map(m => [m.concept_id, m.amount_actual ?? m.amount_estimated]))
  const result: FinanceRankingIncrease[] = []
  for (const m of movements) {
    const prevAmount = prevByConceptId.get(m.concept_id)
    if (prevAmount === undefined || prevAmount <= 0) continue
    const currentAmount = m.amount_actual ?? m.amount_estimated
    const diffAmount = currentAmount - prevAmount
    if (diffAmount <= 0) continue
    result.push({
      conceptId: m.concept_id, conceptName: m.concept?.name ?? '',
      categoryName: m.concept?.category?.name ?? 'Sin categoría',
      previousAmount: prevAmount, currentAmount, diffAmount,
      diffPercent: (diffAmount / prevAmount) * 100
    })
  }
  return result.sort((a, b) => b.diffAmount - a.diffAmount).slice(0, limit)
}

// ── Importación con preview y detección de duplicados (Fase 5) ───────────────
//
// El parseo "crudo" del archivo (xlsx/csv → filas normalizadas) vive en
// finance-io.service (no toca la DB). Acá se hace el trabajo que sí necesita
// la base: matchear cada fila contra un concepto existente por nombre y
// detectar si ya existe un movimiento de ese concepto en el período destino
// (para no duplicar al re-importar el mismo archivo, o uno parecido).

function normalizeConceptName(s: string): string {
  return s.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Arma la previsualización: para cada fila intenta encontrar el concepto por
 * nombre (match exacto normalizado primero, luego por inclusión parcial como
 * fallback para variantes como "Netflix" vs "Netflix (suscripción)"), y marca
 * como duplicado cualquier fila cuyo concepto ya tenga un movimiento cargado
 * en (month, year) — el usuario decide en la UI si sobreescribirlo o saltarlo.
 */
export async function buildCompanyFinanceImportPreview(
  rows: ParsedImportRow[], month: number, year: number, fileName: string
): Promise<FinanceImportPreviewResult> {
  const db = getPowerSyncDb()
  const concepts = await listCompanyFinanceConcepts({ activeOnly: true })
  const byExactName = new Map(concepts.map(c => [normalizeConceptName(c.name), c]))

  const existingRows = await db.getAll<{ id: string; concept_id: string }>(
    'SELECT id, concept_id FROM company_finance_movements WHERE month = ? AND year = ?', [month, year]
  )
  const existingByConceptId = new Map(existingRows.map(r => [r.concept_id, r.id]))

  const items: FinanceImportPreviewItem[] = rows.map((row, idx) => {
    const norm = normalizeConceptName(row.rawConceptName)
    let matched = byExactName.get(norm) ?? null
    if (!matched) {
      matched = concepts.find(c => {
        const cn = normalizeConceptName(c.name)
        return cn.includes(norm) || norm.includes(cn)
      }) ?? null
    }

    const existingMovementId = matched ? (existingByConceptId.get(matched.id) ?? null) : null

    let issue: FinanceImportIssue = 'ok'
    if (!matched)                    issue = 'concept_not_found'
    else if (row.amount === null)    issue = 'invalid_amount'
    else if (existingMovementId)     issue = 'duplicate'

    return {
      rowIndex: idx,
      rawConceptName: row.rawConceptName,
      matchedConceptId: matched?.id ?? null,
      matchedConceptName: matched?.name ?? null,
      categoryName: matched?.category?.name ?? null,
      amount: row.amount,
      status: row.status,
      paymentDate: row.paymentDate,
      notes: row.notes,
      issue,
      existingMovementId
    }
  })

  return { fileName, month, year, items }
}

/**
 * Inserta (o actualiza, si el usuario eligió sobreescribir un duplicado) los
 * movimientos confirmados desde la previsualización. Filas cuyo concepto ya
 * no exista (caso borde: se borró entre el preview y la confirmación) se
 * cuentan como salteadas en vez de romper la importación completa.
 */
export async function confirmCompanyFinanceImport(
  items: FinanceImportConfirmItem[], month: number, year: number
): Promise<FinanceImportResult> {
  const db  = getPowerSyncDb()
  const now = Date.now()
  const conceptsById = new Map((await listCompanyFinanceConcepts()).map(c => [c.id, c]))

  let imported = 0, updated = 0, skipped = 0

  // Conceptos "de varias cargas" (tracks_multiple_entries) tienen UN solo
  // movimiento por (concepto, período) que acumula una sub-lista de entradas
  // — pero el archivo/texto importado puede traer VARIAS filas para el mismo
  // concepto (ej. dos compras de supermercado distintas en el mismo mes). Sin
  // este mapeo, la salvaguarda de abajo detectaba el movimiento recién
  // insertado por la primera fila y descartaba todas las siguientes como "ya
  // existe" — el bug reportado: "toma una sola carga". Acá, en cambio, cada
  // fila adicional para el mismo concepto se agrega como una entrada más al
  // MISMO movimiento, y `recalcMovementFromEntries` se encarga de recalcular
  // `amount_actual`/`status`/`payment_date` como la suma — el mismo
  // mecanismo que usa el registro manual de cargas.
  const movementIdByConceptId = new Map<string, string>()

  await db.writeTransaction(async (tx) => {
    for (const item of items) {
      const concept = conceptsById.get(item.conceptId)
      if (!concept) { skipped++; continue }

      if (concept.tracks_multiple_entries) {
        // Reusar, en este orden: (a) el movimiento que el usuario eligió
        // sobreescribir desde el preview, (b) el que ya creamos/reutilizamos
        // para este concepto en esta misma corrida, o (c) el que ya existía
        // en la DB para este período. Si no hay ninguno, se crea uno nuevo
        // "vacío" (sin monto real todavía — lo define la suma de cargas).
        let movementId = item.overwriteMovementId ?? movementIdByConceptId.get(item.conceptId) ?? null
        if (!movementId) {
          const existingForPeriod = await tx.getOptional<{ id: string }>(
            'SELECT id FROM company_finance_movements WHERE concept_id = ? AND month = ? AND year = ?',
            [item.conceptId, month, year]
          )
          movementId = existingForPeriod?.id ?? null
        }

        if (!movementId) {
          movementId = randomUUID()
          await tx.execute(`
            INSERT INTO company_finance_movements
              (id, concept_id, month, year, amount_estimated, amount_actual, status, payment_method, payment_date, due_date, notes, created_at, updated_at, workspace_id)
            VALUES (?, ?, ?, ?, ?, NULL, ?, ?, NULL, NULL, '', ?, ?, ?)
          `, [movementId, item.conceptId, month, year, concept.default_amount, initialStatusForConcept(concept), concept.payment_method, now, now, WORKSPACE_ID])
        }
        movementIdByConceptId.set(item.conceptId, movementId)

        await tx.execute(`
          INSERT INTO company_finance_movement_entries (id, movement_id, amount, entry_date, note, created_at, updated_at, workspace_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [randomUUID(), movementId, item.amount, item.paymentDate, item.notes, now, now, WORKSPACE_ID])
        await recalcMovementFromEntries(tx, movementId)
        imported++
        continue
      }

      if (item.overwriteMovementId) {
        await tx.execute(`
          UPDATE company_finance_movements
          SET amount_actual = ?, status = ?, payment_date = ?, notes = ?, updated_at = ?
          WHERE id = ?
        `, [item.amount, item.status, item.paymentDate, item.notes, now, item.overwriteMovementId])
        updated++
        continue
      }

      // Salvaguarda: aunque la fila no haya llegado marcada como duplicado
      // (p.ej. el usuario reasignó manualmente el concepto en el preview a uno
      // que sí ya tiene movimiento este período), nunca insertar — chocaría con
      // el UNIQUE(concept_id, month, year) y abortaría toda la transacción.
      const already = await tx.getOptional<{ id: string }>(
        'SELECT id FROM company_finance_movements WHERE concept_id = ? AND month = ? AND year = ?',
        [item.conceptId, month, year]
      )
      if (already) { skipped++; continue }

      await tx.execute(`
        INSERT INTO company_finance_movements
          (id, concept_id, month, year, amount_estimated, amount_actual, status, payment_method, payment_date, due_date, notes, created_at, updated_at, workspace_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)
      `, [randomUUID(), item.conceptId, month, year, item.amount, item.amount, item.status, concept.payment_method, item.paymentDate, item.notes, now, now, WORKSPACE_ID])
      imported++
    }
  })

  return { imported, updated, skipped }
}
