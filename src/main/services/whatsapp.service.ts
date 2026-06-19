import axios from 'axios'
import ConfigStore from './config-store'

const store = new ConfigStore('whatsapp-config')

const DEFAULT_URL = 'https://evolution-api-production-d7fd.up.railway.app'
const INSTANCE_NAME = 'flowtask'

class WhatsappService {
  private get apiUrl(): string {
    return (store.get('evolutionApiUrl', DEFAULT_URL) as string).replace(/\/$/, '')
  }

  private get apiKey(): string {
    return store.get('evolutionApiKey', 'flowtask-secret') as string
  }

  private headers() {
    return { apikey: this.apiKey, 'Content-Type': 'application/json' }
  }

  async connectInstance(): Promise<{ qr?: string; connected?: boolean; error?: string }> {
    try {
      // Try to create instance (ignores error if already exists)
      await axios.post(
        `${this.apiUrl}/instance/create`,
        { instanceName: INSTANCE_NAME, token: this.apiKey, qrcode: true },
        { headers: this.headers(), timeout: 5000 }
      ).catch(() => null)

      // Get connection state
      const stateRes = await axios.get(
        `${this.apiUrl}/instance/connectionState/${INSTANCE_NAME}`,
        { headers: this.headers(), timeout: 5000 }
      )
      const state = stateRes.data?.instance?.state

      if (state === 'open') {
        return { connected: true }
      }

      // Get QR
      const qrRes = await axios.get(
        `${this.apiUrl}/instance/connect/${INSTANCE_NAME}`,
        { headers: this.headers(), timeout: 5000 }
      )
      const qr = qrRes.data?.base64 ?? qrRes.data?.qrcode?.base64 ?? null
      return { qr }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[WhatsApp] connectInstance error:', msg)
      return { error: msg }
    }
  }

  async getQR(): Promise<string | null> {
    try {
      const res = await axios.get(
        `${this.apiUrl}/instance/connect/${INSTANCE_NAME}`,
        { headers: this.headers(), timeout: 5000 }
      )
      return res.data?.base64 ?? res.data?.qrcode?.base64 ?? null
    } catch {
      return null
    }
  }

  /**
   * Obtiene todos los grupos de WhatsApp de la instancia conectada.
   * Usa /chat/findChats y filtra los que terminan en @g.us (grupos).
   * Mucho más rápido que /group/fetchAllGroups que tarda en Railway.
   */
  async fetchGroups(): Promise<Array<{ jid: string; name: string; size: number }>> {
    try {
      const res = await axios.post(
        `${this.apiUrl}/chat/findChats/${INSTANCE_NAME}`,
        {},
        { headers: this.headers(), timeout: 15000 }
      )
      const data = Array.isArray(res.data) ? res.data : []
      return data
        .filter((c: Record<string, unknown>) =>
          typeof c.remoteJid === 'string' && c.remoteJid.endsWith('@g.us')
        )
        .map((c: Record<string, unknown>) => ({
          jid:  c.remoteJid as string,
          name: (c.pushName ?? c.name ?? 'Grupo sin nombre') as string,
          size: 0,
        }))
        .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name))
    } catch (err) {
      console.error('[WhatsApp] fetchGroups error:', err)
      return []
    }
  }

  private cleanPhone(phone: string): string {
    // Remove +, spaces, dashes, parentheses — Evolution API expects only digits
    return phone.replace(/[^\d]/g, '')
  }

  async sendMessage(phone: string, text: string): Promise<boolean> {
    const result = await this.testSend(phone, text)
    return result.ok
  }

  async testSend(phone: string, text: string): Promise<{ ok: boolean; status?: number; body?: unknown; error?: string }> {
    const number = this.cleanPhone(phone)
    if (!number) return { ok: false, error: 'Número vacío después de limpiar' }
    try {
      const res = await axios.post(
        `${this.apiUrl}/message/sendText/${INSTANCE_NAME}`,
        // textMessage for v2, text for v1 — send both for compatibility
        { number, text, textMessage: { text } },
        { headers: this.headers(), timeout: 10000 }
      )
      const ok = res.status === 200 || res.status === 201
      return { ok, status: res.status, body: res.data }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status
        const body = err.response?.data
        const msg = typeof body === 'object' && body !== null
          ? JSON.stringify(body)
          : err.message
        console.error(`[WhatsApp] sendMessage error ${status}:`, body ?? err.message)
        return { ok: false, status, body, error: msg }
      }
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[WhatsApp] sendMessage error:', msg)
      return { ok: false, error: msg }
    }
  }

  saveConfig(url: string, key: string): void {
    store.set('evolutionApiUrl', url)
    store.set('evolutionApiKey', key)
  }

  getConfig(): { url: string; key: string } {
    return { url: this.apiUrl, key: this.apiKey }
  }
}

export const whatsappService = new WhatsappService()
