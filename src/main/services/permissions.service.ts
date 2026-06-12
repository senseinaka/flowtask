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
  settings: 'settings'
}

// Acciones que solo leen datos — todo lo que no matchee se trata como 'write'.
const READ_ACTION_RE = /^(list|get|export|is[A-Z]|status|categoryBreakdown|history|topConcepts|topIncreases|listByItem|listUpcoming)/

function levelForChannel(channel: string): { moduleKey: string; level: PermissionLevel } | null {
  const [prefix, ...rest] = channel.split(':')
  const moduleKey = CHANNEL_MODULE_MAP[prefix]
  if (!moduleKey) return null

  const action = rest.join(':')
  const level: PermissionLevel = READ_ACTION_RE.test(action) ? 'read' : 'write'
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
  const row = cache.rows.find((r) => r.module_key === moduleKey && r.submodule_key === null)
  return row?.level ?? 'none'
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
