import { randomUUID } from 'crypto'
import { getDb } from '../db'
import type {
  ExpiryCategory, ExpiryItem, ExpiryAlert,
  CreateExpiryItemInput, CreateExpiryAlertInput,
  ExpiryFrequency
} from '@shared/types'
import { EXPIRY_FREQUENCY_DAYS } from '@shared/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcNextExpiryDate(
  renewedDate: number,
  frequency: ExpiryFrequency,
  customDays: number | null
): number | null {
  const days = frequency === 'custom' ? customDays : EXPIRY_FREQUENCY_DAYS[frequency]
  if (!days) return null
  return renewedDate + days * 24 * 60 * 60 * 1000
}

// ── Categories ────────────────────────────────────────────────────────────────

export function listExpiryCategories(): ExpiryCategory[] {
  const db = getDb()
  return db.prepare(`
    SELECT * FROM expiry_categories ORDER BY is_default DESC, name ASC
  `).all() as ExpiryCategory[]
}

export function createExpiryCategory(data: {
  name: string; icon: string; color: string
}): ExpiryCategory {
  const db  = getDb()
  const id  = randomUUID()
  const now = Date.now()
  db.prepare(`
    INSERT INTO expiry_categories (id, name, icon, color, is_default, created_at, updated_at)
    VALUES (?, ?, ?, ?, 0, ?, ?)
  `).run(id, data.name, data.icon, data.color, now, now)
  return db.prepare('SELECT * FROM expiry_categories WHERE id = ?').get(id) as ExpiryCategory
}

export function updateExpiryCategory(
  id: string, data: Partial<{ name: string; icon: string; color: string }>
): ExpiryCategory {
  const db  = getDb()
  const now = Date.now()
  const sets: string[] = []
  const vals: unknown[] = []
  if (data.name  !== undefined) { sets.push('name = ?');  vals.push(data.name)  }
  if (data.icon  !== undefined) { sets.push('icon = ?');  vals.push(data.icon)  }
  if (data.color !== undefined) { sets.push('color = ?'); vals.push(data.color) }
  sets.push('updated_at = ?'); vals.push(now); vals.push(id)
  db.prepare(`UPDATE expiry_categories SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
  return db.prepare('SELECT * FROM expiry_categories WHERE id = ?').get(id) as ExpiryCategory
}

export function deleteExpiryCategory(id: string): void {
  getDb().prepare('DELETE FROM expiry_categories WHERE id = ?').run(id)
}

// ── Items ─────────────────────────────────────────────────────────────────────

export function listExpiryItems(): ExpiryItem[] {
  const db = getDb()
  const rows = db.prepare(`
    SELECT i.*, c.name as cat_name, c.icon as cat_icon, c.color as cat_color,
           c.is_default as cat_is_default, c.created_at as cat_created_at, c.updated_at as cat_updated_at
    FROM expiry_items i
    LEFT JOIN expiry_categories c ON c.id = i.category_id
    ORDER BY i.is_renewed ASC, i.expiry_date ASC
  `).all() as (ExpiryItem & {
    cat_name: string; cat_icon: string; cat_color: string;
    cat_is_default: number; cat_created_at: number; cat_updated_at: number
  })[]
  return rows.map(r => ({
    ...r,
    category: {
      id: r.category_id, name: r.cat_name, icon: r.cat_icon,
      color: r.cat_color, is_default: r.cat_is_default,
      created_at: r.cat_created_at, updated_at: r.cat_updated_at
    }
  }))
}

export function getExpiryItem(id: string): ExpiryItem | null {
  const db = getDb()
  const r = db.prepare(`
    SELECT i.*, c.name as cat_name, c.icon as cat_icon, c.color as cat_color,
           c.is_default as cat_is_default, c.created_at as cat_created_at, c.updated_at as cat_updated_at
    FROM expiry_items i
    LEFT JOIN expiry_categories c ON c.id = i.category_id
    WHERE i.id = ?
  `).get(id) as (ExpiryItem & {
    cat_name: string; cat_icon: string; cat_color: string;
    cat_is_default: number; cat_created_at: number; cat_updated_at: number
  }) | undefined
  if (!r) return null
  return {
    ...r,
    category: {
      id: r.category_id, name: r.cat_name, icon: r.cat_icon,
      color: r.cat_color, is_default: r.cat_is_default,
      created_at: r.cat_created_at, updated_at: r.cat_updated_at
    }
  }
}

export function createExpiryItem(data: CreateExpiryItemInput): ExpiryItem {
  const db  = getDb()
  const id  = randomUUID()
  const now = Date.now()
  db.prepare(`
    INSERT INTO expiry_items
      (id, category_id, title, description, holder, expiry_date, frequency,
       frequency_custom_days, is_renewed, renewed_date, next_expiry_date, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, ?, ?, ?)
  `).run(
    id, data.category_id, data.title,
    data.description ?? '', data.holder ?? '',
    data.expiry_date, data.frequency,
    data.frequency_custom_days ?? null,
    data.notes ?? '', now, now
  )
  return getExpiryItem(id)!
}

export function updateExpiryItem(
  id: string,
  data: Partial<Omit<CreateExpiryItemInput, 'category_id'> & { category_id: string }>
): ExpiryItem {
  const db  = getDb()
  const now = Date.now()
  const allowed = ['category_id','title','description','holder','expiry_date',
                   'frequency','frequency_custom_days','notes'] as const
  const sets: string[] = []
  const vals: unknown[] = []
  for (const key of allowed) {
    if (data[key] !== undefined) {
      sets.push(`${key} = ?`)
      vals.push(data[key] ?? null)
    }
  }
  sets.push('updated_at = ?'); vals.push(now); vals.push(id)
  db.prepare(`UPDATE expiry_items SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
  return getExpiryItem(id)!
}

export function renewExpiryItem(id: string, renewedDate: number): ExpiryItem {
  const db  = getDb()
  const now = Date.now()
  const item = getExpiryItem(id)!
  const nextDate = calcNextExpiryDate(renewedDate, item.frequency, item.frequency_custom_days)

  db.prepare(`
    UPDATE expiry_items
    SET is_renewed = 1, renewed_date = ?, next_expiry_date = ?, updated_at = ?
    WHERE id = ?
  `).run(renewedDate, nextDate, now, id)

  // Si tiene próxima fecha, crear un nuevo ítem para el siguiente vencimiento
  if (nextDate) {
    const newId = randomUUID()
    db.prepare(`
      INSERT INTO expiry_items
        (id, category_id, title, description, holder, expiry_date, frequency,
         frequency_custom_days, is_renewed, renewed_date, next_expiry_date, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, ?, ?, ?)
    `).run(
      newId, item.category_id, item.title,
      item.description, item.holder,
      nextDate, item.frequency,
      item.frequency_custom_days,
      item.notes, now, now
    )
    // Copiar alertas al nuevo ítem
    const alerts = listAlertsByItem(id)
    for (const alert of alerts) {
      db.prepare(`
        INSERT INTO expiry_alerts (id, item_id, days_before, channel, whatsapp_number, last_sent_at, created_at)
        VALUES (?, ?, ?, ?, ?, NULL, ?)
      `).run(randomUUID(), newId, alert.days_before, alert.channel, alert.whatsapp_number, now)
    }
  }

  return getExpiryItem(id)!
}

export function unrenewExpiryItem(id: string): ExpiryItem {
  const db  = getDb()
  const now = Date.now()
  db.prepare(`
    UPDATE expiry_items
    SET is_renewed = 0, renewed_date = NULL, next_expiry_date = NULL, updated_at = ?
    WHERE id = ?
  `).run(now, id)
  return getExpiryItem(id)!
}

export function deleteExpiryItem(id: string): void {
  getDb().prepare('DELETE FROM expiry_items WHERE id = ?').run(id)
}

// ── Alerts ────────────────────────────────────────────────────────────────────

export function listAlertsByItem(itemId: string): ExpiryAlert[] {
  return getDb().prepare(`
    SELECT * FROM expiry_alerts WHERE item_id = ? ORDER BY days_before DESC
  `).all(itemId) as ExpiryAlert[]
}

export function setAlertsForItem(
  itemId: string,
  alerts: CreateExpiryAlertInput[]
): ExpiryAlert[] {
  const db  = getDb()
  const now = Date.now()
  db.prepare('DELETE FROM expiry_alerts WHERE item_id = ?').run(itemId)
  for (const a of alerts) {
    db.prepare(`
      INSERT INTO expiry_alerts (id, item_id, days_before, channel, whatsapp_number, last_sent_at, created_at)
      VALUES (?, ?, ?, ?, ?, NULL, ?)
    `).run(randomUUID(), itemId, a.days_before, a.channel, a.whatsapp_number ?? '', now)
  }
  return listAlertsByItem(itemId)
}

export function markAlertSent(alertId: string, sentAt: number): void {
  getDb().prepare('UPDATE expiry_alerts SET last_sent_at = ? WHERE id = ?').run(sentAt, alertId)
}

// ── Para el scheduler ─────────────────────────────────────────────────────────

export interface PendingExpiryAlert {
  alert:    ExpiryAlert
  item:     ExpiryItem
}

export function getPendingExpiryAlerts(): PendingExpiryAlert[] {
  const db  = getDb()
  const now = Date.now()
  // Trae alertas cuyo umbral ya pasó y no fueron enviadas hoy
  const rows = db.prepare(`
    SELECT a.*, i.id as item_id_fk
    FROM expiry_alerts a
    JOIN expiry_items i ON i.id = a.item_id
    WHERE i.is_renewed = 0
    ORDER BY i.expiry_date ASC
  `).all() as (ExpiryAlert & { item_id_fk: string })[]

  const pending: PendingExpiryAlert[] = []
  for (const alertRow of rows) {
    const item = getExpiryItem(alertRow.item_id_fk)
    if (!item) continue
    const threshold = item.expiry_date - alertRow.days_before * 24 * 60 * 60 * 1000
    if (now < threshold) continue  // todavía no llegó el momento
    // No enviar si ya fue enviada DESPUÉS del threshold (evita duplicados)
    if (alertRow.last_sent_at && alertRow.last_sent_at >= threshold) continue
    pending.push({ alert: alertRow, item })
  }
  return pending
}
