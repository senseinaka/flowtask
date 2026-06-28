import { ipcMain, BrowserWindow, dialog } from 'electron'
import { readFileSync, writeFileSync, unlinkSync } from 'fs'
import { basename, join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import * as XLSX from 'xlsx'
import type { ReconEstado, ReconImportSource, CreateReconPeriodInput, ReconPeriodStatus, ReconResultFilters } from '@shared/types'
import {
  listReconPeriods, getReconPeriod, createReconPeriod,
  updateReconPeriodStatus, deleteReconPeriod,
  listReconImports, logReconImport, deleteReconImport,
  listReconInvoices, listReconCupones, listReconMLOps, listReconNaveOps, listReconExtracto,
  bulkInsertInvoices, bulkInsertCupones, bulkInsertMLOps, bulkInsertNaveOps, bulkInsertExtracto,
  clearReconSource, clearReconCupones, clearReconMLOps, clearReconNave, clearReconExtracto,
  listReconResults, listAllReconResults, updateReconResult,
  runReconEngine, getReconKPIs,
} from '../database/queries/recon'
import {
  parseFlexxus, parseCuponesCSV, parseCuponesXLSX, parseML, parseNave, parseExtracto,
} from '../services/recon-parsers.service'

const DIALOG_FILTERS: Record<string, { name: string; extensions: string[] }[]> = {
  flexxus:       [{ name: 'Excel',       extensions: ['xlsx'] },             { name: 'Todos', extensions: ['*'] }],
  planilla2:     [{ name: 'Excel',       extensions: ['xlsx', 'xls'] },      { name: 'Todos', extensions: ['*'] }],
  cupones_csv:   [{ name: 'CSV',         extensions: ['csv'] },              { name: 'Todos', extensions: ['*'] }],
  cupones_xlsx:  [{ name: 'Excel',       extensions: ['xlsx', 'xls'] },      { name: 'Todos', extensions: ['*'] }],
  ml_principal:  [{ name: 'Excel / XLS', extensions: ['xlsx', 'xls'] },      { name: 'Todos', extensions: ['*'] }],
  ml_secundaria: [{ name: 'Excel / XLS', extensions: ['xlsx', 'xls'] },      { name: 'Todos', extensions: ['*'] }],
  fondos:        [{ name: 'Excel / CSV', extensions: ['xlsx', 'xls', 'csv'] }, { name: 'Todos', extensions: ['*'] }],
  nave:          [{ name: 'Excel / XLS', extensions: ['xls', 'xlsx'] },      { name: 'Todos', extensions: ['*'] }],
  extracto:      [{ name: 'Excel / XLS', extensions: ['xls', 'xlsx'] },      { name: 'Todos', extensions: ['*'] }],
}

const DIALOG_TITLES: Record<string, string> = {
  flexxus:       'Seleccionar Fondos Vtas Web (Flexxus)',
  planilla2:     'Seleccionar Planilla Facturas + Clientes',
  cupones_csv:   'Seleccionar Cupones CSV',
  cupones_xlsx:  'Seleccionar Cupones XLSX',
  ml_principal:  'Seleccionar exportación ML Principal',
  ml_secundaria: 'Seleccionar exportación ML Secundaria',
  fondos:        'Seleccionar Fondos / Banco',
  nave:          'Seleccionar NAVE_[mes].xls',
  extracto:      'Seleccionar Extracto bancario',
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
        const buffer   = readFileSync(filePath)
        const importId = randomUUID()
        let inserted   = 0
        let skipped    = 0

        switch (source) {
          case 'flexxus': {
            const rows = parseFlexxus(buffer)
            ;({ inserted, skipped } = bulkInsertInvoices(periodId, rows, 'flexxus', importId))
            break
          }
          case 'cupones_csv': {
            const rows = parseCuponesCSV(buffer)
            ;({ inserted, skipped } = bulkInsertCupones(periodId, rows, importId))
            break
          }
          case 'cupones_xlsx': {
            const rows = parseCuponesXLSX(buffer)
            ;({ inserted, skipped } = bulkInsertCupones(periodId, rows, importId))
            break
          }
          case 'ml_principal': {
            const rows = parseML(buffer)
            ;({ inserted, skipped } = bulkInsertMLOps(periodId, rows, 'principal', importId))
            break
          }
          case 'ml_secundaria': {
            const rows = parseML(buffer)
            ;({ inserted, skipped } = bulkInsertMLOps(periodId, rows, 'secundaria', importId))
            break
          }
          case 'nave': {
            const rows = parseNave(buffer)
            ;({ inserted, skipped } = bulkInsertNaveOps(periodId, rows, importId))
            break
          }
          case 'extracto': {
            const rows = parseExtracto(buffer)
            ;({ inserted, skipped } = bulkInsertExtracto(periodId, rows, importId))
            break
          }
          default:
            logReconImport({
              id: randomUUID(), period_id: periodId, source, filename, row_count: 0, skipped_count: 0,
              status: 'warning', error_msg: 'Parser no implementado aún', imported_by: importedBy,
            })
            return { ok: false, error: `Fuente "${source}" aún no tiene parser implementado` }
        }

        logReconImport({
          id: importId, period_id: periodId, source, filename, row_count: inserted,
          skipped_count: skipped, status: 'ok', error_msg: '', imported_by: importedBy,
        })
        return { ok: true, count: inserted, skipped, filename }

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        logReconImport({
          id: randomUUID(), period_id: periodId, source, filename, row_count: 0,
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

        const importId = randomUUID()

        switch (source) {
          case 'flexxus': {
            const rows = parseFlexxus(buffer)
            ;({ inserted, skipped } = bulkInsertInvoices(periodId, rows, 'flexxus', importId))
            break
          }
          case 'cupones_csv': {
            const rows = parseCuponesCSV(buffer)
            ;({ inserted, skipped } = bulkInsertCupones(periodId, rows, importId))
            break
          }
          case 'cupones_xlsx': {
            const rows = parseCuponesXLSX(buffer)
            ;({ inserted, skipped } = bulkInsertCupones(periodId, rows, importId))
            break
          }
          case 'ml_principal': {
            const rows = parseML(buffer)
            ;({ inserted, skipped } = bulkInsertMLOps(periodId, rows, 'principal', importId))
            break
          }
          case 'ml_secundaria': {
            const rows = parseML(buffer)
            ;({ inserted, skipped } = bulkInsertMLOps(periodId, rows, 'secundaria', importId))
            break
          }
          case 'nave': {
            const rows = parseNave(buffer)
            ;({ inserted, skipped } = bulkInsertNaveOps(periodId, rows, importId))
            break
          }
          case 'extracto': {
            const rows = parseExtracto(buffer)
            ;({ inserted, skipped } = bulkInsertExtracto(periodId, rows, importId))
            break
          }
          default:
            logReconImport({
              id: randomUUID(), period_id: periodId, source, filename, row_count: 0,
              skipped_count: 0, status: 'warning', error_msg: 'Parser no implementado aún', imported_by: importedBy,
            })
            return { ok: false, error: `Fuente "${source}" aún no tiene parser implementado` }
        }

        logReconImport({
          id: importId, period_id: periodId, source, filename, row_count: inserted,
          skipped_count: skipped, status: 'ok', error_msg: '', imported_by: importedBy,
        })
        return { ok: true, count: inserted, skipped, filename }

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        logReconImport({
          id: randomUUID(), period_id: periodId, source, filename, row_count: 0,
          skipped_count: 0, status: 'error', error_msg: msg, imported_by: importedBy,
        })
        return { ok: false, error: msg }
      } finally {
        try { unlinkSync(tmpPath) } catch { /* ya borrado */ }
      }
    }
  )

  ipcMain.handle('recon:import:delete', (_e, importId: string) => {
    deleteReconImport(importId)
    return { ok: true }
  })

  // ── Acceso a datos del período ───────────────────────────────────────────

  ipcMain.handle('recon:data:invoices', (_e, periodId: string) => listReconInvoices(periodId))
  ipcMain.handle('recon:data:cupones',  (_e, periodId: string) => listReconCupones(periodId))
  ipcMain.handle('recon:data:mlops',    (_e, periodId: string) => listReconMLOps(periodId))
  ipcMain.handle('recon:data:naveops',  (_e, periodId: string) => listReconNaveOps(periodId))
  ipcMain.handle('recon:data:extracto', (_e, periodId: string) => listReconExtracto(periodId))

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
    } else if (source === 'nave') {
      deleted = clearReconNave(periodId)
    } else if (source === 'extracto') {
      deleted = clearReconExtracto(periodId)
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

  // ── Export Excel ──────────────────────────────────────────────────────────

  ipcMain.handle('recon:export', async (e, periodId: string) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return { ok: false, error: 'No hay ventana activa' }

    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Exportar conciliación',
      defaultPath: `conciliacion_${periodId.slice(0, 8)}.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    })
    if (canceled || !filePath) return { ok: false, canceled: true }

    try {
      const results  = listReconResults(periodId)
      const invoices = listReconInvoices(periodId)
      const mlOps    = listReconMLOps(periodId)
      const naveOps  = listReconNaveOps(periodId)
      const extracto = listReconExtracto(periodId)

      const invMap     = new Map(invoices.map(i => [i.id, i]))
      const mlMap      = new Map(mlOps.map(op => [op.id, op]))
      const naveMap    = new Map(naveOps.map(op => [op.id, op]))
      const extractMap = new Map(extracto.map(ex => [ex.id, ex]))

      const LABELS: Record<string, string> = {
        conciliado: 'Conciliado', dif_menor: 'Dif. menor', conciliado_monto: 'Conciliado (monto)',
        diferencia_monto: 'Diferencia monto', rechazado_ml: 'Rechazado ML',
        no_cobrado_ml: 'No cobrado ML', pendiente: 'Pendiente', requiere_revision: 'Requiere revisión',
        manual: 'Manual', sin_match_nave: 'Sin match NAVE',
        sin_match_ml: 'Sin match ML', sin_match_trans: 'Sin match Trans.',
      }

      const rows = results.map(r => {
        const inv  = r.invoice_id   ? invMap.get(r.invoice_id)     : undefined
        const ml   = r.ml_op_id     ? mlMap.get(r.ml_op_id)        : undefined
        const nave = r.nave_op_id   ? naveMap.get(r.nave_op_id)    : undefined
        const extr = r.extracto_id  ? extractMap.get(r.extracto_id): undefined
        return {
          'Tipo':           r.result_type === 'nave' ? 'NAVE' : r.result_type === 'ml' ? 'ML' : r.result_type === 'trans' ? 'Transferencia' : '',
          'Estado':         LABELS[r.estado] ?? r.estado,
          'Diferencia':     r.diferencia,
          'Comprobante':    inv?.comprobante ?? '',
          'Concepto':       inv?.concepto ?? '',
          'Total Factura':  inv?.total ?? '',
          'Imp. Tarjetas':  inv?.importe_tarjetas ?? '',
          'Imp. Trans.':    inv?.importe_transferencia ?? '',
          'Fecha Factura':  inv?.fecha ?? '',
          'Cupón':          ml?.operation_id ?? nave?.operation_id ?? '',
          'Monto Cupón':    ml?.transaction_amount ?? nave?.monto_bruto ?? '',
          'Contraparte':    ml?.counterpart_name ?? '',
          'Estado ML':      ml?.status ?? nave?.status ?? '',
          'Leyenda Trans.': extr?.leyenda ?? '',
          'Crédito Trans.': extr?.credito ?? '',
          'Notas':          r.notes ?? '',
        }
      })

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Resultados')

      // Sheet por tipo
      const tipos: Array<{ key: string; label: string }> = [
        { key: 'nave',  label: 'NAVE'           },
        { key: 'ml',    label: 'ML'              },
        { key: 'trans', label: 'Transferencias'  },
      ]
      for (const { key, label } of tipos) {
        const subset = rows.filter((_, i) => results[i].result_type === key)
        if (subset.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(subset), label)
      }

      XLSX.writeFile(wb, filePath)
      return { ok: true, filePath }
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}
