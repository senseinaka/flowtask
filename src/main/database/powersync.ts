import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { getDb } from './db'
import { PowerSyncDatabase } from '@powersync/node'
import {
  Schema,
  Table,
  column,
  UpdateType,
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
 * Conecta la instancia de PowerSync al backend, en paralelo a better-sqlite3.
 * Antes de conectar, copia los datos existentes de tasks/projects/task_dependencies
 * (Fase 1) si todavía no se hizo.
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
  await migrateLegacyTaskData(db)
  await db.connect(new DevTokenConnector(endpoint, token))
  console.log('[PowerSync] Conectado a', endpoint)
}
