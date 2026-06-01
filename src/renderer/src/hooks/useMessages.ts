import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  CreateScheduledMessageInput,
  MessageRecurrence,
  MessageStatus
} from '@shared/types'

// ─── Templates ────────────────────────────────────────────────────────────────

export function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: () => window.api.messages.listTemplates()
  })
}

export function useCreateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, body }: { name: string; body: string }) =>
      window.api.messages.createTemplate(name, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] })
  })
}

export function useUpdateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name, body }: { id: string; name: string; body: string }) =>
      window.api.messages.updateTemplate(id, name, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] })
  })
}

export function useDeleteTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.messages.deleteTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] })
  })
}

// ─── Scheduled messages ───────────────────────────────────────────────────────

export function useScheduledMessages(status?: MessageStatus | MessageStatus[]) {
  return useQuery({
    queryKey: ['scheduled-messages', status],
    queryFn: () => window.api.messages.list(status),
    refetchInterval: 30_000
  })
}

export function useCreateMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateScheduledMessageInput) =>
      window.api.messages.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduled-messages'] })
  })
}

export function useUpdateMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data
    }: {
      id: string
      data: { message?: string; send_at?: number; recurrence?: MessageRecurrence; contact_ids?: string[] }
    }) => window.api.messages.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduled-messages'] })
  })
}

export function useDeleteMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.messages.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduled-messages'] })
  })
}

export function useRetryMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.messages.retry(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduled-messages'] })
  })
}
