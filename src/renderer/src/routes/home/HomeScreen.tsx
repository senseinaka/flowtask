import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Settings } from 'lucide-react'
import {
  useWallpaperConfig, useWallpaperImages, useWallpaperStats,
  type WallpaperConfig,
} from '../../hooks/useWallpaper'
import WallpaperSettingsModal from './WallpaperSettingsModal'

// ── Gradient presets (sin archivos, siempre disponibles) ──────────────────────

export interface PresetItem {
  id: string
  type: 'preset'
  name: string
  location: string
  gradient: string
}

export interface ImageItem {
  id: string
  type: 'user'
  name: string
  location: string
  dataUrl: string
}

export type WallpaperItem = PresetItem | ImageItem

export const PRESETS: PresetItem[] = [
  { id: 'preset-patagonia',  type: 'preset', location: 'Patagonia, Argentina',    name: 'Torres del Paine',      gradient: 'linear-gradient(152deg,#06101e 0%,#0f2d55 28%,#1a5485 52%,#c07038 76%,#e8ad6a 100%)' },
  { id: 'preset-amazon',     type: 'preset', location: 'Amazonas, Brasil',         name: 'Selva tropical',        gradient: 'linear-gradient(162deg,#05120d 0%,#0c2f1e 30%,#1b5e3a 55%,#5faa60 80%,#bce8a0 100%)' },
  { id: 'preset-atacama',    type: 'preset', location: 'Atacama, Chile',           name: 'Valle de la Luna',      gradient: 'linear-gradient(138deg,#0c0c02 0%,#2a2508 30%,#786610 60%,#e8c030 80%,#fff5a8 100%)' },
  { id: 'preset-andes',      type: 'preset', location: 'Andes, Bolivia',           name: 'Salar de Uyuni',        gradient: 'linear-gradient(156deg,#030c18 0%,#082038 28%,#174678 55%,#72b8e0 80%,#d8f0ff 100%)' },
  { id: 'preset-glaciar',    type: 'preset', location: 'Patagonia, Argentina',    name: 'Perito Moreno',         gradient: 'linear-gradient(145deg,#0a1020 0%,#0f2840 25%,#1a5080 50%,#80c0e8 75%,#e0f0ff 100%)' },
  { id: 'preset-noche',      type: 'preset', location: 'Mendoza, Argentina',      name: 'Cielo estrellado',      gradient: 'linear-gradient(145deg,#010208 0%,#05091a 25%,#0a1030 55%,#1a2060 80%,#2a3070 100%)' },
  { id: 'preset-sunset',     type: 'preset', location: 'La Pampa, Argentina',     name: 'Atardecer pampeano',    gradient: 'linear-gradient(160deg,#120505 0%,#3a1010 25%,#8a2828 50%,#e06030 75%,#f8a050 100%)' },
  { id: 'preset-iguazu',     type: 'preset', location: 'Misiones, Argentina',     name: 'Cataratas del Iguazú',  gradient: 'linear-gradient(155deg,#0a1a10 0%,#102a18 25%,#1a5a30 55%,#30a060 80%,#90e0a0 100%)' },
  { id: 'preset-fitzroy',    type: 'preset', location: 'El Chaltén, Argentina',   name: 'Cerro Fitz Roy',        gradient: 'linear-gradient(148deg,#0a0610 0%,#1e0e28 25%,#5a1e08 52%,#d04010 76%,#f88028 100%)' },
  { id: 'preset-aconcagua',  type: 'preset', location: 'Mendoza, Argentina',      name: 'Aconcagua',             gradient: 'linear-gradient(152deg,#040812 0%,#0c1430 28%,#243870 55%,#7868b8 80%,#c8c0e8 100%)' },
  { id: 'preset-humahuaca',  type: 'preset', location: 'Jujuy, Argentina',        name: 'Quebrada de Humahuaca', gradient: 'linear-gradient(138deg,#0e0400 0%,#301004 28%,#80280c 55%,#c86020 80%,#e8b060 100%)' },
  { id: 'preset-bariloche',  type: 'preset', location: 'Río Negro, Argentina',    name: 'Lago Nahuel Huapi',     gradient: 'linear-gradient(160deg,#020c10 0%,#061e2c 28%,#0e4060 55%,#2080a0 80%,#78c8d8 100%)' },
  { id: 'preset-cafayate',   type: 'preset', location: 'Salta, Argentina',        name: 'Cafayate',              gradient: 'linear-gradient(142deg,#100802 0%,#302010 28%,#785020 55%,#c88040 78%,#f0c880 100%)' },
  { id: 'preset-ushuaia',    type: 'preset', location: 'Tierra del Fuego, Arg.', name: 'Ushuaia',               gradient: 'linear-gradient(150deg,#060a10 0%,#101830 28%,#203058 55%,#507090 80%,#90a8b8 100%)' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildPlaylist(config: WallpaperConfig, userImages: { id: string; filename: string; dataUrl: string }[]): WallpaperItem[] {
  const all: WallpaperItem[] = [
    ...PRESETS,
    ...userImages.map(img => ({
      id: img.id,
      type: 'user' as const,
      name: img.filename.replace(/\.[^.]+$/, ''),
      location: 'Mi colección',
      dataUrl: img.dataUrl,
    })),
  ]
  if (!config.active_image_ids.length) return all
  const filtered = all.filter(item => config.active_image_ids.includes(item.id))
  return filtered.length > 0 ? filtered : all
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const fromScreensaver = (location.state as { fromScreensaver?: boolean } | null)?.fromScreensaver === true
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? '/tasks'

  const { data: config, isLoading: configLoading } = useWallpaperConfig()
  const { data: userImages = [] } = useWallpaperImages()
  const { data: stats } = useWallpaperStats()
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Si llegamos por screensaver: cualquier interacción (fuera del gear) regresa a donde estaba el usuario
  useEffect(() => {
    if (!fromScreensaver) return
    function wake(e: Event) {
      if ((e.target as HTMLElement)?.closest('[data-no-wake]')) return
      navigate(returnTo, { replace: true })
    }
    window.addEventListener('mousedown', wake)
    window.addEventListener('keydown', wake)
    return () => {
      window.removeEventListener('mousedown', wake)
      window.removeEventListener('keydown', wake)
    }
  }, [fromScreensaver, returnTo, navigate])

  const playlist = useMemo(
    () => (config ? buildPlaylist(config, userImages) : PRESETS),
    [config, userImages]
  )

  // ── Rotation state ────────────────────────────────────────────────────────

  // Two background layers for smooth crossfade
  const [layers, setLayers] = useState<[WallpaperItem, WallpaperItem]>([playlist[0], playlist[1] ?? playlist[0]])
  const [activeLayer, setActiveLayer] = useState(0)
  const curIdxRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Sync initial layer when playlist loads
  useEffect(() => {
    if (playlist.length > 0) {
      setLayers([playlist[0], playlist[1] ?? playlist[0]])
      curIdxRef.current = 0
    }
  }, [playlist.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const advance = useCallback(() => {
    if (playlist.length <= 1) return
    const nextIdx = (curIdxRef.current + 1) % playlist.length
    const nextLayer = 1 - activeLayer as 0 | 1

    // Load next item into the inactive layer, then fade it in
    setLayers(prev => {
      const newLayers: [WallpaperItem, WallpaperItem] = [...prev] as [WallpaperItem, WallpaperItem]
      newLayers[nextLayer] = playlist[nextIdx]
      return newLayers
    })

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setActiveLayer(nextLayer)
        curIdxRef.current = nextIdx
      })
    })
  }, [activeLayer, playlist])

  useEffect(() => {
    if (!config || config.mode !== 'rotating') return
    const secs = config.interval_seconds || 30
    timerRef.current = setInterval(advance, secs * 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [config, advance])

  // ── Fixed mode ────────────────────────────────────────────────────────────

  const displayItem = useMemo(() => {
    if (config?.mode === 'fixed' && config.fixed_image_id) {
      const found = playlist.find(p => p.id === config.fixed_image_id)
      return found ?? playlist[0]
    }
    return layers[activeLayer]
  }, [config, playlist, layers, activeLayer])

  // ── Clock + date ──────────────────────────────────────────────────────────

  const [time, setTime] = useState('')
  const [dateStr, setDateStr] = useState('')

  useEffect(() => {
    function tick() {
      const now = new Date()
      setTime(now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }))
      setDateStr(now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
    }
    tick()
    const t = setInterval(tick, 15_000)
    return () => clearInterval(t)
  }, [])

  // ── Jump to specific item ─────────────────────────────────────────────────

  function jumpTo(idx: number) {
    if (idx === curIdxRef.current) return
    const nextLayer = 1 - activeLayer as 0 | 1
    setLayers(prev => {
      const newLayers: [WallpaperItem, WallpaperItem] = [...prev] as [WallpaperItem, WallpaperItem]
      newLayers[nextLayer] = playlist[idx]
      return newLayers
    })
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setActiveLayer(nextLayer)
      curIdxRef.current = idx
    }))
    if (timerRef.current) {
      clearInterval(timerRef.current)
      if (config?.mode === 'rotating') {
        timerRef.current = setInterval(advance, (config.interval_seconds || 30) * 1000)
      }
    }
  }

  if (configLoading) {
    return <div className="flex-1" style={{ background: '#06101e' }} />
  }

  const bgStyle = (item: WallpaperItem): React.CSSProperties =>
    item.type === 'preset'
      ? { background: item.gradient }
      : { backgroundImage: `url(${item.dataUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }

  const isRotating = config?.mode === 'rotating'

  return (
    <div className="relative flex flex-col flex-1 overflow-hidden" style={{ background: '#06101e' }}>
      <style>{`
        @keyframes homeKB { from { transform: scale(1) } to { transform: scale(1.07) } }
      `}</style>

      {/* Two crossfade layers */}
      {layers.map((item, i) => (
        <div
          key={`layer-${i}`}
          className="absolute inset-0"
          style={{
            ...bgStyle(item),
            opacity: (config?.mode === 'fixed') ? (displayItem?.id === item.id ? 1 : 0) : (i === activeLayer ? 1 : 0),
            transition: 'opacity 1.5s ease-in-out',
            animation: 'homeKB 22s ease-in-out infinite alternate',
          }}
        />
      ))}

      {/* Top gradient overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to bottom,rgba(0,0,0,.52) 0%,transparent 32%,transparent 58%,rgba(0,0,0,.68) 100%)' }} />

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 flex justify-between items-start px-7 pt-6 z-10">
        <div>
          <p className="text-white font-medium text-lg tracking-wide drop-shadow-sm">Summit</p>
          <p className="text-white/50 text-xs mt-1 capitalize">{dateStr}</p>
        </div>
        <div className="flex items-start gap-2.5">
          <p className="text-white font-extralight text-5xl leading-none tracking-tight drop-shadow-md">{time}</p>
          <button
            onClick={() => setSettingsOpen(true)}
            title="Configurar pantalla de inicio"
            data-no-wake
            className="mt-1.5 p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* ── Location label ───────────────────────────────────────────────── */}
      {displayItem && (
        <div className="absolute z-10" style={{ left: 28, bottom: 72 }}>
          <p className="text-white/40 text-[10px] uppercase tracking-[2px] mb-1">{displayItem.location}</p>
          <p className="text-white text-xl font-light drop-shadow-sm">{displayItem.name}</p>
        </div>
      )}

      {/* ── Bottom bar ───────────────────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-between items-end px-6 pb-5 z-10">
        {/* Stats chips */}
        <div className="flex gap-2 flex-wrap">
          {!!stats?.tasksDueToday && (
            <span className="px-3 py-1.5 rounded-full text-xs text-white/90" style={{ background: 'rgba(0,0,0,.38)', border: '1px solid rgba(255,255,255,.18)' }}>
              {stats.tasksDueToday} {stats.tasksDueToday === 1 ? 'tarea' : 'tareas'} hoy
            </span>
          )}
          {!!stats?.upcomingAlerts && (
            <span className="px-3 py-1.5 rounded-full text-xs text-white/90" style={{ background: 'rgba(0,0,0,.38)', border: '1px solid rgba(255,255,255,.18)' }}>
              {stats.upcomingAlerts} vencimiento{stats.upcomingAlerts > 1 ? 's' : ''} próximos
            </span>
          )}
        </div>

        <div className="flex flex-col items-end gap-3">
          {/* Navigation dots (only in rotating mode) */}
          {isRotating && playlist.length > 1 && playlist.length <= 12 && (
            <div className="flex gap-1.5 items-center">
              {playlist.map((item, i) => (
                <button
                  key={item.id}
                  onClick={() => jumpTo(i)}
                  className="rounded-full transition-all duration-300"
                  style={{
                    height: 5,
                    width: i === curIdxRef.current ? 18 : 5,
                    background: i === curIdxRef.current ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.3)',
                  }}
                />
              ))}
            </div>
          )}

        </div>
      </div>

      {settingsOpen && (
        <div data-no-wake>
          <WallpaperSettingsModal onClose={() => setSettingsOpen(false)} />
        </div>
      )}
    </div>
  )
}
