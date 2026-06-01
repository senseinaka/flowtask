import { useState } from 'react'
import {
  MessageCircleQuestion, Plus, Trash2, X, Check, Loader2,
  ChevronDown, Clock, CheckCircle2, AlertCircle, User
} from 'lucide-react'
import type {
  TaskQuestion, QuestionOption, QuestionAction, TaskStatus, DelegatedStatus, TaskType, Contact
} from '@shared/types'
import {
  QUESTION_ACTION_LABELS, QUESTION_TEMPLATES, STATUS_LABELS, DELEGATED_STATUS_LABELS
} from '@shared/types'
import { useQuestions, useCreateQuestion, useDeleteQuestion } from '../../hooks/useQuestions'
import { cn } from '../ui/utils'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/es'
dayjs.extend(relativeTime)
dayjs.locale('es')

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending:  'text-yellow-400',
  answered: 'text-emerald-400',
  expired:  'text-slate-600'
}

const STATUS_ICONS: Record<string, React.ElementType> = {
  pending:  Clock,
  answered: CheckCircle2,
  expired:  AlertCircle
}

const STATUS_ES: Record<string, string> = {
  pending:  'Pendiente',
  answered: 'Respondida',
  expired:  'Expirada'
}

const TASK_STATUSES: TaskStatus[] = ['pending', 'in_progress', 'blocked', 'done']
const DELEGATED_STATUSES: DelegatedStatus[] = ['pending', 'in_progress', 'done', 'cancelled']

const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣']

// ─── Single option row ────────────────────────────────────────────────────────

function OptionRow({
  option,
  index,
  taskType,
  onChange,
  onRemove,
  canRemove
}: {
  option: QuestionOption
  index: number
  taskType: TaskType
  onChange: (o: QuestionOption) => void
  onRemove: () => void
  canRemove: boolean
}) {
  const isDelegated = taskType === 'delegated'

  return (
    <div className="flex items-start gap-2 group">
      <span className="text-sm mt-1 flex-shrink-0">{NUMBER_EMOJIS[index]}</span>
      <div className="flex-1 space-y-1">
        <input
          value={option.label}
          onChange={(e) => onChange({ ...option, label: e.target.value })}
          placeholder={`Opción ${index + 1}`}
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500"
        />
        <div className="flex gap-1.5">
          <select
            value={option.action}
            onChange={(e) => onChange({ ...option, action: e.target.value as QuestionAction, action_value: null })}
            className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-xs text-slate-300 outline-none focus:border-indigo-500"
          >
            {(Object.entries(QUESTION_ACTION_LABELS) as [QuestionAction, string][]).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          {option.action === 'set_status' && (
            <select
              value={option.action_value ?? ''}
              onChange={(e) => onChange({ ...option, action_value: e.target.value || null })}
              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-xs text-slate-300 outline-none focus:border-indigo-500"
            >
              <option value="">— Estado —</option>
              {isDelegated
                ? DELEGATED_STATUSES.map((s) => (
                    <option key={s} value={s}>{DELEGATED_STATUS_LABELS[s]}</option>
                  ))
                : TASK_STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))
              }
            </select>
          )}
        </div>
      </div>
      {canRemove && (
        <button
          onClick={onRemove}
          className="mt-1 p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}

// ─── Create question modal ────────────────────────────────────────────────────

function QuestionModal({
  taskId,
  taskTitle,
  taskType,
  contacts,
  defaultPhone,
  onClose
}: {
  taskId: string
  taskTitle: string
  taskType: TaskType
  contacts: Contact[]
  defaultPhone?: string
  onClose: () => void
}) {
  const createQuestion = useCreateQuestion(taskId)

  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null)
  const [questionText, setQuestionText] = useState('')
  const [options, setOptions] = useState<QuestionOption[]>([
    { label: '', action: 'none', action_value: null },
    { label: '', action: 'none', action_value: null }
  ])
  const [phone, setPhone] = useState(defaultPhone ?? '')
  const [showContactPicker, setShowContactPicker] = useState(false)
  const [expiresInHours, setExpiresInHours] = useState(48)
  const [error, setError] = useState('')

  const applyTemplate = (idx: number) => {
    const tpl = QUESTION_TEMPLATES[idx]
    setSelectedTemplate(idx)
    setQuestionText(tpl.question)
    setOptions(tpl.options.map((o) => ({ ...o })))
  }

  const updateOption = (i: number, o: QuestionOption) => {
    setOptions((prev) => prev.map((x, j) => (j === i ? o : x)))
  }

  const addOption = () => {
    if (options.length < 4) {
      setOptions((prev) => [...prev, { label: '', action: 'none', action_value: null }])
    }
  }

  const removeOption = (i: number) => {
    setOptions((prev) => prev.filter((_, j) => j !== i))
  }

  const handleSend = async () => {
    setError('')
    if (!questionText.trim()) return setError('Escribí la pregunta.')
    if (options.some((o) => !o.label.trim())) return setError('Completá el texto de todas las opciones.')
    if (!phone.trim()) return setError('Ingresá un número de teléfono.')

    try {
      await createQuestion.mutateAsync({
        task_id: taskId,
        task_type: taskType,
        phone: phone.replace(/\D/g, ''),
        question: questionText.trim(),
        options,
        expires_in_hours: expiresInHours
      })
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo enviar la pregunta.'
      setError(msg)
    }
  }

  const selectedContactName = contacts.find((c) => c.phone === phone)?.name

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <MessageCircleQuestion size={16} className="text-indigo-400" />
            Preguntar por WhatsApp
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Task reference */}
          <div className="bg-slate-900/60 rounded-lg px-3 py-2 text-xs text-slate-400">
            📋 <span className="text-slate-300 font-medium">{taskTitle}</span>
          </div>

          {/* Quick templates */}
          <div>
            <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Plantillas rápidas</p>
            <div className="flex flex-wrap gap-1.5">
              {QUESTION_TEMPLATES.map((tpl, i) => (
                <button
                  key={i}
                  onClick={() => applyTemplate(i)}
                  className={cn(
                    'text-xs px-2.5 py-1 rounded-full border transition-colors',
                    selectedTemplate === i
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500'
                  )}
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Question text */}
          <div>
            <label className="block text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wide">Pregunta</label>
            <textarea
              rows={2}
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="¿Has terminado la tarea?"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Options */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                Opciones de respuesta
              </label>
              {options.length < 4 && (
                <button
                  onClick={addOption}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  + Agregar
                </button>
              )}
            </div>
            <div className="space-y-2.5">
              {options.map((opt, i) => (
                <OptionRow
                  key={i}
                  option={opt}
                  index={i}
                  taskType={taskType}
                  onChange={(o) => updateOption(i, o)}
                  onRemove={() => removeOption(i)}
                  canRemove={options.length > 2}
                />
              ))}
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wide">
              Destinatario
            </label>
            {contacts.length > 0 ? (
              <div className="space-y-1.5">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowContactPicker((v) => !v)}
                    className="w-full flex items-center gap-2 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-xs text-left hover:border-slate-500 transition-colors"
                  >
                    <User size={12} className="text-slate-500" />
                    <span className={phone ? 'text-slate-200' : 'text-slate-500'}>
                      {selectedContactName ?? (phone || 'Elegir contacto...')}
                    </span>
                    <ChevronDown size={11} className="ml-auto text-slate-500" />
                  </button>
                  {showContactPicker && (
                    <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden max-h-40 overflow-y-auto">
                      {contacts.filter((c) => c.phone).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { setPhone(c.phone); setShowContactPicker(false) }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-700 transition-colors"
                        >
                          <span className="font-medium text-slate-200">{c.name}</span>
                          <span className="text-slate-500 ml-auto">{c.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="O ingresá el número (ej: 5491112345678)"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500"
                />
              </div>
            ) : (
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="5491112345678"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500"
              />
            )}
          </div>

          {/* Expiration */}
          <div>
            <label className="block text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wide">
              Expiración
            </label>
            <div className="flex gap-2">
              {[
                { hours: 24, label: '24 horas' },
                { hours: 48, label: '48 horas' },
                { hours: 168, label: '7 días' }
              ].map(({ hours, label }) => (
                <button
                  key={hours}
                  onClick={() => setExpiresInHours(hours)}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    expiresInHours === hours
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
              <AlertCircle size={13} className="text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-700">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={createQuestion.isPending}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
          >
            {createQuestion.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Enviar pregunta
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Question history card ────────────────────────────────────────────────────

function QuestionCard({
  q,
  onDelete
}: {
  q: TaskQuestion
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const StatusIcon = STATUS_ICONS[q.status] ?? Clock

  return (
    <div className={cn(
      'bg-slate-700/50 border rounded-lg overflow-hidden transition-colors',
      q.status === 'answered' ? 'border-emerald-800/50' :
      q.status === 'expired'  ? 'border-slate-700 opacity-50' :
                                'border-slate-600'
    )}>
      <div className="flex items-start gap-2 px-3 py-2">
        <StatusIcon
          size={13}
          className={cn('flex-shrink-0 mt-0.5', STATUS_COLORS[q.status])}
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-200 truncate">{q.question}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn('text-[10px]', STATUS_COLORS[q.status])}>
              {STATUS_ES[q.status]}
            </span>
            {q.answer && (
              <span className="text-[10px] text-slate-400">→ &ldquo;{q.answer}&rdquo;</span>
            )}
          </div>
          {q.action_taken && (
            <p className="text-[10px] text-indigo-400 mt-0.5">{q.action_taken}</p>
          )}
          {q.status === 'pending' && (
            <p className="text-[10px] text-slate-600 mt-0.5">
              Expira {dayjs(q.expires_at).fromNow()} · Ref: {q.ref_code}
            </p>
          )}
          {q.answered_at && (
            <p className="text-[10px] text-slate-600 mt-0.5">
              {dayjs(q.answered_at).format('DD/MM HH:mm')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1 text-slate-600 hover:text-slate-400 transition-colors text-[10px]"
          >
            {expanded ? '▲' : '▼'}
          </button>
          {q.status === 'pending' && (
            <button
              onClick={onDelete}
              className="p-1 text-slate-600 hover:text-red-400 transition-colors"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-2.5 border-t border-slate-700/50 pt-2">
          <div className="space-y-1">
            {q.options.map((opt, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-center gap-2 text-[10px] rounded px-2 py-1',
                  q.answer === opt.label
                    ? 'bg-emerald-900/30 text-emerald-300'
                    : 'text-slate-500'
                )}
              >
                <span>{i + 1}.</span>
                <span className="flex-1">{opt.label}</span>
                {opt.action === 'set_status' && opt.action_value && (
                  <span className="text-slate-600">→ {STATUS_LABELS[opt.action_value]}</span>
                )}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-600 mt-1.5">Para: {q.phone} · Ref: {q.ref_code}</p>
        </div>
      )}
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function QuestionPanel({
  taskId,
  taskTitle,
  taskType = 'personal',
  contacts,
  defaultPhone
}: {
  taskId: string
  taskTitle: string
  taskType?: TaskType
  contacts: Contact[]
  defaultPhone?: string
}) {
  const { data: questions = [] } = useQuestions(taskId)
  const deleteQuestion = useDeleteQuestion(taskId)
  const [showModal, setShowModal] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide flex items-center gap-1">
          <MessageCircleQuestion size={11} />
          Preguntas WhatsApp
        </p>
        <button
          onClick={() => setShowModal(true)}
          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          + Preguntar
        </button>
      </div>

      {questions.length > 0 ? (
        <div className="space-y-1.5">
          {questions.map((q) => (
            <QuestionCard
              key={q.id}
              q={q}
              onDelete={() => deleteQuestion.mutate(q.id)}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-600">Sin preguntas enviadas</p>
      )}

      {showModal && (
        <QuestionModal
          taskId={taskId}
          taskTitle={taskTitle}
          taskType={taskType}
          contacts={contacts}
          defaultPhone={defaultPhone}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
