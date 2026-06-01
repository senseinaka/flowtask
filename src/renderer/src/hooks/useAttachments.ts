import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Attachment } from '@shared/types'

export function useAttachments(taskId: string | null) {
  return useQuery<Attachment[]>({
    queryKey: ['attachments', taskId],
    queryFn: () => (taskId ? window.api.attachments.list(taskId) : Promise.resolve([])),
    enabled: !!taskId
  })
}

export function useAddAttachment(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const filePath = await window.api.attachments.selectFile()
      if (!filePath) return null
      return window.api.attachments.add(taskId, filePath)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attachments', taskId] })
  })
}

export function useDeleteAttachment(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.attachments.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attachments', taskId] })
  })
}
