import { useEffect, useState, useCallback, type ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { MessageCircleQuestion, X, Bot, Loader2, ShieldOff } from 'lucide-react'
import Sidebar from './components/layout/Sidebar'
import TaskFormModal from './components/tasks/TaskFormModal'
import TaskDetail from './components/tasks/TaskDetail'
import DelegatedTaskDetail from './components/tasks/DelegatedTaskDetail'
import ChatPanel from './components/chat/ChatPanel'
import Login from './routes/Login'
import { useUIStore } from './store/ui.store'
import { usePermissions } from './hooks/usePermissions'
import type { AuthSession } from '@shared/types'

interface Toast {
  id: number
  taskTitle: string
  answer: string
  actionTaken: string | null
}

let toastCounter = 0

export default function App() {
  const {
    isTaskFormOpen,
    expandedTaskId, closeExpandedTask,
    expandedDelegatedTaskId, closeExpandedDelegatedTask,
    setSelectedTask
  } = useUIStore()

  // Fase 6.4: sesión de Supabase Auth — `undefined` = todavía cargando,
  // `null` = sin sesión (mostrar Login), objeto = autenticado.
  const [session, setSession] = useState<AuthSession | null | undefined>(undefined)

  useEffect(() => {
    window.api.auth.getSession().then(setSession)
    window.api.on('auth:sessionChanged', (data) => setSession(data as AuthSession | null))
    return () => window.api.off('auth:sessionChanged')
  }, [])

  // Close personal expanded modal with ESC
  useEffect(() => {
    if (!expandedTaskId) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeExpandedTask() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expandedTaskId, closeExpandedTask])

  // Close delegated expanded modal with ESC
  useEffect(() => {
    if (!expandedDelegatedTaskId) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeExpandedDelegatedTask() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expandedDelegatedTaskId, closeExpandedDelegatedTask])
  const queryClient = useQueryClient()
  const [toasts,      setToasts]      = useState<Toast[]>([])
  const [chatOpen,    setChatOpen]    = useState(false)
  const [alertCount,  setAlertCount]  = useState(0)

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    window.api.on('question:answered', (data) => {
      const d = data as { taskTitle: string; answer: string; actionTaken: string | null; taskId: string; questionId: string }
      const id = ++toastCounter

      setToasts((prev) => [...prev, { id, taskTitle: d.taskTitle, answer: d.answer, actionTaken: d.actionTaken }])

      // Auto-dismiss after 6 seconds
      setTimeout(() => dismissToast(id), 6000)

      // Invalidate relevant queries so UI updates in real time
      queryClient.invalidateQueries({ queryKey: ['tasks'] })          // lista + kanban
      queryClient.invalidateQueries({ queryKey: ['task', d.taskId] }) // panel de detalle (TaskDetail)
      queryClient.invalidateQueries({ queryKey: ['task-questions', d.taskId] })
    })
    return () => window.api.off('question:answered')
  }, [queryClient, dismissToast])

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

      {/* Delegated task detail modal — opens on double-click or ⤢ button */}
      {expandedDelegatedTaskId && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={closeExpandedDelegatedTask}
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
            <DelegatedTaskDetail modal onClose={closeExpandedDelegatedTask} />
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

      {/* Toast notifications for incoming WhatsApp answers */}
      {toasts.length > 0 && (
        <div className="fixed bottom-5 left-5 z-50 flex flex-col gap-2 max-w-sm">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="bg-slate-800 border border-emerald-700/60 rounded-xl shadow-2xl px-4 py-3 flex items-start gap-3"
              style={{ animation: 'slideInRight 0.2s ease-out' }}
            >
              <div className="w-8 h-8 rounded-full bg-emerald-900/50 flex items-center justify-center flex-shrink-0">
                <MessageCircleQuestion size={15} className="text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white">Respuesta recibida</p>
                {toast.taskTitle && (
                  <p className="text-xs text-slate-400 truncate">{toast.taskTitle}</p>
                )}
                <p className="text-xs text-emerald-300 mt-0.5">
                  &ldquo;{toast.answer}&rdquo;
                </p>
                {toast.actionTaken && (
                  <p className="text-xs text-indigo-400">{toast.actionTaken}</p>
                )}
              </div>
              <button
                onClick={() => dismissToast(toast.id)}
                className="text-slate-500 hover:text-slate-300 flex-shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
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
