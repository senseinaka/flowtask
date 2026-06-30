import { useState, useEffect, useCallback } from 'react'
import { toast } from '../../store/toast.store'
import {
  MessageCircle, X, Send, Search, Star, Loader2,
  RefreshCw, Check, Edit2, RotateCcw, Users, Trash2
} from 'lucide-react'
import { cn } from '../ui/utils'
import type { ComexImport, ComexCustoms } from '@shared/types'
import dayjs from 'dayjs'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface WaGroup   { jid: string; name: string; size: number }
interface FavGroup  { id: string; name: string; jid: string; description: string }

// ── Template builder ──────────────────────────────────────────────────────────

const DEFAULT_TEMPLATE = `¡Hola chicos!

Les comunico que está disponible la carga de {marca}

Turno de carga: {dia_turno_texto} a las {hora_turno} hs
Estimamos que el camión llegará a nuestro depósito poco después del turno.

Importación: {titulo}
Peso bruto: {peso}
Volumen: {volumen}
Pallets: {pallets}
{cajas_linea}
{link_pl}Cualquier cosa me cuentan, por favor`

function buildMessage(template: string, imp: ComexImport, customs: ComexCustoms | null): string {
  const marca   = imp.supplier?.brand || imp.supplier?.name || imp.title
  const peso    = customs?.peso_bruto_kg != null
    ? `${customs.peso_bruto_kg.toLocaleString('es-AR', { maximumFractionDigits: 0 })} kg`
    : imp._peso_bruto_kg != null
      ? `${imp._peso_bruto_kg.toLocaleString('es-AR', { maximumFractionDigits: 0 })} kg`
      : 'N/D'
  const volumen = customs?.volumen_m3 != null
    ? `${customs.volumen_m3.toLocaleString('es-AR', { maximumFractionDigits: 3 })} m³`
    : imp._volumen_m3 != null
      ? `${imp._volumen_m3.toLocaleString('es-AR', { maximumFractionDigits: 3 })} m³`
      : 'N/D'

  // Variables individuales (solo el número, sin etiqueta — para mayor flexibilidad en la plantilla)
  const cajasNum   = customs?.cant_cartons ?? imp._cant_bultos ?? null
  const palletsNum = customs?.cant_pallets ?? imp._cant_pallets_customs ?? null
  const cajas   = cajasNum   != null ? String(cajasNum)   : 'N/D'
  const pallets = palletsNum != null ? String(palletsNum) : 'N/D'

  // Línea combinada (para compatibilidad con plantillas antiguas)
  const cajasLine = [
    cajasNum   != null ? `📦 *Cajas:* ${cajasNum}`   : null,
    palletsNum != null ? `🪵 *Pallets:* ${palletsNum}` : null,
  ].filter(Boolean).join('  |  ') || '📦 *Bultos:* N/D'

  // ── Fechas y texto del turno ─────────────────────────────────────────────
  const fechaTurno = imp.carga_deposito_date
    ? dayjs(imp.carga_deposito_date).format('DD/MM/YYYY')
    : 'Por confirmar'
  const fechaTurnoCorta = imp.carga_deposito_date
    ? dayjs(imp.carga_deposito_date).format('DD/MM')
    : 'Por confirmar'
  const horaTurno = imp.carga_deposito_time ?? 'Por confirmar'

  // Texto inteligente del día: "Hoy", "Mañana", o "El {día} DD/MM"
  const DIAS_ES = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
  const diaTurnoTexto = (() => {
    if (!imp.carga_deposito_date) return 'Por confirmar'
    const turno = dayjs(imp.carga_deposito_date).startOf('day')
    const today = dayjs().startOf('day')
    const diff  = turno.diff(today, 'day')
    const diaNombre = DIAS_ES[turno.day()]
    if (diff === 0) return `hoy ${diaNombre} ${fechaTurnoCorta}`
    if (diff === 1) return `mañana ${diaNombre} ${fechaTurnoCorta}`
    return `el ${diaNombre} ${fechaTurnoCorta}`
  })()

  // Cajas: solo la línea si hay dato, vacía si no hay
  const cajasLinea = cajasNum != null ? `Cajas: ${cajasNum}` : ''

  // Link al Packing List en Drive (si está disponible)
  const linkPl = imp.inal_pl_drive_file_id
    ? `Packing List: https://drive.google.com/file/d/${imp.inal_pl_drive_file_id}/view\n`
    : ''

  return template
    .replace(/{marca}/g,             marca)
    .replace(/{titulo}/g,            imp.title)
    .replace(/{peso}/g,              peso)
    .replace(/{volumen}/g,           volumen)
    .replace(/{cajas}/g,             cajas)
    .replace(/{pallets}/g,           pallets)
    .replace(/{cajas_linea}/g,       cajasLinea)      // "Cajas: X" o vacío
    .replace(/{cajas_pallets}/g,     cajasLine)        // compatibilidad
    .replace(/{fecha_turno}/g,       fechaTurno)       // DD/MM/YYYY
    .replace(/{fecha_turno_corta}/g, fechaTurnoCorta)  // DD/MM
    .replace(/{dia_turno_texto}/g,   diaTurnoTexto)    // "mañana viernes 05/06"
    .replace(/{hora_turno}/g,        horaTurno)
    .replace(/{link_pl}/g,           linkPl)
    // limpiar líneas en blanco dobles que quedan cuando cajasLinea está vacío
    .replace(/\n\n\n+/g, '\n\n')
    .trimEnd()
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WhatsAppCargaModal({
  imp, customs, onClose
}: {
  imp:      ComexImport
  customs:  ComexCustoms | null
  onClose:  () => void
}) {
  const [step, setStep] = useState<'compose' | 'sent'>('compose')

  // Grupos
  const [favGroups,    setFavGroups]    = useState<FavGroup[]>([])
  const [liveGroups,   setLiveGroups]   = useState<WaGroup[]>([])
  const [loadingLive,  setLoadingLive]  = useState(false)
  const [showLive,     setShowLive]     = useState(false)
  const [searchGroup,  setSearchGroup]  = useState('')
  const [selectedJid,  setSelectedJid]  = useState<string | null>(null)

  // Template
  const [template,     setTemplate]     = useState(DEFAULT_TEMPLATE)
  const [editingTpl,   setEditingTpl]   = useState(false)
  const [tplDraft,     setTplDraft]     = useState(DEFAULT_TEMPLATE)
  const [savedTpl,     setSavedTpl]     = useState(false)

  // Mensaje final (computed)
  const [message, setMessage] = useState('')
  const [sending,   setSending]   = useState(false)
  const [editingMsg, setEditingMsg] = useState(false)

  // Cargar template y grupos favoritos
  useEffect(() => {
    window.api.whatsapp.template.get('carga_deposito').then(tpl => {
      if (tpl?.body) { setTemplate(tpl.body); setTplDraft(tpl.body) }
    })
    window.api.whatsapp.groups.list().then(setFavGroups)
  }, [])

  // Recalcular mensaje cuando cambia template o imp
  useEffect(() => {
    setMessage(buildMessage(template, imp, customs))
  }, [template, imp, customs])

  const loadLiveGroups = useCallback(async () => {
    setLoadingLive(true); setShowLive(true)
    const groups = await window.api.whatsapp.fetchGroups()
    setLiveGroups(groups)
    setLoadingLive(false)
  }, [])

  const handleSaveFav = async (jid: string, name: string) => {
    const saved = await window.api.whatsapp.groups.save(jid, name)
    setFavGroups(prev => {
      const exists = prev.find(g => g.jid === jid)
      const fullSaved = { description: '', ...saved } as FavGroup
      return exists ? prev.map(g => g.jid === jid ? fullSaved : g) : [...prev, fullSaved]
    })
    setSelectedJid(jid)
    setShowLive(false)
  }

  const handleDeleteFav = async (id: string) => {
    await window.api.whatsapp.groups.delete(id)
    setFavGroups(prev => prev.filter(g => g.id !== id))
    if (favGroups.find(g => g.id === id)?.jid === selectedJid) setSelectedJid(null)
  }

  const handleSaveTemplate = async () => {
    await window.api.whatsapp.template.save('carga_deposito', tplDraft)
    setTemplate(tplDraft)
    setEditingTpl(false)
    setSavedTpl(true)
    setTimeout(() => setSavedTpl(false), 2000)
  }

  const handleSend = async () => {
    if (!selectedJid || !message.trim()) return
    setSending(true)
    try {
      const ok = await window.api.whatsapp.sendToGroup(selectedJid, message)
      if (ok) setStep('sent')
      else toast.error('Error al enviar. Verificá que WhatsApp esté conectado.')
    } finally { setSending(false) }
  }

  const selectedGroupName = favGroups.find(g => g.jid === selectedJid)?.name
    ?? liveGroups.find(g => g.jid === selectedJid)?.name

  const filteredLive = liveGroups.filter(g =>
    !searchGroup || g.name.toLowerCase().includes(searchGroup.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-700/40 flex items-center justify-center">
              <MessageCircle size={16} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="font-semibold text-white text-sm">Enviar aviso de llegada de carga</h2>
              <p className="text-[10px] text-slate-500">{imp.title} · {imp.supplier?.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 transition-colors">
            <X size={16} />
          </button>
        </div>

        {step === 'sent' ? (
          /* ── Éxito ── */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-900/40 border-2 border-emerald-600 flex items-center justify-center">
              <Check size={28} className="text-emerald-400" />
            </div>
            <p className="text-white font-semibold">¡Mensaje enviado!</p>
            <p className="text-slate-400 text-sm">El aviso fue enviado al grupo <span className="text-white font-medium">{selectedGroupName}</span> por WhatsApp.</p>
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium transition-colors mt-2">
              Cerrar
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="p-5 space-y-5">

              {/* ── Selección de grupo ── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Users size={13} /> Destinatario (grupo de WhatsApp)
                  </label>
                  <button onClick={loadLiveGroups} disabled={loadingLive}
                    className="flex items-center gap-1.5 text-[10px] text-emerald-500 hover:text-emerald-400 transition-colors disabled:opacity-50">
                    {loadingLive ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                    {loadingLive ? 'Buscando grupos...' : 'Buscar mis grupos'}
                  </button>
                </div>

                {/* Grupos favoritos */}
                {favGroups.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {favGroups.map(g => (
                      <div key={g.id} className="flex items-center gap-1">
                        <button
                          onClick={() => setSelectedJid(selectedJid === g.jid ? null : g.jid)}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium border transition-all',
                            selectedJid === g.jid
                              ? 'bg-emerald-700/50 border-emerald-600 text-emerald-300 shadow-sm shadow-emerald-900'
                              : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:border-slate-500'
                          )}>
                          <Star size={10} className={selectedJid === g.jid ? 'text-emerald-400' : 'text-slate-500'} />
                          {g.name}
                        </button>
                        <button onClick={() => handleDeleteFav(g.id)}
                          className="p-1 rounded text-slate-600 hover:text-red-400 transition-colors">
                          <Trash2 size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Lista de grupos reales (si se buscaron) */}
                {showLive && (
                  <div className="rounded-xl border border-slate-700 bg-slate-900/60 overflow-hidden">
                    <div className="p-2.5 border-b border-slate-700">
                      <div className="relative">
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input value={searchGroup} onChange={e => setSearchGroup(e.target.value)}
                          placeholder="Buscar grupo..."
                          className="w-full pl-7 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-600" />
                      </div>
                    </div>
                    {loadingLive ? (
                      <div className="flex items-center justify-center py-6 gap-2 text-slate-500 text-xs">
                        <Loader2 size={14} className="animate-spin" /> Buscando grupos...
                      </div>
                    ) : filteredLive.length === 0 ? (
                      <p className="text-center py-6 text-slate-600 text-xs">
                        {liveGroups.length === 0 ? 'No se encontraron grupos. ¿WhatsApp conectado?' : 'Sin resultados'}
                      </p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto divide-y divide-slate-800">
                        {filteredLive.map(g => {
                          const isFav = favGroups.some(f => f.jid === g.jid)
                          return (
                            <div key={g.jid}
                              className={cn('flex items-center gap-3 px-3 py-2 hover:bg-slate-800/60 transition-colors',
                                selectedJid === g.jid && 'bg-emerald-950/20')}>
                              <button onClick={() => setSelectedJid(g.jid)} className="flex-1 text-left">
                                <p className={cn('text-xs font-medium', selectedJid === g.jid ? 'text-emerald-300' : 'text-slate-200')}>
                                  {g.name}
                                </p>
                                <p className="text-[9px] text-slate-600">{g.size} participantes · {g.jid}</p>
                              </button>
                              <button
                                onClick={() => handleSaveFav(g.jid, g.name)}
                                title={isFav ? 'Ya es favorito' : 'Guardar como favorito'}
                                className={cn('p-1.5 rounded-lg transition-colors',
                                  isFav ? 'text-amber-400' : 'text-slate-600 hover:text-amber-400 hover:bg-slate-700')}>
                                <Star size={12} className={isFav ? 'fill-amber-400' : ''} />
                              </button>
                              {selectedJid === g.jid && (
                                <Check size={12} className="text-emerald-400 flex-shrink-0" />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {selectedJid && selectedGroupName && (
                  <p className="text-[11px] text-emerald-500 flex items-center gap-1.5">
                    <Check size={11} /> Enviando a: <span className="font-semibold text-emerald-400">{selectedGroupName}</span>
                  </p>
                )}
              </div>

              {/* ── Template ── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">Plantilla del mensaje</label>
                  <div className="flex items-center gap-2">
                    {savedTpl && <span className="text-[10px] text-emerald-500">✓ Guardada</span>}
                    {editingTpl ? (
                      <>
                        <button onClick={() => { setTplDraft(DEFAULT_TEMPLATE) }}
                          className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300">
                          <RotateCcw size={10} /> Restaurar
                        </button>
                        <button onClick={handleSaveTemplate}
                          className="flex items-center gap-1 text-[10px] font-medium text-emerald-500 hover:text-emerald-400">
                          <Check size={10} /> Guardar plantilla
                        </button>
                        <button onClick={() => { setEditingTpl(false); setTplDraft(template) }}
                          className="text-[10px] text-slate-500 hover:text-white">
                          <X size={10} />
                        </button>
                      </>
                    ) : (
                      <button onClick={() => setEditingTpl(true)}
                        className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
                        <Edit2 size={10} /> Editar plantilla
                      </button>
                    )}
                  </div>
                </div>

                {editingTpl ? (
                  <div className="space-y-2">
                    <textarea value={tplDraft} onChange={e => setTplDraft(e.target.value)} rows={12}
                      className="w-full bg-slate-900 border border-violet-700/50 rounded-xl px-4 py-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-violet-500 resize-none leading-relaxed"
                      spellCheck={false} />
                    <p className="text-[10px] text-slate-600">
                      Variables: {['{marca}','{titulo}','{peso}','{volumen}','{cajas}','{pallets}','{cajas_linea}','{dia_turno_texto}','{fecha_turno}','{fecha_turno_corta}','{hora_turno}','{link_pl}'].join(' · ')}
                    </p>
                  </div>
                ) : null}
              </div>

              {/* ── Mensaje final (editable) ── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">Mensaje a enviar</label>
                  {!editingMsg && (
                    <button onClick={() => setEditingMsg(true)}
                      className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300">
                      <Edit2 size={10} /> Editar este envío
                    </button>
                  )}
                  {editingMsg && (
                    <button onClick={() => { setMessage(buildMessage(template, imp, customs)); setEditingMsg(false) }}
                      className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300">
                      <RotateCcw size={10} /> Restaurar
                    </button>
                  )}
                </div>
                <div className="relative">
                  {editingMsg ? (
                    <textarea value={message} onChange={e => setMessage(e.target.value)} rows={12}
                      className="w-full bg-slate-900/80 border border-emerald-700/40 rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none focus:border-emerald-600 resize-none leading-relaxed font-sans" />
                  ) : (
                    <div className="bg-slate-900/60 border border-slate-700 rounded-xl px-4 py-3 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans max-h-64 overflow-y-auto">
                      {message}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        {step !== 'sent' && (
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-700 flex-shrink-0 bg-slate-800/50">
            <p className="text-[10px] text-slate-600">
              {!selectedJid ? 'Seleccioná un grupo para enviar' : `Enviando a: ${selectedGroupName}`}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-700 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleSend}
                disabled={!selectedJid || !message.trim() || sending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {sending ? 'Enviando...' : 'Enviar por WhatsApp'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
