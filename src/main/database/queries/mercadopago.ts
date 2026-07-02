import { randomUUID } from 'crypto'
import { getDb } from '../db'
import { getPowerSyncDb } from '../powersync'
import { encryptToken, decryptToken } from '../../services/mercadopago-crypto.service'
import type {
  MpConnection,
  MpConnectionWithCreds,
  MpReportJob,
  MpReportFile,
  MpTransaction,
  MpJobStatus,
  MpTransactionFilters,
  CreateMpConnectionInput,
} from '@shared/types'

const WORKSPACE_ID = 'd61a4071-1557-4f32-be5e-6443fb336bf5'

// ─── Connections (PowerSync) ──────────────────────────────────────────────────

export async function listConnections(): Promise<MpConnectionWithCreds[]> {
  const psDb = getPowerSyncDb()
  const db = getDb()

  const connections = await psDb.getAll<MpConnection>(`
    SELECT * FROM mercadopago_connections
    WHERE workspace_id = ?
    ORDER BY created_at DESC
  `, [WORKSPACE_ID])

  return connections.map(c => {
    const cred = db.prepare(
      'SELECT id FROM mercadopago_credentials WHERE connection_id = ? AND encrypted_access_token != ?'
    ).get(c.id, '') as { id: string } | null
    return { ...c, has_token: !!cred }
  })
}

export async function getConnection(id: string): Promise<MpConnection | null> {
  const rows = await getPowerSyncDb().getAll<MpConnection>(
    'SELECT * FROM mercadopago_connections WHERE id = ?',
    [id]
  )
  return rows[0] ?? null
}

export async function createConnection(
  input: CreateMpConnectionInput,
  createdBy: string
): Promise<MpConnection> {
  const psDb = getPowerSyncDb()
  const id = randomUUID()
  const now = Date.now()

  await psDb.execute(`
    INSERT INTO mercadopago_connections
      (id, workspace_id, name, account_label, mercadopago_user_id, environment, auth_type, status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, '', ?, 'access_token', 'active', ?, ?, ?)
  `, [id, WORKSPACE_ID, input.name, input.account_label, input.environment, createdBy, now, now])

  saveAccessToken(id, input.access_token)

  return (await getConnection(id))!
}

export async function createOAuthConnection(
  name: string,
  accountLabel: string,
  environment: 'production' | 'sandbox',
  mercadopagoUserId: string,
  createdBy: string
): Promise<MpConnection> {
  const psDb = getPowerSyncDb()
  const id = randomUUID()
  const now = Date.now()

  await psDb.execute(`
    INSERT INTO mercadopago_connections
      (id, workspace_id, name, account_label, mercadopago_user_id, environment, auth_type, status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'oauth', 'active', ?, ?, ?)
  `, [id, WORKSPACE_ID, name, accountLabel, mercadopagoUserId, environment, createdBy, now, now])

  return (await getConnection(id))!
}

export async function updateConnectionStatus(
  id: string,
  status: MpConnection['status'],
  userId?: string,
  lastSyncAt?: number
): Promise<void> {
  await getPowerSyncDb().execute(`
    UPDATE mercadopago_connections
    SET status = ?, last_sync_at = COALESCE(?, last_sync_at), mercadopago_user_id = COALESCE(?, mercadopago_user_id), updated_at = ?
    WHERE id = ?
  `, [status, lastSyncAt ?? null, userId ?? null, Date.now(), id])
}

export async function deleteConnection(id: string): Promise<void> {
  getDb().prepare('DELETE FROM mercadopago_credentials WHERE connection_id = ?').run(id)
  await getPowerSyncDb().execute('DELETE FROM mercadopago_connections WHERE id = ?', [id])
}

// ─── Credentials (flowtask.db local, per-device) ──────────────────────────────

export function saveAccessToken(connectionId: string, plainToken: string): void {
  const db = getDb()
  const now = Date.now()
  const existing = db.prepare('SELECT id FROM mercadopago_credentials WHERE connection_id = ?').get(connectionId) as { id: string } | null
  const encrypted = encryptToken(plainToken)

  if (existing) {
    db.prepare(`
      UPDATE mercadopago_credentials
      SET encrypted_access_token = ?, updated_at = ?
      WHERE connection_id = ?
    `).run(encrypted, now, connectionId)
  } else {
    db.prepare(`
      INSERT INTO mercadopago_credentials
        (id, workspace_id, connection_id, encrypted_access_token, encrypted_refresh_token, client_id, client_secret_reference, scopes, created_at, updated_at)
      VALUES (?, ?, ?, ?, '', '', '', '', ?, ?)
    `).run(randomUUID(), WORKSPACE_ID, connectionId, encrypted, now, now)
  }
}

export function getAccessToken(connectionId: string): string | null {
  const row = getDb().prepare(
    'SELECT encrypted_access_token FROM mercadopago_credentials WHERE connection_id = ?'
  ).get(connectionId) as { encrypted_access_token: string } | null
  if (!row?.encrypted_access_token) return null
  try {
    return decryptToken(row.encrypted_access_token)
  } catch {
    return null
  }
}

export function saveOAuthTokens(connectionId: string, accessToken: string, refreshToken: string): void {
  const db = getDb()
  const now = Date.now()
  const existing = db.prepare('SELECT id FROM mercadopago_credentials WHERE connection_id = ?').get(connectionId) as { id: string } | null
  const encAccess  = encryptToken(accessToken)
  const encRefresh = encryptToken(refreshToken)

  if (existing) {
    db.prepare(`
      UPDATE mercadopago_credentials
      SET encrypted_access_token = ?, encrypted_refresh_token = ?, updated_at = ?
      WHERE connection_id = ?
    `).run(encAccess, encRefresh, now, connectionId)
  } else {
    db.prepare(`
      INSERT INTO mercadopago_credentials
        (id, workspace_id, connection_id, encrypted_access_token, encrypted_refresh_token, client_id, client_secret_reference, scopes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, '', '', '', ?, ?)
    `).run(randomUUID(), WORKSPACE_ID, connectionId, encAccess, encRefresh, now, now)
  }
}

export function getRefreshToken(connectionId: string): string | null {
  const row = getDb().prepare(
    'SELECT encrypted_refresh_token FROM mercadopago_credentials WHERE connection_id = ?'
  ).get(connectionId) as { encrypted_refresh_token: string } | null
  if (!row?.encrypted_refresh_token) return null
  try {
    return decryptToken(row.encrypted_refresh_token)
  } catch {
    return null
  }
}

// ─── Report Jobs (PowerSync) ──────────────────────────────────────────────────

export async function listJobs(connectionId: string, limit = 50): Promise<MpReportJob[]> {
  return getPowerSyncDb().getAll<MpReportJob>(`
    SELECT * FROM mercadopago_report_jobs
    WHERE connection_id = ? AND workspace_id = ?
    ORDER BY created_at DESC LIMIT ?
  `, [connectionId, WORKSPACE_ID, limit])
}

export async function getJob(id: string): Promise<MpReportJob | null> {
  const rows = await getPowerSyncDb().getAll<MpReportJob>(
    'SELECT * FROM mercadopago_report_jobs WHERE id = ?',
    [id]
  )
  return rows[0] ?? null
}

export async function listPendingJobs(): Promise<MpReportJob[]> {
  return getPowerSyncDb().getAll<MpReportJob>(`
    SELECT * FROM mercadopago_report_jobs
    WHERE workspace_id = ? AND status IN ('requested', 'ready_to_download', 'downloading')
    ORDER BY created_at ASC
  `, [WORKSPACE_ID])
}

export async function createJob(
  connectionId: string,
  dateFrom: string,
  dateTo: string,
  requestedBy: string,
  createdFrom = 'manual'
): Promise<MpReportJob> {
  const id = randomUUID()
  const now = Date.now()
  await getPowerSyncDb().execute(`
    INSERT INTO mercadopago_report_jobs
      (id, workspace_id, connection_id, report_type, date_from, date_to, status, created_from, requested_by, created_at, updated_at)
    VALUES (?, ?, ?, 'settlement', ?, ?, 'pending', ?, ?, ?, ?)
  `, [id, WORKSPACE_ID, connectionId, dateFrom, dateTo, createdFrom, requestedBy, now, now])
  return (await getJob(id))!
}

export async function updateJobStatus(
  id: string,
  status: MpJobStatus,
  extras: { file_name?: string; error_message?: string } = {}
): Promise<void> {
  const now = Date.now()
  const requested_at = status === 'requested' ? now : null
  const downloaded_at = status === 'downloading' ? now : null
  const processed_at = (status === 'completed' || status === 'failed') ? now : null

  await getPowerSyncDb().execute(`
    UPDATE mercadopago_report_jobs
    SET status = ?,
        file_name      = COALESCE(?, file_name),
        error_message  = COALESCE(?, error_message),
        requested_at   = COALESCE(?, requested_at),
        downloaded_at  = COALESCE(?, downloaded_at),
        processed_at   = COALESCE(?, processed_at),
        updated_at     = ?
    WHERE id = ?
  `, [
    status,
    extras.file_name ?? null,
    extras.error_message ?? null,
    requested_at,
    downloaded_at,
    processed_at,
    now,
    id,
  ])
}

// ─── Report Files (PowerSync) ─────────────────────────────────────────────────

export async function upsertReportFile(data: {
  id: string
  connection_id: string
  job_id: string
  file_name: string
  file_hash: string
  raw_file_path: string
  total_rows: number
  imported_rows: number
  duplicated_rows: number
  error_rows: number
}): Promise<void> {
  const psDb = getPowerSyncDb()
  const now = Date.now()

  const existing = await psDb.getAll<{ id: string }>(
    'SELECT id FROM mercadopago_report_files WHERE file_hash = ?',
    [data.file_hash]
  )

  if (existing[0]) {
    await psDb.execute(
      'UPDATE mercadopago_report_files SET imported_rows = ?, duplicated_rows = ?, error_rows = ?, updated_at = ? WHERE id = ?',
      [data.imported_rows, data.duplicated_rows, data.error_rows, now, existing[0].id]
    )
  } else {
    await psDb.execute(`
      INSERT INTO mercadopago_report_files
        (id, workspace_id, connection_id, job_id, file_name, file_hash, raw_file_path, total_rows, imported_rows, duplicated_rows, error_rows, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.id, WORKSPACE_ID, data.connection_id, data.job_id,
      data.file_name, data.file_hash, data.raw_file_path,
      data.total_rows, data.imported_rows, data.duplicated_rows, data.error_rows,
      now, now,
    ])
  }
}

export async function getReportFileByHash(hash: string): Promise<MpReportFile | null> {
  const rows = await getPowerSyncDb().getAll<MpReportFile>(
    'SELECT * FROM mercadopago_report_files WHERE file_hash = ?',
    [hash]
  )
  return rows[0] ?? null
}

// ─── Transactions (PowerSync) ─────────────────────────────────────────────────

export async function insertTransactionsBatch(
  rows: Omit<MpTransaction, 'id' | 'created_at' | 'updated_at'>[]
): Promise<{ imported: number; duplicated: number }> {
  if (rows.length === 0) return { imported: 0, duplicated: 0 }

  const psDb = getPowerSyncDb()
  const now = Date.now()

  // Pre-filter: check which hashes already exist
  const batchHashes = rows.map(r => r.raw_hash)
  const placeholders = batchHashes.map(() => '?').join(', ')
  const existingRows = await psDb.getAll<{ raw_hash: string }>(
    `SELECT raw_hash FROM mercadopago_transactions WHERE raw_hash IN (${placeholders})`,
    batchHashes
  )
  const existingSet = new Set(existingRows.map(r => r.raw_hash))
  const newRows = rows.filter(r => !existingSet.has(r.raw_hash))
  const duplicated = rows.length - newRows.length

  if (newRows.length > 0) {
    await psDb.writeTransaction(async (tx) => {
      for (const r of newRows) {
        await tx.execute(`
          INSERT INTO mercadopago_transactions
            (id, workspace_id, connection_id, report_file_id, source_id, external_reference,
             transaction_date, transaction_type, transaction_amount, transaction_currency,
             settlement_net_amount, settlement_date, fee_amount, taxes_amount,
             payment_method, payment_method_type, installments, description,
             money_release_date, payer_name, payer_id_type, payer_id_number,
             order_id, store_id, store_name, pos_id, pos_name, shipping_id,
             last_four_digits, authorization_code, application_id,
             raw_row_json, raw_hash, reconciliation_status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
        `, [
          randomUUID(), r.workspace_id, r.connection_id, r.report_file_id,
          r.source_id, r.external_reference,
          r.transaction_date, r.transaction_type, r.transaction_amount, r.transaction_currency,
          r.settlement_net_amount, r.settlement_date, r.fee_amount, r.taxes_amount,
          r.payment_method, r.payment_method_type, r.installments, r.description,
          r.money_release_date, r.payer_name, r.payer_id_type, r.payer_id_number,
          r.order_id, r.store_id, r.store_name, r.pos_id, r.pos_name, r.shipping_id,
          r.last_four_digits, r.authorization_code, r.application_id,
          r.raw_row_json, r.raw_hash,
          now, now,
        ])
      }
    })
  }

  return { imported: newRows.length, duplicated }
}

export async function listTransactions(filters: MpTransactionFilters): Promise<MpTransaction[]> {
  const conditions: string[] = ['workspace_id = ?']
  const params: unknown[] = [WORKSPACE_ID]

  if (filters.connection_id)        { conditions.push('connection_id = ?');           params.push(filters.connection_id) }
  if (filters.transaction_type)     { conditions.push('transaction_type = ?');         params.push(filters.transaction_type) }
  if (filters.reconciliation_status){ conditions.push('reconciliation_status = ?');    params.push(filters.reconciliation_status) }
  if (filters.date_from)            { conditions.push('transaction_date >= ?');         params.push(filters.date_from) }
  if (filters.date_to)              { conditions.push('transaction_date <= ?');         params.push(filters.date_to) }
  if (filters.external_reference)   { conditions.push('external_reference LIKE ?');    params.push(`%${filters.external_reference}%`) }
  if (filters.search) {
    conditions.push('(source_id LIKE ? OR external_reference LIKE ? OR payer_name LIKE ? OR description LIKE ?)')
    const s = `%${filters.search}%`
    params.push(s, s, s, s)
  }

  const limit = filters.limit ?? 200
  const offset = filters.offset ?? 0
  params.push(limit, offset)

  return getPowerSyncDb().getAll<MpTransaction>(`
    SELECT * FROM mercadopago_transactions
    WHERE ${conditions.join(' AND ')}
    ORDER BY transaction_date DESC
    LIMIT ? OFFSET ?
  `, params as unknown[])
}

export async function updateTransactionReconStatus(
  id: string,
  status: MpTransaction['reconciliation_status']
): Promise<void> {
  await getPowerSyncDb().execute(
    'UPDATE mercadopago_transactions SET reconciliation_status = ?, updated_at = ? WHERE id = ?',
    [status, Date.now(), id]
  )
}

export async function getTransactionStats(connectionId: string): Promise<{
  total: number
  by_type: { transaction_type: string; count: number; total_amount: number }[]
  by_recon: { reconciliation_status: string; count: number }[]
}> {
  const psDb = getPowerSyncDb()

  const [totRow] = await psDb.getAll<{ n: number }>(
    'SELECT COUNT(*) as n FROM mercadopago_transactions WHERE connection_id = ? AND workspace_id = ?',
    [connectionId, WORKSPACE_ID]
  )

  const by_type = await psDb.getAll<{ transaction_type: string; count: number; total_amount: number }>(`
    SELECT transaction_type, COUNT(*) as count, SUM(settlement_net_amount) as total_amount
    FROM mercadopago_transactions
    WHERE connection_id = ? AND workspace_id = ?
    GROUP BY transaction_type ORDER BY count DESC
  `, [connectionId, WORKSPACE_ID])

  const by_recon = await psDb.getAll<{ reconciliation_status: string; count: number }>(`
    SELECT reconciliation_status, COUNT(*) as count
    FROM mercadopago_transactions
    WHERE connection_id = ? AND workspace_id = ?
    GROUP BY reconciliation_status
  `, [connectionId, WORKSPACE_ID])

  return { total: totRow?.n ?? 0, by_type, by_recon }
}
