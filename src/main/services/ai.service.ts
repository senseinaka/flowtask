import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import * as XLSX from 'xlsx'
import ConfigStore from './config-store'
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

// ── Preparar contenido del mensaje según tipo de archivo ─────────────────────

type ContentBlock = Anthropic.MessageParam['content'][number]

function fileToContentBlocks(filePath: string): ContentBlock[] {
  const ext = path.extname(filePath).toLowerCase()

  // ── PDF → bloque document nativo de Claude (maneja texto Y escaneados) ─
  if (ext === '.pdf') {
    const data = fs.readFileSync(filePath).toString('base64')
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

  // ── XLSX / XLS / ODS → CSV por hoja ────────────────────────────────────
  if (['.xlsx', '.xls', '.ods'].includes(ext)) {
    const wb = XLSX.readFile(filePath)
    const text = wb.SheetNames.map(name => {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name])
      return `=== Hoja: ${name} ===\n${csv}`
    }).join('\n\n')
    return [{ type: 'text', text: text.slice(0, 150_000) }]
  }

  // ── CSV / TXT / JSON → texto plano ────────────────────────────────────
  const text = fs.readFileSync(filePath, 'utf-8').slice(0, 150_000)
  return [{ type: 'text', text }]
}

// ── Schemas Tool Use ──────────────────────────────────────────────────────────

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
        description: 'Lista completa de todos los ítems / conceptos facturados con sus importes netos (sin IVA).',
        items: {
          type: 'object' as const,
          properties: {
            concepto: { type: 'string', description: 'Descripción del ítem tal como figura en la factura.' },
            importe:  { type: 'number', description: 'Importe neto del ítem (columna "Subtotal" o "Precio Unit."). Formato argentino → número internacional.' }
          },
          required: ['concepto', 'importe']
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
        description: 'Número de contenedor (formato: 4 letras + 7 dígitos, ej: "MSDU8859271"). null si no encontrado.'
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

// ── Análisis de documento (con Tool Use) ─────────────────────────────────────

export async function analyzeDocument(params: {
  filePath:  string
  operation: AIOperation
  extraContext?: string  // contexto adicional (ej: nombre del proveedor ya conocido)
}): Promise<AIAnalysisResult> {
  const { filePath, operation, extraContext = '' } = params
  const config = getAIConfig()
  const model = config.models[operation] as ClaudeModelId

  const fileBlocks = fileToContentBlocks(filePath)

  // Prompts + herramientas según operación
  let systemPrompt: string
  let userPrompt:   string
  let tools:        Anthropic.Tool[]
  let toolName:     string

  if (operation === 'extract_despacho') {
    systemPrompt = `Sos un experto en comercio exterior argentino con dominio del sistema
aduanero SIM/MARIA y el formulario OM-1993 de despachos de importación.

REGLAS CRÍTICAS — leer antes de procesar:

1. FORMATO NUMÉRICO ARGENTINO: en todos los campos numéricos del despacho:
   - El PUNTO separa miles: 31.689 = treinta y un mil seiscientos ochenta y nueve
   - La COMA separa decimales: 31.689,36 = 31689.36
   - Siempre convertí al formato internacional (punto decimal) antes de devolver.
   - Ejemplo: "1.411,000000" → devolver 1411.0

2. TIPO DE CAMBIO (cotizacion_dolar): NO está en el encabezado principal.
   Está en la sección "Información Complementaria" escrito como "Cotiz = X.XXX,XXXXXX".
   Aplicar la regla de formato numérico argentino.

3. TRIBUTOS — dato más importante del documento:
   - La sección LIQUIDACIÓN tiene DOS columnas: "DEL ITEM" (izquierda) y "TOTAL" (derecha).
   - Siempre usar los valores de la columna TOTAL (lado derecho).
   - Los importes de tributos están en USD.
   - Extraer TODOS los tributos listados, incluyendo los que no tienen porcentaje.
   - Códigos comunes: 010=Derechos Importación, 011=Tasa Estadística,
     061=Tasa Estad Mont Max, 415=IVA, 422=IVA Adicional, 424=Imp.Ganancias,
     500=Arancel SIM, 900=Ingresos Brutos.

4. SOLO HOJA 1: el documento puede tener muchas hojas. Procesar únicamente
   los datos visibles en la primera hoja (encabezado + liquidación).

5. Si un campo no es claramente visible: devolver null. No inferir ni inventar.`

    userPrompt = extraContext
      ? `Analizá esta Hoja 1 del despacho de aduana. Contexto: ${extraContext}`
      : 'Analizá esta Hoja 1 del despacho de aduana. Prestá especial atención a la sección LIQUIDACIÓN / TRIBUTOS.'
    tools    = [TOOL_DESPACHO]
    toolName = 'extraer_despacho'
  } else if (operation === 'extract_factura_flete') {
    systemPrompt = `Sos un experto en facturación argentina y comercio exterior internacional.
Analizá esta factura de flete o servicios logísticos emitida por un agente de carga o naviera.

REGLAS CRÍTICAS — leer antes de procesar:

1. MONEDA — verificar en TODOS estos lugares:
   a) Línea al final: "Moneda: USD - Dólar Estadounidense" o "Moneda: EUR - Euro"
   b) Encabezados de columna: "Precio Unit. (USD)", "Subtotal (USD)", "Subtotal c/IVA (USD)"
   c) Etiquetas del pie: "Importe Neto Gravado: USD", "Importe Total: USD"
   Extraer solo el código ISO: "USD", "EUR", o "ARS". NUNCA asumir ARS por defecto.

2. IMPORTES — usar el formato de la moneda detectada:
   Todos los importes usan FORMATO ARGENTINO: punto=miles, coma=decimal.
   "126,68" → 126.68   "4.000,00" → 4000.0   "518,52" → 518.52
   Los importes son en la MONEDA DETECTADA (USD o EUR), NO en pesos.

3. TIPO DE CAMBIO CONSIGNADO — en la línea de pie:
   "tipo de cambio consignado de XXXX.XXXXXX asciende a: $ YYYY"
   El TC ya usa PUNTO como decimal (formato internacional). "1420.000000" → 1420.0
   CRÍTICO: si la factura dice 1420, el campo tipo_cambio_consignado = 1420.0

4. BL REFERENCE — en "Referencia Comercial: BL-XXXXXX". Solo el código sin "BL-".

5. CONCEPTOS TÍPICOS — no confundir con ARS:
   FREIGHT, GASTOS ORIGEN, EBS (Emergency Bunker Surcharge), DESCONSOL,
   AGP (Argentina Gateway Port), DOCUMENT FEE, THC.

6. IVA — el flete internacional suele tener IVA 0% (exento) o 21% en servicios locales.

7. IMPORTE NETO — campo "Importe Neto Gravado" en la moneda de la factura (USD/EUR).

8. null para cualquier campo que no esté claramente visible.`

    userPrompt = extraContext
      ? `Analizá esta factura de flete. Contexto: ${extraContext}`
      : 'Extraé todos los datos de esta factura de flete o servicios logísticos.'
    tools    = [TOOL_FACTURA_FLETE]
    toolName = 'extraer_factura_flete'
  } else if (operation === 'extract_factura_deposito') {
    systemPrompt = `Sos un experto en logística aduanera y facturación argentina.
Analizá esta factura de depósito fiscal emitida en pesos argentinos.

REGLAS CRÍTICAS — leer antes de procesar:

1. ⚠️ FORMATO NUMÉRICO INGLÉS: esta factura usa formato INGLÉS (diferente al argentino):
   - La COMA separa MILES: "1,551,550.00" = un millón quinientos cincuenta y un mil quinientos cincuenta
   - El PUNTO separa DECIMALES: "521,950.00" = 521950.0
   Convertir al formato internacional sin comas: "98,670.00" → 98670.0

2. MONEDA: esta factura es en Pesos Argentinos (ARS). El tipo de cambio que aparece
   ("US$ 1 = AR$ XXXX") es solo referencia BNA, NO es tipo de cambio consignado.
   devolver moneda = "ARS".

3. IMPORTE NETO: buscar "Subtotal" en el pie de la factura (sin IVA ni percepciones).
   Ej: "Subtotal: 1,551,550.00" → 1551550.0

4. PERCEPCIONES IIBB — extraer SEPARADAS por jurisdicción:
   - percepcion_caba: el importe de "Percep. CABA" o "Percepción CABA"
   - percepcion_bsas: el importe de "Percep. BS AS" o "Percepción Bs As"
   - percepciones: la suma de todas las percepciones (caba + bsas + otras si las hubiera)

5. NRO. DESPACHO: buscar "Nro. Despacho:" en la factura. Devolver el código completo.
   Ej: "2026-001-IC04-101630G"

6. NRO. CONTENEDOR: código alfanumérico de 4 letras + 7 dígitos. Ej: "MSDU8859271"

7. FECHAS: Fecha Ingreso y Fecha Egreso al/del depósito. Convertir a YYYY-MM-DD.

8. CONCEPTOS TÍPICOS de depósito fiscal: CARGOS ADMINISTRATIVOS, ENTREGA DE MERCADERIAS,
   RECUPERO GASTOS PORTUARIOS, RECUPERO GESTION OPERATIVA PORTUARIA,
   TRANSPORTE Y CUSTODIA DGA, VERIFICACION DE MERCADERIAS.

9. null para cualquier campo que no esté claramente visible.`

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
8. Si un campo no está claramente visible: devolvé null — no inventes.`
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
