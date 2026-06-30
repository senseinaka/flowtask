import { useState, useEffect, useRef } from 'react'
import { toast } from '../../store/toast.store'
import {
  Mail, RefreshCw, Star, Paperclip, Send, Inbox,
  Plus, Settings, Search, Trash2, Reply, ReplyAll, Forward,
  X, Check, AlertCircle, Pencil, ShieldOff, ArchiveX,
  ChevronRight, RotateCcw, MoreHorizontal
} from 'lucide-react'
import {
  useEmailAccounts,
  useEmailMessages,
  useUnreadCount,
  useSyncEmail,
  useResetEmailSync,
  useMarkEmailRead,
  useMarkEmailStarred,
  useDeleteEmailMessage,
  useEmailAttachments,
  useSendEmail,
  useCreateEmailAccount,
  usePurgeEmail,
  useRestoreEmail
} from '../../hooks/useEmail'
import type { EmailMessage, EmailAccount, CreateEmailAccountInput, SendEmailInput, EmailListFilters } from '@shared/types'
import type { LucideIcon } from 'lucide-react'
import { sanitizeHtml } from '../../lib/sanitize'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer'
  if (now.getFullYear() === d.getFullYear())
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })
}

function parseAddresses(json: string): { name: string; email: string }[] {
  try { return JSON.parse(json) } catch { return [] }
}

function displayFrom(msg: EmailMessage): string {
  return msg.from_name || msg.from_address
}

const AVATAR_COLORS = [
  'bg-blue-600', 'bg-violet-600', 'bg-emerald-600',
  'bg-amber-600', 'bg-rose-600', 'bg-cyan-600',
  'bg-orange-600', 'bg-pink-600', 'bg-teal-600', 'bg-indigo-600'
]

function getAvatarColor(str: string): string {
  if (!str) return AVATAR_COLORS[0]
  return AVATAR_COLORS[str.charCodeAt(0) % AVATAR_COLORS.length]
}

function getInitials(name: string, email: string): string {
  const src = name || email
  if (!src) return '?'
  const parts = src.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return src[0].toUpperCase()
}

// ── Setup modal ───────────────────────────────────────────────────────────────

type LogEntry = { id: string; text: string; detail?: string; status: 'pending' | 'ok' | 'error' }

function SetupModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<CreateEmailAccountInput>({
    email: '',
    display_name: '',
    imap_host: 'mail.nakaoutdoors.com.ar',
    imap_port: 993,
    imap_secure: true,
    smtp_host: 'mail.nakaoutdoors.com.ar',
    smtp_port: 465,
    smtp_secure: true,
    username: '',
    password: ''
  })
  const [phase, setPhase] = useState<'form' | 'testing' | 'done'>('form')
  const [log, setLog] = useState<LogEntry[]>([])
  const [allOk, setAllOk] = useState(false)
  const [saveError, setSaveError] = useState('')
  const create = useCreateEmailAccount()

  function upsertLog(entry: LogEntry) {
    setLog((prev) => {
      const idx = prev.findIndex((e) => e.id === entry.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = entry; return next }
      return [...prev, entry]
    })
  }

  async function runDiagnostics() {
    setLog([]); setAllOk(false); setPhase('testing')
    const imap = { host: form.imap_host, port: form.imap_port ?? 993, secure: form.imap_secure !== false, user: form.username, pass: form.password }
    const smtp = { host: form.smtp_host, port: form.smtp_port ?? 465, secure: form.smtp_secure !== false, user: form.username, pass: form.password }

    upsertLog({ id: 'imap', text: `Conectando IMAP ${imap.host}:${imap.port} SSL…`, status: 'pending' })
    const r1 = await window.api.email.test.imap(imap.host, imap.port, imap.secure, imap.user, imap.pass)
    upsertLog(r1.ok
      ? { id: 'imap', text: 'IMAP: conexión exitosa', detail: `Carpetas: ${r1.folders?.join(', ') ?? '—'}`, status: 'ok' }
      : { id: 'imap', text: 'IMAP: falló la conexión', detail: r1.error, status: 'error' })

    upsertLog({ id: 'smtp', text: `Verificando SMTP ${smtp.host}:${smtp.port} SSL…`, status: 'pending' })
    const r2 = await window.api.email.test.smtp(smtp.host, smtp.port, smtp.secure, smtp.user, smtp.pass)
    upsertLog(r2.ok
      ? { id: 'smtp', text: 'SMTP: servidor listo', status: 'ok' }
      : { id: 'smtp', text: 'SMTP: falló la verificación', detail: r2.error, status: 'error' })

    if (r1.ok) {
      upsertLog({ id: 'fetch', text: 'Leyendo bandeja de entrada…', status: 'pending' })
      const r3 = await window.api.email.test.fetch(imap.host, imap.port, imap.secure, imap.user, imap.pass)
      upsertLog(r3.ok
        ? { id: 'fetch', text: `Recepción OK · ${r3.total ?? 0} mensajes`, detail: r3.subjects?.length ? `Últimos: "${r3.subjects.slice(0, 2).join('", "')}"` : 'Bandeja vacía', status: 'ok' }
        : { id: 'fetch', text: 'Recepción: no se pudo leer INBOX', detail: r3.error, status: 'error' })
    }

    if (r2.ok && form.email) {
      upsertLog({ id: 'send', text: `Enviando email de prueba a ${form.email}…`, status: 'pending' })
      const r4 = await window.api.email.test.send(smtp.host, smtp.port, smtp.secure, smtp.user, smtp.pass, form.email, form.display_name || form.email)
      upsertLog(r4.ok
        ? { id: 'send', text: 'Envío OK · email de prueba enviado a tu casilla', status: 'ok' }
        : { id: 'send', text: 'Envío: no se pudo enviar el email de prueba', detail: r4.error, status: 'error' })
    }

    setAllOk(r1.ok); setPhase('done')
  }

  async function handleSave() {
    setSaveError('')
    try {
      await create.mutateAsync(form)
      onSaved(); onClose()
    } catch (e) {
      setSaveError((e as Error).message ?? 'Error al guardar la cuenta')
    }
  }

  const f = (field: keyof CreateEmailAccountInput, val: string | number | boolean) =>
    setForm((p) => ({ ...p, [field]: val }))
  const canTest = !!(form.email && form.username && form.password)

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-[560px] p-6 flex flex-col gap-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Agregar cuenta de correo</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={16} /></button>
        </div>
        <div className={`space-y-3 ${phase !== 'form' ? 'opacity-40 pointer-events-none' : ''}`}>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-400">Email</span>
              <input className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500" value={form.email} onChange={(e) => f('email', e.target.value)} placeholder="correo@empresa.com" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-400">Nombre a mostrar</span>
              <input className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500" value={form.display_name ?? ''} onChange={(e) => f('display_name', e.target.value)} placeholder="Naka Outdoors" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-400">Usuario</span>
              <input className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500" value={form.username} onChange={(e) => f('username', e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-400">Contraseña</span>
              <input type="password" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500" value={form.password} onChange={(e) => f('password', e.target.value)} />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col gap-1 col-span-2">
              <span className="text-xs text-gray-400">Servidor IMAP</span>
              <input className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500" value={form.imap_host} onChange={(e) => f('imap_host', e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-400">Puerto</span>
              <input type="number" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500" value={form.imap_port ?? 993} onChange={(e) => f('imap_port', parseInt(e.target.value))} />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col gap-1 col-span-2">
              <span className="text-xs text-gray-400">Servidor SMTP</span>
              <input className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500" value={form.smtp_host} onChange={(e) => f('smtp_host', e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-400">Puerto</span>
              <input type="number" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500" value={form.smtp_port ?? 465} onChange={(e) => f('smtp_port', parseInt(e.target.value))} />
            </label>
          </div>
        </div>

        {log.length > 0 && (
          <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
            {log.map((entry) => (
              <div key={entry.id} className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0">
                  {entry.status === 'pending' && <RefreshCw size={12} className="text-sky-400 animate-spin" />}
                  {entry.status === 'ok' && <Check size={12} className="text-emerald-400" />}
                  {entry.status === 'error' && <AlertCircle size={12} className="text-red-400" />}
                </span>
                <div>
                  <p className={`text-xs leading-snug ${entry.status === 'ok' ? 'text-emerald-300' : entry.status === 'error' ? 'text-red-300' : 'text-gray-300'}`}>{entry.text}</p>
                  {entry.detail && <p className="text-xs text-gray-500 mt-0.5">{entry.detail}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 justify-end pt-1">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white">Cancelar</button>
          {phase !== 'testing' && (
            <button onClick={() => { setPhase('form'); runDiagnostics() }} disabled={!canTest}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg disabled:opacity-40 flex items-center gap-2">
              <RefreshCw size={12} /> {phase === 'done' ? 'Probar de nuevo' : 'Probar conexión'}
            </button>
          )}
          {phase === 'testing' && (
            <button disabled className="px-3 py-1.5 bg-gray-700 text-white text-sm rounded-lg opacity-50 flex items-center gap-2">
              <RefreshCw size={12} className="animate-spin" /> Probando…
            </button>
          )}
          {saveError && <span className="text-red-400 text-xs">{saveError}</span>}
          {phase === 'done' && allOk && (
            <button onClick={handleSave} disabled={create.isPending}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-sm rounded-lg flex items-center gap-2">
              <Check size={12} /> Guardar cuenta
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Compose modal ─────────────────────────────────────────────────────────────

function ComposeModal({
  accountId, defaultTo = '', defaultSubject = '', inReplyTo, references, onClose
}: {
  accountId: string; defaultTo?: string; defaultSubject?: string
  inReplyTo?: string; references?: string; onClose: () => void
}) {
  const [to, setTo] = useState(defaultTo)
  const [subject, setSubject] = useState(defaultSubject)
  const [body, setBody] = useState('')
  const send = useSendEmail()

  async function handleSend() {
    const input: SendEmailInput = {
      account_id: accountId,
      to: to.split(',').map((s) => ({ name: '', email: s.trim() })),
      subject, body_text: body, in_reply_to: inReplyTo, references
    }
    const r = await send.mutateAsync(input)
    if (r.ok) onClose()
    else toast.error('Error al enviar: ' + r.error)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end justify-end p-6 z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-[560px] shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <span className="text-sm font-medium text-white">Nuevo mensaje</span>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={15} /></button>
        </div>
        <div className="p-4 space-y-0 flex-1 flex flex-col gap-0">
          <input placeholder="Para" value={to} onChange={(e) => setTo(e.target.value)}
            className="w-full bg-transparent border-b border-gray-800 py-2.5 text-sm text-white placeholder-gray-600 outline-none" />
          <input placeholder="Asunto" value={subject} onChange={(e) => setSubject(e.target.value)}
            className="w-full bg-transparent border-b border-gray-800 py-2.5 text-sm text-white placeholder-gray-600 outline-none" />
          <textarea placeholder="Escribe tu mensaje…" value={body} onChange={(e) => setBody(e.target.value)}
            rows={10} className="w-full bg-transparent pt-3 text-sm text-gray-200 placeholder-gray-600 outline-none resize-none flex-1" />
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-sm">Descartar</button>
          <button onClick={handleSend} disabled={!to || !subject || send.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm rounded-lg disabled:opacity-50">
            <Send size={13} />
            {send.isPending ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sender avatar ─────────────────────────────────────────────────────────────

function SenderAvatar({ name, email, size = 'md' }: { name: string; email: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = getInitials(name, email)
  const color = getAvatarColor(name || email)
  const sz = size === 'sm' ? 'w-7 h-7 text-[10px]' : size === 'lg' ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs'
  return (
    <div className={`${sz} ${color} rounded-full flex items-center justify-center font-semibold text-white shrink-0`}>
      {initials}
    </div>
  )
}

// ── Message detail ─────────────────────────────────────────────────────────────

function MessageDetail({ message, account, onDelete, onPurge, onRestore }: {
  message: EmailMessage; account: EmailAccount
  onDelete: () => void; onPurge: () => void; onRestore: () => void
}) {
  const attachments = useEmailAttachments(message.id)
  const markRead = useMarkEmailRead()
  const markStarred = useMarkEmailStarred()
  const [replying, setReplying] = useState(false)

  useEffect(() => {
    if (!message.is_read) markRead.mutate({ id: message.id, isRead: true })
  }, [message.id])

  const toAddrs = parseAddresses(message.to_addresses)
  const ccAddrs = parseAddresses(message.cc_addresses)
  const isSent = message.folder === 'Sent'

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Subject */}
      <div className="px-6 pt-5 pb-2 shrink-0">
        <h1 className="text-lg font-semibold text-gray-900 leading-tight">{message.subject || '(sin asunto)'}</h1>
      </div>

      {/* Sender row */}
      <div className="px-6 pb-3 shrink-0">
        <div className="flex items-start gap-3">
          <SenderAvatar
            name={isSent ? toAddrs[0]?.name ?? '' : message.from_name}
            email={isSent ? toAddrs[0]?.email ?? '' : message.from_address}
            size="lg"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 justify-between">
              <span className="text-sm font-semibold text-gray-900">
                {isSent ? (toAddrs[0]?.name || toAddrs[0]?.email || 'Enviado') : (message.from_name || message.from_address)}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => markStarred.mutate({ id: message.id, isStarred: !message.is_starred })}
                  className={`p-1 rounded transition-colors ${message.is_starred ? 'text-amber-400' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <Star size={15} className={message.is_starred ? 'fill-amber-400' : ''} />
                </button>
                <span className="text-xs text-gray-400 ml-1">{new Date(message.sent_at).toLocaleString('es-AR')}</span>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-0.5 space-y-0.5">
              {isSent ? (
                <span>Para: {toAddrs.map((a) => a.name ? `${a.name} <${a.email}>` : a.email).join(', ')}</span>
              ) : (
                <span>De: {message.from_address}</span>
              )}
              {!isSent && toAddrs.length > 0 && (
                <div>Para: {toAddrs.map((a) => a.name ? `${a.name} <${a.email}>` : a.email).join(', ')}</div>
              )}
              {ccAddrs.length > 0 && (
                <div>CC: {ccAddrs.map((a) => a.email).join(', ')}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons bar */}
      <div className="flex items-center gap-1.5 px-6 py-2 border-t border-b border-gray-200 shrink-0">
        {message.folder === 'Trash' ? (
          <>
            <button onClick={onRestore}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 rounded transition-colors">
              <RotateCcw size={13} /> Recuperar
            </button>
            <div className="flex-1" />
            <button onClick={onPurge}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded transition-colors">
              <Trash2 size={13} /> Eliminar permanentemente
            </button>
          </>
        ) : (
          <>
            {!isSent && (
              <button onClick={() => setReplying(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 rounded transition-colors">
                <Reply size={13} /> Responder
              </button>
            )}
            {!isSent && (
              <button onClick={() => setReplying(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 rounded transition-colors">
                <ReplyAll size={13} /> Responder a todos
              </button>
            )}
            <button onClick={() => setReplying(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 rounded transition-colors">
              <Forward size={13} /> Reenviar
            </button>
            <button
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 rounded transition-colors">
              <MoreHorizontal size={13} />
            </button>
            <div className="flex-1" />
            <button onClick={onDelete}
              className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>


      {/* Body */}
      <div className="flex-1 overflow-y-auto bg-white">
        {message.body_html ? (
          <EmailBody html={message.body_html} />
        ) : (
          <div className="px-6 py-5">
            <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">{message.body_text}</pre>
          </div>
        )}

        {attachments.data && attachments.data.length > 0 && (
          <div className="px-6 pb-5 border-t border-gray-200">
            <p className="text-xs text-gray-400 mt-4 mb-3 font-medium uppercase tracking-wide">
              Adjuntos ({attachments.data.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {attachments.data.map((att) => (
                <div key={att.id} className="flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700">
                  <Paperclip size={11} className="text-gray-400" />
                  <span>{att.filename}</span>
                  <span className="text-gray-300">·</span>
                  <span className="text-gray-400">{Math.round(att.size_bytes / 1024)} KB</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {replying && (
        <ComposeModal
          accountId={account.id}
          defaultTo={message.from_address}
          defaultSubject={message.subject.startsWith('Re:') ? message.subject : `Re: ${message.subject}`}
          inReplyTo={message.message_id}
          references={[message.thread_refs, message.message_id].filter(Boolean).join(' ')}
          onClose={() => setReplying(false)}
        />
      )}
    </div>
  )
}

// ── Message row ───────────────────────────────────────────────────────────────

function MessageRow({ msg, selected, onClick, onContextMenu }: {
  msg: EmailMessage; selected: boolean; onClick: () => void
  onContextMenu: (x: number, y: number) => void
}) {
  const [hovered, setHovered] = useState(false)
  const isSent = msg.folder === 'Sent'
  const toAddrs = isSent ? parseAddresses(msg.to_addresses) : []
  const displayName = isSent
    ? (toAddrs[0]?.name || toAddrs[0]?.email || 'Enviado')
    : displayFrom(msg)
  const displayEmail = isSent ? (toAddrs[0]?.email ?? '') : msg.from_address
  const markRead = useMarkEmailRead()
  const isUnread = !msg.is_read

  return (
    <div
      className={`w-full flex border-b border-gray-200 transition-colors
        ${selected ? 'bg-blue-50' : hovered ? 'bg-gray-50' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e.clientX, e.clientY) }}
    >
      {/* Unread left-bar — click to toggle read/unread */}
      <button
        onClick={(e) => { e.stopPropagation(); markRead.mutate({ id: msg.id, isRead: !isUnread }) }}
        title={isUnread ? 'Marcar como leído' : 'Marcar como no leído'}
        className="w-4 shrink-0 self-stretch flex items-stretch hover:bg-blue-100 transition-colors cursor-pointer"
      >
        <span className={`w-[3px] self-stretch transition-colors ${isUnread ? 'bg-blue-500' : 'group-hover:bg-blue-200'}`} />
      </button>

      {/* Main row — click to open */}
      <button onClick={onClick} className="flex-1 text-left px-3 py-3 min-w-0">
        <div className="flex items-start gap-3">
          <SenderAvatar name={displayName} email={displayEmail} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-sm truncate ${isUnread ? 'font-bold text-gray-900' : 'font-normal text-gray-600'}`}>
                {displayName}
              </span>
              <span className="text-[11px] text-gray-400 shrink-0">{formatDate(msg.sent_at)}</span>
            </div>
            <p className={`text-xs truncate mt-0.5 ${isUnread ? 'font-semibold text-blue-600' : 'text-gray-500'}`}>
              {msg.subject || '(sin asunto)'}
            </p>
            <p className="text-[11px] text-gray-400 truncate mt-0.5">
              {msg.body_text.slice(0, 90).replace(/\s+/g, ' ')}
            </p>
          </div>
          <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
            {msg.is_starred && <Star size={11} className="text-amber-400 fill-amber-400" />}
            {msg.has_attachments ? <Paperclip size={11} className="text-gray-400" /> : null}
          </div>
        </div>
      </button>
    </div>
  )
}

// ── Context menu ─────────────────────────────────────────────────────────────

function ContextMenu({ msg, x, y, onClose, onReply, onReplyAll, onForward, onDelete, onPurge, onRestore }: {
  msg: EmailMessage; x: number; y: number
  onClose: () => void; onReply: () => void; onReplyAll: () => void; onForward: () => void
  onDelete: () => void; onPurge: () => void; onRestore: () => void
}) {
  const markRead = useMarkEmailRead()
  const markStarred = useMarkEmailStarred()
  const isTrash = msg.folder === 'Trash'
  const isSent = msg.folder === 'Sent'

  const safeX = Math.min(x, window.innerWidth - 212)
  const safeY = Math.min(y, window.innerHeight - (isTrash ? 120 : 260))

  function act(fn: () => void) { fn(); onClose() }

  const itemCls = 'w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left transition-colors'

  return (
    <div
      className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-[200px]"
      style={{ left: safeX, top: safeY }}
      onClick={(e) => e.stopPropagation()}
    >
      {isTrash ? (
        <>
          <button className={itemCls} onClick={() => act(onRestore)}>
            <RotateCcw size={13} className="text-gray-400" /> Recuperar
          </button>
          <div className="h-px bg-gray-100 my-1" />
          <button
            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 text-left transition-colors"
            onClick={() => act(onPurge)}
          >
            <Trash2 size={13} /> Eliminar permanentemente
          </button>
        </>
      ) : (
        <>
          {!isSent && (
            <button className={itemCls} onClick={() => act(onReply)}>
              <Reply size={13} className="text-gray-400" /> Responder
            </button>
          )}
          {!isSent && (
            <button className={itemCls} onClick={() => act(onReplyAll)}>
              <ReplyAll size={13} className="text-gray-400" /> Responder a todos
            </button>
          )}
          <button className={itemCls} onClick={() => act(onForward)}>
            <Forward size={13} className="text-gray-400" /> Reenviar
          </button>
          <div className="h-px bg-gray-100 my-1" />
          <button className={itemCls} onClick={() => act(() => markRead.mutate({ id: msg.id, isRead: !msg.is_read }))}>
            <Mail size={13} className="text-gray-400" />
            {msg.is_read ? 'Marcar como no leído' : 'Marcar como leído'}
          </button>
          <button className={itemCls} onClick={() => act(() => markStarred.mutate({ id: msg.id, isStarred: !msg.is_starred }))}>
            <Star size={13} className={msg.is_starred ? 'text-amber-400 fill-amber-400' : 'text-gray-400'} />
            {msg.is_starred ? 'Quitar destacado' : 'Destacar'}
          </button>
          <div className="h-px bg-gray-100 my-1" />
          <button
            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 text-left transition-colors"
            onClick={() => act(onDelete)}
          >
            <Trash2 size={13} /> Eliminar
          </button>
        </>
      )}
    </div>
  )
}

// ── Unread badge ──────────────────────────────────────────────────────────────

function UnreadBadge({ accountId }: { accountId: string }) {
  const { data } = useUnreadCount(accountId)
  if (!data) return null
  return (
    <span className="ml-auto text-blue-600 text-[11px] font-semibold">
      {data > 99 ? '99+' : data}
    </span>
  )
}

// ── Email body (sandboxed iframe to prevent CSS bleed) ────────────────────────

function EmailBody({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(400)

  useEffect(() => {
    setHeight(400)
    const frame = ref.current
    if (!frame) return
    const onLoad = () => {
      try {
        if (frame.contentDocument?.body) {
          setHeight(Math.max(80, frame.contentDocument.body.scrollHeight + 24))
        }
      } catch { /* cross-origin */ }
    }
    frame.addEventListener('load', onLoad)
    return () => frame.removeEventListener('load', onLoad)
  }, [html])

  const safeStyle = [
    '<base target="_blank">',
    '<style>',
    '*{max-width:100%!important;box-sizing:border-box;}',
    'img{height:auto!important;}',
    'body{margin:0;padding:0 24px 24px;font-family:-apple-system,system-ui,"Segoe UI",sans-serif;font-size:14px;color:#111827;line-height:1.6;}',
    'a{color:#2563eb;}',
    'pre,code{white-space:pre-wrap;word-break:break-all;}',
    '</style>'
  ].join('')

  // Saneo defensa-en-profundidad: aunque el iframe no permite scripts, se
  // elimina <script>/on*/javascript: del HTML del email (no confiable) antes
  // de inyectarlo en el srcDoc.
  const isDoc = /<html[\s>]/i.test(html)
  const clean = sanitizeHtml(html, { wholeDocument: isDoc })
  const srcDoc = isDoc
    ? clean.replace(/<\/head>/i, safeStyle + '</head>')
    : `<!DOCTYPE html><html><head><meta charset="utf-8">${safeStyle}</head><body>${clean}</body></html>`

  return (
    <iframe
      ref={ref}
      srcDoc={srcDoc}
      sandbox="allow-same-origin allow-popups"
      style={{ width: '100%', height, border: 'none', display: 'block' }}
      title="email-body"
    />
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3 select-none">
      <Icon size={36} className="opacity-30" />
      <p className="text-sm">{text}</p>
    </div>
  )
}

// ── Folder list ───────────────────────────────────────────────────────────────

const FOLDER_DEFS = [
  { key: 'INBOX', label: 'Bandeja de entrada', icon: Inbox },
  { key: 'Sent',  label: 'Enviados',            icon: Send },
  { key: 'Drafts', label: 'Borradores',         icon: Pencil },
  { key: 'Junk',  label: 'Spam',               icon: ShieldOff },
  { key: 'Trash', label: 'Papelera',            icon: Trash2 },
]

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function EmailDashboard() {
  const accounts = useEmailAccounts()
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [folder, setFolder] = useState('INBOX')
  const [search, setSearch] = useState('')
  const [onlyUnread, setOnlyUnread] = useState(false)
  const [onlyStarred, setOnlyStarred] = useState(false)
  const [selectedMsg, setSelectedMsg] = useState<EmailMessage | null>(null)
  const [showSetup, setShowSetup] = useState(false)
  const [showCompose, setShowCompose] = useState(false)
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set())

  const sync = useSyncEmail()
  const resetSync = useResetEmailSync()
  const [confirmReset, setConfirmReset] = useState(false)
  const [syncProgress, setSyncProgress] = useState<{ synced: number; total: number } | null>(null)

  useEffect(() => {
    if (!sync.isPending) { setSyncProgress(null); return }
    const unsub = window.api.email.onSyncProgress((data) => {
      if (data.accountId === selectedAccountId) setSyncProgress({ synced: data.synced, total: data.total })
    })
    return unsub
  }, [sync.isPending, selectedAccountId])

  useEffect(() => {
    if (accounts.data?.length && !selectedAccountId) {
      const first = accounts.data[0]
      setSelectedAccountId(first.id)
      setExpandedAccounts(new Set([first.id]))
    }
  }, [accounts.data])

  const filters: EmailListFilters = {
    account_id: selectedAccountId || undefined,
    folder,
    search: search || undefined,
    only_unread: onlyUnread || undefined,
    only_starred: onlyStarred || undefined,
    limit: 150
  }
  const messages = useEmailMessages(filters)
  const activeAccount = accounts.data?.find((a) => a.id === selectedAccountId) ?? accounts.data?.[0]
  const noAccounts = !accounts.isLoading && (!accounts.data || accounts.data.length === 0)

  const deleteMsg = useDeleteEmailMessage()
  const purgeMsg = usePurgeEmail()
  const restoreMsg = useRestoreEmail()
  const [sidebarW, setSidebarW] = useState(224)
  const [listW, setListW] = useState(304)
  const [contextMenu, setContextMenu] = useState<{ msg: EmailMessage; x: number; y: number } | null>(null)
  const [replyTo, setReplyTo] = useState<{ msg: EmailMessage; mode: 'reply' | 'replyAll' | 'forward' } | null>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setContextMenu(null); return }
      if (e.key !== 'Delete') return
      const tag = (document.activeElement as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (!selectedMsg || !messages.data) return
      const idx = messages.data.findIndex((m) => m.id === selectedMsg.id)
      const next = messages.data[idx + 1] ?? messages.data[idx - 1] ?? null
      if (folder === 'Trash') {
        purgeMsg.mutate(selectedMsg.id)
      } else {
        deleteMsg.mutate(selectedMsg.id)
      }
      setSelectedMsg(next)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selectedMsg, messages.data, deleteMsg, purgeMsg, folder])

  function selectFolder(key: string) {
    setFolder(key)
    setSelectedMsg(null)
    setSearch('')
  }

  function selectAccount(id: string) {
    setSelectedAccountId(id)
    setSelectedMsg(null)
    setExpandedAccounts((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function startDrag(
    e: React.MouseEvent,
    setter: (w: number) => void,
    min: number,
    max: number,
    currentW: number
  ) {
    e.preventDefault()
    const startX = e.clientX
    const startW = currentW
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    const onMove = (ev: MouseEvent) => {
      setter(Math.max(min, Math.min(max, startW + (ev.clientX - startX))))
    }
    const onUp = () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  if (noAccounts) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 bg-white">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
          <Mail size={32} className="text-gray-400" />
        </div>
        <div className="text-center">
          <p className="text-gray-900 font-medium">No hay cuentas de correo</p>
          <p className="text-gray-500 text-sm mt-1">Agregá una cuenta para empezar a leer tus emails</p>
        </div>
        <button onClick={() => setShowSetup(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors">
          <Plus size={15} /> Agregar cuenta
        </button>
        {showSetup && <SetupModal onClose={() => setShowSetup(false)} onSaved={() => accounts.refetch()} />}
      </div>
    )
  }

  return (
    <div className="flex h-full bg-white overflow-hidden" onClick={() => setContextMenu(null)}>

      {/* ── Folder sidebar ── */}
      <div className="flex flex-col bg-white shrink-0" style={{ width: sidebarW }}>
        <div className="p-3 border-b border-gray-200">
          <button onClick={() => setShowCompose(true)}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-full py-2 transition-colors">
            <Plus size={14} /> Redactar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {accounts.data?.map((acc) => {
            const expanded = expandedAccounts.has(acc.id)
            const isActive = selectedAccountId === acc.id
            return (
              <div key={acc.id}>
                {/* Account header */}
                <button
                  onClick={() => selectAccount(acc.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors group
                    ${isActive ? 'text-blue-600' : 'text-gray-700 hover:text-gray-900'}`}
                >
                  <div className={`w-5 h-5 rounded-full ${getAvatarColor(acc.email)} flex items-center justify-center text-[9px] font-bold text-white shrink-0`}>
                    {acc.email[0].toUpperCase()}
                  </div>
                  <span className="truncate font-medium">{acc.display_name || acc.email}</span>
                  <ChevronRight size={11} className={`ml-auto shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                </button>

                {/* Folder list */}
                {expanded && (
                  <div className="ml-2">
                    {FOLDER_DEFS.map(({ key, label, icon: Icon }) => (
                      <button
                        key={key}
                        onClick={() => { setSelectedAccountId(acc.id); selectFolder(key) }}
                        className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs transition-colors
                          ${folder === key && selectedAccountId === acc.id
                            ? 'bg-blue-50 text-blue-700 font-semibold'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
                      >
                        <Icon size={13} className="shrink-0" />
                        <span className="truncate">{label}</span>
                        {key === 'INBOX' && <UnreadBadge accountId={acc.id} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-2">
          <button onClick={() => setShowSetup(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <Settings size={13} /> Agregar cuenta
          </button>
        </div>
      </div>

      {/* ── Resize handle: sidebar / list ── */}
      <div
        className="w-1 shrink-0 cursor-col-resize bg-gray-200 hover:bg-blue-400 transition-colors select-none"
        onMouseDown={(e) => startDrag(e, setSidebarW, 160, 320, sidebarW)}
      />

      {/* ── Message list ── */}
      <div className="flex flex-col shrink-0" style={{ width: listW }}>
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200 shrink-0">
          <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-lg px-2.5 py-1.5">
            <Search size={13} className="text-gray-400 shrink-0" />
            <input
              placeholder="Buscar en correos…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedMsg(null) }}
              className="bg-transparent text-xs text-gray-900 placeholder-gray-400 outline-none flex-1"
            />
          </div>
          <button
            onClick={() => { setOnlyUnread((v) => !v); setSelectedMsg(null) }}
            className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${onlyUnread ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
          >
            No leídos
          </button>
          <button
            onClick={() => { setOnlyStarred((v) => !v); setSelectedMsg(null) }}
            className={`p-1.5 rounded-lg transition-colors ${onlyStarred ? 'text-amber-500' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
          >
            <Star size={14} />
          </button>
          <button
            onClick={() => activeAccount && sync.mutate({ accountId: activeAccount.id, folder })}
            disabled={sync.isPending}
            title="Sincronizar"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <RefreshCw size={14} className={sync.isPending ? 'animate-spin' : ''} />
          </button>
          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              title="Re-sincronizar todo (borra mensajes locales y vuelve a descargar)"
              className="p-1.5 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-gray-100 transition-colors"
            >
              <RotateCcw size={14} />
            </button>
          ) : (
            <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
              <span className="text-[10px] text-amber-700 whitespace-nowrap">¿Re-sincronizar todo?</span>
              <button
                onClick={async () => {
                  setConfirmReset(false)
                  if (!activeAccount) return
                  await resetSync.mutateAsync(activeAccount.id)
                  sync.mutate({ accountId: activeAccount.id, folder: 'INBOX' })
                }}
                disabled={resetSync.isPending}
                className="px-1.5 py-0.5 bg-amber-600 hover:bg-amber-700 text-white text-[10px] rounded disabled:opacity-50"
              >
                {resetSync.isPending ? '…' : 'Sí'}
              </button>
              <button onClick={() => setConfirmReset(false)} className="text-gray-400 hover:text-gray-600">
                <X size={11} />
              </button>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {sync.isPending && (
          <div className="px-3 py-2 border-b border-gray-200 shrink-0">
            <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
              {syncProgress ? (
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-200"
                  style={{ width: `${Math.min(100, (syncProgress.synced / syncProgress.total) * 100)}%` }}
                />
              ) : (
                <div className="h-full bg-blue-400 rounded-full animate-pulse w-full" />
              )}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              {syncProgress
                ? `Descargando ${syncProgress.synced} / ${syncProgress.total} mensajes…`
                : 'Conectando…'}
            </p>
          </div>
        )}

        {/* Folder title + count */}
        <div className="px-4 py-2 border-b border-gray-200 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {FOLDER_DEFS.find((f) => f.key === folder)?.label ?? folder}
            </span>
            {messages.data && (
              <span className="text-xs text-gray-400">{messages.data.length} mensajes</span>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {messages.isLoading && (
            <div className="flex items-center justify-center h-20 gap-2 text-gray-400 text-xs">
              <RefreshCw size={13} className="animate-spin" /> Cargando…
            </div>
          )}
          {!messages.isLoading && (!messages.data || messages.data.length === 0) && (
            <EmptyState icon={ArchiveX} text="No hay mensajes aquí" />
          )}
          {messages.data?.map((msg) => (
            <MessageRow
              key={msg.id}
              msg={msg}
              selected={selectedMsg?.id === msg.id}
              onClick={() => setSelectedMsg(msg)}
              onContextMenu={(x, y) => { setSelectedMsg(msg); setContextMenu({ msg, x, y }) }}
            />
          ))}
        </div>
      </div>

      {/* ── Resize handle: list / reading pane ── */}
      <div
        className="w-1 shrink-0 cursor-col-resize bg-gray-200 hover:bg-blue-400 transition-colors select-none"
        onMouseDown={(e) => startDrag(e, setListW, 220, 480, listW)}
      />

      {/* ── Reading pane ── */}
      <div className="flex-1 overflow-hidden">
        {selectedMsg && activeAccount ? (
          <MessageDetail
            message={selectedMsg}
            account={activeAccount}
            onDelete={() => {
              const idx = (messages.data ?? []).findIndex((m) => m.id === selectedMsg.id)
              const next = (messages.data ?? [])[idx + 1] ?? (messages.data ?? [])[idx - 1] ?? null
              deleteMsg.mutate(selectedMsg.id)
              setSelectedMsg(next)
            }}
            onPurge={() => {
              const idx = (messages.data ?? []).findIndex((m) => m.id === selectedMsg.id)
              const next = (messages.data ?? [])[idx + 1] ?? (messages.data ?? [])[idx - 1] ?? null
              purgeMsg.mutate(selectedMsg.id)
              setSelectedMsg(next)
            }}
            onRestore={() => {
              const idx = (messages.data ?? []).findIndex((m) => m.id === selectedMsg.id)
              const next = (messages.data ?? [])[idx + 1] ?? (messages.data ?? [])[idx - 1] ?? null
              restoreMsg.mutate(selectedMsg.id)
              setSelectedMsg(next)
            }}
          />
        ) : (
          <EmptyState icon={Mail} text="Seleccioná un mensaje para leerlo" />
        )}
      </div>

      {showSetup && <SetupModal onClose={() => setShowSetup(false)} onSaved={() => accounts.refetch()} />}
      {showCompose && activeAccount && (
        <ComposeModal accountId={activeAccount.id} onClose={() => setShowCompose(false)} />
      )}
      {replyTo && activeAccount && (
        <ComposeModal
          accountId={activeAccount.id}
          defaultTo={
            replyTo.mode === 'reply' ? replyTo.msg.from_address :
            replyTo.mode === 'replyAll'
              ? [replyTo.msg.from_address, ...parseAddresses(replyTo.msg.to_addresses).map((a) => a.email)].join(', ')
              : ''
          }
          defaultSubject={
            replyTo.mode === 'forward'
              ? (replyTo.msg.subject.startsWith('Fwd:') ? replyTo.msg.subject : `Fwd: ${replyTo.msg.subject}`)
              : (replyTo.msg.subject.startsWith('Re:') ? replyTo.msg.subject : `Re: ${replyTo.msg.subject}`)
          }
          inReplyTo={replyTo.mode !== 'forward' ? replyTo.msg.message_id : undefined}
          references={replyTo.mode !== 'forward' ? [replyTo.msg.thread_refs, replyTo.msg.message_id].filter(Boolean).join(' ') : undefined}
          onClose={() => setReplyTo(null)}
        />
      )}
      {contextMenu && (
        <ContextMenu
          msg={contextMenu.msg}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onReply={() => setReplyTo({ msg: contextMenu.msg, mode: 'reply' })}
          onReplyAll={() => setReplyTo({ msg: contextMenu.msg, mode: 'replyAll' })}
          onForward={() => setReplyTo({ msg: contextMenu.msg, mode: 'forward' })}
          onDelete={() => {
            const m = contextMenu.msg
            const idx = (messages.data ?? []).findIndex((x) => x.id === m.id)
            const next = (messages.data ?? [])[idx + 1] ?? (messages.data ?? [])[idx - 1] ?? null
            deleteMsg.mutate(m.id)
            if (selectedMsg?.id === m.id) setSelectedMsg(next)
          }}
          onPurge={() => {
            const m = contextMenu.msg
            const idx = (messages.data ?? []).findIndex((x) => x.id === m.id)
            const next = (messages.data ?? [])[idx + 1] ?? (messages.data ?? [])[idx - 1] ?? null
            purgeMsg.mutate(m.id)
            if (selectedMsg?.id === m.id) setSelectedMsg(next)
          }}
          onRestore={() => {
            const m = contextMenu.msg
            const idx = (messages.data ?? []).findIndex((x) => x.id === m.id)
            const next = (messages.data ?? [])[idx + 1] ?? (messages.data ?? [])[idx - 1] ?? null
            restoreMsg.mutate(m.id)
            if (selectedMsg?.id === m.id) setSelectedMsg(next)
          }}
        />
      )}
    </div>
  )
}
