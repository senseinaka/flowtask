import Anthropic from '@anthropic-ai/sdk'
import dayjs from 'dayjs'
import { getClient, getAIConfig } from './ai.service'
import { listPlannings, getPlanning } from '../database/queries/comex'
import {
  PLANNING_STATUS_LABELS, PLANNING_RISK_LABELS, PLANNING_PRIORITY_LABELS,
  PLANNING_MILESTONE_LABELS, PLANNING_AI_REPORT_TYPE_LABELS
} from '@shared/types'
import type {
  ImportOrderPlanning, PlanningAIReportType,
  CreateImportOrderPlanningAIReportInput
} from '@shared/types'

// ── Recomendación de IA para una programación puntual ────────────────────────

const TOOL_PLANNING_RECOMMENDATION: Anthropic.Tool = {
  name: 'recomendacion_programacion',
  description: 'Genera una recomendación y una explicación de riesgo para una programación de pedido de importación.',
  input_schema: {
    type: 'object' as const,
    properties: {
      summary: {
        type: 'string',
        description: 'Recomendación breve en español (2-5 líneas) sobre qué hacer con esta programación: si conviene activar el pedido ahora, esperar, ajustar fechas o lead times, etc. Concreta y accionable.'
      },
      risk_explanation: {
        type: 'string',
        description: 'Explicación breve en español (2-5 líneas) de por qué la programación tiene el nivel de riesgo actual y qué pasos tomar para mitigarlo o mantenerlo.'
      }
    },
    required: ['summary', 'risk_explanation']
  }
}

function buildPlanningContext(planning: ImportOrderPlanning) {
  const fmt = (d: number | null) => (d ? dayjs(d).format('DD/MM/YYYY') : null)
  return {
    hoy: fmt(Date.now()),
    marca: planning.brand?.name ?? null,
    proveedor: planning.supplier?.name ?? null,
    pais: planning.country,
    tipo_programacion: planning.planning_type,
    estado: PLANNING_STATUS_LABELS[planning.status],
    prioridad: PLANNING_PRIORITY_LABELS[planning.priority],
    riesgo_actual: PLANNING_RISK_LABELS[planning.risk_status],
    fechas_objetivo: {
      inicio_cobertura: fmt(planning.target_coverage_start_date),
      fin_cobertura: fmt(planning.target_coverage_end_date),
      disponibilidad_comercial: fmt(planning.target_commercial_availability_date)
    },
    fechas_calculadas: {
      pedido_recomendado: fmt(planning.recommended_order_date),
      limite_aprobacion: fmt(planning.approval_deadline_date),
      recepcion_estimada: fmt(planning.estimated_reception_date)
    },
    demanda: {
      anual_estimada: planning.demand_annual_estimated,
      mensual_estimada: planning.demand_monthly_estimated,
      demanda_periodo: planning.demand_for_period,
      cobertura_meses_objetivo: planning.desired_coverage_months
    },
    stock: {
      actual: planning.current_stock,
      seguridad: planning.safety_stock
    },
    lead_times_dias: {
      aprobacion_interna: planning.internal_approval_days,
      preparacion_proveedor: planning.supplier_preparation_days,
      produccion: planning.production_days,
      inspeccion: planning.inspection_days,
      embarque: planning.shipping_days,
      aduana: planning.customs_days,
      entrega_local: planning.local_delivery_days,
      seguridad: planning.safety_days,
      total: planning.total_lead_time_days
    },
    hitos: (planning.milestones ?? []).map(m => ({
      tipo: PLANNING_MILESTONE_LABELS[m.milestone_type],
      fecha_calculada: fmt(m.calculated_date),
      fecha_real: fmt(m.real_date),
      estado: m.status
    })),
    notas_usuario: planning.notes || null
  }
}

export async function generatePlanningRecommendation(
  planningId: string
): Promise<{ summary: string; riskExplanation: string; tokensUsed: number }> {
  const planning = getPlanning(planningId)
  if (!planning) throw new Error('Programación no encontrada')

  const config = getAIConfig()
  const model = config.models['dashboard_chat']
  const client = getClient()

  const systemPrompt = `Sos un experto en planificación de compras y comercio exterior para una empresa argentina importadora.
Analizá los datos de esta programación de pedido (sección "Programación Pedidos" del sistema) y generá:
1. Una recomendación concreta y accionable sobre qué hacer (activar pedido ahora, esperar, ajustar lead times, revisar stock, etc.)
2. Una explicación del nivel de riesgo actual y cómo mitigarlo.

Tené en cuenta las fechas calculadas, el lead time total, la demanda del período, el stock actual vs. el de seguridad, y el estado de los hitos (especialmente si hay hitos demorados o con fecha real distinta a la calculada).
Respondé siempre en español, de forma concisa y orientada a la acción. No repitas los datos crudos, interpretalos.`

  const userPrompt = `Datos de la programación:\n${JSON.stringify(buildPlanningContext(planning), null, 2)}`

  const resp = await client.messages.create({
    model,
    max_tokens: 1024,
    system: systemPrompt,
    tools: [TOOL_PLANNING_RECOMMENDATION],
    tool_choice: { type: 'tool', name: 'recomendacion_programacion' },
    messages: [{ role: 'user', content: userPrompt }]
  })

  const toolUse = resp.content.find(b => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined
  const input = (toolUse?.input ?? {}) as { summary?: string; risk_explanation?: string }

  return {
    summary: input.summary ?? '',
    riskExplanation: input.risk_explanation ?? '',
    tokensUsed: resp.usage.input_tokens + resp.usage.output_tokens
  }
}

// ── Reportes automáticos (7 tipos) ────────────────────────────────────────────

const TOOL_PLANNING_REPORT: Anthropic.Tool = {
  name: 'reporte_programacion',
  description: 'Genera un reporte estructurado sobre el estado de las programaciones de pedido.',
  input_schema: {
    type: 'object' as const,
    properties: {
      summary: { type: 'string', description: 'Resumen ejecutivo del reporte en español (2-4 líneas).' },
      findings: { type: 'array', items: { type: 'string' }, description: 'Lista de hallazgos concretos, uno por ítem, en español.' },
      recommendations: { type: 'array', items: { type: 'string' }, description: 'Lista de recomendaciones accionables, una por ítem, en español.' },
      risks: { type: 'array', items: { type: 'string' }, description: 'Lista de riesgos detectados, uno por ítem. Array vacío si no hay riesgos relevantes.' }
    },
    required: ['summary', 'findings', 'recommendations', 'risks']
  }
}

const REPORT_TYPE_INSTRUCTIONS: Record<PlanningAIReportType, string> = {
  monthly_orders_to_activate: `Identificá las programaciones cuyo "pedido recomendado" cae dentro del mes en curso (o ya venció y sigue pendiente de activar), priorizando por urgencia y riesgo. El objetivo es que el equipo sepa qué pedidos activar este mes.`,
  brands_at_risk: `Identificá las marcas/programaciones cuyo riesgo actual es "En riesgo" o "Tarde". Explicá por qué están en riesgo (lead time vs. fechas objetivo, hitos demorados) y qué se puede hacer para revertirlo.`,
  coverage_by_brand: `Analizá la cobertura de cada marca: demanda del período vs. stock actual + stock de seguridad, y los meses de cobertura objetivo. Señalá marcas con cobertura insuficiente o con stock excesivo.`,
  supplier_delays: `Analizá los hitos con fecha real registrada y compará contra la fecha calculada para detectar demoras por proveedor. Identificá qué proveedores tienden a demorarse y en qué etapa (preparación, producción, embarque, etc.).`,
  demand_coverage: `Analizá, para cada programación, la demanda del período objetivo contra el stock actual disponible (incluyendo stock de seguridad). Indicá qué porcentaje de la demanda queda cubierto y dónde hay faltantes proyectados.`,
  recommended_orders_by_period: `Agrupá las programaciones activas por período de "pedido recomendado" (próximos 30, 60 y 90 días) para dar una proyección de la carga de pedidos a realizar en cada ventana de tiempo.`,
  critical_alerts: `Identificá las situaciones más críticas: programaciones con riesgo "Tarde", límites de aprobación vencidos o muy próximos, y pedidos recomendados vencidos sin activar. Priorizá por urgencia.`
}

export interface GeneratePlanningAIReportInput {
  reportType: PlanningAIReportType
  brandId?: string | null
  supplierId?: string | null
  periodStartDate?: number | null
  periodEndDate?: number | null
}

function buildReportContext(plannings: ImportOrderPlanning[], input: GeneratePlanningAIReportInput) {
  const fmt = (d: number | null) => (d ? dayjs(d).format('DD/MM/YYYY') : null)
  return {
    hoy: fmt(Date.now()),
    filtro: {
      marca_id: input.brandId ?? null,
      proveedor_id: input.supplierId ?? null,
      periodo_desde: fmt(input.periodStartDate ?? null),
      periodo_hasta: fmt(input.periodEndDate ?? null)
    },
    programaciones: plannings.map(p => ({
      id: p.id,
      marca: p.brand?.name ?? null,
      proveedor: p.supplier?.name ?? null,
      estado: PLANNING_STATUS_LABELS[p.status],
      prioridad: PLANNING_PRIORITY_LABELS[p.priority],
      riesgo: PLANNING_RISK_LABELS[p.risk_status],
      fechas: {
        pedido_recomendado: fmt(p.recommended_order_date),
        limite_aprobacion: fmt(p.approval_deadline_date),
        recepcion_estimada: fmt(p.estimated_reception_date),
        inicio_cobertura: fmt(p.target_coverage_start_date),
        fin_cobertura: fmt(p.target_coverage_end_date),
        disponibilidad_comercial: fmt(p.target_commercial_availability_date)
      },
      demanda_periodo: p.demand_for_period,
      cobertura_meses_objetivo: p.desired_coverage_months,
      stock_actual: p.current_stock,
      stock_seguridad: p.safety_stock,
      lead_time_total_dias: p.total_lead_time_days,
      hitos: (p.milestones ?? []).map(m => ({
        tipo: PLANNING_MILESTONE_LABELS[m.milestone_type],
        fecha_calculada: fmt(m.calculated_date),
        fecha_real: fmt(m.real_date),
        estado: m.status
      }))
    }))
  }
}

export async function generatePlanningAIReport(
  input: GeneratePlanningAIReportInput
): Promise<CreateImportOrderPlanningAIReportInput & { tokensUsed: number }> {
  const plannings = listPlannings(input.brandId ? { brandId: input.brandId } : undefined)
    .filter(p => !input.supplierId || p.supplier_id === input.supplierId)

  const config = getAIConfig()
  const model = config.models['dashboard_chat']
  const client = getClient()

  const systemPrompt = `Sos un experto en planificación de compras y comercio exterior para una empresa argentina importadora.
Vas a generar el reporte automático "${PLANNING_AI_REPORT_TYPE_LABELS[input.reportType]}" a partir de los datos de programaciones de pedido del sistema (sección "Programación Pedidos").

Instrucciones específicas para este reporte:
${REPORT_TYPE_INSTRUCTIONS[input.reportType]}

Respondé siempre en español, de forma concisa y orientada a la acción. Si no hay datos suficientes para algún punto, decilo brevemente en lugar de inventar. Si "risks" no aplica, devolvé un array vacío.`

  const userPrompt = `Datos del sistema:\n${JSON.stringify(buildReportContext(plannings, input), null, 2).slice(0, 80_000)}`

  const resp = await client.messages.create({
    model,
    max_tokens: 2048,
    system: systemPrompt,
    tools: [TOOL_PLANNING_REPORT],
    tool_choice: { type: 'tool', name: 'reporte_programacion' },
    messages: [{ role: 'user', content: userPrompt }]
  })

  const toolUse = resp.content.find(b => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined
  const result = (toolUse?.input ?? {}) as {
    summary?: string
    findings?: string[]
    recommendations?: string[]
    risks?: string[]
  }

  return {
    report_type: input.reportType,
    brand_id: input.brandId ?? null,
    supplier_id: input.supplierId ?? null,
    period_start_date: input.periodStartDate ?? null,
    period_end_date: input.periodEndDate ?? null,
    summary: result.summary ?? '',
    findings: (result.findings ?? []).map(f => `- ${f}`).join('\n'),
    recommendations: (result.recommendations ?? []).map(r => `- ${r}`).join('\n'),
    risks: (result.risks ?? []).map(r => `- ${r}`).join('\n'),
    generated_by: 'ai',
    tokensUsed: resp.usage.input_tokens + resp.usage.output_tokens
  }
}
