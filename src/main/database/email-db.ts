import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

let _emailDb: Database.Database | null = null

export function getEmailDb(): Database.Database {
  if (_emailDb) return _emailDb

  const userDataPath = app.getPath('userData')
  const dbDir = path.join(userDataPath, 'flowtask')
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })

  const dbPath = path.join(dbDir, 'email.db')
  _emailDb = new Database(dbPath)
  _emailDb.pragma('journal_mode = WAL')
  _emailDb.pragma('foreign_keys = ON')

  runEmailMigrations(_emailDb)

  return _emailDb
}

export function closeEmailDb(): void {
  if (_emailDb) {
    try { _emailDb.close() } catch { /* ignore */ }
    _emailDb = null
  }
}

function runEmailMigrations(db: Database.Database): void {
  const v = (db.pragma('user_version', { simple: true }) as number) || 0

  if (v < 1) {
  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS email_accounts (
        id             TEXT PRIMARY KEY,
        workspace_id   TEXT NOT NULL,
        email          TEXT NOT NULL,
        display_name   TEXT NOT NULL DEFAULT '',
        imap_host      TEXT NOT NULL DEFAULT '',
        imap_port      INTEGER NOT NULL DEFAULT 993,
        imap_secure    INTEGER NOT NULL DEFAULT 1,
        smtp_host      TEXT NOT NULL DEFAULT '',
        smtp_port      INTEGER NOT NULL DEFAULT 465,
        smtp_secure    INTEGER NOT NULL DEFAULT 1,
        username       TEXT NOT NULL DEFAULT '',
        password       TEXT NOT NULL DEFAULT '',
        is_active      INTEGER NOT NULL DEFAULT 1,
        last_uid_inbox INTEGER NOT NULL DEFAULT 0,
        created_at     INTEGER NOT NULL,
        updated_at     INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_email_accounts_workspace
        ON email_accounts(workspace_id);

      CREATE TABLE IF NOT EXISTS email_messages (
        id               TEXT PRIMARY KEY,
        account_id       TEXT NOT NULL,
        workspace_id     TEXT NOT NULL,
        uid              INTEGER NOT NULL,
        folder           TEXT NOT NULL DEFAULT 'INBOX',
        message_id       TEXT NOT NULL DEFAULT '',
        in_reply_to      TEXT NOT NULL DEFAULT '',
        thread_refs      TEXT NOT NULL DEFAULT '',
        subject          TEXT NOT NULL DEFAULT '',
        from_address     TEXT NOT NULL DEFAULT '',
        from_name        TEXT NOT NULL DEFAULT '',
        to_addresses     TEXT NOT NULL DEFAULT '[]',
        cc_addresses     TEXT NOT NULL DEFAULT '[]',
        sent_at          INTEGER NOT NULL,
        body_text        TEXT NOT NULL DEFAULT '',
        body_html        TEXT NOT NULL DEFAULT '',
        has_attachments  INTEGER NOT NULL DEFAULT 0,
        is_read          INTEGER NOT NULL DEFAULT 0,
        is_starred       INTEGER NOT NULL DEFAULT 0,
        ai_category      TEXT NOT NULL DEFAULT '',
        ai_summary       TEXT NOT NULL DEFAULT '',
        linked_quote_id  TEXT NOT NULL DEFAULT '',
        linked_import_id TEXT NOT NULL DEFAULT '',
        created_at       INTEGER NOT NULL,
        updated_at       INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_email_messages_account_folder
        ON email_messages(account_id, folder);
      CREATE INDEX IF NOT EXISTS idx_email_messages_sent_at
        ON email_messages(sent_at DESC);
      CREATE INDEX IF NOT EXISTS idx_email_messages_message_id
        ON email_messages(message_id);
      CREATE INDEX IF NOT EXISTS idx_email_messages_uid
        ON email_messages(account_id, uid);

      CREATE TABLE IF NOT EXISTS email_attachments (
        id           TEXT PRIMARY KEY,
        message_id   TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        filename     TEXT NOT NULL DEFAULT '',
        mime_type    TEXT NOT NULL DEFAULT '',
        size_bytes   INTEGER NOT NULL DEFAULT 0,
        local_path   TEXT NOT NULL DEFAULT '',
        ai_category  TEXT NOT NULL DEFAULT '',
        created_at   INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_email_attachments_message
        ON email_attachments(message_id);
    `)
    db.pragma('user_version = 1')
  })()
    console.log('[EmailDB] Migration v1 applied — email.db ready')
  }

  if (v < 2) {
    db.transaction(() => {
      // Opt-in por cuenta para aceptar certificados TLS inválidos en IMAP.
      // Por defecto 0 (seguro): imapflow valida certificado y hostname.
      db.exec(
        `ALTER TABLE email_accounts
           ADD COLUMN imap_allow_invalid_cert INTEGER NOT NULL DEFAULT 0`
      )
      db.pragma('user_version = 2')
    })()
    console.log('[EmailDB] Migration v2 applied — imap_allow_invalid_cert added')
  }
}
