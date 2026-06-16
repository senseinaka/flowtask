import { useState, useEffect } from 'react'
import {
  Mail, RefreshCw, Star, Paperclip, Send, Inbox,
  Plus, Settings, Search, Trash2, Reply, Forward,
  ChevronLeft, X, Check, AlertCircle
} from 'lucide-react'
import {
  useEmailAccounts,
  useEmailMessages,
  useUnreadCount,
  useSyncEmail,
  useMarkEmailRead,
  useMarkEmailStarred,
  useDeleteEmailMessage,
  useEmailAttachments,
  useSendEmail,
  useCreateEmailAccount
} from '../../hooks/useEmail'
import type { EmailMessage, EmailAccount, CreateEmailAccountInput, SendEmailInput, EmailListFilters } from '@shared/types'
import type { LucideIcon } from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}

function parseAddresses(json: string): { name: string; email: string }[] {
  try { return JSON.parse(json) } catch { return [] }
}

function displayFrom(msg: EmailMessage): string {
  return msg.from_name || msg.from_address
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
    setLog([])
    setAllOk(false)
    setPhase('testing')
    const imap = { host: form.imap_host, port: form.imap_port ?? 993, secure: form.imap_secure !== false, user: form.username, pass: form.password }
    const smtp = { host: form.smtp_host, port: form.smtp_port ?? 465, secure: form.smtp_secure !== false, user: form.username, pass: form.password }

    // 1. IMAP connect + list folders
    upsertLog({ id: 'imap', text: `Conectando IMAP ${imap.host}:${imap.port} SSL…`, status: 'pending' })
    const r1 = await window.api.email.test.imap(imap.host, imap.port, imap.secure, imap.user, imap.pass)
    if (r1.ok) {
      upsertLog({ id: 'imap', text: 'IMAP: conexión exitosa', detail: `Carpetas: ${r1.folders?.join(', ') ?? '—'}`, status: 'ok' })
    } else {
      upsertLog({ id: 'imap', text: 'IMAP: falló la conexión', detail: r1.error, status: 'error' })
    }

    // 2. SMTP verify
    upsertLog({ id: 'smtp', text: `Verificando SMTP ${smtp.host}:${smtp.port} SSL…`, status: 'pending' })
    const r2 = await window.api.email.test.smtp(smtp.host, smtp.port, smtp.secure, smtp.user, smtp.pass)
    if (r2.ok) {
      upsertLog({ id: 'smtp', text: 'SMTP: servidor listo', status: 'ok' })
    } else {
      upsertLog({ id: 'smtp', text: 'SMTP: falló la verificación', detail: r2.error, status: 'error' })
    }

    // 3. Fetch INBOX (only if IMAP ok)
    if (r1.ok) {
      upsertLog({ id: 'fetch', text: 'Leyendo bandeja de entrada (INBOX)…', status: 'pending' })
      const r3 = await window.api.email.test.fetch(imap.host, imap.port, imap.secure, imap.user, imap.pass)
      if (r3.ok) {
        const preview = r3.subjects?.length ? `Últimos: "${r3.subjects.slice(0, 2).join('", "')}"` : 'Bandeja vacía'
        upsertLog({ id: 'fetch', text: `Recepción OK · ${r3.total ?? 0} mensajes`, detail: preview, status: 'ok' })
      } else {
        upsertLog({ id: 'fetch', text: 'Recepción: no se pudo leer INBOX', detail: r3.error, status: 'error' })
      }
    }

    // 4. Send test email (only if SMTP ok)
    if (r2.ok && form.email) {
      upsertLog({ id: 'send', text: `Enviando email de prueba a ${form.email}…`, status: 'pending' })
      const r4 = await window.api.email.test.send(smtp.host, smtp.port, smtp.secure, smtp.user, smtp.pass, form.email, form.display_name || form.email)
      if (r4.ok) {
        upsertLog({ id: 'send', text: 'Envío OK · email de prueba enviado a tu casilla', status: 'ok' })
      } else {
        upsertLog({ id: 'send', text: 'Envío: no se pudo enviar el email de prueba', detail: r4.error, status: 'error' })
      }
    }

    setAllOk(r1.ok)
    setPhase('done')
  }

  async function handleSave() {
    setSaveError('')
    try {
      await create.mutateAsync(form)
      onSaved()
      onClose()
    } catch (e) {
      setSaveError((e as Error).message ?? 'Error al guardar la cuenta')
    }
  }

  const f = (field: keyof CreateEmailAccountInput, val: string | number | boolean) =>
    setForm((p) => ({ ...p, [field]: val }))

  const canTest = !!(form.email && form.username && form.password)

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-[560px] p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Agregar cuenta de correo</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
        </div>

        {/* Form (always visible, disabled during/after test) */}
        <div className={`space-y-3 ${phase !== 'form' ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Email</label>
              <input className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white" value={form.email} onChange={(e) => f('email', e.target.value)} placeholder="correo@empresa.com" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Nombre a mostrar</label>
              <input className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white" value={form.display_name ?? ''} onChange={(e) => f('display_name', e.target.value)} placeholder="Naka Outdoors" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Usuario</label>
              <input className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white" value={form.username} onChange={(e) => f('username', e.target.value)} placeholder="usuario@empresa.com" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Contraseña</label>
              <input type="password" className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white" value={form.password} onChange={(e) => f('password', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-400 mb-1 block">Servidor IMAP</label>
              <input className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white" value={form.imap_host} onChange={(e) => f('imap_host', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Puerto IMAP</label>
              <input type="number" className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white" value={form.imap_port ?? 993} onChange={(e) => f('imap_port', parseInt(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-400 mb-1 block">Servidor SMTP</label>
              <input className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white" value={form.smtp_host} onChange={(e) => f('smtp_host', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Puerto SMTP</label>
              <input type="number" className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white" value={form.smtp_port ?? 465} onChange={(e) => f('smtp_port', parseInt(e.target.value))} />
            </div>
          </div>
        </div>

        {/* Diagnostic log */}
        {log.length > 0 && (
          <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 space-y-2">
            {log.map((entry) => (
              <div key={entry.id} className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0">
                  {entry.status === 'pending' && <RefreshCw size={13} className="text-blue-400 animate-spin" />}
                  {entry.status === 'ok' && <Check size={13} className="text-green-400" />}
                  {entry.status === 'error' && <AlertCircle size={13} className="text-red-400" />}
                </span>
                <div>
                  <p className={`text-sm leading-tight ${entry.status === 'ok' ? 'text-green-300' : entry.status === 'error' ? 'text-red-300' : 'text-gray-300'}`}>
                    {entry.text}
                  </p>
                  {entry.detail && <p className="text-xs text-gray-500 mt-0.5">{entry.detail}</p>}
                </div>
              </div>
            ))}
            {phase === 'testing' && (
              <p className="text-xs text-gray-500 mt-1">Timeout máximo por paso: 10 segundos…</p>
            )}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancelar</button>
          {phase !== 'testing' && (
            <button
              onClick={() => { setPhase('form'); runDiagnostics() }}
              disabled={!canTest}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg disabled:opacity-40 flex items-center gap-2"
            >
              <RefreshCw size={13} />
              {phase === 'done' ? 'Probar de nuevo' : 'Probar conexión'}
            </button>
          )}
          {phase === 'testing' && (
            <button disabled className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg opacity-50 flex items-center gap-2">
              <RefreshCw size={13} className="animate-spin" /> Probando…
            </button>
          )}
          {saveError && (
            <span className="text-red-400 text-xs">{saveError}</span>
          )}
          {phase === 'done' && allOk && (
            <button
              onClick={handleSave}
              disabled={create.isPending}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg flex items-center gap-2"
            >
              <Check size={13} /> Guardar cuenta
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Compose modal ─────────────────────────────────────────────────────────────

function ComposeModal({
  accountId,
  defaultTo = '',
  inReplyTo,
  references,
  onClose
}: {
  accountId: string
  defaultTo?: string
  inReplyTo?: string
  references?: string
  onClose: () => void
}) {
  const [to, setTo] = useState(defaultTo)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const send = useSendEmail()

  async function handleSend() {
    const input: SendEmailInput = {
      account_id: accountId,
      to: to.split(',').map((s) => ({ name: '', email: s.trim() })),
      subject,
      body_text: body,
      in_reply_to: inReplyTo,
      references
    }
    const r = await send.mutateAsync(input)
    if (r.ok) {
      onClose()
    } else {
      alert('Error al enviar: ' + r.error)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end justify-end p-6 z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-[560px] shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <span className="text-sm font-medium text-white">Nuevo mensaje</span>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-2 flex-1">
          <input
            placeholder="Para"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full bg-transparent border-b border-gray-700 py-1.5 text-sm text-white placeholder-gray-500 outline-none"
          />
          <input
            placeholder="Asunto"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full bg-transparent border-b border-gray-700 py-1.5 text-sm text-white placeholder-gray-500 outline-none"
          />
          <textarea
            placeholder="Escribe tu mensaje..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            className="w-full bg-transparent text-sm text-white placeholder-gray-500 outline-none resize-none"
          />
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700">
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">Descartar</button>
          <button
            onClick={handleSend}
            disabled={!to || !subject || send.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg disabled:opacity-50"
          >
            <Send size={14} />
            {send.isPending ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Message detail ─────────────────────────────────────────────────────────────

function MessageDetail({
  message,
  account,
  onBack
}: {
  message: EmailMessage
  account: EmailAccount
  onBack: () => void
}) {
  const attachments = useEmailAttachments(message.id)
  const markRead = useMarkEmailRead()
  const markStarred = useMarkEmailStarred()
  const deleteMsg = useDeleteEmailMessage()
  const [replying, setReplying] = useState(false)

  useEffect(() => {
    if (!message.is_read) {
      markRead.mutate({ id: message.id, isRead: true })
    }
  }, [message.id])

  const toAddrs = parseAddresses(message.to_addresses)
  const ccAddrs = parseAddresses(message.cc_addresses)

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
        <button onClick={onBack} className="text-gray-400 hover:text-white"><ChevronLeft size={18} /></button>
        <div className="flex-1" />
        <button onClick={() => setReplying(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg">
          <Reply size={13} /> Responder
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg">
          <Forward size={13} /> Reenviar
        </button>
        <button
          onClick={() => markStarred.mutate({ id: message.id, isStarred: !message.is_starred })}
          className={`p-1.5 rounded ${message.is_starred ? 'text-amber-400' : 'text-gray-400 hover:text-white'}`}
        >
          <Star size={16} />
        </button>
        <button
          onClick={() => { deleteMsg.mutate(message.id); onBack() }}
          className="p-1.5 rounded text-gray-400 hover:text-red-400"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <h1 className="text-xl font-semibold text-white">{message.subject}</h1>

        <div className="bg-gray-800/50 rounded-xl p-4 space-y-1.5 text-sm">
          <div className="flex gap-2"><span className="text-gray-500 w-12">De:</span><span className="text-white">{message.from_name ? `${message.from_name} <${message.from_address}>` : message.from_address}</span></div>
          {toAddrs.length > 0 && (
            <div className="flex gap-2"><span className="text-gray-500 w-12">Para:</span><span className="text-gray-300">{toAddrs.map((a) => a.name ? `${a.name} <${a.email}>` : a.email).join(', ')}</span></div>
          )}
          {ccAddrs.length > 0 && (
            <div className="flex gap-2"><span className="text-gray-500 w-12">CC:</span><span className="text-gray-300">{ccAddrs.map((a) => a.email).join(', ')}</span></div>
          )}
          <div className="flex gap-2"><span className="text-gray-500 w-12">Fecha:</span><span className="text-gray-300">{new Date(message.sent_at).toLocaleString('es-AR')}</span></div>
        </div>

        {/* Body */}
        {message.body_html ? (
          <div
            className="prose prose-invert max-w-none text-sm text-gray-200"
            dangerouslySetInnerHTML={{ __html: message.body_html }}
          />
        ) : (
          <pre className="text-sm text-gray-200 whitespace-pre-wrap font-sans">{message.body_text}</pre>
        )}

        {/* Attachments */}
        {attachments.data && attachments.data.length > 0 && (
          <div className="border-t border-gray-700 pt-4">
            <p className="text-xs text-gray-400 mb-2">Adjuntos ({attachments.data.length})</p>
            <div className="flex flex-wrap gap-2">
              {attachments.data.map((att) => (
                <div key={att.id} className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300">
                  <Paperclip size={12} />
                  <span>{att.filename}</span>
                  <span className="text-gray-500">({Math.round(att.size_bytes / 1024)}KB)</span>
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
          inReplyTo={message.message_id}
          references={[message.thread_refs, message.message_id].filter(Boolean).join(' ')}
          onClose={() => setReplying(false)}
        />
      )}
    </div>
  )
}

// ── Message list item ──────────────────────────────────────────────────────────

function MessageRow({ msg, selected, onClick }: { msg: EmailMessage; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${selected ? 'bg-gray-800' : ''} ${!msg.is_read ? 'border-l-2 border-l-blue-500' : ''}`}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-sm truncate ${!msg.is_read ? 'font-semibold text-white' : 'text-gray-300'}`}>
              {displayFrom(msg)}
            </span>
            <span className="text-xs text-gray-500 shrink-0">{formatDate(msg.sent_at)}</span>
          </div>
          <p className={`text-sm truncate mt-0.5 ${!msg.is_read ? 'text-gray-200' : 'text-gray-400'}`}>{msg.subject}</p>
          <p className="text-xs text-gray-500 truncate mt-0.5">{msg.body_text.slice(0, 80)}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0 mt-1">
          {msg.is_starred && <Star size={12} className="text-amber-400 fill-amber-400" />}
          {msg.has_attachments ? <Paperclip size={12} className="text-gray-500" /> : null}
        </div>
      </div>
    </button>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
      <Icon size={40} className="opacity-30" />
      <p className="text-sm">{text}</p>
    </div>
  )
}

// ── UnreadBadge ───────────────────────────────────────────────────────────────

function UnreadBadge({ accountId }: { accountId: string }) {
  const { data } = useUnreadCount(accountId)
  if (!data) return null
  return <span className="ml-auto bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{data}</span>
}

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

  const sync = useSyncEmail()

  const filters: EmailListFilters = {
    account_id: selectedAccountId || undefined,
    folder,
    search: search || undefined,
    only_unread: onlyUnread || undefined,
    only_starred: onlyStarred || undefined,
    limit: 100
  }
  const messages = useEmailMessages(filters)

  const activeAccount = accounts.data?.find((a) => a.id === selectedAccountId) ?? accounts.data?.[0]

  useEffect(() => {
    if (accounts.data?.length && !selectedAccountId) {
      setSelectedAccountId(accounts.data[0].id)
    }
  }, [accounts.data])

  const noAccounts = !accounts.isLoading && (!accounts.data || accounts.data.length === 0)

  if (noAccounts) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Mail size={48} className="text-gray-600" />
        <p className="text-gray-400">No hay cuentas de correo configuradas</p>
        <button
          onClick={() => setShowSetup(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg"
        >
          <Plus size={16} /> Agregar cuenta
        </button>
        {showSetup && <SetupModal onClose={() => setShowSetup(false)} onSaved={() => accounts.refetch()} />}
      </div>
    )
  }

  const folders = [
    { key: 'INBOX', label: 'Bandeja de entrada', icon: Inbox },
    { key: 'Sent', label: 'Enviados', icon: Send },
    { key: 'Trash', label: 'Papelera', icon: Trash2 }
  ]

  return (
    <div className="flex h-full bg-gray-950 text-white overflow-hidden">
      {/* Sidebar */}
      <div className="w-52 border-r border-gray-800 flex flex-col bg-gray-900/50">
        <div className="p-3">
          <button
            onClick={() => setShowCompose(true)}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg py-2 px-3"
          >
            <Plus size={14} /> Redactar
          </button>
        </div>

        <nav className="flex-1 px-2 space-y-0.5">
          {folders.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => { setFolder(key); setSelectedMsg(null) }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${folder === key ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
            >
              <Icon size={15} /> {label}
              {key === 'INBOX' && selectedAccountId && <UnreadBadge accountId={selectedAccountId} />}
            </button>
          ))}
        </nav>

        {/* Accounts */}
        <div className="border-t border-gray-800 p-2 space-y-0.5">
          {accounts.data?.map((acc) => (
            <button
              key={acc.id}
              onClick={() => { setSelectedAccountId(acc.id); setSelectedMsg(null) }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors ${selectedAccountId === acc.id ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}
            >
              <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                {acc.email[0].toUpperCase()}
              </div>
              <span className="truncate">{acc.display_name || acc.email}</span>
            </button>
          ))}
          <button
            onClick={() => setShowSetup(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-white hover:bg-gray-800"
          >
            <Settings size={13} /> Agregar cuenta
          </button>
        </div>
      </div>

      {/* Message list */}
      <div className={`flex flex-col border-r border-gray-800 ${selectedMsg ? 'w-72' : 'flex-1'}`}>
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800">
          <div className="flex-1 flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-1.5">
            <Search size={14} className="text-gray-400" />
            <input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedMsg(null) }}
              className="bg-transparent text-sm text-white placeholder-gray-500 outline-none flex-1"
            />
          </div>
          <button
            onClick={() => { setOnlyUnread((v) => !v); setSelectedMsg(null) }}
            className={`px-2 py-1.5 rounded-lg text-xs ${onlyUnread ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
          >
            No leídos
          </button>
          <button
            onClick={() => { setOnlyStarred((v) => !v); setSelectedMsg(null) }}
            className={`px-2 py-1.5 rounded-lg text-xs ${onlyStarred ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
          >
            <Star size={14} />
          </button>
          <button
            onClick={() => activeAccount && sync.mutate(activeAccount.id)}
            disabled={sync.isPending}
            className="p-1.5 text-gray-400 hover:text-white"
          >
            <RefreshCw size={15} className={sync.isPending ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {messages.isLoading && (
            <div className="flex items-center justify-center h-32 text-gray-500 text-sm">Cargando...</div>
          )}
          {!messages.isLoading && (!messages.data || messages.data.length === 0) && (
            <EmptyState icon={Mail} text="No hay mensajes" />
          )}
          {messages.data?.map((msg) => (
            <MessageRow
              key={msg.id}
              msg={msg}
              selected={selectedMsg?.id === msg.id}
              onClick={() => setSelectedMsg(msg)}
            />
          ))}
        </div>
      </div>

      {/* Message detail */}
      {selectedMsg && activeAccount ? (
        <div className="flex-1 overflow-hidden">
          <MessageDetail
            message={selectedMsg}
            account={activeAccount}
            onBack={() => setSelectedMsg(null)}
          />
        </div>
      ) : !selectedMsg && (
        <div className="flex-1">
          <EmptyState icon={Mail} text="Seleccioná un mensaje para leerlo" />
        </div>
      )}

      {showSetup && <SetupModal onClose={() => setShowSetup(false)} onSaved={() => accounts.refetch()} />}
      {showCompose && activeAccount && (
        <ComposeModal accountId={activeAccount.id} onClose={() => setShowCompose(false)} />
      )}
    </div>
  )
}
