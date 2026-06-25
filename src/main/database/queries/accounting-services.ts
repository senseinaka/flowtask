import { randomUUID } from 'crypto'
import { getPowerSyncDb } from '../powersync'
import type {
  AccountingService,
  AccountingServicePayment,
  AccountingServiceFilters,
  CreateAccountingServiceInput,
  RegisterServicePaymentInput,
  ServiceStatus,
} from '@shared/types'

const WORKSPACE_ID = 'd61a4071-1557-4f32-be5e-6443fb336bf5'

// Columnas editables del servicio (todo menos id/workspace/timestamps/deleted_at).
// El orden no importa porque el INSERT/UPDATE se arma dinámicamente.
const SERVICE_COLUMNS = [
  'name', 'category', 'provider', 'description', 'area', 'internal_owner', 'status',
  'amount', 'currency', 'billing_frequency', 'payment_method', 'auto_renewal', 'requires_approval',
  'start_date', 'last_payment_date', 'next_due_date', 'next_renewal_date', 'decision_deadline_date',
  'contact_name', 'contact_email', 'contact_phone', 'manager_name', 'manager_email', 'manager_phone',
  'document_url', 'provider_portal_url', 'notes',
  'insurance_company', 'policy_number', 'coverage_type', 'insured_asset', 'insured_amount',
  'coverage_start_date', 'coverage_end_date', 'broker_name', 'broker_contact',
] as const

// ─── Servicios ──────────────────────────────────────────────────────────────────

export async function listServices(filters: AccountingServiceFilters = {}): Promise<AccountingService[]> {
  const conditions: string[] = ['workspace_id = ?', 'deleted_at IS NULL']
  const params: unknown[] = [WORKSPACE_ID]

  if (filters.category)          { conditions.push('category = ?');          params.push(filters.category) }
  if (filters.status)            { conditions.push('status = ?');            params.push(filters.status) }
  if (filters.currency)          { conditions.push('currency = ?');          params.push(filters.currency) }
  if (filters.billing_frequency) { conditions.push('billing_frequency = ?'); params.push(filters.billing_frequency) }
  if (filters.auto_renewal !== undefined) { conditions.push('auto_renewal = ?'); params.push(filters.auto_renewal ? 1 : 0) }
  if (filters.internal_owner)    { conditions.push('internal_owner = ?');    params.push(filters.internal_owner) }
  if (filters.search) {
    conditions.push('(name LIKE ? OR provider LIKE ? OR notes LIKE ? OR policy_number LIKE ? OR contact_name LIKE ? OR internal_owner LIKE ?)')
    const s = `%${filters.search}%`
    params.push(s, s, s, s, s, s)
  }

  // Servicios sin fecha de vencimiento al final; el resto por vencimiento más cercano.
  return getPowerSyncDb().getAll<AccountingService>(`
    SELECT * FROM accounting_services
    WHERE ${conditions.join(' AND ')}
    ORDER BY (next_due_date IS NULL OR next_due_date = '') ASC, next_due_date ASC, name ASC
  `, params)
}

export async function getService(id: string): Promise<AccountingService | null> {
  const rows = await getPowerSyncDb().getAll<AccountingService>(
    'SELECT * FROM accounting_services WHERE id = ?', [id]
  )
  return rows[0] ?? null
}

export async function createService(input: CreateAccountingServiceInput): Promise<AccountingService> {
  const id = randomUUID()
  const now = Date.now()
  const cols = ['id', 'workspace_id', ...SERVICE_COLUMNS, 'deleted_at', 'created_at', 'updated_at']
  const vals: unknown[] = [
    id, WORKSPACE_ID,
    ...SERVICE_COLUMNS.map(c => (input as Record<string, unknown>)[c] ?? defaultForColumn(c)),
    null, now, now,
  ]
  const placeholders = cols.map(() => '?').join(', ')
  await getPowerSyncDb().execute(
    `INSERT INTO accounting_services (${cols.join(', ')}) VALUES (${placeholders})`,
    vals
  )
  return (await getService(id))!
}

export async function updateService(
  id: string,
  patch: Partial<CreateAccountingServiceInput>
): Promise<AccountingService> {
  const now = Date.now()
  const keys = SERVICE_COLUMNS.filter(c => c in patch)
  const setClause = [...keys.map(k => `${k} = ?`), 'updated_at = ?'].join(', ')
  const vals: unknown[] = [...keys.map(k => (patch as Record<string, unknown>)[k]), now, id]
  await getPowerSyncDb().execute(
    `UPDATE accounting_services SET ${setClause} WHERE id = ?`,
    vals
  )
  return (await getService(id))!
}

export async function setServiceStatus(id: string, status: ServiceStatus): Promise<void> {
  await getPowerSyncDb().execute(
    'UPDATE accounting_services SET status = ?, updated_at = ? WHERE id = ?',
    [status, Date.now(), id]
  )
}

/** Borrado lógico: marca deleted_at. Las listas filtran deleted_at IS NULL. */
export async function softDeleteService(id: string): Promise<void> {
  const now = Date.now()
  await getPowerSyncDb().execute(
    'UPDATE accounting_services SET deleted_at = ?, updated_at = ? WHERE id = ?',
    [now, now, id]
  )
}

function defaultForColumn(col: string): unknown {
  if (col === 'amount' || col === 'insured_amount' || col === 'auto_renewal' || col === 'requires_approval') return 0
  return ''
}

// ─── Pagos / renovaciones ───────────────────────────────────────────────────────

export async function listServicePayments(serviceId: string): Promise<AccountingServicePayment[]> {
  return getPowerSyncDb().getAll<AccountingServicePayment>(`
    SELECT * FROM accounting_service_payments
    WHERE service_id = ? AND workspace_id = ?
    ORDER BY payment_date DESC, created_at DESC
  `, [serviceId, WORKSPACE_ID])
}

/**
 * Registra un pago y, si se indica next_due_date / next_renewal_date, actualiza
 * el servicio (último pago + próximo vencimiento/renovación) en la misma operación.
 */
export async function registerPayment(
  input: RegisterServicePaymentInput,
  createdBy: string
): Promise<AccountingServicePayment> {
  const psDb = getPowerSyncDb()
  const id = randomUUID()
  const now = Date.now()

  await psDb.execute(`
    INSERT INTO accounting_service_payments
      (id, workspace_id, service_id, payment_date, amount, currency, period_from, period_to,
       payment_method, receipt_url, notes, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id, WORKSPACE_ID, input.service_id, input.payment_date, input.amount, input.currency,
    input.period_from, input.period_to, input.payment_method, input.receipt_url, input.notes,
    createdBy, now, now,
  ])

  const setParts: string[] = ['last_payment_date = ?', 'updated_at = ?']
  const setVals: unknown[] = [input.payment_date, now]
  if (input.next_due_date)     { setParts.push('next_due_date = ?');     setVals.push(input.next_due_date) }
  if (input.next_renewal_date) { setParts.push('next_renewal_date = ?'); setVals.push(input.next_renewal_date) }
  setVals.push(input.service_id)
  await psDb.execute(`UPDATE accounting_services SET ${setParts.join(', ')} WHERE id = ?`, setVals)

  const rows = await psDb.getAll<AccountingServicePayment>(
    'SELECT * FROM accounting_service_payments WHERE id = ?', [id]
  )
  return rows[0]
}

export async function deletePayment(id: string): Promise<void> {
  await getPowerSyncDb().execute('DELETE FROM accounting_service_payments WHERE id = ?', [id])
}
