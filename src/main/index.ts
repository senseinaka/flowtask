// Node.js en Electron no usa el CA store del sistema; necesario para googleapis
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'

import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { getDb } from './database/db'
import { runMigrations } from './database/migrations'
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
import { registerBNAIpc } from './ipc/bna.ipc'
import { registerBackupIpc } from './ipc/backup.ipc'
import { driveService } from './services/drive.service'
import { schedulerService } from './services/scheduler.service'
import { questionsService } from './services/questions.service'
import { startPolling, stopPolling } from './services/polling.service'

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
  registerBackupIpc()

  // ── Backup automático cada 6 horas ────────────────────────────────────────
  const BACKUP_INTERVAL_MS = 6 * 60 * 60 * 1000  // 6 horas
  const backupInterval = setInterval(() => {
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
  schedulerService.start(push)
  questionsService.setPushFn(push)

  // Polling de mensajes entrantes (reemplaza webhook local — Evolution API está en Railway)
  startPolling()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

let _quittingAfterBackup = false

app.on('before-quit', (event) => {
  schedulerService.stop()
  stopPolling()
  clearInterval(backupInterval)

  // Hacer backup al cerrar si Drive está configurado (máx 30 seg)
  if (driveService.isAuthenticated() && !_quittingAfterBackup) {
    event.preventDefault()
    _quittingAfterBackup = true

    const timeout = setTimeout(() => {
      console.warn('[Backup] Timeout al cerrar — cerrando sin backup')
      app.quit()
    }, 30_000)

    driveService.fullBackup()
      .then(s => console.log('[Backup] Backup al cerrar completado:', s.driveFolder))
      .catch(e => console.error('[Backup] Error al cerrar:', e))
      .finally(() => { clearTimeout(timeout); app.quit() })
  }
})

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}
