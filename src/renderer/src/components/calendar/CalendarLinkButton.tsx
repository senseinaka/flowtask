import { CalendarPlus, CalendarCheck, RefreshCw, X, Loader2 } from 'lucide-react'
import { useLinkEntity, useUnlinkEntity, useRefreshLinkedEvent } from '../../hooks/useCalendar'
import type { CalendarEventLink, LinkEntityInput } from '@shared/types'

/**
 * Botón/badge de vínculo opt-in con Google Calendar para una fila de
 * vencimiento (Finanzas/Finanzas Empresa) o hito (Comex - Programación de
 * Pedidos). Ver plan Fase 2, sección 7.
 */
export function CalendarLinkButton({
  link, currentUserId, sourceModule, sourceType, sourceEventId, title, dueAtMs
}: {
  link: CalendarEventLink | undefined
  currentUserId: string | undefined
  sourceModule: LinkEntityInput['sourceModule']
  sourceType: string
  sourceEventId: string
  title: string
  dueAtMs: number
}) {
  const linkEntity = useLinkEntity()
  const unlinkEntity = useUnlinkEntity()
  const refreshLinkedEvent = useRefreshLinkedEvent()

  if (!link) {
    return (
      <button
        onClick={() => linkEntity.mutate({ sourceModule, sourceType, sourceEventId, title, dueAtMs })}
        disabled={linkEntity.isPending}
        title="Agregar a Google Calendar"
        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-slate-700/50 transition-colors disabled:opacity-50"
      >
        {linkEntity.isPending ? <Loader2 size={14} className="animate-spin" /> : <CalendarPlus size={14} />}
      </button>
    )
  }

  const isOwner = link.owner_user_id === currentUserId

  if (!isOwner) {
    return (
      <span title="En Google Calendar (otra cuenta)" className="p-1.5 text-blue-400">
        <CalendarCheck size={14} />
      </span>
    )
  }

  return (
    <div className="flex items-center gap-0.5">
      <span title="En Google Calendar" className="p-1.5 text-blue-400">
        <CalendarCheck size={14} />
      </span>
      <button
        onClick={() => refreshLinkedEvent.mutate({ linkId: link.id, input: { title, dueAtMs } })}
        disabled={refreshLinkedEvent.isPending}
        title="Actualizar evento en Google Calendar"
        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-slate-700/50 transition-colors disabled:opacity-50"
      >
        {refreshLinkedEvent.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
      </button>
      <button
        onClick={() => unlinkEntity.mutate(link.id)}
        disabled={unlinkEntity.isPending}
        title="Quitar de Google Calendar"
        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-700/50 transition-colors disabled:opacity-50"
      >
        {unlinkEntity.isPending ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
      </button>
    </div>
  )
}
