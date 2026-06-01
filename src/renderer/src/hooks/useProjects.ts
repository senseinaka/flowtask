import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Project } from '@shared/types'

export function useProjects() {
  return useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => window.api.projects.list()
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, color }: { name: string; color?: string }) =>
      window.api.projects.create(name, color),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] })
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.projects.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    }
  })
}
