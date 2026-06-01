/**
 * CostsSection — Costos de importación
 * Tabla de ítems de costo agrupados por categoría, con carga rápida desde
 * conceptos predefinidos y calculadora de % sobre FOB.
 */
import { useState } from 'react'
import { Calculator, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react'

import {
  useComexCosts, useCreateComexCost,
  useUpdateComexCost, useDeleteComexCost,
  useComexCustoms
} from '../../hooks/useComex'
import {
  PREDEFINED_COSTS, COST_CATEGORY_LABELS, COST_CATEGORY_COLORS
} from '@shared/types'
import type { CostCategory, ComexCostItem } from '@shared/types'
import { cn } from '../../components/ui/utils'

const ALL_CATEGORIES = Object.keys(COST_CATEGORY_LABELS) as CostCategory[]

// ── Inline editable amount ────────────────────────────────────────────────────

function EditableAmount({
  value, onSave
}: {
  value: number; onSave: (v: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const start = () => { setDraft(String(value)); setEditing(true) }
  const commit = () => { onSave(Number(draft) || 0); setEditing(false) }

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        className="w-28 text-right bg-slate-700 border border-cyan-600 rounded px-2 py-0.5 text-xs text-white focus:outline-none"
      />
    )
  }

  return (
    <button
      onClick={start}
      className="text-xs text-slate-200 hover:text-cyan-300 transition-colors font-mono text-right w-28"
    >
      ${value.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
    </button>
  )
}

// ── Cost row ──────────────────────────────────────────────────────────────────

function CostRow({ item, importId }: { item: ComexCostItem; importId: string }) {
  const updateCost = useUpdateComexCost()
  const deleteCost = useDeleteComexCost()

  return (
    <div className="flex items-center gap-2 py-1 border-b border-slate-700/40 last:border-0 group">
      <p className="flex-1 text-xs text-slate-300 truncate">{item.concept}</p>
      <EditableAmount
        value={item.amount_pesos}
        onSave={(v) => updateCost.mutate({ id: item.id, importId, data: { amount_pesos: v } })}
      />
      <button
        onClick={() => deleteCost.mutate({ id: item.id, importId })}
        className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all"
      >
        <Trash2 size={11} />
      </button>
    </div>
  )
}

// ── Category block ────────────────────────────────────────────────────────────

function CategoryBlock({
  category, items, importId, onAddCustom
}: {
  category: CostCategory
  items: ComexCostItem[]
  importId: string
  onAddCustom: (category: CostCategory) => void
}) {
  const [open, setOpen] = useState(true)
  const total = items.reduce((s, i) => s + i.amount_pesos, 0)
  const color = COST_CATEGORY_COLORS[category]

  if (items.length === 0) return null

  return (
    <div className="border border-slate-700/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-900/40 hover:bg-slate-900/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown size={12} className="text-slate-500" /> : <ChevronRight size={12} className="text-slate-500" />}
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="text-xs font-semibold text-slate-200">{COST_CATEGORY_LABELS[category]}</span>
          <span className="text-[10px] text-slate-500">({items.length})</span>
        </div>
        <span className="text-xs font-mono font-semibold" style={{ color }}>
          ${total.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
        </span>
      </button>

      {open && (
        <div className="px-3 py-2 space-y-0">
          {items.map((item) => (
            <CostRow key={item.id} item={item} importId={importId} />
          ))}
          <button
            onClick={() => onAddCustom(category)}
            className="mt-1 text-[10px] text-slate-600 hover:text-cyan-400 transition-colors flex items-center gap-1"
          >
            <Plus size={10} /> Agregar concepto
          </button>
        </div>
      )}
    </div>
  )
}

// ── Quick add from predefined list ────────────────────────────────────────────

function QuickAddPanel({
  importId, onClose, existingConcepts
}: {
  importId: string
  onClose: () => void
  existingConcepts: string[]
}) {
  const createCost = useCreateComexCost()
  const [filter, setFilter] = useState('')
  const [customConcept, setCustomConcept] = useState('')
  const [customCategory, setCustomCategory] = useState<CostCategory>('otros')

  const filtered = PREDEFINED_COSTS.filter(
    (p) => !existingConcepts.includes(p.concept) &&
      p.concept.toLowerCase().includes(filter.toLowerCase())
  )

  const add = async (concept: string, category: CostCategory) => {
    await createCost.mutateAsync({ import_id: importId, concept, category, amount_pesos: 0, amount_usd: null, sort_order: 0 })
  }

  const addCustom = async () => {
    if (!customConcept.trim()) return
    await add(customConcept.trim(), customCategory)
    setCustomConcept('')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h3 className="text-sm font-semibold text-white">Agregar concepto de costo</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-slate-700">Cerrar</button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3">
          <input
            autoFocus
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Buscar concepto..."
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Predefined list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
          {filtered.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-4">Sin resultados</p>
          )}
          {ALL_CATEGORIES.map((cat) => {
            const items = filtered.filter((p) => p.category === cat)
            if (!items.length) return null
            return (
              <div key={cat}>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-2 mb-1">
                  {COST_CATEGORY_LABELS[cat]}
                </p>
                {items.map((p) => (
                  <button
                    key={p.concept}
                    onClick={() => { add(p.concept, p.category); onClose() }}
                    className="w-full text-left px-3 py-1.5 rounded text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: COST_CATEGORY_COLORS[cat] }} />
                    {p.concept}
                  </button>
                ))}
              </div>
            )
          })}
        </div>

        {/* Custom concept */}
        <div className="px-4 pb-4 pt-2 border-t border-slate-700 space-y-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Concepto personalizado</p>
          <div className="flex gap-2">
            <input
              value={customConcept}
              onChange={(e) => setCustomConcept(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addCustom() }}
              placeholder="Nombre del concepto"
              className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
            <select
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value as CostCategory)}
              className="bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{COST_CATEGORY_LABELS[c]}</option>)}
            </select>
            <button
              onClick={() => { addCustom(); onClose() }}
              disabled={!customConcept.trim()}
              className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs disabled:opacity-50"
            >
              Agregar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface Props {
  importId: string
  fobPesos?: number | null    // FOB actualizado en pesos (para calcular %)
}

export default function CostsSection({ importId, fobPesos }: Props) {
  const { data: costs = [] } = useComexCosts(importId)
  const { data: customs }    = useComexCustoms(importId)
  const createCost           = useCreateComexCost()

  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickAddCategory, setQuickAddCategory] = useState<CostCategory | null>(null)

  const handleAddCustom = async (category: CostCategory) => {
    setQuickAddCategory(category)
    setShowQuickAdd(true)
  }

  // Group by category
  const byCategory = ALL_CATEGORIES.reduce<Record<CostCategory, ComexCostItem[]>>((acc, cat) => {
    acc[cat] = costs.filter((c) => c.category === cat)
    return acc
  }, {} as Record<CostCategory, ComexCostItem[]>)

  // Totals
  const sinIva    = costs.filter((c) => !['iva'].includes(c.category)).reduce((s, c) => s + c.amount_pesos, 0)
  const totalIva  = byCategory['iva'].reduce((s, c) => s + c.amount_pesos, 0)
  const totalIIBB = byCategory['iibb'].reduce((s, c) => s + c.amount_pesos, 0)
  const totalGan  = byCategory['ganancias'].reduce((s, c) => s + c.amount_pesos, 0)
  const total     = costs.reduce((s, c) => s + c.amount_pesos, 0)

  // % calculations
  // FOB base: use customs fob_invoice × dolar_aduana, or prop
  const fobBase = (() => {
    if (fobPesos != null) return fobPesos
    if (!customs) return null
    const inv = customs.fob_invoice
    const dolarA = customs.dolar_aduana
    if (inv == null || dolarA == null) return null
    if (customs.fob_currency === 'EUR') {
      return (inv / (customs.paridad_usd_eur ?? 1)) * dolarA
    }
    return inv * dolarA
  })()

  const pct = (val: number) =>
    fobBase ? `${((val / fobBase) * 100).toFixed(2)}%` : '—'

  const sinImpuestos = sinIva - totalIIBB - totalGan
  const conIIBBGan = sinImpuestos + totalIIBB + totalGan

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calculator size={14} className="text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">Costos de importación</h3>
        </div>
        <button
          onClick={() => { setQuickAddCategory(null); setShowQuickAdd(true) }}
          className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          <Plus size={12} /> Agregar concepto
        </button>
      </div>

      {costs.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-xs text-slate-500">Sin conceptos de costo cargados.</p>
          <button
            onClick={() => setShowQuickAdd(true)}
            className="mt-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            + Agregar desde lista predefinida
          </button>
        </div>
      ) : (
        <>
          {/* Cost items grouped by category */}
          <div className="space-y-2">
            {ALL_CATEGORIES.map((cat) => (
              <CategoryBlock
                key={cat}
                category={cat}
                items={byCategory[cat]}
                importId={importId}
                onAddCustom={handleAddCustom}
              />
            ))}
          </div>

          {/* ── Totals & percentages ── */}
          <div className="border-t border-slate-700 pt-4 space-y-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-3">
              Resumen
              {fobBase == null && (
                <span className="normal-case font-normal ml-1 text-amber-500">
                  — cargá FOB + dólar aduana para ver porcentajes
                </span>
              )}
            </p>

            {[
              { label: 'Total sin IVA', value: sinIva, highlight: false },
              { label: 'IVA total', value: totalIva, highlight: false },
              { label: 'IIBB total', value: totalIIBB, highlight: false },
              { label: 'Ganancias aduana', value: totalGan, highlight: false },
              { label: 'TOTAL', value: total, highlight: true },
            ].map(({ label, value, highlight }) => (
              <div key={label} className={cn('flex items-center justify-between', highlight && 'pt-2 border-t border-slate-600')}>
                <span className={cn('text-xs', highlight ? 'font-semibold text-white' : 'text-slate-400')}>
                  {label}
                </span>
                <span className={cn('text-xs font-mono font-semibold', highlight ? 'text-cyan-400' : 'text-slate-300')}>
                  ${value.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                </span>
              </div>
            ))}

            {fobBase != null && (
              <div className="mt-3 pt-3 border-t border-slate-600 space-y-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Porcentaje sobre FOB</p>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-900/60 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-slate-500 mb-1">Sin impuestos</p>
                    <p className="text-sm font-bold text-emerald-400">{pct(sinImpuestos)}</p>
                  </div>
                  <div className="bg-slate-900/60 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-slate-500 mb-1">+ IIBB + Gan.</p>
                    <p className="text-sm font-bold text-amber-400">{pct(conIIBBGan)}</p>
                  </div>
                  <div className="bg-slate-900/60 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-slate-500 mb-1">+ IVA (total)</p>
                    <p className="text-sm font-bold text-red-400">{pct(total)}</p>
                  </div>
                </div>

                {/* Visual bar */}
                {total > 0 && (
                  <div className="mt-2">
                    <div className="flex h-2 rounded-full overflow-hidden gap-px">
                      {ALL_CATEGORIES.map((cat) => {
                        const catTotal = byCategory[cat].reduce((s, c) => s + c.amount_pesos, 0)
                        const w = (catTotal / total) * 100
                        if (w < 1) return null
                        return (
                          <div
                            key={cat}
                            style={{ width: `${w}%`, backgroundColor: COST_CATEGORY_COLORS[cat] }}
                            title={`${COST_CATEGORY_LABELS[cat]}: $${catTotal.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`}
                          />
                        )
                      })}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                      {ALL_CATEGORIES.filter((cat) => byCategory[cat].length > 0).map((cat) => (
                        <div key={cat} className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COST_CATEGORY_COLORS[cat] }} />
                          <span className="text-[10px] text-slate-500">{COST_CATEGORY_LABELS[cat]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {showQuickAdd && (
        <QuickAddPanel
          importId={importId}
          existingConcepts={costs.map((c) => c.concept)}
          onClose={() => setShowQuickAdd(false)}
        />
      )}
    </div>
  )
}
