import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import * as XLSX from 'xlsx'
import { PDFDocument } from 'pdf-lib'
import ConfigStore from './config-store'
import { DEFAULT_SYSTEM_PROMPTS } from './ai.prompts'
import { getDb } from '../database/db'
import type {
  AIOperation, AIConfig, ClaudeModelId,
  ExtractedDespacho, ExtractedFactura, AIAnalysisResult,
  AI_OPERATION_DEFAULT_MODELS
} from '@shared/types'
import { AI_OPERATION_DEFAULT_MODELS as DEFAULT_MODELS } from '@shared/types'

const store = new ConfigStore('ai-config')

// ── Config ────────────────────────────────────────────────────────────────────

export function getAIConfig(): AIConfig {
  return {
    apiKey: store.get<string>('apiKey', ''),
    models: store.get<AIConfig['models']>('models', { ...DEFAULT_MODELS })
  }
}

export function saveAIConfig(config: Partial<AIConfig>): void {
  if (config.apiKey !== undefined) store.set('apiKey', config.apiKey.trim())
  if (config.models  !== undefined) store.set('models',  config.models)
  _client = null   // reset cached client
}

export function isAIConfigured(): boolean {
  return !!store.get<string>('apiKey', '')
}

// ── Client singleton ──────────────────────────────────────────────────────────

let _client: Anthropic | null = null

function getClient(): Anthropic {
  if (!_client) {
    const key = store.get<string>('apiKey', '')
    if (!key) throw new Error('API key de Anthropic no configurada. Configurála en Ajustes → IA.')
    _client = new Anthropic({ apiKey: key })
  }
  return _client
}

// ── Prompt overrides (desde DB) ──────────────────────────────────────────────

/** Devuelve el system prompt efectivo: override de DB si existe, o default del código */
export function getEffectiveSystemPrompt(operation: AIOperation, pagesLabel?: string): string {
  const db = getDb()
  const row = db.prepare('SELECT system_prompt FROM ai_prompt_overrides WHERE operation = ?').get(operation) as { system_prompt: string } | undefined
  const raw = row?.system_prompt ?? DEFAULT_SYSTEM_PROMPTS[operation] ?? ''
  // Reemplazar placeholder {PAGES} con el valor real
  return pagesLabel ? raw.replace('{PAGES}', pagesLabel) : raw
}

export function getPromptOverride(operation: AIOperation): { system_prompt: string; notes: string; updated_at: number } | null {
  const db  = getDb()
  return db.prepare('SELECT * FROM ai_prompt_overrides WHERE operation = ?').get(operation) as { system_prompt: string; notes: string; updated_at: number } | null
}

export function savePromptOverride(operation: AIOperation, systemPrompt: string, notes = ''): void {
  const db  = getDb()
  db.prepare(`
    INSERT INTO ai_prompt_overrides (operation, system_prompt, notes, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(operation) DO UPDATE SET system_prompt=excluded.system_prompt, notes=excluded.notes, updated_at=excluded.updated_at
  `).run(operation, systemPrompt, notes, Date.now())
}

export function deletePromptOverride(operation: AIOperation): void {
  getDb().prepare('DELETE FROM ai_prompt_overrides WHERE operation = ?').run(operation)
}

export function listPromptOverrides(): Array<{ operation: string; notes: string; updated_at: number }> {
  return getDb().prepare('SELECT operation, notes, updated_at FROM ai_prompt_overrides').all() as Array<{ operation: string; notes: string; updated_at: number }>
}

// ── Extracción de páginas de PDF (en memoria, no toca el disco) ──────────────
// Recibe el buffer del PDF completo, devuelve un nuevo PDF con solo las
// páginas pedidas (1-indexed). Si una página no existe, se ignora silenciosamente.

export async function extractPdfPages(
  source: Buffer | Uint8Array,
  pages: number[]           // 1-indexed: [1] = pág 1, [1,2] = primeras dos
): Promise<Buffer> {
  const srcDoc = await PDFDocument.load(source)
  const total  = srcDoc.getPageCount()

  // Convertir a índices 0-based y filtrar páginas que no existen
  const indices = pages
    .map(p => p - 1)
    .filter(i => i >= 0 && i < total)

  if (indices.length === 0) {
    throw new Error(`El PDF tiene ${total} páginas. Las páginas pedidas [${pages.join(',')}] no existen.`)
  }

  const newDoc = await PDFDocument.create()
  const copied = await newDoc.copyPages(srcDoc, indices)
  copied.forEach(page => newDoc.addPage(page))

  const bytes = await newDoc.save()
  return Buffer.from(bytes)
}

// ── Preparar contenido del mensaje según tipo de archivo ─────────────────────

type ContentBlock = Anthropic.MessageParam['content'][number]

interface FileToBlocksOptions {
  pages?: number[]   // Solo para PDF: páginas a extraer (1-indexed). undefined = todo el doc.
}

async function fileToContentBlocks(
  filePath: string,
  options: FileToBlocksOptions = {}
): Promise<ContentBlock[]> {
  const ext = path.extname(filePath).toLowerCase()

  // ── PDF → bloque document nativo de Claude (maneja texto Y escaneados) ─
  if (ext === '.pdf') {
    const fullBuffer = fs.readFileSync(filePath)

    // Si se piden páginas específicas → extraer solo esas antes de mandar
    const pdfBuffer = options.pages?.length
      ? await extractPdfPages(fullBuffer, options.pages)
      : fullBuffer

    const data = pdfBuffer.toString('base64')
    return [{
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data }
    } as unknown as ContentBlock]  // SDK tipea diferente internamente
  }

  // ── Imágenes → vision ───────────────────────────────────────────────────
  const imageExts: Record<string, string> = {
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif':  'image/gif',
  }
  if (imageExts[ext]) {
    const data = fs.readFileSync(filePath).toString('base64')
    return [{
      type:   'image',
      source: { type: 'base64', media_type: imageExts[ext], data }
    } as unknown as ContentBlock]
  }

  // ── XLSX / XLS / ODS → texto inteligente por hoja ──────────────────────
  if (['.xlsx', '.xls', '.ods'].includes(ext)) {
    const wb   = XLSX.readFile(filePath)
    const text = wb.SheetNames.map(name => {
      const ws       = wb.Sheets[name]
      const cellKeys = Object.keys(ws).filter(k => !k.startsWith('!'))
      const range    = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : null
      const totalPoss = range ? (range.e.c - range.s.c + 1) * (range.e.r - range.s.r + 1) : 0

      // Hoja esparsa: muchas columnas vacías (típico en proformas chinas con miles de columnas)
      // En ese caso usar representación addr:valor para no desperdiciar tokens en comas vacías
      const isSparse = totalPoss > 0 && (cellKeys.length / totalPoss < 0.05 || (range && range.e.c > 50))

      if (isSparse) {
        const lines = cellKeys
          .map(addr => {
            const cell = ws[addr]
            if (cell?.v === undefined || cell.v === '') return null
            return `${addr}: ${cell.v}`
          })
          .filter(Boolean)
          .join('\n')
        return `=== Hoja: ${name} (formato celda:valor) ===\n${lines}`
      } else {
        return `=== Hoja: ${name} ===\n${XLSX.utils.sheet_to_csv(ws)}`
      }
    }).join('\n\n')
    return [{ type: 'text', text: text.slice(0, 150_000) }]
  }

  // ── CSV / TXT / JSON → texto plano ────────────────────────────────────
  const text = fs.readFileSync(filePath, 'utf-8').slice(0, 150_000)
  return [{ type: 'text', text }]
}

// ── Schemas Tool Use ──────────────────────────────────────────────────────────

const TOOL_BL: Anthropic.Tool = {
  name: 'extraer_bl',
  description: 'Extrae los datos clave de un Bill of Lading (BL/FBL/HBL/MBL) multimodal o marítimo.',
  input_schema: {
    type: 'object' as const,
    properties: {
      bl_number: {
        type: 'string',
        description: 'Número de BL. En documentos DSLV/FBL aparece arriba a la derecha como "FBL XXXXXX-XXXX-XXXX". Ej: "60-2604-0248". null si no encontrado.'
      },
      fecha_emision: {
        type: 'string',
        description: 'Fecha de emisión ("Place and date of issue"). Convertir a YYYY-MM-DD. Ej: "19.04.2026" → "2026-04-19". null si no encontrado.'
      },
      buque: {
        type: 'string',
        description: 'Nombre del buque ("Ocean vessel"). Ej: "NAVIOS VERDE". null si no encontrado.'
      },
      puerto_embarque: {
        type: 'string',
        description: 'Puerto de carga ("Port of loading"). Ej: "HAMBURG". null si no encontrado.'
      },
      puerto_descarga: {
        type: 'string',
        description: 'Puerto de descarga ("Port of discharge"). Ej: "BUENOS AIRES". null si no encontrado.'
      },
      consignor: {
        type: 'string',
        description: 'Consignante/exportador ("Consignor"). Ej: "EDELRID GMBH & CO. KG". null si no encontrado.'
      },
      cant_pallets: {
        type: 'number',
        description: 'Cantidad de PALLETS en "Number and kind of packages". Solo contar los que dicen "PALLETS", "PLTS" o "PALLET". Ej: "9 PALLETS" → 9. null si no encontrado o si el bulto es otra cosa.'
      },
      cant_cartons: {
        type: 'number',
        description: 'Cantidad de CAJAS/CARTONES en "Number and kind of packages". Solo contar los que dicen "CARTONS", "CTNS", "BOXES", "CAJAS". Ej: "50 CARTONS" → 50. null si no encontrado o si no dice cajas/cartones.'
      },
      peso_bruto_kg: {
        type: 'number',
        description: 'Peso bruto en kg ("Gross weight"). Puede venir como "1.960,000 KGS" (formato argentino) o "1,960.000 KGS" (formato inglés). Siempre convertir al número internacional. Ej: "1.960,000 KGS" → 1960.0. null si no encontrado.'
      },
      volumen_m3: {
        type: 'number',
        description: 'Volumen en m³/CBM ("Measurement"). Ej: "16,176 CBM" → 16.176 (formato inglés, coma=miles) o "16.176 CBM" → 16.176. null si no encontrado.'
      },
      nro_contenedor: {
        type: 'string',
        description: 'Número de contenedor (4 letras + 7 dígitos). Buscar "LCL/LCL CONTAINER No.:" o similar. Limpiar espacios/guiones: "BMOU 517 732-5" → "BMOU5177325". null si no encontrado.'
      },
      descripcion_carga: {
        type: 'string',
        description: 'Descripción corta de la mercadería ("Description of goods"). Ej: "CLIMBING EQUIPMENT". null si no encontrado.'
      }
    },
    required: ['bl_number']
  }
}

const TOOL_DESPACHO: Anthropic.Tool = {
  name: 'extraer_despacho',
  description: 'Extrae los datos de la Hoja 1 de un despacho de aduana argentino (formulario OM-1993 SIM/MARIA). Solo procesar Hoja 1.',
  input_schema: {
    type: 'object' as const,
    properties: {

      // ── Identificación ─────────────────────────────────────
      numero_despacho: {
        type: 'string',
        description: 'Campo "Año/Ad./Tipo/NºReg./DC". Incluir todos los segmentos. Ej: "26 001 IC04 101630 G". null si no encontrado.'
      },
      fecha_oficializacion: {
        type: 'string',
        description: 'Campo "Oficialización". Convertir a YYYY-MM-DD. null si no encontrado.'
      },
      fecha_arribo: {
        type: 'string',
        description: 'Campo "Fecha Arribo". Convertir a YYYY-MM-DD. null si no encontrado.'
      },
      canal: {
        type: 'string',
        description: 'Campo "Canal Asignado" (abajo a la izquierda). Ej: "ROJO 0005", "VERDE 0001". null si no encontrado.'
      },

      // ── Partes involucradas ────────────────────────────────
      despachante: {
        type: 'string',
        description: 'Nombre completo del campo "Despachante de Aduana". null si no encontrado.'
      },
      importador: {
        type: 'string',
        description: 'Razón social del campo "Importador/Exportador". null si no encontrado.'
      },
      vendedor: {
        type: 'string',
        description: 'Nombre del campo "Vendedor" (proveedor extranjero). null si no encontrado.'
      },
      agente_transporte: {
        type: 'string',
        description: 'Razón social del campo "Agente de Transporte Aduanero" (ej: "SOUTH CARGO S.A."). Es distinto al despachante. null si no encontrado.'
      },

      // ── Transporte ─────────────────────────────────────────
      bl_numero: {
        type: 'string',
        description: 'Campo "Documento de Transporte" (Bill of Lading o AWB). null si no encontrado.'
      },
      buque: {
        type: 'string',
        description: 'Campo "Nombre del Transporte" (nombre del buque o aeronave). null si no encontrado.'
      },
      origen_pais: {
        type: 'string',
        description: 'Campo "Origen País / Provincia". null si no encontrado.'
      },

      // ── Valores ────────────────────────────────────────────
      incoterm: {
        type: 'string',
        description: 'Campo "Cond. Venta" (condición de venta / incoterm). Ej: FCA, FOB, CIF. null si no encontrado.'
      },
      fob_total: {
        type: 'number',
        description: 'Campo "FOB Total". ATENCIÓN formato numérico argentino: punto = miles, coma = decimal. "31.689,36" → 31689.36. null si no encontrado.'
      },
      fob_divisa: {
        type: 'string',
        description: 'Campo "Divisa" junto al FOB Total. Ej: "DOL" (dólares), "EURO". null si no encontrado.'
      },
      cotizacion_dolar: {
        type: 'number',
        description: 'Tipo de cambio oficial de aduana. Está en "Información Complementaria" como "Cotiz = X.XXX,XXXXXX". ATENCIÓN formato argentino: "1.411,000000" → 1411.0. null si no encontrado.'
      },
      peso_bruto_kg: {
        type: 'number',
        description: 'Campo "Peso Bruto". Formato argentino. null si no encontrado.'
      },
      total_bultos: {
        type: 'number',
        description: 'Campo "Total Bultos". null si no encontrado.'
      },
      nro_factura: {
        type: 'string',
        description: 'Número de factura en "Información Complementaria" → "Nros. Facturas: XXXXXXXX". null si no encontrado.'
      },

      // ── TRIBUTOS — dato más importante del despacho ────────
      tributos: {
        type: 'array',
        description: 'Lista completa de tributos de la sección LIQUIDACIÓN. Tomar los importes de la columna TOTAL (lado derecho del documento). Los importes son en USD.',
        items: {
          type: 'object' as const,
          properties: {
            codigo:      { type: 'string', description: 'Código entre paréntesis. Ej: "010", "011", "415".' },
            concepto:    { type: 'string', description: 'Nombre del tributo. Usar estos nombres exactos: código 010 → "DERECHOS IMPORTACION", código 011 → "TASA DE ESTADISTICA", código 061 → "TASA ESTAD MONT MAX", código 415 → "I.V.A.", código 422 → "IVA ADICIONAL" (omitir la palabra INSCA), código 424 → "IMP. A LAS GANANCIAS", código 500 → "ARANCEL SIM IMP", código 900 → "INGRESOS BRUTOS". Para otros códigos, usar el texto tal como aparece.' },
            porcentaje:  { type: 'number', description: 'Porcentaje de la columna "Porc." si figura. null si no tiene porcentaje. IMPORTANTE: código 422 tiene 20%, NO 21%.' },
            importe_usd: { type: 'number', description: 'Importe de la columna TOTAL (derecha). Formato argentino → convertir a número internacional.' }
          },
          required: ['codigo', 'concepto', 'importe_usd']
        }
      },
      total_tributos_usd: {
        type: 'number',
        description: 'Suma total de todos los importes de tributos en USD. Calcular sumando todos los importe_usd del array tributos.'
      }
    },
    required: ['tributos']
  }
}

const TOOL_FACTURA_LOCAL: Anthropic.Tool = {
  name: 'extraer_factura_local',
  description: 'Extrae datos de una factura argentina (Tipo A, B o C) de servicios o gastos locales, incluyendo facturas de despachantes de aduana.',
  input_schema: {
    type: 'object' as const,
    properties: {
      proveedor:    { type: 'string', description: 'Razón social del emisor de la factura. null si no encontrado.' },
      cuit_emisor:  { type: 'string', description: 'CUIT del emisor (sin guiones). null si no encontrado.' },
      tipo_factura: { type: 'string', description: 'Tipo: A, B, C o M. null si no encontrado.' },
      nro_factura:  { type: 'string', description: 'Número completo formado por "Punto de Venta" + "Comp. Nro". Formato "XXXXX-XXXXXXXX". Ej: "00004-00003485". null si no encontrado.' },
      fecha:        { type: 'string', description: 'Fecha de emisión. Convertir a YYYY-MM-DD. null si no encontrado.' },
      cae:          { type: 'string', description: 'CAE N° (Código de Autorización Electrónica). null si no encontrado.' },
      referencia_despacho: {
        type: 'string',
        description: 'Número de despacho de aduana mencionado en los ítems. Buscar frases como "NRO XXXXXXXXXXX", "DESPACHO DE IMPORTACION NRO", "DESPACHO NRO". Extraer solo el código alfanumérico. Ej: "26001IC04101630G". null si no hay referencia.'
      },
      importe_neto: {
        type: 'number',
        description: 'Campo "Importe Neto Gravado" del pie de la factura — el importe SIN IVA. Es el costo real del servicio. FORMATO ARGENTINO: punto=miles, coma=decimal. "1.317.665,82" → 1317665.82'
      },
      iva: {
        type: 'number',
        description: 'Importe total de IVA del pie de la factura (sumar todas las alícuotas). Formato argentino. null si no encontrado.'
      },
      importe_total: {
        type: 'number',
        description: 'Campo "Importe Total" del pie de la factura (neto + IVA). Formato argentino. null si no encontrado.'
      },
      moneda:   { type: 'string', description: '"ARS" para pesos argentinos (la mayoría de facturas locales), "USD" si está en dólares.' },
      concepto: { type: 'string', description: 'Descripción general del servicio si la factura tiene un solo ítem. null si tiene múltiples ítems.' },
      items: {
        type: 'array',
        description: 'Lista de los ítems del DESPACHANTE (honorarios, aranceles, sellados, etc). NO incluir aquí ítems de transporte/flete — esos van en flete_local_items.',
        items: {
          type: 'object' as const,
          properties: {
            concepto: { type: 'string', description: 'Descripción del ítem tal como figura en la factura.' },
            importe:  { type: 'number', description: 'Importe neto del ítem (sin IVA). Formato argentino → número internacional.' }
          },
          required: ['concepto', 'importe']
        }
      },
      flete_local_items: {
        type: 'array',
        description: 'Ítems de TRANSPORTE TERRESTRE que van al "Flete local". Incluir: "Flete Interno", "Flete Local", "Flete", "Transporte", "Acarreo", "PEAJE" (siempre incluir peaje aunque sea Exento de IVA), "Autopista", "Ruta", "Traslado". NO incluir: honorarios, aranceles, gastos portuarios, MALVINA, sellados. Si no hay ítems de transporte, devolver array vacío [].',
        items: {
          type: 'object' as const,
          properties: {
            concepto:       { type: 'string', description: 'Descripción exacta del ítem.' },
            importe_neto:   { type: 'number', description: 'Importe del ítem de la columna "Importe". Para gravados: es el neto sin IVA. Para exentos (columna IVA% vacía): es el total del ítem. Formato argentino → número internacional.' },
            iva_porcentaje: { type: 'number', description: 'Porcentaje de IVA: 21 si dice 21,00 en la columna IVA%; 10.5 si dice 10,50; 0 si la columna IVA% está vacía/sin valor (ítem EXENTO). Ej: PEAJE sin IVA% → iva_porcentaje = 0.' }
          },
          required: ['concepto', 'importe_neto', 'iva_porcentaje']
        }
      }
    },
    required: ['items']
  }
}

const TOOL_FACTURA_FLETE: Anthropic.Tool = {
  name: 'extraer_factura_flete',
  description: 'Extrae datos de una factura de flete o servicios logísticos emitida en Argentina por un agente de carga o naviera, que puede estar en USD, EUR u otra moneda.',
  input_schema: {
    type: 'object' as const,
    properties: {
      proveedor:    { type: 'string', description: 'Razón social del emisor (agente de carga, naviera). null si no encontrado.' },
      cuit_emisor:  { type: 'string', description: 'CUIT del emisor (sin guiones). null si no encontrado.' },
      tipo_factura: { type: 'string', description: 'Tipo: A, B, C o M. null si no encontrado.' },
      nro_factura:  { type: 'string', description: 'Número "Punto de Venta" + "Comp. Nro". Formato "XXXXX-XXXXXXXX". Ej: "00007-00000013".' },
      fecha:        { type: 'string', description: 'Fecha de emisión. Convertir a YYYY-MM-DD. null si no encontrado.' },
      cae:          { type: 'string', description: 'CAE N° (Código de Autorización Electrónica). null si no encontrado.' },
      bl_referencia: {
        type: 'string',
        description: 'Bill of Lading o AWB. En "Referencia Comercial: BL-XXXXXX". Solo el código sin prefijo "BL-". Ej: "CB674882". null si no encontrado.'
      },
      moneda: {
        type: 'string',
        description: 'Moneda de la factura. Buscar en "Moneda: USD - Dólar Estadounidense" o "Moneda: EUR - Euro". Devolver solo el código: "USD", "EUR", "ARS".'
      },
      tipo_cambio_consignado: {
        type: 'number',
        description: 'Tipo de cambio en la línea de pie: "tipo de cambio consignado de XXXX.XXXXXX". El número usa PUNTO como decimal (ya está en formato internacional). Ej: "1420.000000" → 1420.0. null si no encontrado.'
      },
      importe_neto: {
        type: 'number',
        description: 'Campo "Importe Neto Gravado" del pie. Puede ser 0 si la factura es exenta de IVA. FORMATO ARGENTINO: punto=miles, coma=decimal. "518,52" → 518.52'
      },
      iva: {
        type: 'number',
        description: 'Total IVA del pie. 0 si exento. Formato argentino. null si no encontrado.'
      },
      importe_total: {
        type: 'number',
        description: 'Campo "Importe Total" del pie en la moneda de la factura. Formato argentino. null si no encontrado.'
      },
      importe_ars: {
        type: 'number',
        description: 'Monto total en pesos argentinos. En la línea: "asciende a: $ XXXXXXXX". Formato argentino. null si no encontrado.'
      },
      items: {
        type: 'array',
        description: 'Lista de todos los ítems con sus importes netos en la moneda de la factura.',
        items: {
          type: 'object' as const,
          properties: {
            concepto: { type: 'string', description: 'Descripción del ítem. Conceptos comunes: FREIGHT, GASTOS ORIGEN, EBS, DESCONSOL, AGP, DOCUMENT FEE.' },
            importe:  { type: 'number', description: 'Importe neto del ítem. Formato argentino → número internacional.' }
          },
          required: ['concepto', 'importe']
        }
      }
    },
    required: ['items']
  }
}

const TOOL_FACTURA_DEPOSITO: Anthropic.Tool = {
  name: 'extraer_factura_deposito',
  description: 'Extrae datos de una factura de depósito fiscal o logística aduanera argentina emitida en pesos (ARS).',
  input_schema: {
    type: 'object' as const,
    properties: {
      proveedor:    { type: 'string', description: 'Razón social del depósito (ej: "GEMEZ SA"). null si no encontrado.' },
      cuit_emisor:  { type: 'string', description: 'CUIT del emisor sin guiones. null si no encontrado.' },
      tipo_factura: { type: 'string', description: 'Tipo de factura: A, B, M. null si no encontrado.' },
      nro_factura:  { type: 'string', description: 'Número de factura. Combinar Punto de Venta + número. Ej: "0014-00217299". null si no encontrado.' },
      fecha:        { type: 'string', description: 'Fecha de emisión. Convertir a YYYY-MM-DD. null si no encontrado.' },
      cae:          { type: 'string', description: 'CAE N° (Código de Autorización Electrónica). null si no encontrado.' },
      referencia_despacho: {
        type: 'string',
        description: 'Campo "Nro. Despacho" de la factura. Extraer el código completo. Ej: "2026-001-IC04-101630G". null si no encontrado.'
      },
      bl_referencia: {
        type: 'string',
        description: 'Campo "Nro. BL" o "BL". Solo el código. Ej: "CB674882". null si no encontrado.'
      },
      canal_deposito: {
        type: 'string',
        description: 'Campo "Canal". Ej: "R - Rojo", "V - Verde". null si no encontrado.'
      },
      fecha_ingreso: {
        type: 'string',
        description: 'Campo "Fecha Ingreso" al depósito. Convertir a YYYY-MM-DD. null si no encontrado.'
      },
      fecha_egreso: {
        type: 'string',
        description: 'Campo "Fecha Egreso" del depósito. Convertir a YYYY-MM-DD. null si no encontrado.'
      },
      nro_contenedor: {
        type: 'string',
        description: 'Número de contenedor (4 letras + 7 dígitos, ej: "MSDU8859271"). Buscar también en "CNT.: XXXX" dentro de la línea "Medio: ...". null si no encontrado.'
      },
      cant_bultos_deposito: {
        type: 'number',
        description: 'Cantidad de bultos/cajas de la mercadería. Extraer del patrón "CON N BULTOS" en la línea "AMPARADA POR...". Ej: "CON 9 BULTOS" → 9. null si no encontrado.'
      },
      peso_bruto_kg_deposito: {
        type: 'number',
        description: 'Peso bruto en kg. Extraer del patrón "N Kg." en la línea "AMPARADA POR X CON Y BULTOSNNN.NN Kg.". ATENCIÓN: el número va pegado a "BULTOS" sin espacio. Ej: "9 BULTOS1960.00 Kg." → 1960.0. null si no encontrado.'
      },
      volumen_m3_deposito: {
        type: 'number',
        description: 'Volumen en metros cúbicos. Extraer del patrón "N M3." en la línea "AMPARADA POR...". Ej: "16.17 M3." → 16.17. null si no encontrado.'
      },
      importe_neto: {
        type: 'number',
        description: 'Subtotal o "Importe Neto Gravado" SIN IVA ni percepciones. ATENCIÓN FORMATO INGLÉS: coma=miles, punto=decimal. "1,551,550.00" → 1551550.0. null si no encontrado.'
      },
      iva: {
        type: 'number',
        description: 'Importe de IVA (21% o 10.5%). Formato inglés. null si no encontrado.'
      },
      percepcion_caba: {
        type: 'number',
        description: 'Percepción IIBB Ciudad de Buenos Aires ("Percep. CABA" en el pie de la factura). Formato inglés. null si no figura.'
      },
      percepcion_bsas: {
        type: 'number',
        description: 'Percepción IIBB Provincia de Buenos Aires ("Percep. BS AS" en el pie de la factura). Formato inglés. null si no figura.'
      },
      percepciones: {
        type: 'number',
        description: 'Suma total de TODAS las percepciones IIBB (percepcion_caba + percepcion_bsas + cualquier otra). Si solo hay dos, es simplemente su suma. Formato inglés. null si no hay ninguna.'
      },
      importe_total: {
        type: 'number',
        description: 'Total final de la factura (neto + IVA + percepciones). Formato inglés. null si no encontrado.'
      },
      moneda:   { type: 'string', description: '"ARS" para pesos argentinos (lo normal en depósito fiscal). null si no encontrado.' },
      items: {
        type: 'array',
        description: 'Lista de todos los ítems/servicios facturados con sus importes.',
        items: {
          type: 'object' as const,
          properties: {
            concepto: { type: 'string', description: 'Descripción del servicio. Ej: ENTREGA DE MERCADERIAS, CARGOS ADMINISTRATIVOS, RECUPERO GASTOS PORTUARIOS.' },
            importe:  { type: 'number', description: 'Importe del ítem. Formato inglés (coma=miles). Ej: "521,950.00" → 521950.0' }
          },
          required: ['concepto', 'importe']
        }
      }
    },
    required: ['items']
  }
}

const TOOL_PROFORMA: Anthropic.Tool = {
  name: 'extraer_proforma',
  description: 'Extrae el valor total y datos de una proforma, cotización o pro-forma invoice de un proveedor extranjero.',
  input_schema: {
    type: 'object' as const,
    properties: {
      importe_total: {
        type: 'number',
        description: 'Valor total de la mercadería. TRES CASOS: (A) Si hay línea "Less down payment invoice n.XXXX" → ese valor ES el importe_total (ej: 71525.00). Confirmar con NETTO MERCE al pie. (B) Si hay subtotal + deducción + balance due ≠ 0 → usar el subtotal antes de la deducción. (C) Sin anticipos → usar Grand Total / TOTALE DOCUMENTO. FORMATO INTERNACIONAL: punto=decimal. "71.525,00" → 71525.0. null si no encontrado.'
      },
      moneda: {
        type: 'string',
        description: 'Moneda del documento. Buscar símbolo ($→USD, €→EUR, ¥→CNY) o código ISO. Devolver código: "USD", "EUR", "CNY", etc. null si no encontrada.'
      },
      fecha: {
        type: 'string',
        description: 'Fecha del documento (emisión o validez). Convertir a YYYY-MM-DD. null si no encontrada.'
      },
      nro_proforma: {
        type: 'string',
        description: 'Número de referencia. Buscar: "Pro-forma No.", "Quotation No.", "Reference", "Invoice No.", "Quote #". null si no encontrado.'
      },
      proveedor: {
        type: 'string',
        description: 'Nombre del proveedor/exportador/vendedor. null si no encontrado.'
      },
      descripcion: {
        type: 'string',
        description: 'Descripción breve de la mercadería (máx 80 caracteres). null si no encontrada.'
      }
    },
    required: []
  }
}

const TOOL_FACTURA: Anthropic.Tool = {
  name: 'extraer_factura',
  description: 'Extrae los datos de la factura comercial (commercial invoice)',
  input_schema: {
    type: 'object' as const,
    properties: {
      supplier_name:  { type: 'string', description: 'Nombre del proveedor/exportador.' },
      invoice_number: { type: 'string', description: 'Número de factura. null si no encontrado.' },
      invoice_date:   { type: 'string', description: 'Fecha YYYY-MM-DD. null si no encontrado.' },
      currency:       { type: 'string', description: 'Moneda (USD, EUR, CNY, etc). null si no encontrado.' },
      incoterm:       { type: 'string', description: 'Incoterm (FOB, CIF, EXW, etc). null si no encontrado.' },
      port_of_origin: { type: 'string', description: 'Puerto o ciudad de origen. null si no encontrado.' },
      items: {
        type: 'array',
        description: 'Listado de ítems de la factura',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            hs_code:     { type: 'string' },
            quantity:    { type: 'number' },
            unit:        { type: 'string' },
            unit_price:  { type: 'number' },
            total:       { type: 'number' },
          },
          required: ['description', 'quantity', 'unit_price', 'total']
        }
      },
      subtotal:      { type: 'number', description: 'Subtotal sin flete/seguro. null si no encontrado.' },
      freight:       { type: 'number', description: 'Flete. null si no encontrado.' },
      total:         { type: 'number', description: 'Total de la factura. null si no encontrado.' },
      payment_terms: { type: 'string', description: 'Condiciones de pago. null si no encontrado.' },
    },
    required: ['supplier_name', 'items']
  }
}

// ── Capa 3: Validación y auto-corrección post-extracción ─────────────────────
//
// Corrige errores sistemáticos de OCR en despachos escaneados antes de
// mostrar los datos al usuario. Cada corrección se loguea en consola.

interface ExtractedDespachoRaw {
  numero_despacho?:    string | null
  fecha_oficializacion?: string | null
  fecha_arribo?:       string | null
  fob_divisa?:         string | null
  fob_total?:          number | null
  cotizacion_dolar?:   number | null
  vendedor?:           string | null
  [key: string]:       unknown
}

export function validateDespachoResult(
  result: AIAnalysisResult,
  supplierName?: string
): AIAnalysisResult {
  if (result.operation !== 'extract_despacho') return result

  const data = result.structured as ExtractedDespachoRaw | null
  if (!data) return result

  const corrections: string[] = []
  const fixed = { ...data }

  // ── Corrección 1: Año de oficialización vs. número de despacho ─────────────
  // El número de despacho empieza con los 2 dígitos del año: "26 001..." → 2026
  if (fixed.numero_despacho && fixed.fecha_oficializacion) {
    const despachoYear2d = fixed.numero_despacho.trim().slice(0, 2)
    const yearNum = parseInt(despachoYear2d, 10)
    if (!isNaN(yearNum) && yearNum >= 20 && yearNum <= 35) {
      const expectedYear = 2000 + yearNum  // "26" → 2026

      const fixDate = (field: 'fecha_oficializacion' | 'fecha_arribo') => {
        const val = fixed[field]
        if (!val) return
        const parsed = val.match(/^(\d{4})-(\d{2})-(\d{2})$/)
        if (!parsed) return
        const [, yr, mm, dd] = parsed
        if (parseInt(yr, 10) !== expectedYear) {
          fixed[field] = `${expectedYear}-${mm}-${dd}`
          corrections.push(`${field}: ${yr} → ${expectedYear} (corregido por nro. despacho "${fixed.numero_despacho}")`)
        }
      }

      fixDate('fecha_oficializacion')
      fixDate('fecha_arribo')
    }
  }

  // ── Corrección 2: Divisa del FOB ("EURO" → "EUR", "DOL" → "USD") ──────────
  if (fixed.fob_divisa) {
    const divOrig = fixed.fob_divisa
    const div = divOrig.trim().toUpperCase()
    if (div === 'EURO' || div === 'EUR') {
      fixed.fob_divisa = 'EUR'
      if (divOrig !== 'EUR') corrections.push(`fob_divisa: "${divOrig}" → "EUR"`)
    } else if (div === 'DOL' || div === 'DOLAR' || div === 'USD') {
      fixed.fob_divisa = 'USD'
      if (divOrig !== 'USD') corrections.push(`fob_divisa: "${divOrig}" → "USD"`)
    }
  }

  // ── Corrección 3: Vendedor vs. nombre del proveedor conocido ──────────────
  // Si el nombre extraído es similar al proveedor esperado (score alto),
  // reemplazarlo por el nombre oficial. Distancia de Levenshtein simple.
  if (supplierName && fixed.vendedor && supplierName.length > 3) {
    const similarity = stringSimilarity(
      fixed.vendedor.toUpperCase(),
      supplierName.toUpperCase()
    )
    // Si similitud > 60% pero no es idéntico → usar el nombre del proveedor
    if (similarity > 0.6 && fixed.vendedor.toUpperCase() !== supplierName.toUpperCase()) {
      corrections.push(`vendedor: "${fixed.vendedor}" → "${supplierName}" (similitud ${Math.round(similarity * 100)}%, nombre del proveedor usado como referencia)`)
      fixed.vendedor = supplierName
    }
  }

  if (corrections.length > 0) {
    console.log('[AI Despacho] Auto-correcciones aplicadas:')
    corrections.forEach(c => console.log(`  ✓ ${c}`))
  }

  return { ...result, structured: fixed }
}

/** Similitud entre dos strings: ratio de caracteres coincidentes (0-1) */
function stringSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b)  return 1

  // Usamos el coeficiente de Dice sobre bigramas (mejor que Levenshtein para nombres)
  const bigrams = (s: string) => {
    const set: Record<string, number> = {}
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2)
      set[bg] = (set[bg] ?? 0) + 1
    }
    return set
  }

  const bgA = bigrams(a)
  const bgB = bigrams(b)
  let intersection = 0
  for (const bg of Object.keys(bgA)) {
    if (bgB[bg]) intersection += Math.min(bgA[bg], bgB[bg])
  }
  const totalA = Object.values(bgA).reduce((s, v) => s + v, 0)
  const totalB = Object.values(bgB).reduce((s, v) => s + v, 0)
  return (2 * intersection) / (totalA + totalB)
}

// ── Análisis de documento (con Tool Use) ─────────────────────────────────────

export async function analyzeDocument(params: {
  filePath:     string
  operation:    AIOperation
  extraContext?: string    // contexto adicional (ej: nombre del proveedor ya conocido)
  pages?:       number[]  // para PDF: qué páginas extraer antes de mandar a Claude (1-indexed)
}): Promise<AIAnalysisResult> {
  const { filePath, operation, extraContext = '', pages } = params
  const config = getAIConfig()
  const model = config.models[operation] as ClaudeModelId

  const fileBlocks = await fileToContentBlocks(filePath, { pages })

  // Prompts + herramientas según operación
  let systemPrompt: string
  let userPrompt:   string
  let tools:        Anthropic.Tool[]
  let toolName:     string

  if (operation === 'extract_bl') {
    systemPrompt = `Sos un experto en comercio exterior y logística internacional.
Analizá este documento que es un Bill of Lading (BL, FBL, HBL o MBL), puede ser multimodal o marítimo.
El documento puede ser escaneado (imagen) o digital.

════════════════════════════════════════════════════════════════
REGLA 1 — NÚMERO DE BL
════════════════════════════════════════════════════════════════
En documentos DSLV/FBL: aparece en el encabezado como "FBL XXXXXX-XXXX-XXXX DE".
Ej: "FBL 60-2604-0248 DE" → bl_number = "60-2604-0248"
También puede ser "B/L No.", "BL:", "HBL:", "MBL:" seguido del número.

════════════════════════════════════════════════════════════════
REGLA 2 — FORMATO NUMÉRICO (detectar automáticamente)
════════════════════════════════════════════════════════════════
El peso y volumen pueden venir en dos formatos:
  Argentino: "1.960,000 KGS" → peso_bruto_kg = 1960.0  (punto=miles, coma=decimal)
  Inglés:    "1,960.000 KGS" → peso_bruto_kg = 1960.0  (coma=miles, punto=decimal)

Para CBM/volumen:
  "16,176 CBM" → volumen_m3 = 16.176  (CBM = cubic meters = m³)
  "16.176 CBM" → volumen_m3 = 16.176
  Detectar cuál formato usa el documento.

════════════════════════════════════════════════════════════════
REGLA 3 — DATOS DE CARGA
════════════════════════════════════════════════════════════════
"Number and kind of packages": buscar cantidad de pallets.
  Ej: "9 PALLETS" → cant_pallets = 9
"Gross weight": el peso bruto de la mercadería.
"Measurement": el volumen en CBM (= m³).

════════════════════════════════════════════════════════════════
REGLA 4 — CONTENEDOR
════════════════════════════════════════════════════════════════
Buscar "CONTAINER No.:", "CNT:", o código alfanumérico 4L+7D.
  "BMOU 517 732-5" → limpiar espacios y guiones → "BMOU5177325"
  "BMOU5177325" → ya está limpio

REGLA 5 — null para cualquier campo no claramente visible.`

    userPrompt = extraContext
      ? `Analizá este BL - Bill of Lading. Contexto: ${extraContext}`
      : 'Extraé todos los datos de este Bill of Lading: número de BL, buque, puertos, peso, volumen, pallets y contenedor.'
    tools    = [TOOL_BL]
    toolName = 'extraer_bl'

  } else if (operation === 'extract_despacho') {
    systemPrompt = `Sos un experto en comercio exterior argentino con dominio profundo del sistema
aduanero SIM/MARIA y el formulario OM-1993 de despachos de importación.
Este documento puede ser escaneado (imagen) o digital. Leé con máxima atención.

════════════════════════════════════════════════════════════════
REGLA 1 — FORMATO NUMÉRICO ARGENTINO (aplica a TODOS los números)
════════════════════════════════════════════════════════════════
El formato argentino usa PUNTO para miles y COMA para decimales.
  "44.720,00"    → 44720.0     (no 44.72)
  "1.412,500000" → 1412.5      (no 1.4125)
  "1.960,000"    → 1960.0
  "9.759,18"     → 9759.18
Siempre convertir al formato internacional (punto decimal) antes de devolver.

════════════════════════════════════════════════════════════════
REGLA 2 — AÑO DE OFICIALIZACIÓN (error frecuente en escaneos)
════════════════════════════════════════════════════════════════
El año aparece en múltiples lugares del formulario y SIEMPRE debe ser consistente.
Fuentes para validar el año:
  a) Número de despacho: los dos primeros dígitos = año. "26 001 IC04..." → año 2026.
  b) Campo "Año" en el encabezado superior.
  c) Sello "OFICIALIZADO DD/MM/AAAA" al pie de página.
  d) Línea "IMPRIMECONCANAL = DD-MM-AAAA" en Información Complementaria.

REGLA CRÍTICA: Si el número de despacho empieza con "26" → el año es 2026 (no 2024, no 2016).
Si leés una fecha que NO concuerda con el número de despacho, el año está mal leído.
En documentos escaneados el "6" puede confundirse con "4" — en ese caso, usar el año del despacho.
Ejemplo: despacho "26 001 IC04 102923 M" + fecha leída "28/05/2024" → CORREGIR a 28/05/2026.

════════════════════════════════════════════════════════════════
REGLA 3 — DIVISA DEL FOB (campo crítico, confusión muy frecuente)
════════════════════════════════════════════════════════════════
En el formulario hay DOS conceptos de divisa/moneda que NO deben confundirse:

  a) "Cotiz = X.XXX,XXXXXX" en la sección "Información Complementaria"
     → Es el tipo de cambio USD/ARS del Banco Nación Argentina.
     → NO es la moneda del FOB. Siempre en USD independientemente de la divisa de la mercadería.

  b) Campo "Divisa" que aparece a la DERECHA de "FOB Total" en el encabezado.
     → ÉSTA es la moneda en que está pactada la mercadería.
     → Puede decir: "EURO", "DOL", "USD", "GBP", "CNY", etc.
     → "EURO" → devolver fob_divisa = "EUR"
     → "DOL"  → devolver fob_divisa = "USD"

REGLA CRÍTICA: Si el campo "Divisa" junto al FOB dice "EURO", el fob_divisa es "EUR".
NUNCA asumir USD porque la Cotiz esté en dólares. Son campos completamente independientes.

════════════════════════════════════════════════════════════════
REGLA 4 — OCR EN DOCUMENTOS ESCANEADOS (confusiones frecuentes)
════════════════════════════════════════════════════════════════
En documentos escaneados, los siguientes caracteres se confunden frecuentemente:
  E ↔ F   → "EDELRID" puede leerse "FOELRID" o "EELRID"
  O ↔ 0   → en nombres de empresas y códigos
  I ↔ 1   → en nombres de empresas y referencias
  6 ↔ 4   → en fechas (ver Regla 2)
  rn ↔ m  → en texto corrido
  C ↔ G   → "CO" puede leerse "GO"
  U ↔ V   → en mayúsculas

Si el campo "extraContext" incluye "Proveedor: NOMBRE DEL PROVEEDOR", usarlo para validar
el campo "vendedor". Si lo que leés se parece al nombre del proveedor dado, usar el nombre
del proveedor como referencia para corregir la lectura.

════════════════════════════════════════════════════════════════
REGLA 5 — TIPO DE CAMBIO (cotizacion_dolar)
════════════════════════════════════════════════════════════════
Está en la sección "Información Complementaria" como "Cotiz = X.XXX,XXXXXX".
Aplicar formato numérico argentino.
Ejemplo: "Cotiz = 1.412,500000" → 1412.5

════════════════════════════════════════════════════════════════
REGLA 6 — TRIBUTOS (dato más importante del documento)
════════════════════════════════════════════════════════════════
La sección LIQUIDACIÓN tiene DOS columnas:
  - "DEL ITEM" (izquierda) → importes parciales. NO usar.
  - "TOTAL" (derecha) → importes consolidados. SIEMPRE usar estos.
Los importes de tributos están en USD.
Extraer TODOS los tributos listados, incluyendo los que no tienen porcentaje.
Códigos: 010=Derechos Importación, 011=Tasa Estadística, 061=Tasa Estad Mont Max,
         415=IVA, 422=IVA Adicional, 424=Imp.Ganancias, 500=Arancel SIM, 900=Ingresos Brutos.

════════════════════════════════════════════════════════════════
REGLA 7 — PÁGINAS Y CAMPOS FALTANTES
════════════════════════════════════════════════════════════════
El documento que recibís es la(s) página(s) ${pages?.length ? pages.join(' y ') : '1'} del formulario original.
La primera hoja tiene: encabezado (FOB, TC, fechas, partes) + sección de liquidación/tributos.
Si un campo no es claramente visible: devolver null. NO inferir ni inventar.`

    const pageLabel = pages?.length === 1
      ? `Página ${pages[0]}`
      : pages?.length ? `Páginas ${pages.join(' y ')}`
      : 'Página 1'

    const contextLine = extraContext
      ? `\nContexto de la importación: ${extraContext}`
      : ''

    userPrompt = `Analizá este despacho de aduana argentino (${pageLabel}).${contextLine}

Prestá especial atención a:
- La fecha de OFICIALIZACIÓN: verificar que el año concuerde con los 2 primeros dígitos del número de despacho.
- El campo DIVISA junto al FOB Total: puede decir EURO o DOL — NO es la misma que la Cotiz.
- Los TRIBUTOS en la sección LIQUIDACIÓN: usar siempre la columna TOTAL (derecha).
${extraContext?.includes('Proveedor:') ? '- El nombre del VENDEDOR: verificar contra el proveedor del contexto.' : ''}`
    tools    = [TOOL_DESPACHO]
    toolName = 'extraer_despacho'
  } else if (operation === 'extract_proforma') {
    systemPrompt = `Sos un experto en comercio exterior internacional.
Analizá este documento que puede ser una proforma, cotización, pro-forma invoice, factura comercial o balance invoice de un proveedor extranjero.
El documento puede ser un PDF o un archivo Excel (en ese caso recibirás el contenido como "addr: valor", ej: "H302: 33456.76").

REGLAS CRÍTICAS:

1. IMPORTE TOTAL — hay tres casos diferentes según el tipo de documento:

   CASO A — "Less down payment invoice" como línea con número de factura anterior:
      Cuando aparece: "Less down payment invoice n.XXXXXXXX of DD.MM.YYYY   71.525,00"
      ESA LÍNEA es la clave. El valor (71.525,00) = el importe_total de este documento.
      Confirmar con el campo "NETTO MERCE / NET AMOUNT" al pie — debe coincidir.
      NO sumar los ítems individuales de las páginas (generan confusión).
      NO usar "IMPORTO DA PAGARE / TOTAL DUE" = puede ser 0 porque ya fue anticipado.

      EJEMPLO LA SPORTIVA:
        [ítems en páginas 1-16...]
        Less down payment invoice n.260200551 of 11.03.2026   71.525,00  ← importe_total
        NETTO MERCE:   71.525,00   ← confirma
        IMPORTO DA PAGARE:   0,00  ← ignorar

   CASO B — Factura con dos líneas de anticipo separadas (subtotal + deducción):
      Cuando hay: subtotal de ítems + línea "Less down payment" + "Balance due" diferente de 0.
      El importe_total = SUBTOTAL DE ÍTEMS ANTES de la deducción (valor total de la mercadería).

      EJEMPLO:
        Total items:              EUR 89.476,50   ← importe_total
        Less advance payment:     EUR (71.525,00)
        Balance due:              EUR 17.951,50   ← NO usar

   CASO C — Factura sin anticipos:
      Usar: "Grand Total", "Total Amount", "TOTALE DOCUMENTO", "IMPORTO DA PAGARE".
      Si tiene ítems detallados y no hay línea de total explícita, sumar la columna de importes.

   REGLA FINAL: Si hay "NETTO MERCE / NET AMOUNT" en el pie y difiere de 0, usar ese valor.

2. FORMATO NUMÉRICO INTERNACIONAL (inglés): punto=decimal, coma=miles.
   "17,951.50" → 17951.50   "89,476.50" → 89476.50   "33,456.76" → 33456.76

3. MONEDA: buscar en encabezados, columnas o notas del pie.
   "FOB NINGBO" indica USD. Buscar "$", "USD", "EUR", "CNY".
   Devolver código ISO: "USD", "EUR", "CNY", etc.

4. FECHA: puede estar como "May. 29th, 2026", "2026-05-29", "29/05/2026". Convertir a YYYY-MM-DD.

5. NÚMERO: buscar "PI NO.", "Invoice No.", "Pro-forma No.", "Reference No.", "Contract No.".

6. El documento puede llamarse: Pro-forma Invoice, Commercial Invoice, Balance Invoice,
   Quotation, Commercial Offer, Purchase Order, etc.

7. null para campos no visibles con claridad.`
    userPrompt = extraContext
      ? `Analizá esta proforma/cotización. Contexto: ${extraContext}`
      : 'Extraé el valor total y los datos principales de esta proforma o cotización.'
    tools    = [TOOL_PROFORMA]
    toolName = 'extraer_proforma'
  } else if (operation === 'extract_factura_flete') {
    systemPrompt = `Sos un experto en facturación argentina y comercio exterior internacional.
Analizá esta factura de flete o servicios logísticos emitida por un agente de carga o naviera.

════════════════════════════════════════════════════════════════
REGLA 1 — MONEDA DE LA FACTURA
════════════════════════════════════════════════════════════════
Verificar en TODOS estos lugares (distintos formatos según la empresa):
  a) "TOTAL ARS: 290,835.98"       → moneda = "ARS"  ← TODA la factura está en PESOS
  b) "TOTAL USD: 782.49"           → moneda = "USD"
  c) "TOTAL EUR: 450.00"           → moneda = "EUR"
  d) "SON: ... PESO ARGENTINO..."  → moneda = "ARS"
  e) "SON: ... US DOLLAR..."       → moneda = "USD"
  f) "SON: ... EUROS..."           → moneda = "EUR"
  g) "Moneda: USD - Dólar Estadounidense"
  h) Encabezados de columna: "Precio Unit. (USD)", "Subtotal (USD)"

Extraer solo el código ISO: "USD", "EUR", o "ARS".

════════════════════════════════════════════════════════════════
REGLA 2 — TIPO DE CAMBIO CONSIGNADO
════════════════════════════════════════════════════════════════
⚠ CASO ARS: Si moneda = "ARS", el TC que menciona la factura ("A efectos impositivos, el
  tipo de cambio... es de $1.480,0000") es solo a fines impositivos. Los importes YA ESTÁN
  en pesos. En este caso: tipo_cambio_consignado = null, importe_ars = importe_neto.

Si moneda = "USD" o "EUR", hay DOS formatos del TC:

  Formato A (punto decimal, formato internacional):
    "tipo de cambio consignado de 1420.000000 asciende a: $ YYYY"
    → tipo_cambio_consignado = 1420.0

  Formato B (FORMATO ARGENTINO: punto=miles, coma=decimal):
    "A efectos impositivos, el tipo de cambio... es de $ 1.419,0500."
    → tipo_cambio_consignado = 1419.05  (convertir "1.419,0500" → 1419.05)

════════════════════════════════════════════════════════════════
REGLA 3 — FORMATO NUMÉRICO DE LOS IMPORTES
════════════════════════════════════════════════════════════════
Estas facturas de KINGSHIP LINE usan FORMATO INGLÉS: coma=miles, punto=decimal.
  "290,835.98" → 290835.98   "222,000.00" → 222000.0   "49,056.67" → 49056.67

Para otras empresas podría ser FORMATO ARGENTINO: punto=miles, coma=decimal.
Detectar según el contexto y convertir siempre al número internacional.

════════════════════════════════════════════════════════════════
REGLA 4 — IMPORTE NETO (costo real, sin IVA recuperable)
════════════════════════════════════════════════════════════════
  - Para ARS: campo "Gravado" en el pie → ese es el importe_neto (costo real sin IVA).
    Ej: "Gravado 233,603.20" → importe_neto = 233603.20 ARS
  - Para USD/EUR exentos: buscar "TOTAL USD/EUR: X.XX" → ese es el importe_neto.
  - El IVA es recuperable (no es costo real). Las percepciones IIBB sí son costo.

════════════════════════════════════════════════════════════════
REGLA 5 — IMPORTE EN PESOS (importe_ars)
════════════════════════════════════════════════════════════════
  - Si moneda = "ARS": importe_ars = importe_neto (ya está en pesos).
  - Si moneda = "USD"/"EUR": buscar "asciende a: $ XXXXXX" o calcular importe_neto × TC.

════════════════════════════════════════════════════════════════
REGLA 6 — BL / HBL REFERENCE
════════════════════════════════════════════════════════════════
  a) "Nro. de HBL: 60-2604-0248"  → bl_referencia = "60-2604-0248"
  b) "Referencia Comercial: BL-XXXXXX" → solo el código sin "BL-"

════════════════════════════════════════════════════════════════
REGLA 7 — CONCEPTOS TÍPICOS
════════════════════════════════════════════════════════════════
Internacionales (USD/Exento): FLETE OCEANICO, GASTOS EN ORIGEN, FREIGHT, EBS, THC.
Locales (ARS/Gravado 21%): SERVICIO DE DESCONSOLIDACION, TASA A LAS CARGAS, AGP, DOCUMENT FEE.

REGLA 8 — null para cualquier campo no claramente visible.`

    userPrompt = extraContext
      ? `Analizá esta factura de flete. Contexto: ${extraContext}`
      : 'Extraé todos los datos de esta factura de flete o servicios logísticos.'
    tools    = [TOOL_FACTURA_FLETE]
    toolName = 'extraer_factura_flete'
  } else if (operation === 'extract_factura_deposito') {
    systemPrompt = `Sos un experto en logística aduanera y facturación argentina.
Analizá esta factura de depósito fiscal o terminal portuaria emitida en pesos argentinos.

════════════════════════════════════════════════════════════════
REGLA 1 — FORMATO NUMÉRICO (detectar automáticamente)
════════════════════════════════════════════════════════════════
Estas facturas pueden usar formato ARGENTINO o INGLÉS:
  Argentino: PUNTO = miles, COMA = decimal  →  "1.734.246,80" = 1734246.80
  Inglés:    COMA = miles,  PUNTO = decimal →  "1,734,246.80" = 1734246.80

Para detectar cuál usar: si ves números como "$657,76" o "$1.734.246,80" → formato ARGENTINO.
Si ves "$521,950.00" o "$1,551,550.00" → formato INGLÉS.
En cualquier caso, convertir al formato internacional (punto decimal) antes de devolver.

════════════════════════════════════════════════════════════════
REGLA 2 — LÍNEA "AMPARADA POR" (dato clave para carga física)
════════════════════════════════════════════════════════════════
Buscar la línea que comienza con "AMPARADA POR". Tiene el patrón:
  "AMPARADA POR {operacion} CON {N} BULTOS{peso} Kg.{volumen} M3. DESP.: {despacho}"

Ejemplo real:
  "AMPARADA POR 6026040248 CON 9 BULTOS1960.00 Kg.16.17 M3. DESP.: 26001IC04102923M"
  → cant_bultos_deposito = 9
  → peso_bruto_kg_deposito = 1960.0   (el número va PEGADO a "BULTOS", sin espacio)
  → volumen_m3_deposito = 16.17
  → referencia_despacho = "26001IC04102923M"

ATENCIÓN: el peso va INMEDIATAMENTE después de "BULTOS" sin espacio: "9 BULTOS1960.00"
  → "9" es la cantidad de bultos, "1960.00" es el peso. NO confundirlos.

════════════════════════════════════════════════════════════════
REGLA 3 — CONTENEDOR Y MEDIO DE TRANSPORTE
════════════════════════════════════════════════════════════════
El contenedor puede estar en la línea "Medio: NOMBRE_BUQUE CNT.: XXXX1234567"
  Ejemplo: "Medio: NAVIOS VERDE CNT.: BMOU5177325"
  → nro_contenedor = "BMOU5177325"
También puede aparecer como "CONT:" o directamente como código 4L+7D.

════════════════════════════════════════════════════════════════
REGLA 4 — FECHAS DE INGRESO Y EGRESO
════════════════════════════════════════════════════════════════
Buscar campos explícitos "Fecha Ingreso" y "Fecha Egreso" si existen.
Si NO existen como campos separados:
  - fecha_egreso = fecha de emisión de la factura (esta factura es de salida/entrega)
  - fecha_ingreso = null (no está disponible en este tipo de documento)
Convertir siempre a YYYY-MM-DD.

════════════════════════════════════════════════════════════════
REGLA 5 — IMPORTE NETO Y PERCEPCIONES
════════════════════════════════════════════════════════════════
importe_neto = "Sub-Total" o "Subtotal" ANTES del IVA y percepciones.
Percepciones IIBB separadas por jurisdicción:
  - percepcion_caba: "Perc.IIBB CBSAS" o "Percep. CABA" (Ciudad Buenos Aires)
  - percepcion_bsas: "Percep. BS AS" o "Perc.IIBB Prov" (Provincia Buenos Aires)
  - percepciones: suma de todas

════════════════════════════════════════════════════════════════
REGLA 6 — DESPACHO REFERENCIADO
════════════════════════════════════════════════════════════════
Buscar en el encabezado "Despacho: XXXXXXX" o en la línea "AMPARADA POR".
Devolver el código exactamente como aparece, sin espacios adicionales.
Ej: "26001IC04102923M"

REGLA 7 — null para cualquier campo que no esté claramente visible.`

    userPrompt = extraContext
      ? `Analizá esta factura de depósito fiscal. Contexto: ${extraContext}`
      : 'Extraé todos los datos de esta factura de depósito fiscal o logística aduanera.'
    tools    = [TOOL_FACTURA_DEPOSITO]
    toolName = 'extraer_factura_deposito'
  } else if (operation === 'extract_factura_local') {
    systemPrompt = `Sos un experto en facturación argentina y comercio exterior.
Analizá esta factura de servicios o gastos locales, que puede ser una factura de despachante de aduana.

REGLAS CRÍTICAS:
1. FORMATO NUMÉRICO ARGENTINO: punto = miles, coma = decimal.
   "1.317.665,82" → 1317665.82   "38.000,00" → 38000.0
2. IMPORTE NETO GRAVADO: buscar el campo "Importe Neto Gravado" en el PIE de la factura.
   Este es el importe SIN IVA — el costo real del servicio.
3. IMPORTE TOTAL: el campo "Importe Total" incluye el IVA.
4. REFERENCIA AL DESPACHO: buscar en los conceptos de los ítems referencias como
   "NRO XXXXXXXXXXX" o "IMPORTACION NRO". Extraer solo el código (ej: "26001IC04101630G").
5. MALVINA: es el sistema informático aduanero de AFIP, no un proveedor.
   "PREMALVINA" y "CONEXION MALVINA" son servicios de conexión a ese sistema.
6. CAE: el número de autorización electrónica está en el pie de la factura como "CAE N°".
7. NÚMERO DE FACTURA: combinar "Punto de Venta" + "Comp. Nro" con guion. Ej: "00004-00003485".
8. Si un campo no está claramente visible: devolvé null — no inventes.

════════════════════════════════════════════════════════════════
REGLA ESPECIAL — SEPARAR ÍTEMS DE FLETE LOCAL
════════════════════════════════════════════════════════════════
Si la factura del despachante incluye ítems de TRANSPORTE TERRESTRE, deben ir en
el campo flete_local_items (NO en items). Esto permite contabilizarlos como "Flete local".

Ítems que van en flete_local_items (transporte físico):
  ✓ Flete interno / Flete local / Flete
  ✓ Transporte de mercadería / Acarreo
  ✓ PEAJE / Peajes / Autopista / Ruta  ← IMPORTANTE: siempre va aquí aunque sea Exento
  ✓ Traslado / Movimiento de mercadería

Ítems que van en items (servicios del despachante):
  ✗ Honorarios de despacho
  ✗ Aranceles aduaneros / Derechos
  ✗ PREMALVINA / CONEXION MALVINA
  ✗ Sellado / Tasa estadística
  ✗ Gastos portuarios / Gastos administrativos
  ✗ Digitalización y guarda

════════════════════════════════════════════════════════════════
REGLA DE IVA — CÓMO DETERMINAR EL PORCENTAJE
════════════════════════════════════════════════════════════════
En facturas de despachante argentinas, el IVA de cada ítem se muestra en la columna
"IVA %". Si un ítem NO tiene porcentaje en esa columna, es EXENTO (iva_porcentaje = 0).

Esto es muy común con PEAJE:
  "P 1 PEAJE    [sin IVA%]    8.817,00" → iva_porcentaje = 0, importe_neto = 8.817,00
  El ítem exento aparece en "Subtotal Exento" al pie de la factura.

Regla para determinar iva_porcentaje:
  - Columna IVA% muestra "21,00" → iva_porcentaje = 21
  - Columna IVA% muestra "10,50" → iva_porcentaje = 10.5
  - Columna IVA% vacía/sin valor  → iva_porcentaje = 0 (EXENTO)

El importe_neto es siempre el valor del ítem en la columna "Importe" (ya sea gravado o exento).
Para ítems GRAVADOS: ese importe es el neto sin IVA.
Para ítems EXENTOS: ese importe ya es el total (no tiene IVA que descontar).
El IVA es recuperable = no es costo real para NAKA.`
    userPrompt = extraContext
      ? `Analizá esta factura. Contexto adicional: ${extraContext}`
      : 'Extraé todos los datos de esta factura argentina, prestando atención especial al Importe Neto Gravado y al detalle de ítems.'
    tools    = [TOOL_FACTURA_LOCAL]
    toolName = 'extraer_factura_local'
  } else if (operation === 'extract_factura') {
    systemPrompt = `Sos un experto en comercio internacional. Extraé los datos de esta factura
comercial con precisión. Si un campo no aparece claramente, devolvé null.`
    userPrompt = extraContext
      ? `Analizá esta factura comercial. Contexto: ${extraContext}`
      : 'Analizá esta factura comercial y extraé todos los datos disponibles.'
    tools   = [TOOL_FACTURA]
    toolName = 'extraer_factura'
  } else {
    // extract_general → respuesta en texto libre
    systemPrompt = `Sos un asistente experto en documentos de comercio exterior argentino.
Analizá el documento y respondé de forma clara y estructurada en español.`
    userPrompt = extraContext || 'Analizá este documento, identificá su tipo y resumí la información más relevante.'
    tools   = []
    toolName = ''
  }

  // ── Aplicar override de prompt desde DB (editor en Ajustes → IA → Prompts) ──
  const dbOverride = getPromptOverride(operation as AIOperation)
  if (dbOverride) {
    const pagesLabel = pages?.length ? pages.join(' y ') : '1'
    systemPrompt = dbOverride.system_prompt.replace(/{PAGES}/g, pagesLabel)
  }

  const client = getClient()

  if (tools.length > 0) {
    // Tool Use — respuesta estructurada
    const resp = await client.messages.create({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      tool_choice: { type: 'any' },
      messages: [{
        role: 'user',
        content: [
          ...fileBlocks,
          { type: 'text', text: userPrompt }
        ]
      }]
    })

    const toolUse = resp.content.find(b => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined
    const structured = toolUse?.input ?? {}
    const tokens = resp.usage.input_tokens + resp.usage.output_tokens

    return {
      operation,
      model,
      content: JSON.stringify(structured, null, 2),
      structured,
      tokens_used: tokens
    }
  } else {
    // Texto libre
    const resp = await client.messages.create({
      model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: [
          ...fileBlocks,
          { type: 'text', text: userPrompt }
        ]
      }]
    })

    const content = resp.content
      .filter(b => b.type === 'text')
      .map(b => (b as Anthropic.TextBlock).text)
      .join('\n')

    return {
      operation,
      model,
      content,
      structured: null,
      tokens_used: resp.usage.input_tokens + resp.usage.output_tokens
    }
  }
}

// ── Chat sobre datos del sistema (dashboard) ──────────────────────────────────

export async function dashboardChat(params: {
  contextData: unknown   // datos serializados del sistema
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
}): Promise<{ content: string; tokens_used: number }> {
  const config = getAIConfig()
  const model  = config.models['dashboard_chat']
  const client = getClient()

  const systemPrompt = `Sos el asistente de comercio exterior de una empresa argentina importadora.
Tenés acceso a los datos del sistema FlowTask (importaciones, costos, pagos, proveedores, operadores).

DATOS DEL SISTEMA:
${JSON.stringify(params.contextData, null, 2).slice(0, 80_000)}

Respondé en español de forma clara y concisa.
Cuando cites números, aclará la moneda. Usá listas o tablas cuando mejore la legibilidad.
Si no tenés suficiente información para responder, decilo claramente.`

  const resp = await client.messages.create({
    model,
    max_tokens: 2048,
    system: systemPrompt,
    messages: params.messages
  })

  const content = resp.content
    .filter(b => b.type === 'text')
    .map(b => (b as Anthropic.TextBlock).text)
    .join('\n')

  return {
    content,
    tokens_used: resp.usage.input_tokens + resp.usage.output_tokens
  }
}
