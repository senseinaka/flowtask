import { useState } from 'react'
import { X, Plus, Trash2, Loader2, Image } from 'lucide-react'
import {
  useWallpaperConfig, useWallpaperImages, useSaveWallpaperConfig,
  useAddWallpaperImage, useDeleteWallpaperImage,
  type WallpaperConfig,
} from '../../hooks/useWallpaper'
import { PRESETS } from './HomeScreen'

const INTERVALS = [
  { value: 15,  label: '15 s' },
  { value: 30,  label: '30 s' },
  { value: 60,  label: '1 min' },
  { value: 120, label: '2 min' },
  { value: 300, label: '5 min' },
]

const SCREENSAVER_TIMEOUTS = [
  { value: 1,  label: '1 min' },
  { value: 2,  label: '2 min' },
  { value: 5,  label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
]

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="relative flex-shrink-0 w-10 h-5 rounded-full transition-colors overflow-hidden"
      style={{ background: value ? '#10b981' : '#475569' }}
    >
      <span
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
        style={{ transform: value ? 'translateX(22px)' : 'translateX(2px)' }}
      />
    </button>
  )
}

export default function WallpaperSettingsModal({ onClose }: { onClose: () => void }) {
  const { data: config } = useWallpaperConfig()
  const { data: userImages = [] } = useWallpaperImages()
  const save     = useSaveWallpaperConfig()
  const addImg   = useAddWallpaperImage()
  const delImg   = useDeleteWallpaperImage()
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  if (!config) return null

  function toggleActive(id: string) {
    const cur = config!.active_image_ids
    const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]
    save.mutate({ active_image_ids: next })
  }

  function isActive(id: string): boolean {
    return config!.active_image_ids.length === 0 || config!.active_image_ids.includes(id)
  }

  const allItems = [
    ...PRESETS,
    ...userImages.map(img => ({ id: img.id, type: 'user' as const, name: img.filename.replace(/\.[^.]+$/, ''), location: 'Mi colección', dataUrl: img.dataUrl })),
  ]

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <Image size={15} className="text-slate-400" />
            <h2 className="text-sm font-semibold">Pantalla de inicio</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-700 text-slate-400"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Enable / disable */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Mostrar al abrir Summit</p>
              <p className="text-xs text-slate-400 mt-0.5">Si está desactivado abre directamente en Tareas</p>
            </div>
            <Toggle value={config.enabled} onChange={v => save.mutate({ enabled: v })} />
          </div>

          {/* Screensaver */}
          <div className="border-t border-slate-700 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Modo descanso</p>
                <p className="text-xs text-slate-400 mt-0.5">Muestra el fondo tras un período de inactividad</p>
              </div>
              <Toggle
                value={config.screensaver_enabled}
                onChange={v => save.mutate({ screensaver_enabled: v })}
              />
            </div>
            {config.screensaver_enabled && (
              <div>
                <p className="text-xs text-slate-400 mb-2">Activar después de</p>
                <div className="flex gap-2 flex-wrap">
                  {SCREENSAVER_TIMEOUTS.map(t => (
                    <button
                      key={t.value}
                      onClick={() => save.mutate({ screensaver_timeout_minutes: t.value })}
                      className="px-3 py-1.5 rounded-lg text-xs border transition-colors"
                      style={{
                        background: config.screensaver_timeout_minutes === t.value ? 'rgba(99,102,241,.2)' : 'transparent',
                        borderColor: config.screensaver_timeout_minutes === t.value ? '#6366f1' : 'rgba(100,116,139,.4)',
                        color: config.screensaver_timeout_minutes === t.value ? '#a5b4fc' : '#94a3b8',
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {config.enabled && (
            <>
              {/* Mode */}
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Modo</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['rotating', 'fixed'] as WallpaperConfig['mode'][]).map(m => (
                    <button
                      key={m}
                      onClick={() => save.mutate({ mode: m })}
                      className="py-2 rounded-lg text-sm transition-colors border"
                      style={{
                        background: config.mode === m ? 'rgba(99,102,241,.2)' : 'transparent',
                        borderColor: config.mode === m ? '#6366f1' : 'rgba(100,116,139,.4)',
                        color: config.mode === m ? '#a5b4fc' : '#94a3b8',
                      }}
                    >
                      {m === 'rotating' ? 'Rotación automática' : 'Imagen fija'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interval (rotating only) */}
              {config.mode === 'rotating' && (
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Cambiar cada</p>
                  <div className="flex gap-2 flex-wrap">
                    {INTERVALS.map(iv => (
                      <button
                        key={iv.value}
                        onClick={() => save.mutate({ interval_seconds: iv.value })}
                        className="px-3 py-1.5 rounded-lg text-xs border transition-colors"
                        style={{
                          background: config.interval_seconds === iv.value ? 'rgba(99,102,241,.2)' : 'transparent',
                          borderColor: config.interval_seconds === iv.value ? '#6366f1' : 'rgba(100,116,139,.4)',
                          color: config.interval_seconds === iv.value ? '#a5b4fc' : '#94a3b8',
                        }}
                      >
                        {iv.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Image gallery */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">
                    {config.mode === 'rotating' ? 'Imágenes en rotación' : 'Seleccionar imagen'}
                  </p>
                  <button
                    onClick={() => addImg.mutate()}
                    disabled={addImg.isPending}
                    className="flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-50 transition-colors"
                  >
                    {addImg.isPending ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                    Agregar foto
                  </button>
                </div>

                {config.mode === 'rotating' && (
                  <p className="text-[11px] text-slate-500 mb-2">
                    {config.active_image_ids.length === 0
                      ? 'Todas las imágenes están activas. Deseleccioná algunas para excluirlas.'
                      : `${config.active_image_ids.length} de ${allItems.length} activas`}
                  </p>
                )}

                <div className="grid grid-cols-3 gap-2">
                  {allItems.map(item => {
                    const active = isActive(item.id)
                    const isFixed = config.mode === 'fixed' && config.fixed_image_id === item.id
                    const isUser  = item.type === 'user'

                    return (
                      <div key={item.id} className="relative group">
                        <button
                          onClick={() => {
                            if (config.mode === 'fixed') {
                              save.mutate({ fixed_image_id: item.id })
                            } else {
                              toggleActive(item.id)
                            }
                          }}
                          className="w-full rounded-lg overflow-hidden border-2 transition-all"
                          style={{
                            borderColor: isFixed || (config.mode === 'rotating' && active)
                              ? '#6366f1'
                              : 'rgba(100,116,139,.3)',
                            aspectRatio: '16/9',
                          }}
                        >
                          {/* Thumbnail */}
                          <div
                            className="w-full h-full"
                            style={
                              item.type === 'preset'
                                ? { background: item.gradient }
                                : { backgroundImage: `url(${(item as { dataUrl: string }).dataUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                            }
                          />
                          {/* Overlay when inactive in rotation */}
                          {config.mode === 'rotating' && !active && (
                            <div className="absolute inset-0 bg-black/60 rounded-lg" />
                          )}
                        </button>

                        {/* Label */}
                        <p className="text-[10px] text-slate-400 mt-1 truncate px-0.5">{item.name}</p>

                        {/* Delete button for user images */}
                        {isUser && (
                          <div className="absolute top-1 right-1">
                            {confirmDel === item.id ? (
                              <button
                                onClick={() => { delImg.mutate(item.id); setConfirmDel(null) }}
                                className="text-[10px] px-1.5 py-0.5 bg-red-600 hover:bg-red-500 rounded text-white"
                              >
                                ¿Borrar?
                              </button>
                            ) : (
                              <button
                                onClick={e => { e.stopPropagation(); setConfirmDel(item.id) }}
                                className="p-0.5 rounded bg-black/50 text-white/70 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
