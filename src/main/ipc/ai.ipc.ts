import { ipcMain, dialog, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import {
  getAIConfig, saveAIConfig, isAIConfigured,
  analyzeDocument, dashboardChat, validateDespachoResult,
  getPromptOverride, savePromptOverride, deletePromptOverride, listPromptOverrides,
  getEffectiveSystemPrompt,
} from '../services/ai.service'
import { DEFAULT_SYSTEM_PROMPTS, PROMPT_LABELS, PROMPT_DESCRIPTIONS } from '../services/ai.prompts'
import { getDocument, getImport, getExtraCost, getProforma } from '../database/queries/comex'
import { getAttachmentsDir } from '../database/db'
import type { AIOperation, AIConfig, ClaudeModelId } from '@shared/types'

// Ruta al archivo de prompts (solo funciona en dev mode con acceso al código fuente)
const PROMPTS_SOURCE_FILE = process.env.NODE_ENV !== 'production'
  ? path.join(process.cwd(), 'src', 'main', 'services', 'ai.prompts.ts')
  : null

function docTypeToOperation(docType: string): AIOperation {
  if (docType === 'customs_declaration') return 'extract_despacho'
  if (docType === 'invoice')             return 'extract_factura'
  return 'extract_general'
}

export function registerAIIpc(): void {
  // ── Configuración ──────────────────────────────────────────────────────────
  ipcMain.handle('ai:isConfigured', () => isAIConfigured())

  ipcMain.handle('ai:getConfig', () => {
    const config = getAIConfig()
    // Ocultar la key completa por seguridad — devolver solo los últimos 4 chars
    return {
      ...config,
      apiKey: config.apiKey ? `sk-...${config.apiKey.slice(-4)}` : ''
    }
  })

  ipcMain.handle('ai:getModels', () => getAIConfig().models)

  ipcMain.handle('ai:saveApiKey', (_e, apiKey: string) => {
    saveAIConfig({ apiKey })
  })

  ipcMain.handle('ai:saveModels', (_e, models: Record<AIOperation, ClaudeModelId>) => {
    saveAIConfig({ models })
  })

  // ── Análisis de documentos ─────────────────────────────────────────────────
  ipcMain.handle('ai:analyzeDocument', (
    _e,
    params: { filePath: string; operation: AIOperation; extraContext?: string }
  ) => analyzeDocument(params))

  // ── Análisis del despacho adjunto a una importación ──────────────────────
  // page: 1 = primera hoja (default), 2 = segunda hoja, etc.
  ipcMain.handle('ai:analyzeDespacho', async (_e, importId: string, page: number = 1) => {
    const record = getImport(importId)
    if (!record) throw new Error('Importación no encontrada')
    if (!record.despacho_stored_name) throw new Error('No hay despacho adjunto a esta importación. Subí el PDF primero.')
    const filePath = path.join(getAttachmentsDir(), record.despacho_stored_name)

    // Capa 2: inyectar nombre del proveedor como ancla para el OCR del campo "Vendedor"
    const supplierName = record.supplier?.name?.trim() ?? ''
    const extraContext = supplierName ? `Proveedor de esta importación: ${supplierName}` : ''

    const raw = await analyzeDocument({
      filePath,
      operation: 'extract_despacho',
      pages: [page],
      extraContext,
    })

    // Capa 3: validación y auto-corrección post-extracción
    return validateDespachoResult(raw, supplierName)
  })

  // ── Análisis del BL adjunto a una importación ────────────────────────────
  ipcMain.handle('ai:analyzeBL', async (_e, importId: string) => {
    const record = getImport(importId)
    if (!record) throw new Error('Importación no encontrada')
    if (!record.bl_stored_name) throw new Error('No hay BL adjunto a esta importación. Subí el archivo primero.')
    const filePath = path.join(getAttachmentsDir(), record.bl_stored_name)
    return analyzeDocument({ filePath, operation: 'extract_bl' })
  })

  // ── Análisis de proforma ──────────────────────────────────────────────────
  ipcMain.handle('ai:analyzeProforma', async (_e, proformaId: string) => {
    const pf = getProforma(proformaId)
    if (!pf) throw new Error('Proforma no encontrada')
    if (!pf.stored_name) throw new Error('No hay archivo adjunto a esta proforma. Subí el PDF primero.')
    const filePath = path.join(getAttachmentsDir(), pf.stored_name)
    return analyzeDocument({ filePath, operation: 'extract_proforma' })
  })

  // ── Análisis de factura de costo extra ────────────────────────────────────
  const CATEGORIA_OPERATIONS: Record<string, import('@shared/types').AIOperation> = {
    flete_internacional: 'extract_factura_flete',   // USD/EUR, TC consignado
    flete_local:         'extract_factura_local',   // ARS, flete doméstico
    deposito_fiscal:     'extract_factura_deposito', // ARS, formato inglés, percepciones
  }

  const CATEGORIA_CONTEXT: Record<string, string> = {
    despachante:     'Esta es una factura de honorarios de un despachante de aduana argentino. Puede incluir: PREMALVINA, CONEXION MALVINA, MOVILIDAD, GASTOS DE DESPACHO CANAL ROJO, LIQUIDACION MANUAL ACUERDO MERCOSUR UE, GUARDA Y DIGITALIZACION, HONORARIOS DE DESPACHO DE IMPORTACION. El número de despacho suele aparecer en el ítem de honorarios.',
    deposito_fiscal: 'Esta es una factura de depósito fiscal o almacenamiento aduanero en Argentina (ej: GEMEZ, EXOLGAN, TecPlata).',
    gastos_bancarios:'Esta es una factura o liquidación de gastos bancarios, comisiones o transferencias internacionales.',
  }

  ipcMain.handle('ai:analyzeExtraCost', async (_e, costId: string) => {
    const cost = getExtraCost(costId)
    if (!cost) throw new Error('Registro de costo no encontrado')
    if (!cost.stored_name) throw new Error('No hay factura adjunta a este costo. Subí el PDF primero.')
    const filePath   = path.join(getAttachmentsDir(), cost.stored_name)
    const operation  = CATEGORIA_OPERATIONS[cost.categoria] ?? 'extract_factura_local'
    const extraContext = CATEGORIA_CONTEXT[cost.categoria] ?? ''
    return analyzeDocument({ filePath, operation, extraContext })
  })

  // ── Análisis de documento Comex (resuelve path internamente) ──────────────
  ipcMain.handle('ai:analyzeComexDocument', async (
    _e,
    params: { docId: string; operationOverride?: AIOperation }
  ) => {
    const doc = getDocument(params.docId)
    if (!doc) throw new Error('Documento no encontrado')
    if (!doc.local_stored_name) throw new Error('El documento no tiene archivo local adjunto. Adjuntá el archivo primero.')
    const filePath = path.join(getAttachmentsDir(), doc.local_stored_name)
    const operation = params.operationOverride ?? docTypeToOperation(doc.type)
    return analyzeDocument({ filePath, operation })
  })

  // ── Chat del dashboard ─────────────────────────────────────────────────────
  ipcMain.handle('ai:dashboardChat', (
    _e,
    params: {
      contextData: unknown
      messages: Array<{ role: 'user' | 'assistant'; content: string }>
    }
  ) => dashboardChat(params))

  // ── Editor de prompts ──────────────────────────────────────────────────────

  /** Lista todas las operaciones con su estado (default / override) */
  ipcMain.handle('ai:prompts:list', () => {
    const overrides  = listPromptOverrides()
    const overrideMap = new Map(overrides.map(o => [o.operation, o]))
    return Object.entries(PROMPT_LABELS).map(([op, label]) => ({
      operation:    op,
      label:        label ?? op,
      description:  PROMPT_DESCRIPTIONS[op as AIOperation] ?? '',
      hasOverride:  overrideMap.has(op),
      notes:        overrideMap.get(op)?.notes ?? '',
      updated_at:   overrideMap.get(op)?.updated_at ?? null,
    }))
  })

  /** Devuelve el prompt efectivo (override o default) para una operación */
  ipcMain.handle('ai:prompts:get', (_e, operation: AIOperation) => ({
    operation,
    effectivePrompt: getEffectiveSystemPrompt(operation),
    defaultPrompt:   DEFAULT_SYSTEM_PROMPTS[operation] ?? '',
    override:        getPromptOverride(operation),
  }))

  /** Guarda un override en DB */
  ipcMain.handle('ai:prompts:save', (_e, operation: AIOperation, systemPrompt: string, notes: string) => {
    savePromptOverride(operation, systemPrompt, notes)
    return { ok: true }
  })

  /** Elimina el override — vuelve al default del código */
  ipcMain.handle('ai:prompts:reset', (_e, operation: AIOperation) => {
    deletePromptOverride(operation)
    return { ok: true }
  })

  /** Prueba un prompt con un archivo — no guarda, solo ejecuta y devuelve resultado */
  ipcMain.handle('ai:prompts:test', async (event, operation: AIOperation, systemPromptOverride: string, filePath: string) => {
    // Guardamos temporalmente el override, corremos el análisis, lo revertimos
    const previous = getPromptOverride(operation)
    try {
      savePromptOverride(operation, systemPromptOverride, '__test__')
      const result = await analyzeDocument({ filePath, operation })
      return { ok: true, result }
    } finally {
      if (previous) {
        savePromptOverride(operation, previous.system_prompt, previous.notes)
      } else {
        deletePromptOverride(operation)
      }
    }
  })

  /** Abre diálogo para seleccionar archivo de prueba */
  ipcMain.handle('ai:prompts:selectTestFile', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: 'Seleccionar archivo para prueba',
      properties: ['openFile'],
      filters: [
        { name: 'Documentos', extensions: ['pdf','png','jpg','jpeg','xlsx','xls'] },
        { name: 'Todos', extensions: ['*'] }
      ]
    })
    return result.canceled ? null : result.filePaths[0]
  })

  /**
   * Escribe el prompt mejorado directamente en ai.prompts.ts (solo dev mode).
   * Usa los marcadores // <PROMPT_START:operation> ... // <PROMPT_END:operation>
   */
  ipcMain.handle('ai:prompts:writeToCode', async (_e, operation: AIOperation, newPrompt: string) => {
    if (!PROMPTS_SOURCE_FILE) {
      return { ok: false, error: 'Solo disponible en modo desarrollo (npm run dev)' }
    }
    if (!fs.existsSync(PROMPTS_SOURCE_FILE)) {
      return { ok: false, error: `Archivo no encontrado: ${PROMPTS_SOURCE_FILE}` }
    }

    const content  = fs.readFileSync(PROMPTS_SOURCE_FILE, 'utf-8')
    const startTag = `// <PROMPT_START:${operation}>`
    const endTag   = `// <PROMPT_END:${operation}>`
    const startIdx = content.indexOf(startTag)
    const endIdx   = content.indexOf(endTag)

    if (startIdx === -1 || endIdx === -1) {
      return { ok: false, error: `Marcadores no encontrados para operación "${operation}"` }
    }

    // Extraer el bloque completo entre marcadores
    const before = content.slice(0, startIdx + startTag.length)
    const after  = content.slice(endIdx)

    // Construir el nuevo bloque: detectar el nombre de la variable const
    const blockContent = content.slice(startIdx + startTag.length, endIdx)
    const varMatch = blockContent.match(/\nconst (\w+) = `/)
    if (!varMatch) {
      return { ok: false, error: 'No se encontró la variable const en el bloque' }
    }
    const varName = varMatch[1]

    // Escapar backticks en el nuevo prompt
    const escapedPrompt = newPrompt.replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
    const newBlock = `\nconst ${varName} = \`${escapedPrompt}\`\n`

    const newContent = before + newBlock + after
    fs.writeFileSync(PROMPTS_SOURCE_FILE, newContent, 'utf-8')

    // Calcular diff (líneas añadidas/eliminadas)
    const oldLines = blockContent.split('\n').length
    const newLines = newBlock.split('\n').length

    return {
      ok: true,
      message: `Prompt actualizado en ai.prompts.ts (+${Math.max(0,newLines-oldLines)} / -${Math.max(0,oldLines-newLines)} líneas)`,
      filePath: PROMPTS_SOURCE_FILE,
    }
  })

  /** Devuelve si el writeToCode está disponible (dev mode) */
  ipcMain.handle('ai:prompts:isDevMode', () => !!PROMPTS_SOURCE_FILE && fs.existsSync(PROMPTS_SOURCE_FILE))
}
