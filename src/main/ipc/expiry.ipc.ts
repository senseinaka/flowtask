import { ipcMain } from 'electron'
import {
  listExpiryCategories, createExpiryCategory, updateExpiryCategory, deleteExpiryCategory,
  listExpiryItems, getExpiryItem, createExpiryItem, updateExpiryItem,
  renewExpiryItem, unrenewExpiryItem, deleteExpiryItem,
  listAlertsByItem, setAlertsForItem
} from '../database/queries/expiry'
import type { CreateExpiryItemInput, CreateExpiryAlertInput } from '@shared/types'

export function registerExpiryIpc(): void {

  // ── Categories ──────────────────────────────────────────────────────────────
  ipcMain.handle('expiry:categories:list', () => listExpiryCategories())

  ipcMain.handle('expiry:categories:create', (_e, data: { name: string; icon: string; color: string }) =>
    createExpiryCategory(data)
  )

  ipcMain.handle('expiry:categories:update', (_e, id: string, data: { name?: string; icon?: string; color?: string }) =>
    updateExpiryCategory(id, data)
  )

  ipcMain.handle('expiry:categories:delete', (_e, id: string) =>
    deleteExpiryCategory(id)
  )

  // ── Items ───────────────────────────────────────────────────────────────────
  ipcMain.handle('expiry:items:list', () => listExpiryItems())

  ipcMain.handle('expiry:items:get', (_e, id: string) => getExpiryItem(id))

  ipcMain.handle('expiry:items:create', (_e, data: CreateExpiryItemInput) =>
    createExpiryItem(data)
  )

  ipcMain.handle('expiry:items:update', (_e, id: string, data: Partial<CreateExpiryItemInput>) =>
    updateExpiryItem(id, data)
  )

  ipcMain.handle('expiry:items:renew', (_e, id: string, renewedDate: number) =>
    renewExpiryItem(id, renewedDate)
  )

  ipcMain.handle('expiry:items:unrenew', (_e, id: string) =>
    unrenewExpiryItem(id)
  )

  ipcMain.handle('expiry:items:delete', (_e, id: string) =>
    deleteExpiryItem(id)
  )

  // ── Alerts ──────────────────────────────────────────────────────────────────
  ipcMain.handle('expiry:alerts:listByItem', (_e, itemId: string) =>
    listAlertsByItem(itemId)
  )

  ipcMain.handle('expiry:alerts:setForItem', (_e, itemId: string, alerts: CreateExpiryAlertInput[]) =>
    setAlertsForItem(itemId, alerts)
  )
}
