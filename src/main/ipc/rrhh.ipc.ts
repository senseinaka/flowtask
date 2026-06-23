import { ipcMain, shell, dialog, BrowserWindow } from 'electron'
import path from 'path'
import os from 'os'
import { savePayroll, saveVacaciones } from '../services/rrhh.service'
import {
  listColaboradores, listPeriodos, getPeriodo,
  listSueldosByPeriodo, getHistorialColaborador,
  confirmarPeriodo, deletePeriodo, getAusentesEnPeriodo,
  updateSueldoNotas
} from '../database/queries/rrhh'
import { driveService } from '../services/drive.service'

export function registerRrhhIpc(): void {
  ipcMain.handle('rrhh:savePayroll', (_e, filePath: string) =>
    savePayroll(filePath)
  )

  ipcMain.handle('rrhh:saveVacaciones', (_e, filePath: string) =>
    saveVacaciones(filePath)
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

  ipcMain.handle('rrhh:sueldos:updateNotas', (_e, id: string, notas: string | null) =>
    updateSueldoNotas(id, notas)
  )

  ipcMain.handle('rrhh:exportXls', async (
    event,
    periodoLabel: string,
    defaultFileName: string,
    rows: Record<string, unknown>[]
  ) => {
    if (!rows || rows.length === 0) throw new Error('Sin datos para exportar')

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const XLSX = require('xlsx')

    const ws = XLSX.utils.json_to_sheet(rows)
    // Auto column widths based on header names
    ws['!cols'] = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length + 2, 14) }))

    const wb = XLSX.utils.book_new()
    const sheetName = periodoLabel.slice(0, 31) // Excel sheet name max 31 chars
    XLSX.utils.book_append_sheet(wb, ws, sheetName)

    const win = BrowserWindow.fromWebContents(event.sender)
    const { canceled, filePath: savePath } = await dialog.showSaveDialog(win!, {
      title: 'Guardar planilla de sueldos',
      defaultPath: path.join(os.homedir(), 'Downloads', defaultFileName),
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    })
    if (canceled || !savePath) return null

    XLSX.writeFile(wb, savePath)
    return savePath
  })

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

  ipcMain.handle('rrhh:selectPdf', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: 'Seleccionar recibo de sueldos',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
      properties: ['openFile'],
    })
    return result.canceled || !result.filePaths.length ? null : result.filePaths[0]
  })

  ipcMain.handle('rrhh:selectVacacionesPdf', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: 'Seleccionar recibo de vacaciones',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
      properties: ['openFile'],
    })
    return result.canceled || !result.filePaths.length ? null : result.filePaths[0]
  })
}
