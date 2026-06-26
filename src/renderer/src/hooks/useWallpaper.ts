import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface WallpaperConfig {
  enabled: boolean
  mode: 'rotating' | 'fixed'
  interval_seconds: number
  fixed_image_id: string | null
  active_image_ids: string[]
  screensaver_enabled: boolean
  screensaver_timeout_minutes: number
}

export interface WallpaperImage {
  id: string
  filename: string
  dataUrl: string
}

export function useWallpaperConfig() {
  return useQuery({
    queryKey: ['wallpaper-config'],
    queryFn: () => window.api.wallpaper.getConfig(),
    staleTime: Infinity,
  })
}

export function useWallpaperImages() {
  return useQuery({
    queryKey: ['wallpaper-images'],
    queryFn: () => window.api.wallpaper.listImages(),
    staleTime: Infinity,
  })
}

export function useWallpaperStats() {
  return useQuery({
    queryKey: ['wallpaper-stats'],
    queryFn: () => window.api.wallpaper.getStats(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

export function useSaveWallpaperConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<WallpaperConfig>) => window.api.wallpaper.setConfig(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wallpaper-config'] }),
  })
}

export function useAddWallpaperImage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => window.api.wallpaper.addImage(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wallpaper-images'] }),
  })
}

export function useDeleteWallpaperImage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.wallpaper.deleteImage(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wallpaper-images'] }),
  })
}
