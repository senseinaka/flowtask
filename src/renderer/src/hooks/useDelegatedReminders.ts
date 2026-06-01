import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Reminder, CreateReminderInput } from '@shared/types'

export function useDelegatedReminders(taskId: string | null) {
  return useQuery<Reminder[]>({
    queryKey: ['delegated-reminders', taskId],
    queryFn: () => (taskId ? window.api.delegatedReminders.list(taskId) : Promise.resolve([])),
    enabled: !!taskId
  })
}

export function useCreateDelegatedReminder(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateReminderInput) => window.api.delegatedReminders.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['delegated-reminders', taskId] })
  })
}

export function useDeleteDelegatedReminder(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.delegatedReminders.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['delegated-reminders', taskId] })
  })
}
