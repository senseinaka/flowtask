/**
 * Servicio de alertas proactivas — Fase 5 del Asistente IA
 *
 * Analiza los datos de Summit cada N horas y genera alertas automáticas
 * sobre urgencias, anomalías y oportunidades sin que el usuario pregunte.
 *
 * Arquitectura:
 *  - buildAnalysisContext()  → serializa el estado actual a texto
 *  - runProactiveAnalysis()  → llama a Claude con ese contexto + prompt de alertas
 *  - onAlerts callback       → el caller (index.ts) envía las alertas al renderer
 */

import Anthropic       from '@anthropic-ai/sdk'
import { getAIConfig } from './ai.service'
import { listImports } from '../database/queries/comex'
import { listTasks }   from '../database/queries/tasks'
import { listDelegatedTasks } from '../database/queries/delegated'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface ProactiveAlert {
  id:        string          // hash determinístico del contenido
  severity:  AlertSeverity
  title:     string
  body:      string
  module:    'comex' | 'tasks' | 'delegated' | 'general'
  createdAt: number
}

// ── Intervalo y throttle ──────────────────────────────────────────────────────

const ANALYSIS_INTERVAL_MS = 4 * 60 * 60 * 1000  // 4 horas
const MIN_RERUN_MS          = 30 * 60 * 1000       // no re-correr antes de 30 min

let _lastRunAt  = 0
let _intervalId: ReturnType<typeof setInterval> | null = null

// ── Context builder ───────────────────────────────────────────────────────────

async function buildAnalysisContext(): Promise<string> {
  const today  = new Date()
  const fDate  = (ts: number | null | undefined) =>
    ts ? new Date(ts).toLocaleDateString('es-AR') : 'N/D'
  const now    = today.getTime()

  // ── Importaciones ──────────────────────────────────────────────────────────
  const imports = listImports()
  const active  = imports.filter(i => i.status !== 'delivered')

  const importLines = active.map(i => {
    const val  = i.actual_value ?? i.estimated_value ?? 0
    const eta  = i.eta_4 ?? i.eta_3 ?? i.eta_2 ?? i.arrival_date
    const etaDays = eta ? Math.round((eta - now) / 86_400_000) : null
    const parts: string[] = [
      `• ${i.title} [${i.status}] | ${i.supplier?.name ?? 'S/P'} | ${i.currency} ${val.toLocaleString('es-AR', {maximumFractionDigits:0})}`,
    ]
    if (etaDays != null) parts.push(`  ETA: ${fDate(eta)} (en ${etaDays} días)`)
    if (i.cost_pct != null) parts.push(`  Costo imp: ${i.cost_pct.toFixed(1)}%`)
    if (i.inal_required) parts.push(`  INAL requerido | LC: ${i.inal_lc_status ?? 'pendiente'}`)
    return parts.join('\n')
  }).join('\n')

  // Stats útiles para análisis
  const withCost = imports.filter(i => i.cost_pct != null)
  const avgCost  = withCost.length > 0
    ? withCost.reduce((s, i) => s + (i.cost_pct ?? 0), 0) / withCost.length
    : null

  // ── Tareas personales ──────────────────────────────────────────────────────
  const tasks      = await listTasks()
  const pendTasks  = tasks.filter(t => t.status !== 'done')
  const overdueTasks = pendTasks.filter(t => t.due_date && t.due_date < now)
  const todayTasks   = pendTasks.filter(t => {
    if (!t.due_date) return false
    const d = new Date(t.due_date)
    return d.toDateString() === today.toDateString()
  })
  const criticalTasks = pendTasks.filter(t => t.priority === 1)

  const taskLines = pendTasks
    .filter(t => t.priority <= 2 || (t.due_date && t.due_date < now + 3 * 86_400_000))
    .map(t => {
      const overdue = t.due_date && t.due_date < now ? ' ⚠VENCIDA' : ''
      return `  • P${t.priority}: ${t.title}${t.due_date ? ` | vence ${fDate(t.due_date)}${overdue}` : ''}`
    }).join('\n')

  // ── Tareas delegadas ───────────────────────────────────────────────────────
  const deleg = listDelegatedTasks()
  const activeDeleg   = deleg.filter(t => t.status !== 'done' && t.status !== 'cancelled')
  const overdueDeleg  = activeDeleg.filter(t => t.due_date && t.due_date < now)

  const delegLines = activeDeleg
    .filter(t => t.due_date && t.due_date < now + 7 * 86_400_000)
    .map(t => {
      const overdue = t.due_date && t.due_date < now ? ' ⚠VENCIDA' : ''
      return `  • → ${t.contact?.name ?? '?'} | ${t.title}${t.due_date ? ` | vence ${fDate(t.due_date)}${overdue}` : ''}`
    }).join('\n')

  return `Hoy: ${today.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}

IMPORTACIONES ACTIVAS (${active.length}):
${importLines || '(ninguna)'}
${avgCost != null ? `\nCosto promedio histórico: ${avgCost.toFixed(1)}%` : ''}

TAREAS PERSONALES:
- Total pendientes: ${pendTasks.length} | Vencidas: ${overdueTasks.length} | Vencen hoy: ${todayTasks.length} | Críticas (P1): ${criticalTasks.length}
${taskLines ? '\nTareas urgentes/próximas:\n' + taskLines : ''}

TAREAS DELEGADAS:
- Activas: ${activeDeleg.length} | Vencidas: ${overdueDeleg.length}
${delegLines ? '\nDelegadas próximas:\n' + delegLines : ''}`
}

// ── Llamada a Claude ──────────────────────────────────────────────────────────

const ALERT_SCHEMA: Anthropic.Tool = {
  name: 'generar_alertas',
  description: 'Genera alertas proactivas sobre el estado del negocio de importación.',
  input_schema: {
    type: 'object' as const,
    properties: {
      alertas: {
        type: 'array',
        description: 'Lista de alertas encontradas. Puede estar vacía si todo está bien.',
        items: {
          type: 'object' as const,
          properties: {
            severidad: {
              type: 'string',
              enum: ['critical', 'warning', 'info'],
              description: 'critical = acción inmediata requerida | warning = atención pronto | info = dato útil'
            },
            titulo: {
              type: 'string',
              description: 'Título corto (máx 60 chars). Directo y específico.'
            },
            cuerpo: {
              type: 'string',
              description: 'Explicación concisa (máx 120 chars). Incluir datos concretos (fechas, montos, nombres).'
            },
            modulo: {
              type: 'string',
              enum: ['comex', 'tasks', 'delegated', 'general'],
              description: 'Módulo afectado.'
            }
          },
          required: ['severidad', 'titulo', 'cuerpo', 'modulo']
        }
      }
    },
    required: ['alertas']
  }
}

// Hash simple para ID determinístico (mismo contenido = mismo ID, evita duplicados)
function simpleHash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h).toString(36)
}

export async function runProactiveAnalysis(): Promise<ProactiveAlert[]> {
  const config = getAIConfig()
  if (!config.apiKey) return []

  // Throttle: no re-correr si se corrió hace menos de 30 min
  if (Date.now() - _lastRunAt < MIN_RERUN_MS) return []
  _lastRunAt = Date.now()

  try {
    const client  = new Anthropic({ apiKey: config.apiKey })
    const context = await buildAnalysisContext()

    const response = await client.messages.create({
      model:      config.models?.['dashboard_chat'] ?? 'claude-haiku-4-5',
      max_tokens: 1024,
      system: `Sos el asistente de negocio de NAKA OUTDOORS CO. S.R.L. (Argentina), empresa importadora de equipamiento outdoor.
Tu tarea es analizar el estado actual del negocio y generar SOLO alertas accionables y relevantes.

CRITERIOS PARA GENERAR UNA ALERTA:
• critical: tarea vencida con P1, importación en aduana con documentación faltante, INAL pendiente con ETA < 15 días, costo de importación > 50% (anómalo)
• warning: ETA < 7 días sin despacho completado, tarea P1-P2 vence en < 3 días, delegada vencida hace > 3 días, varios tributos sin cargar con despacho cargado, costo > 40%
• info: importación en tránsito que llega próxima semana, tareas completadas esta semana, costo llamativamente bajo (< 15%)

NO generar alertas sobre:
- Cosas que ya están bien o en orden
- Suposiciones sin datos concretos
- Más de 6 alertas en total (priorizar las más importantes)
- Info sin acción clara`,
      messages: [{
        role: 'user',
        content: `Analizá el estado actual y generá las alertas más importantes:\n\n${context}`
      }],
      tools: [ALERT_SCHEMA],
      tool_choice: { type: 'any' }
    })

    // Extraer las alertas del tool use
    const toolBlock = response.content.find(b => b.type === 'tool_use')
    if (!toolBlock || toolBlock.type !== 'tool_use') return []

    const input = toolBlock.input as { alertas: Array<{ severidad: string; titulo: string; cuerpo: string; modulo: string }> }
    if (!input.alertas?.length) return []

    const now = Date.now()
    return input.alertas.map(a => ({
      id:        simpleHash(a.titulo + a.cuerpo),
      severity:  a.severidad as AlertSeverity,
      title:     a.titulo,
      body:      a.cuerpo,
      module:    a.modulo as ProactiveAlert['module'],
      createdAt: now
    }))
  } catch (err) {
    console.error('[ProactiveService] Error al analizar:', err)
    return []
  }
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

type AlertsCallback = (alerts: ProactiveAlert[]) => void

export function startProactiveScheduler(onAlerts: AlertsCallback): void {
  if (_intervalId) return  // ya corriendo

  const run = async () => {
    const alerts = await runProactiveAnalysis()
    if (alerts.length > 0) onAlerts(alerts)
  }

  // Primera ejecución a los 30 segundos del inicio (para que la UI cargue)
  setTimeout(run, 30_000)

  // Luego cada 4 horas
  _intervalId = setInterval(run, ANALYSIS_INTERVAL_MS)
  console.log('[ProactiveService] Scheduler iniciado (cada 4 hs)')
}

export function stopProactiveScheduler(): void {
  if (_intervalId) { clearInterval(_intervalId); _intervalId = null }
}

/** Ejecuta un análisis manual inmediato (por ej. desde el chat o desde un botón) */
export async function triggerProactiveNow(onAlerts: AlertsCallback): Promise<void> {
  _lastRunAt = 0  // forzar ejecución aunque haya corrido recientemente
  const alerts = await runProactiveAnalysis()
  onAlerts(alerts)
}
