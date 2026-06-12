/**
 * Catálogo de módulos y submódulos de la app, usado por el sistema de
 * permisos (Fase 6). Las `key` deben mantenerse estables: se guardan en
 * `user_permissions.module_key` / `submodule_key`.
 */

export type PermissionLevel = 'none' | 'read' | 'write'

/** user_id de Diego en Supabase Auth — único habilitado para administrar permisos. */
export const ADMIN_USER_ID = 'ac2b1796-0571-43d2-b645-c72ba939824f'

export interface ModuleDef {
  key: string
  label: string
  routes: string[]
  submodules?: SubmoduleDef[]
}

export interface SubmoduleDef {
  key: string
  label: string
  routes: string[]
}

export const MODULES: ModuleDef[] = [
  {
    key: 'tasks',
    label: 'Tareas personales',
    routes: ['/tasks', '/kanban']
  },
  {
    key: 'contacts',
    label: 'Contactos',
    routes: ['/contacts']
  },
  {
    key: 'team',
    label: 'Tareas asignadas',
    routes: ['/team', '/team/kanban']
  },
  {
    key: 'messages',
    label: 'Mensajes',
    routes: ['/messages']
  },
  {
    key: 'comex',
    label: 'Comex',
    routes: ['/comex'],
    submodules: [
      { key: 'dashboard', label: 'Dashboard', routes: ['/comex'] },
      { key: 'imports', label: 'Importaciones', routes: ['/comex/imports'] },
      { key: 'suppliers', label: 'Proveedores', routes: ['/comex/suppliers'] },
      { key: 'brands', label: 'Marcas', routes: ['/comex/brands'] },
      { key: 'plannings', label: 'Programación Pedidos', routes: ['/comex/plannings'] },
      { key: 'operators', label: 'Operadores', routes: ['/comex/operators'] },
      { key: 'gestores', label: 'Gestores INAL', routes: ['/comex/gestores'] },
      { key: 'despachantes', label: 'Despachantes', routes: ['/comex/despachantes'] },
      { key: 'logistics', label: 'Logística', routes: ['/comex/logistics'] }
    ]
  },
  {
    key: 'expiry',
    label: 'Vencimientos',
    routes: ['/expiry']
  },
  {
    key: 'finance',
    label: 'Finanzas',
    routes: ['/finance']
  },
  {
    key: 'company_finance',
    label: 'Finanzas Empresa',
    routes: ['/company-finance']
  },
  {
    key: 'settings',
    label: 'Configuración',
    routes: ['/settings']
  }
]

export function findModuleByPath(pathname: string): ModuleDef | undefined {
  return MODULES.find((m) => m.routes.some((r) => pathname === r || pathname.startsWith(r + '/')))
}

export function findSubmoduleByPath(mod: ModuleDef, pathname: string): SubmoduleDef | undefined {
  return mod.submodules?.find((s) => s.routes.some((r) => pathname === r || pathname.startsWith(r + '/')))
}
