import { ipcMain } from 'electron'
import {
  listServices,
  getService,
  createService,
  updateService,
  setServiceStatus,
  softDeleteService,
  listServicePayments,
  registerPayment,
  deletePayment,
} from '../database/queries/accounting-services'
import { getSession } from '../services/auth.service'
import type {
  AccountingServiceFilters,
  CreateAccountingServiceInput,
  RegisterServicePaymentInput,
  ServiceStatus,
} from '@shared/types'

export function registerAccountingServicesIpc(): void {
  // ─── Servicios ────────────────────────────────────────────────────────────────

  ipcMain.handle('services:list', (_e, filters: AccountingServiceFilters) => listServices(filters))

  ipcMain.handle('services:get', (_e, id: string) => getService(id))

  ipcMain.handle('services:create', (_e, input: CreateAccountingServiceInput) => createService(input))

  ipcMain.handle('services:update', (_e, id: string, patch: Partial<CreateAccountingServiceInput>) =>
    updateService(id, patch))

  ipcMain.handle('services:set-status', (_e, id: string, status: ServiceStatus) =>
    setServiceStatus(id, status))

  ipcMain.handle('services:delete', (_e, id: string) => softDeleteService(id))

  // ─── Pagos / renovaciones ──────────────────────────────────────────────────────

  ipcMain.handle('services:payments:list', (_e, serviceId: string) => listServicePayments(serviceId))

  ipcMain.handle('services:payments:register', async (_e, input: RegisterServicePaymentInput) => {
    const session = await getSession()
    return registerPayment(input, session?.email ?? session?.userId ?? '')
  })

  ipcMain.handle('services:payments:delete', (_e, id: string) => deletePayment(id))
}
