import { useEffect, useState, useCallback } from 'react'
import { Outlet } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { MessageCircleQuestion, X } from 'lucide-react'
import Sidebar from './components/layout/Sidebar'
import TopBar from './components/layout/TopBar'
import TaskFormModal from './components/tasks/TaskFormModal'
import TaskDetail from './components/tasks/TaskDetail'
import DelegatedTaskDetail from './components/tasks/DelegatedTaskDetail'
import { useUIStore } from './store/ui.store'

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
  const [toasts, setToasts] = useState<Toast[]>([])

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

  return (
    <div className="flex h-screen overflow-hidden bg-slate-900 text-slate-100">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />
        <main className="flex flex-col flex-1 overflow-hidden">
          <Outlet />
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

      {/* Toast notifications for incoming WhatsApp answers */}
      {toasts.length > 0 && (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm">
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
