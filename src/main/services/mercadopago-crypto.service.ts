import { safeStorage } from 'electron'
import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'crypto'
import ConfigStore from './config-store'

// Cifrado del access token de Mercado Pago EN REPOSO (tabla mercadopago_credentials).
//
// Esquema actual: `safeStorage` de Electron (DPAPI/Keychain/libsecret) — la clave
// la protege la cuenta de OS del usuario, no se deriva de constantes públicas.
//
// Esquema legacy (sólo para descifrar tokens viejos / fallback sin keyring):
// AES-256-GCM con clave derivada por scrypt. Era débil porque el "password"
// (WORKSPACE_ID) es una constante del repo PÚBLICO y el salt vive en el mismo
// disco que el ciphertext — efectivamente ofuscación. Se conserva sólo para
// poder leer tokens guardados con el formato anterior y migrarlos al re-guardar.

const store = new ConfigStore('mercadopago-crypto')
const WORKSPACE_ID = 'd61a4071-1557-4f32-be5e-6443fb336bf5'
const KEY_SALT = 'enc_salt'
const ALG = 'aes-256-gcm'
const SS_PREFIX = 'ss:' // marca de tokens cifrados con safeStorage

function ssAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

function legacyDerivedKey(): Buffer {
  let salt = store.get<string>(KEY_SALT, '')
  if (!salt) {
    salt = randomBytes(32).toString('hex')
    store.set(KEY_SALT, salt)
  }
  return scryptSync(WORKSPACE_ID, Buffer.from(salt, 'hex'), 32)
}

function legacyEncrypt(plaintext: string): string {
  const key = legacyDerivedKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALG, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}.${tag.toString('hex')}.${encrypted.toString('hex')}`
}

function legacyDecrypt(ciphertext: string): string {
  const parts = ciphertext.split('.')
  if (parts.length !== 3) throw new Error('Token cifrado inválido')
  const [ivHex, tagHex, encHex] = parts
  const key = legacyDerivedKey()
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const encrypted = Buffer.from(encHex, 'hex')
  const decipher = createDecipheriv(ALG, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf-8')
}

export function encryptToken(plaintext: string): string {
  if (ssAvailable()) {
    return SS_PREFIX + safeStorage.encryptString(plaintext).toString('base64')
  }
  // Sin keyring del SO: se cae al esquema legacy (no peor que antes).
  return legacyEncrypt(plaintext)
}

export function decryptToken(ciphertext: string): string {
  if (ciphertext.startsWith(SS_PREFIX)) {
    if (!ssAvailable()) throw new Error('safeStorage no disponible para descifrar el token de Mercado Pago')
    return safeStorage.decryptString(Buffer.from(ciphertext.slice(SS_PREFIX.length), 'base64'))
  }
  // Formato viejo (iv.tag.enc): se descifra con el esquema legacy para migración.
  return legacyDecrypt(ciphertext)
}

export function maskToken(token: string): string {
  if (!token || token.length < 8) return '***'
  return `${token.slice(0, 4)}...${token.slice(-4)}`
}
