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
  listInalCerts, createInalCert, updateInalCert, deleteInalCert, getInalCert
} from '../database/queries/comex'
import { driveService } from '../services/drive.service'
import { getAttachmentsDir } from '../database/db'
import type {
  ComexSupplier, ComexImport, ComexImportItem, ComexDocument,
  ComexLogisticsQuote, ComexPayment, ComexCostItem,
  ComexSupplierContact, ComexSupplierBankAccount, ComexFreightOperator,
  ComexFreightOperatorContact, ComexImportTributo, CreateComexImportTributoInput,
  ComexImportExtraCost, CreateComexImportExtraCostInput,
  CreateComexSupplierInput, CreateComexImportInput,
  CreateComexItemInput, CreateComexDocumentInput,
  CreateComexQuoteInput, CreateComexPaymentInput,
  UpsertComexCustomsInput, CreateComexCostInput,
  CreateComexSupplierContactInput, CreateComexSupplierBankAccountInput,
  CreateComexFreightOperatorInput, CreateComexFreightOperatorContactInput
} from '@shared/types'

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

  // Subcarpeta "Despacho"
  const imp = getImport(importId)
  if (imp && !imp.despacho_folder_id) {
    const despachoId = await driveService.createSubfolder('Despacho', result.folderId)
    updateImport(importId, { despacho_folder_id: despachoId })
  }

  return result
}

export function registerComexIpc(): void {
  // ── Suppliers ────────────────────────────────────────────────────────────────
  ipcMain.handle('comex:suppliers:list',   ()          => listSuppliers())
  ipcMain.handle('comex:suppliers:get',    (_e, id)    => getSupplier(id))
  ipcMain.handle('comex:suppliers:create', (_e, input: CreateComexSupplierInput) => createSupplier(input))
  ipcMain.handle('comex:suppliers:update', (_e, id: string, data: Partial<ComexSupplier>) => updateSupplier(id, data))
  ipcMain.handle('comex:suppliers:delete', (_e, id)    => deleteSupplier(id))

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
