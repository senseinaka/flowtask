import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'crypto'
import { getPowerSyncDb } from '../powersync'
import type { CashOperator } from '@shared/types'

// Operadores de caja: lista propia (nombre + PIN 4 dígitos), independiente del
// login. El PIN identifica quién opera una caja y autoriza acciones sensibles.
// El hash/salt viven en la tabla sincronizada; el PIN en claro nunca sale del
// modal. La verificación corre acá (main), nunca en el renderer.

const WORKSPACE_ID = 'd61a4071-1557-4f32-be5e-6443fb336bf5'
const HASH_LEN = 64

// Anti-fuerza-bruta ONLINE: limita los reintentos de PIN por operador desde la
// app. Tras MAX_ATTEMPTS fallos consecutivos se bloquea ese operador por
// LOCKOUT_MS. Es defensa en profundidad para el camino por UI.
//
// NO mitiga la fuerza bruta OFFLINE: `pin_hash`/`pin_salt` viven en la tabla
// `cash_operators`, que PowerSync replica entera a cada dispositivo. Quien tenga
// la powersync.db local puede probar las 10 000 combinaciones de 4 dígitos sin
// pasar por esta función. La mitigación real es NO sincronizar el hash (regla de
// sync en Supabase) — ver sección de seguridad en CLAUDE.md.
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 60_000
const attempts = new Map<string, { fails: number; lockedUntil: number }>()

interface OperatorRow {
  id: string
  workspace_id: string
  name: string
  pin_hash: string
  pin_salt: string
  active: number
  created_at: string
  updated_at: string
}

function hashPin(pin: string, saltHex: string): string {
  return scryptSync(pin, Buffer.from(saltHex, 'hex'), HASH_LEN).toString('hex')
}

// Nunca expone pin_hash/pin_salt al renderer: sólo si tiene PIN configurado.
function toOperator(r: OperatorRow): CashOperator {
  return {
    id: r.id,
    workspace_id: r.workspace_id,
    name: r.name,
    active: r.active,
    has_pin: !!r.pin_hash,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }
}

export async function listCashOperators(): Promise<CashOperator[]> {
  const rows = await getPowerSyncDb().getAll<OperatorRow>(
    'SELECT * FROM cash_operators WHERE workspace_id = ? AND active = 1 ORDER BY name ASC',
    [WORKSPACE_ID]
  )
  return rows.map(toOperator)
}

export async function createCashOperator(input: { name: string; pin: string }): Promise<CashOperator> {
  const name = input.name.trim()
  if (!name) throw new Error('El nombre es obligatorio')
  if (!/^\d{4}$/.test(input.pin)) throw new Error('El PIN debe tener 4 dígitos')

  const id = randomUUID()
  const salt = randomBytes(16).toString('hex')
  const hash = hashPin(input.pin, salt)
  const now = new Date().toISOString()

  await getPowerSyncDb().execute(
    'INSERT INTO cash_operators (id, workspace_id, name, pin_hash, pin_salt, active, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)',
    [id, WORKSPACE_ID, name, hash, salt, 1, now, now]
  )
  return { id, workspace_id: WORKSPACE_ID, name, active: 1, has_pin: true, created_at: now, updated_at: now }
}

// Edita nombre y/o PIN. Si `pin` viene vacío/undefined no se toca el PIN existente.
export async function updateCashOperator(input: { id: string; name?: string; pin?: string }): Promise<void> {
  const now = new Date().toISOString()
  const sets: string[] = ['updated_at = ?']
  const params: (string | number)[] = [now]

  if (input.name !== undefined) {
    const name = input.name.trim()
    if (!name) throw new Error('El nombre es obligatorio')
    sets.push('name = ?')
    params.push(name)
  }
  if (input.pin !== undefined && input.pin !== '') {
    if (!/^\d{4}$/.test(input.pin)) throw new Error('El PIN debe tener 4 dígitos')
    const salt = randomBytes(16).toString('hex')
    sets.push('pin_hash = ?', 'pin_salt = ?')
    params.push(hashPin(input.pin, salt), salt)
  }

  params.push(input.id, WORKSPACE_ID)
  await getPowerSyncDb().execute(
    `UPDATE cash_operators SET ${sets.join(', ')} WHERE id = ? AND workspace_id = ?`,
    params
  )
}

export async function deleteCashOperator(id: string): Promise<void> {
  await getPowerSyncDb().execute(
    'DELETE FROM cash_operators WHERE id = ? AND workspace_id = ?',
    [id, WORKSPACE_ID]
  )
}

// Verifica el PIN de un operador en tiempo constante. Devuelve false si el
// operador no existe o no tiene PIN. Corre sólo en main (acá vive el hash).
// Lanza Error si el operador está bloqueado por exceso de intentos.
export async function verifyOperatorPin(id: string, pin: string): Promise<boolean> {
  const now = Date.now()
  const rec = attempts.get(id)
  if (rec && rec.lockedUntil > now) {
    const secs = Math.ceil((rec.lockedUntil - now) / 1000)
    throw new Error(`Demasiados intentos fallidos. Probá de nuevo en ${secs} s.`)
  }

  const rows = await getPowerSyncDb().getAll<OperatorRow>(
    'SELECT * FROM cash_operators WHERE id = ? AND workspace_id = ?',
    [id, WORKSPACE_ID]
  )
  const op = rows[0]
  if (!op || !op.pin_hash || !op.pin_salt) return false

  const candidate = Buffer.from(hashPin(pin, op.pin_salt), 'hex')
  const stored = Buffer.from(op.pin_hash, 'hex')
  const ok = candidate.length === stored.length && timingSafeEqual(candidate, stored)

  if (ok) {
    attempts.delete(id)
    return true
  }

  // Fallo: cuenta el intento y bloquea si se superó el umbral.
  const fails = (rec?.fails ?? 0) + 1
  attempts.set(id, {
    fails,
    lockedUntil: fails >= MAX_ATTEMPTS ? now + LOCKOUT_MS : 0,
  })
  return false
}
