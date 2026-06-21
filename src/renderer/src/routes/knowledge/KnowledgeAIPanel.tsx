import { useMemo } from 'react'
import { Sparkles, Loader2, X } from 'lucide-react'
import { useAnalyzeTopic, useTopicLatestSummary } from '../../hooks/useKnowledge'
import { parseAnalysis, fmtDate } from './KnowledgeHelpers'

const SECTION_COLOR: Record<string, string> = {
  'RESUMEN EJECUTIVO':            'text-teal-300',
  'INSIGHTS CLAVE':               'text-amber-300',
  'DECISIONES TOMADAS':           'text-blue-300',
  'PENDIENTES Y PRÓXIMOS PASOS':  'text-purple-300',
  'CONTRADICCIONES O CONFLICTOS': 'text-red-300'
}

interface Props {
  topic: string
  userId: string
  onClose: () => void
}

export default function KnowledgeAIPanel({ topic, userId, onClose }: Props) {
  const { data: latest, isLoading } = useTopicLatestSummary(topic)
  const analyze = useAnalyzeTopic()
  const sections = useMemo(() => latest?.summary ? parseAnalysis(latest.summary) : null, [latest?.summary])

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-[460px] bg-slate-900 border-l border-slate-700 shadow-2xl flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
        <div>
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Sparkles size={14} className="text-teal-400"/>Análisis IA
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">{topic}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => analyze.mutate({ topic, userId })} disabled={analyze.isPending}
            className="flex items-center gap-1.5 text-xs text-teal-400 bg-teal-900/30 hover:bg-teal-900/50 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50">
            {analyze.isPending ? <Loader2 size={11} className="animate-spin"/> : <Sparkles size={11}/>}
            {latest ? 'Re-analizar' : 'Analizar'}
          </button>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-800 transition-colors">
            <X size={14}/>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {(isLoading || analyze.isPending) ? (
          <div className="flex items-center justify-center h-32"><Loader2 size={22} className="animate-spin text-teal-400"/></div>
        ) : !sections ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-500">
            <Sparkles size={32} className="mb-3 text-slate-800"/>
            <p className="text-sm text-center">No hay análisis para este tema.</p>
            <p className="text-xs mt-1 text-slate-600">Presioná "Analizar" para generarlo con IA.</p>
          </div>
        ) : (
          <>
            {latest && <p className="text-[10px] text-slate-600">{fmtDate(latest.created_at)} · {latest.entry_count} entradas</p>}
            {Object.entries(sections).map(([h, content]) => (
              <div key={h}>
                <h4 className={`text-[10px] uppercase tracking-wider font-semibold mb-2 ${SECTION_COLOR[h] ?? 'text-slate-400'}`}>{h}</h4>
                <p className="text-[13px] text-slate-300 leading-relaxed whitespace-pre-wrap">{content}</p>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
