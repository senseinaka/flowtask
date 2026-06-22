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
  embedded?: boolean
}

export default function KnowledgeAIPanel({ topic, userId, onClose, embedded }: Props) {
  const { data: latest, isLoading } = useTopicLatestSummary(topic)
  const analyze = useAnalyzeTopic()
  const sections = useMemo(() => latest?.summary ? parseAnalysis(latest.summary) : null, [latest?.summary])

  const outerStyle: React.CSSProperties = embedded
    ? { display: 'flex', flexDirection: 'column', height: '100%', borderLeft: '1px solid var(--border)', background: 'var(--surface-card)', width: '100%' }
    : {}

  return (
    <div
      className={embedded ? '' : 'fixed inset-y-0 right-0 z-50 w-[460px] bg-slate-900 border-l border-slate-700 shadow-2xl flex flex-col'}
      style={embedded ? outerStyle : {}}
    >
      <div
        className={embedded ? '' : 'flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0'}
        style={embedded ? { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 } : {}}
      >
        <div>
          <h3 style={embedded ? { fontSize: 12, fontWeight: 600, color: 'var(--text-strong)', display: 'flex', alignItems: 'center', gap: 5 } : {}}
            className={embedded ? '' : 'text-sm font-semibold text-slate-100 flex items-center gap-2'}>
            <Sparkles size={embedded ? 11 : 14} className={embedded ? '' : 'text-teal-400'} style={embedded ? { color: '#2dd4bf' } : {}}/>Análisis IA
          </h3>
          <p className={embedded ? '' : 'text-[11px] text-slate-500 mt-0.5'}
            style={embedded ? { fontSize: 10, color: 'var(--text-faint)', marginTop: 2 } : {}}>{topic}</p>
        </div>
        <div style={embedded ? { display: 'flex', alignItems: 'center', gap: 6 } : {}}
          className={embedded ? '' : 'flex items-center gap-2'}>
          <button onClick={() => analyze.mutate({ topic, userId })} disabled={analyze.isPending}
            style={embedded ? { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#2dd4bf', background: 'rgba(20,184,166,.1)', border: '1px solid rgba(20,184,166,.2)', padding: '3px 8px', borderRadius: 'var(--radius-lg)', cursor: 'pointer', opacity: analyze.isPending ? 0.5 : 1 } : {}}
            className={embedded ? '' : 'flex items-center gap-1.5 text-xs text-teal-400 bg-teal-900/30 hover:bg-teal-900/50 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50'}>
            {analyze.isPending ? <Loader2 size={10} className="animate-spin"/> : <Sparkles size={10}/>}
            {latest ? 'Re-analizar' : 'Analizar'}
          </button>
          <button onClick={onClose}
            style={embedded ? { color: 'var(--text-faint)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 'var(--radius-md)', display: 'flex' } : {}}
            className={embedded ? '' : 'text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-800 transition-colors'}>
            <X size={13}/>
          </button>
        </div>
      </div>

      <div
        className={embedded ? '' : 'flex-1 overflow-y-auto px-5 py-4 space-y-5'}
        style={embedded ? { flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14 } : {}}
      >
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
