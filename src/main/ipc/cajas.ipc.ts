import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import path from 'path'
import os from 'os'
import {
  getMovementsForReport,
  getDifferencesForReport,
  getCountsForReport,
  getCashboxPermissions,
  grantCashboxPermission,
  revokeCashboxPermission,
  getDailyMovementsSummary,
  getCashCompanies,
  getCashboxes,
  getCashbox,
  getCashboxBalances,
  getCashboxLastCounts,
  getCashCategories,
  listCashMovements,
  getCashMovementsWithMeta,
  createCashMovement,
  createTransfer,
  listCashCounts,
  createCashCount,
  createCashDifference,
  updateCashDifference,
  listCashDifferences,
  listAllPendingDifferences,
  updateCashboxStatus,
  getCashFlowSeries,
} from '../database/queries/cajas'
import {
  listCashAttachments,
  addCashAttachment,
  deleteCashAttachment,
} from '../database/queries/cash-attachments'
import { getSession } from '../services/auth.service'
import type { CashboxStatus, CashAttachmentOwnerType, CashAttachment } from '@shared/types'

export function registerCajasIpc(): void {
  ipcMain.handle('cajas:companies',   () => getCashCompanies())
  ipcMain.handle('cajas:cashboxes',   () => getCashboxes())
  ipcMain.handle('cajas:cashbox',     (_e, id: string) => getCashbox(id))
  ipcMain.handle('cajas:balances',    () => getCashboxBalances())
  ipcMain.handle('cajas:lastCounts',  () => getCashboxLastCounts())
  ipcMain.handle('cajas:categories',  (_e, type?: 'income' | 'expense') => getCashCategories(type))

  ipcMain.handle('cajas:movements:list',
    (_e, cashboxId: string, limit?: number) => listCashMovements(cashboxId, limit))

  ipcMain.handle('cajas:movements:listDetailed',
    (_e, cashboxId: string, limit?: number) => getCashMovementsWithMeta(cashboxId, limit))

  ipcMain.handle('cajas:movements:create', async (_e, input: Parameters<typeof createCashMovement>[0]) => {
    const session = await getSession()
    return createCashMovement({ ...input, created_by: session?.email ?? session?.userId ?? '' })
  })

  ipcMain.handle('cajas:movements:transfer', async (_e, input: Omit<Parameters<typeof createTransfer>[0], 'created_by'>) => {
    const session = await getSession()
    return createTransfer({ ...input, created_by: session?.email ?? session?.userId ?? '' })
  })

  ipcMain.handle('cajas:counts:list',
    (_e, cashboxId: string, limit?: number) => listCashCounts(cashboxId, limit))

  ipcMain.handle('cajas:counts:create', async (_e, input: Omit<Parameters<typeof createCashCount>[0], 'counted_by'>) => {
    const session = await getSession()
    return createCashCount({ ...input, counted_by: session?.email ?? session?.userId ?? '' })
  })

  ipcMain.handle('cajas:differences:create',
    (_e, input: Parameters<typeof createCashDifference>[0]) => createCashDifference(input))

  ipcMain.handle('cajas:differences:update', async (
    _e, id: string, input: { status: 'resolved' | 'written_off'; resolution_notes: string }
  ) => {
    const session = await getSession()
    return updateCashDifference(id, { ...input, resolved_by: session?.email ?? session?.userId ?? '' })
  })

  ipcMain.handle('cajas:differences:list',
    (_e, cashboxId: string) => listCashDifferences(cashboxId))

  ipcMain.handle('cajas:differences:pending', () => listAllPendingDifferences())

  ipcMain.handle('cajas:report:export', async (event, cashboxId: string, cashboxName: string, dateFrom: string, dateTo: string) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const XLSX = require('xlsx')

    const TYPE_LABELS: Record<string, string> = {
      income: 'Ingreso', expense: 'Egreso', transfer: 'Transferencia',
      adjustment: 'Ajuste', bank_deposit: 'Depósito bancario',
      opening: 'Apertura', correction: 'Corrección',
    }
    const STATUS_LABELS: Record<string, string> = {
      pending: 'Pendiente', under_review: 'En revisión',
      resolved: 'Resuelta', written_off: 'Dada de baja',
      quick_count: 'Conteo rápido', daily_close: 'Cierre diario', formal_audit: 'Auditoría formal',
      confirmed: 'Confirmado', with_difference: 'Con diferencia', cancelled: 'Cancelado',
    }

    const [movRows, diffRows, countRows] = await Promise.all([
      getMovementsForReport(cashboxId, dateFrom, dateTo),
      getDifferencesForReport(cashboxId),
      getCountsForReport(cashboxId),
    ])

    if (movRows.length === 0 && diffRows.length === 0 && countRows.length === 0) {
      throw new Error('Sin datos para exportar.')
    }

    const sanitize = (rows: Record<string, unknown>[]) =>
      rows.map(row => {
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(row)) {
          out[k] = typeof v === 'string' && /^[=+\-@]/.test(v) ? `'${v}` : v
        }
        return out
      })

    const addSheet = (wb: unknown, data: Record<string, unknown>[], name: string) => {
      if (data.length === 0) return
      const ws = XLSX.utils.json_to_sheet(sanitize(data))
      ws['!cols'] = Object.keys(data[0]).map(k => ({ wch: Math.max(k.length + 2, 14) }))
      XLSX.utils.book_append_sheet(wb, ws, name)
    }

    const wb = XLSX.utils.book_new()

    addSheet(wb, movRows.map(r => ({
      'Fecha':         r.fecha,
      'Tipo':          TYPE_LABELS[r.tipo] ?? r.tipo,
      'Categoría':     r.categoria,
      'Moneda':        r.moneda,
      'Importe':       r.importe,
      'Notas':         r.notas,
      'Registrado por':r.registrado_por,
    })), 'Movimientos')

    addSheet(wb, diffRows.map(r => ({
      'Fecha':      r.fecha.slice(0, 10),
      'Moneda':     r.moneda,
      'Sistema':    r.sistema,
      'Contado':    r.contado,
      'Diferencia': r.diferencia,
      'Estado':     STATUS_LABELS[r.estado] ?? r.estado,
      'Resolución': r.resolucion,
      'Resuelto por':r.resuelto_por,
    })), 'Diferencias')

    addSheet(wb, countRows.map(r => ({
      'Fecha':      r.fecha.slice(0, 10),
      'Tipo':       STATUS_LABELS[r.tipo] ?? r.tipo,
      'Estado':     STATUS_LABELS[r.estado] ?? r.estado,
      'Contado por':r.contado_por,
      'Notas':      r.notas,
    })), 'Conteos')

    const safeName = cashboxName.replace(/[^a-zA-Z0-9_\-]/g, '_')
    const win = BrowserWindow.fromWebContents(event.sender)
    const { canceled, filePath: savePath } = await dialog.showSaveDialog(win!, {
      title: 'Exportar reporte de caja',
      defaultPath: path.join(os.homedir(), 'Downloads', `Caja_${safeName}_${dateFrom}_${dateTo}.xlsx`),
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    })
    if (canceled || !savePath) return null

    XLSX.writeFile(wb, savePath)
    return savePath
  })

  ipcMain.handle('cajas:daily:summary',
    (_e, cashboxId: string, date: string) => getDailyMovementsSummary(cashboxId, date))

  ipcMain.handle('cajas:charts:flowSeries',
    (_e, dateFrom: string, dateTo: string, cashboxIds?: string[], currency?: string) =>
      getCashFlowSeries(dateFrom, dateTo, cashboxIds, currency))

  ipcMain.handle('cajas:permissions:list',
    (_e, cashboxId: string) => getCashboxPermissions(cashboxId))

  ipcMain.handle('cajas:permissions:grant', async (_e, input: {
    cashbox_id: string; user_id: string; permission_key: string
  }) => {
    const session = await getSession()
    return grantCashboxPermission({ ...input, granted_by: session?.email ?? session?.userId ?? '' })
  })

  ipcMain.handle('cajas:permissions:revoke',
    (_e, id: string) => revokeCashboxPermission(id))

  ipcMain.handle('cajas:cashbox:setStatus',
    (_e, id: string, status: CashboxStatus) => updateCashboxStatus(id, status))

  // ── Comprobantes (adjuntos en Google Drive + metadata en PowerSync) ──────────
  ipcMain.handle('cajas:attachments:list',
    (_e, ownerType: CashAttachmentOwnerType, ownerId: string) =>
      listCashAttachments(ownerType, ownerId))

  ipcMain.handle('cajas:attachments:add', async (event, ownerType: CashAttachmentOwnerType, ownerId: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return []
    const result = await dialog.showOpenDialog(win, {
      title: 'Adjuntar comprobante',
      filters: [{ name: 'Comprobantes', extensions: ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic'] }],
      properties: ['openFile', 'multiSelections'],
    })
    if (result.canceled || !result.filePaths.length) return []

    const session = await getSession()
    const createdBy = session?.email ?? session?.userId ?? ''
    const added: CashAttachment[] = []
    for (const sourcePath of result.filePaths) {
      added.push(await addCashAttachment({ ownerType, ownerId, sourcePath, createdBy }))
    }
    return added
  })

  ipcMain.handle('cajas:attachments:delete',
    (_e, id: string) => deleteCashAttachment(id))

  ipcMain.handle('cajas:attachments:open',
    (_e, driveFileId: string) =>
      shell.openExternal(`https://drive.google.com/file/d/${driveFileId}/view`))
}
