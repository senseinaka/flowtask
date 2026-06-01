import { ipcMain } from 'electron'
import { listProjects, createProject, updateProject, deleteProject } from '../database/queries/projects'
import type { Project } from '@shared/types'

export function registerProjectIpc(): void {
  ipcMain.handle('projects:list', () => listProjects())
  ipcMain.handle('projects:create', (_e, name: string, color?: string) => createProject(name, color))
  ipcMain.handle('projects:update', (_e, id: string, data: Partial<Project>) => updateProject(id, data))
  ipcMain.handle('projects:delete', (_e, id: string) => deleteProject(id))
}
