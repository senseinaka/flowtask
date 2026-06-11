// ═══════════════════════════════════════════════════════════════════════════
// Comex — Exportación de una importación a Excel y PDF
// ═══════════════════════════════════════════════════════════════════════════
//
// Servicio "de I/O puro": recibe los datos ya consultados de una importación
// (cabecera + items + documentos + cotizaciones + aduana + costos) y los
// formatea/escribe como planilla Excel o documento PDF.

import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTableImport from 'jspdf-autotable'

const autoTable = (autoTableImport as unknown as { default?: typeof autoTableImport }).default ?? autoTableImport
import dayjs from 'dayjs'
import fs from 'fs'
import {
  IMPORT_STATUS_LABELS, DOCUMENT_STATUS_LABELS, DOCUMENT_TYPE_LABELS, QUOTE_STATUS_LABELS
} from '@shared/types'
import type {
  ComexImport, ComexImportItem, ComexDocument, ComexLogisticsQuote, ComexCustoms, ComexCostItem
} from '@shared/types'

export interface ComexImportFullDetail {
  import: ComexImport
  items: ComexImportItem[]
  documents: ComexDocument[]
  quotes: ComexLogisticsQuote[]
  customs: ComexCustoms | null
  costs: ComexCostItem[]
}

function fmtDate(ts: number | null): string {
  return ts ? dayjs(ts).format('DD/MM/YYYY') : ''
}

/** "NatureHike #50 - Despacho: 24001IC03000123A" (o sin sufijo si no hay número de despacho) */
export function buildImportExportTitle(detail: ComexImportFullDetail): string {
  const despacho = detail.customs?.despacho_number || detail.import._despacho_number
  return despacho ? `${detail.import.title} - Despacho: ${despacho}` : detail.import.title
}

/** Reemplaza caracteres no válidos en nombres de archivo de Windows/macOS/Linux por '-' */
export function sanitizeFileName(name: string): string {
  return name.replace(/:/g, '').replace(/[\\/*?"<>|]/g, '-').replace(/\s+/g, ' ').trim()
}

// ── Excel ──────────────────────────────────────────────────────────────────

export function writeImportExcel(filePath: string, detail: ComexImportFullDetail): void {
  const { import: imp, items, documents, quotes, customs, costs } = detail
  const wb = XLSX.utils.book_new()

  const summaryRows = [
    { Campo: 'Título',            Valor: buildImportExportTitle(detail) },
    { Campo: 'Proveedor',         Valor: imp.supplier?.name ?? '' },
    { Campo: 'Estado',            Valor: IMPORT_STATUS_LABELS[imp.status] },
    { Campo: 'Incoterm',          Valor: imp.incoterm },
    { Campo: 'País de origen',    Valor: imp.origin_country },
    { Campo: 'Puerto de origen',  Valor: imp.origin_port },
    { Campo: 'Moneda',            Valor: imp.currency },
    { Campo: 'Valor estimado',    Valor: imp.estimated_value ?? '' },
    { Campo: 'Valor real',        Valor: imp.actual_value ?? '' },
    { Campo: 'Fecha pedido',      Valor: fmtDate(imp.order_date) },
    { Campo: 'Fecha pago',        Valor: fmtDate(imp.payment_date) },
    { Campo: 'Fecha embarque',    Valor: fmtDate(imp.ship_date) },
    { Campo: 'ETA',               Valor: fmtDate(imp.arrival_date) },
    { Campo: 'Tracking',          Valor: imp.tracking_number },
    { Campo: 'Agente de aduana',  Valor: imp.customs_agent },
    { Campo: 'Notas',             Valor: imp.notes }
  ]
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows)
  wsSummary['!cols'] = [{ wch: 20 }, { wch: 50 }]
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen')

  if (items.length) {
    const wsItems = XLSX.utils.json_to_sheet(items.map(i => ({
      'Descripción':    i.description,
      'HS Code':        i.hs_code,
      'Cantidad':       i.quantity,
      'Unidad':         i.unit,
      'Precio unitario': i.unit_price,
      'Moneda':         i.currency
    })))
    wsItems['!cols'] = [{ wch: 40 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 8 }]
    XLSX.utils.book_append_sheet(wb, wsItems, 'Items')
  }

  if (documents.length) {
    const wsDocs = XLSX.utils.json_to_sheet(documents.map(d => ({
      'Tipo':     DOCUMENT_TYPE_LABELS[d.type],
      'Nombre':   d.name,
      'Estado':   DOCUMENT_STATUS_LABELS[d.status],
      'Recibido': fmtDate(d.received_at),
      'Notas':    d.notes
    })))
    wsDocs['!cols'] = [{ wch: 22 }, { wch: 30 }, { wch: 14 }, { wch: 12 }, { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, wsDocs, 'Documentos')
  }

  if (quotes.length) {
    const wsQuotes = XLSX.utils.json_to_sheet(quotes.map(q => ({
      'Operador':   q.operator_name,
      'Contacto':   q.contact,
      'Tipo carga': q.cargo_type,
      'Monto':      q.quote_amount ?? '',
      'Moneda':     q.currency,
      'Servicios':  q.services_included,
      'Válido hasta': fmtDate(q.valid_until),
      'Estado':     QUOTE_STATUS_LABELS[q.status],
      'Notas':      q.notes
    })))
    wsQuotes['!cols'] = [
      { wch: 22 }, { wch: 22 }, { wch: 10 }, { wch: 12 }, { wch: 8 },
      { wch: 30 }, { wch: 14 }, { wch: 12 }, { wch: 30 }
    ]
    XLSX.utils.book_append_sheet(wb, wsQuotes, 'Logística')
  }

  if (customs) {
    const wsCustoms = XLSX.utils.json_to_sheet([
      { Campo: 'Número de despacho',   Valor: customs.despacho_number },
      { Campo: 'Despachante',          Valor: customs.despachante },
      { Campo: 'Canal',                Valor: customs.canal ?? '' },
      { Campo: 'BL',                   Valor: customs.bl_number },
      { Campo: 'Naviera (referencia)', Valor: customs.naviera_ref },
      { Campo: 'Carrier',              Valor: customs.carrier },
      { Campo: 'Moneda FOB',           Valor: customs.fob_currency },
      { Campo: 'FOB factura',          Valor: customs.fob_invoice ?? '' },
      { Campo: 'FOB declarado',        Valor: customs.fob_declared ?? '' },
      { Campo: 'Dólar aduana',         Valor: customs.dolar_aduana ?? '' },
      { Campo: 'Dólar naviera',        Valor: customs.dolar_naviera ?? '' },
      { Campo: 'Paridad USD/EUR',      Valor: customs.paridad_usd_eur ?? '' },
      { Campo: 'Fecha oficialización', Valor: fmtDate(customs.oficializacion_date) },
      { Campo: 'Vencimiento SEPAIMPO', Valor: fmtDate(customs.sepaimpo_vencimiento) }
    ])
    wsCustoms['!cols'] = [{ wch: 22 }, { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, wsCustoms, 'Aduana')
  }

  if (costs.length) {
    const wsCosts = XLSX.utils.json_to_sheet(costs.map(c => ({
      'Categoría': c.category,
      'Concepto':  c.concept,
      'Monto ($)': c.amount_pesos,
      'Monto (USD)': c.amount_usd ?? ''
    })))
    wsCosts['!cols'] = [{ wch: 18 }, { wch: 30 }, { wch: 14 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, wsCosts, 'Costos')
  }

  XLSX.writeFile(wb, filePath, { bookType: 'xlsx' })
}

// ── PDF ────────────────────────────────────────────────────────────────────

export function writeImportPdf(filePath: string, detail: ComexImportFullDetail): void {
  const { import: imp, items, documents, quotes, customs, costs } = detail
  const doc = new jsPDF()

  doc.setFontSize(16)
  doc.text(buildImportExportTitle(detail), 14, 18)

  let cursorY = 26

  autoTable(doc, {
    startY: cursorY,
    head: [['Resumen', '']],
    body: [
      ['Proveedor', imp.supplier?.name ?? ''],
      ['Estado', IMPORT_STATUS_LABELS[imp.status]],
      ['Incoterm', imp.incoterm],
      ['Origen', `${imp.origin_country}${imp.origin_port ? ' — ' + imp.origin_port : ''}`],
      ['Moneda', imp.currency],
      ['Valor estimado', imp.estimated_value != null ? String(imp.estimated_value) : ''],
      ['Valor real', imp.actual_value != null ? String(imp.actual_value) : ''],
      ['Fecha pedido', fmtDate(imp.order_date)],
      ['Fecha pago', fmtDate(imp.payment_date)],
      ['Fecha embarque', fmtDate(imp.ship_date)],
      ['ETA', fmtDate(imp.arrival_date)],
      ['Tracking', imp.tracking_number],
      ['Agente de aduana', imp.customs_agent]
    ],
    theme: 'grid',
    headStyles: { fillColor: [51, 65, 85] }
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cursorY = (doc as any).lastAutoTable.finalY + 10

  if (items.length) {
    autoTable(doc, {
      startY: cursorY,
      head: [['Descripción', 'HS Code', 'Cant.', 'Unidad', 'Precio unit.', 'Moneda']],
      body: items.map(i => [i.description, i.hs_code, String(i.quantity), i.unit, String(i.unit_price), i.currency]),
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85] }
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cursorY = (doc as any).lastAutoTable.finalY + 10
  }

  if (documents.length) {
    autoTable(doc, {
      startY: cursorY,
      head: [['Documentos', 'Estado', 'Recibido', 'Notas']],
      body: documents.map(d => [`${DOCUMENT_TYPE_LABELS[d.type]} — ${d.name}`, DOCUMENT_STATUS_LABELS[d.status], fmtDate(d.received_at), d.notes]),
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85] }
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cursorY = (doc as any).lastAutoTable.finalY + 10
  }

  if (quotes.length) {
    autoTable(doc, {
      startY: cursorY,
      head: [['Operador', 'Tipo carga', 'Monto', 'Estado', 'Válido hasta']],
      body: quotes.map(q => [q.operator_name, q.cargo_type, q.quote_amount != null ? `${q.quote_amount} ${q.currency}` : '', QUOTE_STATUS_LABELS[q.status], fmtDate(q.valid_until)]),
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85] }
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cursorY = (doc as any).lastAutoTable.finalY + 10
  }

  if (customs) {
    autoTable(doc, {
      startY: cursorY,
      head: [['Aduana', '']],
      body: [
        ['Número de despacho', customs.despacho_number],
        ['Despachante', customs.despachante],
        ['Canal', customs.canal ?? ''],
        ['BL', customs.bl_number],
        ['Carrier', customs.carrier],
        ['FOB factura', customs.fob_invoice != null ? `${customs.fob_invoice} ${customs.fob_currency}` : ''],
        ['FOB declarado', customs.fob_declared != null ? `${customs.fob_declared} ${customs.fob_currency}` : ''],
        ['Dólar aduana', customs.dolar_aduana != null ? String(customs.dolar_aduana) : ''],
        ['Fecha oficialización', fmtDate(customs.oficializacion_date)]
      ],
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85] }
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cursorY = (doc as any).lastAutoTable.finalY + 10
  }

  if (costs.length) {
    autoTable(doc, {
      startY: cursorY,
      head: [['Costos', 'Concepto', 'Monto ($)', 'Monto (USD)']],
      body: costs.map(c => [c.category, c.concept, String(c.amount_pesos), c.amount_usd != null ? String(c.amount_usd) : '']),
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85] }
    })
  }

  const buffer = Buffer.from(doc.output('arraybuffer'))
  fs.writeFileSync(filePath, buffer)
}
