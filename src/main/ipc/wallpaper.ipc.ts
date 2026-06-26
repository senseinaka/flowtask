import { ipcMain } from 'electron'
import {
  getWallpaperConfig, setWallpaperConfig,
  listUserImages, addUserImage, deleteUserImage,
  getWallpaperStats,
  type WallpaperConfig,
} from '../services/wallpaper.service'

export function registerWallpaperIpc(): void {
  ipcMain.handle('wallpaper:getConfig',  ()                          => getWallpaperConfig())
  ipcMain.handle('wallpaper:setConfig',  (_e, patch: Partial<WallpaperConfig>) => setWallpaperConfig(patch))
  ipcMain.handle('wallpaper:listImages', ()                          => listUserImages())
  ipcMain.handle('wallpaper:addImage',   ()                          => addUserImage())
  ipcMain.handle('wallpaper:deleteImage',(_e, id: string)            => deleteUserImage(id))
  ipcMain.handle('wallpaper:getStats',   ()                          => getWallpaperStats())
}
