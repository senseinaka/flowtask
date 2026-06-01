import { useQuery } from '@tanstack/react-query'
import type { TaskStatusLogEntry, TaskType } from '@shared/types'

export function useTaskLog(taskId: string | null | undefined, taskType: TaskType = 'personal') {
  return useQuery<TaskStatusLogEntry[]>({
    queryKey: ['task-log', taskId, taskType],
    queryFn: () => window.api.tasks.statusLog(taskId!, taskType),
    enabled: !!taskId,
    staleTime: 1000 * 10
  })
}
