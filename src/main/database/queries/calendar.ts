// ═══════════════════════════════════════════════════════════════════════════
// Calendario / Agenda — Fase 1: consultas locales (calendar_events_cache,
// calendar_connections — tablas LOCAL-ONLY, no PowerSync) + agregación de
// "eventos unificados" desde Finanzas Personal, Finanzas Empresa y Comex -
// Programación de Pedidos.
// ═══════════════════════════════════════════════════════════════════════════

import { getDb } from '../db'
import { getPowerSyncDb } from '../powersync'
import type { UnifiedCalendarEvent, CalendarEventCache } from '@shared/types'

// ── calendar_events_cache ─────────────────────────────────────────────────────

export function listCachedEvents(startAt: number, endAt: number): CalendarEventCache[] {
  return getDb()
    .prepare(`
      SELECT * FROM calendar_events_cache
      WHERE start_at <= ? AND (end_at IS NULL OR end_at >= ?)
      ORDER BY start_at ASC
    `)
    .all(endAt, startAt) as CalendarEventCache[]
}

// ── Finanzas Personal / Empresa ─────────────────────────────────────────────
// Mismo modelado en ambas (finance_movements / company_finance_movements):
// `due_date` (timestamp ms, opcional) es la fecha de vencimiento del
// movimiento. Solo se incluyen movimientos no pagados con due_date en rango.

interface DueMovementRow {
  id: string
  due_date: number
  concept_name: string
  status: string
}

async function getFinanceDueEvents(
  table: 'finance_movements' | 'company_finance_movements',
  conceptsTable: 'finance_concepts' | 'company_finance_concepts',
  startAt: number, endAt: number
): Promise<DueMovementRow[]> {
  const db = getPowerSyncDb()
  return db.getAll<DueMovementRow>(`
    SELECT m.id as id, m.due_date as due_date, c.name as concept_name, m.status as status
    FROM ${table} m
    JOIN ${conceptsTable} c ON c.id = m.concept_id
    WHERE m.due_date IS NOT NULL AND m.due_date >= ? AND m.due_date <= ? AND m.status != 'paid'
  `, [startAt, endAt])
}

// ── Comex - Programación de Pedidos (hitos) ─────────────────────────────────
// import_order_planning_milestones.calculated_date es la fecha estimada de
// cada hito (análisis interno, aprobación, embarque, etc.) — ver comex.ts.

interface PlanningMilestoneRow {
  id: string
  planning_id: string
  milestone_type: string
  calculated_date: number
  brand_name: string | null
}

async function getComexPlanningMilestoneEvents(startAt: number, endAt: number): Promise<PlanningMilestoneRow[]> {
  const db = getPowerSyncDb()
  return db.getAll<PlanningMilestoneRow>(`
    SELECT ms.id as id, ms.planning_id as planning_id, ms.milestone_type as milestone_type,
           ms.calculated_date as calculated_date, b.name as brand_name
    FROM import_order_planning_milestones ms
    JOIN import_order_plannings p ON p.id = ms.planning_id
    LEFT JOIN comex_brands b ON b.id = p.brand_id
    WHERE ms.calculated_date IS NOT NULL AND ms.calculated_date >= ? AND ms.calculated_date <= ?
  `, [startAt, endAt])
}

// ── Milestone labels (evita import circular pesado — duplicado mínimo) ─────

const MILESTONE_LABELS: Record<string, string> = {
  internal_analysis: 'Análisis interno',
  approval: 'Aprobación',
  supplier_order: 'Pedido al proveedor',
  preparation: 'Preparación',
  production: 'Producción',
  inspection: 'Inspección',
  shipping: 'Embarque',
  arrival: 'Arribo',
  customs: 'Nacionalización',
  reception: 'Recepción',
  commercial_availability: 'Disponibilidad comercial'
}

// ── Unified events ───────────────────────────────────────────────────────────

export async function getUnifiedEvents(startDate: number, endDate: number): Promise<UnifiedCalendarEvent[]> {
  const events: UnifiedCalendarEvent[] = []

  // Google Calendar (cache local)
  for (const ev of listCachedEvents(startDate, endDate)) {
    events.push({
      id: `google:${ev.id}`,
      source: 'google',
      title: ev.summary,
      start_at: ev.start_at,
      end_at: ev.end_at,
      all_day: !!ev.all_day,
      category: ev.google_calendar_id,
      link: null
    })
  }

  // Finanzas Personal
  const personalDue = await getFinanceDueEvents('finance_movements', 'finance_concepts', startDate, endDate)
  for (const m of personalDue) {
    events.push({
      id: `finance:${m.id}`,
      source: 'finance',
      title: `Vencimiento: ${m.concept_name}`,
      start_at: m.due_date,
      end_at: null,
      all_day: true,
      category: 'finance',
      link: `/finance?movement=${m.id}`
    })
  }

  // Finanzas Empresa
  const companyDue = await getFinanceDueEvents('company_finance_movements', 'company_finance_concepts', startDate, endDate)
  for (const m of companyDue) {
    events.push({
      id: `company_finance:${m.id}`,
      source: 'company_finance',
      title: `Vencimiento: ${m.concept_name}`,
      start_at: m.due_date,
      end_at: null,
      all_day: true,
      category: 'company_finance',
      link: `/company-finance?movement=${m.id}`
    })
  }

  // Comex - Programación de Pedidos (hitos)
  const milestones = await getComexPlanningMilestoneEvents(startDate, endDate)
  for (const ms of milestones) {
    const label = MILESTONE_LABELS[ms.milestone_type] ?? ms.milestone_type
    const brand = ms.brand_name ? ` — ${ms.brand_name}` : ''
    events.push({
      id: `comex_planning:${ms.id}`,
      source: 'comex_planning',
      title: `${label}${brand}`,
      start_at: ms.calculated_date,
      end_at: null,
      all_day: true,
      category: 'comex_planning',
      link: `/comex/plannings/${ms.planning_id}`
    })
  }

  events.sort((a, b) => a.start_at - b.start_at)
  return events
}
