import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { DelegatedTask, CreateDelegatedTaskInput } from '@shared/types'

const KEY = ['delegated']

export function useDelegatedTasks() {
  return useQuery<DelegatedTask[]>({
    queryKey: KEY,
    queryFn: () => window.api.delegated.list()
  })
}

export function useCreateDelegatedTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateDelegatedTaskInput) => window.api.delegated.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY })
  })
}

export function useUpdateDelegatedTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DelegatedTask> }) =>
      window.api.delegated.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY })
  })
}

export function useDeleteDelegatedTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.delegated.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY })
  })
}
