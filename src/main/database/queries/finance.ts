import { randomUUID } from 'crypto'
import { getDb } from '../db'
import type {
  FinanceAccount, FinanceCategory, FinanceConcept, FinanceMovement,
  FinanceMovementEntry, CreateFinanceMovementEntryInput, UpdateFinanceMovementEntryInput,
  CreateFinanceAccountInput, CreateFinanceCategoryInput,
  CreateFinanceConceptInput, CreateFinanceMovementInput,
  FinanceMonthSummary, FinanceMovementStatus, FinancePaymentMethod,
  FinanceCategoryBreakdownItem, FinanceHistoryEntry, FinanceRankingConcept, FinanceRankingIncrease,
  FinanceImportIssue, FinanceImportPreviewItem, FinanceImportPreviewResult,
  FinanceImportConfirmItem, FinanceImportResult
} from '@shared/types'
import type { ParsedImportRow } from '../../services/finance-io.service'

// ── Accounts ──────────────────────────────────────────────────────────────────

export function listFinanceAccounts(): FinanceAccount[] {
  return getDb().prepare(`
    SELECT * FROM finance_accounts ORDER BY is_default DESC, name ASC
  `).all() as FinanceAccount[]
}

export function createFinanceAccount(data: CreateFinanceAccountInput): FinanceAccount {
  const db  = getDb()
  const id  = randomUUID()
  const now = Date.now()
  db.prepare(`
    INSERT INTO finance_accounts (id, name, icon, color, is_default, created_at, updated_at)
    VALUES (?, ?, ?, ?, 0, ?, ?)
  `).run(id, data.name, data.icon ?? '💰', data.color ?? '#10b981', now, now)
  return db.prepare('SELECT * FROM finance_accounts WHERE id = ?').get(id) as FinanceAccount
}

export function updateFinanceAccount(
  id: string, data: Partial<CreateFinanceAccountInput>
): FinanceAccount {
  const db  = getDb()
  const now = Date.now()
  const sets: string[] = []
  const vals: unknown[] = []
  if (data.name  !== undefined) { sets.push('name = ?');  vals.push(data.name)  }
  if (data.icon  !== undefined) { sets.push('icon = ?');  vals.push(data.icon)  }
  if (data.color !== undefined) { sets.push('color = ?'); vals.push(data.color) }
  sets.push('updated_at = ?'); vals.push(now); vals.push(id)
  db.prepare(`UPDATE finance_accounts SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
  return db.prepare('SELECT * FROM finance_accounts WHERE id = ?').get(id) as FinanceAccount
}

export function deleteFinanceAccount(id: string): void {
  getDb().prepare('DELETE FROM finance_accounts WHERE id = ?').run(id)
}

// ── Categories ────────────────────────────────────────────────────────────────

export function listFinanceCategories(): FinanceCategory[] {
  return getDb().prepare(`
    SELECT * FROM finance_categories ORDER BY is_default DESC, name ASC
  `).all() as FinanceCategory[]
}

export function createFinanceCategory(data: CreateFinanceCategoryInput): FinanceCategory {
  const db  = getDb()
  const id  = randomUUID()
  const now = Date.now()
  db.prepare(`
    INSERT INTO finance_categories (id, name, icon, color, is_default, created_at, updated_at)
    VALUES (?, ?, ?, ?, 0, ?, ?)
  `).run(id, data.name, data.icon ?? '📁', data.color ?? '#6366f1', now, now)
  return db.prepare('SELECT * FROM finance_categories WHERE id = ?').get(id) as FinanceCategory
}

export function updateFinanceCategory(
  id: string, data: Partial<CreateFinanceCategoryInput>
): FinanceCategory {
  const db  = getDb()
  const now = Date.now()
  const sets: string[] = []
  const vals: unknown[] = []
  if (data.name  !== undefined) { sets.push('name = ?');  vals.push(data.name)  }
  if (data.icon  !== undefined) { sets.push('icon = ?');  vals.push(data.icon)  }
  if (data.color !== undefined) { sets.push('color = ?'); vals.push(data.color) }
  sets.push('updated_at = ?'); vals.push(now); vals.push(id)
  db.prepare(`UPDATE finance_categories SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
  return db.prepare('SELECT * FROM finance_categories WHERE id = ?').get(id) as FinanceCategory
}

export function deleteFinanceCategory(id: string): void {
  getDb().prepare('DELETE FROM finance_categories WHERE id = ?').run(id)
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
  FROM finance_concepts co
  LEFT JOIN finance_categories cat ON cat.id = co.category_id
  LEFT JOIN finance_accounts   acc ON acc.id = co.account_id
`

export function listFinanceConcepts(opts?: { activeOnly?: boolean }): FinanceConcept[] {
  const db = getDb()
  const where = opts?.activeOnly ? 'WHERE co.is_active = 1' : ''
  const rows = db.prepare(`${CONCEPT_SELECT} ${where} ORDER BY co.name ASC`).all() as ConceptRow[]
  return rows.map(hydrateConcept)
}

export function getFinanceConcept(id: string): FinanceConcept | null {
  const db = getDb()
  const r = db.prepare(`${CONCEPT_SELECT} WHERE co.id = ?`).get(id) as ConceptRow | undefined
  return r ? hydrateConcept(r) : null
}

export function createFinanceConcept(data: CreateFinanceConceptInput): FinanceConcept {
  const db  = getDb()
  const id  = randomUUID()
  const now = Date.now()
  db.prepare(`
    INSERT INTO finance_concepts
      (id, category_id, account_id, name, default_amount, expense_type, payment_method, recurrence, recurrence_month, tracks_multiple_entries, is_active, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
  `).run(
    id, data.category_id, data.account_id, data.name,
    data.default_amount ?? 0,
    data.expense_type ?? 'fixed',
    data.payment_method ?? 'transfer',
    data.recurrence ?? 'monthly',
    data.recurrence_month ?? null,
    data.tracks_multiple_entries ?? 0,
    data.notes ?? '', now, now
  )
  return getFinanceConcept(id)!
}

export function updateFinanceConcept(
  id: string, data: Partial<CreateFinanceConceptInput> & { is_active?: number }
): FinanceConcept {
  const db  = getDb()
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
  db.prepare(`UPDATE finance_concepts SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
  return getFinanceConcept(id)!
}

export function deleteFinanceConcept(id: string): void {
  getDb().prepare('DELETE FROM finance_concepts WHERE id = ?').run(id)
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
         (SELECT COUNT(*) FROM finance_movement_entries fme WHERE fme.movement_id = m.id) as entries_count
  FROM finance_movements m
  JOIN finance_concepts c ON c.id = m.concept_id
  LEFT JOIN finance_categories cat ON cat.id = c.category_id
  LEFT JOIN finance_accounts   acc ON acc.id = c.account_id
`

export function listFinanceMovements(month: number, year: number): FinanceMovement[] {
  const db = getDb()
  const rows = db.prepare(`
    ${MOVEMENT_BASE_SELECT}
    WHERE m.month = ? AND m.year = ?
    ORDER BY cat.name ASC, c.name ASC
  `).all(month, year) as MovementRow[]
  const movements = rows.map(hydrateMovement)
  attachPreviousMonthAmounts(db, movements, month, year)
  return movements
}

/**
 * Completa `previous_month_amount` de cada movimiento con lo realmente pagado
 * (amount_actual) por el mismo concepto en el mes calendario inmediatamente
 * anterior — solo cuando hubo un pago registrado (si no, queda en null y la
 * tabla muestra "—"). Es lo que alimenta la columna "Mes anterior" — pensada
 * para comparar de un vistazo "cuánto pagué la última vez" vs. lo de este mes.
 */
function attachPreviousMonthAmounts(
  db: ReturnType<typeof getDb>, movements: FinanceMovement[], month: number, year: number
): void {
  if (!movements.length) return
  const prevDate = new Date(year, month - 2, 1)
  const rows = db.prepare(`
    SELECT concept_id, amount_actual FROM finance_movements
    WHERE month = ? AND year = ? AND amount_actual IS NOT NULL
  `).all(prevDate.getMonth() + 1, prevDate.getFullYear()) as { concept_id: string; amount_actual: number }[]
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
export function listUpcomingFinanceMovements(): FinanceMovement[] {
  const db = getDb()
  const rows = db.prepare(`
    ${MOVEMENT_BASE_SELECT}
    WHERE m.status != 'paid' AND m.due_date IS NOT NULL
    ORDER BY m.due_date ASC
  `).all() as MovementRow[]
  return rows.map(hydrateMovement)
}

export function getFinanceMovement(id: string): FinanceMovement | null {
  const db = getDb()
  const r = db.prepare(`${MOVEMENT_BASE_SELECT} WHERE m.id = ?`).get(id) as MovementRow | undefined
  return r ? hydrateMovement(r) : null
}

export function createFinanceMovement(data: CreateFinanceMovementInput): FinanceMovement {
  const db  = getDb()
  const id  = randomUUID()
  const now = Date.now()
  db.prepare(`
    INSERT INTO finance_movements
      (id, concept_id, month, year, amount_estimated, amount_actual, status, payment_method, payment_date, due_date, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.concept_id, data.month, data.year,
    data.amount_estimated ?? 0,
    data.amount_actual ?? null,
    data.status ?? 'pending',
    data.payment_method ?? 'transfer',
    data.payment_date ?? null,
    data.due_date ?? null,
    data.notes ?? '', now, now
  )
  return getFinanceMovement(id)!
}

export function updateFinanceMovement(
  id: string, data: Partial<CreateFinanceMovementInput>
): FinanceMovement {
  const db  = getDb()
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
  db.prepare(`UPDATE finance_movements SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
  return getFinanceMovement(id)!
}

/** Edición rápida desde la tabla principal: monto real, estado, fechas y notas. */
export function quickUpdateFinanceMovement(id: string, data: {
  amount_actual?: number | null
  status?:        FinanceMovementStatus
  payment_date?:  number | null
  due_date?:      number | null
  notes?:         string
}): FinanceMovement {
  return updateFinanceMovement(id, data)
}

export function deleteFinanceMovement(id: string): void {
  getDb().prepare('DELETE FROM finance_movements WHERE id = ?').run(id)
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

export function listMovementEntries(movementId: string): FinanceMovementEntry[] {
  return getDb().prepare(`
    SELECT * FROM finance_movement_entries
    WHERE movement_id = ?
    ORDER BY COALESCE(entry_date, created_at) ASC, created_at ASC
  `).all(movementId) as FinanceMovementEntry[]
}

/** Recalcula amount_actual / status / payment_date del movimiento padre a partir de la suma de sus cargas. */
function recalcMovementFromEntries(db: ReturnType<typeof getDb>, movementId: string): void {
  const now = Date.now()
  const agg = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS n,
           MAX(COALESCE(entry_date, created_at)) AS lastDate
    FROM finance_movement_entries
    WHERE movement_id = ?
  `).get(movementId) as { total: number; n: number; lastDate: number | null }

  if (agg.n > 0) {
    db.prepare(`
      UPDATE finance_movements
      SET amount_actual = ?, status = 'paid', payment_date = ?, updated_at = ?
      WHERE id = ?
    `).run(agg.total, agg.lastDate, now, movementId)
  } else {
    db.prepare(`
      UPDATE finance_movements
      SET amount_actual = NULL, status = 'pending', payment_date = NULL, updated_at = ?
      WHERE id = ?
    `).run(now, movementId)
  }
}

export function addMovementEntry(data: CreateFinanceMovementEntryInput): FinanceMovementEntry {
  const db  = getDb()
  const id  = randomUUID()
  const now = Date.now()
  const run = db.transaction(() => {
    db.prepare(`
      INSERT INTO finance_movement_entries (id, movement_id, amount, entry_date, note, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.movement_id, data.amount, data.entry_date ?? now, data.note ?? '', now, now)
    recalcMovementFromEntries(db, data.movement_id)
  })
  run()
  return db.prepare('SELECT * FROM finance_movement_entries WHERE id = ?').get(id) as FinanceMovementEntry
}

export function updateMovementEntry(id: string, data: UpdateFinanceMovementEntryInput): FinanceMovementEntry {
  const db  = getDb()
  const now = Date.now()
  const existing = db.prepare('SELECT * FROM finance_movement_entries WHERE id = ?').get(id) as FinanceMovementEntry | undefined
  if (!existing) throw new Error('La carga que intentás editar ya no existe.')

  const run = db.transaction(() => {
    const sets: string[] = []
    const vals: unknown[] = []
    if (data.amount !== undefined)     { sets.push('amount = ?');     vals.push(data.amount) }
    if (data.entry_date !== undefined) { sets.push('entry_date = ?'); vals.push(data.entry_date) }
    if (data.note !== undefined)       { sets.push('note = ?');       vals.push(data.note) }
    sets.push('updated_at = ?'); vals.push(now); vals.push(id)
    db.prepare(`UPDATE finance_movement_entries SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
    recalcMovementFromEntries(db, existing.movement_id)
  })
  run()
  return db.prepare('SELECT * FROM finance_movement_entries WHERE id = ?').get(id) as FinanceMovementEntry
}

export function removeMovementEntry(id: string): void {
  const db = getDb()
  const existing = db.prepare('SELECT movement_id FROM finance_movement_entries WHERE id = ?').get(id) as { movement_id: string } | undefined
  if (!existing) return
  const run = db.transaction(() => {
    db.prepare('DELETE FROM finance_movement_entries WHERE id = ?').run(id)
    recalcMovementFromEntries(db, existing.movement_id)
  })
  run()
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
function shouldGenerateMovement(db: ReturnType<typeof getDb>, concept: FinanceConcept, month: number): boolean {
  switch (concept.recurrence) {
    case 'annual': {
      const targetMonth = concept.recurrence_month ?? (new Date(concept.created_at).getMonth() + 1)
      return month === targetMonth
    }
    case 'one_time': {
      const already = db.prepare('SELECT 1 FROM finance_movements WHERE concept_id = ? LIMIT 1').get(concept.id)
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
function generateMovements(month: number, year: number, estimateSource: 'default' | 'previous'): FinanceMovement[] {
  const db = getDb()
  const now = Date.now()
  const concepts = listFinanceConcepts({ activeOnly: true })
  const existing = new Set(
    (db.prepare('SELECT concept_id FROM finance_movements WHERE month = ? AND year = ?').all(month, year) as { concept_id: string }[])
      .map(r => r.concept_id)
  )

  let prevByConceptId: Map<string, FinanceMovement> | null = null
  if (estimateSource === 'previous') {
    const prevDate = new Date(year, month - 2, 1)
    const prevMovements = listFinanceMovements(prevDate.getMonth() + 1, prevDate.getFullYear())
    prevByConceptId = new Map(prevMovements.map(m => [m.concept_id, m]))
  }

  const insert = db.prepare(`
    INSERT INTO finance_movements
      (id, concept_id, month, year, amount_estimated, amount_actual, status, payment_method, payment_date, due_date, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, NULL, ?, ?, NULL, NULL, '', ?, ?)
  `)

  for (const concept of concepts) {
    if (existing.has(concept.id)) continue
    if (!shouldGenerateMovement(db, concept, month)) continue

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

    insert.run(randomUUID(), concept.id, month, year, amountEstimated, initialStatus, concept.payment_method, now, now)
  }
  return listFinanceMovements(month, year)
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
export function generateMovementsForMonth(month: number, year: number): FinanceMovement[] {
  return generateMovements(month, year, 'default')
}

/**
 * Genera los movimientos del mes igual que `generateMovementsForMonth`, pero
 * usa como estimación inicial el monto real del mes anterior (o su estimado si
 * todavía no se cargó un real) en lugar del monto fijo del concepto. Es la
 * opción "Crear nuevo mes desde mes anterior": sirve para arrancar el mes con
 * proyecciones más ajustadas a la realidad reciente en gastos variables.
 */
export function generateMovementsFromPreviousMonth(month: number, year: number): FinanceMovement[] {
  return generateMovements(month, year, 'previous')
}

// ── Resumen del mes (dashboard) ───────────────────────────────────────────────

function sumActual(movements: FinanceMovement[]): number {
  return movements.reduce((acc, m) => acc + (m.amount_actual ?? m.amount_estimated), 0)
}

export function getFinanceMonthSummary(month: number, year: number): FinanceMonthSummary {
  const movements = listFinanceMovements(month, year)

  const totalEstimated = movements.reduce((acc, m) => acc + m.amount_estimated, 0)
  const totalActual    = sumActual(movements)
  const totalPaid      = movements.filter(m => m.status === 'paid').reduce((acc, m) => acc + (m.amount_actual ?? m.amount_estimated), 0)
  const totalPending   = movements.filter(m => m.status === 'pending').reduce((acc, m) => acc + (m.amount_actual ?? m.amount_estimated), 0)
  const totalOverdue   = movements.filter(m => m.status === 'overdue').reduce((acc, m) => acc + (m.amount_actual ?? m.amount_estimated), 0)

  // Mes anterior (para comparación)
  const prevDate  = new Date(year, month - 2, 1)
  const prevMonth = prevDate.getMonth() + 1
  const prevYear  = prevDate.getFullYear()
  const prevMovements = listFinanceMovements(prevMonth, prevYear)
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

// ── Visualización / análisis (Fase 3) ─────────────────────────────────────────
//
// Mismo criterio que getFinanceMonthSummary: todo se agrega al vuelo a partir de
// listFinanceMovements, sin guardar nada derivado — así nunca queda desactualizado.

/** Desglose del gasto del mes por categoría: totales, % del total y top 5 conceptos de cada una. */
export function getFinanceCategoryBreakdown(month: number, year: number): FinanceCategoryBreakdownItem[] {
  const movements   = listFinanceMovements(month, year)
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
export function getFinanceHistory(month: number, year: number, monthsBack: number): FinanceHistoryEntry[] {
  const entries: FinanceHistoryEntry[] = []
  let prevMovements: FinanceMovement[] | null = null

  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1)
    const m = d.getMonth() + 1
    const y = d.getFullYear()
    const movements = listFinanceMovements(m, y)

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
export function getFinanceTopConcepts(month: number, year: number, limit = 8): FinanceRankingConcept[] {
  const movements   = listFinanceMovements(month, year)
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
export function getFinanceTopIncreases(month: number, year: number, limit = 8): FinanceRankingIncrease[] {
  const movements = listFinanceMovements(month, year)

  const prevDate = new Date(year, month - 2, 1)
  const prevMovements = listFinanceMovements(prevDate.getMonth() + 1, prevDate.getFullYear())
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
export function buildFinanceImportPreview(
  rows: ParsedImportRow[], month: number, year: number, fileName: string
): FinanceImportPreviewResult {
  const db = getDb()
  const concepts = listFinanceConcepts({ activeOnly: true })
  const byExactName = new Map(concepts.map(c => [normalizeConceptName(c.name), c]))

  const existingRows = db.prepare(
    'SELECT id, concept_id FROM finance_movements WHERE month = ? AND year = ?'
  ).all(month, year) as { id: string; concept_id: string }[]
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
export function confirmFinanceImport(
  items: FinanceImportConfirmItem[], month: number, year: number
): FinanceImportResult {
  const db  = getDb()
  const now = Date.now()
  const conceptsById = new Map(listFinanceConcepts().map(c => [c.id, c]))

  const insert = db.prepare(`
    INSERT INTO finance_movements
      (id, concept_id, month, year, amount_estimated, amount_actual, status, payment_method, payment_date, due_date, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
  `)
  const update = db.prepare(`
    UPDATE finance_movements
    SET amount_actual = ?, status = ?, payment_date = ?, notes = ?, updated_at = ?
    WHERE id = ?
  `)
  const findExisting = db.prepare(
    'SELECT id FROM finance_movements WHERE concept_id = ? AND month = ? AND year = ?'
  )

  let imported = 0, updated = 0, skipped = 0

  const run = db.transaction((list: FinanceImportConfirmItem[]) => {
    for (const item of list) {
      const concept = conceptsById.get(item.conceptId)
      if (!concept) { skipped++; continue }

      if (item.overwriteMovementId) {
        update.run(item.amount, item.status, item.paymentDate, item.notes, now, item.overwriteMovementId)
        updated++
        continue
      }

      // Salvaguarda: aunque la fila no haya llegado marcada como duplicado
      // (p.ej. el usuario reasignó manualmente el concepto en el preview a uno
      // que sí ya tiene movimiento este período), nunca insertar — chocaría con
      // el UNIQUE(concept_id, month, year) y abortaría toda la transacción.
      const already = findExisting.get(item.conceptId, month, year) as { id: string } | undefined
      if (already) { skipped++; continue }

      insert.run(
        randomUUID(), item.conceptId, month, year,
        item.amount, item.amount, item.status, concept.payment_method,
        item.paymentDate, item.notes, now, now
      )
      imported++
    }
  })
  run(items)

  return { imported, updated, skipped }
}
