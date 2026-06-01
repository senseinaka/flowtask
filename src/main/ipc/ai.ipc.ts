import { ipcMain } from 'electron'
import path from 'path'
import {
  getAIConfig, saveAIConfig, isAIConfigured,
  analyzeDocument, dashboardChat
} from '../services/ai.service'
import { getDocument, getImport, getExtraCost } from '../database/queries/comex'
import { getAttachmentsDir } from '../database/db'
import type { AIOperation, AIConfig, ClaudeModelId } from '@shared/types'

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
  ipcMain.handle('ai:analyzeDespacho', async (_e, importId: string) => {
    const record = getImport(importId)
    if (!record) throw new Error('Importación no encontrada')
    if (!record.despacho_stored_name) throw new Error('No hay despacho adjunto a esta importación. Subí el PDF primero.')
    const filePath = path.join(getAttachmentsDir(), record.despacho_stored_name)
    return analyzeDocument({ filePath, operation: 'extract_despacho' })
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
}
