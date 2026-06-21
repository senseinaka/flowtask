import { useState, KeyboardEvent } from 'react'
import {
  Network, ExternalLink, Search, GitBranch, Lightbulb, Loader2,
  Info, MessageSquare, GitMerge, Zap, Users, RefreshCw, Globe
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ─── Animated graph background ────────────────────────────────────────────────

const NODES = [
  { x: 8,   y: 12 }, { x: 24,  y: 24 }, { x: 40,  y: 8  }, { x: 56,  y: 20 },
  { x: 70,  y: 8  }, { x: 88,  y: 22 }, { x: 102, y: 10 }, { x: 116, y: 24 },
  { x: 132, y: 10 }, { x: 148, y: 20 }, { x: 158, y: 8  },
  { x: 14,  y: 44 }, { x: 30,  y: 52 }, { x: 48,  y: 38 }, { x: 64,  y: 54 },
  { x: 80,  y: 44 }, { x: 96,  y: 56 }, { x: 112, y: 40 }, { x: 128, y: 52 },
  { x: 144, y: 44 }, { x: 158, y: 54 }
]

const EDGES: [number, number][] = [
  [0,1],[0,2],[1,3],[2,3],[3,4],[3,5],[4,6],[5,6],[6,7],[6,8],
  [7,8],[8,9],[9,10],[1,11],[1,12],[2,13],[3,13],[4,14],[5,15],
  [6,16],[7,17],[8,18],[9,19],[10,20],[11,12],[12,13],[13,14],
  [14,15],[15,16],[16,17],[17,18],[18,19],[19,20]
]

const FLOW_EDGES = [0, 3, 5, 9, 14, 20, 27]

function GraphAnimation() {
  return (
    <svg
      viewBox="0 0 160 62"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 w-full h-full"
      style={{ opacity: 0.6 }}
    >
      <defs>
        <radialGradient id="cg" cx="60%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#a21caf" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="160" height="62" fill="url(#cg)" />

      {EDGES.map(([a, b], i) => {
        const na = NODES[a], nb = NODES[b]
        const dur = 2.5 + (i % 5) * 0.35
        const delay = (i * 0.28) % 3
        return (
          <line key={`e${i}`}
            x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
            stroke="#d946ef" strokeWidth="0.25"
          >
            <animate attributeName="stroke-opacity"
              values="0.07;0.28;0.07"
              dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
          </line>
        )
      })}

      {FLOW_EDGES.map((edgeIdx, i) => {
        const edge = EDGES[edgeIdx]
        if (!edge) return null
        const [a, b] = edge
        const na = NODES[a], nb = NODES[b]
        const dur = 3.2 + i * 0.65
        const delay = i * 1.1
        return (
          <circle key={`p${i}`} r="0.9" fill="#f0abfc">
            <animate attributeName="cx" values={`${na.x};${nb.x}`}
              dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
            <animate attributeName="cy" values={`${na.y};${nb.y}`}
              dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;0.85;0"
              dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
          </circle>
        )
      })}

      {NODES.map((n, i) => {
        const dur = 1.8 + (i % 6) * 0.3
        const delay = (i * 0.19) % 2.5
        return (
          <g key={`n${i}`}>
            <circle cx={n.x} cy={n.y} r="3" fill="#d946ef" opacity="0">
              <animate attributeName="opacity" values="0;0.12;0"
                dur={`${dur * 1.6}s`} begin={`${delay}s`} repeatCount="indefinite" />
              <animate attributeName="r" values="1.5;4.5;1.5"
                dur={`${dur * 1.6}s`} begin={`${delay}s`} repeatCount="indefinite" />
            </circle>
            <circle cx={n.x} cy={n.y} r="1.4" fill="#d946ef">
              <animate attributeName="opacity" values="0.35;0.9;0.35"
                dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
              <animate attributeName="r" values="1.1;1.9;1.1"
                dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
            </circle>
          </g>
        )
      })}
    </svg>
  )
}

// ─── Result box ───────────────────────────────────────────────────────────────

function ResultBox({ result, loading }: { result: string | null; loading: boolean }) {
  if (loading) return (
    <div className="flex items-center gap-2 text-slate-400 py-4">
      <Loader2 size={16} className="animate-spin" />
      <span className="text-sm">Consultando grafo...</span>
    </div>
  )
  if (!result) return null
  return (
    <pre className="mt-3 p-4 bg-slate-900 rounded-lg text-xs text-slate-200 font-mono whitespace-pre-wrap overflow-auto max-h-96 border border-slate-700">
      {result}
    </pre>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Tab = 'query' | 'path' | 'explain' | 'about'

export default function CortexDashboard() {
  const [tab, setTab] = useState<Tab>('query')

  const [query, setQuery]       = useState('')
  const [pathFrom, setPathFrom] = useState('')
  const [pathTo, setPathTo]     = useState('')
  const [node, setNode]         = useState('')

  const [result, setResult]   = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function run(fn: () => Promise<string>) {
    setLoading(true); setResult(null); setError(null)
    try   { setResult(await fn()) }
    catch (e) { setError(String(e)) }
    finally   { setLoading(false) }
  }

  function onKey(e: KeyboardEvent, fn: () => void) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); fn() }
  }

  const tabs: { key: Tab; icon: LucideIcon; label: string }[] = [
    { key: 'query',   icon: Search,    label: 'Consulta' },
    { key: 'path',    icon: GitBranch, label: 'Ruta' },
    { key: 'explain', icon: Lightbulb, label: 'Explicar' },
    { key: 'about',   icon: Info,      label: 'Acerca de' },
  ]

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden shrink-0" style={{ minHeight: 196 }}>
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-fuchsia-950/25 to-slate-900" />
        <GraphAnimation />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/85 via-slate-900/40 to-transparent" />

        <div className="relative z-10 px-7 py-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-fuchsia-600/20 rounded-xl border border-fuchsia-500/30 shadow-lg shadow-fuchsia-900/30">
              <Network size={22} className="text-fuchsia-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">Cortex</h1>
              <p className="text-xs text-slate-400 mt-0.5">Grafo de dependencias del código fuente</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 mb-5">
            {[
              { value: '2 650', label: 'nodos' },
              { value: '5 621', label: 'aristas' },
              { value: '114',   label: 'comunidades' },
              { value: '189',   label: 'archivos' },
            ].map(s => (
              <div key={s.label}
                className="px-3 py-1.5 bg-slate-800/70 border border-slate-700/60 rounded-lg backdrop-blur-sm">
                <span className="text-sm font-semibold text-fuchsia-300">{s.value}</span>
                <span className="text-xs text-slate-400 ml-1">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => window.api.cortex.openGraphWindow()}
              className="flex items-center gap-2 px-5 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-fuchsia-900/50 hover:shadow-fuchsia-700/60 transition-all duration-150 hover:scale-105 active:scale-95"
            >
              <Network size={15} />
              Ver grafo interactivo
            </button>
            <button
              onClick={() => window.api.cortex.openGraph()}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800/70 hover:bg-slate-700/80 text-slate-300 hover:text-white text-sm font-medium rounded-xl border border-slate-600/60 backdrop-blur-sm transition-all duration-150"
            >
              <Globe size={14} />
              Navegador
              <ExternalLink size={11} className="text-slate-500 ml-0.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 px-6 pt-3 border-b border-slate-700/60 bg-slate-800/30">
        {tabs.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => { setTab(key); setResult(null); setError(null) }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-slate-700 text-fuchsia-300 border-b-2 border-fuchsia-500'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Panel ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 px-6 py-5 overflow-y-auto">

        {tab === 'query' && (
          <div>
            <p className="text-xs text-slate-400 mb-3">
              Hacé una pregunta en lenguaje natural sobre la arquitectura del proyecto.
            </p>
            <div className="flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => onKey(e, () => run(() => window.api.cortex.query(query)))}
                placeholder="¿Cómo fluyen los datos de sync entre PowerSync y Supabase?"
                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-fuchsia-500"
              />
              <button
                onClick={() => run(() => window.api.cortex.query(query))}
                disabled={loading || !query.trim()}
                className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : 'Consultar'}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Ej: ¿Qué módulos usa KnowledgeDashboard? · ¿Dónde se maneja uploadData?
            </p>
            {error && <p className="mt-3 text-xs text-red-400 bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
            <ResultBox result={result} loading={loading} />
          </div>
        )}

        {tab === 'path' && (
          <div>
            <p className="text-xs text-slate-400 mb-3">
              Encontrá el camino más corto entre dos nodos del grafo.
            </p>
            <div className="flex gap-2 items-center">
              <input
                value={pathFrom}
                onChange={(e) => setPathFrom(e.target.value)}
                placeholder="Desde (ej: KnowledgeDashboard)"
                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-fuchsia-500"
              />
              <span className="text-slate-500 text-sm">→</span>
              <input
                value={pathTo}
                onChange={(e) => setPathTo(e.target.value)}
                placeholder="Hasta (ej: uploadData)"
                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-fuchsia-500"
              />
              <button
                onClick={() => run(() => window.api.cortex.path(pathFrom, pathTo))}
                disabled={loading || !pathFrom.trim() || !pathTo.trim()}
                className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : 'Buscar ruta'}
              </button>
            </div>
            {error && <p className="mt-3 text-xs text-red-400 bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
            <ResultBox result={result} loading={loading} />
          </div>
        )}

        {tab === 'explain' && (
          <div>
            <p className="text-xs text-slate-400 mb-3">
              Descripción en lenguaje natural de un nodo y sus conexiones directas.
            </p>
            <div className="flex gap-2">
              <input
                value={node}
                onChange={(e) => setNode(e.target.value)}
                onKeyDown={(e) => onKey(e, () => run(() => window.api.cortex.explain(node)))}
                placeholder="Nombre de componente, función o archivo (ej: uploadData)"
                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-fuchsia-500"
              />
              <button
                onClick={() => run(() => window.api.cortex.explain(node))}
                disabled={loading || !node.trim()}
                className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : 'Explicar'}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Ej: registerKnowledgeIpc · useSaveThreadDoc · getPowerSyncDb
            </p>
            {error && <p className="mt-3 text-xs text-red-400 bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
            <ResultBox result={result} loading={loading} />
          </div>
        )}

        {tab === 'about' && (
          <div className="space-y-5 max-w-2xl">

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw size={14} className="text-fuchsia-400" />
                <span className="text-sm font-semibold text-slate-100">¿El grafo se actualiza solo?</span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                <strong className="text-white">No</strong> — el grafo es una foto estática del código en el momento en que se corrió{' '}
                <code className="bg-slate-700 px-1 rounded text-xs text-fuchsia-300">graphify extract</code>.
                Los hooks de git instalados actualizan el grafo automáticamente en cada{' '}
                <code className="bg-slate-700 px-1 rounded text-xs">commit</code> y cada{' '}
                <code className="bg-slate-700 px-1 rounded text-xs">checkout</code>.
              </p>
            </div>

            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Para qué sirve</p>

            <div className="space-y-3">
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare size={14} className="text-fuchsia-400" />
                  <span className="text-sm font-semibold text-slate-100">1. Consultas en lenguaje natural</span>
                </div>
                <ul className="space-y-1 text-xs text-slate-400">
                  <li className="flex items-start gap-2"><span className="text-fuchsia-500 mt-0.5">›</span> ¿Qué partes del código se ven afectadas si cambio <code className="bg-slate-700 px-1 rounded">uploadData</code>?</li>
                  <li className="flex items-start gap-2"><span className="text-fuchsia-500 mt-0.5">›</span> ¿Cómo llegan los datos de sync desde Supabase hasta la UI?</li>
                  <li className="flex items-start gap-2"><span className="text-fuchsia-500 mt-0.5">›</span> ¿Qué módulos dependen de <code className="bg-slate-700 px-1 rounded">getPowerSyncDb</code>?</li>
                </ul>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <GitMerge size={14} className="text-fuchsia-400" />
                  <span className="text-sm font-semibold text-slate-100">2. Ruta entre componentes</span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  La ruta <code className="bg-slate-700 px-1 rounded text-xs">KnowledgeDashboard → getThreadDoc</code>{' '}
                  muestra los pasos intermedios: qué hook llama qué IPC, qué IPC llama qué query.
                </p>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={14} className="text-fuchsia-400" />
                  <span className="text-sm font-semibold text-slate-100">3. Análisis de impacto</span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Antes de modificar algo podés ver cuántas cosas dependen de ese nodo — un nodo
                  con 40 dependencias requiere más cuidado que uno con 2.
                </p>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Network size={14} className="text-fuchsia-400" />
                  <span className="text-sm font-semibold text-slate-100">4. Contexto comprimido para Claude</span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  En lugar de leer todos los archivos (lento y caro en tokens), el grafo le da a Claude
                  el mapa exacto de qué archivos son relevantes para cada pregunta.
                </p>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users size={14} className="text-fuchsia-400" />
                  <span className="text-sm font-semibold text-slate-100">5. 114 comunidades detectadas</span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Graphify agrupó automáticamente el código en 114 subsistemas relacionados.
                  En el grafo visual podés ver qué tan acoplados están — útil para detectar módulos
                  que crecieron demasiado.
                </p>
              </div>
            </div>

            <div className="bg-fuchsia-950/40 border border-fuchsia-800/40 rounded-lg p-4">
              <p className="text-sm text-slate-300 leading-relaxed">
                <strong className="text-fuchsia-300">En resumen:</strong> Cortex es para entender y navegar
                Summit sin tener que memorizar ~190 archivos. Especialmente útil antes de hacer cambios
                y necesitás saber el impacto real.
              </p>
            </div>

          </div>
        )}

      </div>
    </div>
  )
}
