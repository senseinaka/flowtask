import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'crypto'
import { getPowerSyncDb } from '../powersync'
import { readEnvLocal } from '../powersync'
import { getSession } from '../../services/auth.service'
import type { CashOperator } from '@shared/types'

// Operadores de caja: lista propia (nombre + PIN 4 dígitos), independiente del
// login. El PIN identifica quién opera una caja y autoriza acciones sensibles.
//
// Arquitectura de seguridad:
//   - pin_hash y pin_salt viven SOLO en Supabase, nunca en powersync.db local.
//   - Los campos sincronizados (name, active, etc.) van por PowerSync como siempre.
//   - La verificación llama a la función RPC `get_operator_pin_material` de Supabase
//     y hace la comparación scrypt en main (requiere conexión — cajas siempre online).
//   - La sync-rule del servidor excluye pin_hash/pin_salt de la bajada a clientes.

const WORKSPACE_ID = 'd61a4071-1557-4f32-be5e-6443fb336bf5'
const HASH_LEN = 64

// Anti-fuerza-bruta en memoria: tras MAX_ATTEMPTS fallos consecutivos bloquea
// ese operador por LOCKOUT_MS. No mitiga ataques directos a Supabase (que tiene
// su propio rate-limit), solo el camino por UI.
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 60_000
const attempts = new Map<string, { fails: number; lockedUntil: number }>()

interface OperatorRow {
  id: string
  workspace_id: string
  name: string
  active: number
  created_at: string
  updated_at: string
}

function hashPin(pin: string, saltHex: string): string {
  return scryptSync(pin, Buffer.from(saltHex, 'hex'), HASH_LEN).toString('hex')
}

// Nunca expone pin_hash/pin_salt al renderer.
function toOperator(r: OperatorRow & { pin_hash?: string }): CashOperator {
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

async function supabaseHeaders(): Promise<Record<string, string>> {
  const env = readEnvLocal()
  const session = await getSession()
  return {
    apikey: env.SUPABASE_ANON_KEY ?? '',
    Authorization: `Bearer ${session?.accessToken ?? env.SUPABASE_ANON_KEY ?? ''}`,
    'Content-Type': 'application/json',
  }
}

// Escribe pin_hash/pin_salt directamente en Supabase (fuera de la cola ps_crud).
// Se llama después del INSERT en powersync.db para que la fila ya exista en Supabase.
async function patchPinInSupabase(id: string, hash: string, salt: string): Promise<void> {
  const env = readEnvLocal()
  const headers = await supabaseHeaders()
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/cash_operators?id=eq.${id}&workspace_id=eq.${WORKSPACE_ID}`,
    { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ pin_hash: hash, pin_salt: salt }) }
  )
  if (!res.ok && res.status !== 404) {
    const body = await res.text()
    throw new Error(`Error al guardar PIN en Supabase: ${body}`)
  }
}

export async function listCashOperators(): Promise<CashOperator[]> {
  // has_pin se calcula leyendo el campo desde Supabase (no está en local).
  // Para la lista general se devuelve has_pin=false si no hay conexión.
  const rows = await getPowerSyncDb().getAll<OperatorRow>(
    'SELECT * FROM cash_operators WHERE workspace_id = ? AND active = 1 ORDER BY name ASC',
    [WORKSPACE_ID]
  )

  // Enrich has_pin from Supabase if online
  try {
    const env = readEnvLocal()
    const headers = await supabaseHeaders()
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/cash_operators?workspace_id=eq.${WORKSPACE_ID}&active=eq.1&select=id,pin_hash`,
      { headers }
    )
    if (res.ok) {
      const remote: Array<{ id: string; pin_hash: string | null }> = await res.json()
      const pinMap = new Map(remote.map(r => [r.id, r.pin_hash]))
      return rows.map(r => toOperator({ ...r, pin_hash: pinMap.get(r.id) ?? undefined }))
    }
  } catch {
    // Sin red: has_pin=false para todos (no bloquea la lista)
  }
  return rows.map(r => toOperator(r))
}

export async function createCashOperator(input: { name: string; pin: string }): Promise<CashOperator> {
  const name = input.name.trim()
  if (!name) throw new Error('El nombre es obligatorio')
  if (!/^\d{4}$/.test(input.pin)) throw new Error('El PIN debe tener 4 dígitos')

  const id = randomUUID()
  const salt = randomBytes(16).toString('hex')
  const hash = hashPin(input.pin, salt)
  const now = new Date().toISOString()

  // 1. Insertar campos no-sensibles en powersync.db (se sincronizarán).
  await getPowerSyncDb().execute(
    'INSERT INTO cash_operators (id, workspace_id, name, active, created_at, updated_at) VALUES (?,?,?,?,?,?)',
    [id, WORKSPACE_ID, name, 1, now, now]
  )

  // 2. Escribir pin_hash/pin_salt directo en Supabase (nunca pasa por sync).
  await patchPinInSupabase(id, hash, salt)

  return { id, workspace_id: WORKSPACE_ID, name, active: 1, has_pin: true, created_at: now, updated_at: now }
}

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

  params.push(input.id, WORKSPACE_ID)
  await getPowerSyncDb().execute(
    `UPDATE cash_operators SET ${sets.join(', ')} WHERE id = ? AND workspace_id = ?`,
    params
  )

  if (input.pin !== undefined && input.pin !== '') {
    if (!/^\d{4}$/.test(input.pin)) throw new Error('El PIN debe tener 4 dígitos')
    const salt = randomBytes(16).toString('hex')
    await patchPinInSupabase(input.id, hashPin(input.pin, salt), salt)
  }
}

export async function deleteCashOperator(id: string): Promise<void> {
  await getPowerSyncDb().execute(
    'DELETE FROM cash_operators WHERE id = ? AND workspace_id = ?',
    [id, WORKSPACE_ID]
  )
}

// Verifica el PIN de un operador. Requiere conexión: lee pin_hash/pin_salt desde
// Supabase vía RPC (nunca se almacenan en powersync.db local).
// Lanza Error si el operador está bloqueado por exceso de intentos.
export async function verifyOperatorPin(id: string, pin: string): Promise<boolean> {
  const now = Date.now()
  const rec = attempts.get(id)
  if (rec && rec.lockedUntil > now) {
    const secs = Math.ceil((rec.lockedUntil - now) / 1000)
    throw new Error(`Demasiados intentos fallidos. Probá de nuevo en ${secs} s.`)
  }

  const env = readEnvLocal()
  const headers = await supabaseHeaders()

  let pinHash: string | null = null
  let pinSalt: string | null = null

  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/get_operator_pin_material`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_workspace_id: WORKSPACE_ID, p_operator_id: id }),
    })
    if (!res.ok) throw new Error(`RPC error ${res.status}`)
    const rows: Array<{ pin_hash: string; pin_salt: string }> = await res.json()
    pinHash = rows[0]?.pin_hash ?? null
    pinSalt = rows[0]?.pin_salt ?? null
  } catch (e) {
    throw new Error(`No se pudo verificar el PIN: sin conexión o RPC no disponible. (${(e as Error).message})`)
  }

  if (!pinHash || !pinSalt) return false

  const candidate = Buffer.from(hashPin(pin, pinSalt), 'hex')
  const stored = Buffer.from(pinHash, 'hex')
  const ok = candidate.length === stored.length && timingSafeEqual(candidate, stored)

  if (ok) {
    attempts.delete(id)
    return true
  }

  const fails = (rec?.fails ?? 0) + 1
  attempts.set(id, {
    fails,
    lockedUntil: fails >= MAX_ATTEMPTS ? now + LOCKOUT_MS : 0,
  })
  return false
}
