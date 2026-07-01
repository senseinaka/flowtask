import React, { useState, useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutList, Columns3, Settings, Loader2,
  Users, UserCircle2, Send, Globe2, Package, Building2, Ship, Truck,
  ShieldCheck, Briefcase, LayoutDashboard, Clock, Wallet,
  CalendarClock, LogOut, CalendarDays, FileText, Mail,
  ArrowLeftRight, Brain, Network, Cloud, BookUser, CreditCard, Repeat, Home,
  RefreshCw, DollarSign, Banknote, PackageSearch, Wrench, UserX, Activity
} from 'lucide-react'
import { usePowerSyncStatus } from '../../hooks/usePowerSyncStatus'
import type { LucideIcon } from 'lucide-react'
import { useProjects } from '../../hooks/useProjects'

function ContainerShipIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={25} height={25} viewBox="0 0 60 50" fill="none" aria-hidden="true">
      <path d="M4 34 L8 42 H54 L58 34 L54 30 H8 Z" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      <line x1="8" y1="30" x2="54" y2="30" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="10" y="22" width="7" height="5" rx="0.5" fill="currentColor" opacity="0.5"/>
      <rect x="18" y="22" width="7" height="5" rx="0.5" fill="currentColor" opacity="0.5"/>
      <rect x="26" y="22" width="7" height="5" rx="0.5" fill="currentColor" opacity="0.5"/>
      <rect x="34" y="22" width="7" height="5" rx="0.5" fill="currentColor" opacity="0.5"/>
      <rect x="10" y="17" width="7" height="5" rx="0.5" fill="currentColor" opacity="0.35"/>
      <rect x="18" y="17" width="7" height="5" rx="0.5" fill="currentColor" opacity="0.35"/>
      <rect x="26" y="17" width="7" height="5" rx="0.5" fill="currentColor" opacity="0.35"/>
      <rect x="34" y="17" width="7" height="5" rx="0.5" fill="currentColor" opacity="0.35"/>
      <rect x="43" y="13" width="10" height="17" rx="1" fill="currentColor" opacity="0.18" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="46" y="9" width="3" height="5" rx="0.5" fill="currentColor" opacity="0.5"/>
      <line x1="11" y1="12" x2="11" y2="22" stroke="currentColor" strokeWidth="1.2" opacity="0.6"/>
    </svg>
  )
}
import { usePermissions } from '../../hooks/usePermissions'
import { ADMIN_USER_ID } from '@shared/modules'
import { useUIStore } from '../../store/ui.store'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { SyncStatus } from '@shared/types'
import { cn } from '../ui/utils'
import SyncStatusBadge, { formatLastSync } from './SyncStatusBadge'
import { useConfirm } from '../../store/confirm.store'

// ── Workspace definitions ─────────────────────────────────────────────────────

type WorkspaceKey = 'trabajo' | 'empresa' | 'comex' | 'finanzas' | 'agenda' | 'rrhh' | 'mantenimiento' | 'sistema'

const WORKSPACES: Array<{
  key: WorkspaceKey
  label: string
  Icon: LucideIcon | React.ComponentType<{ size?: number }>
  color: string
  activeBg: string
  paths: string[]
}> = [
  {
    key: 'trabajo',
    label: 'Tareas',
    Icon: LayoutList,
    color: '#818cf8',
    activeBg: 'rgba(129,140,248,.18)',
    paths: ['/tasks', '/kanban', '/team', '/messages'],
  },
  {
    key: 'empresa',
    label: 'Empresa',
    Icon: Globe2,
    color: '#fb923c',
    activeBg: 'rgba(251,146,60,.15)',
    paths: ['/quotes', '/knowledge'],
  },
  {
    key: 'comex',
    label: 'Comex',
    Icon: ContainerShipIcon,
    color: '#f59e0b',
    activeBg: 'rgba(245,158,11,.15)',
    paths: ['/comex'],
  },
  {
    key: 'finanzas',
    label: 'Contable',
    Icon: Wallet,
    color: '#34d399',
    activeBg: 'rgba(52,211,153,.12)',
    paths: ['/finance', '/company-finance', '/contable', '/expiry'],
  },
  {
    key: 'agenda',
    label: 'Agenda',
    Icon: CalendarDays,
    color: '#60a5fa',
    activeBg: 'rgba(96,165,250,.12)',
    paths: ['/calendario', '/email', '/agenda'],
  },
  {
    key: 'rrhh',
    label: 'RRHH',
    Icon: Users,
    color: '#f472b6',
    activeBg: 'rgba(244,114,182,.12)',
    paths: ['/rrhh'],
  },
  {
    key: 'mantenimiento',
    label: 'Mantenimiento',
    Icon: Wrench,
    color: '#818cf8',
    activeBg: 'rgba(129,140,248,.15)',
    paths: ['/mantenimiento'],
  },
  {
    key: 'sistema',
    label: 'Configuración',
    Icon: Settings,
    color: '#a78bfa',
    activeBg: 'rgba(167,139,250,.12)',
    paths: ['/cortex', '/settings'],
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function PanelLink({
  to,
  icon: Icon,
  label,
  end,
  color,
  onClick,
}: {
  to: string
  icon: LucideIcon
  label: string
  end?: boolean
  color: string
  onClick: () => void
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
          isActive
            ? 'text-slate-100'
            : 'text-slate-400 hover:bg-slate-700/60 hover:text-slate-200'
        )
      }
      style={({ isActive }) =>
        isActive ? { background: `${color}22`, color } : {}
      }
    >
      <Icon size={13} />
      <span className="truncate">{label}</span>
    </NavLink>
  )
}

function GroupLabel({ label, color }: { label: string; color: string }) {
  return (
    <p
      className="px-2.5 pt-2.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wider"
      style={{ color: `${color}80` }}
    >
      {label}
    </p>
  )
}

// ── Main Sidebar ──────────────────────────────────────────────────────────────

export default function Sidebar() {
  const { data: projects } = useProjects()
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const { filters, setFilter } = useUIStore()
  const { canRead } = usePermissions()
  const location = useLocation()
  const asideRef = useRef<HTMLElement>(null)

  const { data: session } = useQuery({
    queryKey: ['auth', 'session'],
    queryFn: () => window.api.auth.getSession()
  })
  const isAdmin = session?.userId === ADMIN_USER_ID

  const [openPanel, setOpenPanel] = useState<WorkspaceKey | null>(null)
  const [syncPanelOpen, setSyncPanelOpen] = useState(false)
  const [version, setVersion] = useState('')

  const comexSubItems: {
    to: string
    Icon: LucideIcon
    label: string
    end?: boolean
    subKey: string
  }[] = [
    { to: '/comex',               Icon: LayoutDashboard, label: 'Dashboard',             end: true, subKey: 'dashboard' },
    { to: '/comex/imports',       Icon: Package,         label: 'Importaciones',                    subKey: 'imports' },
    { to: '/comex/seguimiento',   Icon: PackageSearch,   label: 'Seguimiento Imp.',                 subKey: 'tracking' },
    { to: '/comex/suppliers',     Icon: Building2,       label: 'Proveedores / Marcas',             subKey: 'suppliers' },
    { to: '/comex/plannings',     Icon: CalendarClock,   label: 'Prog. Pedidos',                    subKey: 'plannings' },
    { to: '/comex/operators',     Icon: Truck,           label: 'Operadores',                       subKey: 'operators' },
    { to: '/comex/gestores',      Icon: ShieldCheck,     label: 'Gestores INAL',                    subKey: 'gestores' },
    { to: '/comex/despachantes',  Icon: Briefcase,       label: 'Despachantes',                     subKey: 'despachantes' },
    { to: '/comex/logistics',     Icon: Ship,            label: 'Logística',                        subKey: 'logistics' },
    { to: '/comex/cotizaciones',  Icon: DollarSign,      label: 'USD/EUR',                          subKey: 'cotizaciones' },
  ].filter((it) => canRead('comex', it.subKey))

  const { data: syncStatus } = useQuery<SyncStatus>({
    queryKey: ['sync-status'],
    queryFn: () => window.api.sync.getStatus(),
    refetchInterval: 60_000,
  })

  const syncMutation = useMutation({ mutationFn: () => window.api.sync.trigger() })

  const psStatus = usePowerSyncStatus()
  const psHasError     = (psStatus?.connected ?? false) && (psStatus?.hasError ?? false)
  const psDisconnected = !!psStatus && !psStatus.connected && !psStatus.connecting && !psStatus.configError
  const psSyncing      = (psStatus?.uploading || psStatus?.downloading || psStatus?.connecting) ?? false

  // Estado agregado de sync — un solo semáforo para PowerSync + Drive, visible sin
  // tener que abrir el panel de Configuración (antes SyncStatusBadge vivía solo ahí).
  // La reconexión de PowerSync la maneja el propio SyncStatusBadge dentro del popover.
  const driveOk = syncStatus?.isAuthenticated ?? false
  const syncSeverity: 'ok' | 'warn' | 'err' =
    psHasError                                                 ? 'err'
    : (psDisconnected || !!psStatus?.configError || !driveOk)  ? 'warn'
    : 'ok'

  useEffect(() => {
    window.api.app.getVersion().then(setVersion).catch(() => {})
  }, [])

  // Close on navigation
  useEffect(() => {
    setOpenPanel(null)
    setSyncPanelOpen(false)
  }, [location.pathname])

  // Close on click outside the aside
  useEffect(() => {
    if (!openPanel) return
    function onMouseDown(e: MouseEvent) {
      if (asideRef.current && !asideRef.current.contains(e.target as Node)) {
        setOpenPanel(null)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [openPanel])

  // Popover de estado de sync — mismo patrón de cierre, estado propio porque no es un workspace
  useEffect(() => {
    if (!syncPanelOpen) return
    function onMouseDown(e: MouseEvent) {
      if (asideRef.current && !asideRef.current.contains(e.target as Node)) {
        setSyncPanelOpen(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) { if (e.key === 'Escape') setSyncPanelOpen(false) }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [syncPanelOpen])

  const activeWorkspace =
    WORKSPACES.find((w) =>
      w.paths.some(
        (p) => location.pathname === p || location.pathname.startsWith(p + '/')
      )
    )?.key ?? null

  function toggle(key: WorkspaceKey) {
    setSyncPanelOpen(false)
    setOpenPanel((prev) => (prev === key ? null : key))
  }

  function close() {
    setOpenPanel(null)
  }

  function toggleSyncPanel() {
    setOpenPanel(null)
    setSyncPanelOpen((p) => !p)
  }

  return (
    <aside
      ref={asideRef}
      className="flex-shrink-0 bg-slate-800 border-r border-slate-700 flex flex-col relative"
      style={{ width: 60 }}
    >
      {/* Logo — ascending bar-chart mark + wordmark + version */}
      <div className="flex flex-col items-center justify-center py-3 gap-1 border-b border-slate-700">
        <svg width="22" height="22" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <rect x="9"  y="29" width="8" height="11" rx="2.5" fill="#4b566a" />
          <rect x="19" y="20" width="8" height="20" rx="2.5" fill="#0e88b6" />
          <rect x="29" y="11" width="8" height="29" rx="2.5" fill="#2bd0ef" />
        </svg>
        <span className="text-[9px] font-bold tracking-widest text-slate-300 uppercase leading-none">Summit</span>
        {version && <span className="text-[8px] text-slate-500 leading-none">{version}</span>}
      </div>

      {/* Home button */}
      <div className="flex items-center justify-center py-1.5 border-b border-slate-700">
        <NavLink
          to="/"
          end
          title="Pantalla de inicio"
          className={({ isActive }) =>
            cn(
              'w-full rounded-xl flex flex-col items-center justify-center gap-[3px] py-[7px] transition-all duration-100',
              isActive ? 'text-indigo-400 bg-indigo-400/15' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700'
            )
          }
        >
          <Home size={15} />
          <span className="text-[8px] leading-none font-medium tracking-wide">Home</span>
        </NavLink>
      </div>

      {/* Workspace buttons */}
      <nav className="flex-1 flex flex-col items-center gap-1 py-3" aria-label="Navegación principal">
        {WORKSPACES.map(({ key, label, Icon, color, activeBg }) => {
          const highlighted = activeWorkspace === key || openPanel === key
          return (
            <button
              key={key}
              title={label}
              aria-label={label}
              onClick={() => toggle(key)}
              className="w-full rounded-xl flex flex-col items-center justify-center gap-[3px] py-[7px] transition-all duration-100"
              style={{
                color: highlighted ? color : '#64748b',
                background: highlighted ? activeBg : 'transparent',
              }}
            >
              <Icon size={15} />
              <span className="text-[8px] leading-none font-medium tracking-wide">{label}</span>
            </button>
          )
        })}
      </nav>

      {/* Bottom: Estado de sync (PowerSync + Drive) + logout */}
      <div className="flex flex-col items-center gap-1 py-3 border-t border-slate-700">

        {/* Estado agregado — un solo ícono, siempre visible, sin abrir nada */}
        <div className="relative w-full">
          <button
            onClick={toggleSyncPanel}
            title={
              syncSeverity === 'err'  ? 'Hay un error de sincronización — click para ver detalle'
              : syncSeverity === 'warn' ? 'Sincronización con avisos — click para ver detalle'
              : 'Todo sincronizado'
            }
            className={cn(
              'relative w-full rounded-xl flex flex-col items-center justify-center gap-[3px] py-[7px] transition-all duration-100',
              syncPanelOpen
                ? 'text-slate-200 bg-slate-700'
                : syncSeverity === 'err'
                  ? 'text-red-400 hover:text-red-300 hover:bg-red-900/25'
                  : syncSeverity === 'warn'
                    ? 'text-amber-400 hover:text-amber-200 hover:bg-amber-900/25'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            )}
          >
            {psSyncing
              ? <RefreshCw size={15} className="animate-spin" />
              : <Activity size={15} />
            }
            <span
              className={cn(
                'absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full',
                psSyncing              ? 'bg-indigo-400'
                : syncSeverity === 'err'  ? 'bg-red-400'
                : syncSeverity === 'warn' ? 'bg-amber-400'
                : 'bg-emerald-400'
              )}
            />
            <span className="text-[8px] leading-none font-medium tracking-wide">Estado</span>
          </button>

          {/* Popover de detalle — PowerSync + Drive, mismo contenido que antes vivía escondido en Configuración */}
          {syncPanelOpen && (
            <div
              className="absolute left-full bottom-0 ml-2 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-xl p-3 space-y-2"
              style={{ width: 260, boxShadow: '4px 0 20px rgba(0,0,0,.45)' }}
            >
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold px-0.5">
                Estado de sincronización
              </p>

              <SyncStatusBadge />

              {/* Google Drive */}
              <div
                onClick={() => syncStatus?.isAuthenticated && !syncMutation.isPending && syncMutation.mutate()}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-950 border border-slate-700 select-none',
                  syncStatus?.isAuthenticated ? 'text-emerald-400 cursor-pointer' : 'text-amber-400 cursor-default'
                )}
              >
                {syncMutation.isPending
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Cloud size={14} />
                }
                <span className="flex-1 truncate">
                  {syncStatus?.isAuthenticated
                    ? `Drive · ${formatLastSync(syncStatus.lastSync)}`
                    : 'Drive no conectado'}
                </span>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={async () => {
            const ok = await confirm({ message: '¿Cerrar sesión? Vas a volver a la pantalla de inicio de sesión.' })
            if (!ok) return
            await window.api.auth.logout()
            queryClient.clear()
          }}
          title="Cerrar sesión"
          className="w-full rounded-xl flex flex-col items-center justify-center gap-[3px] py-[7px] text-slate-500 hover:text-amber-400 hover:bg-amber-900/30 transition-all duration-100"
        >
          <UserX size={15} />
          <span className="text-[8px] leading-none font-medium tracking-wide">Cerrar sesión</span>
        </button>

        <button
          onClick={() => {
            confirm({ message: '¿Salir de Summit? Se va a cerrar la aplicación por completo.' }).then(ok => { if (ok) window.api.app.quit() })
          }}
          title="Salir"
          className="w-full rounded-xl flex flex-col items-center justify-center gap-[3px] py-[7px] text-slate-500 hover:text-red-400 hover:bg-red-900/30 transition-all duration-100"
        >
          <LogOut size={15} />
          <span className="text-[8px] leading-none font-medium tracking-wide">Salir</span>
        </button>
      </div>

      {/* Floating panel */}
      {openPanel && (
        <div
          className="absolute top-0 left-full h-full z-50 bg-slate-800 border-r border-slate-600 overflow-y-auto"
          style={{ width: 220, boxShadow: '4px 0 20px rgba(0,0,0,.45)' }}
        >

          {openPanel === 'trabajo' && (
            <div className="p-2 space-y-0.5">
              <GroupLabel label="Tareas personales" color="#818cf8" />
              {canRead('tasks') && (
                <>
                  <PanelLink to="/tasks"   icon={LayoutList} label="Lista — Tareas"  end   color="#818cf8" onClick={close} />
                  <PanelLink to="/kanban"  icon={Columns3}   label="Kanban — Tareas" end   color="#818cf8" onClick={close} />
                </>
              )}
              {canRead('team') && (
                <>
                  <GroupLabel label="Tareas Equipo" color="#818cf8" />
                  <PanelLink to="/team"        icon={Users}    label="Lista — Equipo"  end   color="#818cf8" onClick={close} />
                  <PanelLink to="/team/kanban" icon={Columns3} label="Kanban — Equipo"       color="#818cf8" onClick={close} />
                </>
              )}
              {canRead('messages') && (
                <PanelLink to="/messages" icon={Send} label="Mensajes" color="#818cf8" onClick={close} />
              )}

              {projects && projects.length > 0 && (
                <>
                  <div className="border-t border-slate-700 my-2" />
                  <GroupLabel label="Proyectos" color="#818cf8" />
                  <button
                    onClick={() => { setFilter('project_id', undefined); close() }}
                    className={cn(
                      'w-full text-left px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                      !filters.project_id
                        ? 'text-slate-100'
                        : 'text-slate-400 hover:bg-slate-700/60 hover:text-slate-200'
                    )}
                  >
                    Todos
                  </button>
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setFilter('project_id', p.id); close() }}
                      className={cn(
                        'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                        filters.project_id === p.id
                          ? 'text-slate-100'
                          : 'text-slate-400 hover:bg-slate-700/60 hover:text-slate-200'
                      )}
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                      <span className="truncate">{p.name}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}

          {openPanel === 'empresa' && (
            <div className="p-2 space-y-0.5">
              <GroupLabel label="Empresa" color="#fb923c" />
              {canRead('knowledge') && (
                <PanelLink to="/knowledge" icon={Brain} label="Knowledge" color="#fb923c" onClick={close} />
              )}
              {canRead('quotes') && (
                <PanelLink to="/quotes" icon={FileText} label="Presupuestos" color="#fb923c" onClick={close} />
              )}
            </div>
          )}

          {openPanel === 'comex' && (
            <div className="p-2 space-y-0.5">
              <GroupLabel label="Comex" color="#f59e0b" />
              {comexSubItems.map((it) => (
                <PanelLink
                  key={it.to}
                  to={it.to}
                  icon={it.Icon}
                  label={it.label}
                  end={it.end}
                  color="#f59e0b"
                  onClick={close}
                />
              ))}
            </div>
          )}

          {openPanel === 'finanzas' && (
            <div className="p-2 space-y-0.5">
              <GroupLabel label="Contable" color="#34d399" />
              {canRead('finance') && (
                <PanelLink to="/finance"         icon={Wallet}          label="Fin. Personal" color="#34d399" onClick={close} />
              )}
              {canRead('company_finance') && (
                <PanelLink to="/company-finance" icon={Building2}       label="Fin. Empresa"  color="#34d399" onClick={close} />
              )}
              {canRead('expiry') && (
                <PanelLink to="/expiry"          icon={Clock}           label="Vencimientos"  color="#34d399" onClick={close} />
              )}
              {canRead('contable') && (
                <PanelLink to="/contable/recon"         icon={ArrowLeftRight}  label="Conciliador"    color="#34d399" onClick={close} />
              )}
              {canRead('contable', 'mercadopago') && (
                <PanelLink to="/contable/mercadopago"   icon={CreditCard}      label="Mercado Pago"   color="#34d399" onClick={close} />
              )}
              {canRead('contable', 'servicios') && (
                <PanelLink to="/contable/servicios"     icon={Repeat}          label="Servicios"      color="#34d399" onClick={close} />
              )}
              {canRead('contable', 'cajas') && (
                <PanelLink to="/contable/cajas"         icon={Banknote}        label="Cajas"          color="#34d399" onClick={close} />
              )}
            </div>
          )}

          {openPanel === 'agenda' && (
            <div className="p-2 space-y-0.5">
              <GroupLabel label="Agenda" color="#60a5fa" />
              {canRead('contacts') && (
                <PanelLink to="/agenda/contactos" icon={UserCircle2} label="Contactos"  color="#60a5fa" onClick={close} />
              )}
              {canRead('contacts') && (
                <PanelLink to="/agenda/grupos"    icon={Users}       label="Grupos"     color="#60a5fa" onClick={close} />
              )}
              {canRead('calendar') && (
                <PanelLink to="/calendario" icon={CalendarDays} label="Calendario" color="#60a5fa" onClick={close} />
              )}
              {canRead('email') && (
                <PanelLink to="/email" icon={Mail} label="Correo" color="#60a5fa" onClick={close} />
              )}
            </div>
          )}

          {openPanel === 'rrhh' && (
            <div className="p-2 space-y-0.5">
              <GroupLabel label="NAKA" color="#f472b6" />
              {canRead('rrhh', 'sueldos') && (
                <PanelLink to="/rrhh/sueldos/naka" icon={Users} label="Sueldos NAKA" color="#f472b6" onClick={close} />
              )}
              {canRead('rrhh', 'nomina') && (
                <PanelLink to="/rrhh/nomina/naka" icon={BookUser} label="Nómina NAKA" color="#f472b6" onClick={close} />
              )}
              <GroupLabel label="Estación Vertical" color="#f472b6" />
              {canRead('rrhh', 'sueldos') && (
                <PanelLink to="/rrhh/sueldos/ev" icon={Users} label="Sueldos EV" color="#f472b6" onClick={close} />
              )}
              {canRead('rrhh', 'nomina') && (
                <PanelLink to="/rrhh/nomina/ev" icon={BookUser} label="Nómina EV" color="#f472b6" onClick={close} />
              )}
            </div>
          )}

          {openPanel === 'mantenimiento' && (
            <div className="p-2 space-y-0.5">
              <GroupLabel label="Mantenimiento" color="#818cf8" />
              {canRead('maintenance') && (
                <PanelLink to="/mantenimiento" icon={Wrench} label="Dashboard" end color="#818cf8" onClick={close} />
              )}
              {canRead('maintenance') && (
                <PanelLink to="/mantenimiento/catalogos" icon={Settings} label="Catálogos" color="#818cf8" onClick={close} />
              )}
              <GroupLabel label="NAKA" color="#818cf8" />
              {canRead('maintenance') && (
                <PanelLink to="/mantenimiento/naka" icon={Wrench} label="Tareas Naka" color="#818cf8" onClick={close} />
              )}
              <GroupLabel label="Estación Vertical" color="#818cf8" />
              {canRead('maintenance') && (
                <PanelLink to="/mantenimiento/ev" icon={Wrench} label="Tareas EV" color="#818cf8" onClick={close} />
              )}
            </div>
          )}

          {openPanel === 'sistema' && (
            <div className="p-2 space-y-0.5">
              <GroupLabel label="Configuración" color="#a78bfa" />
              {canRead('settings') && (
                <>
                  <PanelLink to="/settings/general"  icon={Settings}     label="General"                 color="#a78bfa" onClick={close} />
                  <PanelLink to="/settings/sync"     icon={RefreshCw}    label="Sincronización"          color="#a78bfa" onClick={close} />
                  <PanelLink to="/settings/ia"       icon={Brain}        label="Inteligencia Artificial" color="#a78bfa" onClick={close} />
                  {isAdmin && (
                    <PanelLink to="/settings/permisos" icon={ShieldCheck} label="Permisos"                color="#a78bfa" onClick={close} />
                  )}
                </>
              )}
              {canRead('cortex') && (
                <PanelLink to="/cortex" icon={Network} label="Cortex" color="#a78bfa" onClick={close} />
              )}
            </div>
          )}

        </div>
      )}
    </aside>
  )
}
