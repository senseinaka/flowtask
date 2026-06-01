import { ipcMain } from 'electron'
import {
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  getDependencies,
  addDependency,
  removeDependency
} from '../database/queries/tasks'
import { getStatusLog } from '../database/queries/task-log'
import type { TaskFilters, CreateTaskInput, Task, TaskType } from '@shared/types'

export function registerTaskIpc(): void {
  ipcMain.handle('tasks:list', (_e, filters?: TaskFilters) => listTasks(filters))
  ipcMain.handle('tasks:get', (_e, id: string) => getTask(id))
  ipcMain.handle('tasks:create', (_e, data: CreateTaskInput) => createTask(data))
  ipcMain.handle('tasks:update', (_e, id: string, data: Partial<Task>) => updateTask(id, data))
  ipcMain.handle('tasks:delete', (_e, id: string) => deleteTask(id))
  ipcMain.handle('tasks:getDependencies', (_e, taskId: string) => getDependencies(taskId))
  ipcMain.handle('tasks:addDependency', (_e, taskId: string, dependsOnId: string) =>
    addDependency(taskId, dependsOnId)
  )
  ipcMain.handle('tasks:removeDependency', (_e, taskId: string, dependsOnId: string) =>
    removeDependency(taskId, dependsOnId)
  )
  ipcMain.handle('tasks:statusLog', (_e, taskId: string, taskType: TaskType) =>
    getStatusLog(taskId, taskType)
  )
}
