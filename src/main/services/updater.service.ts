import { app, BrowserWindow, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateCheckResult } from '@shared/types'

let mainWindowRef: BrowserWindow | null = null

function promptDownload(version: string): void {
  if (!mainWindowRef) return
  dialog
    .showMessageBox(mainWindowRef, {
      type: 'info',
      title: 'Actualización disponible',
      message: `Hay una nueva versión de Summit disponible (v${version}).`,
      detail: '¿Querés descargarla ahora? Te vamos a avisar cuando esté lista para instalar.',
      buttons: ['Descargar', 'Más tarde'],
      defaultId: 0,
      cancelId: 1
    })
    .then((result) => {
      if (result.response === 0) {
        autoUpdater.downloadUpdate().catch((err) => console.error('[Updater] Error al descargar:', err))
      }
    })
}

function promptInstall(version: string): void {
  if (!mainWindowRef) return
  dialog
    .showMessageBox(mainWindowRef, {
      type: 'info',
      title: 'Actualización lista',
      message: `Summit v${version} se descargó correctamente.`,
      detail: '¿Querés reiniciar ahora para instalarla?',
      buttons: ['Reiniciar ahora', 'Más tarde'],
      defaultId: 0,
      cancelId: 1
    })
    .then((result) => {
      if (result.response === 0) {
        setImmediate(() => autoUpdater.quitAndInstall())
      }
    })
}

/**
 * Configura electron-updater (sin descarga automática) y chequea si hay una
 * versión nueva publicada en GitHub Releases (senseinaka/flowtask) al iniciar
 * la app. Si hay una versión nueva, pregunta antes de descargar; si la
 * descarga termina, pregunta antes de reiniciar e instalar.
 */
export function initUpdater(mainWindow: BrowserWindow): void {
  mainWindowRef = mainWindow

  if (!app.isPackaged) {
    console.log('[Updater] Omitido: la app no está empaquetada (modo desarrollo)')
    return
  }

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('update-available', (info) => promptDownload(info.version))
  autoUpdater.on('update-downloaded', (info) => promptInstall(info.version))
  autoUpdater.on('error', (err) => console.error('[Updater] Error:', err))

  autoUpdater.checkForUpdates().catch((err) => {
    console.error('[Updater] Error al chequear actualizaciones:', err)
  })
}

/**
 * Chequeo manual disparado desde Configuración. Si hay una versión nueva,
 * dispara el mismo diálogo de confirmación que el chequeo automático.
 */
export async function checkForUpdatesManually(): Promise<UpdateCheckResult> {
  const currentVersion = app.getVersion()

  if (!app.isPackaged) {
    return { status: 'dev', currentVersion, message: 'No se pueden buscar actualizaciones en modo desarrollo.' }
  }

  return new Promise((resolve) => {
    const onAvailable = (info: { version: string }): void => {
      cleanup()
      resolve({ status: 'available', currentVersion, latestVersion: info.version })
    }
    const onNotAvailable = (info: { version: string }): void => {
      cleanup()
      resolve({ status: 'not-available', currentVersion, latestVersion: info.version })
    }
    const onError = (err: Error): void => {
      cleanup()
      resolve({ status: 'error', currentVersion, message: err.message })
    }
    const cleanup = (): void => {
      autoUpdater.removeListener('update-available', onAvailable)
      autoUpdater.removeListener('update-not-available', onNotAvailable)
      autoUpdater.removeListener('error', onError)
    }

    autoUpdater.once('update-available', onAvailable)
    autoUpdater.once('update-not-available', onNotAvailable)
    autoUpdater.once('error', onError)

    autoUpdater.checkForUpdates().catch(onError)
  })
}
