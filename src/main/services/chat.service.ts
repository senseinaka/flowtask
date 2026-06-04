import { randomUUID }   from 'crypto'
import Anthropic         from '@anthropic-ai/sdk'
import { getDb }         from '../database/db'
import { getAIConfig }   from './ai.service'
import {
  listImports, listTributos, listExtraCosts, listProformas,
  listPayments, getCustoms, updateImport,
} from '../database/queries/comex'
import { listTasks, createTask, updateTask } from '../database/queries/tasks'
import { listDelegatedTasks, createDelegatedTask } from '../database/queries/delegated'
import { listContacts } from '../database/queries/contacts'
import type {
  AIChatMessage, Priority, TaskStatus, ImportStatus,
} from '@shared/types'

// ── Historial en DB ───────────────────────────────────────────────────────────

// Cuántos mensajes antes de compactar (excluyendo mensajes de resumen)
const COMPACT_THRESHOLD = 30
// Cuántos mensajes recientes conservar intactos al compactar
const COMPACT_KEEP_RECENT = 10

export function getChatHistory(sessionId = 'default', limit = 60): AIChatMessage[] {
  return getDb()
    .prepare('SELECT * FROM ai_chat_messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(sessionId, limit)
    .reverse() as AIChatMessage[]
}

export function getSessionStats(sessionId = 'default'): {
  total: number
  hasCompacted: boolean
  oldestAt: number | null
} {
  const db = getDb()
  const row = db.prepare(
    "SELECT COUNT(*) as total, MIN(created_at) as oldestAt FROM ai_chat_messages WHERE session_id = ?"
  ).get(sessionId) as { total: number; oldestAt: number | null }
  const hasCompacted = !!(db.prepare(
    "SELECT 1 FROM ai_chat_messages WHERE session_id = ? AND content LIKE '🧠%' LIMIT 1"
  ).get(sessionId))
  return { total: row.total, hasCompacted, oldestAt: row.oldestAt }
}

export function saveChatMessage(role: 'user' | 'assistant', content: string, sessionId = 'default'): AIChatMessage {
  const db  = getDb()
  const id  = randomUUID()
  const now = Date.now()
  db.prepare('INSERT INTO ai_chat_messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, sessionId, role, content, now)
  return { id, session_id: sessionId, role, content, created_at: now }
}

export function clearChatHistory(sessionId = 'default'): void {
  getDb().prepare('DELETE FROM ai_chat_messages WHERE session_id = ?').run(sessionId)
}

// ── Auto-compactación de historial ────────────────────────────────────────────
// Cuando la conversación supera COMPACT_THRESHOLD mensajes, resume los más
// viejos con Claude y los reemplaza por un único mensaje de resumen.
// Así Diego puede decir "como te dije antes..." sin límite de memoria.

async function compactHistoryIfNeeded(sessionId: string, _client: Anthropic, apiKey: string): Promise<void> {
  const db      = getDb()
  const allMsgs = getChatHistory(sessionId, 200)

  // Contar solo mensajes reales (no resúmenes previos)
  const realMsgs = allMsgs.filter(m => !m.content.startsWith('🧠'))
  if (realMsgs.length < COMPACT_THRESHOLD) return

  // Mensajes a compactar: los más viejos, dejando los N recientes intactos
  const toCompact = realMsgs.slice(0, realMsgs.length - COMPACT_KEEP_RECENT)
  if (toCompact.length < 5) return

  // Texto de conversación para resumir
  const conversationText = toCompact.map(m =>
    `${m.role === 'user' ? 'Diego' : 'Asistente'}: ${m.content.slice(0, 600)}`
  ).join('\n\n')

  try {
    // Llamada no-streaming con haiku (rápida y barata)
    const response = await new Anthropic({ apiKey }).messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 600,
      system:     'Resumí conversaciones de manera concisa en español. Capturá temas clave, decisiones, acciones tomadas y contexto importante para futuros turnos.',
      messages:   [{ role: 'user', content: `Resumí esta conversación en máximo 400 palabras. Mantené los datos concretos (nombres, fechas, números):\n\n${conversationText}` }],
    })

    const summary = response.content[0].type === 'text' ? response.content[0].text : ''
    if (!summary) return

    // Eliminar los mensajes viejos en una transacción
    const ids = toCompact.map(m => m.id)
    db.transaction(() => {
      db.prepare(`DELETE FROM ai_chat_messages WHERE id IN (${ids.map(() => '?').join(',')})`)
        .run(...ids)
      // Insertar mensaje de resumen como primer mensaje de la sesión
      const id  = randomUUID()
      const now = Date.now()
      db.prepare('INSERT INTO ai_chat_messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(id, sessionId, 'assistant', `🧠 **Memoria compactada** (${toCompact.length} mensajes resumidos):\n\n${summary}`, now - 1)
    })()
  } catch {
    // Si falla la compactación, simplemente continuamos (no es crítico)
  }
}

// ── Helpers de formato ────────────────────────────────────────────────────────

function fNum(n: number | null | undefined, decimals = 2): string {
  if (n == null) return 'N/D'
  return n.toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fDate(ts: number | string | null | undefined): string {
  if (!ts) return 'N/D'
  try { return new Date(ts).toLocaleDateString('es-AR') } catch { return String(ts) }
}

const STATUS_LABELS: Record<string, string> = {
  planning: 'Planificación', ordered: 'Pedido realizado', paid: 'Pagado',
  production: 'En producción', shipped: 'Embarcado', transit: 'En tránsito',
  arrived: 'Llegó al país', customs: 'En aduana', delivered: 'Entregado',
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const CHAT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'create_task',
    description: 'Crea una nueva tarea personal en FlowTask. Usá este tool cuando el usuario pida crear, anotar o recordar una tarea propia.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title:       { type: 'string',  description: 'Título claro y conciso de la tarea' },
        priority:    { type: 'number',  description: '1=Crítica 2=Alta 3=Media 4=Baja 5=Algún día. Default: 3' },
        due_date:    { type: 'string',  description: 'Fecha de vencimiento formato YYYY-MM-DD. Omitir si no se especifica.' },
        due_time:    { type: 'string',  description: 'Hora en formato HH:MM. Omitir si no se especifica.' },
        description: { type: 'string',  description: 'Descripción o contexto adicional. Opcional.' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_task_status',
    description: 'Cambia el estado de una tarea personal existente. Buscá por coincidencia parcial de título.',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_title: { type: 'string', description: 'Parte del título de la tarea a buscar (búsqueda flexible)' },
        status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'blocked', 'done'],
          description: 'pending=Pendiente, in_progress=En progreso, blocked=Bloqueado, done=Hecho',
        },
      },
      required: ['task_title', 'status'],
    },
  },
  {
    name: 'create_delegated_task',
    description: 'Crea una tarea delegada a una persona de los contactos. Usá cuando el usuario quiera asignar algo a alguien.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title:        { type: 'string', description: 'Qué debe hacer la persona' },
        contact_name: { type: 'string', description: 'Nombre o parte del nombre del contacto a quien se delega' },
        priority:     { type: 'number', description: '1-5. Default: 3' },
        due_date:     { type: 'string', description: 'Fecha YYYY-MM-DD. Opcional.' },
        description:  { type: 'string', description: 'Contexto o instrucciones adicionales. Opcional.' },
      },
      required: ['title', 'contact_name'],
    },
  },
  {
    name: 'update_import_status',
    description: 'Cambia el estado de una importación Comex. Usá cuando el usuario quiera registrar que un pedido avanzó de etapa.',
    input_schema: {
      type: 'object' as const,
      properties: {
        import_title: { type: 'string', description: 'Parte del nombre de la importación (búsqueda flexible)' },
        status: {
          type: 'string',
          enum: ['planning', 'ordered', 'paid', 'production', 'shipped', 'transit', 'customs', 'delivered'],
          description: 'Nuevo estado de la importación',
        },
      },
      required: ['import_title', 'status'],
    },
  },
  {
    name: 'add_import_note',
    description: 'Agrega o reemplaza la nota de una importación. Usá para registrar observaciones sobre un pedido.',
    input_schema: {
      type: 'object' as const,
      properties: {
        import_title: { type: 'string', description: 'Parte del nombre de la importación' },
        note:         { type: 'string', description: 'Texto de la nota a guardar' },
      },
      required: ['import_title', 'note'],
    },
  },
  {
    name: 'list_contacts',
    description: 'Lista los contactos disponibles para delegar tareas. Usá cuando necesites saber a quién podés delegar.',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: { type: 'string', description: 'Filtrar por nombre. Opcional.' },
      },
    },
  },
]

const TOOL_LABELS: Record<string, string> = {
  create_task:          'Creando tarea...',
  update_task_status:   'Actualizando estado de tarea...',
  create_delegated_task:'Creando tarea delegada...',
  update_import_status: 'Actualizando importación...',
  add_import_note:      'Guardando nota...',
  list_contacts:        'Buscando contactos...',
}

// ── Tool executor ─────────────────────────────────────────────────────────────

type DataChangeCallback = (keys: string[]) => void

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  onDataChange: DataChangeCallback,
): Promise<{ success: boolean; message: string; data?: unknown }> {
  try {
    switch (name) {

      case 'create_task': {
        const { title, priority, due_date, due_time, description } = input as {
          title: string; priority?: number; due_date?: string; due_time?: string; description?: string
        }
        const task = createTask({
          title,
          priority:    ((priority ?? 3) as Priority),
          due_date:    due_date ? new Date(due_date).getTime() : null,
          due_time:    due_time ?? null,
          description: description ?? '',
        })
        onDataChange(['tasks'])
        return {
          success: true,
          message: `Tarea creada exitosamente.`,
          data:    { id: task.id, title: task.title, priority: task.priority, due_date: task.due_date },
        }
      }

      case 'update_task_status': {
        const { task_title, status } = input as { task_title: string; status: TaskStatus }
        const all   = listTasks()
        const match = all.find(t => t.title.toLowerCase().includes(task_title.toLowerCase()))
        if (!match) return { success: false, message: `No encontré ninguna tarea que coincida con "${task_title}". Verificá el nombre.` }
        updateTask(match.id, { status })
        onDataChange(['tasks'])
        const statusLabel: Record<string, string> = {
          pending: 'Pendiente', in_progress: 'En progreso', blocked: 'Bloqueado', done: 'Hecho'
        }
        return { success: true, message: `Tarea "${match.title}" cambiada a: ${statusLabel[status] ?? status}.`, data: { id: match.id } }
      }

      case 'create_delegated_task': {
        const { title, contact_name, priority, due_date, description } = input as {
          title: string; contact_name: string; priority?: number; due_date?: string; description?: string
        }
        const contacts = listContacts()
        const contact  = contacts.find(c => c.name.toLowerCase().includes(contact_name.toLowerCase()))
        if (!contact) {
          const names = contacts.slice(0, 8).map(c => c.name).join(', ')
          return { success: false, message: `No encontré contacto "${contact_name}". Contactos disponibles: ${names || '(ninguno)'}` }
        }
        const task = createDelegatedTask({
          title,
          contact_id:  contact.id,
          priority:    ((priority ?? 3) as Priority),
          due_date:    due_date ? new Date(due_date).getTime() : null,
          description: description ?? '',
        })
        onDataChange(['delegated-tasks'])
        return {
          success: true,
          message: `Tarea delegada a ${contact.name}: "${task.title}".`,
          data:    { id: task.id, contact: contact.name },
        }
      }

      case 'update_import_status': {
        const { import_title, status } = input as { import_title: string; status: ImportStatus }
        const all   = listImports()
        const match = all.find(i => i.title.toLowerCase().includes(import_title.toLowerCase()))
        if (!match) return { success: false, message: `No encontré importación con "${import_title}".` }
        updateImport(match.id, { status })
        onDataChange(['comex-imports'])
        return {
          success: true,
          message: `Importación "${match.title}" actualizada a: ${STATUS_LABELS[status] ?? status}.`,
          data:    { id: match.id },
        }
      }

      case 'add_import_note': {
        const { import_title, note } = input as { import_title: string; note: string }
        const all   = listImports()
        const match = all.find(i => i.title.toLowerCase().includes(import_title.toLowerCase()))
        if (!match) return { success: false, message: `No encontré importación con "${import_title}".` }
        updateImport(match.id, { notes: note })
        onDataChange(['comex-imports'])
        return { success: true, message: `Nota guardada en "${match.title}".` }
      }

      case 'list_contacts': {
        const { search } = input as { search?: string }
        const contacts = listContacts()
        const filtered = search
          ? contacts.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
          : contacts
        return {
          success: true,
          message: `${filtered.length} contacto(s) encontrado(s).`,
          data: filtered.map(c => ({ id: c.id, name: c.name, phone: c.phone })),
        }
      }

      default:
        return { success: false, message: `Tool desconocido: ${name}` }
    }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Error al ejecutar la acción' }
  }
}

// ── Contexto del sistema ──────────────────────────────────────────────────────

function buildSystemContext(): string {
  const today   = new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const imports = listImports()
  const active  = imports.filter(i => i.status !== 'delivered')
  const delivered = imports.filter(i => i.status === 'delivered')

  const totalActiveUSD = active.reduce((s, i) => s + (i.actual_value ?? i.estimated_value ?? 0), 0)
  const withCost  = imports.filter(i => i.cost_pct != null)
  const avgCostPct = withCost.length > 0
    ? (withCost.reduce((s, i) => s + (i.cost_pct ?? 0), 0) / withCost.length) : null

  // ── Importaciones activas — detalle completo ───────────────────────────────
  const activeDetails = active.map(imp => {
    const val     = imp.actual_value ?? imp.estimated_value
    const valType = imp.actual_value != null ? 'factura' : 'estimado'
    const eta     = imp.eta_4 ?? imp.eta_3 ?? imp.eta_2 ?? imp.arrival_date
    const lines: string[] = []

    lines.push(`━━ ${imp.title.toUpperCase()} ━━`)
    lines.push(`  Estado: ${STATUS_LABELS[imp.status] ?? imp.status}`)
    lines.push(`  Proveedor: ${imp.supplier?.name ?? 'N/A'}${imp.supplier?.country ? ` (${imp.supplier.country})` : ''}`)
    lines.push(`  Valor (${valType}): ${imp.currency} ${fNum(val)}`)
    if (imp.incoterm)     lines.push(`  Incoterm: ${imp.incoterm}`)
    if (imp.origin_port)  lines.push(`  Puerto origen: ${imp.origin_port}`)
    if (imp.order_date)   lines.push(`  Fecha pedido: ${fDate(imp.order_date)}`)
    if (imp.payment_date) lines.push(`  Fecha pago: ${fDate(imp.payment_date)}`)
    if (imp.ship_date || imp.actual_ship_date) {
      const d = imp.actual_ship_date ?? imp.ship_date
      lines.push(`  Embarque: ${fDate(d)}${imp.actual_ship_date ? ' (real)' : ' (estimado)'}`)
    }
    if (eta) lines.push(`  ETA: ${fDate(eta)}`)
    if (imp.actual_arrival_date) lines.push(`  Llegada real: ${fDate(imp.actual_arrival_date)}`)
    if (imp.tracking_number) lines.push(`  Tracking: ${imp.tracking_number}`)
    if (imp.inal_required)   lines.push(`  INAL: Requerido | LC: ${imp.inal_lc_status ?? 'pendiente'}`)

    const customs = getCustoms(imp.id)
    if (customs) {
      if (customs.despacho_number) lines.push(`  Nro despacho: ${customs.despacho_number}`)
      if (customs.canal)           lines.push(`  Canal: ${customs.canal}`)
      if (customs.oficializacion_date) lines.push(`  Oficialización: ${fDate(customs.oficializacion_date)}`)
      if (customs.dolar_aduana)    lines.push(`  Dólar aduana: $${fNum(customs.dolar_aduana, 4)}`)
      if (customs.fob_declared)    lines.push(`  FOB declarado: ${customs.fob_currency ?? 'USD'} ${fNum(customs.fob_declared)}`)
    }

    const tributos = listTributos(imp.id)
    if (tributos.length > 0) {
      const totalTrib = tributos.reduce((s, t) => s + (t.importe_usd ?? 0), 0)
      lines.push(`  Tributos (total USD ${fNum(totalTrib)}): ${tributos.map(t => `${t.concepto} ${fNum(t.importe_usd, 0)}`).join(' | ')}`)
    }

    const extras = listExtraCosts(imp.id).filter(e => (e.importe ?? 0) > 0)
    if (extras.length > 0) {
      lines.push(`  Costos extra: ${extras.map(e => `${e.concepto} ${e.moneda ?? 'ARS'} ${fNum(e.importe_ars ?? e.importe, 0)}`).join(' | ')}`)
    }

    if (imp.cost_pct != null) {
      lines.push(`  Costo importación: ${fNum(imp.cost_pct, 1)}%`)
      if (imp.tc_eur_ars && imp.currency === 'EUR') {
        lines.push(`  TC EUR/ARS: $${fNum(imp.tc_eur_ars, 4)} | Base ARS: $${fNum((val ?? 0) * imp.tc_eur_ars, 0)}`)
      }
    }

    const proformas = listProformas(imp.id, 'proforma')
    if (proformas.length > 0) lines.push(`  Proformas: ${proformas.map(p => `P${p.numero} ${p.moneda} ${fNum(p.importe)}`).join(', ')}`)

    const facturas = listProformas(imp.id, 'factura')
    if (facturas.length > 0) lines.push(`  Facturas: ${facturas.map(f => `F${f.numero} ${f.moneda} ${fNum(f.importe)}`).join(', ')}`)

    const payments = listPayments(imp.id)
    if (payments.length > 0) {
      const paid = payments.filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0)
      const pend = payments.filter(p => p.status !== 'completed').reduce((s, p) => s + p.amount, 0)
      lines.push(`  Pagos: pagado ${fNum(paid, 0)} | pendiente ${fNum(pend, 0)}`)
    }

    if (imp.notes) lines.push(`  Notas: ${imp.notes.slice(0, 200)}`)
    return lines.join('\n')
  }).join('\n\n')

  // ── Entregadas (resumen compacto) ──────────────────────────────────────────
  const deliveredSummary = delivered.length === 0 ? '' : [
    `\nIMPORTACIONES ENTREGADAS (${delivered.length}):`,
    ...delivered.slice(0, 15).map(i => {
      const val = i.actual_value ?? i.estimated_value
      const parts = [`• ${i.title} | ${i.supplier?.name ?? '?'} | ${i.currency} ${fNum(val, 0)}`]
      if (i.cost_pct != null) parts.push(`costo: ${fNum(i.cost_pct, 1)}%`)
      if (i.actual_arrival_date) parts.push(`llegó: ${fDate(i.actual_arrival_date)}`)
      return parts.join(' | ')
    }),
  ].join('\n')

  // ── Tareas personales ──────────────────────────────────────────────────────
  const allTasks  = listTasks()
  const pendTasks = allTasks.filter(t => t.status !== 'done')
  const doneTasks = allTasks.filter(t => t.status === 'done')
  const now = Date.now()

  const PRIORITY_LABEL: Record<number, string> = { 1: 'Crítica', 2: 'Alta', 3: 'Media', 4: 'Baja', 5: 'Algún día' }
  const TASK_ST: Record<string, string> = { pending: 'Pendiente', in_progress: 'En progreso', blocked: 'Bloqueado', done: 'Hecho' }

  const taskLines = pendTasks.map(t => {
    const overdue = t.due_date && t.due_date < now ? ' ⚠VENCIDA' : ''
    const due  = t.due_date ? ` | vence: ${fDate(t.due_date)}${t.due_time ? ' ' + t.due_time : ''}${overdue}` : ''
    const proj = t.project?.name ? ` | proyecto: ${t.project.name}` : ''
    return `  • [${TASK_ST[t.status]}] P${t.priority}-${PRIORITY_LABEL[t.priority]}: ${t.title}${due}${proj}`
  })

  const overdueCount = pendTasks.filter(t => t.due_date && t.due_date < now).length
  const todayCount   = pendTasks.filter(t => {
    if (!t.due_date) return false
    const d = new Date(t.due_date), tn = new Date()
    return d.getDate() === tn.getDate() && d.getMonth() === tn.getMonth() && d.getFullYear() === tn.getFullYear()
  }).length

  const tasksSection = [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `TAREAS PERSONALES`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Resumen: ${pendTasks.length} pendientes | ${doneTasks.length} completadas | ${overdueCount} vencidas | ${todayCount} vencen hoy`,
    taskLines.length > 0 ? taskLines.join('\n') : '  (ninguna tarea pendiente)',
    doneTasks.length > 0 ? `\nÚltimas completadas: ${doneTasks.slice(-5).map(t => t.title).join(', ')}` : '',
  ].filter(Boolean).join('\n')

  // ── Tareas delegadas ───────────────────────────────────────────────────────
  const allDeleg    = listDelegatedTasks()
  const activeDeleg = allDeleg.filter(t => t.status !== 'done' && t.status !== 'cancelled')
  const doneDeleg   = allDeleg.filter(t => t.status === 'done')
  const DELEG_ST: Record<string, string> = { pending: 'Pendiente', in_progress: 'En progreso', done: 'Hecho', cancelled: 'Cancelado' }

  const delegLines = activeDeleg.map(t => {
    const ov  = t.due_date && t.due_date < now ? ' ⚠VENCIDA' : ''
    const due = t.due_date ? ` | vence: ${fDate(t.due_date)}${ov}` : ''
    return `  • [${DELEG_ST[t.status]}] → ${t.contact?.name ?? '?'} | P${t.priority}: ${t.title}${due}`
  })

  const overdueDelCount = activeDeleg.filter(t => t.due_date && t.due_date < now).length

  const delegSection = [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `TAREAS DELEGADAS`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Resumen: ${activeDeleg.length} activas | ${doneDeleg.length} completadas | ${overdueDelCount} vencidas`,
    delegLines.length > 0 ? delegLines.join('\n') : '  (ninguna)',
  ].join('\n')

  return `Sos el asistente interno de FlowTask para Diego (NAKA OUTDOORS CO. S.R.L., Argentina).
Empresa importadora de equipamiento outdoor. Hoy es ${today}.
Rol: segundo cerebro de Diego. Tenés visibilidad completa y podés ejecutar acciones usando los tools disponibles.

RESUMEN GLOBAL:
- Importaciones activas: ${active.length} | Entregadas: ${delivered.length} | Total: ${imports.length}
- Valor activo: USD ${fNum(totalActiveUSD, 0)}
${avgCostPct != null ? `- Costo promedio histórico: ${fNum(avgCostPct, 1)}%` : ''}
- En tránsito: ${active.filter(i => ['shipped','transit'].includes(i.status)).length} | En aduana: ${active.filter(i => i.status === 'customs').length} | INAL requerido: ${active.filter(i => i.inal_required).length}
- Tareas personales pendientes: ${pendTasks.length} (${overdueCount} vencidas) | Delegadas activas: ${activeDeleg.length} (${overdueDelCount} vencidas)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPORTACIONES ACTIVAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${activeDetails || '(ninguna importación activa)'}
${deliveredSummary}

${tasksSection}

${delegSection}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUCCIONES:
- Respondé siempre en español, conciso y orientado al negocio.
- Podés usar los tools para crear tareas, actualizar estados y agregar notas. Hacelo directamente sin pedir confirmación adicional, salvo que el dato sea ambiguo.
- Si el usuario dice "creame una tarea", "anotá que...", "cambia el estado de...", "delegá a..." → usá el tool correspondiente de inmediato.
- Si no tenés suficiente información para ejecutar (ej: no sabe a quién delegar), pedí el dato específico que falta.
- Para cálculos de costo: costo% = (tributos + extras) / base_ARS × 100.
- Detectá urgencias (vencidos, INAL pendiente, aduana) y mencionalos proactivamente.
- Las fechas son dd/mm/yyyy. Los montos en ARS usan punto para miles, coma para decimales.`
}

// ── Tool Use loop + Streaming ─────────────────────────────────────────────────

export type ChunkCallback = (text: string) => void

export async function sendChatMessage(
  userMessage: string,
  sessionId:   string = 'default',
  onChunk:     ChunkCallback,
  onDataChange: DataChangeCallback = () => {},
): Promise<string> {
  const config = getAIConfig()
  if (!config.apiKey) throw new Error('API key de Claude no configurada. Configurála en Ajustes → IA.')

  const client = new Anthropic({ apiKey: config.apiKey })

  // 1. Guardar mensaje del usuario
  saveChatMessage('user', userMessage, sessionId)

  // 2. Auto-compactar si el historial es largo (corre en paralelo, no bloquea el stream)
  await compactHistoryIfNeeded(sessionId, client, config.apiKey)

  // 3. Construir historial para la API (últimos 22 mensajes post-compactación)
  //    Los mensajes de resumen (🧠) se incluyen como contexto de "memoria larga"
  const history = getChatHistory(sessionId, 22)
  const apiMessages: Anthropic.MessageParam[] = history
    .filter(m => m.content !== userMessage || m.role !== 'user' || m === history[history.length - 1])
    .map(m => ({ role: m.role, content: m.content }))

  const lastMsg = apiMessages[apiMessages.length - 1]
  if (!lastMsg || lastMsg.content !== userMessage || lastMsg.role !== 'user') {
    apiMessages.push({ role: 'user', content: userMessage })
  }

  const systemPrompt = buildSystemContext()
  let fullText = ''

  // ── Tool Use loop ────────────────────────────────────────────────────────
  // Claude puede encadenar múltiples tool calls antes de la respuesta final
  let keepLooping = true
  while (keepLooping) {
    const stream = client.messages.stream({
      model:       config.models?.['dashboard_chat'] ?? 'claude-sonnet-4-5',
      max_tokens:  2048,
      system:      systemPrompt,
      messages:    apiMessages,
      tools:       CHAT_TOOLS,
      tool_choice: { type: 'auto' },
    })

    // Transmitir texto parcial en tiempo real
    stream.on('text', (text) => {
      fullText += text
      onChunk(text)
    })

    const finalMsg = await stream.finalMessage()

    if (finalMsg.stop_reason === 'tool_use') {
      // Agregar respuesta del asistente (con los tool_use blocks) al historial
      apiMessages.push({ role: 'assistant', content: finalMsg.content })

      // Ejecutar todos los tools solicitados
      const toolUseBlocks = finalMsg.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[]
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const tu of toolUseBlocks) {
        // Indicador visual del tool en ejecución
        const label = `\n\`⚙ ${TOOL_LABELS[tu.name] ?? tu.name}\`\n`
        fullText += label
        onChunk(label)

        const result = await executeTool(tu.name, tu.input as Record<string, unknown>, onDataChange)

        toolResults.push({
          type:        'tool_result',
          tool_use_id: tu.id,
          content:     JSON.stringify(result),
        })
      }

      // Agregar resultados y continuar el loop
      apiMessages.push({ role: 'user', content: toolResults })

    } else {
      // stop_reason === 'end_turn' (u otro): terminamos
      keepLooping = false
    }
  }

  saveChatMessage('assistant', fullText, sessionId)
  return fullText
}
