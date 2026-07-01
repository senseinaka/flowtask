// ═══════════════════════════════════════════════════════════════════════════
// Fase 6.3 — Autenticación (Supabase Auth)
// ═══════════════════════════════════════════════════════════════════════════
//
// Login con email/contraseña contra Supabase Auth (grant_type=password), con
// refresh automático del access token cuando está cerca de expirar. La
// sesión se persiste con ConfigStore (archivo JSON en userData), igual que
// finance-security — así el usuario no tiene que loguearse de nuevo en cada
// arranque mientras el refresh token siga vigente.

import ConfigStore from './config-store'
import { readEnvLocal } from '../database/powersync'
import { upsertUserProfile } from '../database/queries/permissions'
import type { AuthSession, AuthLoginResult } from '@shared/types'

const store = new ConfigStore('auth')
const KEY_SESSION = 'session'

// Margen de seguridad: si el access token expira dentro de este umbral,
// se refresca antes de devolverlo.
const REFRESH_MARGIN_SECONDS = 60

interface SupabaseTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  user: { id: string; email: string }
}

function saveSession(data: SupabaseTokenResponse): AuthSession {
  const session: AuthSession = {
    userId: data.user.id,
    email: data.user.email,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Math.floor(Date.now() / 1000) + data.expires_in
  }
  store.set(KEY_SESSION, session)
  try {
    const namePart = data.user.email.split('@')[0]
    upsertUserProfile({
      id: data.user.id,
      email: data.user.email,
      display_name: namePart
    })
  } catch {
    // La tabla puede no existir todavía si la migración v81 aún no corrió
  }
  return session
}

/**
 * Resuelve "usuario" -> email vía RPC de Supabase (público, no requiere sesión —
 * necesario porque el primer login en un equipo nuevo no tiene nada sincronizado
 * localmente todavía). Devuelve null ante cualquier fallo (usuario inexistente,
 * sin red, etc.) — el caller sigue de largo con el texto original como si fuera
 * el email, así "usuario no existe" y "contraseña incorrecta" dan el mismo error
 * genérico y no se puede enumerar usuarios por el mensaje.
 */
async function resolveUsernameToEmail(
  username: string,
  env: { SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string }
): Promise<string | null> {
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/resolve_username_email`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_ANON_KEY!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_username: username })
    })
    if (!res.ok) return null
    const data = await res.json()
    return typeof data === 'string' && data ? data : null
  } catch {
    return null
  }
}

export async function login(identifier: string, password: string): Promise<AuthLoginResult> {
  const env = readEnvLocal()
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return { ok: false, error: 'Supabase no está configurado (.env.local)' }
  }

  const trimmed = identifier.trim()
  const email = trimmed.includes('@') ? trimmed : (await resolveUsernameToEmail(trimmed, env)) ?? trimmed

  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  })

  const data = await res.json()
  if (!res.ok) {
    return { ok: false, error: data.error_description || data.msg || 'Credenciales inválidas' }
  }

  return { ok: true, session: saveSession(data) }
}

export function logout(): void {
  store.delete(KEY_SESSION)
}

/** Devuelve la sesión activa, refrescándola primero si está cerca de expirar. */
export async function getSession(): Promise<AuthSession | null> {
  const session = store.get<AuthSession | null>(KEY_SESSION, null)
  if (!session) return null

  const now = Math.floor(Date.now() / 1000)
  if (session.expiresAt - now > REFRESH_MARGIN_SECONDS) return session

  return refreshSession()
}

/**
 * Identidad del actor para auditoría/propiedad (created_by, closed_by, etc.).
 * SIEMPRE se deriva de la sesión activa en el proceso main — nunca se confía en
 * un userId enviado por el renderer, que es spoofable desde un renderer
 * comprometido. Fail-closed: lanza si no hay sesión.
 */
export async function requireActorId(): Promise<string> {
  const session = await getSession()
  if (!session) throw new Error('No autenticado')
  return session.userId
}

/** Si el refresh falla (token revocado/expirado), borra la sesión y devuelve null. */
export async function refreshSession(): Promise<AuthSession | null> {
  const session = store.get<AuthSession | null>(KEY_SESSION, null)
  if (!session) return null

  const env = readEnvLocal()
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ refresh_token: session.refreshToken })
  })

  if (!res.ok) {
    store.delete(KEY_SESSION)
    return null
  }

  return saveSession(await res.json())
}
