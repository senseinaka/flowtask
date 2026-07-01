import { Circle, ArrowRight, Clock } from 'lucide-react'
import type { TaskStatusLogEntry, TaskType } from '@shared/types'
import { STATUS_LABELS, DELEGATED_STATUS_LABELS } from '@shared/types'
import { useTaskLog } from '../../hooks/useTaskLog'
import { cn } from '../ui/utils'

// ── Label helpers ─────────────────────────────────────────────────────────────

function statusLabel(status: string | null, taskType: TaskType): string {
  if (!status) return 'Creada'
  // 'personal' y 'team' comparten el mismo enum de TaskStatus; solo 'delegated'
  // (tareas asignadas a contactos) usa DelegatedStatus.
  if (taskType === 'delegated') {
    return DELEGATED_STATUS_LABELS[status as keyof typeof DELEGATED_STATUS_LABELS] ?? status
  }
  return STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status
}

// Status → color dot
const STATUS_DOT: Record<string, string> = {
  pending:    'bg-yellow-400',
  in_progress:'bg-blue-400',
  blocked:    'bg-red-400',
  done:       'bg-emerald-400',
  cancelled:  'bg-slate-500'
}

function statusDot(status: string | null): string {
  if (!status) return 'bg-slate-400'
  return STATUS_DOT[status] ?? 'bg-slate-400'
}

// Relative time
function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 1)  return 'ahora'
  if (mins < 60) return `hace ${mins} min`
  if (hours < 24) return `hace ${hours} h`
  if (days < 7)  return `hace ${days} d`
  return new Date(ts).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fullDate(ts: number): string {
  return new Date(ts).toLocaleString('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

// ── Single entry ──────────────────────────────────────────────────────────────

function TimelineEntry({
  entry,
  taskType,
  isLast
}: {
  entry: TaskStatusLogEntry
  taskType: TaskType
  isLast: boolean
}) {
  const isCreation = entry.from_status === null

  return (
    <div className="flex gap-3">
      {/* Left: dot + line */}
      <div className="flex flex-col items-center">
        <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5', statusDot(entry.to_status))} />
        {!isLast && <div className="w-px flex-1 bg-slate-700 mt-1" />}
      </div>

      {/* Right: content */}
      <div className={cn('pb-4 min-w-0', isLast && 'pb-1')}>
        <div className="flex items-center gap-1.5 flex-wrap">
          {isCreation ? (
            <span className="text-xs text-slate-300 font-medium">
              Tarea creada
              <span className="ml-1 text-slate-500">→</span>
              <span className={cn('ml-1 font-semibold', statusDot(entry.to_status).replace('bg-', 'text-'))}>
                {statusLabel(entry.to_status, taskType)}
              </span>
            </span>
          ) : (
            <span className="text-xs text-slate-300 font-medium flex items-center gap-1">
              <span className="text-slate-500">{statusLabel(entry.from_status, taskType)}</span>
              <ArrowRight size={10} className="text-slate-600 flex-shrink-0" />
              <span className="font-semibold text-slate-200">{statusLabel(entry.to_status, taskType)}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-0.5" title={fullDate(entry.changed_at)}>
          <Clock size={9} className="text-slate-600 flex-shrink-0" />
          <span className="text-[10px] text-slate-600">{relativeTime(entry.changed_at)}</span>
          <span className="text-[10px] text-slate-700">·</span>
          <span className="text-[10px] text-slate-700">{fullDate(entry.changed_at)}</span>
        </div>
        {entry.note && (
          <p className="text-[11px] text-slate-500 mt-0.5 italic">{entry.note}</p>
        )}
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export function ActivityTimeline({
  taskId,
  taskType = 'personal'
}: {
  taskId: string | null | undefined
  taskType?: TaskType
}) {
  const { data: log = [], isLoading } = useTaskLog(taskId, taskType)

  if (!taskId) return null

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        <Circle size={12} className="text-slate-500" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Historial de estados</span>
      </div>

      {isLoading ? (
        <p className="text-xs text-slate-600 pl-4">Cargando...</p>
      ) : log.length === 0 ? (
        <p className="text-xs text-slate-600 pl-4">Sin registros aún.</p>
      ) : (
        <div className="pl-1">
          {log.map((entry, i) => (
            <TimelineEntry
              key={entry.id}
              entry={entry}
              taskType={taskType}
              isLast={i === log.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
