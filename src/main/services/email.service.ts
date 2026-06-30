import { ImapFlow } from 'imapflow'
import { simpleParser, type ParsedMail } from 'mailparser'
import { randomUUID } from 'crypto'
import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import type { EmailAccount } from '@shared/types'
import { getEmailDb } from '../database/email-db'
import {
  upsertEmailMessage,
  upsertEmailAttachment,
  setLastUidInbox,
  getEmailAccount,
  listEmailAccounts
} from '../database/queries/email'

const ATTACHMENTS_DIR = path.join(app.getPath('userData'), 'email-attachments')

function ensureAttachmentsDir(): void {
  if (!fs.existsSync(ATTACHMENTS_DIR)) fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true })
}

// Opciones base compartidas — timeout nativo de imapflow (no Promise.race)
// Seguro por defecto: imapflow valida certificado y hostname.
// Para aceptar certs autofirmados/mismatch (hosting compartido) hay que
// activar imap_allow_invalid_cert=1 en esa cuenta puntual.
const IMAP_DEFAULTS = {
  logger: false,
  connectionTimeout: 12000,
  greetingTimeout: 8000,
  socketTimeout: 15000
} as const

function tlsOptions(allowInvalidCert: boolean): { rejectUnauthorized: boolean } | undefined {
  return allowInvalidCert ? { rejectUnauthorized: false } : undefined
}

function makeClient(account: EmailAccount): ImapFlow {
  return new ImapFlow({
    host: account.imap_host,
    port: account.imap_port,
    secure: account.imap_secure === 1,
    auth: { user: account.username, pass: account.password },
    tls: tlsOptions(account.imap_allow_invalid_cert === 1),
    ...IMAP_DEFAULTS
  })
}

// ── Connection test ────────────────────────────────────────────────────────────

export async function testImapConnection(
  host: string, port: number, secure: boolean, user: string, pass: string,
  allowInvalidCert = false
): Promise<{ ok: boolean; error?: string; folders?: string[] }> {
  const client = new ImapFlow({ host, port, secure, auth: { user, pass }, tls: tlsOptions(allowInvalidCert), ...IMAP_DEFAULTS })
  try {
    await client.connect()
    const list = await client.list()
    await client.logout()
    return { ok: true, folders: list.map((m) => m.path).slice(0, 15) }
  } catch (e) {
    try { client.close() } catch { /* ignore */ }
    return { ok: false, error: (e as Error).message }
  }
}

export async function testImapFetch(
  host: string, port: number, secure: boolean, user: string, pass: string,
  allowInvalidCert = false
): Promise<{ ok: boolean; error?: string; total?: number; subjects?: string[] }> {
  const client = new ImapFlow({ host, port, secure, auth: { user, pass }, tls: tlsOptions(allowInvalidCert), ...IMAP_DEFAULTS })
  try {
    await client.connect()
    const lock = await client.getMailboxLock('INBOX')
    const subjects: string[] = []
    let total = 0
    try {
      const mb = client.mailbox as { exists?: number } | false
      total = mb && mb.exists != null ? mb.exists : 0
      if (total > 0) {
        const from = Math.max(1, total - 2)
        for await (const msg of client.fetch(`${from}:${total}`, { envelope: true })) {
          subjects.unshift((msg.envelope as { subject?: string })?.subject ?? '(sin asunto)')
        }
      }
    } finally {
      lock.release()
    }
    await client.logout()
    return { ok: true, total, subjects }
  } catch (e) {
    try { client.close() } catch { /* ignore */ }
    return { ok: false, error: (e as Error).message }
  }
}

// ── List IMAP folders ──────────────────────────────────────────────────────────

export async function listImapFolders(account: EmailAccount): Promise<string[]> {
  const client = makeClient(account)
  try {
    await client.connect()
    const list = await client.list()
    await client.logout()
    return list.map((m) => m.path)
  } catch {
    return []
  }
}

// ── Sync folder ───────────────────────────────────────────────────────────────

export async function syncFolder(
  account: EmailAccount,
  folder = 'INBOX',
  sinceUid = 0,   // 0 = primer sync (usa secuencia), >0 = incremental por UID
  onProgress?: (synced: number, total: number) => void
): Promise<number> {
  ensureAttachmentsDir()
  const client = makeClient(account)
  let synced = 0

  try {
    await client.connect()
    const lock = await client.getMailboxLock(folder)
    try {
      const mb = client.mailbox as { exists?: number } | false
      const total = (mb && mb.exists != null) ? mb.exists : 0
      if (total === 0) return 0

      // Primer sync: obtener los últimos 500 mensajes por número de secuencia
      // Incremental: obtener mensajes con UID > sinceUid (UID-based)
      let fetchIter: AsyncIterable<{ uid: number; source?: Buffer; flags?: Set<string> }>
      let estimatedTotal: number
      if (sinceUid === 0) {
        const from = Math.max(1, total - 499)
        estimatedTotal = total - from + 1
        fetchIter = client.fetch(`${from}:${total}`, { source: true, uid: true, flags: true })
      } else {
        estimatedTotal = total
        fetchIter = client.fetch(`${sinceUid + 1}:*`, { source: true, uid: true, flags: true }, { uid: true })
      }

      const db = getEmailDb()
      const checkExisting = db.prepare(
        'SELECT id FROM email_messages WHERE account_id = ? AND uid = ? AND folder = ?'
      )
      let maxUid = account.last_uid_inbox ?? 0

      for await (const msg of fetchIter) {
        try {
          if (!msg.source) continue

          // Deduplicación: saltar mensajes ya sincronizados
          const existing = checkExisting.get(account.id, msg.uid, folder) as { id: string } | undefined
          if (existing) continue

          const parsed: ParsedMail = await new Promise((resolve, reject) => {
            simpleParser(msg.source as Buffer, (err, mail) => {
              if (err) reject(err)
              else resolve(mail)
            })
          })
          const uid = msg.uid
          const msgId = randomUUID()
          const now = Date.now()

          const toAddrs = (parsed.to
            ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]).flatMap((a) => a.value)
            : [])
          const ccAddrs = (parsed.cc
            ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc]).flatMap((a) => a.value)
            : [])

          const fromVal = parsed.from?.value?.[0]

          const savedMsg = await upsertEmailMessage({
            id: msgId,
            account_id: account.id,
            workspace_id: account.workspace_id,
            uid,
            folder,
            message_id: parsed.messageId ?? '',
            in_reply_to: (parsed.inReplyTo as string) ?? '',
            thread_refs: Array.isArray(parsed.references)
              ? parsed.references.join(' ')
              : (parsed.references as string) ?? '',
            subject: parsed.subject ?? '(sin asunto)',
            from_address: fromVal?.address ?? '',
            from_name: fromVal?.name ?? fromVal?.address ?? '',
            to_addresses: JSON.stringify(toAddrs.map((a) => ({ name: a.name ?? '', email: a.address ?? '' }))),
            cc_addresses: JSON.stringify(ccAddrs.map((a) => ({ name: a.name ?? '', email: a.address ?? '' }))),
            sent_at: parsed.date?.getTime() ?? now,
            body_text: parsed.text ?? '',
            body_html: parsed.html || '',
            has_attachments: (parsed.attachments?.length ?? 0) > 0 ? 1 : 0,
            is_read: msg.flags?.has('\\Seen') ? 1 : 0,
            is_starred: msg.flags?.has('\\Flagged') ? 1 : 0,
            ai_category: '',
            ai_summary: '',
            linked_quote_id: '',
            linked_import_id: '',
            created_at: now,
            updated_at: now
          })

          for (const att of parsed.attachments ?? []) {
            if (!att.filename) continue
            const attId = randomUUID()
            const ext = path.extname(att.filename)
            const localPath = path.join(ATTACHMENTS_DIR, `${attId}${ext}`)
            fs.writeFileSync(localPath, att.content)
            await upsertEmailAttachment({
              id: attId,
              message_id: savedMsg.id,
              workspace_id: account.workspace_id,
              filename: att.filename,
              mime_type: att.contentType,
              size_bytes: att.size,
              local_path: localPath,
              ai_category: '',
              created_at: now
            })
          }

          if (uid > maxUid) maxUid = uid
          synced++
          onProgress?.(synced, estimatedTotal)
        } catch {
          // skip malformed messages
        }
      }

      // Actualizar last_uid_inbox una sola vez al terminar
      if (folder === 'INBOX' && maxUid > (account.last_uid_inbox ?? 0)) {
        await setLastUidInbox(account.id, maxUid)
        account.last_uid_inbox = maxUid
      }
    } finally {
      lock.release()
    }
    await client.logout()
  } catch (e) {
    console.error('[Email] syncFolder error:', e)
  }

  return synced
}

// ── Sync initial (first 50) + incremental ─────────────────────────────────────

function getLastUidForFolder(accountId: string, folder: string): number {
  const row = getEmailDb()
    .prepare('SELECT COALESCE(MAX(uid), 0) as max_uid FROM email_messages WHERE account_id = ? AND folder = ?')
    .get(accountId, folder) as { max_uid: number }
  return row?.max_uid ?? 0
}

export async function syncAccount(
  account: EmailAccount,
  folder = 'INBOX',
  onProgress?: (synced: number, total: number) => void
): Promise<void> {
  if (folder === 'INBOX') {
    const sinceUid = account.last_uid_inbox > 0 ? account.last_uid_inbox : 0
    await syncFolder(account, 'INBOX', sinceUid, onProgress)
  } else {
    const lastKnown = getLastUidForFolder(account.id, folder)
    await syncFolder(account, folder, lastKnown, onProgress)
  }
}

// ── Sync all active accounts ───────────────────────────────────────────────────

export async function syncAllAccounts(): Promise<void> {
  const accounts = await listEmailAccounts()
  for (const acc of accounts.filter((a) => a.is_active)) {
    await syncAccount(acc)
  }
}

// ── Mark read on IMAP server ───────────────────────────────────────────────────

export async function imapMarkRead(accountId: string, uid: number): Promise<void> {
  const account = await getEmailAccount(accountId)
  if (!account) return
  const client = makeClient(account)
  try {
    await client.connect()
    const lock = await client.getMailboxLock('INBOX')
    try {
      await client.messageFlagsAdd({ uid }, ['\\Seen'])
    } finally {
      lock.release()
    }
    await client.logout()
  } catch (e) {
    console.error('[Email] imapMarkRead error:', e)
  }
}

// ── Move to Trash ──────────────────────────────────────────────────────────────

export async function imapMoveToTrash(accountId: string, uid: number): Promise<void> {
  const account = await getEmailAccount(accountId)
  if (!account) return
  const client = makeClient(account)
  try {
    await client.connect()
    const lock = await client.getMailboxLock('INBOX')
    try {
      await client.messageMove({ uid }, 'Trash')
    } catch {
      await client.messageFlagsAdd({ uid }, ['\\Deleted'])
    } finally {
      lock.release()
    }
    await client.logout()
  } catch (e) {
    console.error('[Email] imapMoveToTrash error:', e)
  }
}

// ── Restore from Trash ────────────────────────────────────────────────────────

export async function imapRestoreFromTrash(accountId: string, uid: number): Promise<void> {
  const account = await getEmailAccount(accountId)
  if (!account) return
  const client = makeClient(account)
  try {
    await client.connect()
    const lock = await client.getMailboxLock('Trash')
    try {
      await client.messageMove({ uid }, 'INBOX')
    } catch {
      // ignore — message may not exist on server yet
    } finally {
      lock.release()
    }
    await client.logout()
  } catch (e) {
    console.error('[Email] imapRestoreFromTrash error:', e)
  }
}

// ── Download attachment bytes ──────────────────────────────────────────────────

export function getAttachmentPath(localPath: string): string | null {
  return fs.existsSync(localPath) ? localPath : null
}

// ── Background auto-sync (every 5 min) ────────────────────────────────────────

let syncTimer: NodeJS.Timeout | null = null

export function startEmailAutoSync(): void {
  if (syncTimer) return
  syncAllAccounts().catch(console.error)
  syncTimer = setInterval(() => {
    syncAllAccounts().catch(console.error)
  }, 5 * 60 * 1000)
}

export function stopEmailAutoSync(): void {
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null }
}
