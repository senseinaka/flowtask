import { ipcMain } from 'electron'
import { getEurUsdRate } from '../services/bna.service'

export function registerBNAIpc(): void {
  /**
   * Consulta BNA para obtener el TC EUR/USD a una fecha dada.
   * @param dateStr   - Fecha en formato YYYY-MM-DD (fecha de oficialización del despacho)
   * @param cotizAduana - TC USD/ARS del despacho (cotizacion_dolar)
   * @returns { eurUsd, eurArs, fechaBNA } o null si no se pudo consultar
   */
  ipcMain.handle('bna:getEurUsd', async (
    _e,
    dateStr: string,
    cotizAduana: number
  ) => {
    return getEurUsdRate(dateStr, cotizAduana)
  })
}
