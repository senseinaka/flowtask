import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Task, TaskFilters, CreateTaskInput } from '@shared/types'
import { useUIStore } from '../store/ui.store'

export function useTasks(filters?: TaskFilters) {
  return useQuery<Task[]>({
    queryKey: ['tasks', filters],
    queryFn: () => window.api.tasks.list(filters)
  })
}

export function useTask(id: string | null) {
  return useQuery<Task | null>({
    queryKey: ['task', id],
    queryFn: () => (id ? window.api.tasks.get(id) : Promise.resolve(null)),
    enabled: !!id
  })
}

export function useTaskDependencies(taskId: string | null) {
  return useQuery<Task[]>({
    queryKey: ['task-deps', taskId],
    queryFn: () => (taskId ? window.api.tasks.getDependencies(taskId) : Promise.resolve([])),
    enabled: !!taskId
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateTaskInput) => window.api.tasks.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] })
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Task> }) =>
      window.api.tasks.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['task', id] })
    }
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  const { selectedTaskId, setSelectedTask } = useUIStore()
  return useMutation({
    mutationFn: (id: string) => window.api.tasks.delete(id),
    onSuccess: (_, id) => {
      if (selectedTaskId === id) setSelectedTask(null)
      qc.invalidateQueries({ queryKey: ['tasks'] })
    }
  })
}

export function useAddDependency() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, dependsOnId }: { taskId: string; dependsOnId: string }) =>
      window.api.tasks.addDependency(taskId, dependsOnId),
    onSuccess: (_,  { taskId }) => {
      qc.invalidateQueries({ queryKey: ['task-deps', taskId] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    }
  })
}

export function useRemoveDependency() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, dependsOnId }: { taskId: string; dependsOnId: string }) =>
      window.api.tasks.removeDependency(taskId, dependsOnId),
    onSuccess: (_, { taskId }) => {
      qc.invalidateQueries({ queryKey: ['task-deps', taskId] })
    }
  })
}
