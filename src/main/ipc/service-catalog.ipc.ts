import { ipcMain } from 'electron'
import { listCatalog, upsertCatalogEntry, deleteCatalogEntry } from '../database/queries/service-catalog'

export function registerServiceCatalogIpc() {
  ipcMain.handle('catalog:list', (_e, type: string) => listCatalog(type))
  ipcMain.handle('catalog:upsert', (_e, input: {
    id?: string
    config_type: string
    value: string
    label: string
    sort_order?: number
  }) => upsertCatalogEntry(input))
  ipcMain.handle('catalog:delete', (_e, id: string) => deleteCatalogEntry(id))
}
