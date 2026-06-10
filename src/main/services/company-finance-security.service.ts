// ═══════════════════════════════════════════════════════════════════════════
// Finanzas Empresa — Fase 5: Bloqueo por PIN
// ═══════════════════════════════════════════════════════════════════════════
//
// Persistencia vía ConfigStore (mismo patrón que ai-config: archivo JSON en
// userData), no en la base SQLite — es configuración local del dispositivo,
// no datos financieros. Nunca se guarda el PIN en texto plano: se deriva una
// clave con scrypt + salt aleatoria por instalación y se compara en tiempo
// constante (timingSafeEqual) para evitar timing attacks triviales.
//
// Nota de alcance: esto es un bloqueo de "pantalla" para disuadir miradas
// casuales sobre datos sensibles en un equipo compartido — no es cifrado de
// la base de datos ni protección contra acceso con privilegios de SO.

import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import ConfigStore from './config-store'
import type { FinanceSecurityStatus } from '@shared/types'

const store = new ConfigStore('company-finance-security')

const KEY_SALT = 'salt'
const KEY_HASH = 'pinHash'
const HASH_LEN = 64

function hashPin(pin: string, saltHex: string): string {
  return scryptSync(pin, Buffer.from(saltHex, 'hex'), HASH_LEN).toString('hex')
}

export function getCompanyFinanceSecurityStatus(): FinanceSecurityStatus {
  return { enabled: store.has(KEY_HASH) }
}

/** Activa el bloqueo (o cambia el PIN existente sin pedir el anterior — usar con cuidado desde la UI). */
export function setCompanyFinancePin(pin: string): FinanceSecurityStatus {
  const salt = randomBytes(16).toString('hex')
  store.set(KEY_SALT, salt)
  store.set(KEY_HASH, hashPin(pin, salt))
  return getCompanyFinanceSecurityStatus()
}

/** Si no hay PIN configurado, cualquier intento "pasa" (no hay nada que bloquear). */
export function verifyCompanyFinancePin(pin: string): boolean {
  const hash = store.get<string>(KEY_HASH, '')
  const salt = store.get<string>(KEY_SALT, '')
  if (!hash || !salt) return true

  const candidate = Buffer.from(hashPin(pin, salt), 'hex')
  const stored    = Buffer.from(hash, 'hex')
  if (candidate.length !== stored.length) return false
  return timingSafeEqual(candidate, stored)
}

/** Requiere el PIN actual para desactivar — evita que alguien lo apague sin saberlo. */
export function disableCompanyFinancePin(currentPin: string): boolean {
  if (!getCompanyFinanceSecurityStatus().enabled) return true
  if (!verifyCompanyFinancePin(currentPin)) return false
  store.delete(KEY_HASH)
  store.delete(KEY_SALT)
  return true
}

/** Cambia el PIN verificando primero el actual. */
export function changeCompanyFinancePin(currentPin: string, newPin: string): boolean {
  if (!verifyCompanyFinancePin(currentPin)) return false
  setCompanyFinancePin(newPin)
  return true
}
