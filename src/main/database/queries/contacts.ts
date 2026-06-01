import { randomUUID } from 'crypto'
import { getDb } from '../db'
import type { Contact, CreateContactInput, ContactType } from '@shared/types'

const AVATAR_COLORS = [
  '#6366f1', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'
]

function pickColor(name: string): string {
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function listContacts(): Contact[] {
  return getDb().prepare('SELECT * FROM contacts ORDER BY name ASC').all() as Contact[]
}

export function getContact(id: string): Contact | null {
  return getDb().prepare('SELECT * FROM contacts WHERE id = ?').get(id) as Contact | null
}

export function createContact(input: CreateContactInput): Contact {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()
  const color = pickColor(input.name)
  db.prepare(`
    INSERT INTO contacts (id, name, phone, email, notes, type, avatar_color, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.name,
    input.phone.replace(/\D/g, ''),
    input.email ?? '',
    input.notes ?? '',
    input.type ?? 'other',
    color,
    now,
    now
  )
  return db.prepare('SELECT * FROM contacts WHERE id = ?').get(id) as Contact
}

export function updateContact(id: string, data: Partial<Omit<Contact, 'id' | 'created_at'>>): Contact | null {
  const db = getDb()
  const allowed = ['name', 'phone', 'email', 'notes', 'type', 'avatar_color']
  const sets: string[] = ['updated_at = ?']
  const vals: unknown[] = [Date.now()]

  for (const key of allowed) {
    if (key in data) {
      const val = (data as Record<string, unknown>)[key]
      sets.push(`${key} = ?`)
      vals.push(key === 'phone' ? String(val).replace(/\D/g, '') : val)
    }
  }

  vals.push(id)
  db.prepare(`UPDATE contacts SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
  return db.prepare('SELECT * FROM contacts WHERE id = ?').get(id) as Contact | null
}

export function deleteContact(id: string): void {
  getDb().prepare('DELETE FROM contacts WHERE id = ?').run(id)
}
