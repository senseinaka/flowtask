import { useState, useEffect } from 'react'
import {
  Cloud, MessageCircle, RefreshCw, Check, AlertCircle, AlertTriangle,
  Loader2, Plus, Trash2, Save, Eye, EyeOff, ExternalLink, X, Bot, ChevronDown,
  Database, Download, Sparkles, User, Phone, Mail, FileText,
  HardDrive, FolderOpen, FolderCog, Clock, ArchiveRestore, RotateCcw, Info
} from 'lucide-react'
import PromptEditor from '../components/prompts/PromptEditor'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { SyncStatus, AIOperation, ClaudeModelId, BackupStatus, LocalBackupStatus, LocalBackupEntry, UpdateCheckResult, UpdateDownloadProgress } from '@shared/types'
import {
  CLAUDE_MODELS, AI_OPERATIONS, AI_OPERATION_LABELS,
  AI_OPERATION_DEFAULT_MODELS
} from '@shared/types'
import PermissionsAdmin from '../components/settings/PermissionsAdmin'
import CalendarSettingsSection from '../components/settings/CalendarSettingsSection'
import { useProjects, useCreateProject, useDeleteProject } from '../hooks/useProjects'
import { useAIConfigured, useAIModels, useSaveAIApiKey, useSaveAIModels } from '../hooks/useAI'
import { usePersonalContact, useSavePersonalContact } from '../hooks/useSettings'
import { cn } from '../components/ui/utils'
import { ADMIN_USER_ID } from '@shared/modules'

const PROJECT_COLORS = [
  '#6366f1', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'
]

const SETTINGS_TABS = [
  { key: 'general',   label: 'General',                  adminOnly: false },
  { key: 'sync',      label: 'Sincronización',           adminOnly: false },
  { key: 'ia',        label: 'Inteligencia Artificial',  adminOnly: false },
  { key: 'permisos',  label: 'Permisos',                  adminOnly: true }
] as const

type SettingsTab = typeof SETTINGS_TABS[number]['key']

export default function Settings() {
  const qc = useQueryClient()
  const { data: projects } = useProjects()
  const createProject = useCreateProject()
  const deleteProject = useDeleteProject()

  const [activeTab, setActiveTab] = useState<SettingsTab>('general')

  const { data: session } = useQuery({
    queryKey: ['auth', 'session'],
    queryFn: () => window.api.auth.getSession()
  })
  const isAdmin = session?.userId === ADMIN_USER_ID

  // Versión de la app + chequeo de actualizaciones
  const [appVersion, setAppVersion] = useState<string | null>(null)
  const [updateChecking, setUpdateChecking] = useState(false)
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null)
  const [updateDownloading, setUpdateDownloading] = useState(false)
  const [updateProgress, setUpdateProgress] = useState<UpdateDownloadProgress | null>(null)
  const [updateDownloaded, setUpdateDownloaded] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)

  useEffect(() => {
    window.api.app.getVersion().then(setAppVersion)
  }, [])

  useEffect(() => {
    const unsubProgress = window.api.app.onUpdateProgress((progress) => {
      setUpdateProgress(progress)
    })
    const unsubDownloaded = window.api.app.onUpdateDownloaded(() => {
      setUpdateDownloading(false)
      setUpdateDownloaded(true)
    })
    const unsubError = window.api.app.onUpdateError((message) => {
      setUpdateDownloading(false)
      setUpdateError(message)
    })
    return () => {
      unsubProgress()
      unsubDownloaded()
      unsubError()
    }
  }, [])

  const handleCheckForUpdates = async () => {
    setUpdateChecking(true)
    setUpdateResult(null)
    setUpdateError(null)
    setUpdateDownloaded(false)
    setUpdateProgress(null)
    try {
      const result = await window.api.app.checkForUpdates()
      setUpdateResult(result)
    } finally {
      setUpdateChecking(false)
    }
  }

  const handleDownloadUpdate = async () => {
    setUpdateError(null)
    setUpdateDownloading(true)
    setUpdateProgress(null)
    try {
      await window.api.app.downloadUpdate()
    } catch (err) {
      setUpdateDownloading(false)
      setUpdateError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleInstallUpdate = () => {
    window.api.app.installUpdate()
  }

  const formatBytes = (bytes: number): string => `${(bytes / (1024 * 1024)).toFixed(1)} MB`

  // Google Drive credentials
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [credentialsSaved, setCredentialsSaved] = useState(false)
  const [oauthError, setOauthError] = useState<string | null>(null)

  // Estado real de la conexión Drive (verificado con la API)
  const [driveVerified,     setDriveVerified]     = useState<boolean | null>(null)  // null = no verificado
  const [driveVerifyError,  setDriveVerifyError]   = useState<string | null>(null)
  const [driveVerifying,    setDriveVerifying]     = useState(false)
  const [driveDisconnecting, setDriveDisconnecting] = useState(false)

  const verifyDrive = async () => {
    setDriveVerifying(true)
    setDriveVerifyError(null)
    try {
      const result = await window.api.sync.testDriveConnection()
      setDriveVerified(result.ok)
      if (!result.ok) setDriveVerifyError(result.error ?? 'Error desconocido')
      refetchStatus()
    } finally { setDriveVerifying(false) }
  }

  const reconnectDrive = async () => {
    setDriveDisconnecting(true)
    try {
      await window.api.sync.disconnectDrive()
      setDriveVerified(null)
      setDriveVerifyError(null)
      refetchStatus()
    } finally { setDriveDisconnecting(false) }
  }

  // WhatsApp
  const [qrImage, setQrImage] = useState<string | null>(null)
  const [whatsappConnected, setWhatsappConnected] = useState(false)
  const [qrLoading, setQrLoading] = useState(false)
  const [whatsappError, setWhatsappError] = useState<string | null>(null)
  const [wapiUrl, setWapiUrl] = useState('https://evolution-api-production-d7fd.up.railway.app')
  const [wapiKey, setWapiKey] = useState('flowtask-secret')
  const [waConfigSaved, setWaConfigSaved] = useState(false)

  // Mis datos personales (para recibir notificaciones propias)
  const { data: personalContact } = usePersonalContact()
  const savePersonalContact = useSavePersonalContact()
  const [personalName,  setPersonalName]  = useState('')
  const [personalWa,    setPersonalWa]    = useState('')
  const [personalEmail, setPersonalEmail] = useState('')
  const [personalOther, setPersonalOther] = useState('')
  const [personalSaved, setPersonalSaved] = useState(false)

  useEffect(() => {
    if (!personalContact) return
    setPersonalName(personalContact.name)
    setPersonalWa(personalContact.whatsapp_number)
    setPersonalEmail(personalContact.email)
    setPersonalOther(personalContact.other)
  }, [personalContact])

  const handleSavePersonalContact = async () => {
    await savePersonalContact.mutateAsync({
      name:            personalName.trim(),
      whatsapp_number: personalWa.trim(),
      email:           personalEmail.trim(),
      other:           personalOther.trim(),
    })
    setPersonalSaved(true)
    setTimeout(() => setPersonalSaved(false), 2000)
  }

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

  // Backup local — red de seguridad independiente de Drive (corre siempre,
  // sin depender de ninguna cuenta ni conexión a internet).
  const [localBackupStatus,  setLocalBackupStatus]  = useState<LocalBackupStatus | null>(null)
  const [localBackupLoading, setLocalBackupLoading] = useState(false)
  const [localBackupMsg,     setLocalBackupMsg]     = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [localBackupDir,     setLocalBackupDir]     = useState('')
  const [choosingDir,        setChoosingDir]        = useState(false)

  // Frecuencia configurable del backup automático (en horas; 0 = solo manual)
  const [backupIntervalHours, setBackupIntervalHoursState] = useState<number | null>(null)
  const [savingInterval,      setSavingInterval]           = useState(false)

  // Restaurar una copia anterior
  const [showRestorePanel,  setShowRestorePanel]  = useState(false)
  const [backupList,        setBackupList]        = useState<LocalBackupEntry[]>([])
  const [loadingBackupList, setLoadingBackupList] = useState(false)
  const [restoringFolder,   setRestoringFolder]   = useState<string | null>(null)
  const [confirmRestore,    setConfirmRestore]    = useState<string | null>(null)
  const [restoreMsg,        setRestoreMsg]        = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    window.api.backup.local.getStatus().then(setLocalBackupStatus)
    window.api.backup.local.getDir().then(setLocalBackupDir)
    window.api.backup.local.getInterval().then(setBackupIntervalHoursState)
  }, [])

  const handleChangeInterval = async (hours: number) => {
    setSavingInterval(true)
    try {
      await window.api.backup.local.setInterval(hours)
      setBackupIntervalHoursState(hours)
    } finally {
      setSavingInterval(false)
    }
  }

  const loadBackupList = async () => {
    setLoadingBackupList(true)
    try {
      const list = await window.api.backup.local.list()
      setBackupList(list)
    } finally {
      setLoadingBackupList(false)
    }
  }

  const handleToggleRestorePanel = () => {
    const next = !showRestorePanel
    setShowRestorePanel(next)
    setConfirmRestore(null)
    setRestoreMsg(null)
    if (next) loadBackupList()
  }

  const handleRestore = async (folder: string) => {
    setRestoringFolder(folder)
    setRestoreMsg(null)
    try {
      const result = await window.api.backup.local.restore(folder)
      if (result.success) {
        setRestoreMsg({ type: 'ok', text: 'Restauración aplicada — la app se va a reiniciar en unos segundos...' })
      } else {
        setRestoreMsg({ type: 'error', text: result.error ?? 'No se pudo restaurar esa copia' })
        setRestoringFolder(null)
      }
    } catch (err) {
      setRestoreMsg({ type: 'error', text: err instanceof Error ? err.message : 'No se pudo restaurar esa copia' })
      setRestoringFolder(null)
    } finally {
      setConfirmRestore(null)
    }
  }

  // Notificación cuando el backup local automático completa (cada 6hs / al cerrar)
  useEffect(() => {
    window.api.on('backup:local:complete', (data) => {
      setLocalBackupStatus(data as LocalBackupStatus)
    })
    return () => window.api.off('backup:local:complete')
  }, [])

  const handleLocalBackupNow = async () => {
    setLocalBackupLoading(true)
    setLocalBackupMsg(null)
    try {
      const result = await window.api.backup.local.runNow()
      setLocalBackupStatus(result)
      setLocalBackupMsg(
        result.success
          ? { type: 'ok', text: `Copia local creada — ${result.sizeMB} MB` }
          : { type: 'error', text: result.error ?? 'Error al hacer el backup local' }
      )
      setTimeout(() => setLocalBackupMsg(null), 5000)
    } catch (err) {
      setLocalBackupMsg({ type: 'error', text: err instanceof Error ? err.message : 'Error al hacer el backup local' })
    } finally {
      setLocalBackupLoading(false)
    }
  }

  const handleChooseBackupDir = async () => {
    setChoosingDir(true)
    try {
      const dir = await window.api.backup.local.chooseDir()
      if (dir) setLocalBackupDir(dir)
    } finally {
      setChoosingDir(false)
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

  // Verificar conexión Drive al cargar Settings (después de tener syncStatus)
  useEffect(() => {
    if (syncStatus?.isAuthenticated) verifyDrive()
  }, [syncStatus?.isAuthenticated])  // eslint-disable-line react-hooks/exhaustive-deps

  // Escuchar evento de sesión vencida desde el main process
  useEffect(() => {
    window.api.on('drive:sessionExpired', (data) => {
      const d = data as { error: string }
      setDriveVerified(false)
      setDriveVerifyError(d.error)
      refetchStatus()
    })
    return () => window.api.off('drive:sessionExpired')
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

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

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-700 -mt-2">
        {SETTINGS_TABS.filter((tab) => !tab.adminOnly || isAdmin).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              activeTab === tab.key
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'general' && (
      <>
      {/* Mis datos personales */}
      <section className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <User size={18} className="text-amber-400" />
          <h2 className="font-semibold">Mis datos personales</h2>
        </div>
        <p className="text-xs text-slate-500 -mt-2">
          Guardá tu WhatsApp, email y otros datos de contacto. Así podés elegir que las
          notificaciones y recordatorios (por ejemplo, los de Vencimientos) te lleguen a vos
          mismo en lugar de a otra persona.
        </p>

        <div className="space-y-2">
          <div className="relative">
            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={personalName}
              onChange={(e) => setPersonalName(e.target.value)}
              placeholder="Tu nombre"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div className="relative">
            <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={personalWa}
              onChange={(e) => setPersonalWa(e.target.value)}
              placeholder="Tu WhatsApp (ej: +5491122334455)"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div className="relative">
            <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="email"
              value={personalEmail}
              onChange={(e) => setPersonalEmail(e.target.value)}
              placeholder="Tu email"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div className="relative">
            <FileText size={14} className="absolute left-3 top-3 text-slate-500" />
            <textarea
              value={personalOther}
              onChange={(e) => setPersonalOther(e.target.value)}
              placeholder="Otros datos de contacto (opcional)"
              rows={2}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none"
            />
          </div>
          <button
            onClick={handleSavePersonalContact}
            disabled={savePersonalContact.isPending}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 text-sm rounded-lg transition-colors"
          >
            {personalSaved
              ? <Check size={13} className="text-emerald-400" />
              : savePersonalContact.isPending
                ? <Loader2 size={13} className="animate-spin" />
                : <Save size={13} />}
            {personalSaved ? 'Guardado' : 'Guardar mis datos'}
          </button>
        </div>
      </section>
      </>
      )}

      {activeTab === 'sync' && (
      <>
      {/* Google Drive */}
      <section className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Cloud size={18} className="text-indigo-400" />
          <h2 className="font-semibold">Google Drive</h2>
          <div className="ml-auto flex items-center gap-2">
            {syncStatus?.isAuthenticated && driveVerified === true && (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <Check size={12} /> Conectado
              </span>
            )}
            {syncStatus?.isAuthenticated && driveVerified === false && (
              <span className="flex items-center gap-1 text-xs text-red-400">
                <AlertCircle size={12} /> Sesión vencida
              </span>
            )}
            {syncStatus?.isAuthenticated && driveVerified === null && driveVerifying && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Loader2 size={12} className="animate-spin" /> Verificando...
              </span>
            )}
          </div>
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
                {/* Alerta sesión vencida */}
                {driveVerified === false && (
                  <div className="flex items-start gap-2 bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2.5">
                    <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-red-300">Sesión de Drive vencida</p>
                      <p className="text-xs text-red-400 mt-0.5">
                        {driveVerifyError === 'invalid_grant'
                          ? 'El token de acceso venció. Reconectá para seguir usando Drive.'
                          : driveVerifyError}
                      </p>
                    </div>
                  </div>
                )}

                {syncStatus?.lastSync && (
                  <p className="text-sm text-slate-400">
                    Último backup: {new Date(syncStatus.lastSync).toLocaleString('es-AR')}
                  </p>
                )}
                {syncMutation.data && !syncMutation.data.success && (
                  <p className="text-xs text-red-400">{syncMutation.data.error}</p>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Reconectar — aparece cuando la sesión venció */}
                  {(driveVerified === false || driveVerified === null) && (
                    <button
                      onClick={async () => { await reconnectDrive(); oauthMutation.mutate() }}
                      disabled={driveDisconnecting || oauthMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      {driveDisconnecting || oauthMutation.isPending
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Cloud size={14} />}
                      Reconectar Drive
                    </button>
                  )}

                  {/* Verificar conexión */}
                  <button
                    onClick={verifyDrive}
                    disabled={driveVerifying}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 text-sm rounded-lg transition-colors"
                  >
                    {driveVerifying ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    {driveVerifying ? 'Verificando...' : 'Verificar conexión'}
                  </button>

                  {driveVerified === true && (
                    <button
                      onClick={() => syncMutation.mutate()}
                      disabled={syncMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 text-sm font-medium rounded-lg transition-colors"
                    >
                      {syncMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                      Sincronizar ahora
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Calendario / Agenda */}
      <CalendarSettingsSection />

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

      {/* Backup local — red de seguridad, no depende de Drive */}
      <section className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <HardDrive size={18} className="text-amber-400" />
          <h2 className="font-semibold">Backup local</h2>
          {localBackupStatus?.success && (
            <span className="ml-auto flex items-center gap-1 text-xs text-emerald-400">
              <Check size={12} />
              Último: {new Date(localBackupStatus.timestamp).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        <div className="space-y-2 text-sm text-slate-400">
          <p>
            Copia completa (base de datos + un espejo incremental de adjuntos) a una carpeta de tu disco,
            {' '}<strong className="text-slate-300">
              {backupIntervalHours === null ? '...' :
               backupIntervalHours === 0 ? 'solo cuando vos lo pidas' :
               backupIntervalHours === 24 ? 'una vez al día' :
               `cada ${backupIntervalHours} horas`}
            </strong> y al <strong className="text-slate-300">cerrar la app</strong> —
            {' '}<strong className="text-slate-300">no depende de ninguna cuenta ni conexión a internet</strong>.
            Es la red de seguridad mínima para que nunca vuelva a pasar lo de los vencimientos: pase lo
            que pase con Drive, siempre va a quedar al menos esta copia reciente, y vas a poder restaurarla
            vos mismo desde acá.
          </p>
          <p className="text-xs text-slate-500">
            Los adjuntos (facturas, PDFs) se guardan en una carpeta compartida que solo crece — cada copia
            agrega los archivos nuevos sin duplicar los que ya estaban, así no se ocupa espacio de más.
            Tip: si elegís una carpeta sincronizada (OneDrive, Google Drive, Dropbox), el backup además
            queda replicado en la nube automáticamente, sin nada extra de tu parte.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[220px] flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-xs font-mono text-slate-400 overflow-hidden">
            <FolderOpen size={13} className="shrink-0 text-slate-500" />
            <span className="truncate" title={localBackupDir}>{localBackupDir || '—'}</span>
          </div>
          <button
            onClick={handleChooseBackupDir}
            disabled={choosingDir}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors disabled:opacity-50"
          >
            {choosingDir ? <Loader2 size={13} className="animate-spin" /> : <FolderCog size={13} />}
            Elegir carpeta...
          </button>
          <button
            onClick={() => window.api.backup.local.openDir()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
          >
            <ExternalLink size={13} />
            Abrir carpeta
          </button>
        </div>

        {/* Frecuencia del backup automático */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-slate-500 mr-1">
            <Clock size={13} />
            Repetir:
          </span>
          {([
            { hours: 6,  label: 'Cada 6 horas' },
            { hours: 12, label: 'Cada 12 horas' },
            { hours: 24, label: '1 vez al día' },
            { hours: 0,  label: 'Solo manual' }
          ] as const).map(opt => (
            <button
              key={opt.hours}
              onClick={() => handleChangeInterval(opt.hours)}
              disabled={savingInterval || backupIntervalHours === null}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50',
                backupIntervalHours === opt.hours
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
              )}
            >
              {opt.label}
            </button>
          ))}
          {savingInterval && <Loader2 size={13} className="animate-spin text-slate-500" />}
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleLocalBackupNow}
            disabled={localBackupLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-50"
          >
            {localBackupLoading
              ? <><Loader2 size={14} className="animate-spin" /> Haciendo backup local...</>
              : <><Download size={14} /> Hacer backup local ahora</>
            }
          </button>

          {localBackupMsg && (
            <p className={cn('text-xs', localBackupMsg.type === 'ok' ? 'text-emerald-400' : 'text-red-400')}>
              {localBackupMsg.type === 'ok' ? '✓' : '✗'} {localBackupMsg.text}
            </p>
          )}
        </div>

        {localBackupStatus?.success && localBackupStatus.folder && (
          <p className="text-xs text-slate-500">
            Última copia: <span className="font-mono text-slate-400">{localBackupStatus.folder}</span>
            {localBackupStatus.sizeMB && <> · {localBackupStatus.sizeMB} MB</>}
          </p>
        )}

        {localBackupStatus && !localBackupStatus.success && localBackupStatus.error && (
          <div className="flex items-center gap-2 text-xs text-red-400 bg-red-900/20 rounded-lg px-3 py-2">
            <AlertCircle size={12} />
            Último backup local falló: {localBackupStatus.error}
          </div>
        )}

        {/* ── Restaurar una copia anterior ──────────────────────────────── */}
        <div className="pt-2 border-t border-slate-700/60">
          <button
            onClick={handleToggleRestorePanel}
            className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            <ArchiveRestore size={15} className="text-amber-400" />
            Restaurar una copia anterior
            <ChevronDown size={14} className={cn('transition-transform text-slate-500', showRestorePanel && 'rotate-180')} />
          </button>

          {showRestorePanel && (
            <div className="mt-3 space-y-3">
              <div className="flex items-start gap-2 text-xs text-amber-300/90 bg-amber-900/20 border border-amber-800/40 rounded-lg px-3 py-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>
                  Restaurar reemplaza la base de datos en uso por la de la copia elegida y{' '}
                  <strong>reinicia la app</strong>. Antes de tocar nada, se guarda automáticamente una
                  copia de seguridad del estado actual — así que esto siempre se puede deshacer
                  restaurando esa copia "antes de restaurar" si te arrepentís.
                </span>
              </div>

              {loadingBackupList ? (
                <div className="flex items-center gap-2 text-xs text-slate-500 px-1 py-2">
                  <Loader2 size={13} className="animate-spin" /> Buscando copias disponibles...
                </div>
              ) : backupList.length === 0 ? (
                <p className="text-xs text-slate-500 px-1 py-2">
                  Todavía no hay copias locales en esta carpeta. Se va a crear la primera automáticamente
                  (a los 2 minutos de abrir la app, o con "Hacer backup local ahora" más arriba).
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {backupList.map(entry => (
                    <li
                      key={entry.folder}
                      className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700"
                    >
                      <span className="text-xs font-mono text-slate-300">
                        {new Date(entry.timestamp).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {entry.totalSizeMB && (
                        <span className="text-xs text-slate-500">· {entry.totalSizeMB} MB</span>
                      )}
                      <span className="text-xs text-slate-600 font-mono truncate" title={entry.path}>{entry.folder}</span>

                      <div className="ml-auto flex items-center gap-2">
                        {confirmRestore === entry.folder ? (
                          <>
                            <span className="text-xs text-amber-300">¿Restaurar y reiniciar la app?</span>
                            <button
                              onClick={() => handleRestore(entry.folder)}
                              disabled={restoringFolder !== null}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-50"
                            >
                              {restoringFolder === entry.folder
                                ? <><Loader2 size={12} className="animate-spin" /> Restaurando...</>
                                : <>Sí, restaurar</>
                              }
                            </button>
                            <button
                              onClick={() => setConfirmRestore(null)}
                              disabled={restoringFolder !== null}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors disabled:opacity-50"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmRestore(entry.folder)}
                            disabled={restoringFolder !== null}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors disabled:opacity-50"
                          >
                            <RotateCcw size={12} />
                            Restaurar esta copia
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {restoreMsg && (
                <p className={cn('text-xs flex items-center gap-1.5', restoreMsg.type === 'ok' ? 'text-emerald-400' : 'text-red-400')}>
                  {restoreMsg.type === 'ok' ? <Check size={13} /> : <AlertCircle size={13} />}
                  {restoreMsg.text}
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      </>
      )}

      {activeTab === 'ia' && (
      <>
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

      {/* Prompts de IA */}
      <section className="bg-slate-800 rounded-xl border border-violet-800/30 p-5 space-y-4" style={{ minHeight: '520px' }}>
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-violet-400" />
          <h2 className="font-semibold">Prompts de IA</h2>
          <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-violet-900/40 border border-violet-700/40 text-violet-400">
            Editor de prompts
          </span>
        </div>
        <p className="text-xs text-slate-500">
          Personalizá el system prompt que Claude recibe en cada tipo de análisis.
          Los cambios aplican inmediatamente. En modo dev podés escribirlos al código fuente permanentemente.
        </p>
        <div className="flex-1">
          <PromptEditor />
        </div>
      </section>

      </>
      )}

      {activeTab === 'general' && (
      <>
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

      </>
      )}

      {activeTab === 'permisos' && (
      <>
      {/* Administración de permisos (solo admin) */}
      <PermissionsAdmin />
      </>
      )}

      {activeTab === 'general' && (
      <>
      {/* Acerca de / Actualizaciones */}
      <section className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Info size={18} className="text-sky-400" />
          <h2 className="font-semibold">Acerca de Summit</h2>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">
            Versión instalada: <span className="text-slate-200 font-mono">{appVersion ?? '...'}</span>
          </p>
          <button
            onClick={handleCheckForUpdates}
            disabled={updateChecking}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-sm rounded-lg transition-colors"
          >
            {updateChecking ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Buscar actualizaciones
          </button>
        </div>

        {updateResult && (
          <p className="text-xs text-slate-500">
            {updateResult.status === 'dev' && 'No se pueden buscar actualizaciones en modo desarrollo.'}
            {updateResult.status === 'not-available' && 'Ya tenés la última versión instalada.'}
            {updateResult.status === 'available' && !updateDownloading && !updateDownloaded && `Hay una nueva versión disponible (v${updateResult.latestVersion}).`}
            {updateResult.status === 'error' && `Error al buscar actualizaciones: ${updateResult.message}`}
          </p>
        )}

        {updateResult?.status === 'available' && !updateDownloading && !updateDownloaded && (
          <button
            onClick={handleDownloadUpdate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-sm rounded-lg transition-colors"
          >
            <Download size={14} />
            Descargar actualización (v{updateResult.latestVersion})
          </button>
        )}

        {updateDownloading && (
          <div className="space-y-1.5">
            <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all duration-300"
                style={{ width: `${updateProgress?.percent ?? 0}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">
              {updateProgress
                ? `Descargando... ${updateProgress.percent.toFixed(0)}% (${formatBytes(updateProgress.transferredBytes)} / ${formatBytes(updateProgress.totalBytes)} — ${formatBytes(updateProgress.bytesPerSecond)}/s)`
                : 'Descargando...'}
            </p>
          </div>
        )}

        {updateDownloaded && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-emerald-400">La actualización se descargó correctamente.</p>
            <button
              onClick={handleInstallUpdate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-sm rounded-lg transition-colors"
            >
              <RefreshCw size={14} />
              Reiniciar e instalar
            </button>
          </div>
        )}

        {updateError && (
          <p className="text-xs text-red-400">Error al descargar la actualización: {updateError}</p>
        )}
      </section>
      </>
      )}
    </div>
  )
}
