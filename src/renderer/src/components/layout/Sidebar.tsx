import React, { useState, useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutList, Columns3, Settings, Loader2,
  Users, UserCircle2, Send, Globe2, Package, Building2, Ship, Truck,
  ShieldCheck, Briefcase, LayoutDashboard, Clock, Wallet,
  CalendarClock, LogOut, CalendarDays, FileText, Mail,
  ArrowLeftRight, Brain, Network, Cloud, BookUser, CreditCard, Repeat, Home,
  Database, RefreshCw, DollarSign, Banknote
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
import { useUIStore } from '../../store/ui.store'
import { useQuery, useMutation } from '@tanstack/react-query'
import type { SyncStatus } from '@shared/types'
import { cn } from '../ui/utils'
import SyncStatusBadge from './SyncStatusBadge'

// ── Workspace definitions ─────────────────────────────────────────────────────

type WorkspaceKey = 'trabajo' | 'empresa' | 'comex' | 'finanzas' | 'agenda' | 'rrhh' | 'sistema'

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
    label: 'Trabajo',
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
    key: 'sistema',
    label: 'Sistema',
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
  const { filters, setFilter } = useUIStore()
  const { canRead } = usePermissions()
  const location = useLocation()
  const asideRef = useRef<HTMLElement>(null)

  const [openPanel, setOpenPanel] = useState<WorkspaceKey | null>(null)

  const comexSubItems: {
    to: string
    Icon: LucideIcon
    label: string
    end?: boolean
    subKey: string
  }[] = [
    { to: '/comex',               Icon: LayoutDashboard, label: 'Dashboard',             end: true, subKey: 'dashboard' },
    { to: '/comex/imports',       Icon: Package,         label: 'Importaciones',                    subKey: 'imports' },
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
  const [psReconnecting, setPsReconnecting] = useState(false)
  const psConnected    = (psStatus?.connected ?? false) && !psStatus?.hasError
  const psHasError     = (psStatus?.connected ?? false) && (psStatus?.hasError ?? false)
  const psDisconnected = !!psStatus && !psStatus.connected && !psStatus.connecting && !psStatus.configError

  async function handlePsReconnect() {
    if (psReconnecting || (!psDisconnected && !psHasError)) return
    setPsReconnecting(true)
    try {
      await window.api.powersync.reconnect()
    } catch {
      // el listener powersync:status actualizará el estado
    } finally {
      setTimeout(() => setPsReconnecting(false), 4000)
    }
  }

  // Auto-limpiar spinner si PowerSync reconectó antes del timeout
  useEffect(() => {
    if (psConnected && psReconnecting) setPsReconnecting(false)
  }, [psConnected])

  // Close on navigation
  useEffect(() => {
    setOpenPanel(null)
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

  const activeWorkspace =
    WORKSPACES.find((w) =>
      w.paths.some(
        (p) => location.pathname === p || location.pathname.startsWith(p + '/')
      )
    )?.key ?? null

  function toggle(key: WorkspaceKey) {
    setOpenPanel((prev) => (prev === key ? null : key))
  }

  function close() {
    setOpenPanel(null)
  }

  return (
    <aside
      ref={asideRef}
      className="flex-shrink-0 bg-slate-800 border-r border-slate-700 flex flex-col relative"
      style={{ width: 60 }}
    >
      {/* Logo — ascending bar-chart mark (bars-only on dark rail) */}
      <div className="flex items-center justify-center py-[18px] border-b border-slate-700">
        <svg width="26" height="26" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <rect x="9"  y="29" width="8" height="11" rx="2.5" fill="#4b566a" />
          <rect x="19" y="20" width="8" height="20" rx="2.5" fill="#0e88b6" />
          <rect x="29" y="11" width="8" height="29" rx="2.5" fill="#2bd0ef" />
        </svg>
      </div>

      {/* Home button */}
      <div className="flex items-center justify-center py-2 border-b border-slate-700">
        <NavLink
          to="/"
          end
          title="Pantalla de inicio"
          className={({ isActive }) =>
            cn(
              'w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-100',
              isActive ? 'text-indigo-400 bg-indigo-400/15' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700'
            )
          }
        >
          <Home size={15} />
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

      {/* Bottom: PowerSync + Drive + logout */}
      <div className="flex flex-col items-center gap-1 py-3 border-t border-slate-700">

        {/* PowerSync status — siempre visible; clickeable para reconectar si está desconectado o con error */}
        <button
          onClick={handlePsReconnect}
          disabled={psConnected || psReconnecting}
          title={
            psReconnecting   ? 'Reconectando...'
            : psConnected    ? 'Sync conectado'
            : psHasError     ? 'Error de sync — click para reconectar'
            : psDisconnected ? 'Sin conexión — click para reconectar'
            : 'Sync'
          }
          className={cn(
            'relative w-full rounded-xl flex flex-col items-center justify-center gap-[3px] py-[7px] transition-all duration-100',
            psReconnecting
              ? 'text-indigo-400 cursor-default'
              : psConnected
                ? 'text-slate-400 cursor-default'
                : (psDisconnected || psHasError)
                  ? 'text-amber-400 hover:text-amber-200 hover:bg-amber-900/25 cursor-pointer'
                  : 'text-slate-600 cursor-default'
          )}
        >
          {psReconnecting
            ? <RefreshCw size={15} className="animate-spin" />
            : <Database size={15} />
          }
          {/* dot indicador */}
          <span
            className={cn(
              'absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full',
              psReconnecting    ? 'bg-indigo-400'
              : psConnected     ? 'bg-emerald-400'
              : psHasError      ? 'bg-amber-400'
              : psDisconnected  ? 'bg-amber-400'
              : 'bg-slate-600'
            )}
          />
          <span className="text-[8px] leading-none font-medium tracking-wide">Sync</span>
        </button>

        {/* Google Drive */}
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending || !syncStatus?.isAuthenticated}
          title={syncStatus?.isAuthenticated ? 'Sincronizar Google Drive' : 'Drive no conectado'}
          className={cn(
            'relative w-full rounded-xl flex flex-col items-center justify-center gap-[3px] py-[7px] transition-all duration-100',
            syncStatus?.isAuthenticated
              ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              : 'text-slate-600 cursor-not-allowed'
          )}
        >
          {syncMutation.isPending
            ? <Loader2 size={15} className="animate-spin" />
            : <Cloud size={15} />
          }
          {syncStatus?.isAuthenticated && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
          )}
          <span className="text-[8px] leading-none font-medium tracking-wide">Drive</span>
        </button>

        <button
          onClick={() => {
            if (confirm('¿Salir de Summit? Se va a cerrar la aplicación por completo.')) {
              window.api.app.quit()
            }
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
          style={{ width: 148, boxShadow: '4px 0 20px rgba(0,0,0,.45)' }}
        >

          {openPanel === 'trabajo' && (
            <div className="p-2 space-y-0.5">
              <GroupLabel label="Trabajo" color="#818cf8" />
              {canRead('tasks') && (
                <>
                  <PanelLink to="/tasks"   icon={LayoutList} label="Lista — Tareas"  end   color="#818cf8" onClick={close} />
                  <PanelLink to="/kanban"  icon={Columns3}   label="Kanban — Tareas" end   color="#818cf8" onClick={close} />
                </>
              )}
              {canRead('team') && (
                <>
                  <GroupLabel label="Equipo" color="#818cf8" />
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
                <PanelLink to="/contable/cajas"         icon={Vault}           label="Cajas"          color="#34d399" onClick={close} />
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
              {canRead('rrhh', 'sueldos') && (
                <PanelLink to="/rrhh/nomina/naka" icon={BookUser} label="Nómina NAKA" color="#f472b6" onClick={close} />
              )}
              <GroupLabel label="Estación Vertical" color="#f472b6" />
              {canRead('rrhh', 'sueldos') && (
                <PanelLink to="/rrhh/sueldos/ev" icon={Users} label="Sueldos EV" color="#f472b6" onClick={close} />
              )}
              {canRead('rrhh', 'sueldos') && (
                <PanelLink to="/rrhh/nomina/ev" icon={BookUser} label="Nómina EV" color="#f472b6" onClick={close} />
              )}
            </div>
          )}

          {openPanel === 'sistema' && (
            <div className="p-2 space-y-0.5">
              <GroupLabel label="Sistema" color="#a78bfa" />
              {canRead('cortex') && (
                <PanelLink to="/cortex"    icon={Network}  label="Cortex"         color="#a78bfa" onClick={close} />
              )}
              {canRead('settings') && (
                <PanelLink to="/settings"  icon={Settings} label="Configuración"  color="#a78bfa" onClick={close} />
              )}
              <div className="border-t border-slate-700 mt-3 mb-2" />
              <div className="px-1">
                <SyncStatusBadge />
              </div>
            </div>
          )}

        </div>
      )}
    </aside>
  )
}
