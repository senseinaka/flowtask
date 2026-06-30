import { ipcMain } from 'electron'
import {
  listEmailAccounts,
  getEmailAccount,
  createEmailAccount,
  updateEmailAccount,
  deleteEmailAccount,
  listEmailMessages,
  getEmailMessage,
  markEmailRead,
  markEmailStarred,
  updateEmailAI,
  linkEmailToQuote,
  linkEmailToImport,
  moveEmailToFolder,
  deleteEmailMessage,
  getUnreadCount,
  listEmailAttachments,
  resetEmailAccountSync
} from '../database/queries/email'
import {
  testImapConnection,
  testImapFetch,
  listImapFolders,
  syncAccount,
  imapMarkRead,
  imapMoveToTrash,
  imapRestoreFromTrash,
  getAttachmentPath
} from '../services/email.service'
import { testSmtpConnection, sendTestEmail, sendEmail } from '../services/email-smtp.service'
import type { CreateEmailAccountInput, EmailListFilters, SendEmailInput } from '@shared/types'

export function registerEmailIpc(): void {
  // ── Accounts ────────────────────────────────────────────────────────────────
  ipcMain.handle('email:accounts:list', async () => listEmailAccounts())
  ipcMain.handle('email:accounts:get', async (_e, id: string) => getEmailAccount(id))
  ipcMain.handle('email:accounts:create', async (_e, data: CreateEmailAccountInput) => createEmailAccount(data))
  ipcMain.handle('email:accounts:update', async (_e, id: string, data: Partial<CreateEmailAccountInput>) =>
    updateEmailAccount(id, data)
  )
  ipcMain.handle('email:accounts:delete', async (_e, id: string) => deleteEmailAccount(id))

  // ── Connection tests ─────────────────────────────────────────────────────────
  ipcMain.handle(
    'email:test:imap',
    async (_e, host: string, port: number, secure: boolean, user: string, pass: string, allowInvalidCert = false) =>
      testImapConnection(host, port, secure, user, pass, allowInvalidCert)
  )
  ipcMain.handle(
    'email:test:smtp',
    async (_e, host: string, port: number, secure: boolean, user: string, pass: string) =>
      testSmtpConnection(host, port, secure, user, pass)
  )
  ipcMain.handle(
    'email:test:fetch',
    async (_e, host: string, port: number, secure: boolean, user: string, pass: string, allowInvalidCert = false) =>
      testImapFetch(host, port, secure, user, pass, allowInvalidCert)
  )
  ipcMain.handle(
    'email:test:send',
    async (_e, host: string, port: number, secure: boolean, user: string, pass: string, toEmail: string, displayName: string) =>
      sendTestEmail(host, port, secure, user, pass, toEmail, displayName)
  )

  // ── Folders ──────────────────────────────────────────────────────────────────
  ipcMain.handle('email:folders:list', async (_e, accountId: string) => {
    const account = await getEmailAccount(accountId)
    if (!account) return []
    return listImapFolders(account)
  })

  // ── Sync ─────────────────────────────────────────────────────────────────────
  ipcMain.handle('email:reset-sync', async (_e, accountId: string) => {
    try {
      await resetEmailAccountSync(accountId)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  })

  ipcMain.handle('email:sync', async (event, accountId: string, folder = 'INBOX') => {
    const account = await getEmailAccount(accountId)
    if (!account) return { ok: false, error: 'Cuenta no encontrada' }
    try {
      await syncAccount(account, folder, (synced, total) => {
        event.sender.send('email:sync:progress', { accountId, synced, total })
      })
      return { ok: true }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  })

  // ── Messages ─────────────────────────────────────────────────────────────────
  ipcMain.handle('email:messages:list', async (_e, filters: EmailListFilters) =>
    listEmailMessages(filters)
  )
  ipcMain.handle('email:messages:get', async (_e, id: string) => getEmailMessage(id))
  ipcMain.handle('email:messages:markRead', async (_e, id: string, isRead: boolean) => {
    await markEmailRead(id, isRead)
    const msg = await getEmailMessage(id)
    if (msg) await imapMarkRead(msg.account_id, msg.uid).catch(() => null)
  })
  ipcMain.handle('email:messages:markStarred', async (_e, id: string, isStarred: boolean) =>
    markEmailStarred(id, isStarred)
  )
  ipcMain.handle('email:messages:updateAI', async (_e, id: string, category: string, summary: string) =>
    updateEmailAI(id, category, summary)
  )
  ipcMain.handle('email:messages:linkQuote', async (_e, id: string, quoteId: string) =>
    linkEmailToQuote(id, quoteId)
  )
  ipcMain.handle('email:messages:linkImport', async (_e, id: string, importId: string) =>
    linkEmailToImport(id, importId)
  )
  ipcMain.handle('email:messages:delete', async (_e, id: string) => {
    const msg = await getEmailMessage(id)
    if (msg && msg.folder !== 'Trash') await imapMoveToTrash(msg.account_id, msg.uid).catch(() => null)
    await moveEmailToFolder(id, 'Trash')
  })
  ipcMain.handle('email:messages:purge', async (_e, id: string) => {
    await deleteEmailMessage(id)
  })
  ipcMain.handle('email:messages:restore', async (_e, id: string) => {
    const msg = await getEmailMessage(id)
    if (msg) await imapRestoreFromTrash(msg.account_id, msg.uid).catch(() => null)
    await moveEmailToFolder(id, 'INBOX')
  })
  ipcMain.handle('email:messages:unreadCount', async (_e, accountId: string) =>
    getUnreadCount(accountId)
  )

  // ── Attachments ──────────────────────────────────────────────────────────────
  ipcMain.handle('email:attachments:list', async (_e, messageId: string) =>
    listEmailAttachments(messageId)
  )
  ipcMain.handle('email:attachments:path', async (_e, localPath: string) =>
    getAttachmentPath(localPath)
  )

  // ── Send ─────────────────────────────────────────────────────────────────────
  ipcMain.handle('email:send', async (_e, input: SendEmailInput) => sendEmail(input))
}
