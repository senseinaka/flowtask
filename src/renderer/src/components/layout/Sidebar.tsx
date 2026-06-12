import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutList, Columns3, Settings, RefreshCw, Loader2, CheckSquare,
  Users, UserCircle2, Send, Globe2, Package, Building2, Ship, Truck,
  ShieldCheck, Briefcase, ChevronDown, LayoutDashboard, Clock, Wallet, Tag,
  CalendarClock
} from 'lucide-react'
import { useProjects } from '../../hooks/useProjects'
import { usePermissions } from '../../hooks/usePermissions'
import { useUIStore } from '../../store/ui.store'
import { useQuery, useMutation } from '@tanstack/react-query'
import type { SyncStatus } from '@shared/types'
import { cn } from '../ui/utils'
import SyncStatusBadge from './SyncStatusBadge'

// ── Sub-item lists ─────────────────────────────────────────────────────────────

const tasksSubItems = [
  { to: '/tasks',  icon: LayoutList, label: 'Lista',   exact: true },
  { to: '/kanban', icon: Columns3,   label: 'Kanban',  exact: true }
]

const teamSubItems = [
  { to: '/team',        icon: LayoutList, label: 'Lista',  exact: true },
  { to: '/team/kanban', icon: Columns3,   label: 'Kanban', exact: true }
]

const comexSubItems = [
  { to: '/comex',            icon: LayoutDashboard, label: 'Dashboard',    exact: true, subKey: 'dashboard' },
  { to: '/comex/imports',    icon: Package,          label: 'Importaciones', subKey: 'imports' },
  { to: '/comex/suppliers',  icon: Building2,        label: 'Proveedores',   subKey: 'suppliers' },
  { to: '/comex/brands',     icon: Tag,              label: 'Marcas',        subKey: 'brands' },
  { to: '/comex/plannings',  icon: CalendarClock,    label: 'Programación Pedidos', subKey: 'plannings' },
  { to: '/comex/operators',    icon: Truck,          label: 'Operadores',    subKey: 'operators' },
  { to: '/comex/gestores',    icon: ShieldCheck,    label: 'Gestores INAL',  subKey: 'gestores' },
  { to: '/comex/despachantes',icon: Briefcase,      label: 'Despachantes',   subKey: 'despachantes' },
  { to: '/comex/logistics',  icon: Ship,             label: 'Logística',     subKey: 'logistics' }
]

// ── Reusable collapsible section ──────────────────────────────────────────────

function CollapsibleSection({
  icon: Icon,
  label,
  isActive,
  activeColor,
  subItems,
  open,
  onToggle
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  isActive: boolean
  activeColor: { bg: string; text: string; border: string; subActive: string; iconColor: string }
  subItems: Array<{ to: string; icon: React.ComponentType<{ size?: number; className?: string }>; label: string; exact?: boolean }>
  open: boolean
  onToggle: () => void
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
          isActive ? `${activeColor.bg} ${activeColor.text}` : 'text-slate-300 hover:bg-slate-700 hover:text-slate-100'
        )}
      >
        <Icon size={16} className={isActive ? activeColor.iconColor : ''} />
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown
          size={14}
          className={cn('transition-transform duration-200 text-slate-500', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className={cn('mt-1 ml-3 pl-3 border-l space-y-0.5', activeColor.border)}>
          {subItems.map(({ to, icon: SubIcon, label: subLabel, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  isActive ? activeColor.subActive : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                )
              }
            >
              <SubIcon size={13} />
              {subLabel}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Sidebar ──────────────────────────────────────────────────────────────

export default function Sidebar() {
  const { data: projects } = useProjects()
  const { filters, setFilter } = useUIStore()
  const { canRead } = usePermissions()
  const location = useLocation()

  const isOnTasks  = location.pathname === '/tasks' || location.pathname === '/kanban'
  const isOnTeam   = location.pathname.startsWith('/team')
  const isOnComex  = location.pathname.startsWith('/comex')

  const visibleComexSubItems = comexSubItems.filter((item) => canRead('comex', item.subKey))

  const [tasksOpen, setTasksOpen] = useState(isOnTasks)
  const [teamOpen,  setTeamOpen]  = useState(isOnTeam)
  const [comexOpen, setComexOpen] = useState(true)

  const { data: syncStatus } = useQuery<SyncStatus>({
    queryKey: ['sync-status'],
    queryFn: () => window.api.sync.getStatus(),
    refetchInterval: 60_000
  })

  const syncMutation = useMutation({
    mutationFn: () => window.api.sync.trigger()
  })

  return (
    <aside className="w-56 flex-shrink-0 bg-slate-800 border-r border-slate-700 flex flex-col">
      {/* Logo */}
      <div className="px-4 py-5 flex items-center gap-2 border-b border-slate-700">
        <CheckSquare size={20} className="text-indigo-400" />
        <span className="font-bold text-lg tracking-tight">Summit</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">

        {/* ── Tareas personales ─────────────────────────────────────────── */}
        {canRead('tasks') && (
          <CollapsibleSection
            icon={LayoutList}
            label="Tareas personales"
            isActive={isOnTasks}
            open={tasksOpen}
            onToggle={() => setTasksOpen((v) => !v)}
            subItems={tasksSubItems}
            activeColor={{
              bg:        'bg-indigo-900/30',
              text:      'text-indigo-300',
              iconColor: 'text-indigo-400',
              border:    'border-indigo-800',
              subActive: 'bg-indigo-700/40 text-indigo-200'
            }}
          />
        )}

        {/* ── Contactos ─────────────────────────────────────────────────── */}
        {canRead('contacts') && (
          <NavLink
            to="/contacts"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-slate-100'
              )
            }
          >
            <UserCircle2 size={16} />
            Contactos
          </NavLink>
        )}

        {/* ── Tareas asignadas ──────────────────────────────────────────── */}
        {canRead('team') && (
          <CollapsibleSection
            icon={Users}
            label="Tareas asignadas"
            isActive={isOnTeam}
            open={teamOpen}
            onToggle={() => setTeamOpen((v) => !v)}
            subItems={teamSubItems}
            activeColor={{
              bg:        'bg-violet-900/30',
              text:      'text-violet-300',
              iconColor: 'text-violet-400',
              border:    'border-violet-800',
              subActive: 'bg-violet-700/40 text-violet-200'
            }}
          />
        )}

        {/* ── Mensajes ──────────────────────────────────────────────────── */}
        {canRead('messages') && (
          <NavLink
            to="/messages"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-slate-100'
              )
            }
          >
            <Send size={16} />
            Mensajes
          </NavLink>
        )}

        {/* ── Comex ─────────────────────────────────────────────────────── */}
        {visibleComexSubItems.length > 0 && (
          <div className="pt-1">
            <CollapsibleSection
              icon={Globe2}
              label="Comex"
              isActive={isOnComex}
              open={comexOpen}
              onToggle={() => setComexOpen((v) => !v)}
              subItems={visibleComexSubItems}
              activeColor={{
                bg:        'bg-cyan-900/30',
                text:      'text-cyan-300',
                iconColor: 'text-cyan-400',
                border:    'border-slate-700',
                subActive: 'bg-cyan-700/40 text-cyan-200'
              }}
            />
          </div>
        )}

        {/* ── Vencimientos ──────────────────────────────────────────────── */}
        {canRead('expiry') && (
          <div className="pt-1">
            <NavLink
              to="/expiry"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive ? 'bg-amber-900/40 text-amber-300' : 'text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                )
              }
            >
              <Clock size={16} />
              Vencimientos
            </NavLink>
          </div>
        )}

        {/* ── Finanzas Personales ───────────────────────────────────────── */}
        {canRead('finance') && (
          <div className="pt-1">
            <NavLink
              to="/finance"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive ? 'bg-emerald-900/40 text-emerald-300' : 'text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                )
              }
            >
              <Wallet size={16} />
              Finanzas
            </NavLink>
          </div>
        )}

        {/* ── Finanzas Empresa ──────────────────────────────────────────── */}
        {canRead('company_finance') && (
          <div className="pt-1">
            <NavLink
              to="/company-finance"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive ? 'bg-emerald-900/40 text-emerald-300' : 'text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                )
              }
            >
              <Building2 size={16} />
              Finanzas Empresa
            </NavLink>
          </div>
        )}

        {/* ── Configuración ─────────────────────────────────────────────── */}
        {canRead('settings') && (
          <div className="pt-1">
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                )
              }
            >
              <Settings size={16} />
              Configuración
            </NavLink>
          </div>
        )}

        {/* ── Proyectos ─────────────────────────────────────────────────── */}
        {projects && projects.length > 0 && (
          <div className="pt-4">
            <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Proyectos
            </p>
            <button
              onClick={() => setFilter('project_id', undefined)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors',
                !filters.project_id ? 'text-slate-100' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              )}
            >
              Todos
            </button>
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => setFilter('project_id', p.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors',
                  filters.project_id === p.id ? 'text-slate-100' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                )}
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                <span className="truncate">{p.name}</span>
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* Sync */}
      <div className="p-3 border-t border-slate-700 space-y-2">
        <SyncStatusBadge />
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending || !syncStatus?.isAuthenticated}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
            syncStatus?.isAuthenticated
              ? 'text-slate-300 hover:bg-slate-700 hover:text-slate-100'
              : 'text-slate-600 cursor-not-allowed'
          )}
          title={syncStatus?.isAuthenticated ? 'Sincronizar con Google Drive' : 'Conectar Google Drive en Configuración'}
        >
          {syncMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          <span>{syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar'}</span>
          {syncStatus?.isAuthenticated && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />}
        </button>
        {syncStatus?.lastSync && (
          <p className="text-xs text-slate-600 mt-1 text-center">
            {new Date(syncStatus.lastSync).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </aside>
  )
}
