import { shell } from 'electron'

/**
 * Abre una URL en el navegador/handler externo del SO SÓLO si su esquema es seguro
 * (http/https/mailto). Esquemas como file://, smb:// (UNC), ms-msdt:, search-ms:, o
 * protocolos registrados por otras apps pueden derivar en robo de hash NTLM o RCE
 * cuando la URL proviene de contenido no confiable (p.ej. el HTML de un email entrante).
 * Centralizado para que todas las rutas que abren externos compartan la misma validación.
 */
export function safeOpenExternal(url: unknown): void {
  if (typeof url !== 'string' || !url) return
  try {
    const u = new URL(url)
    if (u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:') {
      void shell.openExternal(url)
    }
  } catch {
    /* URL inválida: ignorar */
  }
}
