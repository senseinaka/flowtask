import { randomUUID } from 'crypto'
import { getDb } from '../db'
import type { Contact, ContactPhone, ContactEmail, CreateContactInput, AgendaGrupo, CreateAgendaGrupoInput } from '@shared/types'

const AVATAR_COLORS = [
  '#6366f1', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'
]

function pickColor(name: string): string {
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function parseContact(raw: Record<string, unknown>): Contact {
  let phones: ContactPhone[] = []
  let emails: ContactEmail[] = []
  let tags: string[] = []

  try {
    const parsed = JSON.parse(raw.phones as string)
    if (Array.isArray(parsed)) {
      // La migración v97 guarda json_array(phone) que produce ["numero"], no [{numero,etiqueta}]
      phones = parsed
        .map((p: unknown) => typeof p === 'string' ? { numero: p, etiqueta: 'personal' as const } : p as ContactPhone)
        .filter((p: ContactPhone) => p.numero)
    }
  } catch { /* empty */ }

  try {
    const parsed = JSON.parse(raw.emails as string)
    if (Array.isArray(parsed)) {
      emails = parsed
        .map((e: unknown) => typeof e === 'string' ? { direccion: e, etiqueta: 'personal' as const } : e as ContactEmail)
        .filter((e: ContactEmail) => e.direccion)
    }
  } catch { /* empty */ }

  try { tags = JSON.parse(raw.tags as string) } catch { /* empty */ }

  // Backward compat: si no hay arrays pero hay columna legacy
  if (!phones.length && typeof raw.phone === 'string' && raw.phone !== '') {
    phones = [{ numero: raw.phone, etiqueta: 'personal' }]
  }
  if (!emails.length && typeof raw.email === 'string' && raw.email !== '') {
    emails = [{ direccion: raw.email, etiqueta: 'personal' }]
  }

  return {
    ...(raw as unknown as Contact),
    phones,
    emails,
    tags,
    company:  (raw.company  as string) ?? '',
    role:     (raw.role     as string) ?? '',
    favorito: (raw.favorito as number) ?? 0,
  }
}

// ── Contacts CRUD ─────────────────────────────────────────────────────────────

export function listContacts(): Contact[] {
  const rows = getDb().prepare('SELECT * FROM contacts ORDER BY name ASC').all() as Record<string, unknown>[]
  return rows.map(parseContact)
}

export function getContact(id: string): Contact | null {
  const row = getDb().prepare('SELECT * FROM contacts WHERE id = ?').get(id) as Record<string, unknown> | null
  return row ? parseContact(row) : null
}

export function createContact(input: CreateContactInput): Contact {
  const db    = getDb()
  const id    = randomUUID()
  const now   = Date.now()
  const color = pickColor(input.name)

  // Construir arrays a partir de los campos individuales o de los nuevos campos
  let phones: ContactPhone[] = input.phones ?? []
  if (!phones.length && input.phone) {
    phones = [{ numero: input.phone.replace(/\D/g, ''), etiqueta: 'personal' }]
  }
  let emails: ContactEmail[] = input.emails ?? []
  if (!emails.length && input.email) {
    emails = [{ direccion: input.email.trim(), etiqueta: 'personal' }]
  }
  const tags = input.tags ?? []

  // Campo legacy (primer item de cada array)
  const legacyPhone = phones[0]?.numero ?? ''
  const legacyEmail = emails[0]?.direccion ?? ''

  db.prepare(`
    INSERT INTO contacts
      (id, name, phone, email, notes, type, avatar_color,
       company, role, phones, emails, tags, favorito,
       created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, input.name, legacyPhone, legacyEmail,
    input.notes ?? '', input.type ?? 'other', color,
    input.company ?? '', input.role ?? '',
    JSON.stringify(phones), JSON.stringify(emails), JSON.stringify(tags),
    input.favorito ?? 0,
    now, now
  )

  return getContact(id)!
}

export function updateContact(id: string, data: Partial<Omit<Contact, 'id' | 'created_at'>>): Contact | null {
  const db      = getDb()
  const allowed = ['name', 'notes', 'type', 'avatar_color', 'company', 'role', 'favorito']
  const sets: string[] = ['updated_at = ?']
  const vals: unknown[] = [Date.now()]

  for (const key of allowed) {
    if (key in data) {
      sets.push(`${key} = ?`)
      vals.push((data as Record<string, unknown>)[key])
    }
  }

  // Manejar arrays JSON
  if ('phones' in data && Array.isArray(data.phones)) {
    sets.push('phones = ?', 'phone = ?')
    vals.push(JSON.stringify(data.phones))
    vals.push(data.phones[0]?.numero ?? '')
  }
  if ('emails' in data && Array.isArray(data.emails)) {
    sets.push('emails = ?', 'email = ?')
    vals.push(JSON.stringify(data.emails))
    vals.push(data.emails[0]?.direccion ?? '')
  }
  if ('tags' in data && Array.isArray(data.tags)) {
    sets.push('tags = ?')
    vals.push(JSON.stringify(data.tags))
  }
  // Legacy phone string update
  if ('phone' in data && typeof data.phone === 'string') {
    sets.push('phone = ?')
    vals.push(String(data.phone).replace(/\D/g, ''))
  }

  vals.push(id)
  db.prepare(`UPDATE contacts SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
  return getContact(id)
}

export function deleteContact(id: string): void {
  getDb().prepare('DELETE FROM contacts WHERE id = ?').run(id)
}

// ── Agenda Grupos CRUD ────────────────────────────────────────────────────────

export function listGrupos(): AgendaGrupo[] {
  return getDb().prepare(`
    SELECT g.*, COUNT(m.contact_id) AS member_count
    FROM agenda_grupos g
    LEFT JOIN agenda_grupo_miembros m ON m.grupo_id = g.id
    GROUP BY g.id
    ORDER BY g.nombre ASC
  `).all() as AgendaGrupo[]
}

export function getGrupo(id: string): AgendaGrupo | null {
  return getDb().prepare(`
    SELECT g.*, COUNT(m.contact_id) AS member_count
    FROM agenda_grupos g
    LEFT JOIN agenda_grupo_miembros m ON m.grupo_id = g.id
    WHERE g.id = ?
    GROUP BY g.id
  `).get(id) as AgendaGrupo | null
}

export function createGrupo(input: CreateAgendaGrupoInput): AgendaGrupo {
  const db  = getDb()
  const id  = randomUUID()
  const now = Date.now()
  db.prepare(`
    INSERT INTO agenda_grupos (id, nombre, descripcion, color, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, input.nombre, input.descripcion ?? '', input.color ?? '#6366f1', now, now)
  return getGrupo(id)!
}

export function updateGrupo(id: string, data: Partial<Pick<AgendaGrupo, 'nombre' | 'descripcion' | 'color'>>): AgendaGrupo | null {
  const db   = getDb()
  const sets = ['updated_at = ?']
  const vals: unknown[] = [Date.now()]
  for (const key of ['nombre', 'descripcion', 'color'] as const) {
    if (key in data) { sets.push(`${key} = ?`); vals.push(data[key]) }
  }
  vals.push(id)
  db.prepare(`UPDATE agenda_grupos SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
  return getGrupo(id)
}

export function deleteGrupo(id: string): void {
  getDb().prepare('DELETE FROM agenda_grupos WHERE id = ?').run(id)
}

export function getContactGrupos(contactId: string): AgendaGrupo[] {
  return getDb().prepare(`
    SELECT g.*, COUNT(m2.contact_id) AS member_count
    FROM agenda_grupos g
    JOIN agenda_grupo_miembros m ON m.grupo_id = g.id AND m.contact_id = ?
    LEFT JOIN agenda_grupo_miembros m2 ON m2.grupo_id = g.id
    GROUP BY g.id
    ORDER BY g.nombre ASC
  `).all(contactId) as AgendaGrupo[]
}

export function getGrupoMembers(grupoId: string): Contact[] {
  const rows = getDb().prepare(`
    SELECT c.* FROM contacts c
    JOIN agenda_grupo_miembros m ON m.contact_id = c.id AND m.grupo_id = ?
    ORDER BY c.name ASC
  `).all(grupoId) as Record<string, unknown>[]
  return rows.map(parseContact)
}

export function addGrupoMember(grupoId: string, contactId: string): void {
  getDb().prepare(`
    INSERT OR IGNORE INTO agenda_grupo_miembros (grupo_id, contact_id, added_at)
    VALUES (?, ?, ?)
  `).run(grupoId, contactId, Date.now())
}

export function removeGrupoMember(grupoId: string, contactId: string): void {
  getDb().prepare('DELETE FROM agenda_grupo_miembros WHERE grupo_id = ? AND contact_id = ?').run(grupoId, contactId)
}
