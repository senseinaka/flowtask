import { ipcMain, shell, dialog, BrowserWindow, app } from 'electron'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const xlsx = require('xlsx') as typeof import('xlsx')
import path from 'path'
import os from 'os'
import fs from 'fs'
import { savePayroll, saveVacaciones, saveSac } from '../services/rrhh.service'
import {
  listColaboradores, listPeriodos, getPeriodo,
  listSueldosByPeriodo, getHistorialColaborador,
  confirmarPeriodo, deletePeriodo, getAusentesEnPeriodo,
  updateSueldoNotas,
  listColaboradoresConStats, getColaboradorById,
  upsertColaboradorCompleto, softDeleteColaborador, hardDeleteColaborador,
  asignarLegajo, getNominaConfig, upsertNominaConfig,
  updateColaboradorMediaIds,
  listRrhhListas, upsertLista, deleteLista
} from '../database/queries/rrhh'
import type { UpsertListaInput, RrhhListaTipo, ConfirmImportInput, ImportParsedRow, RrhhColaborador, RrhhEmpresa } from '@shared/types'
import {
  generarDesdeUltimoPeriodo, confirmarGenerarNomina, crearCarpetaDriveColaborador
} from '../services/nomina.service'
import { driveService } from '../services/drive.service'
import type { UpsertColaboradorInput, ConfirmarGenerarInput } from '@shared/types'

// ── Importer helpers ──────────────────────────────────────────────────────────

const TEMPLATE_COLS = [
  { header: 'Nombre *',                          field: 'nombre' },
  { header: 'Documento *',                       field: 'documento' },
  { header: 'CUIL',                              field: 'cuil' },
  { header: 'Fecha nacimiento (dd-mm-aaaa)',      field: 'fecha_nacimiento' },
  { header: 'Celular',                           field: 'telefono' },
  { header: 'Email personal',                    field: 'email_personal' },
  { header: 'Direccion',                         field: 'direccion' },
  { header: 'Localidad',                         field: 'localidad' },
  { header: 'Provincia',                         field: 'provincia' },
  { header: 'Contacto emerg. 1 - Nombre',        field: 'contacto_emergencia_1_nombre' },
  { header: 'Contacto emerg. 1 - Celular',       field: 'contacto_emergencia_1_celular' },
  { header: 'Contacto emerg. 1 - Vinculo',       field: 'contacto_emergencia_1_vinculo' },
  { header: 'Contacto emerg. 2 - Nombre',        field: 'contacto_emergencia_2_nombre' },
  { header: 'Contacto emerg. 2 - Celular',       field: 'contacto_emergencia_2_celular' },
  { header: 'Contacto emerg. 2 - Vinculo',       field: 'contacto_emergencia_2_vinculo' },
  { header: 'Legajo',                            field: 'legajo' },
  { header: 'Fecha ingreso (dd-mm-aaaa)',         field: 'fecha_ingreso' },
  { header: 'Tarea habitual',                    field: 'tarea_habitual' },
  { header: 'Sector',                            field: 'sector' },
  { header: 'Puesto',                            field: 'puesto' },
  { header: 'Categoria',                         field: 'categoria_laboral' },
  { header: 'Estado',                            field: 'estado_laboral' },
  { header: 'Contratacion',                      field: 'tipo_contratacion' },
  { header: 'Jornada',                           field: 'jornada' },
  { header: 'Modalidad',                         field: 'modalidad' },
  { header: 'Dias home office',                  field: 'dias_home_office' },
  { header: 'Email laboral',                     field: 'email_laboral' },
  { header: 'Banco',                             field: 'banco' },
  { header: 'CBU',                               field: 'cbu' },
  { header: 'Observaciones',                     field: 'observaciones' },
] as const

const CHANGED_FIELD_LABELS: Record<string, string> = {
  nombre: 'Nombre', cuil: 'CUIL', fecha_nacimiento: 'F. nacimiento',
  telefono: 'Celular', email_personal: 'Email personal',
  direccion: 'Dirección', localidad: 'Localidad', provincia: 'Provincia',
  contacto_emergencia_1_nombre: 'Contacto 1 nombre', contacto_emergencia_1_celular: 'Contacto 1 celular',
  contacto_emergencia_1_vinculo: 'Contacto 1 vínculo', contacto_emergencia_2_nombre: 'Contacto 2 nombre',
  contacto_emergencia_2_celular: 'Contacto 2 celular', contacto_emergencia_2_vinculo: 'Contacto 2 vínculo',
  tarea_habitual: 'Tarea', sector: 'Sector', puesto: 'Puesto',
  categoria_laboral: 'Categoría', fecha_ingreso: 'F. ingreso',
  estado_laboral: 'Estado', tipo_contratacion: 'Contratación',
  jornada: 'Jornada', modalidad: 'Modalidad', email_laboral: 'Email laboral',
  banco: 'Banco', cbu: 'CBU', observaciones: 'Observaciones',
}

type ColField = typeof TEMPLATE_COLS[number]['field']

function computeChangedFields(existing: RrhhColaborador, get: (f: ColField) => string): string[] {
  const changed: string[] = []
  for (const [field, label] of Object.entries(CHANGED_FIELD_LABELS)) {
    const planVal = get(field as ColField)
    if (!planVal) continue
    const existVal = String((existing as Record<string, unknown>)[field] ?? '')
    if (planVal !== existVal) changed.push(label)
  }
  return changed
}

function normalizeHeader(h: string): string {
  return h.toLowerCase()
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/[ñ]/g, 'n')
    .replace(/[*()]/g, '').trim()
}

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
  ipcMain.handle('rrhh:savePayroll', (_e, empresa: RrhhEmpresa, filePath: string) =>
    savePayroll(empresa, filePath)
  )

  ipcMain.handle('rrhh:saveVacaciones', (_e, empresa: RrhhEmpresa, filePath: string) =>
    saveVacaciones(empresa, filePath)
  )

  ipcMain.handle('rrhh:saveSac', (_e, empresa: RrhhEmpresa, filePath: string) =>
    saveSac(empresa, filePath)
  )

  ipcMain.handle('rrhh:colaboradores:list', (_e, empresa: RrhhEmpresa) =>
    listColaboradores(empresa)
  )

  ipcMain.handle('rrhh:periodos:list', (_e, empresa: RrhhEmpresa) =>
    listPeriodos(empresa)
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
  ipcMain.handle('rrhh:nomina:colaboradores:list', (_e, empresa: RrhhEmpresa) =>
    listColaboradoresConStats(empresa)
  )

  ipcMain.handle('rrhh:nomina:colaboradores:get', (_e, id: string) =>
    getColaboradorById(id)
  )

  ipcMain.handle('rrhh:nomina:colaboradores:upsert', (_e, empresa: RrhhEmpresa, data: UpsertColaboradorInput) =>
    upsertColaboradorCompleto(empresa, data)
  )

  ipcMain.handle('rrhh:nomina:colaboradores:delete', (_e, id: string) =>
    softDeleteColaborador(id)
  )

  ipcMain.handle('rrhh:nomina:colaboradores:asignarLegajo', (_e, empresa: RrhhEmpresa, id: string) =>
    asignarLegajo(empresa, id)
  )

  ipcMain.handle('rrhh:nomina:colaboradores:crearDrive', (_e, empresa: RrhhEmpresa, id: string) =>
    crearCarpetaDriveColaborador(empresa, id)
  )

  // ── Nómina: config ───────────────────────────────────────────────────────
  ipcMain.handle('rrhh:nomina:config:get', (_e, empresa: RrhhEmpresa) =>
    getNominaConfig(empresa)
  )

  ipcMain.handle('rrhh:nomina:config:upsert', (_e, empresa: RrhhEmpresa, data: Partial<{ drive_legajos_folder_id: string | null; ultimo_legajo_numero: number }>) =>
    upsertNominaConfig(empresa, data)
  )

  // ── Nómina: generación desde último período ──────────────────────────────
  ipcMain.handle('rrhh:nomina:generarDesdeUltimo', (_e, empresa: RrhhEmpresa) =>
    generarDesdeUltimoPeriodo(empresa)
  )

  ipcMain.handle('rrhh:nomina:confirmarGenerar', (_e, empresa: RrhhEmpresa, input: ConfirmarGenerarInput, crearDrive: boolean) =>
    confirmarGenerarNomina(empresa, input, crearDrive)
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

  ipcMain.handle('rrhh:selectSacPdf', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: 'Seleccionar recibo de SAC / aguinaldo',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
      properties: ['openFile'],
    })
    return result.canceled || !result.filePaths.length ? null : result.filePaths[0]
  })

  // ── Foto y CV del colaborador ────────────────────────────────────────────────

  // ── Hard delete colaborador ──────────────────────────────────────────────────
  ipcMain.handle('rrhh:nomina:colaboradores:hardDelete', (_e, id: string) =>
    hardDeleteColaborador(id)
  )

  // ── Listas gestionadas ───────────────────────────────────────────────────────
  ipcMain.handle('rrhh:listas:list', (_e, tipo?: RrhhListaTipo) =>
    listRrhhListas(tipo)
  )

  ipcMain.handle('rrhh:listas:upsert', (_e, data: UpsertListaInput) =>
    upsertLista(data)
  )

  ipcMain.handle('rrhh:listas:delete', (_e, id: string) =>
    deleteLista(id)
  )

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

  // ── Importer IPC handlers ──────────────────────────────────────────────────

  ipcMain.handle('rrhh:nomina:exportTemplate', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showSaveDialog(win ?? BrowserWindow.getFocusedWindow()!, {
      title: 'Guardar plantilla de importación',
      defaultPath: 'plantilla_colaboradores.xlsx',
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    })
    if (result.canceled || !result.filePath) return null

    const wb = xlsx.utils.book_new()

    // Sheet 1: plantilla de datos
    const headerRow = TEMPLATE_COLS.map(c => c.header)
    const exampleRow = TEMPLATE_COLS.map(c => {
      const ex: Record<ColField, string> = {
        nombre: 'Juan Pérez', documento: '30123456', cuil: '20-30123456-9',
        fecha_nacimiento: '15-06-1985', telefono: '11 1234-5678',
        email_personal: 'juan@gmail.com', direccion: 'Av. Corrientes 1234',
        localidad: 'Buenos Aires', provincia: 'Buenos Aires',
        contacto_emergencia_1_nombre: 'María Pérez',
        contacto_emergencia_1_celular: '11 9876-5432',
        contacto_emergencia_1_vinculo: 'Madre',
        contacto_emergencia_2_nombre: '', contacto_emergencia_2_celular: '',
        contacto_emergencia_2_vinculo: '',
        legajo: '', fecha_ingreso: '01-03-2022',
        tarea_habitual: 'Desarrollo', sector: '', puesto: '', categoria_laboral: '',
        estado_laboral: 'activo', tipo_contratacion: 'relacion_dependencia',
        jornada: 'completa', modalidad: 'presencial', dias_home_office: '',
        email_laboral: 'juan@empresa.com', banco: 'Banco Galicia',
        cbu: '', observaciones: '',
      }
      return ex[c.field as ColField] ?? ''
    })
    const ws = xlsx.utils.aoa_to_sheet([headerRow, exampleRow])
    // Ancho de columnas
    ws['!cols'] = headerRow.map(() => ({ wch: 22 }))
    xlsx.utils.book_append_sheet(wb, ws, 'Colaboradores')

    // Sheet 2: valores válidos
    const listas = await listRrhhListas()
    const valoresData: string[][] = [
      ['Sector', 'Puesto', 'Categoria', 'Banco', 'Estado', 'Contratacion', 'Jornada', 'Modalidad'],
      ...Array.from({ length: 30 }, (_, i) => {
        const sectores = listas.filter(l => l.tipo === 'sector').map(l => l.valor)
        const puestos  = listas.filter(l => l.tipo === 'puesto').map(l => l.valor)
        const cats     = listas.filter(l => l.tipo === 'categoria').map(l => l.valor)
        const bancos   = listas.filter(l => l.tipo === 'banco').map(l => l.valor)
        return [
          sectores[i] ?? '', puestos[i] ?? '', cats[i] ?? '', bancos[i] ?? '',
          i === 0 ? 'activo'   : i === 1 ? 'inactivo' : i === 2 ? 'licencia' : i === 3 ? 'suspendido' : i === 4 ? 'externo' : '',
          i === 0 ? 'relacion_dependencia' : i === 1 ? 'monotributo' : i === 2 ? 'eventual' : i === 3 ? 'otro' : '',
          i === 0 ? 'completa' : i === 1 ? 'parcial' : '',
          i === 0 ? 'presencial' : i === 1 ? 'remoto' : i === 2 ? 'hibrido' : '',
        ]
      }),
    ]
    const wsV = xlsx.utils.aoa_to_sheet(valoresData)
    wsV['!cols'] = Array(8).fill({ wch: 24 })
    xlsx.utils.book_append_sheet(wb, wsV, 'Valores válidos')

    xlsx.writeFile(wb, result.filePath)
    return result.filePath
  })

  ipcMain.handle('rrhh:nomina:selectImportFile', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(win ?? BrowserWindow.getFocusedWindow()!, {
      title: 'Seleccionar planilla de importación',
      filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
      properties: ['openFile'],
    })
    return result.canceled || !result.filePaths.length ? null : result.filePaths[0]
  })

  ipcMain.handle('rrhh:nomina:parseImport', async (_e, empresa: RrhhEmpresa, filePath: string) => {
    const wb = xlsx.readFile(filePath)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const raw: string[][] = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][]
    if (raw.length < 2) return { rows: [], stats: { total: 0, toCreate: 0, toUpdate: 0, withErrors: 0, legajoConflicts: 0 } }

    // Map normalized header → column index
    const headers = (raw[0] as string[]).map(h => normalizeHeader(String(h)))
    const colMap = new Map<string, number>()
    TEMPLATE_COLS.forEach(({ header, field }) => {
      const norm = normalizeHeader(header)
      const idx = headers.indexOf(norm)
      if (idx !== -1) colMap.set(field, idx)
    })

    const existing = await listColaboradores(empresa)
    const byDoc = new Map<string, RrhhColaborador>()
    existing.forEach(c => { if (c.documento) byDoc.set(String(c.documento).trim(), c) })

    const get = (row: string[], field: ColField): string =>
      String(row[colMap.get(field) ?? -1] ?? '').trim()

    const rows: ImportParsedRow[] = []

    for (let i = 1; i < raw.length; i++) {
      const row = raw[i] as string[]
      if (row.every(cell => !String(cell).trim())) continue // fila vacía

      const nombre   = get(row, 'nombre')
      const documento = get(row, 'documento')

      const errors: string[] = []
      if (!nombre)   errors.push('Nombre obligatorio')
      if (!documento) errors.push('Documento obligatorio')

      const found = documento ? byDoc.get(documento) : undefined
      const existingId    = found?.id ?? null
      const existingLegajo = found?.legajo ?? null
      const planillaLegajo = get(row, 'legajo')

      const legajoConflict = !!(
        found && existingLegajo && planillaLegajo &&
        String(existingLegajo).trim() !== planillaLegajo
      )

      const changedFields = found && !errors.length
        ? computeChangedFields(found, f => get(row, f))
        : []

      const status: ImportParsedRow['status'] = errors.length ? 'error' : found ? 'update' : 'create'

      rows.push({
        rowIndex: i,
        nombre,    documento,
        cuil:      get(row, 'cuil'),
        fecha_nacimiento: get(row, 'fecha_nacimiento'),
        telefono:  get(row, 'telefono'),
        email_personal: get(row, 'email_personal'),
        direccion: get(row, 'direccion'),
        localidad: get(row, 'localidad'),
        provincia: get(row, 'provincia'),
        contacto_emergencia_1_nombre:  get(row, 'contacto_emergencia_1_nombre'),
        contacto_emergencia_1_celular: get(row, 'contacto_emergencia_1_celular'),
        contacto_emergencia_1_vinculo: get(row, 'contacto_emergencia_1_vinculo'),
        contacto_emergencia_2_nombre:  get(row, 'contacto_emergencia_2_nombre'),
        contacto_emergencia_2_celular: get(row, 'contacto_emergencia_2_celular'),
        contacto_emergencia_2_vinculo: get(row, 'contacto_emergencia_2_vinculo'),
        legajo:            planillaLegajo,
        fecha_ingreso:     get(row, 'fecha_ingreso'),
        tarea_habitual:    get(row, 'tarea_habitual'),
        sector:            get(row, 'sector'),
        puesto:            get(row, 'puesto'),
        categoria_laboral: get(row, 'categoria_laboral'),
        estado_laboral:    get(row, 'estado_laboral'),
        tipo_contratacion: get(row, 'tipo_contratacion'),
        jornada:           get(row, 'jornada'),
        modalidad:         get(row, 'modalidad'),
        dias_home_office:  get(row, 'dias_home_office'),
        email_laboral:     get(row, 'email_laboral'),
        banco:             get(row, 'banco'),
        cbu:               get(row, 'cbu'),
        observaciones:     get(row, 'observaciones'),
        status,
        errors,
        existingId,
        existingLegajo,
        legajoConflict,
        changedFields,
      })
    }

    const stats = {
      total:          rows.length,
      toCreate:       rows.filter(r => r.status === 'create').length,
      toUpdate:       rows.filter(r => r.status === 'update').length,
      withErrors:     rows.filter(r => r.status === 'error').length,
      legajoConflicts: rows.filter(r => r.legajoConflict).length,
    }
    return { rows, stats }
  })

  ipcMain.handle('rrhh:nomina:confirmImport', async (_e, empresa: RrhhEmpresa, input: ConfirmImportInput) => {
    const { rows, legajoDecisions } = input
    const decisionMap = new Map<number, boolean>()
    legajoDecisions.forEach(d => decisionMap.set(d.rowIndex, d.keep))

    const existing = await listColaboradores(empresa)
    const byId = new Map<string, RrhhColaborador>()
    existing.forEach(c => byId.set(c.id, c))

    let created = 0
    let updated = 0

    for (const row of rows) {
      if (row.status === 'error') continue

      const ex = row.existingId ? byId.get(row.existingId) : undefined
      const keepLegajo = row.legajoConflict ? (decisionMap.get(row.rowIndex) ?? true) : false

      const str = (val: string, fallback?: string) => val || fallback || undefined

      const data: UpsertColaboradorInput = {
        id:               row.existingId ?? undefined,
        workspace_id:     'd61a4071-1557-4f32-be5e-6443fb336bf5',
        nombre:           row.nombre,
        documento:        row.documento,
        cuil:             str(row.cuil,             ex?.cuil ?? undefined),
        fecha_nacimiento: str(row.fecha_nacimiento, ex?.fecha_nacimiento ?? undefined),
        telefono:         str(row.telefono,          ex?.telefono ?? undefined),
        email_personal:   str(row.email_personal,    ex?.email_personal ?? undefined),
        direccion:        str(row.direccion,          ex?.direccion ?? undefined),
        localidad:        str(row.localidad,          ex?.localidad ?? undefined),
        provincia:        str(row.provincia,          ex?.provincia ?? undefined),
        contacto_emergencia_1_nombre:  str(row.contacto_emergencia_1_nombre,  ex?.contacto_emergencia_1_nombre ?? undefined),
        contacto_emergencia_1_celular: str(row.contacto_emergencia_1_celular, ex?.contacto_emergencia_1_celular ?? undefined),
        contacto_emergencia_1_vinculo: str(row.contacto_emergencia_1_vinculo, ex?.contacto_emergencia_1_vinculo ?? undefined),
        contacto_emergencia_2_nombre:  str(row.contacto_emergencia_2_nombre,  ex?.contacto_emergencia_2_nombre ?? undefined),
        contacto_emergencia_2_celular: str(row.contacto_emergencia_2_celular, ex?.contacto_emergencia_2_celular ?? undefined),
        contacto_emergencia_2_vinculo: str(row.contacto_emergencia_2_vinculo, ex?.contacto_emergencia_2_vinculo ?? undefined),
        tarea_habitual:    str(row.tarea_habitual,    ex?.tarea_habitual ?? undefined),
        sector:            str(row.sector,            ex?.sector ?? undefined),
        puesto:            str(row.puesto,            ex?.puesto ?? undefined),
        categoria_laboral: str(row.categoria_laboral, ex?.categoria_laboral ?? undefined),
        fecha_ingreso:     str(row.fecha_ingreso,     ex?.fecha_ingreso ?? undefined),
        estado_laboral:    str(row.estado_laboral,    ex?.estado_laboral ?? undefined) ?? 'activo',
        tipo_contratacion: str(row.tipo_contratacion, ex?.tipo_contratacion ?? undefined),
        jornada:           str(row.jornada,           ex?.jornada ?? undefined),
        modalidad:         str(row.modalidad,         ex?.modalidad ?? undefined),
        dias_home_office:  str(row.dias_home_office,  ex?.dias_home_office ?? undefined),
        email_laboral:     str(row.email_laboral,     ex?.email_laboral ?? undefined),
        banco:             str(row.banco,             ex?.banco ?? undefined),
        cbu:               str(row.cbu,               ex?.cbu ?? undefined),
        observaciones:     str(row.observaciones,     ex?.observaciones ?? undefined),
      }

      // Legajo: si hay conflicto y el usuario eligió mantener el actual, usamos el existente;
      // si eligió actualizar, usamos el de la planilla
      if (row.legajoConflict) {
        data.legajo = keepLegajo ? (ex?.legajo ?? undefined) : row.legajo || undefined
      } else if (row.legajo) {
        data.legajo = row.legajo
      }
      // Si no hay legajo en la planilla y es nuevo colaborador, asignarLegajo se llama en upsertColaboradorCompleto

      await upsertColaboradorCompleto(empresa, data)
      if (row.status === 'create') created++
      else updated++
    }

    return { created, updated }
  })
}
