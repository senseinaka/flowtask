import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  CalendarConnectionStatus,
  GoogleCalendarInfo,
  UnifiedCalendarEvent,
  CalendarEventInput,
  CalendarEventLink,
  LinkEntityInput,
  AuthSession
} from '@shared/types'

export function useAuthSession() {
  return useQuery<AuthSession | null>({
    queryKey: ['auth', 'session'],
    queryFn: () => window.api.auth.getSession()
  })
}

export function useCalendarStatus() {
  return useQuery<CalendarConnectionStatus>({
    queryKey: ['calendar', 'status'],
    queryFn: () => window.api.calendar.status()
  })
}

export function useCalendarEvents(range: { start: number; end: number }) {
  return useQuery<UnifiedCalendarEvent[]>({
    queryKey: ['calendar', 'events', range.start, range.end],
    queryFn: () => window.api.calendar.getEvents(range.start, range.end)
  })
}

export function useEnabledCalendars(enabled = false) {
  return useQuery<GoogleCalendarInfo[]>({
    queryKey: ['calendar', 'calendars'],
    queryFn: () => window.api.calendar.listCalendars(),
    enabled // se habilita explícitamente desde la UI cuando hay conexión
  })
}

export function useConnectGoogle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => window.api.calendar.connect(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar'] })
    }
  })
}

export function useDisconnectGoogle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => window.api.calendar.disconnect(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar'] })
    }
  })
}

export function useSyncNow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => window.api.calendar.syncNow(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar'] })
    }
  })
}

export function useSetEnabledCalendars() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (calendarIds: string[]) => window.api.calendar.setEnabledCalendars(calendarIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar'] })
    }
  })
}

// ── Fase 2: escritura manual de eventos ─────────────────────────────────────

export function useCreateManualEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ calendarId, input }: { calendarId: string; input: CalendarEventInput }) =>
      window.api.calendar.createEvent(calendarId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar', 'events'] })
  })
}

export function useUpdateManualEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ calendarId, googleEventId, input }: { calendarId: string; googleEventId: string; input: CalendarEventInput }) =>
      window.api.calendar.updateEvent(calendarId, googleEventId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar', 'events'] })
  })
}

export function useDeleteManualEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ calendarId, googleEventId }: { calendarId: string; googleEventId: string }) =>
      window.api.calendar.deleteEvent(calendarId, googleEventId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar', 'events'] })
  })
}

// ── Fase 2: links opt-in con Finanzas/Comex ─────────────────────────────────

export function useEventLinks(sourceModule: CalendarEventLink['source_module'], sourceEventIds: string[]) {
  return useQuery<CalendarEventLink[]>({
    queryKey: ['calendar', 'links', sourceModule, sourceEventIds],
    queryFn: () => window.api.calendar.getLinks(sourceModule, sourceEventIds),
    enabled: sourceEventIds.length > 0
  })
}

export function useLinkEntity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: LinkEntityInput) => window.api.calendar.linkEntity(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar', 'links'] })
      qc.invalidateQueries({ queryKey: ['calendar', 'events'] })
    }
  })
}

export function useUnlinkEntity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (linkId: string) => window.api.calendar.unlinkEntity(linkId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar', 'links'] })
      qc.invalidateQueries({ queryKey: ['calendar', 'events'] })
    }
  })
}

export function useRefreshLinkedEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ linkId, input }: { linkId: string; input: { title: string; dueAtMs: number } }) =>
      window.api.calendar.refreshLinkedEvent(linkId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar', 'links'] })
      qc.invalidateQueries({ queryKey: ['calendar', 'events'] })
    }
  })
}
