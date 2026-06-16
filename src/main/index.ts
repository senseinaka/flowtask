// Node.js en Electron no usa el CA store del sistema; necesario para googleapis
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'

import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { exec } from 'child_process'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { getDb } from './database/db'
import { runMigrations } from './database/migrations'
import { connectPowerSync, registerSyncListeners } from './database/powersync'
import { registerTaskIpc } from './ipc/tasks.ipc'
import { registerProjectIpc } from './ipc/projects.ipc'
import { registerAttachmentIpc } from './ipc/attachments.ipc'
import { registerReminderIpc } from './ipc/reminders.ipc'
import { registerSyncIpc } from './ipc/sync.ipc'
import { registerContactsIpc } from './ipc/contacts.ipc'
import { registerDelegatedIpc } from './ipc/delegated.ipc'
import { registerMessagesIpc } from './ipc/messages.ipc'
import { registerQuestionsIpc } from './ipc/questions.ipc'
import { registerComexIpc } from './ipc/comex.ipc'
import { registerDelegatedExtrasIpc } from './ipc/delegated-extras.ipc'
import { registerAIIpc } from './ipc/ai.ipc'
import { registerBNAIpc }  from './ipc/bna.ipc'
import { registerChatIpc } from './ipc/chat.ipc'
import { registerBackupIpc } from './ipc/backup.ipc'
import { registerExpiryIpc } from './ipc/expiry.ipc'
import { registerSettingsIpc } from './ipc/settings.ipc'
import { registerFinanceIpc } from './ipc/finance.ipc'
import { registerCompanyFinanceIpc } from './ipc/company-finance.ipc'
import { registerPowerSyncIpc } from './ipc/powersync.ipc'
import { registerAppIpc } from './ipc/app.ipc'
import { registerAuthIpc } from './ipc/auth.ipc'
import { registerPermissionsIpc } from './ipc/permissions.ipc'
import { registerCalendarIpc } from './ipc/calendar.ipc'
import { registerQuotesIpc } from './ipc/quotes.ipc'
import { registerEmailIpc } from './ipc/email.ipc'
import { startEmailAutoSync } from './services/email.service'
import { syncEnabledCalendars } from './services/google-calendar.service'
import cron from 'node-cron'
import { installIpcPermissionGuard } from './services/permissions.service'
import { initUpdater } from './services/updater.service'
import { driveService } from './services/drive.service'
import { localBackupService } from './services/local-backup.service'
import { schedulerService } from './services/scheduler.service'
import { questionsService } from './services/questions.service'
import { startPolling, stopPolling } from './services/polling.service'
import { startProactiveScheduler, stopProactiveScheduler, triggerProactiveNow } from './services/proactive.service'
import type { ProactiveAlert } from './services/proactive.service'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.flowtask.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Init DB
  const db = getDb()
  runMigrations(db)

  // Fase 0: conexión PowerSync en paralelo (no afecta queries existentes todavía)
  connectPowerSync()
    .then(() => {
      registerSyncListeners((channel, data) => mainWindow?.webContents.send(channel, data))
    })
    .catch((err) => {
      console.error('[PowerSync] Error al conectar:', err)
    })

  // Fase 6.5: guard de permisos — debe instalarse antes de registrar el resto de IPC
  installIpcPermissionGuard()

  // Register IPC
  registerTaskIpc()
  registerProjectIpc()
  registerAttachmentIpc()
  registerReminderIpc()
  registerSyncIpc()
  registerContactsIpc()
  registerDelegatedIpc()
  registerMessagesIpc()
  registerQuestionsIpc()
  registerComexIpc()
  registerDelegatedExtrasIpc()
  registerAIIpc()
  registerBNAIpc()
  registerChatIpc()
  registerBackupIpc()
  registerExpiryIpc()
  registerSettingsIpc()
  registerFinanceIpc()
  registerCompanyFinanceIpc()
  registerPowerSyncIpc()
  registerAppIpc()
  registerAuthIpc(getMainWindow)
  registerPermissionsIpc()
  registerCalendarIpc()
  registerQuotesIpc()
  registerEmailIpc()
  startEmailAutoSync()

  // ── Calendario: sync automático cada 10 minutos (si hay conexión activa) ──
  cron.schedule('*/10 * * * *', () => {
    syncEnabledCalendars().catch((err) => {
      console.error('[Calendar] Error en sync automático:', (err as Error).message)
    })
  })

  // ── Backup automático cada 6 horas ────────────────────────────────────────
  const BACKUP_INTERVAL_MS = 6 * 60 * 60 * 1000  // 6 horas
  _backupInterval = setInterval(() => {
    if (driveService.isAuthenticated()) {
      driveService.fullBackup()
        .then(status => {
          mainWindow?.webContents.send('backup:complete', status)
          console.log('[Backup] Automático completado:', status.driveFolder)
        })
        .catch(err => console.error('[Backup] Error automático:', err))
    }
  }, BACKUP_INTERVAL_MS)

  // Start scheduler + questions service with push callback
  const push = (channel: string, data: unknown) => {
    mainWindow?.webContents.send(channel, data)
  }

  // ── Backup local automático (red de seguridad, no depende de Drive) ──────
  // A diferencia del backup a Drive, este SIEMPRE corre — copia DB + adjuntos
  // a una carpeta del disco cada 6 horas (y de nuevo al cerrar la app, más
  // abajo). Así, aunque la cuenta de Google nunca se conecte o pierda el
  // token, siempre queda al menos una copia reciente y restaurable a mano.
  localBackupService.start(push)

  schedulerService.start(push)
  questionsService.setPushFn(push)

  // Fase 5: alertas proactivas del asistente IA
  startProactiveScheduler((alerts: ProactiveAlert[]) => {
    push('chat:proactiveAlerts', alerts)
  })

  // IPC para ejecutar análisis manual desde el chat o un botón
  ipcMain.handle('chat:triggerProactive', async () => {
    let result: ProactiveAlert[] = []
    await triggerProactiveNow((alerts) => { result = alerts; push('chat:proactiveAlerts', alerts) })
    return result
  })

  // Polling de mensajes entrantes (reemplaza webhook local — Evolution API está en Railway)
  startPolling()

  createWindow()

  // ── Auto-actualización (electron-updater + GitHub Releases) ──────────────
  if (mainWindow) initUpdater(mainWindow)

  // ── Verificar conexión Drive al iniciar (5 seg después para que cargue la UI) ──
  setTimeout(async () => {
    if (driveService.isAuthenticated()) {
      const result = await driveService.testConnection()
      if (!result.ok) {
        console.warn('[Drive] Sesión inválida al iniciar:', result.error)
        mainWindow?.webContents.send('drive:sessionExpired', { error: result.error })
      }
    }
  }, 5000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

let _backupInterval: ReturnType<typeof setInterval> | null = null
let _quittingAfterBackup = false

app.on('before-quit', (event) => {
  schedulerService.stop()
  stopProactiveScheduler()
  stopPolling()
  localBackupService.stop()
  if (_backupInterval) clearInterval(_backupInterval)

  if (_quittingAfterBackup) return  // ya se esperó por los backups, dejar cerrar

  event.preventDefault()
  _quittingAfterBackup = true

  const timeout = setTimeout(() => {
    console.warn('[Backup] Timeout al cerrar — cerrando sin esperar más backups')
    app.quit()
  }, 30_000)

  // 1. Backup LOCAL — siempre corre, sin depender de ninguna cuenta ni
  //    conexión. Es la red de seguridad mínima: aunque Drive nunca se haya
  //    conectado (como pasó hasta ahora), siempre queda al menos esta copia
  //    reciente y restaurable a mano en el disco.
  const pending: Promise<unknown>[] = [
    localBackupService.runBackup()
      .then(s => console.log('[BackupLocal] Copia al cerrar completada:', s.folder))
      .catch(e => console.error('[BackupLocal] Error al cerrar:', e))
  ]

  // 2 y 3. Backup a Drive (DB completa) + código a GitHub — sólo si Drive
  //        está conectado (máx 30 seg en total junto con el de arriba)
  if (driveService.isAuthenticated()) {
    pending.push(
      driveService.fullBackup()
        .then(s => console.log('[Backup] DB backup completado:', s.driveFolder))
        .catch(e => console.error('[Backup] DB error:', e))
    )

    pending.push(new Promise<void>((resolve) => {
      const date = new Date().toLocaleString('es-AR').replace(/[/:]/g, '-')
      const cmd  = [
        'cd /d "C:\\Projects\\flowtask"',
        'git add .',
        `git commit -m "auto-backup: ${date}" --allow-empty-message`,
        'git push'
      ].join(' && ')
      exec(cmd, (err) => {
        if (err) console.error('[Backup] Git error:', err.message)
        else     console.log('[Backup] Código subido a GitHub')
        resolve()
      })
    }))
  }

  Promise.allSettled(pending)
    .finally(() => { clearTimeout(timeout); app.quit() })
})

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}
