import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import path from 'path'
import {
  listCompanyFinanceAccounts, createCompanyFinanceAccount, updateCompanyFinanceAccount, deleteCompanyFinanceAccount,
  listCompanyFinanceCategories, createCompanyFinanceCategory, updateCompanyFinanceCategory, deleteCompanyFinanceCategory,
  listCompanyFinancePaymentMethods, createCompanyFinancePaymentMethod, updateCompanyFinancePaymentMethod, deleteCompanyFinancePaymentMethod,
  listCompanyFinanceConcepts, getCompanyFinanceConcept, createCompanyFinanceConcept, updateCompanyFinanceConcept, deleteCompanyFinanceConcept,
  listCompanyFinanceMovements, listUpcomingCompanyFinanceMovements, getCompanyFinanceMovement, createCompanyFinanceMovement, updateCompanyFinanceMovement,
  quickUpdateCompanyFinanceMovement, deleteCompanyFinanceMovement, generateMovementsForMonth, generateMovementsFromPreviousMonth,
  listMovementEntries, addMovementEntry, updateMovementEntry, removeMovementEntry,
  getCompanyFinanceMonthSummary,
  getCompanyFinanceCategoryBreakdown, getCompanyFinanceHistory, getCompanyFinanceTopConcepts, getCompanyFinanceTopIncreases,
  getCompanyFinanceMonthInsight, saveCompanyFinanceMonthNotes, saveCompanyFinanceMonthAIAnalysis,
  buildCompanyFinanceImportPreview, confirmCompanyFinanceImport
} from '../database/queries/company-finance'
import {
  parseFinanceImportFile, writeFinanceMovementsFile, writeFinanceSummaryPdf
} from '../services/finance-io.service'
import { parseFinanceImportText, compareFinanceMonths } from '../services/ai.service'
import {
  getCompanyFinanceSecurityStatus, setCompanyFinancePin, verifyCompanyFinancePin, disableCompanyFinancePin, changeCompanyFinancePin
} from '../services/company-finance-security.service'
import type {
  CreateFinanceAccountInput, CreateFinanceCategoryInput, CreateFinancePaymentMethodInput,
  CreateFinanceConceptInput, CreateFinanceMovementInput,
  CreateFinanceMovementEntryInput, UpdateFinanceMovementEntryInput,
  FinanceMovementStatus, FinanceImportConfirmItem, FinanceMovement
} from '@shared/types'

const MONTH_NAMES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
]

/**
 * `finance-io.service` es un servicio "de I/O puro" que no toca la DB, así que
 * no puede resolver los nombres de métodos de pago dinámicos por su cuenta —
 * se le pasa este mapa armado acá (id → nombre), construido desde la tabla
 * gestionable `finance_payment_methods` para reflejar también los métodos
 * personalizados que el usuario haya creado.
 */
function buildPaymentMethodLabels(): Record<string, string> {
  const map: Record<string, string> = {}
  for (const m of listCompanyFinancePaymentMethods()) map[m.id] = m.name
  return map
}

export function registerCompanyFinanceIpc(): void {

  // ── Accounts ────────────────────────────────────────────────────────────────
  ipcMain.handle('companyFinance:accounts:list', () => listCompanyFinanceAccounts())

  ipcMain.handle('companyFinance:accounts:create', (_e, data: CreateFinanceAccountInput) =>
    createCompanyFinanceAccount(data)
  )

  ipcMain.handle('companyFinance:accounts:update', (_e, id: string, data: Partial<CreateFinanceAccountInput>) =>
    updateCompanyFinanceAccount(id, data)
  )

  ipcMain.handle('companyFinance:accounts:delete', (_e, id: string) =>
    deleteCompanyFinanceAccount(id)
  )

  // ── Categories ──────────────────────────────────────────────────────────────
  ipcMain.handle('companyFinance:categories:list', () => listCompanyFinanceCategories())

  ipcMain.handle('companyFinance:categories:create', (_e, data: CreateFinanceCategoryInput) =>
    createCompanyFinanceCategory(data)
  )

  ipcMain.handle('companyFinance:categories:update', (_e, id: string, data: Partial<CreateFinanceCategoryInput>) =>
    updateCompanyFinanceCategory(id, data)
  )

  ipcMain.handle('companyFinance:categories:delete', (_e, id: string) =>
    deleteCompanyFinanceCategory(id)
  )

  // ── Payment methods ─────────────────────────────────────────────────────────
  ipcMain.handle('companyFinance:paymentMethods:list', () => listCompanyFinancePaymentMethods())

  ipcMain.handle('companyFinance:paymentMethods:create', (_e, data: CreateFinancePaymentMethodInput) =>
    createCompanyFinancePaymentMethod(data)
  )

  ipcMain.handle('companyFinance:paymentMethods:update', (_e, id: string, data: Partial<CreateFinancePaymentMethodInput>) =>
    updateCompanyFinancePaymentMethod(id, data)
  )

  ipcMain.handle('companyFinance:paymentMethods:delete', (_e, id: string) =>
    deleteCompanyFinancePaymentMethod(id)
  )

  // ── Concepts ────────────────────────────────────────────────────────────────
  ipcMain.handle('companyFinance:concepts:list', (_e, opts?: { activeOnly?: boolean }) =>
    listCompanyFinanceConcepts(opts)
  )

  ipcMain.handle('companyFinance:concepts:get', (_e, id: string) => getCompanyFinanceConcept(id))

  ipcMain.handle('companyFinance:concepts:create', (_e, data: CreateFinanceConceptInput) =>
    createCompanyFinanceConcept(data)
  )

  ipcMain.handle('companyFinance:concepts:update', (_e, id: string, data: Partial<CreateFinanceConceptInput> & { is_active?: number }) =>
    updateCompanyFinanceConcept(id, data)
  )

  ipcMain.handle('companyFinance:concepts:delete', (_e, id: string) =>
    deleteCompanyFinanceConcept(id)
  )

  // ── Movements ───────────────────────────────────────────────────────────────
  ipcMain.handle('companyFinance:movements:list', (_e, month: number, year: number) =>
    listCompanyFinanceMovements(month, year)
  )

  ipcMain.handle('companyFinance:movements:listUpcoming', () => listUpcomingCompanyFinanceMovements())

  ipcMain.handle('companyFinance:movements:get', (_e, id: string) => getCompanyFinanceMovement(id))

  ipcMain.handle('companyFinance:movements:create', (_e, data: CreateFinanceMovementInput) =>
    createCompanyFinanceMovement(data)
  )

  ipcMain.handle('companyFinance:movements:update', (_e, id: string, data: Partial<CreateFinanceMovementInput>) =>
    updateCompanyFinanceMovement(id, data)
  )

  ipcMain.handle('companyFinance:movements:quickUpdate', (_e, id: string, data: {
    amount_actual?: number | null
    status?:        FinanceMovementStatus
    payment_date?:  number | null
    due_date?:      number | null
    notes?:         string
  }) => quickUpdateCompanyFinanceMovement(id, data))

  ipcMain.handle('companyFinance:movements:delete', (_e, id: string) =>
    deleteCompanyFinanceMovement(id)
  )

  ipcMain.handle('companyFinance:movements:generateForMonth', (_e, month: number, year: number) =>
    generateMovementsForMonth(month, year)
  )

  ipcMain.handle('companyFinance:movements:generateFromPreviousMonth', (_e, month: number, year: number) =>
    generateMovementsFromPreviousMonth(month, year)
  )

  // ── Registro de cargas — conceptos multi-carga (Opción C) ──────────────────

  ipcMain.handle('companyFinance:movementEntries:list', (_e, movementId: string) =>
    listMovementEntries(movementId)
  )

  ipcMain.handle('companyFinance:movementEntries:add', (_e, data: CreateFinanceMovementEntryInput) =>
    addMovementEntry(data)
  )

  ipcMain.handle('companyFinance:movementEntries:update', (_e, id: string, data: UpdateFinanceMovementEntryInput) =>
    updateMovementEntry(id, data)
  )

  ipcMain.handle('companyFinance:movementEntries:remove', (_e, id: string) =>
    removeMovementEntry(id)
  )

  // ── Resumen / dashboard ─────────────────────────────────────────────────────
  ipcMain.handle('companyFinance:summary:get', (_e, month: number, year: number) =>
    getCompanyFinanceMonthSummary(month, year)
  )

  // ── Notas y comparador con IA del mes (Dashboard) ───────────────────────────
  //
  // "generateAnalysis" SOLO genera y devuelve el texto — no guarda nada, así el
  // usuario puede revisar la conclusión antes de decidir conservarla. El guardado
  // es una acción separada y explícita ("saveAnalysis"), igual que pidió Diego:
  // conclusiones que queden guardadas (y visibles después) recién al hacer click
  // en "Guardar", no automáticamente.

  ipcMain.handle('companyFinance:insights:get', (_e, month: number, year: number) =>
    getCompanyFinanceMonthInsight(month, year)
  )

  ipcMain.handle('companyFinance:insights:saveNotes', (_e, month: number, year: number, notes: string) =>
    saveCompanyFinanceMonthNotes(month, year, notes)
  )

  ipcMain.handle('companyFinance:insights:generateAnalysis', async (_e, month: number, year: number) => {
    const insight = getCompanyFinanceMonthInsight(month, year)
    return compareFinanceMonths({
      month, year,
      summary:      getCompanyFinanceMonthSummary(month, year),
      breakdown:    getCompanyFinanceCategoryBreakdown(month, year),
      topConcepts:  getCompanyFinanceTopConcepts(month, year),
      topIncreases: getCompanyFinanceTopIncreases(month, year),
      userNotes:    insight?.notes
    })
  })

  ipcMain.handle('companyFinance:insights:saveAnalysis', (_e, month: number, year: number, analysis: string) =>
    saveCompanyFinanceMonthAIAnalysis(month, year, analysis)
  )

  // ── Visualización / análisis (Fase 3) ───────────────────────────────────────
  ipcMain.handle('companyFinance:analytics:categoryBreakdown', (_e, month: number, year: number) =>
    getCompanyFinanceCategoryBreakdown(month, year)
  )

  ipcMain.handle('companyFinance:analytics:history', (_e, month: number, year: number, monthsBack: number) =>
    getCompanyFinanceHistory(month, year, monthsBack)
  )

  ipcMain.handle('companyFinance:analytics:topConcepts', (_e, month: number, year: number, limit?: number) =>
    getCompanyFinanceTopConcepts(month, year, limit)
  )

  ipcMain.handle('companyFinance:analytics:topIncreases', (_e, month: number, year: number, limit?: number) =>
    getCompanyFinanceTopIncreases(month, year, limit)
  )

  // ── Importación con preview (Fase 5) ─────────────────────────────────────────
  //
  // Flujo en dos pasos: 1) el usuario elige un archivo → se parsea y se arma una
  // previsualización (matching + duplicados) sin tocar la DB; 2) el usuario revisa
  // y decide qué filas confirmar (incluyendo si sobreescribe duplicados) → recién
  // ahí se inserta/actualiza. Así nunca se carga nada "a ciegas".

  ipcMain.handle('companyFinance:import:selectFile', async (e, month: number, year: number) => {
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
    return buildCompanyFinanceImportPreview(rows, month, year, path.basename(filePath))
  })

  ipcMain.handle('companyFinance:import:confirm', (_e, items: FinanceImportConfirmItem[], month: number, year: number) =>
    confirmCompanyFinanceImport(items, month, year)
  )

  // ── Modo "pegar datos" (IA) ──────────────────────────────────────────────────
  //
  // Mismo flujo de previsualización que la importación de archivos, pero el
  // origen es texto pegado a mano (tabla de Excel, lista de WhatsApp, notas
  // sueltas) que la IA interpreta y normaliza a filas — `buildCompanyFinanceImportPreview`
  // hace despues el mismo trabajo de matching/duplicados sin distinguir el origen.
  ipcMain.handle('companyFinance:import:parseText', async (_e, rawText: string, month: number, year: number) => {
    const rows = await parseFinanceImportText(rawText, month, year)
    return buildCompanyFinanceImportPreview(rows, month, year, 'Texto pegado')
  })

  // ── Exportación: Excel / CSV / PDF resumen (Fase 5) ──────────────────────────

  ipcMain.handle('companyFinance:export:movements', async (e, month: number, year: number, format: 'xlsx' | 'csv') => {
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

    const movements = listCompanyFinanceMovements(month, year)
    writeFinanceMovementsFile(result.filePath, format, movements, buildPaymentMethodLabels())
    shell.showItemInFolder(result.filePath)
    return { filePath: result.filePath }
  })

  // Exporta una selección puntual de movimientos (acciones en lote desde la
  // tabla) — a diferencia de "finance:export:movements", no vuelve a consultar
  // la DB por mes/año: usa directamente los movimientos ya cargados en el
  // renderer (los que el usuario tildó), tal como están en pantalla.
  ipcMain.handle('companyFinance:export:selection', async (e, movements: FinanceMovement[], format: 'xlsx' | 'csv') => {
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

    writeFinanceMovementsFile(result.filePath, format, movements, buildPaymentMethodLabels())
    shell.showItemInFolder(result.filePath)
    return { filePath: result.filePath }
  })

  ipcMain.handle('companyFinance:export:summaryPdf', async (e, month: number, year: number) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    const defaultPath = `resumen-${MONTH_NAMES_ES[month - 1]}-${year}.pdf`
    const result = await dialog.showSaveDialog(win, {
      title: 'Exportar resumen en PDF',
      defaultPath,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (result.canceled || !result.filePath) return null

    const summary   = getCompanyFinanceMonthSummary(month, year)
    const breakdown = getCompanyFinanceCategoryBreakdown(month, year)
    const movements = listCompanyFinanceMovements(month, year)
    writeFinanceSummaryPdf(result.filePath, { month, year, summary, breakdown, movements })
    shell.showItemInFolder(result.filePath)
    return { filePath: result.filePath }
  })

  // ── Bloqueo por PIN (Fase 5) ─────────────────────────────────────────────────
  //
  // Persistencia local (ConfigStore), no en la DB sincronizable — ver
  // finance-security.service para el detalle de hashing (scrypt + salt).

  ipcMain.handle('companyFinance:security:status', () => getCompanyFinanceSecurityStatus())

  ipcMain.handle('companyFinance:security:setup', (_e, pin: string) => setCompanyFinancePin(pin))

  ipcMain.handle('companyFinance:security:verify', (_e, pin: string) => verifyCompanyFinancePin(pin))

  ipcMain.handle('companyFinance:security:disable', (_e, currentPin: string) => disableCompanyFinancePin(currentPin))

  ipcMain.handle('companyFinance:security:change', (_e, currentPin: string, newPin: string) => changeCompanyFinancePin(currentPin, newPin))
}
