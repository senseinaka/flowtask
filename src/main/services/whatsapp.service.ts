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

  async connectInstance(): Promise<{ qr?: string; connected?: boolean }> {
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

  async sendMessage(phone: string, text: string): Promise<boolean> {
    try {
      const res = await axios.post(
        `${this.apiUrl}/message/sendText/${INSTANCE_NAME}`,
        { number: phone, text },
        { headers: this.headers(), timeout: 10000 }
      )
      return res.status === 201 || res.status === 200
    } catch (err) {
      console.error('[WhatsApp] sendMessage error:', err)
      return false
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
