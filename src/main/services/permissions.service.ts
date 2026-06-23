// ═══════════════════════════════════════════════════════════════════════════
// Fase 6.5 — Aplicación de permisos en IPC
// ═══════════════════════════════════════════════════════════════════════════
//
// Guard genérico: en vez de tocar cada uno de los ~20 archivos de IPC,
// se parchea `ipcMain.handle` una sola vez (al arrancar) para interceptar
// los canales mapeados a un módulo del catálogo (`@shared/modules`) y
// verificar el permiso del usuario logueado antes de ejecutar el handler
// real. Canales no mapeados (auth, app, powersync, ai, chat, etc.) no se
// tocan. El nivel requerido (read/write) se infiere del nombre de la acción.

import { ipcMain } from 'electron'
import { getSession } from './auth.service'
import { listUserPermissions } from '../database/queries/permissions'
import type { PermissionLevel } from '@shared/modules'

const CHANNEL_MODULE_MAP: Record<string, string> = {
  tasks: 'tasks',
  projects: 'tasks',
  attachments: 'tasks',
  reminders: 'tasks',
  questions: 'tasks',
  delegated: 'team',
  'delegated-reminders': 'team',
  'delegated-attachments': 'team',
  contacts: 'contacts',
  messages: 'messages',
  comex: 'comex',
  expiry: 'expiry',
  finance: 'finance',
  companyFinance: 'company_finance',
  rrhh: 'rrhh',
  settings: 'settings'
}

// Acciones que solo leen datos — todo lo que no matchee se trata como 'write'.
const READ_ACTION_RE = /^(list|get|export|is[A-Z]|status|categoryBreakdown|history|historial|ausentes|topConcepts|topIncreases|listByItem|listUpcoming)/

const LEVEL_RANK: Record<PermissionLevel, number> = { none: 0, read: 1, write: 2 }

function levelForChannel(channel: string): { moduleKey: string; level: PermissionLevel } | null {
  const segments = channel.split(':')
  const moduleKey = CHANNEL_MODULE_MAP[segments[0]]
  if (!moduleKey) return null

  // Varios módulos usan canales con forma `recurso:verbo` (p.ej. periodos:list,
  // nomina:colaboradores:list). La detección de lectura mira tanto el action
  // completo como el último segmento (el verbo real) para no clasificar como
  // 'write' operaciones que en realidad solo leen.
  const action = segments.slice(1).join(':')
  const verb = segments[segments.length - 1] ?? ''
  const isRead = READ_ACTION_RE.test(action) || READ_ACTION_RE.test(verb)
  const level: PermissionLevel = isRead ? 'read' : 'write'
  return { moduleKey, level }
}

let cache: { userId: string; rows: ReturnType<typeof listUserPermissions> } | null = null

/** Invalidar el caché de permisos (llamar tras editar user_permissions). */
export function invalidatePermissionsCache(): void {
  cache = null
}

function getUserModuleLevel(userId: string, moduleKey: string): PermissionLevel {
  if (!cache || cache.userId !== userId) {
    cache = { userId, rows: listUserPermissions(userId) }
  }
  // Nivel efectivo del módulo = el más alto entre el permiso a nivel módulo
  // (submodule_key = null) y el de cualquiera de sus submódulos. Refleja la
  // lógica del renderer (`levelFor` en usePermissions): si un submódulo concede
  // acceso, el módulo es accesible vía IPC. Sin esto, un usuario con acceso a
  // RRHH solo por el submódulo `sueldos` quedaría bloqueado en el IPC.
  let best: PermissionLevel = 'none'
  for (const row of cache.rows) {
    if (row.module_key !== moduleKey) continue
    if (LEVEL_RANK[row.level] > LEVEL_RANK[best]) best = row.level
  }
  return best
}

/**
 * Parchea `ipcMain.handle` para que los canales mapeados en
 * `CHANNEL_MODULE_MAP` requieran sesión activa + permiso suficiente sobre
 * el módulo correspondiente. Debe llamarse antes de registrar el resto de
 * los handlers de IPC.
 */
export function installIpcPermissionGuard(): void {
  const originalHandle = ipcMain.handle.bind(ipcMain)

  ipcMain.handle = ((channel: string, listener: Parameters<typeof ipcMain.handle>[1]) => {
    const guard = levelForChannel(channel)
    if (!guard) return originalHandle(channel, listener)

    return originalHandle(channel, async (event, ...args) => {
      const session = await getSession()
      if (!session) throw new Error('No autenticado')

      const userLevel = getUserModuleLevel(session.userId, guard.moduleKey)
      if (userLevel === 'none') {
        throw new Error(`Sin acceso al módulo "${guard.moduleKey}"`)
      }
      if (guard.level === 'write' && userLevel !== 'write') {
        throw new Error(`Sin permiso de edición en "${guard.moduleKey}"`)
      }

      return listener(event, ...args)
    })
  }) as typeof ipcMain.handle
}
