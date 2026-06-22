import { ipcMain } from 'electron'
import { extractPayroll } from '../services/payroll-pdf.extractor'
import { clearPdfCache, getPdfCacheInfo } from '../services/pdf-reader.service'

export function registerPdfIpc(): void {
  ipcMain.handle('pdf:readPayroll', (_e, filePath: string) =>
    extractPayroll(filePath)
  )

  ipcMain.handle('pdf:clearCache', (_e, hash?: string) => {
    clearPdfCache(hash)
  })

  ipcMain.handle('pdf:getCacheInfo', () =>
    getPdfCacheInfo()
  )
}
