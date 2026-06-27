import { ipcMain, BrowserWindow, dialog } from 'electron'
import { readFileSync, writeFileSync, unlinkSync } from 'fs'
import { basename, join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import type { ReconEstado, ReconImportSource, CreateReconPeriodInput, ReconPeriodStatus, ReconResultFilters } from '@shared/types'
import {
  listReconPeriods, getReconPeriod, createReconPeriod,
  updateReconPeriodStatus, deleteReconPeriod,
  listReconImports, logReconImport,
  listReconInvoices, listReconCupones, listReconMLOps,
  bulkInsertInvoices, bulkInsertCupones, bulkInsertMLOps,
  clearReconSource, clearReconCupones, clearReconMLOps,
  listReconResults, listAllReconResults, updateReconResult,
  runReconEngine, getReconKPIs,
} from '../database/queries/recon'
import {
  parseFlexxus, parseCuponesCSV, parseCuponesXLSX, parseML,
} from '../services/recon-parsers.service'

const DIALOG_FILTERS: Record<string, { name: string; extensions: string[] }[]> = {
  flexxus:       [{ name: 'Excel',       extensions: ['xlsx'] },             { name: 'Todos', extensions: ['*'] }],
  planilla2:     [{ name: 'Excel',       extensions: ['xlsx', 'xls'] },      { name: 'Todos', extensions: ['*'] }],
  cupones_csv:   [{ name: 'CSV',         extensions: ['csv'] },              { name: 'Todos', extensions: ['*'] }],
  cupones_xlsx:  [{ name: 'Excel',       extensions: ['xlsx', 'xls'] },      { name: 'Todos', extensions: ['*'] }],
  ml_principal:  [{ name: 'Excel / XLS', extensions: ['xlsx', 'xls'] },      { name: 'Todos', extensions: ['*'] }],
  ml_secundaria: [{ name: 'Excel / XLS', extensions: ['xlsx', 'xls'] },      { name: 'Todos', extensions: ['*'] }],
  fondos:        [{ name: 'Excel / CSV', extensions: ['xlsx', 'xls', 'csv'] }, { name: 'Todos', extensions: ['*'] }],
}

const DIALOG_TITLES: Record<string, string> = {
  flexxus:       'Seleccionar Fondos Vtas Web (Flexxus)',
  planilla2:     'Seleccionar Planilla Facturas + Clientes',
  cupones_csv:   'Seleccionar Cupones CSV',
  cupones_xlsx:  'Seleccionar Cupones XLSX',
  ml_principal:  'Seleccionar exportación ML Principal',
  ml_secundaria: 'Seleccionar exportación ML Secundaria',
  fondos:        'Seleccionar Fondos / Banco',
}

export function registerReconIpc(): void {

  // ── Períodos ────────────────────────────────────────────────────────────────

  ipcMain.handle('recon:periods:list', () => listReconPeriods())

  ipcMain.handle('recon:periods:get', (_e, id: string) => getReconPeriod(id))

  ipcMain.handle('recon:periods:create', (_e, data: CreateReconPeriodInput, userId: string) =>
    createReconPeriod(data, userId)
  )

  ipcMain.handle('recon:periods:setStatus',
    (_e, id: string, status: ReconPeriodStatus, closedBy?: string) =>
      updateReconPeriodStatus(id, status, closedBy)
  )

  ipcMain.handle('recon:periods:delete', (_e, id: string) => deleteReconPeriod(id))

  // ── Historial de imports ─────────────────────────────────────────────────

  ipcMain.handle('recon:imports:list', (_e, periodId: string) => listReconImports(periodId))

  // ── Import principal (abre dialog → parsea → inserta) ────────────────────

  ipcMain.handle('recon:import',
    async (e, periodId: string, source: ReconImportSource, importedBy: string, preFilePath?: string) => {
      let filePath: string
      let filename: string

      if (preFilePath) {
        filePath = preFilePath
        filename = basename(preFilePath)
      } else {
        const win = BrowserWindow.fromWebContents(e.sender)
        if (!win) return { ok: false, error: 'No hay ventana activa' }
        const filters = DIALOG_FILTERS[source] ?? [{ name: 'Todos', extensions: ['*'] }]
        const title   = DIALOG_TITLES[source]  ?? 'Seleccionar archivo'
        const dlg     = await dialog.showOpenDialog(win, { title, properties: ['openFile'], filters })
        if (dlg.canceled || dlg.filePaths.length === 0) return { ok: false, canceled: true }
        filePath = dlg.filePaths[0]
        filename = basename(filePath)
      }

      try {
        const buffer = readFileSync(filePath)
        let inserted = 0
        let skipped  = 0

        switch (source) {
          case 'flexxus': {
            const rows = parseFlexxus(buffer)
            ;({ inserted, skipped } = bulkInsertInvoices(periodId, rows, 'flexxus'))
            break
          }
          case 'cupones_csv': {
            const rows = parseCuponesCSV(buffer)
            ;({ inserted, skipped } = bulkInsertCupones(periodId, rows))
            break
          }
          case 'cupones_xlsx': {
            const rows = parseCuponesXLSX(buffer)
            ;({ inserted, skipped } = bulkInsertCupones(periodId, rows))
            break
          }
          case 'ml_principal': {
            const rows = parseML(buffer)
            ;({ inserted, skipped } = bulkInsertMLOps(periodId, rows, 'principal'))
            break
          }
          case 'ml_secundaria': {
            const rows = parseML(buffer)
            ;({ inserted, skipped } = bulkInsertMLOps(periodId, rows, 'secundaria'))
            break
          }
          default:
            logReconImport({
              period_id: periodId, source, filename, row_count: 0,
              status: 'warning', error_msg: 'Parser no implementado aún', imported_by: importedBy,
            })
            return { ok: false, error: `Fuente "${source}" aún no tiene parser implementado` }
        }

        logReconImport({
          period_id: periodId, source, filename, row_count: inserted,
          skipped_count: skipped, status: 'ok', error_msg: '', imported_by: importedBy,
        })
        return { ok: true, count: inserted, skipped, filename }

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        logReconImport({
          period_id: periodId, source, filename, row_count: 0,
          skipped_count: 0, status: 'error', error_msg: msg, imported_by: importedBy,
        })
        return { ok: false, error: msg }
      }
    }
  )

  // ── Import desde buffer (drag & drop) ───────────────────────────────────

  ipcMain.handle('recon:import:buffer',
    async (_e, periodId: string, source: ReconImportSource, importedBy: string, data: Uint8Array, filename: string) => {
      const ext     = filename.split('.').pop()?.toLowerCase() ?? 'tmp'
      const tmpPath = join(tmpdir(), `recon-${randomUUID()}.${ext}`)
      try {
        writeFileSync(tmpPath, Buffer.from(data))
        const buffer = readFileSync(tmpPath)
        let inserted = 0
        let skipped  = 0

        switch (source) {
          case 'flexxus': {
            const rows = parseFlexxus(buffer)
            ;({ inserted, skipped } = bulkInsertInvoices(periodId, rows, 'flexxus'))
            break
          }
          case 'cupones_csv': {
            const rows = parseCuponesCSV(buffer)
            ;({ inserted, skipped } = bulkInsertCupones(periodId, rows))
            break
          }
          case 'cupones_xlsx': {
            const rows = parseCuponesXLSX(buffer)
            ;({ inserted, skipped } = bulkInsertCupones(periodId, rows))
            break
          }
          case 'ml_principal': {
            const rows = parseML(buffer)
            ;({ inserted, skipped } = bulkInsertMLOps(periodId, rows, 'principal'))
            break
          }
          case 'ml_secundaria': {
            const rows = parseML(buffer)
            ;({ inserted, skipped } = bulkInsertMLOps(periodId, rows, 'secundaria'))
            break
          }
          default:
            logReconImport({
              period_id: periodId, source, filename, row_count: 0,
              skipped_count: 0, status: 'warning', error_msg: 'Parser no implementado aún', imported_by: importedBy,
            })
            return { ok: false, error: `Fuente "${source}" aún no tiene parser implementado` }
        }

        logReconImport({
          period_id: periodId, source, filename, row_count: inserted,
          skipped_count: skipped, status: 'ok', error_msg: '', imported_by: importedBy,
        })
        return { ok: true, count: inserted, skipped, filename }

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        logReconImport({
          period_id: periodId, source, filename, row_count: 0,
          skipped_count: 0, status: 'error', error_msg: msg, imported_by: importedBy,
        })
        return { ok: false, error: msg }
      } finally {
        try { unlinkSync(tmpPath) } catch { /* ya borrado */ }
      }
    }
  )

  // ── Acceso a datos del período ───────────────────────────────────────────

  ipcMain.handle('recon:data:invoices', (_e, periodId: string) => listReconInvoices(periodId))
  ipcMain.handle('recon:data:cupones',  (_e, periodId: string) => listReconCupones(periodId))
  ipcMain.handle('recon:data:mlops',    (_e, periodId: string) => listReconMLOps(periodId))

  // ── Motor de conciliación ────────────────────────────────────────────────

  ipcMain.handle('recon:run', (_e, periodId: string) => {
    try {
      const result = runReconEngine(periodId)
      updateReconPeriodStatus(periodId, 'review')
      return { ok: true, ...result }
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // ── Limpiar datos por fuente ─────────────────────────────────────────────

  ipcMain.handle('recon:source:clear', (_e, periodId: string, source: string) => {
    let deleted = 0
    if (source === 'cupones_csv' || source === 'cupones_xlsx') {
      deleted = clearReconCupones(periodId)
    } else if (source === 'ml_principal') {
      deleted = clearReconMLOps(periodId, 'principal')
    } else if (source === 'ml_secundaria') {
      deleted = clearReconMLOps(periodId, 'secundaria')
    } else {
      deleted = clearReconSource(periodId, source)
    }
    return { deleted }
  })

  // ── Resultados ───────────────────────────────────────────────────────────

  ipcMain.handle('recon:results:list',
    (_e, periodId: string, estado?: ReconEstado) => listReconResults(periodId, estado)
  )

  ipcMain.handle('recon:results:listAll',
    (_e, filters?: ReconResultFilters) => listAllReconResults(filters)
  )

  ipcMain.handle('recon:results:update',
    (_e, id: string, data: { estado?: ReconEstado; notes?: string; override_by?: string }) =>
      updateReconResult(id, data)
  )

  // ── KPIs ─────────────────────────────────────────────────────────────────

  ipcMain.handle('recon:kpis:get', (_e, periodId: string) => getReconKPIs(periodId))
}
