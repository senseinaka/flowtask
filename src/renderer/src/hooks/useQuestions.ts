import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateTaskQuestionInput } from '@shared/types'

export function useQuestions(taskId: string | null) {
  return useQuery({
    queryKey: ['task-questions', taskId],
    queryFn: () => window.api.questions.list(taskId!),
    enabled: !!taskId
  })
}

export function useCreateQuestion(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTaskQuestionInput) => window.api.questions.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['task-questions', taskId] })
  })
}

export function useDeleteQuestion(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.questions.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['task-questions', taskId] })
  })
}
