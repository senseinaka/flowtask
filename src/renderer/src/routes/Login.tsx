import { useEffect, useState, type FormEvent } from 'react'
import { Loader2, LogIn, User, Lock } from 'lucide-react'
import type { AuthSession } from '@shared/types'
import { Input, Button, Card } from '../components/ui'

interface LoginProps {
  onSuccess: (session: AuthSession) => void
}

export default function Login({ onSuccess }: LoginProps) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [version, setVersion] = useState('')

  useEffect(() => {
    window.api.app.getVersion().then(setVersion).catch(() => {})
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = await window.api.auth.login(identifier, password)
      if (!result.ok || !result.session) {
        setError(result.error || 'Error al iniciar sesión')
        return
      }
      onSuccess(result.session)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-app)',
        color: 'var(--text-body)',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 360,
          animation: 'scaleIn .2s var(--ease-out)',
        }}
      >
        <Card
          padding="var(--space-8)"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            boxShadow: 'var(--shadow-2xl)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 4 }}>
            <span style={{ display: 'inline-flex', marginBottom: 12 }}>
              <svg width="52" height="52" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <rect width="48" height="48" rx="12" fill="#0f1826" />
                <rect x="9" y="29" width="8" height="11" rx="2.5" fill="#4b566a" />
                <rect x="19" y="20" width="8" height="20" rx="2.5" fill="#0e88b6" />
                <rect x="29" y="11" width="8" height="29" rx="2.5" fill="#2bd0ef" />
              </svg>
            </span>
            <h1 style={{ margin: 0, display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6, fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-strong)' }}>
              Summit
              {version && (
                <span style={{ fontSize: 'var(--text-11)', fontWeight: 500, color: 'var(--text-muted)' }}>
                  v{version}
                </span>
              )}
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              Iniciá sesión para continuar
            </p>
          </div>

          <Input
            label="Email o usuario"
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="tu@email.com o usuario"
            icon={User}
            autoFocus
            required
          />

          <Input
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            icon={Lock}
            required
          />

          {error && (
            <div
              style={{
                fontSize: 'var(--text-11)',
                color: 'var(--danger-400)',
                background: 'color-mix(in srgb, var(--danger) 15%, var(--slate-900))',
                border: '1px solid color-mix(in srgb, var(--danger) 45%, transparent)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-3)',
              }}
            >
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            disabled={loading}
            icon={loading ? Loader2 : LogIn}
            style={{ marginTop: 6 }}
          >
            {loading ? 'Ingresando…' : 'Ingresar'}
          </Button>

          <p style={{ margin: 0, textAlign: 'center', fontSize: 'var(--text-11)', color: 'var(--text-ghost)' }}>
            Naka Group - Matrix · sistema operativo interno
          </p>
        </Card>
      </form>
    </div>
  )
}
