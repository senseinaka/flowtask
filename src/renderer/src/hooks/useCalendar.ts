import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { CalendarConnectionStatus, GoogleCalendarInfo, UnifiedCalendarEvent } from '@shared/types'

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

export function useEnabledCalendars() {
  return useQuery<GoogleCalendarInfo[]>({
    queryKey: ['calendar', 'calendars'],
    queryFn: () => window.api.calendar.listCalendars(),
    enabled: false // se habilita explícitamente desde la UI cuando hay conexión
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
