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
  return session
}

export async function login(email: string, password: string): Promise<AuthLoginResult> {
  const env = readEnvLocal()
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return { ok: false, error: 'Supabase no está configurado (.env.local)' }
  }

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
