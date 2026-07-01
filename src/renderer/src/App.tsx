import { useEffect, useState, useRef, type ReactNode } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Bot, Loader2, ShieldOff } from 'lucide-react'
import Sidebar from './components/layout/Sidebar'
import TaskFormModal from './components/tasks/TaskFormModal'
import TaskDetail from './components/tasks/TaskDetail'
import TeamTaskFormModal from './components/tasks/TeamTaskFormModal'
import TeamTaskDetail from './components/tasks/TeamTaskDetail'
import ChatPanel from './components/chat/ChatPanel'
import Login from './routes/Login'
import { useUIStore } from './store/ui.store'
import { usePermissions } from './hooks/usePermissions'
import type { AuthSession } from '@shared/types'
import ToastContainer from './components/feedback/ToastContainer'
import ConfirmDialog from './components/feedback/ConfirmDialog'
import { toast } from './store/toast.store'

export default function App() {
  const location = useLocation()
  const navigate  = useNavigate()

  const {
    isTaskFormOpen,
    expandedTaskId, closeExpandedTask,
    isTeamTaskFormOpen,
    expandedTeamTaskId, closeExpandedTeamTask,
    setSelectedTask
  } = useUIStore()

  // Fase 6.4: sesión de Supabase Auth
  const [session, setSession] = useState<AuthSession | null | undefined>(undefined)

  useEffect(() => {
    window.api.auth.getSession().then(setSession)
    window.api.on('auth:sessionChanged', (data) => setSession(data as AuthSession | null))
    return () => window.api.off('auth:sessionChanged')
  }, [])

  // ── Redirección inicial: si la pantalla de inicio está desactivada, ir a /tasks ──
  const didInitRef = useRef(false)
  useEffect(() => {
    if (!session || didInitRef.current) return
    didInitRef.current = true
    if (location.pathname !== '/') return
    window.api.wallpaper.getConfig().then(cfg => {
      if (!cfg.enabled) navigate('/tasks', { replace: true })
    })
  }, [session]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Screensaver: navegar a / tras N minutos de inactividad ───────────────────
  const screensaverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function scheduleScreensaver() {
      window.api.wallpaper.getConfig().then(cfg => {
        if (screensaverTimerRef.current) clearTimeout(screensaverTimerRef.current)
        if (!cfg.screensaver_enabled) return
        const ms = (cfg.screensaver_timeout_minutes ?? 5) * 60 * 1000
        screensaverTimerRef.current = setTimeout(() => {
          if (location.pathname !== '/') {
            navigate('/', { state: { fromScreensaver: true, returnTo: location.pathname } })
          }
        }, ms)
      })
    }

    function resetTimer() {
      if (location.pathname === '/') return
      scheduleScreensaver()
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'wheel'] as const
    events.forEach(e => window.addEventListener(e, resetTimer))
    scheduleScreensaver()

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer))
      if (screensaverTimerRef.current) clearTimeout(screensaverTimerRef.current)
    }
  }, [location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close personal expanded modal with ESC
  useEffect(() => {
    if (!expandedTaskId) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeExpandedTask() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expandedTaskId, closeExpandedTask])

  // Close team task expanded modal with ESC
  useEffect(() => {
    if (!expandedTeamTaskId) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeExpandedTeamTask() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expandedTeamTaskId, closeExpandedTeamTask])
  const queryClient = useQueryClient()
  const [chatOpen,    setChatOpen]    = useState(false)
  const [alertCount,  setAlertCount]  = useState(0)

  useEffect(() => {
    window.api.on('question:answered', (data) => {
      const d = data as { taskTitle: string; answer: string; actionTaken: string | null; taskId: string; questionId: string }
      const msg = [d.taskTitle, `"${d.answer}"`, d.actionTaken].filter(Boolean).join('\n')
      toast.show({ variant: 'success', title: 'Respuesta recibida', message: msg, duration: 6000 })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['task', d.taskId] })
      queryClient.invalidateQueries({ queryKey: ['task-questions', d.taskId] })
    })
    return () => window.api.off('question:answered')
  }, [queryClient])

  // Badge de alertas proactivas en el botón flotante
  useEffect(() => {
    window.api.on('chat:proactiveAlerts', (data) => {
      const alerts = data as { id: string }[]
      if (alerts.length > 0) setAlertCount(prev => prev + alerts.length)
    })
    return () => window.api.off('chat:proactiveAlerts')
  }, [])

  // Fase 6.4: gating de la app — sin sesión válida, mostrar Login en vez
  // del layout normal.
  if (session === undefined) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-slate-100">
        <Loader2 size={24} className="animate-spin text-slate-500" />
      </div>
    )
  }

  if (session === null) {
    return <Login onSuccess={setSession} />
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-900 text-slate-100">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <main className="flex flex-col flex-1 overflow-hidden">
          <RouteGuard>
            <Outlet />
          </RouteGuard>
        </main>
      </div>
      {isTaskFormOpen && <TaskFormModal />}
      {isTeamTaskFormOpen && <TeamTaskFormModal />}

      {/* Task detail modal — personal tasks, opens on double-click or ⤢ button */}
      {expandedTaskId && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={closeExpandedTask}
          style={{ animation: 'fadeIn 0.15s ease-out' }}
        >
          <div
            className="relative bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden"
            style={{
              width: 'min(860px, 90vw)',
              height: 'min(92vh, 900px)',
              animation: 'scaleIn 0.15s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <TaskDetail modal onClose={closeExpandedTask} />
          </div>
        </div>
      )}

      {/* Team task detail modal — opens on double-click or ⤢ button */}
      {expandedTeamTaskId && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={closeExpandedTeamTask}
          style={{ animation: 'fadeIn 0.15s ease-out' }}
        >
          <div
            className="relative bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden"
            style={{
              width: 'min(860px, 90vw)',
              height: 'min(92vh, 900px)',
              animation: 'scaleIn 0.15s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <TeamTaskDetail modal onClose={closeExpandedTeamTask} />
          </div>
        </div>
      )}

      {/* ── Chat AI: botón flotante + panel ─────────────────────────────── */}
      <ChatPanel isOpen={chatOpen} onClose={() => setChatOpen(false)} />
      <button
        onClick={() => { setChatOpen(v => !v); setAlertCount(0) }}
        className="fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full bg-violet-600 hover:bg-violet-500 shadow-lg shadow-violet-900/50 flex items-center justify-center transition-all hover:scale-110 active:scale-95 relative"
        title="Asistente IA"
      >
        <Bot size={20} className="text-white" />
        {alertCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-orange-500 text-[10px] font-bold text-white flex items-center justify-center shadow-md">
            {alertCount > 9 ? '9+' : alertCount}
          </span>
        )}
      </button>

      <ToastContainer />
      <ConfirmDialog />
    </div>
  )
}

// Fase 6.5: bloquea rutas a las que el usuario no tiene acceso de lectura.
function RouteGuard({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { canReadPath, isLoading } = usePermissions()

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 size={24} className="animate-spin text-slate-500" />
      </div>
    )
  }

  if (!canReadPath(location.pathname)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-400">
        <ShieldOff size={32} className="text-slate-500" />
        <p className="text-sm">No tenés permiso para acceder a esta sección.</p>
      </div>
    )
  }

  return <>{children}</>
}
