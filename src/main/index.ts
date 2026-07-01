// Node.js en Electron valida TLS por defecto contra los roots de Mozilla incluidos.
// NO desactivar la verificación: hacerlo expone los tokens OAuth de Google (Drive,
// Calendar) y los backups completos de la DB a un MITM en la red. Si una red
// corporativa usa un proxy de inspección TLS con CA privada y las llamadas a Google
// fallan por certificado, instalar esa CA en el trust store del sistema; sólo como
// último recurso de diagnóstico exportar FLOWTASK_INSECURE_GOOGLE_TLS=1 (INSEGURO).
import { google } from 'googleapis'
import https from 'https'
if (process.platform === 'win32' && process.env.FLOWTASK_INSECURE_GOOGLE_TLS === '1') {
  console.warn('[TLS] Verificación TLS de Google DESACTIVADA por FLOWTASK_INSECURE_GOOGLE_TLS=1 — inseguro, sólo diagnóstico')
  google.options({ agent: new https.Agent({ rejectUnauthorized: false }) })
}

// imapflow puede emitir socket timeouts como excepciones no capturadas cuando
// el cliente ya fue descartado. Las logueamos pero no crasheamos la app.
process.on('uncaughtException', (err) => {
  if (err.message?.includes('Socket timeout') || err.message?.includes('socket hang up') || err.message?.includes('ECONNRESET')) {
    console.warn('[Email] Uncaught socket error (imapflow):', err.message)
    return
  }
  console.error('[Main] Uncaught exception:', err)
  throw err
})

import { app, BrowserWindow, ipcMain, session } from 'electron'
import { execFile } from 'child_process'
import { join } from 'path'
import { safeOpenExternal } from './utils/safe-open'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { getDb } from './database/db'
import { runMigrations } from './database/migrations'
import { connectPowerSync, registerSyncListeners } from './database/powersync'
import { registerTaskIpc } from './ipc/tasks.ipc'
import { registerTeamTaskIpc } from './ipc/team-tasks.ipc'
import { registerMaintenanceIpc } from './ipc/maintenance.ipc'
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
import { registerKnowledgeIpc } from './ipc/knowledge.ipc'
import { registerCortexIpc } from './ipc/cortex.ipc'
import { registerEmailIpc } from './ipc/email.ipc'
import { registerReconIpc } from './ipc/recon.ipc'
import { registerPdfIpc } from './ipc/pdf.ipc'
import { registerRrhhIpc } from './ipc/rrhh.ipc'
import { registerMercadoPagoIpc } from './ipc/mercadopago.ipc'
import { registerAccountingServicesIpc } from './ipc/accounting-services.ipc'
import { registerCajasIpc } from './ipc/cajas.ipc'
import { registerServiceCatalogIpc } from './ipc/service-catalog.ipc'
import { registerWallpaperIpc } from './ipc/wallpaper.ipc'
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
import { startAlarmasCotizacion, stopAlarmasCotizacion } from './services/cotizacion-alarmas.service'
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
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    // Valida el esquema antes de abrir: la URL puede venir de contenido no confiable
    // (p.ej. un enlace en el HTML de un email entrante vía allow-popups del iframe).
    safeOpenExternal(details.url)
    return { action: 'deny' }
  })

  // Prevent Electron from navigating to dropped file URLs (would reload the app)
  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.flowtask.app')

  // Content-Security-Policy (defensa en profundidad contra XSS). Sólo en
  // producción (file://): en dev rompería el HMR de Vite, que necesita
  // 'unsafe-inline'/'unsafe-eval' y websockets al dev server.
  //   • script-src 'self'  → bloquea scripts inline/inyectados (vector XSS).
  //   • connect-src https/wss → Supabase REST + PowerSync (websocket).
  //   • img-src https/data/blob → imágenes remotas de emails, avatares, Drive.
  //   • frame-src → sólo embeds de YouTube/Vimeo (Knowledge).
  if (!is.dev) {
    const csp = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "media-src 'self' https: blob:",
      "connect-src 'self' https: wss: ws:",
      "frame-src https://www.youtube.com https://player.vimeo.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [csp]
        }
      })
    })
  }

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
  registerTeamTaskIpc()
  registerMaintenanceIpc()
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
  registerKnowledgeIpc()
  registerCortexIpc()
  registerEmailIpc()
  registerReconIpc()
  registerPdfIpc()
  registerRrhhIpc()
  registerMercadoPagoIpc()
  registerAccountingServicesIpc()
  registerCajasIpc()
  registerServiceCatalogIpc()
  registerWallpaperIpc()
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

  // Chequeo periódico de alarmas de cotización USD/EUR
  startAlarmasCotizacion()

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
  stopAlarmasCotizacion()
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

    // Backup del CÓDIGO FUENTE a GitHub: sólo en la máquina de desarrollo, nunca en
    // instalaciones empacadas de usuarios finales. Usa execFile (sin shell, sin
    // interpolar en una línea de cmd.exe) y `git add -u` (sólo archivos ya trackeados)
    // para no publicar jamás un archivo nuevo no incluido en .gitignore al repo público.
    if (!app.isPackaged) {
      pending.push(new Promise<void>((resolve) => {
        const date = new Date().toLocaleString('es-AR').replace(/[/:]/g, '-')
        const repo = 'C:\\Projects\\flowtask'
        execFile('git', ['-C', repo, 'add', '-u'], (e1) => {
          if (e1) { console.error('[Backup] Git add error:', e1.message); return resolve() }
          execFile('git', ['-C', repo, 'commit', '-m', `auto-backup: ${date}`, '--allow-empty-message'], () => {
            execFile('git', ['-C', repo, 'push'], (e3) => {
              if (e3) console.error('[Backup] Git push error:', e3.message)
              else    console.log('[Backup] Código subido a GitHub')
              resolve()
            })
          })
        })
      }))
    }
  }

  Promise.allSettled(pending)
    .finally(() => { clearTimeout(timeout); app.quit() })
})

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}
