import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'crypto'
import ConfigStore from './config-store'

const store = new ConfigStore('mercadopago-crypto')
const WORKSPACE_ID = 'd61a4071-1557-4f32-be5e-6443fb336bf5'
const KEY_SALT = 'enc_salt'
const ALG = 'aes-256-gcm'

function getDerivedKey(): Buffer {
  let salt = store.get<string>(KEY_SALT, '')
  if (!salt) {
    salt = randomBytes(32).toString('hex')
    store.set(KEY_SALT, salt)
  }
  return scryptSync(WORKSPACE_ID, Buffer.from(salt, 'hex'), 32)
}

export function encryptToken(plaintext: string): string {
  const key = getDerivedKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALG, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}.${tag.toString('hex')}.${encrypted.toString('hex')}`
}

export function decryptToken(ciphertext: string): string {
  const parts = ciphertext.split('.')
  if (parts.length !== 3) throw new Error('Token cifrado inválido')
  const [ivHex, tagHex, encHex] = parts
  const key = getDerivedKey()
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const encrypted = Buffer.from(encHex, 'hex')
  const decipher = createDecipheriv(ALG, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf-8')
}

export function maskToken(token: string): string {
  if (!token || token.length < 8) return '***'
  return `${token.slice(0, 4)}...${token.slice(-4)}`
}
