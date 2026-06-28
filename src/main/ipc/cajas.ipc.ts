import { ipcMain } from 'electron'
import {
  getCashCompanies,
  getCashboxes,
  getCashbox,
  getCashboxBalances,
  getCashboxLastCounts,
  getCashCategories,
  listCashMovements,
  createCashMovement,
  createTransfer,
  listCashCounts,
  createCashCount,
  createCashDifference,
  listCashDifferences,
  updateCashboxStatus,
} from '../database/queries/cajas'
import { getSession } from '../services/auth.service'
import type { CashboxStatus } from '@shared/types'

export function registerCajasIpc(): void {
  ipcMain.handle('cajas:companies',   () => getCashCompanies())
  ipcMain.handle('cajas:cashboxes',   () => getCashboxes())
  ipcMain.handle('cajas:cashbox',     (_e, id: string) => getCashbox(id))
  ipcMain.handle('cajas:balances',    () => getCashboxBalances())
  ipcMain.handle('cajas:lastCounts',  () => getCashboxLastCounts())
  ipcMain.handle('cajas:categories',  (_e, type?: 'income' | 'expense') => getCashCategories(type))

  ipcMain.handle('cajas:movements:list',
    (_e, cashboxId: string, limit?: number) => listCashMovements(cashboxId, limit))

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

  ipcMain.handle('cajas:differences:list',
    (_e, cashboxId: string) => listCashDifferences(cashboxId))

  ipcMain.handle('cajas:cashbox:setStatus',
    (_e, id: string, status: CashboxStatus) => updateCashboxStatus(id, status))
}
