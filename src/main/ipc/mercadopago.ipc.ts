import { ipcMain } from 'electron'
import {
  listConnections,
  getConnection,
  createConnection,
  deleteConnection,
  saveAccessToken,
  listJobs,
  getJob,
  updateJobStatus,
  updateConnectionStatus,
  listTransactions,
  updateTransactionReconStatus,
  getTransactionStats,
} from '../database/queries/mercadopago'
import {
  testConnection,
  getSettlementReportConfig,
  setSettlementReportConfig,
  requestSettlementReport,
  checkJobReady,
  downloadAndProcessJob,
  openJobFile,
  showJobFileInFolder,
  runFullSync,
  DEFAULT_REPORT_CONFIG,
} from '../services/mercadopago.service'
import type {
  CreateMpConnectionInput,
  MpTransactionFilters,
  MpReportConfig,
} from '@shared/types'

export function registerMercadoPagoIpc(): void {

  // ─── Conexiones ─────────────────────────────────────────────────────────────

  ipcMain.handle('mp:connections:list', () => listConnections())

  ipcMain.handle('mp:connections:create', async (
    _e,
    input: CreateMpConnectionInput,
    userId: string
  ) => {
    const conn = await createConnection(input, userId)
    const testResult = await testConnection(conn.id)
    if (testResult.ok && testResult.user_id) {
      await updateConnectionStatus(conn.id, 'active', testResult.user_id)
    }
    return { connection: conn, test: testResult }
  })

  ipcMain.handle('mp:connections:update-token', async (
    _e,
    connectionId: string,
    newToken: string
  ) => {
    const conn = await getConnection(connectionId)
    if (!conn) throw new Error('Conexión no encontrada')
    saveAccessToken(connectionId, newToken)
    return testConnection(connectionId)
  })

  ipcMain.handle('mp:connections:test', async (_e, connectionId: string) => {
    return testConnection(connectionId)
  })

  ipcMain.handle('mp:connections:delete', async (_e, connectionId: string) => {
    const conn = await getConnection(connectionId)
    if (!conn) throw new Error('Conexión no encontrada')
    await deleteConnection(connectionId)
  })

  // ─── Configuración de reportes ───────────────────────────────────────────────

  ipcMain.handle('mp:config:default', () => DEFAULT_REPORT_CONFIG)

  ipcMain.handle('mp:config:get', async (_e, connectionId: string) => {
    return getSettlementReportConfig(connectionId)
  })

  ipcMain.handle('mp:config:set', async (_e, connectionId: string, config: Partial<MpReportConfig>) => {
    await setSettlementReportConfig(connectionId, config)
  })

  // ─── Jobs ────────────────────────────────────────────────────────────────────

  ipcMain.handle('mp:jobs:list', (_e, connectionId: string, limit?: number) => {
    return listJobs(connectionId, limit)
  })

  ipcMain.handle('mp:jobs:get', (_e, jobId: string) => getJob(jobId))

  ipcMain.handle('mp:jobs:request', async (
    _e,
    connectionId: string,
    dateFrom: string,
    dateTo: string,
    requestedBy: string
  ) => {
    return requestSettlementReport(connectionId, dateFrom, dateTo, requestedBy)
  })

  ipcMain.handle('mp:jobs:poll', async (_e, jobId: string) => {
    return checkJobReady(jobId)
  })

  ipcMain.handle('mp:jobs:download', async (_e, jobId: string) => {
    return downloadAndProcessJob(jobId)
  })

  ipcMain.handle('mp:jobs:cancel', async (_e, jobId: string) => {
    await updateJobStatus(jobId, 'failed', { error_message: 'Cancelado por el usuario' })
  })

  ipcMain.handle('mp:jobs:open-file', (_e, jobId: string) => openJobFile(jobId))

  ipcMain.handle('mp:jobs:show-in-folder', (_e, jobId: string) => showJobFileInFolder(jobId))

  // ─── Sincronización completa ──────────────────────────────────────────────────

  ipcMain.handle('mp:sync:run', async (
    _e,
    connectionId: string,
    dateFrom: string,
    dateTo: string,
    requestedBy: string
  ) => {
    return runFullSync(connectionId, dateFrom, dateTo, requestedBy)
  })

  // ─── Transacciones ────────────────────────────────────────────────────────────

  ipcMain.handle('mp:transactions:list', (_e, filters: MpTransactionFilters) => {
    return listTransactions(filters)
  })

  ipcMain.handle('mp:transactions:update-recon', async (
    _e,
    id: string,
    status: MpTransactionFilters['reconciliation_status']
  ) => {
    if (!status) throw new Error('Estado de conciliación requerido')
    await updateTransactionReconStatus(id, status)
  })

  ipcMain.handle('mp:transactions:stats', (_e, connectionId: string) => {
    return getTransactionStats(connectionId)
  })
}
