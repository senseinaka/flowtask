import { getPowerSyncDb } from '../powersync'

const WORKSPACE_ID = 'd61a4071-1557-4f32-be5e-6443fb336bf5'

const DEFAULT_CATEGORIES = [
  { value: 'software',        label: 'Software y SaaS',         sort: 1 },
  { value: 'seguro',          label: 'Seguro',                  sort: 2 },
  { value: 'dominio_hosting', label: 'Dominio o hosting',       sort: 3 },
  { value: 'profesional',     label: 'Servicio profesional',    sort: 4 },
  { value: 'bancario',        label: 'Servicio bancario',       sort: 5 },
  { value: 'administrativo',  label: 'Servicio administrativo', sort: 6 },
  { value: 'mantenimiento',   label: 'Mantenimiento',           sort: 7 },
  { value: 'suscripcion',     label: 'Suscripción',             sort: 8 },
  { value: 'otro',            label: 'Otro',                    sort: 9 },
]

const DEFAULT_PAYMENT_METHODS = [
  { value: 'tarjeta_credito',   label: 'Tarjeta de crédito', sort: 1 },
  { value: 'transferencia',     label: 'Transferencia',       sort: 2 },
  { value: 'debito_automatico', label: 'Débito automático',   sort: 3 },
  { value: 'mercadopago',       label: 'Mercado Pago',        sort: 4 },
  { value: 'paypal',            label: 'PayPal',              sort: 5 },
  { value: 'banco',             label: 'Banco',               sort: 6 },
  { value: 'efectivo',          label: 'Efectivo',            sort: 7 },
  { value: 'otro',              label: 'Otro',                sort: 8 },
]

export interface CatalogRow {
  id: string
  value: string
  label: string
  sort_order: number
}

async function seedDefaults(
  type: string,
  defaults: Array<{ value: string; label: string; sort: number }>
) {
  const psDb = getPowerSyncDb()
  const now = Date.now()
  for (const d of defaults) {
    const id = `catalog-${type}-${d.value}`
    const existing = await psDb.getAll<{ id: string }>('SELECT id FROM service_catalog WHERE id = ?', [id])
    if (existing.length === 0) {
      await psDb.execute(
        `INSERT INTO service_catalog (id, workspace_id, config_type, value, label, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, WORKSPACE_ID, type, d.value, d.label, d.sort, now, now]
      )
    }
  }
}

export async function listCatalog(type: string): Promise<CatalogRow[]> {
  const psDb = getPowerSyncDb()

  if (type === 'category' || type === 'payment_method') {
    const total = await psDb.getAll<{ n: number }>(
      `SELECT COUNT(*) as n FROM service_catalog WHERE workspace_id = ? AND config_type = ?`,
      [WORKSPACE_ID, type]
    )
    if ((total[0]?.n ?? 0) === 0) {
      const defaults = type === 'category' ? DEFAULT_CATEGORIES : DEFAULT_PAYMENT_METHODS
      await seedDefaults(type, defaults)
    }
  }

  return psDb.getAll<CatalogRow>(
    `SELECT id, value, label, sort_order FROM service_catalog
     WHERE workspace_id = ? AND config_type = ? AND (deleted_at IS NULL OR deleted_at = 0)
     ORDER BY sort_order ASC, label ASC`,
    [WORKSPACE_ID, type]
  )
}

export async function upsertCatalogEntry(input: {
  id?: string
  config_type: string
  value: string
  label: string
  sort_order?: number
}): Promise<string> {
  const psDb = getPowerSyncDb()
  const now = Date.now()

  if (input.id) {
    await psDb.execute(
      `UPDATE service_catalog SET label = ?, sort_order = ?, updated_at = ? WHERE id = ?`,
      [input.label, input.sort_order ?? 0, now, input.id]
    )
    return input.id
  }

  const slug = input.value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '') || `item_${now}`

  const id = `catalog-${input.config_type}-${slug}-${now}`
  await psDb.execute(
    `INSERT INTO service_catalog (id, workspace_id, config_type, value, label, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, WORKSPACE_ID, input.config_type, slug, input.label, input.sort_order ?? 99, now, now]
  )
  return id
}

export async function deleteCatalogEntry(id: string): Promise<void> {
  const now = Date.now()
  await getPowerSyncDb().execute(
    `UPDATE service_catalog SET deleted_at = ?, updated_at = ? WHERE id = ?`,
    [now, now, id]
  )
}
