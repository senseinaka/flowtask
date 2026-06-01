import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Reminder, CreateReminderInput } from '@shared/types'

export function useReminders(taskId: string | null) {
  return useQuery<Reminder[]>({
    queryKey: ['reminders', taskId],
    queryFn: () => (taskId ? window.api.reminders.list(taskId) : Promise.resolve([])),
    enabled: !!taskId
  })
}

export function useCreateReminder(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateReminderInput) => window.api.reminders.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminders', taskId] })
  })
}

export function useDeleteReminder(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.reminders.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminders', taskId] })
  })
}
