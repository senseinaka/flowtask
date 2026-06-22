import { ipcMain, shell } from 'electron'
import { savePayroll } from '../services/rrhh.service'
import {
  listColaboradores, listPeriodos, getPeriodo,
  listSueldosByPeriodo, getHistorialColaborador,
  confirmarPeriodo, deletePeriodo, getAusentesEnPeriodo
} from '../database/queries/rrhh'
import { driveService } from '../services/drive.service'

export function registerRrhhIpc(): void {
  ipcMain.handle('rrhh:savePayroll', (_e, filePath: string) =>
    savePayroll(filePath)
  )

  ipcMain.handle('rrhh:colaboradores:list', () =>
    listColaboradores()
  )

  ipcMain.handle('rrhh:periodos:list', () =>
    listPeriodos()
  )

  ipcMain.handle('rrhh:periodos:get', (_e, id: string) =>
    getPeriodo(id)
  )

  ipcMain.handle('rrhh:periodos:confirmar', (_e, id: string) =>
    confirmarPeriodo(id)
  )

  ipcMain.handle('rrhh:periodos:delete', (_e, id: string) =>
    deletePeriodo(id)
  )

  ipcMain.handle('rrhh:sueldos:list', (_e, periodoId: string) =>
    listSueldosByPeriodo(periodoId)
  )

  ipcMain.handle('rrhh:colaboradores:historial', (_e, colaboradorId: string) =>
    getHistorialColaborador(colaboradorId)
  )

  ipcMain.handle('rrhh:periodos:ausentes', (_e, periodoId: string) =>
    getAusentesEnPeriodo(periodoId)
  )

  ipcMain.handle('rrhh:drive:openFolder', (_e, folderId: string) =>
    shell.openExternal(`https://drive.google.com/drive/folders/${folderId}`)
  )

  ipcMain.handle('rrhh:drive:openFile', (_e, fileId: string) =>
    shell.openExternal(`https://drive.google.com/file/d/${fileId}/view`)
  )

  ipcMain.handle('rrhh:drive:isAuthenticated', () =>
    driveService.isAuthenticated()
  )
}
