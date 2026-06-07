import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import path from 'path'
import {
  listFinanceAccounts, createFinanceAccount, updateFinanceAccount, deleteFinanceAccount,
  listFinanceCategories, createFinanceCategory, updateFinanceCategory, deleteFinanceCategory,
  listFinanceConcepts, getFinanceConcept, createFinanceConcept, updateFinanceConcept, deleteFinanceConcept,
  listFinanceMovements, listUpcomingFinanceMovements, getFinanceMovement, createFinanceMovement, updateFinanceMovement,
  quickUpdateFinanceMovement, deleteFinanceMovement, generateMovementsForMonth, generateMovementsFromPreviousMonth,
  listMovementEntries, addMovementEntry, updateMovementEntry, removeMovementEntry,
  getFinanceMonthSummary,
  getFinanceCategoryBreakdown, getFinanceHistory, getFinanceTopConcepts, getFinanceTopIncreases,
  buildFinanceImportPreview, confirmFinanceImport
} from '../database/queries/finance'
import {
  parseFinanceImportFile, writeFinanceMovementsFile, writeFinanceSummaryPdf
} from '../services/finance-io.service'
import { parseFinanceImportText } from '../services/ai.service'
import {
  getFinanceSecurityStatus, setFinancePin, verifyFinancePin, disableFinancePin, changeFinancePin
} from '../services/finance-security.service'
import type {
  CreateFinanceAccountInput, CreateFinanceCategoryInput,
  CreateFinanceConceptInput, CreateFinanceMovementInput,
  CreateFinanceMovementEntryInput, UpdateFinanceMovementEntryInput,
  FinanceMovementStatus, FinanceImportConfirmItem, FinanceMovement
} from '@shared/types'

const MONTH_NAMES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
]

export function registerFinanceIpc(): void {

  // ── Accounts ────────────────────────────────────────────────────────────────
  ipcMain.handle('finance:accounts:list', () => listFinanceAccounts())

  ipcMain.handle('finance:accounts:create', (_e, data: CreateFinanceAccountInput) =>
    createFinanceAccount(data)
  )

  ipcMain.handle('finance:accounts:update', (_e, id: string, data: Partial<CreateFinanceAccountInput>) =>
    updateFinanceAccount(id, data)
  )

  ipcMain.handle('finance:accounts:delete', (_e, id: string) =>
    deleteFinanceAccount(id)
  )

  // ── Categories ──────────────────────────────────────────────────────────────
  ipcMain.handle('finance:categories:list', () => listFinanceCategories())

  ipcMain.handle('finance:categories:create', (_e, data: CreateFinanceCategoryInput) =>
    createFinanceCategory(data)
  )

  ipcMain.handle('finance:categories:update', (_e, id: string, data: Partial<CreateFinanceCategoryInput>) =>
    updateFinanceCategory(id, data)
  )

  ipcMain.handle('finance:categories:delete', (_e, id: string) =>
    deleteFinanceCategory(id)
  )

  // ── Concepts ────────────────────────────────────────────────────────────────
  ipcMain.handle('finance:concepts:list', (_e, opts?: { activeOnly?: boolean }) =>
    listFinanceConcepts(opts)
  )

  ipcMain.handle('finance:concepts:get', (_e, id: string) => getFinanceConcept(id))

  ipcMain.handle('finance:concepts:create', (_e, data: CreateFinanceConceptInput) =>
    createFinanceConcept(data)
  )

  ipcMain.handle('finance:concepts:update', (_e, id: string, data: Partial<CreateFinanceConceptInput> & { is_active?: number }) =>
    updateFinanceConcept(id, data)
  )

  ipcMain.handle('finance:concepts:delete', (_e, id: string) =>
    deleteFinanceConcept(id)
  )

  // ── Movements ───────────────────────────────────────────────────────────────
  ipcMain.handle('finance:movements:list', (_e, month: number, year: number) =>
    listFinanceMovements(month, year)
  )

  ipcMain.handle('finance:movements:listUpcoming', () => listUpcomingFinanceMovements())

  ipcMain.handle('finance:movements:get', (_e, id: string) => getFinanceMovement(id))

  ipcMain.handle('finance:movements:create', (_e, data: CreateFinanceMovementInput) =>
    createFinanceMovement(data)
  )

  ipcMain.handle('finance:movements:update', (_e, id: string, data: Partial<CreateFinanceMovementInput>) =>
    updateFinanceMovement(id, data)
  )

  ipcMain.handle('finance:movements:quickUpdate', (_e, id: string, data: {
    amount_actual?: number | null
    status?:        FinanceMovementStatus
    payment_date?:  number | null
    due_date?:      number | null
    notes?:         string
  }) => quickUpdateFinanceMovement(id, data))

  ipcMain.handle('finance:movements:delete', (_e, id: string) =>
    deleteFinanceMovement(id)
  )

  ipcMain.handle('finance:movements:generateForMonth', (_e, month: number, year: number) =>
    generateMovementsForMonth(month, year)
  )

  ipcMain.handle('finance:movements:generateFromPreviousMonth', (_e, month: number, year: number) =>
    generateMovementsFromPreviousMonth(month, year)
  )

  // ── Registro de cargas — conceptos multi-carga (Opción C) ──────────────────

  ipcMain.handle('finance:movementEntries:list', (_e, movementId: string) =>
    listMovementEntries(movementId)
  )

  ipcMain.handle('finance:movementEntries:add', (_e, data: CreateFinanceMovementEntryInput) =>
    addMovementEntry(data)
  )

  ipcMain.handle('finance:movementEntries:update', (_e, id: string, data: UpdateFinanceMovementEntryInput) =>
    updateMovementEntry(id, data)
  )

  ipcMain.handle('finance:movementEntries:remove', (_e, id: string) =>
    removeMovementEntry(id)
  )

  // ── Resumen / dashboard ─────────────────────────────────────────────────────
  ipcMain.handle('finance:summary:get', (_e, month: number, year: number) =>
    getFinanceMonthSummary(month, year)
  )

  // ── Visualización / análisis (Fase 3) ───────────────────────────────────────
  ipcMain.handle('finance:analytics:categoryBreakdown', (_e, month: number, year: number) =>
    getFinanceCategoryBreakdown(month, year)
  )

  ipcMain.handle('finance:analytics:history', (_e, month: number, year: number, monthsBack: number) =>
    getFinanceHistory(month, year, monthsBack)
  )

  ipcMain.handle('finance:analytics:topConcepts', (_e, month: number, year: number, limit?: number) =>
    getFinanceTopConcepts(month, year, limit)
  )

  ipcMain.handle('finance:analytics:topIncreases', (_e, month: number, year: number, limit?: number) =>
    getFinanceTopIncreases(month, year, limit)
  )

  // ── Importación con preview (Fase 5) ─────────────────────────────────────────
  //
  // Flujo en dos pasos: 1) el usuario elige un archivo → se parsea y se arma una
  // previsualización (matching + duplicados) sin tocar la DB; 2) el usuario revisa
  // y decide qué filas confirmar (incluyendo si sobreescribe duplicados) → recién
  // ahí se inserta/actualiza. Así nunca se carga nada "a ciegas".

  ipcMain.handle('finance:import:selectFile', async (e, month: number, year: number) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: 'Importar movimientos',
      properties: ['openFile'],
      filters: [
        { name: 'Excel / CSV', extensions: ['xlsx', 'xls', 'csv'] },
        { name: 'Todos los archivos', extensions: ['*'] }
      ]
    })
    if (result.canceled || !result.filePaths[0]) return null

    const filePath = result.filePaths[0]
    const rows = parseFinanceImportFile(filePath)
    return buildFinanceImportPreview(rows, month, year, path.basename(filePath))
  })

  ipcMain.handle('finance:import:confirm', (_e, items: FinanceImportConfirmItem[], month: number, year: number) =>
    confirmFinanceImport(items, month, year)
  )

  // ── Modo "pegar datos" (IA) ──────────────────────────────────────────────────
  //
  // Mismo flujo de previsualización que la importación de archivos, pero el
  // origen es texto pegado a mano (tabla de Excel, lista de WhatsApp, notas
  // sueltas) que la IA interpreta y normaliza a filas — `buildFinanceImportPreview`
  // hace despues el mismo trabajo de matching/duplicados sin distinguir el origen.
  ipcMain.handle('finance:import:parseText', async (_e, rawText: string, month: number, year: number) => {
    const rows = await parseFinanceImportText(rawText, month, year)
    return buildFinanceImportPreview(rows, month, year, 'Texto pegado')
  })

  // ── Exportación: Excel / CSV / PDF resumen (Fase 5) ──────────────────────────

  ipcMain.handle('finance:export:movements', async (e, month: number, year: number, format: 'xlsx' | 'csv') => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    const ext = format === 'csv' ? 'csv' : 'xlsx'
    const defaultPath = `movimientos-${MONTH_NAMES_ES[month - 1]}-${year}.${ext}`
    const result = await dialog.showSaveDialog(win, {
      title: 'Exportar movimientos',
      defaultPath,
      filters: [{ name: format === 'csv' ? 'CSV' : 'Excel', extensions: [ext] }]
    })
    if (result.canceled || !result.filePath) return null

    const movements = listFinanceMovements(month, year)
    writeFinanceMovementsFile(result.filePath, format, movements)
    shell.showItemInFolder(result.filePath)
    return { filePath: result.filePath }
  })

  // Exporta una selección puntual de movimientos (acciones en lote desde la
  // tabla) — a diferencia de "finance:export:movements", no vuelve a consultar
  // la DB por mes/año: usa directamente los movimientos ya cargados en el
  // renderer (los que el usuario tildó), tal como están en pantalla.
  ipcMain.handle('finance:export:selection', async (e, movements: FinanceMovement[], format: 'xlsx' | 'csv') => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    if (!movements.length) return null
    const ext = format === 'csv' ? 'csv' : 'xlsx'
    const defaultPath = `movimientos-seleccion.${ext}`
    const result = await dialog.showSaveDialog(win, {
      title: 'Exportar selección de movimientos',
      defaultPath,
      filters: [{ name: format === 'csv' ? 'CSV' : 'Excel', extensions: [ext] }]
    })
    if (result.canceled || !result.filePath) return null

    writeFinanceMovementsFile(result.filePath, format, movements)
    shell.showItemInFolder(result.filePath)
    return { filePath: result.filePath }
  })

  ipcMain.handle('finance:export:summaryPdf', async (e, month: number, year: number) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    const defaultPath = `resumen-${MONTH_NAMES_ES[month - 1]}-${year}.pdf`
    const result = await dialog.showSaveDialog(win, {
      title: 'Exportar resumen en PDF',
      defaultPath,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (result.canceled || !result.filePath) return null

    const summary   = getFinanceMonthSummary(month, year)
    const breakdown = getFinanceCategoryBreakdown(month, year)
    const movements = listFinanceMovements(month, year)
    writeFinanceSummaryPdf(result.filePath, { month, year, summary, breakdown, movements })
    shell.showItemInFolder(result.filePath)
    return { filePath: result.filePath }
  })

  // ── Bloqueo por PIN (Fase 5) ─────────────────────────────────────────────────
  //
  // Persistencia local (ConfigStore), no en la DB sincronizable — ver
  // finance-security.service para el detalle de hashing (scrypt + salt).

  ipcMain.handle('finance:security:status', () => getFinanceSecurityStatus())

  ipcMain.handle('finance:security:setup', (_e, pin: string) => setFinancePin(pin))

  ipcMain.handle('finance:security:verify', (_e, pin: string) => verifyFinancePin(pin))

  ipcMain.handle('finance:security:disable', (_e, currentPin: string) => disableFinancePin(currentPin))

  ipcMain.handle('finance:security:change', (_e, currentPin: string, newPin: string) => changeFinancePin(currentPin, newPin))
}
