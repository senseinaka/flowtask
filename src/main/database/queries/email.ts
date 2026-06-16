import { randomUUID } from 'crypto'
import { getEmailDb as getDb } from '../email-db'
import type {
  EmailAccount,
  EmailMessage,
  EmailAttachment,
  CreateEmailAccountInput,
  EmailListFilters
} from '@shared/types'

const WORKSPACE_ID = 'd61a4071-1557-4f32-be5e-6443fb336fb5'

// ── Accounts ──────────────────────────────────────────────────────────────────

export async function listEmailAccounts(): Promise<EmailAccount[]> {
  return getDb()
    .prepare(`SELECT * FROM email_accounts WHERE workspace_id = ? ORDER BY created_at ASC`)
    .all(WORKSPACE_ID) as EmailAccount[]
}

export async function getEmailAccount(id: string): Promise<EmailAccount | null> {
  return (getDb()
    .prepare(`SELECT * FROM email_accounts WHERE id = ? AND workspace_id = ?`)
    .get(id, WORKSPACE_ID) as EmailAccount) ?? null
}

export async function createEmailAccount(data: CreateEmailAccountInput): Promise<EmailAccount> {
  const db = getDb()
  const now = Date.now()
  const id = randomUUID()
  db.prepare(
    `INSERT INTO email_accounts
      (id, workspace_id, email, display_name, imap_host, imap_port, imap_secure,
       smtp_host, smtp_port, smtp_secure, username, password, is_active, last_uid_inbox,
       created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,0,?,?)`
  ).run(
    id, WORKSPACE_ID,
    data.email, data.display_name ?? data.email,
    data.imap_host, data.imap_port ?? 993, data.imap_secure !== false ? 1 : 0,
    data.smtp_host, data.smtp_port ?? 465, data.smtp_secure !== false ? 1 : 0,
    data.username, data.password,
    now, now
  )
  return (await getEmailAccount(id))!
}

export async function updateEmailAccount(
  id: string,
  data: Partial<CreateEmailAccountInput>
): Promise<EmailAccount> {
  const db = getDb()
  const now = Date.now()
  const sets: string[] = ['updated_at = ?']
  const vals: unknown[] = [now]
  if (data.email !== undefined)        { sets.push('email = ?');        vals.push(data.email) }
  if (data.display_name !== undefined) { sets.push('display_name = ?'); vals.push(data.display_name) }
  if (data.imap_host !== undefined)    { sets.push('imap_host = ?');    vals.push(data.imap_host) }
  if (data.imap_port !== undefined)    { sets.push('imap_port = ?');    vals.push(data.imap_port) }
  if (data.imap_secure !== undefined)  { sets.push('imap_secure = ?');  vals.push(data.imap_secure ? 1 : 0) }
  if (data.smtp_host !== undefined)    { sets.push('smtp_host = ?');    vals.push(data.smtp_host) }
  if (data.smtp_port !== undefined)    { sets.push('smtp_port = ?');    vals.push(data.smtp_port) }
  if (data.smtp_secure !== undefined)  { sets.push('smtp_secure = ?');  vals.push(data.smtp_secure ? 1 : 0) }
  if (data.username !== undefined)     { sets.push('username = ?');     vals.push(data.username) }
  if (data.password !== undefined)     { sets.push('password = ?');     vals.push(data.password) }
  vals.push(id)
  db.prepare(`UPDATE email_accounts SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
  return (await getEmailAccount(id))!
}

export async function deleteEmailAccount(id: string): Promise<void> {
  const db = getDb()
  db.prepare(`DELETE FROM email_messages WHERE account_id = ?`).run(id)
  db.prepare(`DELETE FROM email_accounts WHERE id = ?`).run(id)
}

export async function setLastUidInbox(accountId: string, uid: number): Promise<void> {
  getDb()
    .prepare(`UPDATE email_accounts SET last_uid_inbox = ?, updated_at = ? WHERE id = ?`)
    .run(uid, Date.now(), accountId)
}

export async function resetEmailAccountSync(accountId: string): Promise<void> {
  const db = getDb()
  const messageIds = db
    .prepare('SELECT id FROM email_messages WHERE account_id = ?')
    .all(accountId) as { id: string }[]
  for (const { id } of messageIds) {
    db.prepare('DELETE FROM email_attachments WHERE message_id = ?').run(id)
  }
  db.prepare('DELETE FROM email_messages WHERE account_id = ?').run(accountId)
  db.prepare('UPDATE email_accounts SET last_uid_inbox = 0, updated_at = ? WHERE id = ?')
    .run(Date.now(), accountId)
}

// ── Messages ──────────────────────────────────────────────────────────────────

export async function listEmailMessages(filters: EmailListFilters = {}): Promise<EmailMessage[]> {
  const conds: string[] = ['m.workspace_id = ?']
  const vals: unknown[] = [WORKSPACE_ID]

  if (filters.account_id) { conds.push('m.account_id = ?');    vals.push(filters.account_id) }
  if (filters.folder)      { conds.push('m.folder = ?');        vals.push(filters.folder) }
  if (filters.only_unread) { conds.push('m.is_read = 0') }
  if (filters.only_starred){ conds.push('m.is_starred = 1') }
  if (filters.search) {
    conds.push('(m.subject LIKE ? OR m.from_address LIKE ? OR m.from_name LIKE ? OR m.body_text LIKE ?)')
    const q = `%${filters.search}%`
    vals.push(q, q, q, q)
  }

  const limit  = filters.limit  ?? 50
  const offset = filters.offset ?? 0
  vals.push(limit, offset)

  return getDb()
    .prepare(
      `SELECT m.* FROM email_messages m
       WHERE ${conds.join(' AND ')}
       ORDER BY m.sent_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...vals) as EmailMessage[]
}

export async function getEmailMessage(id: string): Promise<EmailMessage | null> {
  return (getDb()
    .prepare(`SELECT * FROM email_messages WHERE id = ? AND workspace_id = ?`)
    .get(id, WORKSPACE_ID) as EmailMessage) ?? null
}

export async function getEmailMessageByUid(
  accountId: string,
  uid: number,
  folder: string
): Promise<EmailMessage | null> {
  return (getDb()
    .prepare(`SELECT * FROM email_messages WHERE account_id = ? AND uid = ? AND folder = ?`)
    .get(accountId, uid, folder) as EmailMessage) ?? null
}

export async function upsertEmailMessage(
  msg: Omit<EmailMessage, 'created_at' | 'updated_at'> & { created_at?: number; updated_at?: number }
): Promise<EmailMessage> {
  const now = Date.now()
  getDb().prepare(
    `INSERT INTO email_messages
      (id, account_id, workspace_id, uid, folder, message_id, in_reply_to, thread_refs,
       subject, from_address, from_name, to_addresses, cc_addresses, sent_at,
       body_text, body_html, has_attachments, is_read, is_starred,
       ai_category, ai_summary, linked_quote_id, linked_import_id, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       is_read = excluded.is_read,
       is_starred = excluded.is_starred,
       ai_category = excluded.ai_category,
       ai_summary = excluded.ai_summary,
       linked_quote_id = excluded.linked_quote_id,
       linked_import_id = excluded.linked_import_id,
       updated_at = excluded.updated_at`
  ).run(
    msg.id, msg.account_id, msg.workspace_id, msg.uid, msg.folder,
    msg.message_id, msg.in_reply_to, msg.thread_refs,
    msg.subject, msg.from_address, msg.from_name,
    msg.to_addresses, msg.cc_addresses, msg.sent_at,
    msg.body_text, msg.body_html, msg.has_attachments,
    msg.is_read, msg.is_starred,
    msg.ai_category, msg.ai_summary, msg.linked_quote_id, msg.linked_import_id,
    msg.created_at ?? now, msg.updated_at ?? now
  )
  return (await getEmailMessage(msg.id))!
}

export async function markEmailRead(id: string, isRead: boolean): Promise<void> {
  getDb()
    .prepare(`UPDATE email_messages SET is_read = ?, updated_at = ? WHERE id = ?`)
    .run(isRead ? 1 : 0, Date.now(), id)
}

export async function markEmailStarred(id: string, isStarred: boolean): Promise<void> {
  getDb()
    .prepare(`UPDATE email_messages SET is_starred = ?, updated_at = ? WHERE id = ?`)
    .run(isStarred ? 1 : 0, Date.now(), id)
}

export async function updateEmailAI(
  id: string,
  category: string,
  summary: string
): Promise<void> {
  getDb()
    .prepare(`UPDATE email_messages SET ai_category = ?, ai_summary = ?, updated_at = ? WHERE id = ?`)
    .run(category, summary, Date.now(), id)
}

export async function linkEmailToQuote(id: string, quoteId: string): Promise<void> {
  getDb()
    .prepare(`UPDATE email_messages SET linked_quote_id = ?, updated_at = ? WHERE id = ?`)
    .run(quoteId, Date.now(), id)
}

export async function linkEmailToImport(id: string, importId: string): Promise<void> {
  getDb()
    .prepare(`UPDATE email_messages SET linked_import_id = ?, updated_at = ? WHERE id = ?`)
    .run(importId, Date.now(), id)
}

export async function deleteEmailMessage(id: string): Promise<void> {
  const db = getDb()
  db.prepare(`DELETE FROM email_attachments WHERE message_id = ?`).run(id)
  db.prepare(`DELETE FROM email_messages WHERE id = ?`).run(id)
}

export async function getUnreadCount(accountId: string): Promise<number> {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) as cnt FROM email_messages
       WHERE account_id = ? AND folder = 'INBOX' AND is_read = 0`
    )
    .get(accountId) as { cnt: number } | undefined
  return row?.cnt ?? 0
}

// ── Attachments ───────────────────────────────────────────────────────────────

export async function listEmailAttachments(messageId: string): Promise<EmailAttachment[]> {
  return getDb()
    .prepare(`SELECT * FROM email_attachments WHERE message_id = ? ORDER BY created_at ASC`)
    .all(messageId) as EmailAttachment[]
}

export async function upsertEmailAttachment(
  att: Omit<EmailAttachment, 'created_at'> & { created_at?: number }
): Promise<void> {
  getDb().prepare(
    `INSERT OR IGNORE INTO email_attachments
      (id, message_id, workspace_id, filename, mime_type, size_bytes, local_path, ai_category, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(
    att.id, att.message_id, att.workspace_id,
    att.filename, att.mime_type, att.size_bytes,
    att.local_path, att.ai_category, att.created_at ?? Date.now()
  )
}
