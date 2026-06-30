import { useState, useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Bot, X, Send, Trash2, Loader2, Sparkles, Wrench, BellRing, AlertTriangle, Info } from 'lucide-react'
import { cn } from '../ui/utils'
import type { AIChatMessage } from '@shared/types'
import { useConfirm } from '../../store/confirm.store'

// ── Tipos de alerta proactiva ─────────────────────────────────────────────────

interface ProactiveAlert {
  id:        string
  severity:  'critical' | 'warning' | 'info'
  title:     string
  body:      string
  module:    'comex' | 'tasks' | 'delegated' | 'general'
  createdAt: number
}

// ── Renderizador de markdown + tool indicators ───────────────────────────────

function ToolBadge({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5 my-1 px-2.5 py-1 rounded-lg bg-violet-900/40 border border-violet-700/40 w-fit text-xs text-violet-300">
      <Wrench size={11} className="flex-shrink-0 animate-pulse" />
      <span>{label}</span>
    </div>
  )
}

function MessageContent({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {lines.map((line, i) => {
        // Tool indicator: líneas como `⚙ Creando tarea...`
        const toolMatch = line.match(/^`⚙ (.+)`$/)
        if (toolMatch) return <ToolBadge key={i} label={toolMatch[1]} />

        if (line.startsWith('### ')) return <p key={i} className="font-bold text-slate-100 mt-2">{line.slice(4)}</p>
        if (line.startsWith('## '))  return <p key={i} className="font-bold text-white text-base mt-2">{line.slice(3)}</p>
        if (line.startsWith('# '))   return <p key={i} className="font-bold text-white text-lg mt-2">{line.slice(2)}</p>
        if (line.startsWith('• ') || line.startsWith('- ') || line.match(/^\d+\. /)) {
          return (
            <div key={i} className="flex items-start gap-2">
              <span className="text-cyan-400 flex-shrink-0 mt-0.5">
                {line.match(/^\d+\./) ? line.match(/^\d+\./)?.[0] : '•'}
              </span>
              <span>{line.replace(/^[•\-]\s+/, '').replace(/^\d+\.\s+/, '')}</span>
            </div>
          )
        }
        if (line === '') return <div key={i} className="h-1" />
        // Bold inline
        const parts = line.split(/(\*\*[^*]+\*\*)/g)
        return (
          <p key={i}>
            {parts.map((p, j) =>
              p.startsWith('**') && p.endsWith('**')
                ? <strong key={j} className="text-white font-semibold">{p.slice(2, -2)}</strong>
                : p
            )}
          </p>
        )
      })}
    </div>
  )
}

// ── ChatPanel ────────────────────────────────────────────────────────────────

interface Props {
  isOpen:   boolean
  onClose:  () => void
}

export default function ChatPanel({ isOpen, onClose }: Props) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [messages,      setMessages]      = useState<(AIChatMessage & { streaming?: boolean })[]>([])
  const [input,         setInput]         = useState('')
  const [sending,       setSending]       = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [aiConfigured,  setAiConfigured]  = useState<boolean | null>(null)
  const [stats,         setStats]         = useState<{ total: number; hasCompacted: boolean } | null>(null)
  const [alerts,        setAlerts]        = useState<ProactiveAlert[]>([])
  const [showAlerts,    setShowAlerts]    = useState(false)
  const [analyzingNow,  setAnalyzingNow]  = useState(false)
  const messagesEndRef  = useRef<HTMLDivElement>(null)
  const inputRef        = useRef<HTMLTextAreaElement>(null)

  // ── Scroll al final ───────────────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, streamingText, scrollToBottom])

  // ── Refresca stats ────────────────────────────────────────────────────────
  const refreshStats = useCallback(() => {
    window.api.chat.stats().then(setStats)
  }, [])

  // ── Cargar historial + verificar config ───────────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    window.api.ai.isConfigured().then(setAiConfigured)
    window.api.chat.history().then(setMessages)
    refreshStats()
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [isOpen, refreshStats])

  // ── Escuchar chunks de streaming + eventos de datos ──────────────────────
  useEffect(() => {
    window.api.on('chat:chunk', (data) => {
      const d = data as { text: string }
      setStreamingText(prev => prev + d.text)
    })
    window.api.on('chat:done', () => {
      setStreamingText('')
      setSending(false)
      window.api.chat.history().then(setMessages)
      refreshStats()
    })
    window.api.on('chat:error', (data) => {
      const d = data as { message: string }
      setSending(false)
      setStreamingText('')
      setMessages(prev => [...prev, {
        id: Date.now().toString(), session_id: 'default',
        role: 'assistant',
        content: `⚠ Error: ${d.message}`,
        created_at: Date.now()
      }])
    })
    // Cuando Claude ejecuta un tool y modifica datos, invalidamos las queries
    // para que la UI refleje los cambios inmediatamente sin recargar
    window.api.on('chat:dataChanged', (data) => {
      const d = data as { keys: string[] }
      for (const key of d.keys) {
        if (key === 'tasks')          { qc.invalidateQueries({ queryKey: ['tasks'] }); qc.invalidateQueries({ queryKey: ['task'] }) }
        if (key === 'delegated-tasks') qc.invalidateQueries({ queryKey: ['delegated-tasks'] })
        if (key === 'comex-imports')   qc.invalidateQueries({ queryKey: ['comex-imports'] })
      }
    })
    // Alertas proactivas del scheduler (Fase 5)
    window.api.on('chat:proactiveAlerts', (data) => {
      const incoming = data as ProactiveAlert[]
      setAlerts(prev => {
        const existingIds = new Set(prev.map(a => a.id))
        const newAlerts   = incoming.filter(a => !existingIds.has(a.id))
        return newAlerts.length > 0 ? [...newAlerts, ...prev].slice(0, 20) : prev
      })
    })
    return () => {
      window.api.off('chat:chunk')
      window.api.off('chat:done')
      window.api.off('chat:error')
      window.api.off('chat:dataChanged')
      window.api.off('chat:proactiveAlerts')
    }
  }, [qc, refreshStats])

  // ── Enviar mensaje ────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return

    // Agregar mensaje del usuario inmediatamente
    const userMsg: AIChatMessage = {
      id: Date.now().toString(), session_id: 'default',
      role: 'user', content: text, created_at: Date.now()
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setSending(true)
    setStreamingText('')

    await window.api.chat.send(text)
    // El resto lo maneja el listener de 'chat:done'
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClear = async () => {
    if (!await confirm({ message: '¿Borrar el historial de esta conversación?', danger: true })) return
    await window.api.chat.clear()
    setMessages([])
    setStats(null)
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed bottom-20 right-5 z-50 flex flex-col bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
      style={{ width: '420px', height: '600px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-900/60 to-indigo-900/60 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-violet-600/80 flex items-center justify-center flex-shrink-0">
            <Bot size={15} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-none">Asistente Summit</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-[10px] text-violet-300">Claude · Tu segundo cerebro</p>
              {/* Indicador de memoria */}
              {stats && stats.total > 0 && (
                <span className={cn(
                  'text-[9px] px-1.5 py-0.5 rounded-full font-medium',
                  stats.hasCompacted
                    ? 'bg-amber-900/40 text-amber-400 border border-amber-700/40'
                    : 'bg-violet-900/40 text-violet-400 border border-violet-700/40'
                )}>
                  {stats.hasCompacted ? '🧠' : '💬'} {stats.total} msgs
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Botón alertas proactivas */}
          {aiConfigured && (
            <button
              onClick={() => setShowAlerts(v => !v)}
              className={cn(
                'relative p-1.5 rounded-lg transition-colors',
                showAlerts
                  ? 'bg-orange-600/30 text-orange-400'
                  : alerts.length > 0
                    ? 'text-orange-400 hover:bg-slate-800'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
              )}
              title="Alertas proactivas"
            >
              <BellRing size={14} />
              {alerts.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-orange-500 text-[9px] font-bold text-white flex items-center justify-center">
                  {alerts.length > 9 ? '9+' : alerts.length}
                </span>
              )}
            </button>
          )}
          {messages.length > 0 && (
            <button onClick={handleClear}
              className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
              title="Borrar historial">
              <Trash2 size={13} />
            </button>
          )}
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">
            <X size={15} />
          </button>
        </div>
      </div>

      {/* ── Panel de alertas proactivas ───────────────────────────────────── */}
      {showAlerts && (
        <div className="flex-shrink-0 border-b border-slate-700 bg-slate-900/80 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
            <span className="text-xs font-semibold text-slate-300">Alertas del sistema</span>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  setAnalyzingNow(true)
                  await window.api.chat.triggerProactive()
                  setAnalyzingNow(false)
                }}
                disabled={analyzingNow}
                className="text-[10px] text-violet-400 hover:text-violet-300 disabled:opacity-50 flex items-center gap-1"
              >
                {analyzingNow
                  ? <><Loader2 size={10} className="animate-spin" /> Analizando...</>
                  : '↻ Analizar ahora'}
              </button>
              {alerts.length > 0 && (
                <button onClick={() => setAlerts([])}
                  className="text-[10px] text-slate-500 hover:text-slate-300">
                  Limpiar
                </button>
              )}
            </div>
          </div>
          {alerts.length === 0 ? (
            <div className="px-4 py-5 text-center">
              <p className="text-xs text-slate-500">Sin alertas pendientes.</p>
              <p className="text-[10px] text-slate-600 mt-1">
                El análisis automático corre cada 4 hs.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {alerts.map(alert => {
                const colors = {
                  critical: 'border-l-red-500 bg-red-950/20',
                  warning:  'border-l-amber-500 bg-amber-950/20',
                  info:     'border-l-blue-500 bg-blue-950/10',
                }
                const icons = {
                  critical: <AlertTriangle size={12} className="text-red-400 flex-shrink-0 mt-0.5" />,
                  warning:  <AlertTriangle size={12} className="text-amber-400 flex-shrink-0 mt-0.5" />,
                  info:     <Info size={12} className="text-blue-400 flex-shrink-0 mt-0.5" />,
                }
                return (
                  <div key={alert.id}
                    className={cn('flex items-start gap-2.5 px-4 py-2.5 border-l-2', colors[alert.severity])}>
                    {icons[alert.severity]}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-200 leading-tight">{alert.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{alert.body}</p>
                    </div>
                    <button onClick={() => setAlerts(prev => prev.filter(a => a.id !== alert.id))}
                      className="text-slate-600 hover:text-slate-400 flex-shrink-0 mt-0.5">
                      <X size={11} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Sin API key */}
      {aiConfigured === false && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
          <Sparkles size={32} className="text-violet-500" />
          <p className="text-sm font-semibold text-white">API key no configurada</p>
          <p className="text-xs text-slate-400">
            Configurá tu API key de Claude en Ajustes → IA para usar el asistente.
          </p>
        </div>
      )}

      {/* Mensajes */}
      {aiConfigured !== false && (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Mensaje de bienvenida */}
          {messages.length === 0 && !sending && (
            <div className="text-center py-8 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-violet-900/50 flex items-center justify-center mx-auto">
                <Bot size={22} className="text-violet-400" />
              </div>
              <p className="text-sm font-medium text-white">¡Hola Diego!</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Soy tu segundo cerebro. Veo tus importaciones, tareas<br />
                personales y delegadas. ¿En qué te ayudo?
              </p>
              {/* Sugerencias */}
              <div className="flex flex-col gap-1.5 mt-4">
                {[
                  '¿Qué tengo pendiente y vencido hoy?',
                  '¿Qué importaciones están en aduana?',
                  'Haceme un resumen de todo lo que está activo',
                ].map((s, i) => (
                  <button key={i} onClick={() => { setInput(s); inputRef.current?.focus() }}
                    className="text-left text-xs text-slate-400 hover:text-cyan-300 hover:bg-slate-800 px-3 py-2 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Historial */}
          {messages.map((msg) => {
            // Mensaje de memoria compactada — renderizado especial
            const isCompacted = msg.content.startsWith('🧠')
            if (isCompacted) {
              return (
                <div key={msg.id} className="mx-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="h-px flex-1 bg-amber-800/30" />
                    <span className="text-[9px] text-amber-600 font-medium uppercase tracking-wide">Memoria compactada</span>
                    <div className="h-px flex-1 bg-amber-800/30" />
                  </div>
                  <div className="bg-amber-950/20 border border-amber-800/20 rounded-xl px-3 py-2">
                    <MessageContent text={msg.content.replace(/^🧠 \*\*Memoria compactada\*\* \([^)]+\):\n\n/, '')} />
                    <p className="text-[9px] text-amber-700 mt-1">
                      {new Date(msg.created_at).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                </div>
              )
            }

            return (
            <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              {msg.role === 'assistant' && (
                <div className="w-6 h-6 rounded-lg bg-violet-700/60 flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                  <Bot size={12} className="text-violet-300" />
                </div>
              )}
              <div className={cn(
                'max-w-[85%] rounded-2xl px-3.5 py-2.5',
                msg.role === 'user'
                  ? 'bg-cyan-700/80 text-white rounded-tr-sm'
                  : 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700/50'
              )}>
                {msg.role === 'user'
                  ? <p className="text-sm">{msg.content}</p>
                  : <MessageContent text={msg.content} />
                }
                <p className={cn('text-[10px] mt-1',
                  msg.role === 'user' ? 'text-cyan-200/60 text-right' : 'text-slate-600'
                )}>

                  {new Date(msg.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
            )
          })}

          {/* Streaming en tiempo real */}
          {sending && (
            <div className="flex justify-start">
              <div className="w-6 h-6 rounded-lg bg-violet-700/60 flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                <Bot size={12} className="text-violet-300" />
              </div>
              <div className="max-w-[85%] bg-slate-800 border border-slate-700/50 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                {streamingText
                  ? <MessageContent text={streamingText + '▋'} />
                  : (
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                      <Loader2 size={13} className="animate-spin" />
                      Pensando...
                    </div>
                  )
                }
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input */}
      {aiConfigured !== false && (
        <div className="px-3 py-3 border-t border-slate-700/50 flex-shrink-0 bg-slate-900/50">
          <div className="flex items-end gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 focus-within:border-violet-500 transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Preguntá sobre tus importaciones..."
              rows={1}
              disabled={sending}
              className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 resize-none focus:outline-none max-h-24 min-h-[24px] leading-6 disabled:opacity-50"
              style={{ overflowY: input.split('\n').length > 3 ? 'auto' : 'hidden' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="p-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0 mb-0.5"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
          <p className="text-[10px] text-slate-600 mt-1.5 text-center">
            Enter para enviar · Shift+Enter para nueva línea
          </p>
        </div>
      )}
    </div>
  )
}
