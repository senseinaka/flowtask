// ═══════════════════════════════════════════════════════════════════════════
// Fase 6.5 — Aplicación de permisos en IPC  (endurecido: default-deny)
// ═══════════════════════════════════════════════════════════════════════════
//
// Guard genérico: en vez de tocar cada uno de los ~30 archivos de IPC,
// se parchea `ipcMain.handle` una sola vez (al arrancar). Política:
//   1. Canales PÚBLICOS (auth, app, wallpaper, permissions) → sin guard
//      (se necesitan antes del login o se auto-protegen internamente).
//   2. Canales mapeados a un módulo/submódulo del catálogo (`@shared/modules`)
//      → exigen sesión + permiso suficiente (read/write).
//   3. Cualquier otro canal → exige al menos SESIÓN ACTIVA (default-deny:
//      un canal nuevo nunca queda accesible sin autenticación por omisión).
// El admin (Diego) tiene acceso total a todo.

import { ipcMain } from 'electron'
import { getSession } from './auth.service'
import { listUserPermissions } from '../database/queries/permissions'
import { ADMIN_USER_ID, type PermissionLevel } from '@shared/modules'

/** Canales que pueden ejecutarse sin sesión (login / arranque) o que se
 *  auto-protegen en su propio handler (permissions:* usa requireAdmin). */
const PUBLIC_CHANNELS = new Set(['auth', 'app', 'wallpaper', 'permissions'])

type ChannelTarget = { moduleKey: string; submoduleKey?: string }

const CHANNEL_MODULE_MAP: Record<string, ChannelTarget> = {
  tasks: { moduleKey: 'tasks' },
  projects: { moduleKey: 'tasks' },
  attachments: { moduleKey: 'tasks' },
  reminders: { moduleKey: 'tasks' },
  questions: { moduleKey: 'tasks' },
  delegated: { moduleKey: 'team' },
  'delegated-reminders': { moduleKey: 'team' },
  'delegated-attachments': { moduleKey: 'team' },
  'team-tasks': { moduleKey: 'team' },
  maintenance: { moduleKey: 'maintenance' },
  contacts: { moduleKey: 'contacts' },
  agenda: { moduleKey: 'contacts' },
  messages: { moduleKey: 'messages' },
  comex: { moduleKey: 'comex' },
  expiry: { moduleKey: 'expiry' },
  finance: { moduleKey: 'finance' },
  companyFinance: { moduleKey: 'company_finance' },
  rrhh: { moduleKey: 'rrhh' },
  settings: { moduleKey: 'settings' },
  // —— Módulos sensibles que antes quedaban SIN guard (hallazgo Fix 6) ——
  cajas: { moduleKey: 'contable', submoduleKey: 'cajas' },
  mp: { moduleKey: 'contable', submoduleKey: 'mercadopago' },
  services: { moduleKey: 'contable', submoduleKey: 'servicios' },
  catalog: { moduleKey: 'contable', submoduleKey: 'servicios' },
  recon: { moduleKey: 'contable', submoduleKey: 'recon' },
  quotes: { moduleKey: 'quotes' },
  knowledge: { moduleKey: 'knowledge' },
  calendar: { moduleKey: 'calendar' }
}

// Acciones que solo leen datos — todo lo que no matchee se trata como 'write'.
const READ_ACTION_RE = /^(list|get|export|is[A-Z]|status|categoryBreakdown|history|historial|ausentes|topConcepts|topIncreases|listByItem|listUpcoming)/

// Lecturas con nombre propio que no encajan en la regex anterior (match EXACTO
// del action completo, nunca por prefijo, para no marcar como read un write
// homónimo como `companies:create`).
const READ_EXACT_ACTIONS = new Set([
  // cajas
  'balances', 'cashboxes', 'categories', 'companies', 'lastCounts',
  'daily:summary', 'charts:flowSeries', 'differences:pending',
  // mercadopago
  'config:default', 'config:get', 'transactions:stats',
  // recon
  'data:cupones', 'data:extracto', 'data:invoices', 'data:mlops', 'data:naveops',
  // knowledge
  'search', 'entries:topics', 'topic:latestSummary'
])

const LEVEL_RANK: Record<PermissionLevel, number> = { none: 0, read: 1, write: 2 }

function levelForChannel(channel: string): (ChannelTarget & { level: PermissionLevel }) | null {
  const segments = channel.split(':')
  const target = CHANNEL_MODULE_MAP[segments[0]]
  if (!target) return null

  // Varios módulos usan canales con forma `recurso:verbo` (p.ej. periodos:list,
  // nomina:colaboradores:list). La detección de lectura mira tanto el action
  // completo como el último segmento (el verbo real) para no clasificar como
  // 'write' operaciones que en realidad solo leen.
  const action = segments.slice(1).join(':')
  const verb = segments[segments.length - 1] ?? ''
  const isRead =
    READ_ACTION_RE.test(action) || READ_ACTION_RE.test(verb) || READ_EXACT_ACTIONS.has(action)
  const level: PermissionLevel = isRead ? 'read' : 'write'
  return { ...target, level }
}

let cache: { userId: string; rows: ReturnType<typeof listUserPermissions> } | null = null

/** Invalidar el caché de permisos (llamar tras editar user_permissions). */
export function invalidatePermissionsCache(): void {
  cache = null
}

function ensureCache(userId: string): void {
  if (!cache || cache.userId !== userId) {
    cache = { userId, rows: listUserPermissions(userId) }
  }
}

/** Nivel efectivo de un MÓDULO completo = el más alto entre el permiso a nivel
 *  módulo y el de cualquiera de sus submódulos. Para canales mapeados a módulo
 *  (no a un submódulo puntual): si un submódulo concede acceso, el módulo es
 *  accesible vía IPC (refleja `levelFor` del renderer). */
function getUserModuleLevel(userId: string, moduleKey: string): PermissionLevel {
  ensureCache(userId)
  let best: PermissionLevel = 'none'
  for (const row of cache!.rows) {
    if (row.module_key !== moduleKey) continue
    if (LEVEL_RANK[row.level] > LEVEL_RANK[best]) best = row.level
  }
  return best
}

/** Nivel de un SUBMÓDULO puntual: fila exacta del submódulo y, si no existe,
 *  fallback al permiso a nivel módulo (submodule_key = null). Misma semántica
 *  que `levelFor` del renderer — evita que tener acceso a un submódulo de
 *  Contable conceda acceso a OTRO submódulo de Contable. */
function levelForSubmodule(
  userId: string,
  moduleKey: string,
  submoduleKey: string
): PermissionLevel {
  ensureCache(userId)
  for (const row of cache!.rows) {
    if (row.module_key === moduleKey && row.submodule_key === submoduleKey) return row.level
  }
  for (const row of cache!.rows) {
    if (row.module_key === moduleKey && row.submodule_key == null) return row.level
  }
  return 'none'
}

/**
 * Parchea `ipcMain.handle` para aplicar la política de permisos. Debe llamarse
 * antes de registrar el resto de los handlers de IPC.
 */
export function installIpcPermissionGuard(): void {
  const originalHandle = ipcMain.handle.bind(ipcMain)

  ipcMain.handle = ((channel: string, listener: Parameters<typeof ipcMain.handle>[1]) => {
    const prefix = channel.split(':')[0]
    if (PUBLIC_CHANNELS.has(prefix)) return originalHandle(channel, listener)

    const guard = levelForChannel(channel)

    return originalHandle(channel, async (event, ...args) => {
      const session = await getSession()
      if (!session) throw new Error('No autenticado')

      // El admin (Diego) tiene acceso total a todos los módulos.
      if (session.userId === ADMIN_USER_ID) return listener(event, ...args)

      if (guard) {
        const userLevel = guard.submoduleKey
          ? levelForSubmodule(session.userId, guard.moduleKey, guard.submoduleKey)
          : getUserModuleLevel(session.userId, guard.moduleKey)

        if (userLevel === 'none') {
          throw new Error(`Sin acceso al módulo "${guard.moduleKey}"`)
        }
        if (guard.level === 'write' && userLevel !== 'write') {
          throw new Error(`Sin permiso de edición en "${guard.moduleKey}"`)
        }
      }
      // Canal no mapeado: con exigir sesión activa alcanza (default-deny para
      // no autenticados). Los módulos sensibles ya están mapeados arriba.

      return listener(event, ...args)
    })
  }) as typeof ipcMain.handle
}
