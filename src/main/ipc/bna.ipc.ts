import { ipcMain } from 'electron'
import { getEurArsRateDirect } from '../services/bna.service'

export function registerBNAIpc(): void {
  /**
   * Consulta BNA para obtener la cotización EUR/ARS a una fecha dada.
   * Devuelve el valor directo EUR/ARS (cuántos pesos vale 1 euro).
   * Fórmula de uso: base_ars = valor_eur × tc_eur_ars
   */
  ipcMain.handle('bna:getEurArs', async (_e, dateStr: string) => {
    return getEurArsRateDirect(dateStr)
  })
}
