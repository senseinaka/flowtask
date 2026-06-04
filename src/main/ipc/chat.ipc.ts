import { ipcMain } from 'electron'
import { sendChatMessage, getChatHistory, clearChatHistory, getSessionStats } from '../services/chat.service'

export function registerChatIpc(): void {

  /** Envía un mensaje. Chunks en tiempo real via 'chat:chunk'. */
  ipcMain.handle('chat:send', async (event, message: string, sessionId?: string) => {
    const sid = sessionId ?? 'default'
    try {
      const fullText = await sendChatMessage(
        message,
        sid,
        (chunk) => event.sender.send('chat:chunk', { text: chunk, sessionId: sid }),
        (keys)  => event.sender.send('chat:dataChanged', { keys }),
      )
      event.sender.send('chat:done', { sessionId: sid })
      return { success: true, text: fullText }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      event.sender.send('chat:error', { message: msg })
      return { success: false, error: msg }
    }
  })

  /** Historial de una sesión */
  ipcMain.handle('chat:history', (_e, sessionId?: string) =>
    getChatHistory(sessionId ?? 'default', 60)
  )

  /** Estadísticas de la sesión (conteo de mensajes, si fue compactada) */
  ipcMain.handle('chat:stats', (_e, sessionId?: string) =>
    getSessionStats(sessionId ?? 'default')
  )

  /** Limpia el historial de una sesión */
  ipcMain.handle('chat:clear', (_e, sessionId?: string) =>
    clearChatHistory(sessionId ?? 'default')
  )
}
