import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Attachment } from '@shared/types'

export function useDelegatedAttachments(taskId: string | null) {
  return useQuery<Attachment[]>({
    queryKey: ['delegated-attachments', taskId],
    queryFn: () => (taskId ? window.api.delegatedAttachments.list(taskId) : Promise.resolve([])),
    enabled: !!taskId
  })
}

export function useAddDelegatedAttachment(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const filePath = await window.api.delegatedAttachments.selectFile()
      if (!filePath) return null
      return window.api.delegatedAttachments.add(taskId, filePath)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['delegated-attachments', taskId] })
  })
}

export function useDeleteDelegatedAttachment(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.delegatedAttachments.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['delegated-attachments', taskId] })
  })
}
