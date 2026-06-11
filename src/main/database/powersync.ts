import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { PowerSyncDatabase } from '@powersync/node'
import {
  Schema,
  Table,
  column,
  type AbstractPowerSyncDatabase,
  type PowerSyncBackendConnector
} from '@powersync/common'

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

export const AppSchema = new Schema({
  projects,
  tasks,
  task_dependencies
})

/**
 * Lee POWERSYNC_URL y POWERSYNC_DEV_TOKEN de .env.local en la raíz del proyecto.
 * Solo para desarrollo (Fase 0) - el token de desarrollo expira a las 12hs.
 */
function readEnvLocal(): Record<string, string> {
  const envPath = path.join(app.getAppPath(), '.env.local')
  const env: Record<string, string> = {}
  if (!fs.existsSync(envPath)) return env

  const content = fs.readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].trim()
  }
  return env
}

class DevTokenConnector implements PowerSyncBackendConnector {
  constructor(
    private endpoint: string,
    private token: string
  ) {}

  async fetchCredentials() {
    return { endpoint: this.endpoint, token: this.token }
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    // Fase 0: las queries todavía no pasan por PowerSync, no hay nada que subir.
    const transaction = await database.getNextCrudTransaction()
    if (!transaction) return
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
 * Conecta la instancia de PowerSync al backend, en paralelo a better-sqlite3.
 * No afecta las queries existentes (Fase 0).
 */
export async function connectPowerSync(): Promise<void> {
  const env = readEnvLocal()
  const endpoint = env.POWERSYNC_URL
  const token = env.POWERSYNC_DEV_TOKEN

  if (!endpoint || !token) {
    console.warn('[PowerSync] POWERSYNC_URL o POWERSYNC_DEV_TOKEN no configurados, omitiendo conexión')
    return
  }

  const db = getPowerSyncDb()
  await db.connect(new DevTokenConnector(endpoint, token))
  console.log('[PowerSync] Conectado a', endpoint)
}
