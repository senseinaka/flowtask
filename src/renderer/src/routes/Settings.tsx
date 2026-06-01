import { useState, useEffect } from 'react'
import {
  Cloud, MessageCircle, RefreshCw, Check, AlertCircle,
  Loader2, Plus, Trash2, Save, Eye, EyeOff, ExternalLink, X, Bot, ChevronDown,
  Database, Download
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { SyncStatus, AIOperation, ClaudeModelId, BackupStatus } from '@shared/types'
import {
  CLAUDE_MODELS, AI_OPERATIONS, AI_OPERATION_LABELS,
  AI_OPERATION_DEFAULT_MODELS
} from '@shared/types'
import { useProjects, useCreateProject, useDeleteProject } from '../hooks/useProjects'
import { useAIConfigured, useAIModels, useSaveAIApiKey, useSaveAIModels } from '../hooks/useAI'
import { cn } from '../components/ui/utils'

const PROJECT_COLORS = [
  '#6366f1', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'
]

export default function Settings() {
  const qc = useQueryClient()
  const { data: projects } = useProjects()
  const createProject = useCreateProject()
  const deleteProject = useDeleteProject()

  // Google Drive credentials
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [credentialsSaved, setCredentialsSaved] = useState(false)
  const [oauthError, setOauthError] = useState<string | null>(null)

  // WhatsApp
  const [qrImage, setQrImage] = useState<string | null>(null)
  const [whatsappConnected, setWhatsappConnected] = useState(false)
  const [qrLoading, setQrLoading] = useState(false)
  const [whatsappError, setWhatsappError] = useState<string | null>(null)
  const [wapiUrl, setWapiUrl] = useState('https://evolution-api-production-d7fd.up.railway.app')
  const [wapiKey, setWapiKey] = useState('flowtask-secret')
  const [waConfigSaved, setWaConfigSaved] = useState(false)

  // Backup
  const [backupStatus,  setBackupStatus]  = useState<BackupStatus | null>(null)
  const [backupLoading, setBackupLoading] = useState(false)
  const [backupMsg,     setBackupMsg]     = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [backupReady,   setBackupReady]   = useState(false)

  useEffect(() => {
    window.api.backup.getStatus().then(setBackupStatus)
    window.api.backup.isReady().then(setBackupReady)
  }, [])

  // Notificación cuando el backup automático completa
  useEffect(() => {
    window.api.on('backup:complete', (data) => {
      const status = data as BackupStatus
      setBackupStatus(status)
    })
    return () => window.api.off('backup:complete')
  }, [])

  const handleBackupNow = async () => {
    if (!backupReady) return
    setBackupLoading(true)
    setBackupMsg(null)
    try {
      const result = await window.api.backup.runNow()
      setBackupStatus(result)
      setBackupMsg({ type: 'ok', text: `Backup completado — ${result.driveFolder}` })
      setTimeout(() => setBackupMsg(null), 5000)
    } catch (err) {
      setBackupMsg({ type: 'error', text: err instanceof Error ? err.message : 'Error al hacer backup' })
    } finally {
      setBackupLoading(false)
    }
  }

  // IA / Claude
  const { data: aiConfigured } = useAIConfigured()
  const { data: aiModels }     = useAIModels()
  const saveApiKey             = useSaveAIApiKey()
  const saveModels             = useSaveAIModels()
  const [aiApiKey,    setAiApiKey]    = useState('')
  const [showAiKey,   setShowAiKey]   = useState(false)
  const [aiKeySaved,  setAiKeySaved]  = useState(false)
  const [localModels, setLocalModels] = useState<Record<AIOperation, ClaudeModelId>>(
    { ...AI_OPERATION_DEFAULT_MODELS }
  )

  useEffect(() => {
    if (aiModels) setLocalModels(aiModels as Record<AIOperation, ClaudeModelId>)
  }, [aiModels])

  const handleSaveAiKey = async () => {
    if (!aiApiKey.trim()) return
    await saveApiKey.mutateAsync(aiApiKey.trim())
    setAiApiKey('')
    setAiKeySaved(true)
    setTimeout(() => setAiKeySaved(false), 2500)
  }

  const handleSaveModels = async () => {
    await saveModels.mutateAsync(localModels)
  }

  // Projects
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLORS[0])

  const { data: syncStatus, refetch: refetchStatus } = useQuery<SyncStatus>({
    queryKey: ['sync-status'],
    queryFn: () => window.api.sync.getStatus()
  })

  // Load saved credentials on mount
  useEffect(() => {
    window.api.sync.getGoogleCredentials().then(({ clientId: id, clientSecret: secret }) => {
      if (id) setClientId(id)
      if (secret) setClientSecret(secret)
      if (id && secret) setCredentialsSaved(true)
    })
    window.api.sync.getWhatsappConfig().then(({ url, key }) => {
      setWapiUrl(url)
      setWapiKey(key)
    })
  }, [])

  const saveCredentialsMutation = useMutation({
    mutationFn: () => window.api.sync.saveGoogleCredentials(clientId, clientSecret),
    onSuccess: () => {
      setCredentialsSaved(true)
      setOauthError(null)
      refetchStatus()
    }
  })

  const oauthMutation = useMutation({
    mutationFn: () => window.api.sync.startOAuth(),
    onSuccess: () => {
      setOauthError(null)
      // Poll for auth completion
      const poll = setInterval(() => {
        refetchStatus().then(({ data }) => {
          if (data?.isAuthenticated) clearInterval(poll)
        })
      }, 2000)
      setTimeout(() => clearInterval(poll), 120_000)
    },
    onError: (err: Error) => setOauthError(err.message)
  })

  const syncMutation = useMutation({
    mutationFn: () => window.api.sync.trigger(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sync-status'] })
  })

  const connectWhatsapp = async () => {
    setQrLoading(true)
    setWhatsappError(null)
    try {
      const result = await window.api.sync.connectWhatsapp()
      if (result.connected) {
        setWhatsappConnected(true)
        setQrImage(null)
      } else if (result.qr) {
        setQrImage(result.qr)
      } else {
        setWhatsappError(
          (result as { error?: string }).error
            ?? 'No se pudo conectar. Verificá que el servidor WhatsApp esté corriendo en el puerto configurado.'
        )
      }
    } catch (err) {
      setWhatsappError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setQrLoading(false)
    }
  }

  const saveWhatsappConfig = async () => {
    await window.api.sync.saveWhatsappConfig(wapiUrl, wapiKey)
    setWaConfigSaved(true)
    setTimeout(() => setWaConfigSaved(false), 2000)
  }

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProjectName.trim()) return
    await createProject.mutateAsync({ name: newProjectName.trim(), color: newProjectColor })
    setNewProjectName('')
  }

  const credentialsReady = clientId.trim() && clientSecret.trim()

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 max-w-2xl">
      <h1 className="text-xl font-bold">Configuración</h1>

      {/* Google Drive */}
      <section className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Cloud size={18} className="text-indigo-400" />
          <h2 className="font-semibold">Google Drive</h2>
          {syncStatus?.isAuthenticated && (
            <span className="ml-auto flex items-center gap-1 text-xs text-emerald-400">
              <Check size={12} /> Conectado
            </span>
          )}
        </div>

        {/* Credentials form */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">Credenciales OAuth 2.0</p>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); window.open('https://console.cloud.google.com/apis/credentials') }}
              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <ExternalLink size={11} /> Google Console
            </a>
          </div>

          <div className="bg-slate-900/60 rounded-lg p-3 text-xs text-slate-500 space-y-1">
            <p>1. Creá un proyecto → habilitá <strong className="text-slate-400">Google Drive API</strong></p>
            <p>2. Credenciales → OAuth 2.0 → tipo <strong className="text-slate-400">Desktop app</strong></p>
            <p>3. Copiá el Client ID y Client Secret abajo</p>
          </div>

          <div className="space-y-2">
            <input
              type="text"
              value={clientId}
              onChange={(e) => { setClientId(e.target.value); setCredentialsSaved(false) }}
              placeholder="Client ID  (termina en .apps.googleusercontent.com)"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600"
            />
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={clientSecret}
                onChange={(e) => { setClientSecret(e.target.value); setCredentialsSaved(false) }}
                placeholder="Client Secret"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600"
              />
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <button
            onClick={() => saveCredentialsMutation.mutate()}
            disabled={!credentialsReady || saveCredentialsMutation.isPending}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 text-sm font-medium rounded-lg transition-colors"
          >
            {saveCredentialsMutation.isPending
              ? <Loader2 size={13} className="animate-spin" />
              : credentialsSaved
                ? <Check size={13} className="text-emerald-400" />
                : <Save size={13} />}
            {credentialsSaved ? 'Guardado' : 'Guardar credenciales'}
          </button>
        </div>

        {/* OAuth connection */}
        {credentialsSaved && (
          <div className="border-t border-slate-700 pt-4 space-y-3">
            {oauthError && (
              <div className="flex items-start gap-2 text-xs text-red-400 bg-red-950/40 rounded-lg p-2">
                <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
                {oauthError}
              </div>
            )}

            {!syncStatus?.isAuthenticated ? (
              <div>
                <p className="text-sm text-slate-400 mb-3">
                  Hacé clic para abrir el navegador y autorizá el acceso a Drive.
                </p>
                <button
                  onClick={() => oauthMutation.mutate()}
                  disabled={oauthMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {oauthMutation.isPending
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Cloud size={14} />}
                  {oauthMutation.isPending ? 'Esperando autorización...' : 'Conectar Google Drive'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {syncStatus?.lastSync && (
                  <p className="text-sm text-slate-400">
                    Último backup: {new Date(syncStatus.lastSync).toLocaleString('es-AR')}
                  </p>
                )}
                {syncMutation.data && !syncMutation.data.success && (
                  <p className="text-xs text-red-400">{syncMutation.data.error}</p>
                )}
                <button
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 text-sm font-medium rounded-lg transition-colors"
                >
                  {syncMutation.isPending
                    ? <Loader2 size={14} className="animate-spin" />
                    : <RefreshCw size={14} />}
                  Sincronizar ahora
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* WhatsApp */}
      <section className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <MessageCircle size={18} className="text-emerald-400" />
          <h2 className="font-semibold">WhatsApp</h2>
          {whatsappConnected && (
            <span className="ml-auto flex items-center gap-1 text-xs text-emerald-400">
              <Check size={12} /> Conectado
            </span>
          )}
        </div>

        {/* Evolution API setup */}
        <details className="group">
          <summary className="cursor-pointer text-sm text-slate-400 hover:text-slate-200 transition-colors select-none">
            Instrucciones de instalación (Evolution API)
          </summary>
          <div className="mt-3 bg-slate-900 rounded-lg p-3 text-xs font-mono text-slate-400 space-y-1">
            <p className="text-slate-500 not-italic font-sans"># En PowerShell, ejecutar una sola vez:</p>
            <p>git clone https://github.com/EvolutionAPI/evolution-api C:\Projects\evolution-api</p>
            <p>cd C:\Projects\evolution-api</p>
            <p>copy .env.example .env</p>
            <p className="text-slate-500 not-italic font-sans"># Editar .env: SERVER_PORT=8080, AUTHENTICATION_API_KEY=flowtask-secret</p>
            <p>npm install &amp;&amp; npm run build</p>
            <p>npm install -g pm2</p>
            <p>pm2 start "node dist/main.js" --name evolution-api</p>
            <p>pm2 save &amp;&amp; pm2 startup</p>
          </div>
        </details>

        {/* Connection config */}
        <div className="space-y-2">
          <p className="text-xs text-slate-500">Configuración de conexión</p>
          <input
            type="text"
            value={wapiUrl}
            onChange={(e) => setWapiUrl(e.target.value)}
            placeholder="URL de Evolution API"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <input
            type="text"
            value={wapiKey}
            onChange={(e) => setWapiKey(e.target.value)}
            placeholder="API Key"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button
            onClick={saveWhatsappConfig}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors"
          >
            {waConfigSaved
              ? <Check size={13} className="text-emerald-400" />
              : <Save size={13} />}
            {waConfigSaved ? 'Guardado' : 'Guardar config'}
          </button>
        </div>

        {/* QR / Connect */}
        <div className="border-t border-slate-700 pt-4">
          <button
            onClick={connectWhatsapp}
            disabled={qrLoading || whatsappConnected}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              whatsappConnected
                ? 'bg-emerald-800 text-emerald-300 cursor-default'
                : 'bg-emerald-700 hover:bg-emerald-600 text-white'
            )}
          >
            {qrLoading ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />}
            {whatsappConnected ? 'WhatsApp conectado' : 'Conectar WhatsApp'}
          </button>

          {whatsappError && (
            <div className="mt-3 flex items-start gap-2 text-xs text-red-400 bg-red-950/40 rounded-lg p-2">
              <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
              {whatsappError}
            </div>
          )}

          {qrImage && (
            <div className="mt-4 flex flex-col items-center gap-2">
              <p className="text-sm text-slate-400">Escaneá este QR con tu WhatsApp:</p>
              <img
                src={qrImage.startsWith('data:') ? qrImage : `data:image/png;base64,${qrImage}`}
                alt="QR WhatsApp"
                className="w-52 h-52 rounded-lg border border-slate-600"
              />
              <button
                onClick={connectWhatsapp}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Actualizar QR
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Backup de base de datos */}
      <section className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Database size={18} className="text-cyan-400" />
          <h2 className="font-semibold">Backup de datos</h2>
          {backupStatus?.success && (
            <span className="ml-auto flex items-center gap-1 text-xs text-emerald-400">
              <Check size={12} />
              Último: {new Date(backupStatus.timestamp).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        <div className="space-y-2 text-sm text-slate-400">
          <p>
            La base de datos completa se respalda automáticamente en Google Drive
            cada <strong className="text-slate-300">6 horas</strong> y al <strong className="text-slate-300">cerrar la app</strong>.
          </p>
          <p className="text-xs text-slate-500">
            Ubicación: <span className="font-mono text-slate-400">Google Drive → FlowTask Backups → [fecha]/ → flowtask.db</span>
          </p>
          <p className="text-xs text-slate-500">
            Incluye toda la información del sistema: tareas, importaciones, despachos, costos, contactos, proveedores, etc.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleBackupNow}
            disabled={backupLoading || !backupReady}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              backupReady
                ? 'bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            )}
          >
            {backupLoading
              ? <><Loader2 size={14} className="animate-spin" /> Haciendo backup...</>
              : <><Download size={14} /> Hacer backup ahora</>
            }
          </button>

          {!backupReady && (
            <p className="text-xs text-amber-500">
              Conectá Google Drive en la sección de arriba para habilitar los backups.
            </p>
          )}

          {backupMsg && (
            <p className={cn('text-xs', backupMsg.type === 'ok' ? 'text-emerald-400' : 'text-red-400')}>
              {backupMsg.type === 'ok' ? '✓' : '✗'} {backupMsg.text}
            </p>
          )}
        </div>

        {backupStatus && !backupStatus.success && backupStatus.error && (
          <div className="flex items-center gap-2 text-xs text-red-400 bg-red-900/20 rounded-lg px-3 py-2">
            <AlertCircle size={12} />
            Último backup falló: {backupStatus.error}
          </div>
        )}
      </section>

      {/* IA / Claude */}
      <section className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-violet-400" />
          <h2 className="font-semibold">Inteligencia Artificial (Claude)</h2>
          {aiConfigured && (
            <span className="ml-auto flex items-center gap-1 text-xs text-emerald-400">
              <Check size={12} /> Configurado
            </span>
          )}
        </div>

        {/* API Key */}
        <div className="space-y-2">
          <label className="text-sm text-slate-300">API Key de Anthropic</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showAiKey ? 'text' : 'password'}
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAiKey() }}
                placeholder={aiConfigured ? 'sk-ant-... (escribí nueva para reemplazar)' : 'sk-ant-api03-...'}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 pr-9 placeholder-slate-600"
              />
              <button
                type="button"
                onClick={() => setShowAiKey(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showAiKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <button
              onClick={handleSaveAiKey}
              disabled={!aiApiKey.trim() || saveApiKey.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 transition-colors"
            >
              {saveApiKey.isPending ? <Loader2 size={14} className="animate-spin" /> :
               aiKeySaved ? <Check size={14} /> : <Save size={14} />}
              {aiKeySaved ? 'Guardado' : 'Guardar'}
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Obtené tu key en{' '}
            <button
              onClick={() => window.api.shell.open('https://console.anthropic.com/api-keys')}
              className="text-violet-400 hover:underline inline-flex items-center gap-0.5"
            >
              console.anthropic.com <ExternalLink size={10} />
            </button>
          </p>
        </div>

        {/* Modelo por operación */}
        <div className="space-y-3 pt-1 border-t border-slate-700">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-300">Modelo por tipo de operación</p>
            <button
              onClick={handleSaveModels}
              disabled={saveModels.isPending}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
            >
              {saveModels.isPending
                ? <Loader2 size={12} className="animate-spin" />
                : <Save size={12} />}
              Guardar modelos
            </button>
          </div>

          <div className="space-y-2">
            {(AI_OPERATIONS as readonly AIOperation[]).map(op => (
              <div key={op} className="flex items-center justify-between gap-3">
                <label className="text-xs text-slate-400 flex-1">{AI_OPERATION_LABELS[op]}</label>
                <div className="relative">
                  <select
                    value={localModels[op] ?? AI_OPERATION_DEFAULT_MODELS[op]}
                    onChange={e => setLocalModels(prev => ({
                      ...prev,
                      [op]: e.target.value as ClaudeModelId
                    }))}
                    className="appearance-none bg-slate-900 border border-slate-600 rounded-lg pl-3 pr-7 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500 cursor-pointer"
                  >
                    {CLAUDE_MODELS.map(m => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-slate-900/50 border border-slate-700/50 p-3 space-y-1">
            <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">Referencia de modelos</p>
            <p className="text-[11px] text-slate-500">
              <span className="text-slate-400">Haiku 4.5</span> — Rápido y económico. Ideal para facturas simples y tareas de extracción sencillas.
            </p>
            <p className="text-[11px] text-slate-500">
              <span className="text-slate-400">Sonnet 4.5</span> — Balanceado. Recomendado para despachos y análisis complejos.
            </p>
            <p className="text-[11px] text-slate-500">
              <span className="text-slate-400">Opus 4.5</span> — Máxima capacidad. Para documentos muy complejos o ambiguos.
            </p>
          </div>
        </div>
      </section>

      {/* Projects */}
      <section className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <h2 className="font-semibold mb-4">Proyectos</h2>

        <form onSubmit={handleCreateProject} className="flex gap-2 mb-4">
          <div className="flex gap-1">
            {PROJECT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setNewProjectColor(color)}
                className={cn(
                  'w-5 h-5 rounded-full transition-transform',
                  newProjectColor === color ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-800' : ''
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <input
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Nombre del proyecto..."
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!newProjectName.trim() || createProject.isPending}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
          >
            <Plus size={16} />
          </button>
        </form>

        <div className="space-y-2">
          {projects?.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-3 py-2 bg-slate-700 rounded-lg">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
              <span className="flex-1 text-sm">{p.name}</span>
              <button
                onClick={() => deleteProject.mutate(p.id)}
                className="text-slate-500 hover:text-red-400 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {(!projects || projects.length === 0) && (
            <p className="text-sm text-slate-500">Sin proyectos creados todavía.</p>
          )}
        </div>
      </section>
    </div>
  )
}
