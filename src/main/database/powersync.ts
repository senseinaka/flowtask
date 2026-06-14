import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { getDb } from './db'
import { getSession } from '../services/auth.service'
import { PowerSyncDatabase } from '@powersync/node'
import {
  Schema,
  Table,
  column,
  UpdateType,
  type AbstractPowerSyncDatabase,
  type PowerSyncBackendConnector,
  type SyncStatus
} from '@powersync/common'
import type { PowerSyncStatusInfo } from '@shared/types'

const projects = new Table(
  {
    name: column.text,
    color: column.text,
    created_at: column.integer,
    updated_at: column.integer,
    workspace_id: column.text
  },
  { indexes: { workspace: ['workspace_id'] } }
)

const tasks = new Table(
  {
    project_id: column.text,
    title: column.text,
    description: column.text,
    status: column.text,
    priority: column.integer,
    due_date: column.integer,
    due_time: column.text,
    completed_at: column.integer,
    created_at: column.integer,
    updated_at: column.integer,
    synced_at: column.integer,
    drive_file_id: column.text,
    workspace_id: column.text
  },
  { indexes: { workspace: ['workspace_id'], status: ['status'] } }
)

const task_dependencies = new Table(
  {
    task_id: column.text,
    depends_on_id: column.text,
    created_at: column.integer,
    workspace_id: column.text
  },
  { indexes: { workspace: ['workspace_id'] } }
)

const user_permissions = new Table(
  {
    user_id: column.text,
    module_key: column.text,
    submodule_key: column.text,
    level: column.text,
    created_at: column.integer,
    updated_at: column.integer,
    workspace_id: column.text
  },
  { indexes: { user: ['user_id'] } }
)

// ── Fase 3 (sync multi-dispositivo): Finanzas personales y de empresa ──────
// Mismo shape para finance_* y company_finance_* (14 tablas).

const financeAccountLikeColumns = {
  name: column.text,
  icon: column.text,
  color: column.text,
  is_default: column.integer,
  created_at: column.integer,
  updated_at: column.integer,
  workspace_id: column.text
}

const finance_accounts = new Table(financeAccountLikeColumns, { indexes: { workspace: ['workspace_id'] } })
const finance_categories = new Table(financeAccountLikeColumns, { indexes: { workspace: ['workspace_id'] } })
const finance_payment_methods = new Table(financeAccountLikeColumns, { indexes: { workspace: ['workspace_id'] } })
const company_finance_accounts = new Table(financeAccountLikeColumns, { indexes: { workspace: ['workspace_id'] } })
const company_finance_categories = new Table(financeAccountLikeColumns, { indexes: { workspace: ['workspace_id'] } })
const company_finance_payment_methods = new Table(financeAccountLikeColumns, { indexes: { workspace: ['workspace_id'] } })

const financeConceptColumns = {
  category_id: column.text,
  account_id: column.text,
  name: column.text,
  default_amount: column.real,
  expense_type: column.text,
  payment_method: column.text,
  recurrence: column.text,
  recurrence_month: column.integer,
  tracks_multiple_entries: column.integer,
  is_active: column.integer,
  notes: column.text,
  created_at: column.integer,
  updated_at: column.integer,
  workspace_id: column.text
}

const finance_concepts = new Table(financeConceptColumns, {
  indexes: { workspace: ['workspace_id'], category: ['category_id'], account: ['account_id'] }
})
const company_finance_concepts = new Table(financeConceptColumns, {
  indexes: { workspace: ['workspace_id'], category: ['category_id'], account: ['account_id'] }
})

const financeMovementColumns = {
  concept_id: column.text,
  month: column.integer,
  year: column.integer,
  amount_estimated: column.real,
  amount_actual: column.real,
  status: column.text,
  payment_method: column.text,
  payment_date: column.integer,
  due_date: column.integer,
  notes: column.text,
  created_at: column.integer,
  updated_at: column.integer,
  workspace_id: column.text
}

const finance_movements = new Table(financeMovementColumns, {
  indexes: { workspace: ['workspace_id'], concept: ['concept_id'], period: ['year', 'month'] }
})
const company_finance_movements = new Table(financeMovementColumns, {
  indexes: { workspace: ['workspace_id'], concept: ['concept_id'], period: ['year', 'month'] }
})

const financeMovementEntryColumns = {
  movement_id: column.text,
  amount: column.real,
  entry_date: column.integer,
  note: column.text,
  created_at: column.integer,
  updated_at: column.integer,
  workspace_id: column.text
}

const finance_movement_entries = new Table(financeMovementEntryColumns, {
  indexes: { workspace: ['workspace_id'], movement: ['movement_id'] }
})
const company_finance_movement_entries = new Table(financeMovementEntryColumns, {
  indexes: { workspace: ['workspace_id'], movement: ['movement_id'] }
})

const financeMonthInsightColumns = {
  month: column.integer,
  year: column.integer,
  notes: column.text,
  ai_analysis: column.text,
  ai_generated_at: column.integer,
  created_at: column.integer,
  updated_at: column.integer,
  workspace_id: column.text
}

const finance_month_insights = new Table(financeMonthInsightColumns, {
  indexes: { workspace: ['workspace_id'], period: ['year', 'month'] }
})
const company_finance_month_insights = new Table(financeMonthInsightColumns, {
  indexes: { workspace: ['workspace_id'], period: ['year', 'month'] }
})

// ── Fase 4 (sync multi-dispositivo): Comex, sub-dominio "maestros" ─────────
// Proveedores, operadores logísticos, gestores, despachantes y marcas.

const comex_suppliers = new Table(
  {
    name: column.text,
    country: column.text,
    contact_name: column.text,
    contact_email: column.text,
    contact_phone: column.text,
    website: column.text,
    payment_terms: column.text,
    notes: column.text,
    address: column.text,
    city: column.text,
    zip_code: column.text,
    tax_id: column.text,
    rex_number: column.text,
    wechat: column.text,
    product_categories: column.text,
    incoterms_preferred: column.text,
    port_of_origin: column.text,
    lead_time_days: column.integer,
    pickup_address: column.text,
    brand: column.text,
    logo_stored_name: column.text,
    production_days: column.integer,
    preparation_days: column.integer,
    transit_days: column.integer,
    customs_days: column.integer,
    local_delivery_days: column.integer,
    moq: column.integer,
    non_operational_periods_json: column.text,
    reliability_notes: column.text,
    created_at: column.integer,
    updated_at: column.integer,
    workspace_id: column.text
  },
  { indexes: { workspace: ['workspace_id'] } }
)

const comex_supplier_contacts = new Table(
  {
    supplier_id: column.text,
    role: column.text,
    name: column.text,
    position: column.text,
    email: column.text,
    phone: column.text,
    whatsapp: column.text,
    notes: column.text,
    sort_order: column.integer,
    created_at: column.integer,
    updated_at: column.integer,
    workspace_id: column.text
  },
  { indexes: { workspace: ['workspace_id'], supplier: ['supplier_id'] } }
)

const comex_supplier_bank_accounts = new Table(
  {
    supplier_id: column.text,
    bank_name: column.text,
    beneficiary_name: column.text,
    account_number: column.text,
    swift_bic: column.text,
    iban: column.text,
    routing_number: column.text,
    currency: column.text,
    bank_address: column.text,
    notes: column.text,
    created_at: column.integer,
    updated_at: column.integer,
    workspace_id: column.text
  },
  { indexes: { workspace: ['workspace_id'], supplier: ['supplier_id'] } }
)

const comex_freight_operators = new Table(
  {
    name: column.text,
    company_type: column.text,
    contact_name: column.text,
    email: column.text,
    phone: column.text,
    whatsapp: column.text,
    services: column.text,
    notes: column.text,
    logo_stored_name: column.text,
    created_at: column.integer,
    updated_at: column.integer,
    workspace_id: column.text
  },
  { indexes: { workspace: ['workspace_id'] } }
)

const comex_freight_operator_contacts = new Table(
  {
    operator_id: column.text,
    name: column.text,
    role: column.text,
    email: column.text,
    phone: column.text,
    nickname: column.text,
    sort_order: column.integer,
    created_at: column.integer,
    updated_at: column.integer,
    workspace_id: column.text
  },
  { indexes: { workspace: ['workspace_id'], operator: ['operator_id'] } }
)

const comex_gestores = new Table(
  {
    name: column.text,
    estudio: column.text,
    cuit: column.text,
    email: column.text,
    phone: column.text,
    whatsapp: column.text,
    especialidades: column.text,
    notas: column.text,
    website: column.text,
    direccion: column.text,
    phone_empresa: column.text,
    logo_stored_name: column.text,
    created_at: column.integer,
    updated_at: column.integer,
    workspace_id: column.text
  },
  { indexes: { workspace: ['workspace_id'] } }
)

const comex_gestor_contacts = new Table(
  {
    gestor_id: column.text,
    name: column.text,
    role: column.text,
    email: column.text,
    phone: column.text,
    sort_order: column.integer,
    created_at: column.integer,
    updated_at: column.integer,
    workspace_id: column.text
  },
  { indexes: { workspace: ['workspace_id'], gestor: ['gestor_id'] } }
)

const comex_despachantes = new Table(
  {
    name: column.text,
    matricula: column.text,
    empresa: column.text,
    cuit: column.text,
    email: column.text,
    phone: column.text,
    whatsapp: column.text,
    notas: column.text,
    website: column.text,
    direccion: column.text,
    phone_empresa: column.text,
    logo_stored_name: column.text,
    created_at: column.integer,
    updated_at: column.integer,
    workspace_id: column.text
  },
  { indexes: { workspace: ['workspace_id'] } }
)

const comex_despachante_contacts = new Table(
  {
    despachante_id: column.text,
    name: column.text,
    role: column.text,
    email: column.text,
    phone: column.text,
    sort_order: column.integer,
    created_at: column.integer,
    updated_at: column.integer,
    workspace_id: column.text
  },
  { indexes: { workspace: ['workspace_id'], despachante: ['despachante_id'] } }
)

const comex_brands = new Table(
  {
    name: column.text,
    category: column.text,
    primary_supplier_id: column.text,
    demand_annual: column.integer,
    demand_monthly_json: column.text,
    current_stock: column.integer,
    safety_stock: column.integer,
    purchase_frequency_days: column.integer,
    notes: column.text,
    logo_stored_name: column.text,
    created_at: column.integer,
    updated_at: column.integer,
    workspace_id: column.text
  },
  { indexes: { workspace: ['workspace_id'], supplier: ['primary_supplier_id'] } }
)

export const AppSchema = new Schema({
  projects,
  tasks,
  task_dependencies,
  user_permissions,
  finance_accounts,
  finance_categories,
  finance_payment_methods,
  finance_concepts,
  finance_movements,
  finance_movement_entries,
  finance_month_insights,
  company_finance_accounts,
  company_finance_categories,
  company_finance_payment_methods,
  company_finance_concepts,
  company_finance_movements,
  company_finance_movement_entries,
  company_finance_month_insights,
  comex_suppliers,
  comex_supplier_contacts,
  comex_supplier_bank_accounts,
  comex_freight_operators,
  comex_freight_operator_contacts,
  comex_gestores,
  comex_gestor_contacts,
  comex_despachantes,
  comex_despachante_contacts,
  comex_brands
})

/**
 * Lee la configuración de PowerSync/Supabase de .env.local en la raíz del proyecto
 * (en desarrollo) o junto al ejecutable instalado (en producción).
 */
export function readEnvLocal(): Record<string, string> {
  // En desarrollo, app.getAppPath() apunta a la raíz del proyecto (donde
  // vive .env.local). En la versión empaquetada, app.getAppPath() apunta
  // dentro de app.asar (solo lectura), así que buscamos .env.local al lado
  // del ejecutable instalado para poder configurarlo por máquina sin
  // recompilar.
  const baseDir = app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath()
  const envPath = path.join(baseDir, '.env.local')
  const env: Record<string, string> = {}
  if (!fs.existsSync(envPath)) return env

  const content = fs.readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m) env[m[1]] = m[2].trim()
  }
  return env
}

function base64url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Firma un JWT de corta duración (RS256) para autenticar contra PowerSync,
 * usando la clave privada propia (POWERSYNC_JWT_PRIVATE_KEY_B64). La clave
 * pública correspondiente está configurada como JWKS estático en la
 * instancia de PowerSync. Se genera un token nuevo en cada conexión, así que
 * no hay que regenerarlo manualmente cada 12hs.
 */
function signPowerSyncJwt(env: Record<string, string>, endpoint: string, sub: string): string {
  const privateKeyPem = Buffer.from(env.POWERSYNC_JWT_PRIVATE_KEY_B64, 'base64').toString('utf-8')
  const kid = env.POWERSYNC_JWT_KID
  const privateKey = crypto.createPrivateKey(privateKeyPem)

  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT', kid }
  const payload = { sub, aud: endpoint, iat: now, exp: now + 3600 }

  const headerB64 = base64url(Buffer.from(JSON.stringify(header)))
  const payloadB64 = base64url(Buffer.from(JSON.stringify(payload)))
  const signingInput = `${headerB64}.${payloadB64}`
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput), privateKey)

  return `${signingInput}.${base64url(signature)}`
}

class ProductionTokenConnector implements PowerSyncBackendConnector {
  constructor(private endpoint: string) {}

  async fetchCredentials() {
    const env = readEnvLocal()
    const session = await getSession()
    if (!session) throw new Error('[PowerSync] Sin sesión de usuario autenticado')
    const token = signPowerSyncJwt(env, this.endpoint, session.userId)
    return { endpoint: this.endpoint, token }
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction()
    if (!transaction) return

    const env = readEnvLocal()
    const baseUrl = `${env.SUPABASE_URL}/rest/v1`
    const headers = {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    }

    for (const op of transaction.crud) {
      const url = `${baseUrl}/${op.table}?id=eq.${op.id}`
      let res: Response

      switch (op.op) {
        case UpdateType.PUT:
          res = await fetch(`${baseUrl}/${op.table}`, {
            method: 'POST',
            headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify({ ...op.opData, id: op.id })
          })
          break
        case UpdateType.PATCH:
          res = await fetch(url, {
            method: 'PATCH',
            headers: { ...headers, Prefer: 'return=minimal' },
            body: JSON.stringify(op.opData)
          })
          break
        case UpdateType.DELETE:
          res = await fetch(url, { method: 'DELETE', headers: { ...headers, Prefer: 'return=minimal' } })
          break
      }

      if (!res.ok) {
        throw new Error(`[PowerSync] ${op.op} ${op.table}/${op.id} -> ${res.status} ${await res.text()}`)
      }
    }

    await transaction.complete()
  }
}

let _psDb: PowerSyncDatabase | null = null

export function getPowerSyncDb(): PowerSyncDatabase {
  if (_psDb) return _psDb

  const userDataPath = app.getPath('userData')
  const dbDir = path.join(userDataPath, 'flowtask')
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })

  _psDb = new PowerSyncDatabase({
    schema: AppSchema,
    database: {
      dbFilename: 'powersync.db',
      dbLocation: dbDir
    }
  })

  return _psDb
}

/**
 * Fase 1 (sync multi-dispositivo): copia única de los datos existentes de
 * projects/tasks/task_dependencies desde flowtask.db hacia powersync.db, para
 * que PowerSync los suba a Supabase. Es idempotente: si powersync.db ya tiene
 * proyectos o tareas, no hace nada.
 */
async function migrateLegacyTaskData(psDb: PowerSyncDatabase): Promise<void> {
  const counts = await psDb.get<{ projects: number; tasks: number }>(
    `SELECT (SELECT COUNT(*) FROM projects) as projects, (SELECT COUNT(*) FROM tasks) as tasks`
  )
  if (counts.projects > 0 || counts.tasks > 0) return

  const flowDb = getDb()
  const projects = flowDb.prepare('SELECT * FROM projects').all() as Record<string, unknown>[]
  const tasks = flowDb.prepare('SELECT * FROM tasks').all() as Record<string, unknown>[]
  const deps = flowDb.prepare('SELECT * FROM task_dependencies').all() as Record<string, unknown>[]

  if (projects.length === 0 && tasks.length === 0) return

  console.log(
    `[PowerSync] Migrando datos existentes: ${projects.length} proyectos, ${tasks.length} tareas, ${deps.length} dependencias`
  )

  for (const p of projects) {
    await psDb.execute(
      `INSERT OR IGNORE INTO projects (id, name, color, created_at, updated_at, workspace_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [p.id, p.name, p.color, p.created_at, p.updated_at, p.workspace_id]
    )
  }

  for (const t of tasks) {
    await psDb.execute(
      `INSERT OR IGNORE INTO tasks
         (id, project_id, title, description, status, priority, due_date, due_time, completed_at, created_at, updated_at, synced_at, drive_file_id, workspace_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        t.id, t.project_id, t.title, t.description, t.status, t.priority,
        t.due_date, t.due_time, t.completed_at, t.created_at, t.updated_at,
        t.synced_at, t.drive_file_id, t.workspace_id
      ]
    )
  }

  for (const d of deps) {
    await psDb.execute(
      `INSERT OR IGNORE INTO task_dependencies (id, task_id, depends_on_id, created_at, workspace_id)
       VALUES (?, ?, ?, ?, ?)`,
      [d.id, d.task_id, d.depends_on_id, d.created_at, d.workspace_id]
    )
  }

  console.log('[PowerSync] Migración de datos existentes completada')
}

/**
 * Fase 6 (auth + permisos): copia única de los permisos seedeados en
 * flowtask.db hacia powersync.db, para que PowerSync los suba a Supabase.
 * Idempotente: si powersync.db ya tiene filas en user_permissions, no hace
 * nada.
 */
async function migrateUserPermissions(psDb: PowerSyncDatabase): Promise<void> {
  const { count } = await psDb.get<{ count: number }>(
    `SELECT COUNT(*) as count FROM user_permissions`
  )
  if (count > 0) return

  const flowDb = getDb()
  const rows = flowDb.prepare('SELECT * FROM user_permissions').all() as Record<string, unknown>[]
  if (rows.length === 0) return

  console.log(`[PowerSync] Migrando ${rows.length} permisos de usuario existentes`)

  for (const r of rows) {
    await psDb.execute(
      `INSERT OR IGNORE INTO user_permissions (id, user_id, module_key, submodule_key, level, created_at, updated_at, workspace_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [r.id, r.user_id, r.module_key, r.submodule_key, r.level, r.created_at, r.updated_at, r.workspace_id]
    )
  }
}

/**
 * Fase 3 (sync multi-dispositivo): copia única de los datos existentes de las
 * 14 tablas de Finanzas Personales y Finanzas Empresa desde flowtask.db hacia
 * powersync.db. Idempotente por tabla: si una tabla ya tiene filas en
 * powersync.db, se omite (puede haber pasado por una conexión anterior o por
 * sync remoto si ya hay otro dispositivo).
 */
const FINANCE_TABLES = [
  'finance_accounts',
  'finance_categories',
  'finance_payment_methods',
  'finance_concepts',
  'finance_movements',
  'finance_movement_entries',
  'finance_month_insights',
  'company_finance_accounts',
  'company_finance_categories',
  'company_finance_payment_methods',
  'company_finance_concepts',
  'company_finance_movements',
  'company_finance_movement_entries',
  'company_finance_month_insights'
]

async function migrateLegacyFinanceData(psDb: PowerSyncDatabase): Promise<void> {
  await migrateLegacyTableData(psDb, FINANCE_TABLES)
}

/**
 * Fase 4 (sync multi-dispositivo): copia única de los datos existentes de las
 * 10 tablas "maestros" de Comex (proveedores, operadores logísticos,
 * gestores, despachantes, marcas y sus contactos/cuentas) desde flowtask.db
 * hacia powersync.db.
 */
const COMEX_MAESTROS_TABLES = [
  'comex_suppliers',
  'comex_supplier_contacts',
  'comex_supplier_bank_accounts',
  'comex_freight_operators',
  'comex_freight_operator_contacts',
  'comex_gestores',
  'comex_gestor_contacts',
  'comex_despachantes',
  'comex_despachante_contacts',
  'comex_brands'
]

async function migrateLegacyComexMaestrosData(psDb: PowerSyncDatabase): Promise<void> {
  await migrateLegacyTableData(psDb, COMEX_MAESTROS_TABLES)
}

/**
 * Copia única (idempotente por tabla) de los datos existentes de
 * flowtask.db hacia powersync.db, para que PowerSync los suba a Supabase.
 * Si una tabla ya tiene filas en powersync.db, se omite (puede haber pasado
 * por una conexión anterior o por sync remoto si ya hay otro dispositivo).
 */
async function migrateLegacyTableData(psDb: PowerSyncDatabase, tables: string[]): Promise<void> {
  const flowDb = getDb()

  for (const table of tables) {
    const { count } = await psDb.get<{ count: number }>(`SELECT COUNT(*) as count FROM ${table}`)
    if (count > 0) continue

    const rows = flowDb.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[]
    if (rows.length === 0) continue

    console.log(`[PowerSync] Migrando ${rows.length} filas de ${table}`)

    const columns = Object.keys(rows[0])
    const placeholders = columns.map(() => '?').join(', ')
    const sql = `INSERT OR IGNORE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`

    for (const row of rows) {
      await psDb.execute(sql, columns.map((c) => row[c]))
    }
  }
}

/**
 * Conecta la instancia de PowerSync al backend, en paralelo a better-sqlite3.
 * Antes de conectar, copia los datos existentes de tasks/projects/task_dependencies
 * (Fase 1), de user_permissions (Fase 6) y de Finanzas/Finanzas Empresa
 * (Fase 3) si todavía no se hizo.
 *
 * Requiere una sesión de Supabase Auth activa (Fase 6.3): sin sesión, no
 * conecta (igual que cuando faltan las env vars). Se vuelve a llamar tras un
 * login exitoso.
 */
export async function connectPowerSync(): Promise<void> {
  const env = readEnvLocal()
  const endpoint = env.POWERSYNC_URL

  if (!endpoint || !env.POWERSYNC_JWT_PRIVATE_KEY_B64 || !env.POWERSYNC_JWT_KID) {
    console.warn(
      '[PowerSync] POWERSYNC_URL, POWERSYNC_JWT_PRIVATE_KEY_B64 o POWERSYNC_JWT_KID no configurados, omitiendo conexión'
    )
    return
  }

  const session = await getSession()
  if (!session) {
    console.warn('[PowerSync] Sin sesión de usuario autenticado, omitiendo conexión')
    return
  }

  const db = getPowerSyncDb()
  await migrateLegacyTaskData(db)
  await migrateUserPermissions(db)
  await migrateLegacyFinanceData(db)
  await migrateLegacyComexMaestrosData(db)
  await db.connect(new ProductionTokenConnector(endpoint))
  console.log('[PowerSync] Conectado a', endpoint, 'como', session.email)
}

/** Desconecta PowerSync (p. ej. al cerrar sesión). */
export async function disconnectPowerSync(): Promise<void> {
  if (!_psDb) return
  await _psDb.disconnect()
}

function serializeStatus(status: SyncStatus): PowerSyncStatusInfo {
  const dataFlow = status.dataFlowStatus
  if (dataFlow.uploadError || dataFlow.downloadError) {
    console.error('[PowerSync] uploadError:', dataFlow.uploadError)
    console.error('[PowerSync] downloadError:', dataFlow.downloadError)
  }
  return {
    connected: status.connected,
    connecting: status.connecting,
    uploading: !!dataFlow.uploading,
    downloading: !!dataFlow.downloading,
    lastSyncedAt: status.lastSyncedAt ? status.lastSyncedAt.getTime() : null,
    hasError: !!(dataFlow.uploadError || dataFlow.downloadError)
  }
}

/**
 * Devuelve el estado actual de sincronización, para exponerlo vía IPC al
 * abrir la app (antes de que llegue el primer evento de `statusChanged`).
 */
export function getPowerSyncStatus(): PowerSyncStatusInfo | null {
  if (!_psDb) return null
  return serializeStatus(_psDb.currentStatus)
}

/**
 * Registra listeners de PowerSync para avisar al renderer (vía `sendToRenderer`)
 * cuando cambia el estado de conexión/sync (`powersync:status`) o cuando se
 * actualizan datos de tasks/projects/task_dependencies por sync remoto o
 * escritura local (`powersync:dataChanged`).
 */
export function registerSyncListeners(sendToRenderer: (channel: string, data: unknown) => void): void {
  const db = getPowerSyncDb()

  db.registerListener({
    statusChanged: (status) => sendToRenderer('powersync:status', serializeStatus(status))
  })

  db.onChangeWithCallback(
    {
      onChange: async () => {
        sendToRenderer('powersync:dataChanged', null)
      },
      onError: (err) => console.error('[PowerSync] Error en listener de cambios:', err)
    },
    { tables: ['projects', 'tasks', 'task_dependencies', ...FINANCE_TABLES, ...COMEX_MAESTROS_TABLES], throttleMs: 1000 }
  )
}
