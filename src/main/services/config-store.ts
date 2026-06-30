import { app, safeStorage } from 'electron'
import path from 'path'
import fs from 'fs'

/**
 * Store JSON en `userData`. El contenido se cifra EN REPOSO con `safeStorage`
 * de Electron (DPAPI en Windows / Keychain en macOS / libsecret en Linux), de
 * modo que tokens de sesión, apikeys y demás secretos no queden en texto plano
 * en disco.
 *
 * • Si `safeStorage` no está disponible (p.ej. Linux sin keyring), cae a texto
 *   plano — mismo comportamiento que antes, nunca rompe.
 * • Migración transparente: un archivo viejo en texto plano se lee igual y se
 *   re-escribe cifrado en el próximo `save()`.
 */
class ConfigStore {
  private static readonly ENC_PREFIX = 'ENC1:'

  private filePath: string
  private cache: Record<string, unknown> = {}
  private loaded = false

  constructor(name: string) {
    const dir = app.getPath('userData')
    this.filePath = path.join(dir, `${name}.json`)
  }

  private encryptionAvailable(): boolean {
    try {
      return safeStorage.isEncryptionAvailable()
    } catch {
      return false
    }
  }

  private load(): void {
    if (this.loaded) return
    try {
      if (fs.existsSync(this.filePath)) {
        this.cache = this.deserialize(fs.readFileSync(this.filePath, 'utf-8'))
      }
    } catch {
      this.cache = {}
    }
    this.loaded = true
  }

  private deserialize(raw: string): Record<string, unknown> {
    const trimmed = raw.trimStart()
    if (trimmed.startsWith(ConfigStore.ENC_PREFIX)) {
      // Cifrado con safeStorage: si falla el descifrado (otra cuenta de OS,
      // keyring cambiado), se devuelve vacío en vez de crashear.
      try {
        const b64 = trimmed.slice(ConfigStore.ENC_PREFIX.length)
        const json = safeStorage.decryptString(Buffer.from(b64, 'base64'))
        return JSON.parse(json)
      } catch {
        return {}
      }
    }
    // Texto plano (formato viejo) → se migra a cifrado en el próximo save().
    return JSON.parse(raw)
  }

  private save(): void {
    const json = JSON.stringify(this.cache, null, 2)
    let out = json
    try {
      if (this.encryptionAvailable()) {
        out = ConfigStore.ENC_PREFIX + safeStorage.encryptString(json).toString('base64')
      }
    } catch {
      out = json // fallback a texto plano si el cifrado falla
    }
    fs.writeFileSync(this.filePath, out, 'utf-8')
  }

  get<T>(key: string, defaultValue?: T): T {
    this.load()
    return (this.cache[key] as T) ?? (defaultValue as T)
  }

  set(key: string, value: unknown): void {
    this.load()
    this.cache[key] = value
    this.save()
  }

  has(key: string): boolean {
    this.load()
    return key in this.cache
  }

  delete(key: string): void {
    this.load()
    delete this.cache[key]
    this.save()
  }
}

export default ConfigStore
