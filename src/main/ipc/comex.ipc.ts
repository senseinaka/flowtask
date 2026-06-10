import { ipcMain, shell, dialog, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import { randomUUID } from 'crypto'
import {
  listSuppliers, getSupplier, createSupplier, updateSupplier, deleteSupplier,
  listImports, getImport, createImport, updateImport, deleteImport,
  listItems, createItem, deleteItem,
  listDocuments, getDocument, createDocument, updateDocument, deleteDocument,
  listQuotes, createQuote, updateQuote, deleteQuote,
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
  listGestores, getGestor, createGestor, updateGestor, deleteGestor,
  createGestorContact, updateGestorContact, deleteGestorContact,
  listDespachantes, createDespachante, updateDespachante, deleteDespachante,
  createDespachanteContact, updateDespachanteContact, deleteDespachanteContact,
  listBrands, getBrand, createBrand, updateBrand, deleteBrand,
  listPlannings, getPlanning, createPlanning, updatePlanning, deletePlanning, recalculatePlanning,
  updateMilestone,
  listPlanningAIReports, createPlanningAIReport, deletePlanningAIReport
} from '../database/queries/comex'
import { generatePlanningRecommendation, generatePlanningAIReport } from '../services/planning-ai.service'
import type { GeneratePlanningAIReportInput } from '../services/planning-ai.service'
import { writePlanningsExcel, writePlanningAIReportsExcel } from '../services/comex-planning-io.service'
import { driveService } from '../services/drive.service'
import { getAttachmentsDir } from '../database/db'
import type {
  ComexSupplier, ComexImport, ComexImportItem, ComexDocument,
  ComexLogisticsQuote, ComexPayment, ComexCostItem,
  ComexSupplierContact, ComexSupplierBankAccount, ComexFreightOperator,
  ComexFreightOperatorContact, ComexImportTributo, CreateComexImportTributoInput,
  ComexImportExtraCost, CreateComexImportExtraCostInput,
  ComexProforma, CreateComexProformaInput,
  ComexGestor, CreateComexGestorInput, CreateComexGestorContactInput,
  ComexDespachante, CreateComexDespachanteInput, CreateComexDespachanteContactInput,
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
  updateImport(importId, { drive_folder_id: result.folderId })

  const costs = listExtraCosts(importId)

  // Subcarpetas de facturas
  for (const [categoria, folderName] of Object.entries(COST_SUBFOLDERS)) {
    const cost = costs.find(c => c.categoria === categoria)
    if (cost && !cost.drive_folder_id) {
      const subId = await driveService.createSubfolder(folderName, result.folderId)
      updateExtraCost(cost.id, { drive_folder_id: subId })
    }
  }

  // Subcarpeta "BL - Bill of Lading"
  const impBL = getImport(importId)
  if (impBL && !impBL.bl_folder_id) {
    const blId = await driveService.createSubfolder('BL - Bill of Lading', result.folderId)
    updateImport(importId, { bl_folder_id: blId })
  }
  // Subcarpeta "INAL"
  const impINAL = getImport(importId)
  if (impINAL && !impINAL.inal_drive_folder_id) {
    const inalId = await driveService.createSubfolder('INAL', result.folderId)
    updateImport(importId, { inal_drive_folder_id: inalId })
  }
  // Subcarpeta "Despacho"
  const imp = getImport(importId)
  if (imp && !imp.despacho_folder_id) {
    const despachoId = await driveService.createSubfolder('Despacho', result.folderId)
    updateImport(importId, { despacho_folder_id: despachoId })
  }
  // Subcarpetas de proformas y facturas
  const imp2 = getImport(importId)
  if (imp2 && !imp2.proformas_folder_id) {
    const proformasId = await driveService.createSubfolder('Proformas', result.folderId)
    updateImport(importId, { proformas_folder_id: proformasId })
  }
  const imp3 = getImport(importId)
  if (imp3 && !imp3.facturas_folder_id) {
    const facturasId = await driveService.createSubfolder('Facturas comerciales', result.folderId)
    updateImport(importId, { facturas_folder_id: facturasId })
  }
  // Subcarpeta "PL - Packing List"
  const imp4 = getImport(importId)
  if (imp4 && !imp4.pl_folder_id) {
    const plId = await driveService.createSubfolder('PL - Packing List', result.folderId)
    updateImport(importId, { pl_folder_id: plId })
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
  const imp = getImport(importId)
  if (!imp?.drive_folder_id) throw new Error('Sin carpeta Drive en la importación')

  const pf = getProforma(proformaId)
  if (!pf) throw new Error('Proforma no encontrada')

  const isFactura = pf.tipo === 'factura'

  // 1. Carpeta padre "Proformas" o "Facturas comerciales"
  let parentFolderId = isFactura ? imp.facturas_folder_id : imp.proformas_folder_id
  if (!parentFolderId) {
    const parentName  = isFactura ? 'Facturas comerciales' : 'Proformas'
    parentFolderId    = await driveService.createSubfolder(parentName, imp.drive_folder_id)
    const updateField = isFactura ? { facturas_folder_id: parentFolderId } : { proformas_folder_id: parentFolderId }
    updateImport(importId, updateField)
  }

  // 2. Subcarpeta sin fecha: "Proforma N" o "Factura N" (se renombrará después de extraer la fecha)
  const prefix  = isFactura ? 'Factura' : 'Proforma'
  const subName = `${prefix} ${pf.numero}`
  const subId   = pf.drive_folder_id ?? await driveService.createSubfolder(subName, parentFolderId)

  // 3. Subir archivo
  const mimeType    = getMimeType(ext)
  const driveFileId = await driveService.uploadFileToFolder(localPath, subId, fileName, mimeType)

  updateProforma(proformaId, { drive_file_id: driveFileId, drive_folder_id: subId, drive_status: 'synced' })
}

/** Renombra la carpeta Drive de una proforma/factura agregando la fecha una vez conocida */
async function _renameDriveFolder(proformaId: string): Promise<void> {
  const pf = getProforma(proformaId)
  if (!pf?.drive_folder_id || !pf.fecha_proforma) return
  try {
    const [y, m, d] = pf.fecha_proforma.split('-')
    const dateStr   = `${d}-${m}-${y.slice(2)}`
    const prefix    = pf.tipo === 'factura' ? 'Factura' : 'Proforma'
    const newName   = `${prefix} ${pf.numero} ${dateStr}`
    await driveService.renameFile(pf.drive_folder_id, newName)
  } catch { /* non-critical */ }
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

    const brandLabels = Object.fromEntries(listBrands().map((b) => [b.id, b.name]))
    const supplierLabels = Object.fromEntries(listSuppliers().map((s) => [s.id, s.name]))
    writePlanningAIReportsExcel(result.filePath, reports, brandLabels, supplierLabels)
    shell.showItemInFolder(result.filePath)
    return { filePath: result.filePath }
  })

  // ── Imports ──────────────────────────────────────────────────────────────────
  ipcMain.handle('comex:imports:list',   (_e, status?: string) => listImports(status))
  ipcMain.handle('comex:imports:get',    (_e, id)              => getImport(id))
  ipcMain.handle('comex:imports:create', (_e, input: CreateComexImportInput) => {
    const imp = createImport(input)
    createDefaultExtraCosts(imp.id)

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

  // ── Items ────────────────────────────────────────────────────────────────────
  ipcMain.handle('comex:items:list',   (_e, importId)                  => listItems(importId))
  ipcMain.handle('comex:items:create', (_e, input: CreateComexItemInput) => createItem(input))
  ipcMain.handle('comex:items:delete', (_e, id)                        => deleteItem(id))

  // ── Documents ────────────────────────────────────────────────────────────────
  ipcMain.handle('comex:documents:list',   (_e, importId)                      => listDocuments(importId))
  ipcMain.handle('comex:documents:create', (_e, input: CreateComexDocumentInput) => createDocument(input))
  ipcMain.handle('comex:documents:update', (_e, id: string, data: Partial<ComexDocument>) => updateDocument(id, data))
  ipcMain.handle('comex:documents:delete', (_e, id: string) => {
    const doc = getDocument(id)
    if (doc?.local_stored_name) {
      const fp = path.join(getAttachmentsDir(), doc.local_stored_name)
      try { if (fs.existsSync(fp)) fs.unlinkSync(fp) } catch { /* ignore */ }
    }
    deleteDocument(id)
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
  ipcMain.handle('comex:documents:open', (_e, id: string) => {
    const doc = getDocument(id)
    if (!doc?.local_stored_name) return
    const fp = path.join(getAttachmentsDir(), doc.local_stored_name)
    if (fs.existsSync(fp)) shell.openPath(fp)
  })

  // Attach a file to an existing document + upload to Drive
  ipcMain.handle('comex:documents:upload',
    async (_e, docId: string, filePath: string, importId: string, folderId: string | null, importTitle: string) => {
      const ext         = path.extname(filePath)
      const storedName  = `cx_${randomUUID()}${ext}`
      const destPath    = path.join(getAttachmentsDir(), storedName)
      fs.copyFileSync(filePath, destPath)

      const stats       = fs.statSync(destPath)
      const mimeType    = getMimeType(ext)
      const originalName = path.basename(filePath)

      // Remove old local file if exists
      const existing = getDocument(docId)
      if (existing?.local_stored_name) {
        const oldPath = path.join(getAttachmentsDir(), existing.local_stored_name)
        try { if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath) } catch { /* ignore */ }
      }

      // Update with local info first
      updateDocument(docId, {
        name: originalName,
        local_stored_name: storedName,
        size_bytes: stats.size,
        mime_type: mimeType,
        drive_status: 'none',
        drive_file_id: null
      })

      // Drive upload if authenticated
      if (driveService.isAuthenticated()) {
        updateDocument(docId, { drive_status: 'uploading' })
        try {
          let targetFolderId = folderId
          if (!targetFolderId) {
            const { folderId: newId } = await driveService.createImportFolder(importTitle)
            targetFolderId = newId
            updateImport(importId, { drive_folder_id: targetFolderId })
          }
          const driveFileId = await driveService.uploadFileToFolder(destPath, targetFolderId, originalName, mimeType)
          updateDocument(docId, { drive_file_id: driveFileId, drive_status: 'synced' })
        } catch {
          updateDocument(docId, { drive_status: 'error' })
        }
      }

      return getDocument(docId)
    }
  )

  // Create a new document record from a dropped/selected file
  ipcMain.handle('comex:documents:uploadNew',
    async (_e, filePath: string, importId: string, folderId: string | null, importTitle: string) => {
      const ext         = path.extname(filePath)
      const storedName  = `cx_${randomUUID()}${ext}`
      const destPath    = path.join(getAttachmentsDir(), storedName)
      fs.copyFileSync(filePath, destPath)

      const stats       = fs.statSync(destPath)
      const mimeType    = getMimeType(ext)
      const originalName = path.basename(filePath)

      const doc = createDocument({
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
        updateDocument(doc.id, { drive_status: 'uploading' })
        try {
          let targetFolderId = folderId
          if (!targetFolderId) {
            const { folderId: newId } = await driveService.createImportFolder(importTitle)
            targetFolderId = newId
            updateImport(importId, { drive_folder_id: targetFolderId })
          }
          const driveFileId = await driveService.uploadFileToFolder(destPath, targetFolderId, originalName, mimeType)
          updateDocument(doc.id, { drive_file_id: driveFileId, drive_status: 'synced' })
        } catch {
          updateDocument(doc.id, { drive_status: 'error' })
        }
      }

      return getDocument(doc.id)
    }
  )

  // ── Logistics quotes ─────────────────────────────────────────────────────────
  ipcMain.handle('comex:quotes:list',   (_e, importId)                    => listQuotes(importId))
  ipcMain.handle('comex:quotes:create', (_e, input: CreateComexQuoteInput) => createQuote(input))
  ipcMain.handle('comex:quotes:update', (_e, id: string, data: Partial<ComexLogisticsQuote>) => updateQuote(id, data))
  ipcMain.handle('comex:quotes:delete', (_e, id)                          => deleteQuote(id))

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

  ipcMain.handle('comex:logo:getDataUrl', (_e, storedName: string) => {
    const fp = path.join(getAttachmentsDir(), storedName)
    if (!fs.existsSync(fp)) return null
    const ext = path.extname(storedName).slice(1).toLowerCase()
    const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`
    const data = fs.readFileSync(fp)
    return `data:${mime};base64,${data.toString('base64')}`
  })

  ipcMain.handle('comex:suppliers:uploadLogo', (_e, supplierId: string, filePath: string) => {
    const ext = path.extname(filePath)
    const storedName = `logo_s_${randomUUID()}${ext}`
    const dest = path.join(getAttachmentsDir(), storedName)
    const existing = getSupplier(supplierId)
    if (existing?.logo_stored_name) {
      const old = path.join(getAttachmentsDir(), existing.logo_stored_name)
      try { if (fs.existsSync(old)) fs.unlinkSync(old) } catch { /* ignore */ }
    }
    fs.copyFileSync(filePath, dest)
    updateSupplier(supplierId, { logo_stored_name: storedName })
    return storedName
  })

  ipcMain.handle('comex:suppliers:deleteLogo', (_e, supplierId: string) => {
    const existing = getSupplier(supplierId)
    if (existing?.logo_stored_name) {
      const fp = path.join(getAttachmentsDir(), existing.logo_stored_name)
      try { if (fs.existsSync(fp)) fs.unlinkSync(fp) } catch { /* ignore */ }
    }
    updateSupplier(supplierId, { logo_stored_name: null })
  })

  ipcMain.handle('comex:operators:uploadLogo', (_e, operatorId: string, filePath: string) => {
    const ext = path.extname(filePath)
    const storedName = `logo_op_${randomUUID()}${ext}`
    const dest = path.join(getAttachmentsDir(), storedName)
    const existing = getFreightOperator(operatorId)
    if (existing?.logo_stored_name) {
      const old = path.join(getAttachmentsDir(), existing.logo_stored_name)
      try { if (fs.existsSync(old)) fs.unlinkSync(old) } catch { /* ignore */ }
    }
    fs.copyFileSync(filePath, dest)
    updateFreightOperator(operatorId, { logo_stored_name: storedName })
    return storedName
  })

  ipcMain.handle('comex:operators:deleteLogo', (_e, operatorId: string) => {
    const existing = getFreightOperator(operatorId)
    if (existing?.logo_stored_name) {
      const fp = path.join(getAttachmentsDir(), existing.logo_stored_name)
      try { if (fs.existsSync(fp)) fs.unlinkSync(fp) } catch { /* ignore */ }
    }
    updateFreightOperator(operatorId, { logo_stored_name: null })
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

  ipcMain.handle('comex:inal:certs:delete', (_e, id: string) => {
    const cert = getInalCert(id)
    if (cert?.local_stored_name) {
      const fp = path.join(getAttachmentsDir(), cert.local_stored_name)
      try { if (fs.existsSync(fp)) fs.unlinkSync(fp) } catch { /* ignore */ }
    }
    deleteInalCert(id)
  })

  ipcMain.handle('comex:inal:certs:upload', async (
    _e,
    filePath: string,
    importId: string,
    importTitle: string,
    importFolderId: string | null,
    certFolderId: string | null
  ) => {
    const ext = path.extname(filePath)
    const storedName = `inal_${randomUUID()}${ext}`
    const dest = path.join(getAttachmentsDir(), storedName)
    fs.copyFileSync(filePath, dest)

    const stats = fs.statSync(dest)
    const mimeType = getMimeType(ext)
    const originalName = path.basename(filePath)

    const cert = createInalCert(importId, originalName, {
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
            updateImport(importId, { inal_lc_cert_folder_id: folderId })
          }
        }

        if (folderId) {
          updateInalCert(cert.id, { drive_status: 'uploading' })
          const driveFileId = await driveService.uploadFileToFolder(dest, folderId, originalName, mimeType)
          updateInalCert(cert.id, { drive_file_id: driveFileId, drive_status: 'synced' })
        }
      }
    } catch (err) {
      updateInalCert(cert.id, { drive_status: 'error' })
      console.error('[INAL] Drive upload error:', err)
    }

    // Return fresh record
    const fresh = listInalCerts(importId).find((c) => c.id === cert.id) ?? cert
    return { cert: fresh, import: getImport(importId) }
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
    const pf  = getProforma(proformaId)
    if (!pf) throw new Error('Proforma no encontrada')
    const imp = getImport(pf.import_id)

    const ext          = path.extname(filePath)
    const originalName = path.basename(filePath)
    const storedName   = `proforma_${randomUUID()}${ext}`
    const dest         = path.join(getAttachmentsDir(), storedName)

    // Limpiar archivo local anterior
    if (pf.stored_name) {
      const old = path.join(getAttachmentsDir(), pf.stored_name)
      try { if (fs.existsSync(old)) fs.unlinkSync(old) } catch { /* ignore */ }
    }

    fs.copyFileSync(filePath, dest)
    updateProforma(proformaId, { stored_name: storedName, original_name: originalName, drive_status: 'none' })

    // Drive: subir sincrónicamente para que el status final llegue al renderer
    if (imp?.drive_folder_id && driveService.isAuthenticated()) {
      updateProforma(proformaId, { drive_status: 'uploading' })
      try {
        await _uploadProformaToDrive(pf.import_id, proformaId, dest, originalName, ext)
      } catch (err) {
        updateProforma(proformaId, { drive_status: 'error' })
        console.error('[Proforma] Drive error:', (err as Error).message)
      }
    }

    return getProforma(proformaId)
  })

  // Reintentar subida a Drive de una proforma que ya tiene archivo local
  ipcMain.handle('comex:proformas:syncDrive', async (_e, proformaId: string) => {
    const pf = getProforma(proformaId)
    if (!pf?.stored_name || !pf.original_name) throw new Error('Proforma sin archivo local')
    const dest = path.join(getAttachmentsDir(), pf.stored_name)
    if (!fs.existsSync(dest)) throw new Error('Archivo no encontrado en disco')
    const imp = getImport(pf.import_id)
    if (!imp?.drive_folder_id) throw new Error('La importación no tiene carpeta Drive. Creala primero.')
    if (!driveService.isAuthenticated()) throw new Error('Google Drive no está conectado')

    updateProforma(proformaId, { drive_status: 'uploading' })
    try {
      const ext = path.extname(pf.stored_name)
      await _uploadProformaToDrive(pf.import_id, proformaId, dest, pf.original_name, ext)
      return getProforma(proformaId)
    } catch (err) {
      updateProforma(proformaId, { drive_status: 'error' })
      throw err
    }
  })

  ipcMain.handle('comex:proformas:open', (_e, proformaId: string) => {
    const pf = getProforma(proformaId)
    if (!pf?.stored_name) throw new Error('Sin archivo adjunto')
    shell.openPath(path.join(getAttachmentsDir(), pf.stored_name))
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
    const cost = getExtraCost(costId)
    if (!cost) throw new Error('Registro de costo no encontrado')
    const imp = getImport(cost.import_id)

    const ext = path.extname(filePath)
    const originalName = path.basename(filePath)
    const storedName = `cost_${randomUUID()}${ext}`
    const dest = path.join(getAttachmentsDir(), storedName)

    // Eliminar archivo local anterior si existe
    if (cost.stored_name) {
      const old = path.join(getAttachmentsDir(), cost.stored_name)
      try { if (fs.existsSync(old)) fs.unlinkSync(old) } catch { /* ignore */ }
    }

    fs.copyFileSync(filePath, dest)
    updateExtraCost(costId, { stored_name: storedName, original_name: originalName, drive_status: 'none' })

    // Drive upload si hay carpeta de importación
    if (imp?.drive_folder_id && driveService.isAuthenticated()) {
      updateExtraCost(costId, { drive_status: 'uploading' })
      try {
        const costosFolderId = await driveService.createSubfolder('Facturas servicios', imp.drive_folder_id)
        const { EXTRA_COST_CATEGORY_LABELS } = await import('@shared/types')
        const catLabel = EXTRA_COST_CATEGORY_LABELS[cost.categoria as keyof typeof EXTRA_COST_CATEGORY_LABELS] || cost.categoria
        const catFolderId = await driveService.createSubfolder(catLabel, costosFolderId)
        const mimeType = getMimeType(ext)
        const fileId = await driveService.uploadFileToFolder(dest, catFolderId, originalName, mimeType)
        updateExtraCost(costId, { drive_file_id: fileId, drive_folder_id: catFolderId, drive_status: 'synced' })
      } catch (err) {
        updateExtraCost(costId, { drive_status: 'error' })
        console.error('[ExtraCost] Drive upload error:', err)
      }
    }

    return getExtraCost(costId)
  })

  ipcMain.handle('comex:extra-costs:openFile', (_e, costId: string) => {
    const cost = getExtraCost(costId)
    if (!cost?.stored_name) throw new Error('Sin archivo adjunto')
    shell.openPath(path.join(getAttachmentsDir(), cost.stored_name))
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
    const imp = getImport(importId)
    if (!imp) throw new Error('Importación no encontrada')

    // 1. Copiar archivo localmente
    const ext = path.extname(filePath)
    const originalName = path.basename(filePath)
    const storedName = `despacho_${randomUUID()}${ext}`
    const dest = path.join(getAttachmentsDir(), storedName)

    // Eliminar archivo local anterior si existe
    if (imp.despacho_stored_name) {
      const old = path.join(getAttachmentsDir(), imp.despacho_stored_name)
      try { if (fs.existsSync(old)) fs.unlinkSync(old) } catch { /* ignore */ }
    }

    fs.copyFileSync(filePath, dest)

    // 2. Guardar en DB (solo local por ahora)
    updateImport(importId, {
      despacho_stored_name:   storedName,
      despacho_original_name: originalName,
      despacho_drive_status:  'none',
      despacho_drive_file_id: null
    })

    // 3. Subir a Drive si está autenticado y hay carpeta de importación
    if (imp.drive_folder_id && driveService.isAuthenticated()) {
      updateImport(importId, { despacho_drive_status: 'uploading' })
      try {
        // Crear/obtener subcarpeta "Despacho" dentro de la carpeta de la importación
        let despachoFolderId = imp.despacho_folder_id
        if (!despachoFolderId) {
          despachoFolderId = await driveService.createSubfolder('Despacho', imp.drive_folder_id)
          updateImport(importId, { despacho_folder_id: despachoFolderId })
        }

        const mimeType = getMimeType(ext)
        const driveFileId = await driveService.uploadFileToFolder(dest, despachoFolderId, originalName, mimeType)
        updateImport(importId, {
          despacho_drive_file_id: driveFileId,
          despacho_drive_status:  'synced'
        })
      } catch (err) {
        updateImport(importId, { despacho_drive_status: 'error' })
        console.error('[Despacho] Drive upload error:', err)
      }
    }

    return getImport(importId)
  })

  ipcMain.handle('comex:despacho:open', (_e, importId: string) => {
    const imp = getImport(importId)
    if (!imp?.despacho_stored_name) throw new Error('Sin archivo de despacho')
    const fp = path.join(getAttachmentsDir(), imp.despacho_stored_name)
    shell.openPath(fp)
  })

  ipcMain.handle('comex:despacho:delete', (_e, importId: string) => {
    const imp = getImport(importId)
    if (!imp) return
    if (imp.despacho_stored_name) {
      const fp = path.join(getAttachmentsDir(), imp.despacho_stored_name)
      try { if (fs.existsSync(fp)) fs.unlinkSync(fp) } catch { /* ignore */ }
    }
    updateImport(importId, {
      despacho_stored_name:   null,
      despacho_original_name: null,
      despacho_drive_file_id: null,
      despacho_drive_status:  'none'
    })
    return getImport(importId)
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
    const imp = getImport(importId)
    if (!imp) throw new Error('Importación no encontrada')

    const ext          = path.extname(filePath)
    const originalName = path.basename(filePath)
    const storedName   = `pl_${randomUUID()}${ext}`
    const dest         = path.join(getAttachmentsDir(), storedName)

    if (imp.pl_stored_name) {
      const old = path.join(getAttachmentsDir(), imp.pl_stored_name)
      try { if (fs.existsSync(old)) fs.unlinkSync(old) } catch { /* ignore */ }
    }

    fs.copyFileSync(filePath, dest)
    updateImport(importId, {
      pl_stored_name:   storedName,
      pl_original_name: originalName,
      pl_drive_status:  'none',
      pl_drive_file_id: null
    })

    if (imp.drive_folder_id && driveService.isAuthenticated()) {
      updateImport(importId, { pl_drive_status: 'uploading' })
      try {
        let plFolderId = imp.pl_folder_id
        if (!plFolderId) {
          plFolderId = await driveService.createSubfolder('PL - Packing List', imp.drive_folder_id)
          updateImport(importId, { pl_folder_id: plFolderId })
        }
        const mimeType   = getMimeType(ext)
        const driveFileId = await driveService.uploadFileToFolder(dest, plFolderId, originalName, mimeType)
        updateImport(importId, { pl_drive_file_id: driveFileId, pl_drive_status: 'synced' })
      } catch (err) {
        updateImport(importId, { pl_drive_status: 'error' })
        console.error('[PL] Drive upload error:', err)
      }
    }

    return getImport(importId)
  })

  ipcMain.handle('comex:pl:open', (_e, importId: string) => {
    const imp = getImport(importId)
    if (!imp?.pl_stored_name) throw new Error('Sin archivo de Packing List')
    shell.openPath(path.join(getAttachmentsDir(), imp.pl_stored_name))
  })

  ipcMain.handle('comex:pl:delete', (_e, importId: string) => {
    const imp = getImport(importId)
    if (!imp) return
    if (imp.pl_stored_name) {
      const fp = path.join(getAttachmentsDir(), imp.pl_stored_name)
      try { if (fs.existsSync(fp)) fs.unlinkSync(fp) } catch { /* ignore */ }
    }
    updateImport(importId, {
      pl_stored_name:   null,
      pl_original_name: null,
      pl_drive_file_id: null,
      pl_drive_status:  'none',
      pl_extracted_json: null
    })
    return getImport(importId)
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
    const imp = getImport(importId)
    if (!imp) throw new Error('Importación no encontrada')

    const ext = path.extname(filePath)
    const originalName = path.basename(filePath)
    const storedName = `bl_${randomUUID()}${ext}`
    const dest = path.join(getAttachmentsDir(), storedName)

    if (imp.bl_stored_name) {
      const old = path.join(getAttachmentsDir(), imp.bl_stored_name)
      try { if (fs.existsSync(old)) fs.unlinkSync(old) } catch { /* ignore */ }
    }

    fs.copyFileSync(filePath, dest)
    updateImport(importId, {
      bl_stored_name:   storedName,
      bl_original_name: originalName,
      bl_drive_status:  'none',
      bl_drive_file_id: null
    })

    if (imp.drive_folder_id && driveService.isAuthenticated()) {
      updateImport(importId, { bl_drive_status: 'uploading' })
      try {
        let blFolderId = imp.bl_folder_id
        if (!blFolderId) {
          blFolderId = await driveService.createSubfolder('BL - Bill of Lading', imp.drive_folder_id)
          updateImport(importId, { bl_folder_id: blFolderId })
        }
        const mimeType = getMimeType(ext)
        const driveFileId = await driveService.uploadFileToFolder(dest, blFolderId, originalName, mimeType)
        updateImport(importId, { bl_drive_file_id: driveFileId, bl_drive_status: 'synced' })
      } catch (err) {
        updateImport(importId, { bl_drive_status: 'error' })
        console.error('[BL] Drive upload error:', err)
      }
    }

    return getImport(importId)
  })

  ipcMain.handle('comex:bl:open', (_e, importId: string) => {
    const imp = getImport(importId)
    if (!imp?.bl_stored_name) throw new Error('Sin archivo de BL')
    shell.openPath(path.join(getAttachmentsDir(), imp.bl_stored_name))
  })

  ipcMain.handle('comex:bl:delete', (_e, importId: string) => {
    const imp = getImport(importId)
    if (!imp) return
    if (imp.bl_stored_name) {
      const fp = path.join(getAttachmentsDir(), imp.bl_stored_name)
      try { if (fs.existsSync(fp)) fs.unlinkSync(fp) } catch { /* ignore */ }
    }
    updateImport(importId, {
      bl_stored_name:   null,
      bl_original_name: null,
      bl_drive_file_id: null,
      bl_drive_status:  'none'
    })
    return getImport(importId)
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
    const imp = getImport(importId)
    if (!imp) throw new Error('Importación no encontrada')
    const ext = path.extname(filePath), orig = path.basename(filePath)
    const stored = `inal_pl_${randomUUID()}${ext}`
    const dest = path.join(getAttachmentsDir(), stored)
    if (imp.inal_pl_stored_name) { try { fs.unlinkSync(path.join(getAttachmentsDir(), imp.inal_pl_stored_name)) } catch { /* */ } }
    fs.copyFileSync(filePath, dest)
    updateImport(importId, { inal_pl_stored_name: stored, inal_pl_original_name: orig, inal_pl_drive_file_id: null, inal_pl_drive_status: 'none' })
    if (imp.drive_folder_id && driveService.isAuthenticated()) {
      updateImport(importId, { inal_pl_drive_status: 'uploading' })
      try {
        let fId = (getImport(importId)?.inal_drive_folder_id) ?? null
        if (!fId) { fId = await driveService.createSubfolder('INAL', imp.drive_folder_id); updateImport(importId, { inal_drive_folder_id: fId }) }
        const driveId = await driveService.uploadFileToFolder(dest, fId, orig, getMimeType(ext))
        updateImport(importId, { inal_pl_drive_file_id: driveId, inal_pl_drive_status: 'synced' })
      } catch { updateImport(importId, { inal_pl_drive_status: 'error' }) }
    }
    return getImport(importId)
  })

  ipcMain.handle('comex:inal:pl:open', (_e, importId: string) => {
    const imp = getImport(importId)
    if (!imp?.inal_pl_stored_name) throw new Error('Sin archivo PL')
    shell.openPath(path.join(getAttachmentsDir(), imp.inal_pl_stored_name))
  })

  ipcMain.handle('comex:inal:pl:delete', (_e, importId: string) => {
    const imp = getImport(importId)
    if (!imp) return
    if (imp.inal_pl_stored_name) { try { fs.unlinkSync(path.join(getAttachmentsDir(), imp.inal_pl_stored_name)) } catch { /* */ } }
    updateImport(importId, { inal_pl_stored_name: null, inal_pl_original_name: null, inal_pl_drive_file_id: null, inal_pl_drive_status: 'none' })
    return getImport(importId)
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
    const imp = getImport(importId)
    if (!imp) throw new Error('Importación no encontrada')
    const ext = path.extname(filePath), orig = path.basename(filePath)
    const stored = `inal_xls_${randomUUID()}${ext}`
    const dest = path.join(getAttachmentsDir(), stored)
    if (imp.inal_xls_stored_name) { try { fs.unlinkSync(path.join(getAttachmentsDir(), imp.inal_xls_stored_name)) } catch { /* */ } }
    fs.copyFileSync(filePath, dest)
    updateImport(importId, { inal_xls_stored_name: stored, inal_xls_original_name: orig, inal_xls_drive_file_id: null, inal_xls_drive_status: 'none' })
    if (imp.drive_folder_id && driveService.isAuthenticated()) {
      updateImport(importId, { inal_xls_drive_status: 'uploading' })
      try {
        let fId = (getImport(importId)?.inal_drive_folder_id) ?? null
        if (!fId) { fId = await driveService.createSubfolder('INAL', imp.drive_folder_id); updateImport(importId, { inal_drive_folder_id: fId }) }
        const driveId = await driveService.uploadFileToFolder(dest, fId, orig, getMimeType(ext))
        updateImport(importId, { inal_xls_drive_file_id: driveId, inal_xls_drive_status: 'synced' })
      } catch { updateImport(importId, { inal_xls_drive_status: 'error' }) }
    }
    return getImport(importId)
  })

  ipcMain.handle('comex:inal:xls:open', (_e, importId: string) => {
    const imp = getImport(importId)
    if (!imp?.inal_xls_stored_name) throw new Error('Sin archivo Xls')
    shell.openPath(path.join(getAttachmentsDir(), imp.inal_xls_stored_name))
  })

  ipcMain.handle('comex:inal:xls:delete', (_e, importId: string) => {
    const imp = getImport(importId)
    if (!imp) return
    if (imp.inal_xls_stored_name) { try { fs.unlinkSync(path.join(getAttachmentsDir(), imp.inal_xls_stored_name)) } catch { /* */ } }
    updateImport(importId, { inal_xls_stored_name: null, inal_xls_original_name: null, inal_xls_drive_file_id: null, inal_xls_drive_status: 'none' })
    return getImport(importId)
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
    const imp = getImport(importId)
    if (!imp) throw new Error('Importación no encontrada')
    const ext = path.extname(filePath), orig = path.basename(filePath)
    const stored = `inal_factura_${randomUUID()}${ext}`
    const dest = path.join(getAttachmentsDir(), stored)
    if (imp.inal_factura_stored_name) { try { fs.unlinkSync(path.join(getAttachmentsDir(), imp.inal_factura_stored_name)) } catch { /* */ } }
    fs.copyFileSync(filePath, dest)
    updateImport(importId, { inal_factura_stored_name: stored, inal_factura_original_name: orig, inal_factura_drive_file_id: null, inal_factura_drive_status: 'none' })
    if (imp.drive_folder_id && driveService.isAuthenticated()) {
      updateImport(importId, { inal_factura_drive_status: 'uploading' })
      try {
        let fId = (getImport(importId)?.inal_drive_folder_id) ?? null
        if (!fId) { fId = await driveService.createSubfolder('INAL', imp.drive_folder_id); updateImport(importId, { inal_drive_folder_id: fId }) }
        const driveId = await driveService.uploadFileToFolder(dest, fId, orig, getMimeType(ext))
        updateImport(importId, { inal_factura_drive_file_id: driveId, inal_factura_drive_status: 'synced' })
      } catch { updateImport(importId, { inal_factura_drive_status: 'error' }) }
    }
    return getImport(importId)
  })

  ipcMain.handle('comex:inal:factura:open', (_e, importId: string) => {
    const imp = getImport(importId)
    if (!imp?.inal_factura_stored_name) throw new Error('Sin archivo')
    shell.openPath(path.join(getAttachmentsDir(), imp.inal_factura_stored_name))
  })

  ipcMain.handle('comex:inal:factura:delete', (_e, importId: string) => {
    const imp = getImport(importId)
    if (!imp) return
    if (imp.inal_factura_stored_name) { try { fs.unlinkSync(path.join(getAttachmentsDir(), imp.inal_factura_stored_name)) } catch { /* */ } }
    updateImport(importId, { inal_factura_stored_name: null, inal_factura_original_name: null, inal_factura_drive_file_id: null, inal_factura_drive_status: 'none' })
    return getImport(importId)
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
    const imp = getImport(importId)
    if (!imp) throw new Error('Importación no encontrada')
    const ext = path.extname(filePath), orig = path.basename(filePath)
    const stored = `inal_bl_${randomUUID()}${ext}`
    const dest = path.join(getAttachmentsDir(), stored)
    if (imp.inal_bl_stored_name) { try { fs.unlinkSync(path.join(getAttachmentsDir(), imp.inal_bl_stored_name)) } catch { /* */ } }
    fs.copyFileSync(filePath, dest)
    updateImport(importId, { inal_bl_stored_name: stored, inal_bl_original_name: orig, inal_bl_drive_file_id: null, inal_bl_drive_status: 'none' })
    if (imp.drive_folder_id && driveService.isAuthenticated()) {
      updateImport(importId, { inal_bl_drive_status: 'uploading' })
      try {
        let fId = (getImport(importId)?.inal_drive_folder_id) ?? null
        if (!fId) { fId = await driveService.createSubfolder('INAL', imp.drive_folder_id); updateImport(importId, { inal_drive_folder_id: fId }) }
        const driveId = await driveService.uploadFileToFolder(dest, fId, orig, getMimeType(ext))
        updateImport(importId, { inal_bl_drive_file_id: driveId, inal_bl_drive_status: 'synced' })
      } catch { updateImport(importId, { inal_bl_drive_status: 'error' }) }
    }
    return getImport(importId)
  })

  ipcMain.handle('comex:inal:blcopy:open', (_e, importId: string) => {
    const imp = getImport(importId)
    if (!imp?.inal_bl_stored_name) throw new Error('Sin archivo')
    shell.openPath(path.join(getAttachmentsDir(), imp.inal_bl_stored_name))
  })

  ipcMain.handle('comex:inal:blcopy:delete', (_e, importId: string) => {
    const imp = getImport(importId)
    if (!imp) return
    if (imp.inal_bl_stored_name) { try { fs.unlinkSync(path.join(getAttachmentsDir(), imp.inal_bl_stored_name)) } catch { /* */ } }
    updateImport(importId, { inal_bl_stored_name: null, inal_bl_original_name: null, inal_bl_drive_file_id: null, inal_bl_drive_status: 'none' })
    return getImport(importId)
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
  ipcMain.handle('comex:gestores:uploadLogo', (_e, gestorId: string, filePath: string) => {
    const ext = path.extname(filePath)
    const storedName = `logo_gest_${randomUUID()}${ext}`
    const dest = path.join(getAttachmentsDir(), storedName)
    const existing = getGestor(gestorId)
    if (existing?.logo_stored_name) { try { fs.unlinkSync(path.join(getAttachmentsDir(), existing.logo_stored_name)) } catch { /* */ } }
    fs.copyFileSync(filePath, dest)
    updateGestor(gestorId, { logo_stored_name: storedName })
    return storedName
  })
  ipcMain.handle('comex:gestores:deleteLogo', (_e, gestorId: string) => {
    const existing = getGestor(gestorId)
    if (existing?.logo_stored_name) { try { fs.unlinkSync(path.join(getAttachmentsDir(), existing.logo_stored_name)) } catch { /* */ } }
    updateGestor(gestorId, { logo_stored_name: null })
  })

  // ── Despachantes ──────────────────────────────────────────────────────────
  ipcMain.handle('comex:despachantes:list',   ()                                            => listDespachantes())
  ipcMain.handle('comex:despachantes:create', (_e, input: CreateComexDespachanteInput)      => createDespachante(input))
  ipcMain.handle('comex:despachantes:update', (_e, id: string, data: Partial<ComexDespachante>) => updateDespachante(id, data))
  ipcMain.handle('comex:despachantes:delete', (_e, id: string)                              => deleteDespachante(id))

  ipcMain.handle('comex:despachantes:contacts:create', (_e, input: CreateComexDespachanteContactInput) => createDespachanteContact(input))
  ipcMain.handle('comex:despachantes:contacts:update', (_e, id: string, data: Partial<import('@shared/types').ComexDespachanteContact>) => updateDespachanteContact(id, data))
  ipcMain.handle('comex:despachantes:contacts:delete', (_e, id: string)                               => deleteDespachanteContact(id))

  // Logo despachantes
  ipcMain.handle('comex:despachantes:uploadLogo', (_e, despId: string, filePath: string) => {
    const ext = path.extname(filePath)
    const storedName = `logo_desp_${randomUUID()}${ext}`
    const dest = path.join(getAttachmentsDir(), storedName)
    const existing = listDespachantes().find(d => d.id === despId)
    if (existing?.logo_stored_name) { try { fs.unlinkSync(path.join(getAttachmentsDir(), existing.logo_stored_name)) } catch { /* */ } }
    fs.copyFileSync(filePath, dest)
    updateDespachante(despId, { logo_stored_name: storedName })
    return storedName
  })
  ipcMain.handle('comex:despachantes:deleteLogo', (_e, despId: string) => {
    const existing = listDespachantes().find(d => d.id === despId)
    if (existing?.logo_stored_name) { try { fs.unlinkSync(path.join(getAttachmentsDir(), existing.logo_stored_name)) } catch { /* */ } }
    updateDespachante(despId, { logo_stored_name: null })
  })
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
