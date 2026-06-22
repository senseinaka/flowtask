import { randomUUID } from 'crypto'
import { getPowerSyncDb } from '../powersync'
import { QUOTE_SLA_MS as SLA_MS } from '@shared/types'
import type {
  Quote,
  QuoteActivity,
  QuoteCompany,
  QuoteContact,
  QuoteKPIs,
  QuoteStatus,
  AddQuoteActivityInput,
  CreateQuoteCompanyInput,
  CreateQuoteContactInput,
  CreateQuoteInput,
  UpdateQuoteInput
} from '@shared/types'

const WORKSPACE_ID = 'd61a4071-1557-4f32-be5e-6443fb336bf5'

// ── Companies ─────────────────────────────────────────────────────────────────

export async function listQuoteCompanies(): Promise<QuoteCompany[]> {
  return getPowerSyncDb().getAll<QuoteCompany>(`
    SELECT * FROM quote_companies
    WHERE workspace_id = ?
    ORDER BY name ASC
  `, [WORKSPACE_ID])
}

export async function getQuoteCompany(id: string): Promise<QuoteCompany | null> {
  return getPowerSyncDb().getOptional<QuoteCompany>(
    'SELECT * FROM quote_companies WHERE id = ?', [id]
  )
}

export async function createQuoteCompany(data: CreateQuoteCompanyInput): Promise<QuoteCompany> {
  const db  = getPowerSyncDb()
  const id  = randomUUID()
  const now = Date.now()
  await db.execute(`
    INSERT INTO quote_companies (id, workspace_id, name, industry, website, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, WORKSPACE_ID, data.name, data.industry ?? '', data.website ?? '', data.notes ?? '', now, now])
  return (await db.getOptional<QuoteCompany>('SELECT * FROM quote_companies WHERE id = ?', [id]))!
}

export async function updateQuoteCompany(
  id: string,
  data: Partial<CreateQuoteCompanyInput>
): Promise<QuoteCompany> {
  const db  = getPowerSyncDb()
  const now = Date.now()
  const sets: string[] = []
  const vals: unknown[] = []
  if (data.name     !== undefined) { sets.push('name = ?');     vals.push(data.name) }
  if (data.industry !== undefined) { sets.push('industry = ?'); vals.push(data.industry) }
  if (data.website  !== undefined) { sets.push('website = ?');  vals.push(data.website) }
  if (data.notes    !== undefined) { sets.push('notes = ?');    vals.push(data.notes) }
  sets.push('updated_at = ?'); vals.push(now); vals.push(id)
  await db.execute(`UPDATE quote_companies SET ${sets.join(', ')} WHERE id = ?`, vals)
  return (await db.getOptional<QuoteCompany>('SELECT * FROM quote_companies WHERE id = ?', [id]))!
}

export async function deleteQuoteCompany(id: string): Promise<void> {
  await getPowerSyncDb().execute('DELETE FROM quote_companies WHERE id = ?', [id])
}

// ── Contacts ──────────────────────────────────────────────────────────────────

export async function listQuoteContacts(companyId?: string): Promise<QuoteContact[]> {
  if (companyId) {
    return getPowerSyncDb().getAll<QuoteContact>(`
      SELECT * FROM quote_contacts
      WHERE workspace_id = ? AND company_id = ?
      ORDER BY name ASC
    `, [WORKSPACE_ID, companyId])
  }
  return getPowerSyncDb().getAll<QuoteContact>(`
    SELECT * FROM quote_contacts
    WHERE workspace_id = ?
    ORDER BY name ASC
  `, [WORKSPACE_ID])
}

export async function createQuoteContact(data: CreateQuoteContactInput): Promise<QuoteContact> {
  const db  = getPowerSyncDb()
  const id  = randomUUID()
  const now = Date.now()
  await db.execute(`
    INSERT INTO quote_contacts (id, workspace_id, company_id, name, email, phone, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, WORKSPACE_ID, data.company_id, data.name, data.email ?? '', data.phone ?? '', data.role ?? '', now, now])
  return (await db.getOptional<QuoteContact>('SELECT * FROM quote_contacts WHERE id = ?', [id]))!
}

export async function updateQuoteContact(
  id: string,
  data: Partial<Omit<CreateQuoteContactInput, 'company_id'>>
): Promise<QuoteContact> {
  const db  = getPowerSyncDb()
  const now = Date.now()
  const sets: string[] = []
  const vals: unknown[] = []
  if (data.name  !== undefined) { sets.push('name = ?');  vals.push(data.name) }
  if (data.email !== undefined) { sets.push('email = ?'); vals.push(data.email) }
  if (data.phone !== undefined) { sets.push('phone = ?'); vals.push(data.phone) }
  if (data.role  !== undefined) { sets.push('role = ?');  vals.push(data.role) }
  sets.push('updated_at = ?'); vals.push(now); vals.push(id)
  await db.execute(`UPDATE quote_contacts SET ${sets.join(', ')} WHERE id = ?`, vals)
  return (await db.getOptional<QuoteContact>('SELECT * FROM quote_contacts WHERE id = ?', [id]))!
}

export async function deleteQuoteContact(id: string): Promise<void> {
  await getPowerSyncDb().execute('DELETE FROM quote_contacts WHERE id = ?', [id])
}

// ── Quotes ────────────────────────────────────────────────────────────────────

export interface QuoteFilters {
  status?: string
  priority?: string
  assigned_to?: string
}

export async function listQuotes(filters?: QuoteFilters): Promise<Quote[]> {
  const conditions: string[] = ['workspace_id = ?']
  const vals: unknown[] = [WORKSPACE_ID]

  if (filters?.status)      { conditions.push('status = ?');      vals.push(filters.status) }
  if (filters?.priority)    { conditions.push('priority = ?');    vals.push(filters.priority) }
  if (filters?.assigned_to) { conditions.push('assigned_to = ?'); vals.push(filters.assigned_to) }

  return getPowerSyncDb().getAll<Quote>(`
    SELECT * FROM quotes
    WHERE ${conditions.join(' AND ')}
    ORDER BY
      CASE priority WHEN 'p1' THEN 0 WHEN 'p2' THEN 1 WHEN 'p3' THEN 2 ELSE 3 END,
      created_at DESC
  `, vals)
}

export async function getQuote(id: string): Promise<Quote | null> {
  return getPowerSyncDb().getOptional<Quote>(
    'SELECT * FROM quotes WHERE id = ?', [id]
  )
}

export async function createQuote(data: CreateQuoteInput, actorUserId: string): Promise<Quote> {
  const db     = getPowerSyncDb()
  const id     = randomUUID()
  const now    = Date.now()
  const slaMs  = SLA_MS[data.priority ?? 'p3']
  const slaDue = now + slaMs

  await db.execute(`
    INSERT INTO quotes (
      id, workspace_id, title, status, priority, channel,
      assigned_to, company_id, contact_id,
      estimated_value, won_value, lost_reason,
      next_follow_up_at, sla_due_at, notes,
      created_at, updated_at
    ) VALUES (?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, NULL, '', NULL, ?, ?, ?, ?)
  `, [
    id, WORKSPACE_ID, data.title,
    data.priority ?? 'p3',
    data.channel ?? 'email',
    data.assigned_to ?? '',
    data.company_id ?? '',
    data.contact_id ?? '',
    data.estimated_value ?? null,
    slaDue,
    data.notes ?? '',
    now, now
  ])

  await _addActivity({
    quote_id: id,
    user_id: actorUserId,
    type: 'system',
    payload: { text: 'Presupuesto creado' }
  })

  return (await db.getOptional<Quote>('SELECT * FROM quotes WHERE id = ?', [id]))!
}

export async function updateQuote(
  id: string,
  data: UpdateQuoteInput,
  actorUserId: string
): Promise<Quote> {
  const db  = getPowerSyncDb()
  const now = Date.now()

  const current = await db.getOptional<Quote>('SELECT * FROM quotes WHERE id = ?', [id])
  if (!current) throw new Error(`Quote ${id} not found`)

  const sets: string[] = []
  const vals: unknown[] = []

  if (data.title             !== undefined) { sets.push('title = ?');             vals.push(data.title) }
  if (data.status            !== undefined) { sets.push('status = ?');            vals.push(data.status) }
  if (data.priority          !== undefined) { sets.push('priority = ?');          vals.push(data.priority) }
  if (data.channel           !== undefined) { sets.push('channel = ?');           vals.push(data.channel) }
  if (data.assigned_to       !== undefined) { sets.push('assigned_to = ?');       vals.push(data.assigned_to) }
  if (data.company_id        !== undefined) { sets.push('company_id = ?');        vals.push(data.company_id) }
  if (data.contact_id        !== undefined) { sets.push('contact_id = ?');        vals.push(data.contact_id) }
  if (data.estimated_value   !== undefined) { sets.push('estimated_value = ?');   vals.push(data.estimated_value) }
  if (data.budgeted_value    !== undefined) { sets.push('budgeted_value = ?');    vals.push(data.budgeted_value) }
  if (data.won_value         !== undefined) { sets.push('won_value = ?');         vals.push(data.won_value) }
  if (data.lost_reason       !== undefined) { sets.push('lost_reason = ?');       vals.push(data.lost_reason) }
  if (data.next_follow_up_at !== undefined) { sets.push('next_follow_up_at = ?'); vals.push(data.next_follow_up_at) }
  if (data.notes             !== undefined) { sets.push('notes = ?');             vals.push(data.notes) }

  if (sets.length === 0) return current

  sets.push('updated_at = ?'); vals.push(now); vals.push(id)
  await db.execute(`UPDATE quotes SET ${sets.join(', ')} WHERE id = ?`, vals)

  // Registrar actividades por cada cambio relevante
  if (data.status !== undefined && data.status !== current.status) {
    await _addActivity({
      quote_id: id, user_id: actorUserId, type: 'status_change',
      payload: { from: current.status, to: data.status }
    })
  }
  if (data.assigned_to !== undefined && data.assigned_to !== current.assigned_to) {
    await _addActivity({
      quote_id: id, user_id: actorUserId, type: 'assignment',
      payload: { from: current.assigned_to, to: data.assigned_to }
    })
  }
  if (data.estimated_value !== undefined && data.estimated_value !== current.estimated_value) {
    await _addActivity({
      quote_id: id, user_id: actorUserId, type: 'value_update',
      payload: { from: current.estimated_value, to: data.estimated_value }
    })
  }
  if (data.next_follow_up_at !== undefined && data.next_follow_up_at !== current.next_follow_up_at) {
    await _addActivity({
      quote_id: id, user_id: actorUserId, type: 'follow_up_set',
      payload: { date: data.next_follow_up_at }
    })
  }
  if (data.lost_reason !== undefined && data.lost_reason && data.lost_reason !== current.lost_reason) {
    await _addActivity({
      quote_id: id, user_id: actorUserId, type: 'lost_reason_set',
      payload: { reason: data.lost_reason }
    })
  }

  return (await db.getOptional<Quote>('SELECT * FROM quotes WHERE id = ?', [id]))!
}

export async function deleteQuote(id: string): Promise<void> {
  const db = getPowerSyncDb()
  await db.execute('DELETE FROM quote_activities WHERE quote_id = ?', [id])
  await db.execute('DELETE FROM quotes WHERE id = ?', [id])
}

// ── Activities ────────────────────────────────────────────────────────────────

async function _addActivity(data: AddQuoteActivityInput): Promise<void> {
  const db  = getPowerSyncDb()
  const id  = randomUUID()
  const now = Date.now()
  await db.execute(`
    INSERT INTO quote_activities (id, workspace_id, quote_id, user_id, type, payload, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [id, WORKSPACE_ID, data.quote_id, data.user_id, data.type, JSON.stringify(data.payload), now])
}

export async function listQuoteActivities(quoteId: string): Promise<QuoteActivity[]> {
  return getPowerSyncDb().getAll<QuoteActivity>(`
    SELECT * FROM quote_activities
    WHERE quote_id = ?
    ORDER BY created_at ASC
  `, [quoteId])
}

export async function addQuoteActivity(data: AddQuoteActivityInput): Promise<QuoteActivity> {
  const db  = getPowerSyncDb()
  const id  = randomUUID()
  const now = Date.now()
  await db.execute(`
    INSERT INTO quote_activities (id, workspace_id, quote_id, user_id, type, payload, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [id, WORKSPACE_ID, data.quote_id, data.user_id, data.type, JSON.stringify(data.payload), now])
  return (await db.getOptional<QuoteActivity>('SELECT * FROM quote_activities WHERE id = ?', [id]))!
}

// ── KPIs ──────────────────────────────────────────────────────────────────────

export async function getQuoteKPIs(): Promise<QuoteKPIs> {
  const db = getPowerSyncDb()

  const rows = await db.getAll<{ status: string; count: number; total: number | null }>(`
    SELECT status, COUNT(*) as count, SUM(estimated_value) as total
    FROM quotes
    WHERE workspace_id = ?
    GROUP BY status
  `, [WORKSPACE_ID])

  const STATUSES: QuoteStatus[] = ['new', 'analysis', 'elaborating', 'sent', 'follow_up', 'won', 'lost', 'archived', 'postponed']
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<QuoteStatus, number>

  let total = 0
  let pipelineValue = 0
  let wonValue = 0
  let lostCount = 0

  for (const row of rows) {
    const st = row.status as QuoteStatus
    byStatus[st] = row.count
    total += row.count
    if (['new', 'analysis', 'elaborating', 'sent', 'follow_up'].includes(st)) {
      pipelineValue += row.total ?? 0
    }
    if (st === 'won') wonValue = row.total ?? 0
    if (st === 'lost') lostCount = row.count
  }

  // Tiempo promedio de resolución para presupuestos ganados (días)
  const wonRows = await db.getAll<{ created_at: number; updated_at: number }>(`
    SELECT created_at, updated_at FROM quotes
    WHERE workspace_id = ? AND status = 'won'
  `, [WORKSPACE_ID])

  let avgDaysOpen: number | null = null
  if (wonRows.length > 0) {
    const sum = wonRows.reduce((acc, r) => acc + (r.updated_at - r.created_at), 0)
    avgDaysOpen = Math.round(sum / wonRows.length / (1000 * 60 * 60 * 24))
  }

  return { total, byStatus, pipelineValue, wonValue, lostCount, avgDaysOpen }
}
