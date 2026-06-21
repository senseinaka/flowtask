import { useState, useEffect, useMemo } from 'react'
import { FileText, X, RefreshCw, CheckCircle2, Loader2, CheckSquare, Square, GitBranch } from 'lucide-react'
import { useGenerateEntryDocument, useSaveThreadDoc, useThreadDoc } from '../../hooks/useKnowledge'
import type { KnowledgeEntry } from '@shared/types'
import dayjs from 'dayjs'

interface Props {
  entry: KnowledgeEntry
  subEntries: KnowledgeEntry[]
  onClose: () => void
}

const DOT_COLORS = [
  'bg-blue-200 border-blue-400',
  'bg-green-200 border-green-400',
  'bg-yellow-200 border-yellow-400',
  'bg-purple-200 border-purple-400',
  'bg-rose-200 border-rose-400',
]

export default function KnowledgeThreadDocModal({ entry, subEntries, onClose }: Props) {
  const { data: savedDocData, isLoading: loadingSaved } = useThreadDoc(entry.id)
  const generateDoc = useGenerateEntryDocument()
  const saveDoc     = useSaveThreadDoc()

  const [doc, setDoc]             = useState<{ synthesis: string; keyData: string[]; nextSteps: string[] } | null>(null)
  const [checks, setChecks]       = useState<boolean[]>([])
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (loadingSaved || initialized) return
    setInitialized(true)
    if (savedDocData) {
      try {
        setDoc({
          synthesis: savedDocData.synthesis,
          keyData:   JSON.parse(savedDocData.key_data) as string[],
          nextSteps: JSON.parse(savedDocData.next_steps) as string[]
        })
        setChecks(JSON.parse(savedDocData.checks) as boolean[])
      } catch { triggerGenerate() }
    } else {
      triggerGenerate()
    }
  }, [loadingSaved, initialized])

  function triggerGenerate() {
    generateDoc.mutate(entry.id, {
      onSuccess: (d) => {
        setDoc(d)
        setChecks(d.nextSteps.map(() => false))
      }
    })
  }

  async function handleSave() {
    if (!doc) return
    await saveDoc.mutateAsync({
      entryId:    entry.id,
      synthesis:  doc.synthesis,
      keyData:    doc.keyData,
      nextSteps:  doc.nextSteps,
      checks,
      entryCount: subEntries.length + 1
    })
    onClose()
  }

  const timeline = useMemo(() =>
    [entry, ...subEntries].sort((a, b) => (a.entry_date ?? a.created_at) - (b.entry_date ?? b.created_at)),
    [entry, subEntries]
  )

  const toggleCheck = (i: number) => setChecks(prev => prev.map((v, j) => j === i ? !v : v))

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/60 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl my-4">

        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-violet-600"/>
            <span className="text-sm font-medium text-slate-800">Documento resumen</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-violet-100 text-violet-700">IA · Sonnet 4.6</span>
          </div>
          <div className="flex items-center gap-2">
            {doc && (
              <>
                <button onClick={() => { setDoc(null); triggerGenerate() }} disabled={generateDoc.isPending}
                  className="flex items-center gap-1.5 text-xs text-slate-500 border border-slate-200 hover:border-slate-300 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                  <RefreshCw size={11}/>Regenerar
                </button>
                <button onClick={handleSave} disabled={saveDoc.isPending}
                  className="flex items-center gap-1.5 text-xs text-violet-700 bg-violet-100 hover:bg-violet-200 border border-violet-200 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                  {saveDoc.isPending ? <Loader2 size={11} className="animate-spin"/> : <CheckCircle2 size={11}/>}
                  Guardar en la entrada
                </button>
              </>
            )}
            <button onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 hover:border-slate-300 text-slate-400 hover:text-slate-600 transition-colors">
              <X size={13}/>
            </button>
          </div>
        </div>

        <div className="px-8 py-7">
          <h1 className="text-xl font-medium text-slate-800 mb-1">{entry.title || '(sin título)'}</h1>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-7 flex-wrap">
            <span>{dayjs(entry.entry_date ?? entry.created_at).format('DD/MM/YYYY')} – {dayjs((subEntries[subEntries.length - 1]?.entry_date ?? subEntries[subEntries.length - 1]?.created_at) ?? (entry.entry_date ?? entry.created_at)).format('DD/MM/YYYY')}</span>
            <span>·</span>
            <span><GitBranch size={11} className="inline -mt-0.5 mr-0.5"/>{timeline.length} entrada{timeline.length !== 1 ? 's' : ''} en el hilo</span>
          </div>

          {loadingSaved || generateDoc.isPending || !doc ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 size={28} className="animate-spin text-violet-400 mb-3"/>
              <p className="text-sm">Generando documento...</p>
            </div>
          ) : (
            <>
              <div className="mb-7">
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-0.5 h-4 bg-violet-500 rounded-full"/>
                  <span className="text-[10px] font-semibold text-violet-600 uppercase tracking-wider">Síntesis</span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{doc.synthesis}</p>
              </div>

              <div className="mb-7">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-0.5 h-4 bg-violet-500 rounded-full"/>
                  <span className="text-[10px] font-semibold text-violet-600 uppercase tracking-wider">Línea de tiempo</span>
                </div>
                <div>
                  {timeline.map((e, i) => (
                    <div key={e.id} className="flex gap-3 items-start">
                      <div className="text-[10px] font-medium text-slate-400 min-w-[42px] text-right pt-0.5">
                        {dayjs(e.entry_date ?? e.created_at).format('DD MMM')}
                      </div>
                      <div className="flex flex-col items-center shrink-0">
                        <div className={`w-2 h-2 rounded-full border-[1.5px] mt-1 ${DOT_COLORS[i % DOT_COLORS.length]}`}/>
                        {i < timeline.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1 mb-1 min-h-[20px]"/>}
                      </div>
                      <div className="flex-1 pb-3">
                        <p className="text-xs text-slate-700 leading-relaxed">
                          {e.source && <span className="font-medium text-slate-500">[{e.source}] </span>}
                          {e.title || '(sin título)'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {doc.keyData.length > 0 && (
                <div className="mb-7">
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="w-0.5 h-4 bg-violet-500 rounded-full"/>
                    <span className="text-[10px] font-semibold text-violet-600 uppercase tracking-wider">Datos clave</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {doc.keyData.map((item, i) => {
                      const [label, ...rest] = item.split(':')
                      const value = rest.join(':').trim()
                      return (
                        <div key={i} className="bg-slate-50 rounded-lg px-3 py-2.5">
                          <div className="text-[10px] text-slate-400 mb-0.5">{label}</div>
                          <div className="text-sm font-medium text-slate-700">{value || item}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {doc.nextSteps.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="w-0.5 h-4 bg-violet-500 rounded-full"/>
                    <span className="text-[10px] font-semibold text-violet-600 uppercase tracking-wider">Próximos pasos</span>
                  </div>
                  <div className="space-y-2">
                    {doc.nextSteps.map((step, i) => (
                      <button key={i} onClick={() => toggleCheck(i)} className="flex items-start gap-2.5 w-full text-left group">
                        {checks[i]
                          ? <CheckSquare size={14} className="mt-0.5 shrink-0 text-violet-500"/>
                          : <Square size={14} className="mt-0.5 shrink-0 text-slate-300 group-hover:text-slate-400"/>
                        }
                        <span className={`text-xs leading-relaxed ${checks[i] ? 'line-through text-slate-400' : 'text-slate-600'}`}>{step}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
