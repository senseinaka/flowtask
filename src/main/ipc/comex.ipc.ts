import { ipcMain, shell, dialog, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { randomUUID } from 'crypto'
import {
  listSuppliers, getSupplier, createSupplier, updateSupplier, deleteSupplier,
  listImports, getImport, createImport, updateImport, deleteImport, getImportFullDetail,
  listItems, createItem, deleteItem,
  listDocuments, getDocument, createDocument, updateDocument, deleteDocument,
  listQuotes, createQuote, updateQuote, deleteQuote,
  listQuoteFiles, createQuoteFile, updateQuoteFile, deleteQuoteFile,
  listImportPlFiles, getImportPlFile, createImportPlFile, updateImportPlFile, deleteImportPlFile,
  listPayments, createPayment, updatePayment, deletePayment,
  getCustoms, upsertCustoms, listCosts, createCost, updateCost, deleteCost,
  listSupplierContacts, createSupplierContact, updateSupplierContact, deleteSupplierContact,
  listSupplierBankAccounts, createSupplierBankAccount, updateSupplierBankAccount, deleteSupplierBankAccount,
  listFreightOperators, getFreightOperator, createFreightOperator, updateFreightOperator, deleteFreightOperator,
  listOperatorContacts, createOperatorContact, updateOperatorContact, deleteOperatorContact,
  listTributos, createTributo, updateTributo, deleteTributo, upsertTributos,
  listExtraCosts, getExtraCost, createExtraCost, updateExtraCost, deleteExtraCost,
  createDefaultExtraCosts,
  listProformas, getProforma, createProforma, updateProforma, deleteProforma,
  listInalCerts, createInalCert, updateInalCert, deleteInalCert, getInalCert,
  listInalVeps, createInalVep, updateInalVep, deleteInalVep, getInalVep,
  listGestores, getGestor, createGestor, updateGestor, deleteGestor,
  createGestorContact, updateGestorContact, deleteGestorContact,
  listDespachantes, createDespachante, updateDespachante, deleteDespachante,
  createDespachanteContact, updateDespachanteContact, deleteDespachanteContact,
  createDespachanteBankAccount, updateDespachanteBankAccount, deleteDespachanteBankAccount,
  listBrands, getBrand, createBrand, updateBrand, deleteBrand,
  listPlannings, getPlanning, createPlanning, updatePlanning, deletePlanning, recalculatePlanning,
  updateMilestone,
  listPlanningAIReports, createPlanningAIReport, deletePlanningAIReport,
  listCotizaciones, addCotizacion,
  listAlarmasCotizacion, addAlarmaCotizacion, updateAlarmaCotizacion, deleteAlarmaCotizacion
} from '../database/queries/comex'
import { getBcraRates, refreshBcraRates, getBcraCotizacionHoy } from '../services/bcra.service'
import { getBnaBilleteHoy } from '../services/bna.service'
import { generatePlanningRecommendation, generatePlanningAIReport } from '../services/planning-ai.service'
import type { GeneratePlanningAIReportInput } from '../services/planning-ai.service'
import { writePlanningsExcel, writePlanningAIReportsExcel } from '../services/comex-planning-io.service'
import { writeImportExcel, writeImportPdf, buildImportExportTitle, sanitizeFileName } from '../services/comex-import-export.service'
import { driveService } from '../services/drive.service'
import { resolveAttachmentPath } from '../database/db'
import { analyzeDocument } from '../services/ai.service'
import type {
  ComexSupplier, ComexImport, ComexDocument,
  ComexLogisticsQuote, ComexQuoteFile, ComexPayment, ComexCostItem,
  ComexSupplierContact, ComexSupplierBankAccount, ComexFreightOperator,
  ComexFreightOperatorContact, ComexImportTributo, CreateComexImportTributoInput,
  ComexImportExtraCost, CreateComexImportExtraCostInput,
  ComexProforma, CreateComexProformaInput,
  ComexGestor, CreateComexGestorInput, CreateComexGestorContactInput,
  ComexDespachante, CreateComexDespachanteInput, CreateComexDespachanteContactInput,
  CreateComexDespachanteBankAccountInput,
  CreateComexSupplierInput, CreateComexImportInput,
  CreateComexItemInput, CreateComexDocumentInput,
  CreateComexQuoteInput, CreateComexPaymentInput,
  UpsertComexCustomsInput, CreateComexCostInput,
  CreateComexSupplierContactInput, CreateComexSupplierBankAccountInput,
  CreateComexFreightOperatorInput, CreateComexFreightOperatorContactInput,
  ComexBrand, CreateComexBrandInput,
  ImportOrderPlanning, CreateImportOrderPlanningInput, ImportOrderPlanningMilestone,
  ImportOrderPlanningAIReport
} from '@shared/types'
import type { PlanningAIReportType } from '@shared/types'

// ── Subcarpetas Drive por defecto para cada importación ───────────────────────

const COST_SUBFOLDERS: Record<string, string> = {
  despachante:         'Factura despachante',
  flete_internacional: 'Factura flete internacional',
  flete_local:         'Factura flete local',
  deposito_fiscal:     'Factura depósito fiscal'
}

async function setupImportDriveFolders(
  importId: string,
  importTitle: string
): Promise<{ folderId: string; url: string }> {
  const result = await driveService.createImportFolder(importTitle)
  await updateImport(importId, { drive_folder_id: result.folderId })

  const costs = await listExtraCosts(importId)

  // Subcarpetas de facturas
  for (const [categoria, folderName] of Object.entries(COST_SUBFOLDERS)) {
    const cost = costs.find(c => c.categoria === categoria)
    if (cost && !cost.drive_folder_id) {
      const subId = await driveService.createSubfolder(folderName, result.folderId)
      await updateExtraCost(cost.id, { drive_folder_id: subId })
    }
  }

  // Subcarpeta "BL - Bill of Lading"
  const impBL = await getImport(importId)
  if (impBL && !impBL.bl_folder_id) {
    const blId = await driveService.createSubfolder('BL - Bill of Lading', result.folderId)
    await updateImport(importId, { bl_folder_id: blId })
  }
  // Subcarpeta "INAL"
  const impINAL = await getImport(importId)
  if (impINAL && !impINAL.inal_drive_folder_id) {
    const inalId = await driveService.createSubfolder('INAL', result.folderId)
    await updateImport(importId, { inal_drive_folder_id: inalId })
  }
  // Subcarpeta "Despacho"
  const imp = await getImport(importId)
  if (imp && !imp.despacho_folder_id) {
    const despachoId = await driveService.createSubfolder('Despacho', result.folderId)
    await updateImport(importId, { despacho_folder_id: despachoId })
  }
  // Subcarpetas de proformas y facturas
  const imp2 = await getImport(importId)
  if (imp2 && !imp2.proformas_folder_id) {
    const proformasId = await driveService.createSubfolder('Proformas', result.folderId)
    await updateImport(importId, { proformas_folder_id: proformasId })
  }
  const imp3 = await getImport(importId)
  if (imp3 && !imp3.facturas_folder_id) {
    const facturasId = await driveService.createSubfolder('Facturas comerciales', result.folderId)
    await updateImport(importId, { facturas_folder_id: facturasId })
  }
  // Subcarpeta "PL - Packing List"
  const imp4 = await getImport(importId)
  if (imp4 && !imp4.pl_folder_id) {
    const plId = await driveService.createSubfolder('PL - Packing List', result.folderId)
    await updateImport(importId, { pl_folder_id: plId })
  }

  return result
}

// ── Helper: sube o actualiza una proforma en Drive ────────────────────────────

async function _uploadProformaToDrive(
  importId:    string,
  proformaId:  string,
  localPath:   string,
  fileName:    string,
  ext:         string
): Promise<void> {
  const imp = await getImport(importId)
  if (!imp?.drive_folder_id) throw new Error('Sin carpeta Drive en la importación')

  const pf = await getProforma(proformaId)
  if (!pf) throw new Error('Proforma no encontrada')

  const isFactura = pf.tipo === 'factura'

  // 1. Carpeta padre "Proformas" o "Facturas comerciales"
  let parentFolderId = isFactura ? imp.facturas_folder_id : imp.proformas_folder_id
  if (!parentFolderId) {
    const parentName  = isFactura ? 'Facturas comerciales' : 'Proformas'
    parentFolderId    = await driveService.createSubfolder(parentName, imp.drive_folder_id)
    const updateField = isFactura ? { facturas_folder_id: parentFolderId } : { proformas_folder_id: parentFolderId }
    await updateImport(importId, updateField)
  }

  // 2. Subcarpeta sin fecha: "Proforma N" o "Factura N" (se renombrará después de extraer la fecha)
  const prefix  = isFactura ? 'Factura' : 'Proforma'
  const subName = `${prefix} ${pf.numero}`
  const subId   = pf.drive_folder_id ?? await driveService.createSubfolder(subName, parentFolderId)

  // 3. Subir archivo
  const mimeType    = getMimeType(ext)
  const driveFileId = await driveService.uploadFileToFolder(localPath, subId, fileName, mimeType)

  await updateProforma(proformaId, { drive_file_id: driveFileId, drive_folder_id: subId, drive_status: 'synced' })
}

/** Renombra la carpeta Drive de una proforma/factura agregando la fecha una vez conocida */
async function _renameDriveFolder(proformaId: string): Promise<void> {
  const pf = await getProforma(proformaId)
  if (!pf?.drive_folder_id || !pf.fecha_proforma) return
  try {
    const [y, m, d] = pf.fecha_proforma.split('-')
    const dateStr   = `${d}-${m}-${y.slice(2)}`
    const prefix    = pf.tipo === 'factura' ? 'Factura' : 'Proforma'
    const newName   = `${prefix} ${pf.numero} ${dateStr}`
    await driveService.renameFile(pf.drive_folder_id, newName)
  } catch { /* non-critical */ }
}

function parseVepImporte(raw: string): number | null {
  // Strip everything except digits, commas and periods
  const s = raw.trim().replace(/[^0-9.,]/g, '')
  if (!s) return null
  // "100.888,33" — Argentine: period = thousands, comma = decimal
  if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s)) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.'))
  }
  // "100,888.33" — US: comma = thousands, period = decimal
  if (/^\d{1,3}(,\d{3})+\.\d{1,2}$/.test(s)) {
    return parseFloat(s.replace(/,/g, ''))
  }
  // "100888,33" — only comma as decimal
  if (/^\d+,\d{1,2}$/.test(s)) {
    return parseFloat(s.replace(',', '.'))
  }
  // "100888.33" or bare integer
  const n = parseFloat(s)
  return isNaN(n) || n <= 0 ? null : n
}

/** Promesa con timeout: si `p` no resuelve en `ms`, rechaza con un error claro.
 *  Evita que un cuelgue de red (Drive/IA) deje el VEP en 'processing' para siempre. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label}: timeout tras ${ms}ms`)), ms)
    )
  ])
}

/** Resuelve (o crea una sola vez) la subcarpeta "VEP ANMAT" en Drive.
 *  Deduplica con un cache de promesas por import: aunque entren varios uploads
 *  casi a la vez, la carpeta se crea una única vez. */
const vepFolderInFlight = new Map<string, Promise<string | null>>()
async function resolveVepDriveFolder(importId: string, importFolderId: string | null): Promise<string | null> {
  if (!importFolderId) return null
  const imp = await getImport(importId)
  if (imp?.inal_lc_cert_folder_id) return imp.inal_lc_cert_folder_id
  let pending = vepFolderInFlight.get(importId)
  if (!pending) {
    pending = (async () => {
      const id = await withTimeout(
        driveService.createSubfolder('VEP ANMAT', importFolderId), 30_000, 'Drive crear carpeta'
      )
      await updateImport(importId, { inal_lc_cert_folder_id: id })
      return id
    })()
    vepFolderInFlight.set(importId, pending)
    void pending.catch(() => {}).finally(() => vepFolderInFlight.delete(importId))
  }
  return pending
}

export function registerComexIpc(): void {
  // ── Suppliers ────────────────────────────────────────────────────────────────
  ipcMain.handle('comex:suppliers:list',   ()          => listSuppliers())
  ipcMain.handle('comex:suppliers:get',    (_e, id)    => getSupplier(id))
  ipcMain.handle('comex:suppliers:create', (_e, input: CreateComexSupplierInput) => createSupplier(input))
  ipcMain.handle('comex:suppliers:update', (_e, id: string, data: Partial<ComexSupplier>) => updateSupplier(id, data))
  ipcMain.handle('comex:suppliers:delete', (_e, id)    => deleteSupplier(id))

  // ── Marcas (Programación Pedidos) ─────────────────────────────────────────────
  ipcMain.handle('comex:brands:list',   ()                                     => listBrands())
  ipcMain.handle('comex:brands:get',    (_e, id: string)                       => getBrand(id))
  ipcMain.handle('comex:brands:create', (_e, input: CreateComexBrandInput)     => createBrand(input))
  ipcMain.handle('comex:brands:update', (_e, id: string, data: Partial<ComexBrand>) => updateBrand(id, data))
  ipcMain.handle('comex:brands:delete', (_e, id: string)                       => deleteBrand(id))

  // ── Programaciones de pedido (Programación Pedidos) ───────────────────────────
  ipcMain.handle('comex:plannings:list',       (_e, filters?: { brandId?: string; status?: string }) => listPlannings(filters))
  ipcMain.handle('comex:plannings:get',        (_e, id: string)                            => getPlanning(id))
  ipcMain.handle('comex:plannings:create',     (_e, input: CreateImportOrderPlanningInput) => createPlanning(input))
  ipcMain.handle('comex:plannings:update',     (_e, id: string, data: Partial<ImportOrderPlanning>) => updatePlanning(id, data))
  ipcMain.handle('comex:plannings:delete',     (_e, id: string)                            => deletePlanning(id))
  ipcMain.handle('comex:plannings:recalculate',(_e, id: string)                            => recalculatePlanning(id))

  // ── Hitos de programación ──────────────────────────────────────────────────────
  ipcMain.handle('comex:planningMilestones:update', (_e, id: string, data: Partial<ImportOrderPlanningMilestone>) => updateMilestone(id, data))

  // ── IA de Programación Pedidos ────────────────────────────────────────────────
  ipcMain.handle('comex:plannings:ai:recommend', async (_e, planningId: string) => {
    const { summary, riskExplanation } = await generatePlanningRecommendation(planningId)
    return updatePlanning(planningId, {
      ai_recommendation_summary: summary,
      ai_risk_explanation: riskExplanation
    })
  })

  ipcMain.handle('comex:planningAIReports:list', (_e, filters?: { reportType?: PlanningAIReportType; brandId?: string; supplierId?: string }) =>
    listPlanningAIReports(filters)
  )
  ipcMain.handle('comex:planningAIReports:generate', async (_e, input: GeneratePlanningAIReportInput) => {
    const { tokensUsed, ...reportInput } = await generatePlanningAIReport(input)
    void tokensUsed
    return createPlanningAIReport(reportInput)
  })
  ipcMain.handle('comex:planningAIReports:delete', (_e, id: string) => deletePlanningAIReport(id))

  // ── Exportación: Programación Pedidos ─────────────────────────────────────────
  // Exporta la lista ya filtrada en pantalla (incluye filtros client-side de
  // riesgo/proveedor/tipo/rango de fechas que no maneja `listPlannings`).
  ipcMain.handle('comex:plannings:export', async (e, plannings: ImportOrderPlanning[]) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    if (!plannings.length) return null
    const result = await dialog.showSaveDialog(win, {
      title: 'Exportar programaciones',
      defaultPath: 'programaciones-pedidos.xlsx',
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    })
    if (result.canceled || !result.filePath) return null

    writePlanningsExcel(result.filePath, plannings)
    shell.showItemInFolder(result.filePath)
    return { filePath: result.filePath }
  })

  ipcMain.handle('comex:planningAIReports:export', async (e, reports: ImportOrderPlanningAIReport[]) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    if (!reports.length) return null
    const result = await dialog.showSaveDialog(win, {
      title: 'Exportar reportes IA',
      defaultPath: 'reportes-ia-programacion.xlsx',
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    })
    if (result.canceled || !result.filePath) return null

    const brandLabels = Object.fromEntries((await listBrands()).map((b) => [b.id, b.name]))
    const supplierLabels = Object.fromEntries((await listSuppliers()).map((s) => [s.id, s.name]))
    writePlanningAIReportsExcel(result.filePath, reports, brandLabels, supplierLabels)
    shell.showItemInFolder(result.filePath)
    return { filePath: result.filePath }
  })

  // ── Imports ──────────────────────────────────────────────────────────────────
  ipcMain.handle('comex:imports:list',   (_e, status?: string) => listImports(status))
  ipcMain.handle('comex:imports:get',    (_e, id)              => getImport(id))
  ipcMain.handle('comex:imports:create', async (_e, input: CreateComexImportInput) => {
    const imp = await createImport(input)
    await createDefaultExtraCosts(imp.id)

    // Crear carpetas Drive en background si el usuario está autenticado
    if (driveService.isAuthenticated()) {
      setImmediate(async () => {
        try {
          await setupImportDriveFolders(imp.id, imp.title)
          // Notificar al renderer para que refresque la importación
          BrowserWindow.getAllWindows().forEach(w =>
            w.webContents.send('comex:import:folderReady', imp.id)
          )
          console.log(`[Drive] Carpetas creadas automáticamente para importación: ${imp.title}`)
        } catch (err) {
          console.error('[Drive] Error creando carpetas automáticas:', err)
        }
      })
    }

    return imp
  })
  ipcMain.handle('comex:imports:update', (_e, id: string, data: Partial<ComexImport>) => updateImport(id, data))
  ipcMain.handle('comex:imports:delete', (_e, id)              => deleteImport(id))

  // ── Exportación de una importación ────────────────────────────────────────
  ipcMain.handle('comex:imports:exportXlsx', async (e, importId: string) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    const detail = await getImportFullDetail(importId)
    if (!detail) return null
    const result = await dialog.showSaveDialog(win, {
      title: 'Exportar importación',
      defaultPath: `${sanitizeFileName(buildImportExportTitle(detail))}.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    })
    if (result.canceled || !result.filePath) return null
    try {
      writeImportExcel(result.filePath, detail)
    } catch (err) {
      console.error('[Comex export] Error generando Excel:', err)
      dialog.showErrorBox('Error al exportar', `No se pudo generar el archivo Excel.\n${(err as Error).message}`)
      return null
    }

    const choice = await dialog.showMessageBox(win, {
      type: 'info',
      buttons: ['Abrir archivo', 'Cerrar'],
      defaultId: 0,
      title: 'Exportación completa',
      message: `Se generó "${path.basename(result.filePath)}". ¿Querés abrirlo?`
    })
    if (choice.response === 0) shell.openPath(result.filePath)
    else shell.showItemInFolder(result.filePath)
    return { filePath: result.filePath }
  })

  ipcMain.handle('comex:imports:exportPdf', async (e, importId: string) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    const detail = await getImportFullDetail(importId)
    if (!detail) return null
    const result = await dialog.showSaveDialog(win, {
      title: 'Exportar importación',
      defaultPath: `${sanitizeFileName(buildImportExportTitle(detail))}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (result.canceled || !result.filePath) return null
    try {
      writeImportPdf(result.filePath, detail)
    } catch (err) {
      console.error('[Comex export] Error generando PDF:', err)
      dialog.showErrorBox('Error al exportar', `No se pudo generar el archivo PDF.\n${(err as Error).message}`)
      return null
    }

    const choice = await dialog.showMessageBox(win, {
      type: 'info',
      buttons: ['Abrir archivo', 'Cerrar'],
      defaultId: 0,
      title: 'Exportación completa',
      message: `Se generó "${path.basename(result.filePath)}". ¿Querés abrirlo?`
    })
    if (choice.response === 0) shell.openPath(result.filePath)
    else shell.showItemInFolder(result.filePath)
    return { filePath: result.filePath }
  })

  // ── Items ────────────────────────────────────────────────────────────────────
  ipcMain.handle('comex:items:list',   (_e, importId)                  => listItems(importId))
  ipcMain.handle('comex:items:create', (_e, input: CreateComexItemInput) => createItem(input))
  ipcMain.handle('comex:items:delete', (_e, id)                        => deleteItem(id))

  // ── Documents ────────────────────────────────────────────────────────────────
  ipcMain.handle('comex:documents:list',   (_e, importId)                      => listDocuments(importId))
  ipcMain.handle('comex:documents:create', (_e, input: CreateComexDocumentInput) => createDocument(input))
  ipcMain.handle('comex:documents:update', (_e, id: string, data: Partial<ComexDocument>) => updateDocument(id, data))
  ipcMain.handle('comex:documents:delete', async (_e, id: string) => {
    const doc = await getDocument(id)
    if (doc?.local_stored_name) {
      const fp = resolveAttachmentPath(doc.local_stored_name)
      try { if (fs.existsSync(fp)) fs.unlinkSync(fp) } catch { /* ignore */ }
    }
    await deleteDocument(id)
  })

  // Pick a file from disk (returns path or null)
  ipcMain.handle('comex:documents:selectFile', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [
        { name: 'Documentos', extensions: ['pdf','doc','docx','xls','xlsx','png','jpg','jpeg','zip','txt'] },
        { name: 'Todos los archivos', extensions: ['*'] }
      ]
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // Open a document's local file
  ipcMain.handle('comex:documents:open', async (_e, id: string) => {
    const doc = await getDocument(id)
    if (!doc?.local_stored_name) return
    const fp = resolveAttachmentPath(doc.local_stored_name)
    if (fs.existsSync(fp)) shell.openPath(fp)
  })

  // Attach a file to an existing document + upload to Drive
  ipcMain.handle('comex:documents:upload',
    async (_e, docId: string, filePath: string, importId: string, folderId: string | null, importTitle: string) => {
      const ext         = path.extname(filePath)
      const storedName  = `cx_${randomUUID()}${ext}`
      const destPath    = resolveAttachmentPath(storedName)
      fs.copyFileSync(filePath, destPath)

      const stats       = fs.statSync(destPath)
      const mimeType    = getMimeType(ext)
      const originalName = path.basename(filePath)

      // Remove old local file if exists
      const existing = await getDocument(docId)
      if (existing?.local_stored_name) {
        const oldPath = resolveAttachmentPath(existing.local_stored_name)
        try { if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath) } catch { /* ignore */ }
      }

      // Update with local info first
      await updateDocument(docId, {
        name: originalName,
        local_stored_name: storedName,
        size_bytes: stats.size,
        mime_type: mimeType,
        drive_status: 'none',
        drive_file_id: null
      })

      // Drive upload if authenticated
      if (driveService.isAuthenticated()) {
        await updateDocument(docId, { drive_status: 'uploading' })
        try {
          let targetFolderId = folderId
          if (!targetFolderId) {
            const { folderId: newId } = await driveService.createImportFolder(importTitle)
            targetFolderId = newId
            await updateImport(importId, { drive_folder_id: targetFolderId })
          }
          const driveFileId = await driveService.uploadFileToFolder(destPath, targetFolderId, originalName, mimeType)
          await updateDocument(docId, { drive_file_id: driveFileId, drive_status: 'synced' })
        } catch {
          await updateDocument(docId, { drive_status: 'error' })
        }
      }

      return await getDocument(docId)
    }
  )

  // Create a new document record from a dropped/selected file
  ipcMain.handle('comex:documents:uploadNew',
    async (_e, filePath: string, importId: string, folderId: string | null, importTitle: string) => {
      const ext         = path.extname(filePath)
      const storedName  = `cx_${randomUUID()}${ext}`
      const destPath    = resolveAttachmentPath(storedName)
      fs.copyFileSync(filePath, destPath)

      const stats       = fs.statSync(destPath)
      const mimeType    = getMimeType(ext)
      const originalName = path.basename(filePath)

      const doc = await createDocument({
        import_id: importId,
        type: 'other',
        name: originalName,
        drive_file_id: null,
        status: 'pending',
        notes: '',
        received_at: null,
        local_stored_name: storedName,
        size_bytes: stats.size,
        mime_type: mimeType,
        drive_status: 'none'
      })

      // Drive upload if authenticated
      if (driveService.isAuthenticated()) {
        await updateDocument(doc.id, { drive_status: 'uploading' })
        try {
          let targetFolderId = folderId
          if (!targetFolderId) {
            const { folderId: newId } = await driveService.createImportFolder(importTitle)
            targetFolderId = newId
            await updateImport(importId, { drive_folder_id: targetFolderId })
          }
          const driveFileId = await driveService.uploadFileToFolder(destPath, targetFolderId, originalName, mimeType)
          await updateDocument(doc.id, { drive_file_id: driveFileId, drive_status: 'synced' })
        } catch {
          await updateDocument(doc.id, { drive_status: 'error' })
        }
      }

      return await getDocument(doc.id)
    }
  )

  // ── Logistics quotes ─────────────────────────────────────────────────────────
  ipcMain.handle('comex:quotes:list',   (_e, importId)                    => listQuotes(importId))
  ipcMain.handle('comex:quotes:create', (_e, input: CreateComexQuoteInput) => createQuote(input))
  ipcMain.handle('comex:quotes:update', (_e, id: string, data: Partial<ComexLogisticsQuote>) => updateQuote(id, data))
  ipcMain.handle('comex:quotes:delete', (_e, id)                          => deleteQuote(id))

  // ── Quote files (adjuntos de cotizaciones) ────────────────────────────────────
  ipcMain.handle('comex:quote-files:list', (_e, quoteId: string) => listQuoteFiles(quoteId))

  ipcMain.handle('comex:quote-files:upload', async (_e, {
    quoteId, importId, importTitle, importFolderId, filePath, fileBuffer, fileName: dropFileName
  }: {
    quoteId: string; importId: string; importTitle: string; importFolderId: string | null
    filePath?: string; fileBuffer?: ArrayBuffer; fileName?: string
  }) => {
    let localPath: string
    let tmpPath: string | null = null

    if (fileBuffer && dropFileName) {
      // Drag-and-drop: renderer sent the raw ArrayBuffer. Write to a temp file.
      const safeName = path.basename(dropFileName).replace(/[/\\:*?"<>|]/g, '-')
      tmpPath = path.join(os.tmpdir(), `summit-quote-${Date.now()}-${safeName}`)
      fs.writeFileSync(tmpPath, Buffer.from(fileBuffer))
      localPath = tmpPath
    } else if (filePath) {
      localPath = filePath
    } else {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      const result = await dialog.showOpenDialog(win, {
        title: 'Seleccionar archivo de cotización',
        properties: ['openFile'],
        filters: [
          { name: 'Documentos', extensions: ['pdf', 'xlsx', 'xls', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'zip', 'csv'] }
        ]
      })
      if (result.canceled || !result.filePaths.length) return null
      localPath = result.filePaths[0]
    }

    try {
      const originalName = dropFileName ?? path.basename(localPath)
      const ext          = path.extname(originalName).toLowerCase()
      const mimeType     = getMimeType(ext) || 'application/octet-stream'
      const stats        = fs.statSync(localPath)

      // Crear registro en DB primero — así el archivo aparece en la UI
      // aunque Drive falle (mismo patrón que comex_documents).
      const record = await createQuoteFile({
        quote_id:        quoteId,
        import_id:       importId,
        file_name:       originalName,
        file_size:       stats.size,
        drive_file_id:   '',
        drive_folder_id: null,
        mime_type:       mimeType,
        workspace_id:    null,
      } as Omit<ComexQuoteFile, 'id' | 'created_at' | 'updated_at'>)

      // Subir a Drive si está autenticado
      if (driveService.isAuthenticated()) {
        try {
          let folderId = importFolderId
          if (!folderId) {
            const { folderId: newId } = await driveService.createImportFolder(importTitle)
            await updateImport(importId, { drive_folder_id: newId })
            folderId = newId
          }
          const quotesFolderId = await driveService.createSubfolder('Presupuestos Logísticos', folderId)
          const driveFileId    = await driveService.uploadFileToFolder(localPath, quotesFolderId, originalName, mimeType)
          await updateQuoteFile(record.id, { drive_file_id: driveFileId, drive_folder_id: quotesFolderId })
          return { ...record, drive_file_id: driveFileId, drive_folder_id: quotesFolderId }
        } catch (e) {
          console.error('[comex:quote-files:upload] Drive upload failed:', e)
          // El registro ya está en DB — retornar sin Drive ID
        }
      }

      return record
    } finally {
      if (tmpPath) try { fs.unlinkSync(tmpPath) } catch { /* ignore */ }
    }
  })

  ipcMain.handle('comex:quote-files:delete', async (_e, { fileId, driveFileId }: { fileId: string; driveFileId: string }) => {
    await deleteQuoteFile(fileId)
    await driveService.deleteFile(driveFileId)
  })

  ipcMain.handle('comex:quote-files:open', (_e, driveFileId: string) => {
    shell.openExternal(`https://drive.google.com/file/d/${driveFileId}/view`)
  })

  // ── Payments ─────────────────────────────────────────────────────────────────
  ipcMain.handle('comex:payments:list',   (_e, importId)                      => listPayments(importId))
  ipcMain.handle('comex:payments:create', (_e, input: CreateComexPaymentInput) => createPayment(input))
  ipcMain.handle('comex:payments:update', (_e, id: string, data: Partial<ComexPayment>) => updatePayment(id, data))
  ipcMain.handle('comex:payments:delete', (_e, id)                            => deletePayment(id))

  // ── Supplier Contacts ─────────────────────────────────────────────────────
  ipcMain.handle('comex:supplier-contacts:list',   (_e, supplierId: string) => listSupplierContacts(supplierId))
  ipcMain.handle('comex:supplier-contacts:create', (_e, input: CreateComexSupplierContactInput) => createSupplierContact(input))
  ipcMain.handle('comex:supplier-contacts:update', (_e, id: string, data: Partial<ComexSupplierContact>) => updateSupplierContact(id, data))
  ipcMain.handle('comex:supplier-contacts:delete', (_e, id: string) => deleteSupplierContact(id))

  // ── Supplier Bank Accounts ────────────────────────────────────────────────
  ipcMain.handle('comex:supplier-banks:list',   (_e, supplierId: string) => listSupplierBankAccounts(supplierId))
  ipcMain.handle('comex:supplier-banks:create', (_e, input: CreateComexSupplierBankAccountInput) => createSupplierBankAccount(input))
  ipcMain.handle('comex:supplier-banks:update', (_e, id: string, data: Partial<ComexSupplierBankAccount>) => updateSupplierBankAccount(id, data))
  ipcMain.handle('comex:supplier-banks:delete', (_e, id: string) => deleteSupplierBankAccount(id))

  // ── Customs ──────────────────────────────────────────────────────────────
  ipcMain.handle('comex:customs:get',    (_e, importId: string) => getCustoms(importId))
  ipcMain.handle('comex:customs:upsert', (_e, importId: string, data: Partial<UpsertComexCustomsInput>) =>
    upsertCustoms(importId, data)
  )

  // ── Cost Items ────────────────────────────────────────────────────────────
  ipcMain.handle('comex:costs:list',   (_e, importId: string)                   => listCosts(importId))
  ipcMain.handle('comex:costs:create', (_e, input: CreateComexCostInput)         => createCost(input))
  ipcMain.handle('comex:costs:update', (_e, id: string, data: Partial<ComexCostItem>) => updateCost(id, data))
  ipcMain.handle('comex:costs:delete', (_e, id: string)                         => deleteCost(id))

  // ── Drive integration ─────────────────────────────────────────────────────

  ipcMain.handle('comex:drive:createFolder', async (_e, importId: string, importTitle: string) => {
    const result = await setupImportDriveFolders(importId, importTitle)
    // Notificar al renderer (por si fue llamado manualmente)
    BrowserWindow.getAllWindows().forEach(w =>
      w.webContents.send('comex:import:folderReady', importId)
    )

    return result  // { folderId, url }
  })

  ipcMain.handle('comex:drive:openFolder', (_e, folderId: string) => {
    driveService.openFolder(folderId)
  })

  ipcMain.handle('comex:drive:isAuthenticated', () => driveService.isAuthenticated())

  // ── Logo helpers ──────────────────────────────────────────────────────────
  ipcMain.handle('comex:logo:selectFile', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'] }]
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // logoData (si está presente, ya viaja sincronizado vía PowerSync y sirve para
  // cualquier dispositivo); si no, se intenta leer el archivo local (legacy / mismo equipo)
  ipcMain.handle('comex:logo:getDataUrl', (_e, storedName: string | null, logoData?: string | null) => {
    if (logoData) return logoData
    if (!storedName) return null
    return fileToDataUrl(resolveAttachmentPath(storedName))
  })

  ipcMain.handle('comex:suppliers:uploadLogo', async (_e, supplierId: string, filePath: string) => {
    const ext = path.extname(filePath)
    const storedName = `logo_s_${randomUUID()}${ext}`
    const dest = resolveAttachmentPath(storedName)
    const existing = await getSupplier(supplierId)
    if (existing?.logo_stored_name) {
      const old = resolveAttachmentPath(existing.logo_stored_name)
      try { if (fs.existsSync(old)) fs.unlinkSync(old) } catch { /* ignore */ }
    }
    fs.copyFileSync(filePath, dest)
    await updateSupplier(supplierId, { logo_stored_name: storedName, logo_data: fileToDataUrl(dest) })
    return storedName
  })

  ipcMain.handle('comex:suppliers:deleteLogo', async (_e, supplierId: string) => {
    const existing = await getSupplier(supplierId)
    if (existing?.logo_stored_name) {
      const fp = resolveAttachmentPath(existing.logo_stored_name)
      try { if (fs.existsSync(fp)) fs.unlinkSync(fp) } catch { /* ignore */ }
    }
    await updateSupplier(supplierId, { logo_stored_name: null, logo_data: null })
  })

  ipcMain.handle('comex:operators:uploadLogo', async (_e, operatorId: string, filePath: string) => {
    const ext = path.extname(filePath)
    const storedName = `logo_op_${randomUUID()}${ext}`
    const dest = resolveAttachmentPath(storedName)
    const existing = await getFreightOperator(operatorId)
    if (existing?.logo_stored_name) {
      const old = resolveAttachmentPath(existing.logo_stored_name)
      try { if (fs.existsSync(old)) fs.unlinkSync(old) } catch { /* ignore */ }
    }
    fs.copyFileSync(filePath, dest)
    await updateFreightOperator(operatorId, { logo_stored_name: storedName, logo_data: fileToDataUrl(dest) })
    return storedName
  })

  ipcMain.handle('comex:operators:deleteLogo', async (_e, operatorId: string) => {
    const existing = await getFreightOperator(operatorId)
    if (existing?.logo_stored_name) {
      const fp = resolveAttachmentPath(existing.logo_stored_name)
      try { if (fs.existsSync(fp)) fs.unlinkSync(fp) } catch { /* ignore */ }
    }
    await updateFreightOperator(operatorId, { logo_stored_name: null, logo_data: null })
  })

  // ── Freight Operators ─────────────────────────────────────────────────────
  ipcMain.handle('comex:operators:list',   ()                                                    => listFreightOperators())
  ipcMain.handle('comex:operators:get',    (_e, id: string)                                      => getFreightOperator(id))
  ipcMain.handle('comex:operators:create', (_e, input: CreateComexFreightOperatorInput)          => createFreightOperator(input))
  ipcMain.handle('comex:operators:update', (_e, id: string, data: Partial<ComexFreightOperator>) => updateFreightOperator(id, data))
  ipcMain.handle('comex:operators:delete', (_e, id: string)                                      => deleteFreightOperator(id))

  // ── Operator Contacts ─────────────────────────────────────────────────────
  ipcMain.handle('comex:operator-contacts:list',   (_e, operatorId: string) => listOperatorContacts(operatorId))
  ipcMain.handle('comex:operator-contacts:create', (_e, input: CreateComexFreightOperatorContactInput) => createOperatorContact(input))
  ipcMain.handle('comex:operator-contacts:update', (_e, id: string, data: Partial<ComexFreightOperatorContact>) => updateOperatorContact(id, data))
  ipcMain.handle('comex:operator-contacts:delete', (_e, id: string) => deleteOperatorContact(id))

  // ── INAL Certificates ─────────────────────────────────────────────────────
  ipcMain.handle('comex:inal:certs:list', (_e, importId: string) => listInalCerts(importId))

  /** Diálogo de selección múltiple de archivos para certificados INAL */
  ipcMain.handle('comex:inal:certs:selectFiles', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return []
    const result = await dialog.showOpenDialog(win, {
      title: 'Seleccionar certificados INAL',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Documentos', extensions: ['pdf','png','jpg','jpeg','xlsx','xls'] },
        { name: 'Todos', extensions: ['*'] }
      ]
    })
    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle('comex:inal:certs:delete', async (_e, id: string) => {
    const cert = await getInalCert(id)
    if (cert?.local_stored_name) {
      const fp = resolveAttachmentPath(cert.local_stored_name)
      try { if (fs.existsSync(fp)) fs.unlinkSync(fp) } catch { /* ignore */ }
    }
    await deleteInalCert(id)
  })

  ipcMain.handle('comex:inal:certs:upload', async (
    _e,
    filePath: string,
    importId: string,
    _importTitle: string,
    importFolderId: string | null,
    certFolderId: string | null
  ) => {
    const ext = path.extname(filePath)
    const storedName = `inal_${randomUUID()}${ext}`
    const dest = resolveAttachmentPath(storedName)
    fs.copyFileSync(filePath, dest)

    const stats = fs.statSync(dest)
    const mimeType = getMimeType(ext)
    const originalName = path.basename(filePath)

    const cert = await createInalCert(importId, originalName, {
      local_stored_name: storedName,
      size_bytes: stats.size,
      mime_type: mimeType
    })

    // Try Drive upload
    try {
      const driveAuth = driveService.isAuthenticated()
      if (driveAuth) {
        let folderId = certFolderId

        // Create/get "Certificados INAL" subfolder if no cert folder yet
        if (!folderId) {
          if (importFolderId) {
            folderId = await driveService.createSubfolder('Certificados INAL', importFolderId)
            // Persist the cert folder ID on the import
            await updateImport(importId, { inal_lc_cert_folder_id: folderId })
          }
        }

        if (folderId) {
          await updateInalCert(cert.id, { drive_status: 'uploading' })
          const driveFileId = await driveService.uploadFileToFolder(dest, folderId, originalName, mimeType)
          await updateInalCert(cert.id, { drive_file_id: driveFileId, drive_status: 'synced' })
        }
      }
    } catch (err) {
      await updateInalCert(cert.id, { drive_status: 'error' })
      console.error('[INAL] Drive upload error:', err)
    }

    // Return fresh record
    const fresh = (await listInalCerts(importId)).find((c) => c.id === cert.id) ?? cert
    return { cert: fresh, import: await getImport(importId) }
  })

  // ── INAL VEPs ─────────────────────────────────────────────────────────────
  ipcMain.handle('comex:inal:veps:list', (_e, importId: string) => listInalVeps(importId))

  ipcMain.handle('comex:inal:veps:selectFiles', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      title: 'Seleccionar comprobantes VEP ANMAT',
      filters: [
        { name: 'PDF / Imagen', extensions: ['pdf', 'png', 'jpg', 'jpeg'] },
        { name: 'Todos', extensions: ['*'] }
      ],
      properties: ['openFile', 'multiSelections']
    })
    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle('comex:inal:veps:upload', async (
    e,
    filePath: string,
    importId: string,
    importFolderId: string | null,
    vepFolderId: string | null
  ) => {
    const ext = path.extname(filePath)
    const storedName = `inal_vep_${randomUUID()}${ext}`
    const dest = resolveAttachmentPath(storedName)
    fs.copyFileSync(filePath, dest)

    const stats = fs.statSync(dest)
    const mimeType = getMimeType(ext)
    const originalName = path.basename(filePath)

    const vep = await createInalVep(importId, originalName, {
      local_stored_name: storedName,
      size_bytes: stats.size,
      mime_type: mimeType
    })

    // TODO el trabajo de red (Drive + IA) corre EN BACKGROUND. El handler
    // retorna ya con el VEP en 'processing', así aparece al instante en la
    // lista y el spinner de subida dura milisegundos. Cada cambio de estado
    // se empuja al renderer vía 'comex:inal:veps:updated'. Con timeouts: si
    // Drive o la IA se cuelgan, el VEP queda en 'error' visible, nunca girando.
    const sender = e.sender
    const pushFresh = async (): Promise<void> => {
      const fresh = await getInalVep(vep.id)
      if (fresh && !sender.isDestroyed()) sender.send('comex:inal:veps:updated', fresh)
    }

    // Drive e IA son INDEPENDIENTES → corren EN PARALELO. La extracción del
    // importe (lo que importa) no debe esperar a Drive: si Drive se cuelga, el
    // importe igual aparece en ~1s. Cada uno actualiza campos distintos del VEP.

    // ── Drive (en paralelo) ──
    void (async () => {
      try {
        if (driveService.isAuthenticated()) {
          const folderId = await resolveVepDriveFolder(importId, importFolderId)
          if (folderId) {
            await updateInalVep(vep.id, { drive_status: 'uploading' })
            await pushFresh()
            const driveFileId = await withTimeout(
              driveService.uploadFileToFolder(dest, folderId, originalName, mimeType),
              60_000, 'Drive subir archivo'
            )
            await updateInalVep(vep.id, { drive_file_id: driveFileId, drive_status: 'synced' })
            await pushFresh()
          }
        }
      } catch (err) {
        await updateInalVep(vep.id, { drive_status: 'error' })
        await pushFresh()
        console.error('[INAL VEP] Drive upload error:', err)
      }
    })()

    // ── IA (en paralelo, no espera a Drive) ──
    void (async () => {
      let importeTotal: number | null = null
      let aiStatus: 'done' | 'error' = 'error'
      try {
        const result = await withTimeout(
          analyzeDocument({ filePath: dest, operation: 'extract_vep_anmat' }),
          90_000, 'Extracción IA'
        )
        const parsed = parseVepImporte(result.content)
        if (parsed !== null) {
          importeTotal = parsed
          aiStatus = 'done'
        }
      } catch (err) {
        console.error('[INAL VEP] AI extraction error:', err)
      }
      const aiUpdate: Parameters<typeof updateInalVep>[1] = { ai_status: aiStatus }
      if (importeTotal !== null) aiUpdate.importe_total = importeTotal
      await updateInalVep(vep.id, aiUpdate)
      await pushFresh()
    })()

    // Retorna inmediato — VEP en 'processing', visible al instante
    return { vep, vepFolderId }
  })

  ipcMain.handle('comex:inal:veps:delete', async (_e, vepId: string) => {
    const vep = await getInalVep(vepId)
    if (vep?.local_stored_name) {
      try { fs.unlinkSync(resolveAttachmentPath(vep.local_stored_name)) } catch { /* ok */ }
    }
    await deleteInalVep(vepId)
  })

  // ── Tributos del despacho ─────────────────────────────────────────────────
  ipcMain.handle('comex:tributos:list',   (_e, importId: string)                                                   => listTributos(importId))
  ipcMain.handle('comex:tributos:create', (_e, input: CreateComexImportTributoInput)                               => createTributo(input))
  ipcMain.handle('comex:tributos:update', (_e, id: string, data: Partial<ComexImportTributo>)                      => updateTributo(id, data))
  ipcMain.handle('comex:tributos:delete', (_e, id: string)                                                         => deleteTributo(id))
  ipcMain.handle('comex:tributos:upsert', (_e, importId: string, tributos: Omit<CreateComexImportTributoInput, 'import_id'>[]) => upsertTributos(importId, tributos))

  // ── Proformas ─────────────────────────────────────────────────────────────
  ipcMain.handle('comex:proformas:list',   (_e, importId: string, tipo?: 'proforma' | 'factura') => listProformas(importId, tipo ?? 'proforma'))
  ipcMain.handle('comex:proformas:renameDriveFolder', (_e, proformaId: string) => _renameDriveFolder(proformaId))
  ipcMain.handle('comex:proformas:create', (_e, input: CreateComexProformaInput)        => createProforma(input))
  ipcMain.handle('comex:proformas:update', (_e, id: string, data: Partial<ComexProforma>) => updateProforma(id, data))
  ipcMain.handle('comex:proformas:delete', (_e, id: string)                             => deleteProforma(id))

  ipcMain.handle('comex:proformas:selectFile', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: 'Seleccionar proforma',
      properties: ['openFile'],
      filters: [{ name: 'PDF / Imágenes', extensions: ['pdf','png','jpg','jpeg','webp'] }, { name: 'Todos', extensions: ['*'] }]
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('comex:proformas:upload', async (_e, proformaId: string, filePath: string) => {
    const pf  = await getProforma(proformaId)
    if (!pf) throw new Error('Proforma no encontrada')
    const imp = await getImport(pf.import_id)

    const ext          = path.extname(filePath)
    const originalName = path.basename(filePath)
    const storedName   = `proforma_${randomUUID()}${ext}`
    const dest         = resolveAttachmentPath(storedName)

    // Limpiar archivo local anterior
    if (pf.stored_name) {
      const old = resolveAttachmentPath(pf.stored_name)
      try { if (fs.existsSync(old)) fs.unlinkSync(old) } catch { /* ignore */ }
    }

    fs.copyFileSync(filePath, dest)
    await updateProforma(proformaId, { stored_name: storedName, original_name: originalName, drive_status: 'none' })

    // Drive: subir sincrónicamente para que el status final llegue al renderer
    if (imp?.drive_folder_id && driveService.isAuthenticated()) {
      await updateProforma(proformaId, { drive_status: 'uploading' })
      try {
        await _uploadProformaToDrive(pf.import_id, proformaId, dest, originalName, ext)
      } catch (err) {
        await updateProforma(proformaId, { drive_status: 'error' })
        console.error('[Proforma] Drive error:', (err as Error).message)
      }
    }

    return await getProforma(proformaId)
  })

  // Reintentar subida a Drive de una proforma que ya tiene archivo local
  ipcMain.handle('comex:proformas:syncDrive', async (_e, proformaId: string) => {
    const pf = await getProforma(proformaId)
    if (!pf?.stored_name || !pf.original_name) throw new Error('Proforma sin archivo local')
    const dest = resolveAttachmentPath(pf.stored_name)
    if (!fs.existsSync(dest)) throw new Error('Archivo no encontrado en disco')
    const imp = await getImport(pf.import_id)
    if (!imp?.drive_folder_id) throw new Error('La importación no tiene carpeta Drive. Creala primero.')
    if (!driveService.isAuthenticated()) throw new Error('Google Drive no está conectado')

    await updateProforma(proformaId, { drive_status: 'uploading' })
    try {
      const ext = path.extname(pf.stored_name)
      await _uploadProformaToDrive(pf.import_id, proformaId, dest, pf.original_name, ext)
      return await getProforma(proformaId)
    } catch (err) {
      await updateProforma(proformaId, { drive_status: 'error' })
      throw err
    }
  })

  ipcMain.handle('comex:proformas:open', async (_e, proformaId: string) => {
    const pf = await getProforma(proformaId)
    if (!pf?.stored_name) throw new Error('Sin archivo adjunto')
    shell.openPath(resolveAttachmentPath(pf.stored_name))
  })

  // ── Extra costs ──────────────────────────────────────────────────────────
  ipcMain.handle('comex:extra-costs:list',   (_e, importId: string)                                => listExtraCosts(importId))
  ipcMain.handle('comex:extra-costs:create', (_e, input: CreateComexImportExtraCostInput)          => createExtraCost(input))
  ipcMain.handle('comex:extra-costs:update', (_e, id: string, data: Partial<ComexImportExtraCost>) => updateExtraCost(id, data))
  ipcMain.handle('comex:extra-costs:delete', (_e, id: string)                                      => deleteExtraCost(id))

  ipcMain.handle('comex:extra-costs:selectFile', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: 'Seleccionar factura',
      properties: ['openFile'],
      filters: [
        { name: 'PDF e imágenes', extensions: ['pdf', 'png', 'jpg', 'jpeg'] },
        { name: 'Todos', extensions: ['*'] }
      ]
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('comex:extra-costs:uploadInvoice', async (_e, costId: string, filePath: string) => {
    const cost = await getExtraCost(costId)
    if (!cost) throw new Error('Registro de costo no encontrado')
    const imp = await getImport(cost.import_id)

    const ext = path.extname(filePath)
    const originalName = path.basename(filePath)
    const storedName = `cost_${randomUUID()}${ext}`
    const dest = resolveAttachmentPath(storedName)

    // Eliminar archivo local anterior si existe
    if (cost.stored_name) {
      const old = resolveAttachmentPath(cost.stored_name)
      try { if (fs.existsSync(old)) fs.unlinkSync(old) } catch { /* ignore */ }
    }

    fs.copyFileSync(filePath, dest)
    await updateExtraCost(costId, { stored_name: storedName, original_name: originalName, drive_status: 'none' })

    // Drive upload si hay carpeta de importación
    if (imp?.drive_folder_id && driveService.isAuthenticated()) {
      await updateExtraCost(costId, { drive_status: 'uploading' })
      try {
        const costosFolderId = await driveService.createSubfolder('Facturas servicios', imp.drive_folder_id)
        const { EXTRA_COST_CATEGORY_LABELS } = await import('@shared/types')
        const catLabel = EXTRA_COST_CATEGORY_LABELS[cost.categoria as keyof typeof EXTRA_COST_CATEGORY_LABELS] || cost.categoria
        const catFolderId = await driveService.createSubfolder(catLabel, costosFolderId)
        const mimeType = getMimeType(ext)
        const fileId = await driveService.uploadFileToFolder(dest, catFolderId, originalName, mimeType)
        await updateExtraCost(costId, { drive_file_id: fileId, drive_folder_id: catFolderId, drive_status: 'synced' })
      } catch (err) {
        await updateExtraCost(costId, { drive_status: 'error' })
        console.error('[ExtraCost] Drive upload error:', err)
      }
    }

    return await getExtraCost(costId)
  })

  ipcMain.handle('comex:extra-costs:openFile', async (_e, costId: string) => {
    const cost = await getExtraCost(costId)
    if (!cost?.stored_name) throw new Error('Sin archivo adjunto')
    shell.openPath(resolveAttachmentPath(cost.stored_name))
  })

  // ── Despacho de aduana ────────────────────────────────────────────────────
  ipcMain.handle('comex:despacho:selectFile', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: 'Seleccionar despacho de aduana',
      properties: ['openFile'],
      filters: [{ name: 'PDF', extensions: ['pdf'] }, { name: 'Todos', extensions: ['*'] }]
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('comex:despacho:upload', async (_e, importId: string, filePath: string) => {
    const imp = await getImport(importId)
    if (!imp) throw new Error('Importación no encontrada')

    // 1. Copiar archivo localmente
    const ext = path.extname(filePath)
    const originalName = path.basename(filePath)
    const storedName = `despacho_${randomUUID()}${ext}`
    const dest = resolveAttachmentPath(storedName)

    // Eliminar archivo local anterior si existe
    if (imp.despacho_stored_name) {
      const old = resolveAttachmentPath(imp.despacho_stored_name)
      try { if (fs.existsSync(old)) fs.unlinkSync(old) } catch { /* ignore */ }
    }

    fs.copyFileSync(filePath, dest)

    // 2. Guardar en DB (solo local por ahora)
    await updateImport(importId, {
      despacho_stored_name:   storedName,
      despacho_original_name: originalName,
      despacho_drive_status:  'none',
      despacho_drive_file_id: null
    })

    // 3. Subir a Drive si está autenticado y hay carpeta de importación
    if (imp.drive_folder_id && driveService.isAuthenticated()) {
      await updateImport(importId, { despacho_drive_status: 'uploading' })
      try {
        // Crear/obtener subcarpeta "Despacho" dentro de la carpeta de la importación
        let despachoFolderId = imp.despacho_folder_id
        if (!despachoFolderId) {
          despachoFolderId = await driveService.createSubfolder('Despacho', imp.drive_folder_id)
          await updateImport(importId, { despacho_folder_id: despachoFolderId })
        }

        const mimeType = getMimeType(ext)
        const driveFileId = await driveService.uploadFileToFolder(dest, despachoFolderId, originalName, mimeType)
        await updateImport(importId, {
          despacho_drive_file_id: driveFileId,
          despacho_drive_status:  'synced'
        })
      } catch (err) {
        await updateImport(importId, { despacho_drive_status: 'error' })
        console.error('[Despacho] Drive upload error:', err)
      }
    }

    return await getImport(importId)
  })

  ipcMain.handle('comex:despacho:open', async (_e, importId: string) => {
    const imp = await getImport(importId)
    if (!imp?.despacho_stored_name) throw new Error('Sin archivo de despacho')
    const fp = resolveAttachmentPath(imp.despacho_stored_name)
    shell.openPath(fp)
  })

  ipcMain.handle('comex:despacho:delete', async (_e, importId: string) => {
    const imp = await getImport(importId)
    if (!imp) return
    if (imp.despacho_stored_name) {
      const fp = resolveAttachmentPath(imp.despacho_stored_name)
      try { if (fs.existsSync(fp)) fs.unlinkSync(fp) } catch { /* ignore */ }
    }
    await updateImport(importId, {
      despacho_stored_name:   null,
      despacho_original_name: null,
      despacho_drive_file_id: null,
      despacho_drive_status:  'none'
    })
    return await getImport(importId)
  })

  // ── PL - Packing List ─────────────────────────────────────────────────────
  ipcMain.handle('comex:pl:selectFile', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: 'Seleccionar PL - Packing List',
      properties: ['openFile'],
      filters: [
        { name: 'PDF / Excel', extensions: ['pdf','xls','xlsx'] },
        { name: 'Todos', extensions: ['*'] }
      ]
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('comex:pl:upload', async (_e, importId: string, filePath: string) => {
    const imp = await getImport(importId)
    if (!imp) throw new Error('Importación no encontrada')

    const ext          = path.extname(filePath)
    const originalName = path.basename(filePath)
    const storedName   = `pl_${randomUUID()}${ext}`
    const dest         = resolveAttachmentPath(storedName)

    if (imp.pl_stored_name) {
      const old = resolveAttachmentPath(imp.pl_stored_name)
      try { if (fs.existsSync(old)) fs.unlinkSync(old) } catch { /* ignore */ }
    }

    fs.copyFileSync(filePath, dest)
    await updateImport(importId, {
      pl_stored_name:   storedName,
      pl_original_name: originalName,
      pl_drive_status:  'none',
      pl_drive_file_id: null
    })

    if (imp.drive_folder_id && driveService.isAuthenticated()) {
      await updateImport(importId, { pl_drive_status: 'uploading' })
      try {
        let plFolderId = imp.pl_folder_id
        if (!plFolderId) {
          plFolderId = await driveService.createSubfolder('PL - Packing List', imp.drive_folder_id)
          await updateImport(importId, { pl_folder_id: plFolderId })
        }
        const mimeType   = getMimeType(ext)
        const driveFileId = await driveService.uploadFileToFolder(dest, plFolderId, originalName, mimeType)
        await updateImport(importId, { pl_drive_file_id: driveFileId, pl_drive_status: 'synced' })
      } catch (err) {
        await updateImport(importId, { pl_drive_status: 'error' })
        console.error('[PL] Drive upload error:', err)
      }
    }

    return await getImport(importId)
  })

  ipcMain.handle('comex:pl:open', async (_e, importId: string) => {
    const imp = await getImport(importId)
    if (!imp?.pl_stored_name) throw new Error('Sin archivo de Packing List')
    shell.openPath(resolveAttachmentPath(imp.pl_stored_name))
  })

  ipcMain.handle('comex:pl:delete', async (_e, importId: string) => {
    const imp = await getImport(importId)
    if (!imp) return
    if (imp.pl_stored_name) {
      const fp = resolveAttachmentPath(imp.pl_stored_name)
      try { if (fs.existsSync(fp)) fs.unlinkSync(fp) } catch { /* ignore */ }
    }
    await updateImport(importId, {
      pl_stored_name:   null,
      pl_original_name: null,
      pl_drive_file_id: null,
      pl_drive_status:  'none',
      pl_extracted_json: null
    })
    return await getImport(importId)
  })

  // ── PL Files (multi-documento) ────────────────────────────────────────────
  ipcMain.handle('comex:pl-files:list', (_e, importId: string) => listImportPlFiles(importId))

  ipcMain.handle('comex:pl-files:upload', async (_e, {
    importId, filePath, fileBuffer, fileName: dropFileName, importFolderId
  }: {
    importId: string; importFolderId: string | null
    filePath?: string; fileBuffer?: ArrayBuffer; fileName?: string
  }) => {
    let localPath: string
    let tmpPath: string | null = null

    if (fileBuffer && dropFileName) {
      const safeName = path.basename(dropFileName).replace(/[/\\:*?"<>|]/g, '-')
      tmpPath = path.join(os.tmpdir(), `summit-pl-${Date.now()}-${safeName}`)
      fs.writeFileSync(tmpPath, Buffer.from(fileBuffer))
      localPath = tmpPath
    } else if (filePath) {
      localPath = filePath
    } else {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      const result = await dialog.showOpenDialog(win, {
        title: 'Seleccionar Packing List',
        properties: ['openFile'],
        filters: [{ name: 'PDF / Excel', extensions: ['pdf', 'xls', 'xlsx'] }]
      })
      if (result.canceled || !result.filePaths.length) return null
      localPath = result.filePaths[0]
    }

    try {
      const originalName = dropFileName ?? path.basename(localPath)
      const ext          = path.extname(originalName).toLowerCase()
      const storedName   = `plf_${randomUUID()}${ext}`
      const dest         = resolveAttachmentPath(storedName)
      fs.copyFileSync(localPath, dest)

      const existing  = await listImportPlFiles(importId)
      const sortOrder = existing.length

      const record = await createImportPlFile({
        import_id: importId, stored_name: storedName,
        original_name: originalName, drive_status: 'none', sort_order: sortOrder
      })

      if (driveService.isAuthenticated()) {
        await updateImportPlFile(record.id, { drive_status: 'uploading' })
        try {
          const imp       = await getImport(importId)
          let plFolderId  = imp?.pl_folder_id ?? null
          if (!plFolderId) {
            const parentId = importFolderId ?? imp?.drive_folder_id ?? null
            if (parentId) {
              plFolderId = await driveService.createSubfolder('PL - Packing List', parentId)
              await updateImport(importId, { pl_folder_id: plFolderId })
            }
          }
          if (plFolderId) {
            const mimeType    = getMimeType(ext)
            const driveFileId = await driveService.uploadFileToFolder(dest, plFolderId, originalName, mimeType)
            await updateImportPlFile(record.id, { drive_file_id: driveFileId, drive_status: 'synced' })
          }
        } catch (err) {
          await updateImportPlFile(record.id, { drive_status: 'error' })
          console.error('[PL Files] Drive upload error:', err)
        }
      }

      return await listImportPlFiles(importId)
    } finally {
      if (tmpPath) try { fs.unlinkSync(tmpPath) } catch { /* ignore */ }
    }
  })

  ipcMain.handle('comex:pl-files:delete', async (_e, plFileId: string) => {
    const record = await getImportPlFile(plFileId)
    if (!record) return
    if (record.stored_name) {
      const fp = resolveAttachmentPath(record.stored_name)
      try { if (fs.existsSync(fp)) fs.unlinkSync(fp) } catch { /* ignore */ }
    }
    if (record.drive_file_id) {
      try { await driveService.deleteFile(record.drive_file_id) } catch { /* non-critical */ }
    }
    await deleteImportPlFile(plFileId)
    return await listImportPlFiles(record.import_id)
  })

  ipcMain.handle('comex:pl-files:open', async (_e, plFileId: string) => {
    const record = await getImportPlFile(plFileId)
    if (!record?.stored_name) throw new Error('Sin archivo adjunto')
    shell.openPath(resolveAttachmentPath(record.stored_name))
  })

  ipcMain.handle('comex:pl-files:updateExtracted', async (_e, plFileId: string, extractedJson: string) => {
    await updateImportPlFile(plFileId, { extracted_json: extractedJson })
    const record = await getImportPlFile(plFileId)
    if (!record) return null
    return await listImportPlFiles(record.import_id)
  })

  // ── BL - Bill of Lading ───────────────────────────────────────────────────
  ipcMain.handle('comex:bl:selectFile', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: 'Seleccionar BL - Bill of Lading',
      properties: ['openFile'],
      filters: [{ name: 'PDF / Imagen', extensions: ['pdf','png','jpg','jpeg'] }, { name: 'Todos', extensions: ['*'] }]
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('comex:bl:upload', async (_e, importId: string, filePath: string) => {
    const imp = await getImport(importId)
    if (!imp) throw new Error('Importación no encontrada')

    const ext = path.extname(filePath)
    const originalName = path.basename(filePath)
    const storedName = `bl_${randomUUID()}${ext}`
    const dest = resolveAttachmentPath(storedName)

    if (imp.bl_stored_name) {
      const old = resolveAttachmentPath(imp.bl_stored_name)
      try { if (fs.existsSync(old)) fs.unlinkSync(old) } catch { /* ignore */ }
    }

    fs.copyFileSync(filePath, dest)
    await updateImport(importId, {
      bl_stored_name:   storedName,
      bl_original_name: originalName,
      bl_drive_status:  'none',
      bl_drive_file_id: null
    })

    if (imp.drive_folder_id && driveService.isAuthenticated()) {
      await updateImport(importId, { bl_drive_status: 'uploading' })
      try {
        let blFolderId = imp.bl_folder_id
        if (!blFolderId) {
          blFolderId = await driveService.createSubfolder('BL - Bill of Lading', imp.drive_folder_id)
          await updateImport(importId, { bl_folder_id: blFolderId })
        }
        const mimeType = getMimeType(ext)
        const driveFileId = await driveService.uploadFileToFolder(dest, blFolderId, originalName, mimeType)
        await updateImport(importId, { bl_drive_file_id: driveFileId, bl_drive_status: 'synced' })
      } catch (err) {
        await updateImport(importId, { bl_drive_status: 'error' })
        console.error('[BL] Drive upload error:', err)
      }
    }

    return await getImport(importId)
  })

  ipcMain.handle('comex:bl:open', async (_e, importId: string) => {
    const imp = await getImport(importId)
    if (!imp?.bl_stored_name) throw new Error('Sin archivo de BL')
    shell.openPath(resolveAttachmentPath(imp.bl_stored_name))
  })

  ipcMain.handle('comex:bl:delete', async (_e, importId: string) => {
    const imp = await getImport(importId)
    if (!imp) return
    if (imp.bl_stored_name) {
      const fp = resolveAttachmentPath(imp.bl_stored_name)
      try { if (fs.existsSync(fp)) fs.unlinkSync(fp) } catch { /* ignore */ }
    }
    await updateImport(importId, {
      bl_stored_name:   null,
      bl_original_name: null,
      bl_drive_file_id: null,
      bl_drive_status:  'none'
    })
    return await getImport(importId)
  })

  // ── INAL — Packing List ──────────────────────────────────────────────────
  ipcMain.handle('comex:inal:pl:selectFile', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    const r = await dialog.showOpenDialog(win, {
      title: 'Seleccionar Packing List',
      properties: ['openFile'],
      filters: [{ name: 'Documentos', extensions: ['pdf','xlsx','xls','csv'] }, { name: 'Todos', extensions: ['*'] }]
    })
    return r.canceled ? null : r.filePaths[0]
  })

  ipcMain.handle('comex:inal:pl:upload', async (_e, importId: string, filePath: string) => {
    const imp = await getImport(importId)
    if (!imp) throw new Error('Importación no encontrada')
    const ext = path.extname(filePath), orig = path.basename(filePath)
    const stored = `inal_pl_${randomUUID()}${ext}`
    const dest = resolveAttachmentPath(stored)
    if (imp.inal_pl_stored_name) { try { fs.unlinkSync(resolveAttachmentPath(imp.inal_pl_stored_name)) } catch { /* */ } }
    fs.copyFileSync(filePath, dest)
    await updateImport(importId, { inal_pl_stored_name: stored, inal_pl_original_name: orig, inal_pl_drive_file_id: null, inal_pl_drive_status: 'none' })
    if (imp.drive_folder_id && driveService.isAuthenticated()) {
      await updateImport(importId, { inal_pl_drive_status: 'uploading' })
      try {
        let fId = (await getImport(importId))?.inal_drive_folder_id ?? null
        if (!fId) { fId = await driveService.createSubfolder('INAL', imp.drive_folder_id); await updateImport(importId, { inal_drive_folder_id: fId }) }
        const driveId = await driveService.uploadFileToFolder(dest, fId, orig, getMimeType(ext))
        await updateImport(importId, { inal_pl_drive_file_id: driveId, inal_pl_drive_status: 'synced' })
      } catch { await updateImport(importId, { inal_pl_drive_status: 'error' }) }
    }
    return await getImport(importId)
  })

  ipcMain.handle('comex:inal:pl:open', async (_e, importId: string) => {
    const imp = await getImport(importId)
    if (!imp?.inal_pl_stored_name) throw new Error('Sin archivo PL')
    shell.openPath(resolveAttachmentPath(imp.inal_pl_stored_name))
  })

  ipcMain.handle('comex:inal:pl:delete', async (_e, importId: string) => {
    const imp = await getImport(importId)
    if (!imp) return
    if (imp.inal_pl_stored_name) { try { fs.unlinkSync(resolveAttachmentPath(imp.inal_pl_stored_name)) } catch { /* */ } }
    await updateImport(importId, { inal_pl_stored_name: null, inal_pl_original_name: null, inal_pl_drive_file_id: null, inal_pl_drive_status: 'none' })
    return await getImport(importId)
  })

  // ── INAL — Xls Resumen ───────────────────────────────────────────────────
  ipcMain.handle('comex:inal:xls:selectFile', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    const r = await dialog.showOpenDialog(win, {
      title: 'Seleccionar Xls Resumen INAL',
      properties: ['openFile'],
      filters: [{ name: 'Excel', extensions: ['xlsx','xls'] }, { name: 'Todos', extensions: ['*'] }]
    })
    return r.canceled ? null : r.filePaths[0]
  })

  ipcMain.handle('comex:inal:xls:upload', async (_e, importId: string, filePath: string) => {
    const imp = await getImport(importId)
    if (!imp) throw new Error('Importación no encontrada')
    const ext = path.extname(filePath), orig = path.basename(filePath)
    const stored = `inal_xls_${randomUUID()}${ext}`
    const dest = resolveAttachmentPath(stored)
    if (imp.inal_xls_stored_name) { try { fs.unlinkSync(resolveAttachmentPath(imp.inal_xls_stored_name)) } catch { /* */ } }
    fs.copyFileSync(filePath, dest)
    await updateImport(importId, { inal_xls_stored_name: stored, inal_xls_original_name: orig, inal_xls_drive_file_id: null, inal_xls_drive_status: 'none' })
    if (imp.drive_folder_id && driveService.isAuthenticated()) {
      await updateImport(importId, { inal_xls_drive_status: 'uploading' })
      try {
        let fId = (await getImport(importId))?.inal_drive_folder_id ?? null
        if (!fId) { fId = await driveService.createSubfolder('INAL', imp.drive_folder_id); await updateImport(importId, { inal_drive_folder_id: fId }) }
        const driveId = await driveService.uploadFileToFolder(dest, fId, orig, getMimeType(ext))
        await updateImport(importId, { inal_xls_drive_file_id: driveId, inal_xls_drive_status: 'synced' })
      } catch { await updateImport(importId, { inal_xls_drive_status: 'error' }) }
    }
    return await getImport(importId)
  })

  ipcMain.handle('comex:inal:xls:open', async (_e, importId: string) => {
    const imp = await getImport(importId)
    if (!imp?.inal_xls_stored_name) throw new Error('Sin archivo Xls')
    shell.openPath(resolveAttachmentPath(imp.inal_xls_stored_name))
  })

  ipcMain.handle('comex:inal:xls:delete', async (_e, importId: string) => {
    const imp = await getImport(importId)
    if (!imp) return
    if (imp.inal_xls_stored_name) { try { fs.unlinkSync(resolveAttachmentPath(imp.inal_xls_stored_name)) } catch { /* */ } }
    await updateImport(importId, { inal_xls_stored_name: null, inal_xls_original_name: null, inal_xls_drive_file_id: null, inal_xls_drive_status: 'none' })
    return await getImport(importId)
  })

  // ── INAL — Factura comercial (copia para carpeta INAL) ───────────────────
  ipcMain.handle('comex:inal:factura:selectFile', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    const r = await dialog.showOpenDialog(win, {
      title: 'Seleccionar Factura Comercial para INAL',
      properties: ['openFile'],
      filters: [{ name: 'Documentos', extensions: ['pdf','xlsx','xls'] }, { name: 'Todos', extensions: ['*'] }]
    })
    return r.canceled ? null : r.filePaths[0]
  })

  ipcMain.handle('comex:inal:factura:upload', async (_e, importId: string, filePath: string) => {
    const imp = await getImport(importId)
    if (!imp) throw new Error('Importación no encontrada')
    const ext = path.extname(filePath), orig = path.basename(filePath)
    const stored = `inal_factura_${randomUUID()}${ext}`
    const dest = resolveAttachmentPath(stored)
    if (imp.inal_factura_stored_name) { try { fs.unlinkSync(resolveAttachmentPath(imp.inal_factura_stored_name)) } catch { /* */ } }
    fs.copyFileSync(filePath, dest)
    await updateImport(importId, { inal_factura_stored_name: stored, inal_factura_original_name: orig, inal_factura_drive_file_id: null, inal_factura_drive_status: 'none' })
    if (imp.drive_folder_id && driveService.isAuthenticated()) {
      await updateImport(importId, { inal_factura_drive_status: 'uploading' })
      try {
        let fId = (await getImport(importId))?.inal_drive_folder_id ?? null
        if (!fId) { fId = await driveService.createSubfolder('INAL', imp.drive_folder_id); await updateImport(importId, { inal_drive_folder_id: fId }) }
        const driveId = await driveService.uploadFileToFolder(dest, fId, orig, getMimeType(ext))
        await updateImport(importId, { inal_factura_drive_file_id: driveId, inal_factura_drive_status: 'synced' })
      } catch { await updateImport(importId, { inal_factura_drive_status: 'error' }) }
    }
    return await getImport(importId)
  })

  ipcMain.handle('comex:inal:factura:open', async (_e, importId: string) => {
    const imp = await getImport(importId)
    if (!imp?.inal_factura_stored_name) throw new Error('Sin archivo')
    shell.openPath(resolveAttachmentPath(imp.inal_factura_stored_name))
  })

  ipcMain.handle('comex:inal:factura:delete', async (_e, importId: string) => {
    const imp = await getImport(importId)
    if (!imp) return
    if (imp.inal_factura_stored_name) { try { fs.unlinkSync(resolveAttachmentPath(imp.inal_factura_stored_name)) } catch { /* */ } }
    await updateImport(importId, { inal_factura_stored_name: null, inal_factura_original_name: null, inal_factura_drive_file_id: null, inal_factura_drive_status: 'none' })
    return await getImport(importId)
  })

  // ── INAL — BL (copia para carpeta INAL) ─────────────────────────────────
  ipcMain.handle('comex:inal:blcopy:selectFile', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    const r = await dialog.showOpenDialog(win, {
      title: 'Seleccionar BL para INAL',
      properties: ['openFile'],
      filters: [{ name: 'PDF / Imagen', extensions: ['pdf','png','jpg','jpeg'] }, { name: 'Todos', extensions: ['*'] }]
    })
    return r.canceled ? null : r.filePaths[0]
  })

  ipcMain.handle('comex:inal:blcopy:upload', async (_e, importId: string, filePath: string) => {
    const imp = await getImport(importId)
    if (!imp) throw new Error('Importación no encontrada')
    const ext = path.extname(filePath), orig = path.basename(filePath)
    const stored = `inal_bl_${randomUUID()}${ext}`
    const dest = resolveAttachmentPath(stored)
    if (imp.inal_bl_stored_name) { try { fs.unlinkSync(resolveAttachmentPath(imp.inal_bl_stored_name)) } catch { /* */ } }
    fs.copyFileSync(filePath, dest)
    await updateImport(importId, { inal_bl_stored_name: stored, inal_bl_original_name: orig, inal_bl_drive_file_id: null, inal_bl_drive_status: 'none' })
    if (imp.drive_folder_id && driveService.isAuthenticated()) {
      await updateImport(importId, { inal_bl_drive_status: 'uploading' })
      try {
        let fId = (await getImport(importId))?.inal_drive_folder_id ?? null
        if (!fId) { fId = await driveService.createSubfolder('INAL', imp.drive_folder_id); await updateImport(importId, { inal_drive_folder_id: fId }) }
        const driveId = await driveService.uploadFileToFolder(dest, fId, orig, getMimeType(ext))
        await updateImport(importId, { inal_bl_drive_file_id: driveId, inal_bl_drive_status: 'synced' })
      } catch { await updateImport(importId, { inal_bl_drive_status: 'error' }) }
    }
    return await getImport(importId)
  })

  ipcMain.handle('comex:inal:blcopy:open', async (_e, importId: string) => {
    const imp = await getImport(importId)
    if (!imp?.inal_bl_stored_name) throw new Error('Sin archivo')
    shell.openPath(resolveAttachmentPath(imp.inal_bl_stored_name))
  })

  ipcMain.handle('comex:inal:blcopy:delete', async (_e, importId: string) => {
    const imp = await getImport(importId)
    if (!imp) return
    if (imp.inal_bl_stored_name) { try { fs.unlinkSync(resolveAttachmentPath(imp.inal_bl_stored_name)) } catch { /* */ } }
    await updateImport(importId, { inal_bl_stored_name: null, inal_bl_original_name: null, inal_bl_drive_file_id: null, inal_bl_drive_status: 'none' })
    return await getImport(importId)
  })

  // ── Gestores INAL ─────────────────────────────────────────────────────────
  ipcMain.handle('comex:gestores:list',   ()                                        => listGestores())
  ipcMain.handle('comex:gestores:get',    (_e, id: string)                          => getGestor(id))
  ipcMain.handle('comex:gestores:create', (_e, input: CreateComexGestorInput)       => createGestor(input))
  ipcMain.handle('comex:gestores:update', (_e, id: string, data: Partial<ComexGestor>) => updateGestor(id, data))
  ipcMain.handle('comex:gestores:delete', (_e, id: string)                          => deleteGestor(id))

  ipcMain.handle('comex:gestores:contacts:create', (_e, input: CreateComexGestorContactInput)       => createGestorContact(input))
  ipcMain.handle('comex:gestores:contacts:update', (_e, id: string, data: Partial<import('@shared/types').ComexGestorContact>) => updateGestorContact(id, data))
  ipcMain.handle('comex:gestores:contacts:delete', (_e, id: string)                                 => deleteGestorContact(id))

  // Logo gestores
  ipcMain.handle('comex:gestores:uploadLogo', async (_e, gestorId: string, filePath: string) => {
    const ext = path.extname(filePath)
    const storedName = `logo_gest_${randomUUID()}${ext}`
    const dest = resolveAttachmentPath(storedName)
    const existing = await getGestor(gestorId)
    if (existing?.logo_stored_name) { try { fs.unlinkSync(resolveAttachmentPath(existing.logo_stored_name)) } catch { /* */ } }
    fs.copyFileSync(filePath, dest)
    await updateGestor(gestorId, { logo_stored_name: storedName, logo_data: fileToDataUrl(dest) })
    return storedName
  })
  ipcMain.handle('comex:gestores:deleteLogo', async (_e, gestorId: string) => {
    const existing = await getGestor(gestorId)
    if (existing?.logo_stored_name) { try { fs.unlinkSync(resolveAttachmentPath(existing.logo_stored_name)) } catch { /* */ } }
    await updateGestor(gestorId, { logo_stored_name: null, logo_data: null })
  })

  // ── Despachantes ──────────────────────────────────────────────────────────
  ipcMain.handle('comex:despachantes:list',   ()                                            => listDespachantes())
  ipcMain.handle('comex:despachantes:create', (_e, input: CreateComexDespachanteInput)      => createDespachante(input))
  ipcMain.handle('comex:despachantes:update', (_e, id: string, data: Partial<ComexDespachante>) => updateDespachante(id, data))
  ipcMain.handle('comex:despachantes:delete', (_e, id: string)                              => deleteDespachante(id))

  ipcMain.handle('comex:despachantes:contacts:create', (_e, input: CreateComexDespachanteContactInput) => createDespachanteContact(input))
  ipcMain.handle('comex:despachantes:contacts:update', (_e, id: string, data: Partial<import('@shared/types').ComexDespachanteContact>) => updateDespachanteContact(id, data))
  ipcMain.handle('comex:despachantes:contacts:delete', (_e, id: string)                               => deleteDespachanteContact(id))

  ipcMain.handle('comex:despachantes:banks:create', (_e, input: CreateComexDespachanteBankAccountInput) => createDespachanteBankAccount(input))
  ipcMain.handle('comex:despachantes:banks:update', (_e, id: string, data: Partial<import('@shared/types').ComexDespachanteBankAccount>) => updateDespachanteBankAccount(id, data))
  ipcMain.handle('comex:despachantes:banks:delete', (_e, id: string)                                    => deleteDespachanteBankAccount(id))

  // Logo despachantes
  ipcMain.handle('comex:despachantes:uploadLogo', async (_e, despId: string, filePath: string) => {
    const ext = path.extname(filePath)
    const storedName = `logo_desp_${randomUUID()}${ext}`
    const dest = resolveAttachmentPath(storedName)
    const existing = (await listDespachantes()).find(d => d.id === despId)
    if (existing?.logo_stored_name) { try { fs.unlinkSync(resolveAttachmentPath(existing.logo_stored_name)) } catch { /* */ } }
    fs.copyFileSync(filePath, dest)
    await updateDespachante(despId, { logo_stored_name: storedName, logo_data: fileToDataUrl(dest) })
    return storedName
  })
  ipcMain.handle('comex:despachantes:deleteLogo', async (_e, despId: string) => {
    const existing = (await listDespachantes()).find(d => d.id === despId)
    if (existing?.logo_stored_name) { try { fs.unlinkSync(resolveAttachmentPath(existing.logo_stored_name)) } catch { /* */ } }
    await updateDespachante(despId, { logo_stored_name: null, logo_data: null })
  })

  // ── Cotizaciones USD/EUR propias ─────────────────────────────────────────────
  ipcMain.handle('comex:cotizaciones:list', () => listCotizaciones())
  ipcMain.handle('comex:cotizaciones:add', (
    _e, moneda: import('@shared/types').ComexMoneda, valor_ars: number, nota?: string, created_at_ms?: number
  ) => addCotizacion(moneda, valor_ars, nota, created_at_ms))

  // ── Cotizaciones BCRA (fetch + caché local) ───────────────────────────────
  ipcMain.handle('comex:bcra:rates', (
    _e, moneda: import('@shared/types').ComexMoneda
  ) => getBcraRates(moneda))
  ipcMain.handle('comex:bcra:refresh', (
    _e, moneda: import('@shared/types').ComexMoneda
  ) => refreshBcraRates(moneda))
  ipcMain.handle('comex:bcra:hoy', async () => {
    const [bcra, bna] = await Promise.all([
      getBcraCotizacionHoy(),
      getBnaBilleteHoy().catch(() => [] as Awaited<ReturnType<typeof getBnaBilleteHoy>>)
    ])
    const bnaMap = new Map(bna.map(b => [b.moneda, b.venta]))
    return bcra.map(c => ({ ...c, billete_venta: bnaMap.get(c.moneda) ?? null }))
  })

  // ── Alarmas de cotización USD/EUR ─────────────────────────────────────────
  ipcMain.handle('comex:alarmas-cotizacion:list',   () => listAlarmasCotizacion())
  ipcMain.handle('comex:alarmas-cotizacion:add',    (_e, input) => addAlarmaCotizacion(input))
  ipcMain.handle('comex:alarmas-cotizacion:update', (_e, id: string, changes) => updateAlarmaCotizacion(id, changes))
  ipcMain.handle('comex:alarmas-cotizacion:delete', (_e, id: string) => deleteAlarmaCotizacion(id))
}

function fileToDataUrl(fp: string): string | null {
  if (!fs.existsSync(fp)) return null
  const ext = path.extname(fp).slice(1).toLowerCase()
  const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`
  const data = fs.readFileSync(fp)
  return `data:${mime};base64,${data.toString('base64')}`
}

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    '.pdf':  'application/pdf',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif':  'image/gif',
    '.webp': 'image/webp',
    '.txt':  'text/plain',
    '.md':   'text/markdown',
    '.doc':  'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls':  'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.zip':  'application/zip',
    '.csv':  'text/csv'
  }
  return map[ext.toLowerCase()] ?? 'application/octet-stream'
}
