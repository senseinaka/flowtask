import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PackageSearch, Search, ChevronRight, FileCheck2, Filter } from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
dayjs.locale('es')

import { useComexImports } from '../../hooks/useComex'
import type { ComexImport } from '@shared/types'
import { cn } from '../../components/ui/utils'

// ── Helpers ───────────────────────────────────────────────────────────────────

const brandOf = (imp: ComexImport): string =>
  imp.supplier?.brand?.trim() || imp.supplier?.name?.trim() || 'Sin marca'

const fmtDate = (ts?: number | null): string => (ts ? dayjs(ts).format('DD/MM/YYYY') : '—')

function fmtMoney(amount?: number | null, currency?: string | null): string {
  if (amount == null) return '—'
  const cur = (currency || 'USD').toUpperCase()
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(amount)
  } catch {
    return `${cur} ${amount.toLocaleString('es-AR')}`
  }
}

/** Suma de montos de despacho agrupada por moneda, para el subtotal por marca. */
function despachoTotals(items: ComexImport[]): Record<string, number> {
  const acc: Record<string, number> = {}
  for (const it of items) {
    if (it._despacho_amount == null) continue
    const cur = (it._despacho_currency || 'USD').toUpperCase()
    acc[cur] = (acc[cur] ?? 0) + it._despacho_amount
  }
  return acc
}

const hasDespacho = (imp: ComexImport): boolean =>
  Boolean(imp._despacho_number) || imp._oficializacion_date != null || imp._despacho_amount != null

// ── Component ──────────────────────────────────────────────────────────────────

export default function ComexTracking() {
  const { data: imports = [], isLoading } = useComexImports()
  const [query, setQuery] = useState('')
  const [onlyDespachadas, setOnlyDespachadas] = useState(false)

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = imports.filter((imp) => {
      if (onlyDespachadas && !hasDespacho(imp)) return false
      if (!q) return true
      return (
        brandOf(imp).toLowerCase().includes(q) ||
        (imp.title ?? '').toLowerCase().includes(q) ||
        (imp._despacho_number ?? '').toLowerCase().includes(q)
      )
    })
    const map = new Map<string, ComexImport[]>()
    for (const imp of filtered) {
      const brand = brandOf(imp)
      if (!map.has(brand)) map.set(brand, [])
      map.get(brand)!.push(imp)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'))
  }, [imports, query, onlyDespachadas])

  const totalImports = useMemo(() => groups.reduce((n, [, items]) => n + items.length, 0), [groups])
  const totalDespachadas = useMemo(
    () => groups.reduce((n, [, items]) => n + items.filter(hasDespacho).length, 0),
    [groups]
  )

  return (
    <div className="h-full overflow-y-auto bg-slate-900">
      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <PackageSearch size={20} className="text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Seguimiento de importaciones</h1>
              <p className="text-xs text-slate-400">
                {groups.length} {groups.length === 1 ? 'marca' : 'marcas'} · {totalImports}{' '}
                {totalImports === 1 ? 'importación' : 'importaciones'} · {totalDespachadas} con despacho
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar marca, título o despacho…"
                className="w-64 bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
            <button
              type="button"
              onClick={() => setOnlyDespachadas((v) => !v)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors',
                onlyDespachadas
                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              )}
              title="Mostrar sólo importaciones con despacho"
            >
              <Filter size={13} />
              Solo despachadas
            </button>
          </div>
        </div>

        {/* Estados */}
        {isLoading ? (
          <div className="text-center text-slate-500 py-20 text-sm">Cargando…</div>
        ) : groups.length === 0 ? (
          <div className="text-center py-20">
            <PackageSearch size={40} className="mx-auto text-slate-700 mb-3" />
            <p className="text-slate-400 text-sm">
              {query || onlyDespachadas ? 'No hay importaciones que coincidan.' : 'Aún no hay importaciones cargadas.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map(([brand, items]) => {
              const totals = despachoTotals(items)
              const totalEntries = Object.entries(totals)
              return (
                <section key={brand} className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
                  {/* Header de marca */}
                  <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-700/60 bg-slate-800/60">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-white truncate">{brand}</span>
                      <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-slate-700/70 text-slate-300 flex-shrink-0">
                        {items.length}
                      </span>
                    </div>
                    {totalEntries.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        <span className="text-[10px] text-slate-500">Total despachos:</span>
                        {totalEntries.map(([cur, amt]) => (
                          <span
                            key={cur}
                            className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-900/30 border border-emerald-700/40 text-emerald-300 font-medium"
                          >
                            {fmtMoney(amt, cur)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Tabla */}
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                        <th className="text-left font-medium px-4 py-2">Importación</th>
                        <th className="text-left font-medium px-4 py-2 w-40">N° despacho</th>
                        <th className="text-right font-medium px-4 py-2 w-44">Monto despacho</th>
                        <th className="text-left font-medium px-4 py-2 w-36">Fecha oficialización</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((imp) => (
                        <tr
                          key={imp.id}
                          className="border-t border-slate-700/40 hover:bg-slate-700/20 transition-colors group"
                        >
                          <td className="px-4 py-2.5">
                            <Link
                              to={`/comex/imports/${imp.id}`}
                              className="text-slate-100 hover:text-amber-300 transition-colors font-medium"
                            >
                              {imp.title || '(sin título)'}
                            </Link>
                          </td>
                          <td className="px-4 py-2.5">
                            {imp._despacho_number ? (
                              <span className="inline-flex items-center gap-1 text-slate-200">
                                <FileCheck2 size={13} className="text-slate-500" />
                                {imp._despacho_number}
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-slate-200">
                            {imp._despacho_amount != null ? (
                              fmtMoney(imp._despacho_amount, imp._despacho_currency)
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-slate-300">{fmtDate(imp._oficializacion_date)}</td>
                          <td className="px-2 py-2.5">
                            <Link to={`/comex/imports/${imp.id}`} className="block text-slate-700 group-hover:text-slate-400">
                              <ChevronRight size={14} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
