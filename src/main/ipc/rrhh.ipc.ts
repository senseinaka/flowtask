import { ipcMain, shell, dialog, BrowserWindow, app } from 'electron'
import path from 'path'
import os from 'os'
import fs from 'fs'
import { savePayroll, saveVacaciones } from '../services/rrhh.service'
import {
  listColaboradores, listPeriodos, getPeriodo,
  listSueldosByPeriodo, getHistorialColaborador,
  confirmarPeriodo, deletePeriodo, getAusentesEnPeriodo,
  updateSueldoNotas,
  listColaboradoresConStats, getColaboradorById,
  upsertColaboradorCompleto, softDeleteColaborador,
  asignarLegajo, getNominaConfig, upsertNominaConfig,
  updateColaboradorMediaIds
} from '../database/queries/rrhh'
import {
  generarDesdeUltimoPeriodo, confirmarGenerarNomina, crearCarpetaDriveColaborador
} from '../services/nomina.service'
import { driveService } from '../services/drive.service'
import type { UpsertColaboradorInput, ConfirmarGenerarInput } from '@shared/types'

/**
 * Mitiga CSV/Formula injection: Excel, LibreOffice y Google Sheets interpretan
 * una celda que empieza con = + - @ (o tab/CR) como fórmula al abrir el archivo.
 * Como parte de los datos provienen de PDFs externos (recibos) y de texto libre
 * del usuario, prefijamos un apóstrofo a esos valores para neutralizarlos.
 */
const FORMULA_INJECTION_RE = /^[=+\-@\t\r]/
function sanitizeXlsRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map(row => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(row)) {
      out[k] = typeof v === 'string' && FORMULA_INJECTION_RE.test(v) ? `'${v}` : v
    }
    return out
  })
}

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

    const ws = XLSX.utils.json_to_sheet(sanitizeXlsRows(rows))
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

  // ── Nómina: colaboradores ────────────────────────────────────────────────
  ipcMain.handle('rrhh:nomina:colaboradores:list', () =>
    listColaboradoresConStats()
  )

  ipcMain.handle('rrhh:nomina:colaboradores:get', (_e, id: string) =>
    getColaboradorById(id)
  )

  ipcMain.handle('rrhh:nomina:colaboradores:upsert', (_e, data: UpsertColaboradorInput) =>
    upsertColaboradorCompleto(data)
  )

  ipcMain.handle('rrhh:nomina:colaboradores:delete', (_e, id: string) =>
    softDeleteColaborador(id)
  )

  ipcMain.handle('rrhh:nomina:colaboradores:asignarLegajo', (_e, id: string) =>
    asignarLegajo(id)
  )

  ipcMain.handle('rrhh:nomina:colaboradores:crearDrive', (_e, id: string) =>
    crearCarpetaDriveColaborador(id)
  )

  // ── Nómina: config ───────────────────────────────────────────────────────
  ipcMain.handle('rrhh:nomina:config:get', () =>
    getNominaConfig()
  )

  ipcMain.handle('rrhh:nomina:config:upsert', (_e, data: Partial<{ drive_legajos_folder_id: string | null; ultimo_legajo_numero: number }>) =>
    upsertNominaConfig(data)
  )

  // ── Nómina: generación desde último período ──────────────────────────────
  ipcMain.handle('rrhh:nomina:generarDesdeUltimo', () =>
    generarDesdeUltimoPeriodo()
  )

  ipcMain.handle('rrhh:nomina:confirmarGenerar', (_e, input: ConfirmarGenerarInput, crearDrive: boolean) =>
    confirmarGenerarNomina(input, crearDrive)
  )

  // ── Nómina: export XLS ───────────────────────────────────────────────────
  ipcMain.handle('rrhh:nomina:exportXls', async (event, rows: Record<string, unknown>[]) => {
    if (!rows || rows.length === 0) throw new Error('Sin datos para exportar')
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const XLSX = require('xlsx')
    const ws = XLSX.utils.json_to_sheet(sanitizeXlsRows(rows))
    ws['!cols'] = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length + 2, 16) }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Nómina')

    const win = BrowserWindow.fromWebContents(event.sender)
    const { canceled, filePath: savePath } = await dialog.showSaveDialog(win!, {
      title: 'Exportar nómina de colaboradores',
      defaultPath: path.join(os.homedir(), 'Downloads', 'nomina_colaboradores.xlsx'),
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    })
    if (canceled || !savePath) return null
    XLSX.writeFile(wb, savePath)
    return savePath
  })

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

  // ── Foto y CV del colaborador ────────────────────────────────────────────────

  ipcMain.handle('rrhh:nomina:colaboradores:selectImageFile', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: 'Seleccionar foto del colaborador',
      filters: [{ name: 'Imagen', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
      properties: ['openFile'],
    })
    return result.canceled || !result.filePaths.length ? null : result.filePaths[0]
  })

  ipcMain.handle('rrhh:nomina:colaboradores:selectCvFile', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: 'Seleccionar CV del colaborador',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
      properties: ['openFile'],
    })
    return result.canceled || !result.filePaths.length ? null : result.filePaths[0]
  })

  ipcMain.handle('rrhh:nomina:colaboradores:uploadFoto', async (_e, id: string, localPath: string) => {
    const col = await getColaboradorById(id)
    if (!col) throw new Error('Colaborador no encontrado')
    if (!col.drive_legajo_folder_id) throw new Error('No tiene carpeta en Drive. Creá la carpeta primero desde la tab Drive.')

    const ext = path.extname(localPath).toLowerCase()
    const MIME_MAP: Record<string, string> = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
    }
    const mimeType = MIME_MAP[ext] ?? 'image/jpeg'
    const safeName = col.nombre.replace(/[/:*?"<>|]/g, '-').slice(0, 50).trim()
    const fileName = `foto_${safeName}${ext}`

    if (col.foto_drive_file_id) await driveService.deleteFile(col.foto_drive_file_id).catch(() => null)

    const fileId = await driveService.uploadFileToFolder(localPath, col.drive_legajo_folder_id, fileName, mimeType)

    // Guardar copia local para mostrar en UI
    const fotosDir = path.join(app.getPath('userData'), 'rrhh-fotos')
    if (!fs.existsSync(fotosDir)) fs.mkdirSync(fotosDir, { recursive: true })
    for (const e of fs.readdirSync(fotosDir)) {
      if (e.startsWith(`${id}.`)) fs.unlinkSync(path.join(fotosDir, e))
    }
    fs.copyFileSync(localPath, path.join(fotosDir, `${id}${ext}`))

    await updateColaboradorMediaIds(id, { foto_drive_file_id: fileId })
    return fileId
  })

  ipcMain.handle('rrhh:nomina:colaboradores:uploadCv', async (_e, id: string, localPath: string) => {
    const col = await getColaboradorById(id)
    if (!col) throw new Error('Colaborador no encontrado')
    if (!col.drive_legajo_folder_id) throw new Error('No tiene carpeta en Drive. Creá la carpeta primero desde la tab Drive.')

    const safeName = col.nombre.replace(/[/:*?"<>|]/g, '-').slice(0, 50).trim()
    const fileName = `cv_${safeName}.pdf`

    if (col.cv_drive_file_id) await driveService.deleteFile(col.cv_drive_file_id).catch(() => null)

    const fileId = await driveService.uploadFileToFolder(localPath, col.drive_legajo_folder_id, fileName, 'application/pdf')

    await updateColaboradorMediaIds(id, { cv_drive_file_id: fileId })
    return fileId
  })

  ipcMain.handle('rrhh:nomina:colaboradores:getFotoDataUrl', async (_e, id: string) => {
    const fotosDir = path.join(app.getPath('userData'), 'rrhh-fotos')
    if (!fs.existsSync(fotosDir)) return null
    const MIME_MAP: Record<string, string> = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
    }
    for (const ext of Object.keys(MIME_MAP)) {
      const p = path.join(fotosDir, `${id}${ext}`)
      if (fs.existsSync(p)) {
        const buf = fs.readFileSync(p)
        return `data:${MIME_MAP[ext]};base64,${buf.toString('base64')}`
      }
    }
    return null
  })
}
