import { randomUUID } from 'crypto'
import { getDb } from '../db'
import type {
  FinanceAccount, FinanceCategory, FinanceConcept, FinanceMovement,
  CreateFinanceAccountInput, CreateFinanceCategoryInput,
  CreateFinanceConceptInput, CreateFinanceMovementInput,
  FinanceMonthSummary, FinanceMovementStatus, FinancePaymentMethod
} from '@shared/types'

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
      (id, category_id, account_id, name, default_amount, expense_type, payment_method, recurrence, is_active, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
  `).run(
    id, data.category_id, data.account_id, data.name,
    data.default_amount ?? 0,
    data.expense_type ?? 'fixed',
    data.payment_method ?? 'transfer',
    data.recurrence ?? 'monthly',
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
                   'expense_type', 'payment_method', 'recurrence', 'notes', 'is_active'] as const
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
  c_expense_type: string; c_payment_method: string; c_recurrence: string
  c_is_active: number; c_notes: string; c_created_at: number; c_updated_at: number
  cat_name: string; cat_icon: string; cat_color: string
  acc_name: string; acc_icon: string; acc_color: string
}

function hydrateMovement(r: MovementRow): FinanceMovement {
  return {
    id: r.id, concept_id: r.concept_id, month: r.month, year: r.year,
    amount_estimated: r.amount_estimated, amount_actual: r.amount_actual,
    status: r.status, payment_method: r.payment_method,
    payment_date: r.payment_date, due_date: r.due_date, notes: r.notes,
    created_at: r.created_at, updated_at: r.updated_at,
    concept: {
      id: r.concept_id, category_id: r.c_category_id, account_id: r.c_account_id,
      name: r.c_name, default_amount: r.c_default_amount,
      expense_type: r.c_expense_type as FinanceConcept['expense_type'],
      payment_method: r.c_payment_method as FinancePaymentMethod,
      recurrence: r.c_recurrence as FinanceConcept['recurrence'],
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
         c.is_active as c_is_active, c.notes as c_notes,
         c.created_at as c_created_at, c.updated_at as c_updated_at,
         cat.name as cat_name, cat.icon as cat_icon, cat.color as cat_color,
         acc.name as acc_name, acc.icon as acc_icon, acc.color as acc_color
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

/**
 * Genera los movimientos del mes a partir de los conceptos activos
 * (omite los que ya existan para ese período). Útil para "crear nuevo mes".
 */
export function generateMovementsForMonth(month: number, year: number): FinanceMovement[] {
  const db = getDb()
  const now = Date.now()
  const concepts = listFinanceConcepts({ activeOnly: true })
  const existing = new Set(
    (db.prepare('SELECT concept_id FROM finance_movements WHERE month = ? AND year = ?').all(month, year) as { concept_id: string }[])
      .map(r => r.concept_id)
  )
  const insert = db.prepare(`
    INSERT INTO finance_movements
      (id, concept_id, month, year, amount_estimated, amount_actual, status, payment_method, payment_date, due_date, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, NULL, 'pending', ?, NULL, ?, '', ?, ?)
  `)
  const dueDate = new Date(year, month - 1, 10).getTime()
  for (const concept of concepts) {
    if (existing.has(concept.id)) continue
    insert.run(randomUUID(), concept.id, month, year, concept.default_amount, concept.payment_method, dueDate, now, now)
  }
  return listFinanceMovements(month, year)
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
