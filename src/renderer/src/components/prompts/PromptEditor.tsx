import { useState, useEffect, useCallback } from 'react'
import {
  Bot, Save, RotateCcw, Play, Code, Check, X, Loader2,
  AlertTriangle, ChevronRight, FileText
} from 'lucide-react'
import { cn } from '../ui/utils'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface PromptEntry {
  operation:   string
  label:       string
  description: string
  hasOverride: boolean
  notes:       string
  updated_at:  number | null
}

interface PromptDetail {
  operation:      string
  effectivePrompt:string
  defaultPrompt:  string
  override:       { system_prompt: string; notes: string; updated_at: number } | null
}

interface TestResult {
  ok:     boolean
  result?: unknown
  error?: string
}

// ── Utilidades ────────────────────────────────────────────────────────────────

function fmtDate(ts: number | null): string {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ── PromptEditor ──────────────────────────────────────────────────────────────

export default function PromptEditor() {
  const [operations,   setOperations]   = useState<PromptEntry[]>([])
  const [selected,     setSelected]     = useState<string | null>(null)
  const [detail,       setDetail]       = useState<PromptDetail | null>(null)
  const [draft,        setDraft]        = useState('')
  const [notes,        setNotes]        = useState('')
  const [isDirty,      setIsDirty]      = useState(false)
  const [isDevMode,    setIsDevMode]    = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [testing,      setTesting]      = useState(false)
  const [writing,      setWriting]      = useState(false)
  const [testResult,   setTestResult]   = useState<TestResult | null>(null)
  const [testFilePath, setTestFilePath] = useState<string | null>(null)
  const [feedback,     setFeedback]     = useState<{ type: 'ok' | 'error'; msg: string } | null>(null)
  const [_showDiff,    setShowDiff]     = useState(false)

  const showFeedback = (type: 'ok' | 'error', msg: string) => {
    setFeedback({ type, msg })
    setTimeout(() => setFeedback(null), 4000)
  }

  // ── Cargar lista de operaciones ───────────────────────────────────────────
  const loadList = useCallback(async () => {
    const list = await window.api.ai.prompts.list()
    setOperations(list)
    const devMode = await window.api.ai.prompts.isDevMode()
    setIsDevMode(devMode)
  }, [])

  useEffect(() => { loadList() }, [loadList])

  // ── Seleccionar operación ─────────────────────────────────────────────────
  const selectOperation = async (op: string) => {
    if (isDirty && !confirm('Hay cambios sin guardar. ¿Descartarlos?')) return
    setSelected(op)
    setIsDirty(false)
    setTestResult(null)
    setTestFilePath(null)
    setShowDiff(false)
    const d = await window.api.ai.prompts.get(op)
    setDetail(d)
    setDraft(d.override?.system_prompt ?? d.defaultPrompt)
    setNotes(d.override?.notes ?? '')
  }

  const handleDraftChange = (v: string) => {
    setDraft(v)
    setIsDirty(true)
    setTestResult(null)
  }

  // ── Guardar override ──────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await window.api.ai.prompts.save(selected, draft, notes)
      await loadList()
      const d = await window.api.ai.prompts.get(selected)
      setDetail(d)
      setIsDirty(false)
      showFeedback('ok', '✓ Override guardado — Claude usará este prompt desde ahora.')
    } finally { setSaving(false) }
  }

  // ── Resetear al default ───────────────────────────────────────────────────
  const handleReset = async () => {
    if (!selected || !detail) return
    if (!confirm('¿Volver al prompt original del código? Se perderá el override guardado.')) return
    await window.api.ai.prompts.reset(selected)
    await loadList()
    const d = await window.api.ai.prompts.get(selected)
    setDetail(d)
    setDraft(d.defaultPrompt)
    setNotes('')
    setIsDirty(false)
    showFeedback('ok', '↺ Volviste al prompt original.')
  }

  // ── Probar con archivo ────────────────────────────────────────────────────
  const handleSelectFile = async () => {
    const fp = await window.api.ai.prompts.selectTestFile()
    if (fp) { setTestFilePath(fp); setTestResult(null) }
  }

  const handleTest = async () => {
    if (!selected || !testFilePath) return
    setTesting(true); setTestResult(null)
    try {
      const res = await window.api.ai.prompts.test(selected, draft, testFilePath)
      setTestResult(res)
    } finally { setTesting(false) }
  }

  // ── Escribir al código ────────────────────────────────────────────────────
  const handleWriteToCode = async () => {
    if (!selected || !isDevMode) return
    if (!confirm(`¿Escribir este prompt directamente en ai.prompts.ts?\n\nEsto modifica el código fuente. Vite recargará la app automáticamente.`)) return
    setWriting(true)
    try {
      const res = await window.api.ai.prompts.writeToCode(selected, draft)
      if (res.ok) {
        showFeedback('ok', `📝 ${res.message}`)
        setIsDirty(false)
        // Actualizar el "default" que se muestra
        await selectOperation(selected)
      } else {
        showFeedback('error', res.error ?? 'Error al escribir al código')
      }
    } finally { setWriting(false) }
  }

  // ── Líneas del draft para counter ────────────────────────────────────────
  const lineCount = draft.split('\n').length
  const charCount = draft.length


  return (
    <div className="flex gap-4 h-full min-h-0">

      {/* ── Sidebar: lista de operaciones ── */}
      <div className="w-56 flex-shrink-0 space-y-1">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold px-1 mb-2">
          Operaciones
        </p>
        {operations.map(op => (
          <button
            key={op.operation}
            onClick={() => selectOperation(op.operation)}
            className={cn(
              'w-full text-left px-3 py-2.5 rounded-lg text-xs transition-colors flex items-center gap-2',
              selected === op.operation
                ? 'bg-violet-700/40 text-white border border-violet-600/50'
                : 'text-slate-400 hover:bg-slate-700 hover:text-white'
            )}
          >
            <span className={cn(
              'w-2 h-2 rounded-full flex-shrink-0',
              op.hasOverride ? 'bg-violet-400' : 'bg-slate-600'
            )} />
            <span className="flex-1 truncate">{op.label}</span>
            {selected === op.operation && <ChevronRight size={12} className="flex-shrink-0 text-violet-400" />}
          </button>
        ))}
        <div className="pt-3 px-1 space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-violet-400 flex-shrink-0" />
            <span className="text-[10px] text-slate-500">Override activo</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-600 flex-shrink-0" />
            <span className="text-[10px] text-slate-500">Default del código</span>
          </div>
          {isDevMode && (
            <div className="flex items-center gap-1.5 mt-1">
              <Code size={10} className="text-emerald-500 flex-shrink-0" />
              <span className="text-[10px] text-emerald-600">Modo dev — writeToCode disponible</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Panel principal ── */}
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-12">
            <Bot size={36} className="text-slate-700" />
            <p className="text-slate-500 text-sm">Seleccioná una operación para editar su prompt</p>
            <p className="text-slate-700 text-xs max-w-sm">
              Podés personalizar el system prompt que Claude recibe cuando analiza cada tipo de documento. Los cambios aplican inmediatamente sin reiniciar la app.
            </p>
          </div>
        ) : !detail ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin text-slate-600" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">
                    {operations.find(o => o.operation === selected)?.label}
                  </h3>
                  <span className={cn(
                    'text-[9px] px-2 py-0.5 rounded-full font-semibold',
                    detail.override
                      ? 'bg-violet-900/60 text-violet-300 border border-violet-700/50'
                      : 'bg-slate-700 text-slate-400'
                  )}>
                    {detail.override ? '⚡ Override activo' : '○ Default'}
                  </span>
                  {isDirty && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-900/50 text-amber-400 border border-amber-700/40">
                      ✏ Sin guardar
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {operations.find(o => o.operation === selected)?.description}
                </p>
                {detail.override && (
                  <p className="text-[10px] text-slate-600 mt-0.5">
                    Último cambio: {fmtDate(detail.override.updated_at)}
                  </p>
                )}
              </div>
              {/* Acciones */}
              <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                {detail.override && (
                  <button onClick={handleReset}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-700 transition-colors border border-slate-700">
                    <RotateCcw size={12} /> Default
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving || !isDirty}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40 transition-colors"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Guardar override
                </button>
                {isDevMode && (
                  <button
                    onClick={handleWriteToCode}
                    disabled={writing || !draft.trim()}
                    title="Escribe el prompt directamente en ai.prompts.ts (código fuente)"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-700 hover:bg-emerald-600 text-white disabled:opacity-40 transition-colors"
                  >
                    {writing ? <Loader2 size={12} className="animate-spin" /> : <Code size={12} />}
                    Escribir al código
                  </button>
                )}
              </div>
            </div>

            {/* Feedback */}
            {feedback && (
              <div className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-xs',
                feedback.type === 'ok'
                  ? 'bg-emerald-900/30 border border-emerald-700/40 text-emerald-300'
                  : 'bg-red-900/30 border border-red-700/40 text-red-300'
              )}>
                {feedback.type === 'ok' ? <Check size={13} /> : <AlertTriangle size={13} />}
                {feedback.msg}
              </div>
            )}

            {/* Editor */}
            <div className="flex-1 flex flex-col min-h-0 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-slate-500 uppercase tracking-wider">System Prompt</label>
                <span className="text-[10px] text-slate-600">{lineCount} líneas · {charCount} chars</span>
              </div>
              <textarea
                value={draft}
                onChange={e => handleDraftChange(e.target.value)}
                className="flex-1 w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-violet-600 resize-none leading-relaxed"
                style={{ minHeight: '300px', maxHeight: '420px' }}
                placeholder="Escribí el system prompt aquí..."
                spellCheck={false}
              />
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider">Notas</label>
                <input
                  value={notes}
                  onChange={e => { setNotes(e.target.value); setIsDirty(true) }}
                  placeholder="Por qué hiciste este cambio, qué mejoró..."
                  className="w-full mt-1 bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-slate-500"
                />
              </div>
            </div>

            {/* Zona de test */}
            <div className="border-t border-slate-700/50 pt-3 space-y-2">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                Probar con archivo
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleSelectFile}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 transition-colors"
                >
                  <FileText size={12} />
                  {testFilePath ? testFilePath.split(/[\\/]/).pop() : 'Seleccionar archivo...'}
                </button>
                <button
                  onClick={handleTest}
                  disabled={!testFilePath || testing}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-cyan-700 hover:bg-cyan-600 text-white disabled:opacity-40 transition-colors"
                >
                  {testing ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                  {testing ? 'Analizando...' : 'Probar'}
                </button>
                {testFilePath && (
                  <button onClick={() => { setTestFilePath(null); setTestResult(null) }}
                    className="text-slate-600 hover:text-slate-400 p-1">
                    <X size={12} />
                  </button>
                )}
              </div>

              {testResult && (
                <div className={cn(
                  'rounded-xl border p-3 text-xs',
                  testResult.ok
                    ? 'bg-emerald-950/20 border-emerald-700/40'
                    : 'bg-red-950/20 border-red-700/40'
                )}>
                  {testResult.ok ? (
                    <div className="space-y-2">
                      <p className="text-emerald-400 font-semibold flex items-center gap-1.5">
                        <Check size={12} /> Extracción exitosa
                      </p>
                      <pre className="text-slate-300 font-mono text-[10px] overflow-auto max-h-48 leading-relaxed whitespace-pre-wrap">
                        {JSON.stringify((testResult.result as { structured?: unknown })?.structured ?? testResult.result, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <p className="text-red-400 flex items-center gap-1.5">
                      <AlertTriangle size={12} /> {testResult.error ?? 'Error desconocido'}
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
