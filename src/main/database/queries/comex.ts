import { randomUUID } from 'crypto'
import { getPowerSyncDb } from '../powersync'
import type {
  ComexSupplier, ComexImport, ComexImportItem, ComexDocument,
  ComexLogisticsQuote, ComexQuoteFile, ComexPayment, ComexCustoms, ComexCostItem,
  ComexSupplierContact, ComexSupplierBankAccount, ComexFreightOperator,
  ComexFreightOperatorContact, ComexImportTributo, CreateComexImportTributoInput,
  ComexImportExtraCost, CreateComexImportExtraCostInput,
  ComexProforma, CreateComexProformaInput,
  ComexInalCert,
  CreateComexSupplierInput, CreateComexImportInput,
  CreateComexItemInput, CreateComexDocumentInput,
  CreateComexQuoteInput, CreateComexPaymentInput,
  UpsertComexCustomsInput, CreateComexCostInput,
  CreateComexSupplierContactInput, CreateComexSupplierBankAccountInput,
  CreateComexFreightOperatorInput, CreateComexFreightOperatorContactInput
} from '@shared/types'

const WORKSPACE_ID = 'd61a4071-1557-4f32-be5e-6443fb336bf5'

// ─── Suppliers ────────────────────────────────────────────────────────────────

export async function listSuppliers(): Promise<ComexSupplier[]> {
  return getPowerSyncDb().getAll<ComexSupplier>('SELECT * FROM comex_suppliers ORDER BY name ASC')
}

export async function getSupplier(id: string): Promise<ComexSupplier | null> {
  return (await getPowerSyncDb().getOptional<ComexSupplier>('SELECT * FROM comex_suppliers WHERE id = ?', [id])) ?? null
}

export async function createSupplier(input: CreateComexSupplierInput): Promise<ComexSupplier> {
  const db = getPowerSyncDb()
  const id = randomUUID()
  const now = Date.now()
  await db.execute(`
    INSERT INTO comex_suppliers
      (id, name, address, city, country, zip_code, tax_id, rex_number,
       contact_name, contact_email, contact_phone,
       brand, website, wechat, product_categories, payment_terms,
       incoterms_preferred, port_of_origin, lead_time_days,
       production_days, preparation_days, transit_days, customs_days, local_delivery_days,
       moq, non_operational_periods_json, reliability_notes,
       pickup_address, notes, created_at, updated_at, workspace_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    input.name,
    (input as Partial<ComexSupplier>).address ?? '',
    (input as Partial<ComexSupplier>).city ?? '',
    input.country ?? '',
    (input as Partial<ComexSupplier>).zip_code ?? '',
    (input as Partial<ComexSupplier>).tax_id ?? '',
    (input as Partial<ComexSupplier>).rex_number ?? '',
    input.contact_name ?? '',
    input.contact_email ?? '',
    input.contact_phone ?? '',
    (input as Partial<ComexSupplier>).brand ?? '',
    input.website ?? '',
    (input as Partial<ComexSupplier>).wechat ?? '',
    (input as Partial<ComexSupplier>).product_categories ?? '',
    input.payment_terms ?? '',
    (input as Partial<ComexSupplier>).incoterms_preferred ?? '',
    (input as Partial<ComexSupplier>).port_of_origin ?? '',
    (input as Partial<ComexSupplier>).lead_time_days ?? null,
    (input as Partial<ComexSupplier>).production_days ?? null,
    (input as Partial<ComexSupplier>).preparation_days ?? null,
    (input as Partial<ComexSupplier>).transit_days ?? null,
    (input as Partial<ComexSupplier>).customs_days ?? null,
    (input as Partial<ComexSupplier>).local_delivery_days ?? null,
    (input as Partial<ComexSupplier>).moq ?? null,
    (input as Partial<ComexSupplier>).non_operational_periods_json ?? '[]',
    (input as Partial<ComexSupplier>).reliability_notes ?? '',
    (input as Partial<ComexSupplier>).pickup_address ?? '',
    input.notes ?? '',
    now, now, WORKSPACE_ID
  ])
  return (await db.getOptional<ComexSupplier>('SELECT * FROM comex_suppliers WHERE id = ?', [id]))!
}

export async function updateSupplier(id: string, data: Partial<ComexSupplier>): Promise<ComexSupplier | null> {
  const db = getPowerSyncDb()
  const allowed = [
    'name','address','city','country','zip_code','tax_id','rex_number',
    'contact_name','contact_email','contact_phone',
    'brand','website','wechat','product_categories','payment_terms',
    'incoterms_preferred','port_of_origin','lead_time_days',
    'production_days','preparation_days','transit_days','customs_days','local_delivery_days',
    'moq','non_operational_periods_json','reliability_notes',
    'pickup_address','notes','logo_stored_name','logo_data'
  ]
  const sets = ['updated_at = ?']
  const vals: unknown[] = [Date.now()]
  for (const key of allowed) {
    if (key in data) { sets.push(`${key} = ?`); vals.push((data as Record<string, unknown>)[key]) }
  }
  vals.push(id)
  await db.execute(`UPDATE comex_suppliers SET ${sets.join(', ')} WHERE id = ?`, vals)
  return (await db.getOptional<ComexSupplier>('SELECT * FROM comex_suppliers WHERE id = ?', [id])) ?? null
}

export async function deleteSupplier(id: string): Promise<void> {
  await getPowerSyncDb().execute('DELETE FROM comex_suppliers WHERE id = ?', [id])
}

// ─── Imports ──────────────────────────────────────────────────────────────────

function hydrateImport(row: Record<string, unknown>): ComexImport {
  const imp = row as unknown as ComexImport
  if (row._supplier_id) {
    imp.supplier = {
      id: row._supplier_id as string,
      name: row._supplier_name as string,
      country: row._supplier_country as string,
      contact_name: row._supplier_contact_name as string,
      contact_email: row._supplier_contact_email as string,
      contact_phone: row._supplier_contact_phone as string,
      website: row._supplier_website as string,
      payment_terms: row._supplier_payment_terms as string,
      brand: (row._supplier_brand as string) ?? '',
      incoterms_preferred: (row._supplier_incoterms_preferred as string) ?? '',
      port_of_origin: (row._supplier_port_of_origin as string) ?? '',
      notes: row._supplier_notes as string,
      created_at: row._supplier_created_at as number,
      updated_at: row._supplier_updated_at as number,
      // Campos no presentes en el JOIN inline — se llenan con defaults
      address: '', city: '', zip_code: '', tax_id: '', rex_number: '',
      wechat: '', product_categories: '', lead_time_days: null,
      pickup_address: '', reliability_notes: '', non_operational_periods_json: '[]',
      production_days: null, preparation_days: null, transit_days: null,
      customs_days: null, local_delivery_days: null, moq: null,
      logo_stored_name: (row._supplier_logo as string) ?? null,
      logo_data: (row._supplier_logo_data as string) ?? null,
      category: '', demand_annual: null, demand_monthly_json: '{}',
      current_stock: null, safety_stock: null, purchase_frequency_days: null
    }
  }
  // Campos del JOIN con customs
  if (row._despacho_number)     imp._despacho_number     = row._despacho_number     as string
  if (row._canal_despacho)      imp._canal_despacho      = row._canal_despacho      as string
  if (row._peso_bruto_kg != null)  imp._peso_bruto_kg    = row._peso_bruto_kg       as number
  if (row._volumen_m3    != null)  imp._volumen_m3        = row._volumen_m3          as number
  if (row._cant_bultos   != null)  imp._cant_bultos       = row._cant_bultos         as number
  if (row._cant_pallets_customs != null) imp._cant_pallets_customs = row._cant_pallets_customs as number
  if (row._freight_operator_name)     imp._freight_operator_name = row._freight_operator_name as string
  if (row._oficializacion_date != null) imp._oficializacion_date = row._oficializacion_date as number
  if (row._tributos_count != null)    imp._tributos_count = row._tributos_count as number
  if (row._extras_count   != null)    imp._extras_count   = row._extras_count   as number
  // Logo del proveedor
  if (row._supplier_logo)       imp._supplier_logo       = row._supplier_logo       as string
  if (row._supplier_logo_data)  imp._supplier_logo_data  = row._supplier_logo_data  as string
  return imp
}

const IMPORT_SELECT = `
  SELECT i.*,
    s.id   AS _supplier_id,   s.name   AS _supplier_name,
    s.country AS _supplier_country, s.contact_name AS _supplier_contact_name,
    s.contact_email AS _supplier_contact_email, s.contact_phone AS _supplier_contact_phone,
    s.website AS _supplier_website, s.payment_terms AS _supplier_payment_terms,
    s.brand AS _supplier_brand,
    s.incoterms_preferred AS _supplier_incoterms_preferred,
    s.port_of_origin AS _supplier_port_of_origin,
    s.notes AS _supplier_notes, s.created_at AS _supplier_created_at,
    s.updated_at AS _supplier_updated_at,
    s.logo_stored_name AS _supplier_logo,
    s.logo_data AS _supplier_logo_data,
    c.despacho_number AS _despacho_number,
    c.canal           AS _canal_despacho,
    c.peso_bruto_kg   AS _peso_bruto_kg,
    c.volumen_m3      AS _volumen_m3,
    c.cant_bultos     AS _cant_bultos,
    c.cant_pallets         AS _cant_pallets_customs,
    c.oficializacion_date  AS _oficializacion_date,
    fo.name                AS _freight_operator_name,
    (SELECT COUNT(*) FROM comex_import_tributos   WHERE import_id = i.id) AS _tributos_count,
    (SELECT COUNT(*) FROM comex_import_extra_costs WHERE import_id = i.id AND importe > 0) AS _extras_count
  FROM comex_imports i
  LEFT JOIN comex_suppliers s ON s.id = i.supplier_id
  LEFT JOIN comex_import_customs c ON c.import_id = i.id
  LEFT JOIN comex_freight_operators fo ON fo.id = i.freight_operator_id
`

export async function listImports(status?: string): Promise<ComexImport[]> {
  const db = getPowerSyncDb()
  const rows = status
    ? await db.getAll<Record<string, unknown>>(`${IMPORT_SELECT} WHERE i.status = ? ORDER BY i.created_at DESC`, [status])
    : await db.getAll<Record<string, unknown>>(`${IMPORT_SELECT} ORDER BY i.created_at DESC`)
  return rows.map(hydrateImport)
}

export async function getImport(id: string): Promise<ComexImport | null> {
  const row = await getPowerSyncDb().getOptional<Record<string, unknown>>(`${IMPORT_SELECT} WHERE i.id = ?`, [id])
  return row ? hydrateImport(row) : null
}

export async function createImport(input: CreateComexImportInput): Promise<ComexImport> {
  const db = getPowerSyncDb()
  const id = randomUUID()
  const now = Date.now()
  await db.execute(`
    INSERT INTO comex_imports
      (id, title, supplier_id, status, incoterm, origin_country, origin_port, currency,
       estimated_value, actual_value, order_date, payment_date, ship_date,
       arrival_date, eta_2, eta_3, eta_4,
       actual_ship_date, actual_arrival_date, tracking_number,
       customs_agent, drive_folder_id, notes, created_at, updated_at, workspace_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id, input.title, input.supplier_id ?? null,
    input.status ?? 'planning', input.incoterm ?? 'FOB',
    input.origin_country ?? '', input.origin_port ?? '', input.currency ?? 'USD',
    input.estimated_value ?? null, input.actual_value ?? null,
    input.order_date ?? null, input.payment_date ?? null,
    input.ship_date ?? null, input.arrival_date ?? null,
    input.eta_2 ?? null, input.eta_3 ?? null, input.eta_4 ?? null,
    input.actual_ship_date ?? null, input.actual_arrival_date ?? null,
    input.tracking_number ?? '', input.customs_agent ?? '',
    input.drive_folder_id ?? null, input.notes ?? '', now, now, WORKSPACE_ID
  ])
  return (await getImport(id))!
}

export async function updateImport(id: string, data: Partial<ComexImport>): Promise<ComexImport | null> {
  const db = getPowerSyncDb()
  const allowed = [
    'title','supplier_id','status','incoterm','origin_country','origin_port','currency',
    'estimated_value','actual_value','order_date','payment_date','ship_date',
    'arrival_date','eta_2','eta_3','eta_4',
    'actual_ship_date','actual_arrival_date','tracking_number',
    'customs_agent','drive_folder_id','notes',
    'inal_required','inal_lc_status','inal_lc_task_scheduled','inal_lc_task_id','inal_lc_cert_folder_id',
    'tc_eur_ars', 'cost_pct', 'proformas_folder_id', 'facturas_folder_id',
    'despacho_folder_id','despacho_stored_name','despacho_original_name',
    'despacho_drive_file_id','despacho_drive_status',
    'carga_armada_date','esperando_embarcar_date',
    'aviso_arribo_date','traslado_deposito_date','oficializacion_import_date',
    'carga_deposito_date','carga_deposito_time',
    'freight_operator_id','despachante','forwarder_ref_mail','bl_number',
    'bl_extracted_json',
    'pl_folder_id','pl_stored_name','pl_original_name','pl_drive_file_id','pl_drive_status','pl_extracted_json',
    'bl_folder_id','bl_stored_name','bl_original_name','bl_drive_file_id','bl_drive_status',
    'inal_drive_folder_id',
    'inal_pl_ok','inal_pl_stored_name','inal_pl_original_name','inal_pl_drive_file_id','inal_pl_drive_status',
    'inal_xls_ok','inal_xls_stored_name','inal_xls_original_name','inal_xls_drive_file_id','inal_xls_drive_status',
    'inal_factura_stored_name','inal_factura_original_name','inal_factura_drive_file_id','inal_factura_drive_status',
    'inal_bl_stored_name','inal_bl_original_name','inal_bl_drive_file_id','inal_bl_drive_status',
    'docs_to_despachante','docs_to_despachante_date','docs_to_compras','docs_to_compras_date',
    'payment_terms','payment_due_date','payment_notes'
  ]
  const sets = ['updated_at = ?']
  const vals: unknown[] = [Date.now()]
  for (const key of allowed) {
    if (key in data) { sets.push(`${key} = ?`); vals.push((data as Record<string, unknown>)[key]) }
  }
  vals.push(id)
  await db.execute(`UPDATE comex_imports SET ${sets.join(', ')} WHERE id = ?`, vals)
  return getImport(id)
}

export async function deleteImport(id: string): Promise<void> {
  const db = getPowerSyncDb()
  await db.execute('DELETE FROM comex_quote_files WHERE import_id = ?', [id])
  await db.execute('DELETE FROM comex_logistics_quotes WHERE import_id = ?', [id])
  await db.execute('DELETE FROM comex_payments WHERE import_id = ?', [id])
  await db.execute('DELETE FROM comex_import_customs WHERE import_id = ?', [id])
  await db.execute('DELETE FROM comex_import_costs WHERE import_id = ?', [id])
  await db.execute('DELETE FROM comex_inal_certs WHERE import_id = ?', [id])
  await db.execute('DELETE FROM comex_import_tributos WHERE import_id = ?', [id])
  await db.execute('DELETE FROM comex_import_extra_costs WHERE import_id = ?', [id])
  await db.execute('DELETE FROM comex_proformas WHERE import_id = ?', [id])
  await db.execute('DELETE FROM comex_documents WHERE import_id = ?', [id])
  await db.execute('DELETE FROM comex_import_items WHERE import_id = ?', [id])
  await db.execute('DELETE FROM comex_imports WHERE id = ?', [id])
}

export async function getImportFullDetail(id: string): Promise<{
  import: ComexImport
  items: ComexImportItem[]
  documents: ComexDocument[]
  quotes: ComexLogisticsQuote[]
  customs: ComexCustoms | null
  costs: ComexCostItem[]
} | null> {
  const imp = await getImport(id)
  if (!imp) return null
  const [items, documents, quotes, customs, costs] = await Promise.all([
    listItems(id), listDocuments(id), listQuotes(id), getCustoms(id), listCosts(id)
  ])
  return { import: imp, items, documents, quotes, customs, costs }
}

// ─── Import Items ─────────────────────────────────────────────────────────────

export async function listItems(importId: string): Promise<ComexImportItem[]> {
  return getPowerSyncDb().getAll<ComexImportItem>('SELECT * FROM comex_import_items WHERE import_id = ? ORDER BY created_at ASC', [importId])
}

export async function createItem(input: CreateComexItemInput): Promise<ComexImportItem> {
  const db = getPowerSyncDb()
  const id = randomUUID()
  const now = Date.now()
  await db.execute(`
    INSERT INTO comex_import_items (id, import_id, description, hs_code, quantity, unit, unit_price, currency, created_at, updated_at, workspace_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, input.import_id, input.description, input.hs_code ?? '', input.quantity, input.unit ?? 'u', input.unit_price, input.currency ?? 'USD', now, now, WORKSPACE_ID])
  return (await db.getOptional<ComexImportItem>('SELECT * FROM comex_import_items WHERE id = ?', [id]))!
}

export async function deleteItem(id: string): Promise<void> {
  await getPowerSyncDb().execute('DELETE FROM comex_import_items WHERE id = ?', [id])
}

// ─── Documents ────────────────────────────────────────────────────────────────

export async function listDocuments(importId: string): Promise<ComexDocument[]> {
  return getPowerSyncDb().getAll<ComexDocument>('SELECT * FROM comex_documents WHERE import_id = ? ORDER BY created_at ASC', [importId])
}

export async function getDocument(id: string): Promise<ComexDocument | null> {
  return (await getPowerSyncDb().getOptional<ComexDocument>('SELECT * FROM comex_documents WHERE id = ?', [id])) ?? null
}

export async function createDocument(input: CreateComexDocumentInput): Promise<ComexDocument> {
  const db = getPowerSyncDb()
  const id = randomUUID()
  const now = Date.now()
  await db.execute(`
    INSERT INTO comex_documents
      (id, import_id, type, name, drive_file_id, status, notes, received_at,
       local_stored_name, size_bytes, mime_type, drive_status, created_at, updated_at, workspace_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id, input.import_id, input.type ?? 'other', input.name,
    input.drive_file_id ?? null,
    input.status ?? 'pending', input.notes ?? '', input.received_at ?? null,
    (input as Partial<ComexDocument>).local_stored_name ?? null,
    (input as Partial<ComexDocument>).size_bytes ?? null,
    (input as Partial<ComexDocument>).mime_type ?? null,
    (input as Partial<ComexDocument>).drive_status ?? 'none',
    now, now, WORKSPACE_ID
  ])
  return (await db.getOptional<ComexDocument>('SELECT * FROM comex_documents WHERE id = ?', [id]))!
}

export async function updateDocument(id: string, data: Partial<ComexDocument>): Promise<void> {
  const db = getPowerSyncDb()
  const allowed = [
    'type','name','drive_file_id','status','notes','received_at',
    'local_stored_name','size_bytes','mime_type','drive_status'
  ]
  const sets: string[] = []
  const vals: unknown[] = []
  for (const key of allowed) {
    if (key in data) { sets.push(`${key} = ?`); vals.push((data as Record<string, unknown>)[key]) }
  }
  if (!sets.length) return
  sets.push('updated_at = ?'); vals.push(Date.now())
  vals.push(id)
  await db.execute(`UPDATE comex_documents SET ${sets.join(', ')} WHERE id = ?`, vals)
}

export async function deleteDocument(id: string): Promise<void> {
  await getPowerSyncDb().execute('DELETE FROM comex_documents WHERE id = ?', [id])
}

// ─── Logistics Quotes ─────────────────────────────────────────────────────────

export async function listQuotes(importId: string): Promise<ComexLogisticsQuote[]> {
  return getPowerSyncDb().getAll<ComexLogisticsQuote>(
    'SELECT * FROM comex_logistics_quotes WHERE import_id = ? ORDER BY created_at DESC',
    [importId]
  )
}

export async function createQuote(input: CreateComexQuoteInput): Promise<ComexLogisticsQuote> {
  const db = getPowerSyncDb()
  const id = randomUUID()
  const now = Date.now()
  await db.execute(`
    INSERT INTO comex_logistics_quotes
      (id, import_id, operator_id, operator_name, contact, cargo_type,
       quote_amount, currency, services_included, valid_until, status,
       rfq_sent_at, rfq_email_text, notes, created_at, updated_at, workspace_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id, input.import_id,
    (input as Partial<ComexLogisticsQuote>).operator_id ?? null,
    input.operator_name,
    input.contact ?? '',
    (input as Partial<ComexLogisticsQuote>).cargo_type ?? 'LCL',
    input.quote_amount ?? null,
    input.currency ?? 'USD',
    input.services_included ?? '',
    input.valid_until ?? null,
    input.status ?? 'requested',
    (input as Partial<ComexLogisticsQuote>).rfq_sent_at ?? null,
    (input as Partial<ComexLogisticsQuote>).rfq_email_text ?? '',
    input.notes ?? '',
    now, now, WORKSPACE_ID
  ])
  return (await db.getOptional<ComexLogisticsQuote>('SELECT * FROM comex_logistics_quotes WHERE id = ?', [id]))!
}

export async function updateQuote(id: string, data: Partial<ComexLogisticsQuote>): Promise<void> {
  const db = getPowerSyncDb()
  const allowed = [
    'operator_id','operator_name','contact','cargo_type',
    'quote_amount','currency','services_included','valid_until',
    'status','rfq_sent_at','rfq_email_text','notes',
    'quote_html','quote_received_at'
  ]
  const sets: string[] = []
  const vals: unknown[] = []
  for (const key of allowed) {
    if (key in data) { sets.push(`${key} = ?`); vals.push((data as Record<string, unknown>)[key]) }
  }
  if (!sets.length) return
  sets.push('updated_at = ?'); vals.push(Date.now())
  vals.push(id)
  await db.execute(`UPDATE comex_logistics_quotes SET ${sets.join(', ')} WHERE id = ?`, vals)
}

export async function deleteQuote(id: string): Promise<void> {
  const db = getPowerSyncDb()
  await db.execute('DELETE FROM comex_quote_files WHERE quote_id = ?', [id])
  await db.execute('DELETE FROM comex_logistics_quotes WHERE id = ?', [id])
}

// ─── Quote Files ──────────────────────────────────────────────────────────────

export async function listQuoteFiles(quoteId: string): Promise<ComexQuoteFile[]> {
  return getPowerSyncDb().getAll<ComexQuoteFile>(
    'SELECT * FROM comex_quote_files WHERE quote_id = ? ORDER BY created_at ASC',
    [quoteId]
  )
}

export async function createQuoteFile(input: Omit<ComexQuoteFile, 'id' | 'created_at' | 'updated_at'>): Promise<ComexQuoteFile> {
  const db = getPowerSyncDb()
  const id = randomUUID()
  const now = Date.now()
  await db.execute(
    `INSERT INTO comex_quote_files
       (id, quote_id, import_id, file_name, file_size, drive_file_id, drive_folder_id, mime_type, workspace_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.quote_id, input.import_id, input.file_name, input.file_size ?? null,
     input.drive_file_id, input.drive_folder_id ?? null, input.mime_type, WORKSPACE_ID, now, now]
  )
  return (await db.getOptional<ComexQuoteFile>('SELECT * FROM comex_quote_files WHERE id = ?', [id]))!
}

export async function updateQuoteFile(id: string, data: { drive_file_id?: string; drive_folder_id?: string | null }): Promise<void> {
  const db = getPowerSyncDb()
  const sets: string[] = []
  const vals: unknown[] = []
  if (data.drive_file_id !== undefined) { sets.push('drive_file_id = ?'); vals.push(data.drive_file_id) }
  if (data.drive_folder_id !== undefined) { sets.push('drive_folder_id = ?'); vals.push(data.drive_folder_id) }
  if (!sets.length) return
  sets.push('updated_at = ?'); vals.push(Date.now())
  vals.push(id)
  await db.execute(`UPDATE comex_quote_files SET ${sets.join(', ')} WHERE id = ?`, vals)
}

export async function deleteQuoteFile(id: string): Promise<void> {
  await getPowerSyncDb().execute('DELETE FROM comex_quote_files WHERE id = ?', [id])
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export async function listPayments(importId: string): Promise<ComexPayment[]> {
  return getPowerSyncDb().getAll<ComexPayment>('SELECT * FROM comex_payments WHERE import_id = ? ORDER BY created_at ASC', [importId])
}

export async function createPayment(input: CreateComexPaymentInput): Promise<ComexPayment> {
  const db = getPowerSyncDb()
  const id = randomUUID()
  const now = Date.now()
  await db.execute(`
    INSERT INTO comex_payments
      (id, import_id, amount, currency, exchange_rate, payment_date, method, bank, reference, status, notes, created_at, updated_at, workspace_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, input.import_id, input.amount, input.currency ?? 'USD',
         input.exchange_rate ?? null, input.payment_date ?? null,
         input.method ?? 'wire', input.bank ?? '', input.reference ?? '',
         input.status ?? 'pending', input.notes ?? '', now, now, WORKSPACE_ID])
  return (await db.getOptional<ComexPayment>('SELECT * FROM comex_payments WHERE id = ?', [id]))!
}

export async function updatePayment(id: string, data: Partial<ComexPayment>): Promise<void> {
  const db = getPowerSyncDb()
  const allowed = ['amount','currency','exchange_rate','payment_date','method','bank','reference','status','notes']
  const sets: string[] = []
  const vals: unknown[] = []
  for (const key of allowed) {
    if (key in data) { sets.push(`${key} = ?`); vals.push((data as Record<string, unknown>)[key]) }
  }
  if (!sets.length) return
  sets.push('updated_at = ?'); vals.push(Date.now())
  vals.push(id)
  await db.execute(`UPDATE comex_payments SET ${sets.join(', ')} WHERE id = ?`, vals)
}

export async function deletePayment(id: string): Promise<void> {
  await getPowerSyncDb().execute('DELETE FROM comex_payments WHERE id = ?', [id])
}

// ─── Customs (1:1 per import) ─────────────────────────────────────────────────

export async function getCustoms(importId: string): Promise<ComexCustoms | null> {
  return (await getPowerSyncDb().getOptional<ComexCustoms>('SELECT * FROM comex_import_customs WHERE import_id = ?', [importId])) ?? null
}

export async function upsertCustoms(importId: string, data: Partial<UpsertComexCustomsInput>): Promise<ComexCustoms> {
  const db = getPowerSyncDb()
  const now = Date.now()
  const existing = await db.getOptional<{ id: string }>('SELECT id FROM comex_import_customs WHERE import_id = ?', [importId])

  if (existing) {
    // Update only provided fields
    const allowed = [
      'fob_currency','fob_invoice','fob_declared','dolar_aduana','dolar_naviera',
      'paridad_usd_eur','despacho_number','despachante','oficializacion_date',
      'sepaimpo_vencimiento','bl_number','naviera_ref','carrier','canal','etd',
      'peso_bruto_kg','volumen_m3','cant_pallets','cant_cartons','cant_bultos','mulc_date','fecha_pago_banco',
      'cierre_banco_date','listas_despachante_date','listas_oscar_andrea_date'
    ]
    const sets = ['updated_at = ?']
    const vals: unknown[] = [now]
    for (const key of allowed) {
      if (key in data) { sets.push(`${key} = ?`); vals.push((data as Record<string, unknown>)[key]) }
    }
    vals.push(existing.id)
    await db.execute(`UPDATE comex_import_customs SET ${sets.join(', ')} WHERE id = ?`, vals)
    return (await db.getOptional<ComexCustoms>('SELECT * FROM comex_import_customs WHERE id = ?', [existing.id]))!
  } else {
    const id = randomUUID()
    await db.execute(`
      INSERT INTO comex_import_customs (
        id, import_id, fob_currency, fob_invoice, fob_declared,
        dolar_aduana, dolar_naviera, paridad_usd_eur,
        despacho_number, despachante, oficializacion_date, sepaimpo_vencimiento,
        bl_number, naviera_ref, carrier, canal, etd,
        peso_bruto_kg, volumen_m3, cant_pallets, cant_cartons, cant_bultos,
        mulc_date, fecha_pago_banco, cierre_banco_date,
        listas_despachante_date, listas_oscar_andrea_date,
        created_at, updated_at, workspace_id
      ) VALUES (
        ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
      )
    `, [
      id, importId,
      data.fob_currency ?? 'USD', data.fob_invoice ?? null, data.fob_declared ?? null,
      data.dolar_aduana ?? null, data.dolar_naviera ?? null, data.paridad_usd_eur ?? null,
      data.despacho_number ?? '', data.despachante ?? '', data.oficializacion_date ?? null,
      data.sepaimpo_vencimiento ?? null, data.bl_number ?? '', data.naviera_ref ?? '',
      data.carrier ?? '', data.canal ?? null, data.etd ?? null, data.peso_bruto_kg ?? null,
      data.volumen_m3 ?? null, data.cant_pallets ?? null, data.cant_cartons ?? null, data.cant_bultos ?? null,
      data.mulc_date ?? null, data.fecha_pago_banco ?? null, data.cierre_banco_date ?? null,
      data.listas_despachante_date ?? null, data.listas_oscar_andrea_date ?? null,
      now, now, WORKSPACE_ID
    ])
    return (await db.getOptional<ComexCustoms>('SELECT * FROM comex_import_customs WHERE id = ?', [id]))!
  }
}

// ─── Cost Items ───────────────────────────────────────────────────────────────

export async function listCosts(importId: string): Promise<ComexCostItem[]> {
  return getPowerSyncDb().getAll<ComexCostItem>('SELECT * FROM comex_import_costs WHERE import_id = ? ORDER BY sort_order ASC, created_at ASC', [importId])
}

export async function createCost(input: CreateComexCostInput): Promise<ComexCostItem> {
  const db = getPowerSyncDb()
  const id = randomUUID()
  const now = Date.now()
  await db.execute(`
    INSERT INTO comex_import_costs (id, import_id, category, concept, amount_pesos, amount_usd, sort_order, created_at, updated_at, workspace_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id, input.import_id, input.category ?? 'otros', input.concept,
    input.amount_pesos ?? 0, input.amount_usd ?? null,
    input.sort_order ?? 0, now, now, WORKSPACE_ID
  ])
  return (await db.getOptional<ComexCostItem>('SELECT * FROM comex_import_costs WHERE id = ?', [id]))!
}

export async function updateCost(id: string, data: Partial<ComexCostItem>): Promise<void> {
  const db = getPowerSyncDb()
  const allowed = ['category','concept','amount_pesos','amount_usd','sort_order']
  const sets: string[] = []
  const vals: unknown[] = []
  for (const key of allowed) {
    if (key in data) { sets.push(`${key} = ?`); vals.push((data as Record<string, unknown>)[key]) }
  }
  if (!sets.length) return
  sets.push('updated_at = ?'); vals.push(Date.now())
  vals.push(id)
  await db.execute(`UPDATE comex_import_costs SET ${sets.join(', ')} WHERE id = ?`, vals)
}

export async function deleteCost(id: string): Promise<void> {
  await getPowerSyncDb().execute('DELETE FROM comex_import_costs WHERE id = ?', [id])
}

// ─── Supplier Contacts ────────────────────────────────────────────────────────

export async function listSupplierContacts(supplierId: string): Promise<ComexSupplierContact[]> {
  return getPowerSyncDb().getAll<ComexSupplierContact>(
    'SELECT * FROM comex_supplier_contacts WHERE supplier_id = ? ORDER BY sort_order ASC, created_at ASC',
    [supplierId]
  )
}

export async function createSupplierContact(input: CreateComexSupplierContactInput): Promise<ComexSupplierContact> {
  const db = getPowerSyncDb()
  const id = randomUUID()
  const now = Date.now()
  await db.execute(`
    INSERT INTO comex_supplier_contacts
      (id, supplier_id, role, name, position, email, phone, whatsapp, notes, sort_order, created_at, updated_at, workspace_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id, input.supplier_id, input.role ?? 'commercial',
    input.name ?? '', input.position ?? '',
    input.email ?? '', input.phone ?? '', input.whatsapp ?? '',
    input.notes ?? '', input.sort_order ?? 0, now, now, WORKSPACE_ID
  ])
  return (await db.getOptional<ComexSupplierContact>('SELECT * FROM comex_supplier_contacts WHERE id = ?', [id]))!
}

export async function updateSupplierContact(id: string, data: Partial<ComexSupplierContact>): Promise<void> {
  const db = getPowerSyncDb()
  const allowed = ['role','name','position','email','phone','whatsapp','notes','sort_order']
  const sets: string[] = []
  const vals: unknown[] = []
  for (const key of allowed) {
    if (key in data) { sets.push(`${key} = ?`); vals.push((data as Record<string,unknown>)[key]) }
  }
  if (!sets.length) return
  sets.push('updated_at = ?'); vals.push(Date.now())
  vals.push(id)
  await db.execute(`UPDATE comex_supplier_contacts SET ${sets.join(', ')} WHERE id = ?`, vals)
}

export async function deleteSupplierContact(id: string): Promise<void> {
  await getPowerSyncDb().execute('DELETE FROM comex_supplier_contacts WHERE id = ?', [id])
}

// ─── Supplier Bank Accounts ───────────────────────────────────────────────────

export async function listSupplierBankAccounts(supplierId: string): Promise<ComexSupplierBankAccount[]> {
  return getPowerSyncDb().getAll<ComexSupplierBankAccount>(
    'SELECT * FROM comex_supplier_bank_accounts WHERE supplier_id = ? ORDER BY created_at ASC',
    [supplierId]
  )
}

export async function createSupplierBankAccount(input: CreateComexSupplierBankAccountInput): Promise<ComexSupplierBankAccount> {
  const db = getPowerSyncDb()
  const id = randomUUID()
  const now = Date.now()
  await db.execute(`
    INSERT INTO comex_supplier_bank_accounts
      (id, supplier_id, bank_name, beneficiary_name, account_number, swift_bic, iban, routing_number, currency, bank_address, notes, created_at, updated_at, workspace_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id, input.supplier_id,
    input.bank_name ?? '', input.beneficiary_name ?? '',
    input.account_number ?? '', input.swift_bic ?? '',
    input.iban ?? '', input.routing_number ?? '',
    input.currency ?? 'USD', input.bank_address ?? '',
    input.notes ?? '', now, now, WORKSPACE_ID
  ])
  return (await db.getOptional<ComexSupplierBankAccount>('SELECT * FROM comex_supplier_bank_accounts WHERE id = ?', [id]))!
}

export async function updateSupplierBankAccount(id: string, data: Partial<ComexSupplierBankAccount>): Promise<void> {
  const db = getPowerSyncDb()
  const allowed = ['bank_name','beneficiary_name','account_number','swift_bic','iban','routing_number','currency','bank_address','notes']
  const sets: string[] = []
  const vals: unknown[] = []
  for (const key of allowed) {
    if (key in data) { sets.push(`${key} = ?`); vals.push((data as Record<string,unknown>)[key]) }
  }
  if (!sets.length) return
  sets.push('updated_at = ?'); vals.push(Date.now())
  vals.push(id)
  await db.execute(`UPDATE comex_supplier_bank_accounts SET ${sets.join(', ')} WHERE id = ?`, vals)
}

export async function deleteSupplierBankAccount(id: string): Promise<void> {
  await getPowerSyncDb().execute('DELETE FROM comex_supplier_bank_accounts WHERE id = ?', [id])
}

// ─── Freight Operators ────────────────────────────────────────────────────────

export async function listFreightOperators(): Promise<ComexFreightOperator[]> {
  return getPowerSyncDb().getAll<ComexFreightOperator>('SELECT * FROM comex_freight_operators ORDER BY name ASC')
}

export async function getFreightOperator(id: string): Promise<ComexFreightOperator | null> {
  return (await getPowerSyncDb().getOptional<ComexFreightOperator>('SELECT * FROM comex_freight_operators WHERE id = ?', [id])) ?? null
}

export async function createFreightOperator(input: CreateComexFreightOperatorInput): Promise<ComexFreightOperator> {
  const db = getPowerSyncDb()
  const id = randomUUID()
  const now = Date.now()
  await db.execute(`
    INSERT INTO comex_freight_operators
      (id, name, company_type, contact_name, email, phone, whatsapp, services, notes, created_at, updated_at, workspace_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id, input.name, input.company_type ?? 'agente',
    input.contact_name ?? '', input.email ?? '',
    input.phone ?? '', input.whatsapp ?? '',
    input.services ?? '', input.notes ?? '',
    now, now, WORKSPACE_ID
  ])
  return (await db.getOptional<ComexFreightOperator>('SELECT * FROM comex_freight_operators WHERE id = ?', [id]))!
}

export async function updateFreightOperator(id: string, data: Partial<ComexFreightOperator>): Promise<ComexFreightOperator | null> {
  const db = getPowerSyncDb()
  const allowed = ['name','company_type','contact_name','email','phone','whatsapp','services','notes','logo_stored_name','logo_data']
  const sets = ['updated_at = ?']
  const vals: unknown[] = [Date.now()]
  for (const key of allowed) {
    if (key in data) { sets.push(`${key} = ?`); vals.push((data as Record<string, unknown>)[key]) }
  }
  vals.push(id)
  await db.execute(`UPDATE comex_freight_operators SET ${sets.join(', ')} WHERE id = ?`, vals)
  return (await db.getOptional<ComexFreightOperator>('SELECT * FROM comex_freight_operators WHERE id = ?', [id])) ?? null
}

export async function deleteFreightOperator(id: string): Promise<void> {
  await getPowerSyncDb().execute('DELETE FROM comex_freight_operators WHERE id = ?', [id])
}

// ─── Freight Operator Contacts ────────────────────────────────────────────────

export async function listOperatorContacts(operatorId: string): Promise<ComexFreightOperatorContact[]> {
  return getPowerSyncDb().getAll<ComexFreightOperatorContact>(
    'SELECT * FROM comex_freight_operator_contacts WHERE operator_id = ? ORDER BY sort_order ASC, created_at ASC',
    [operatorId]
  )
}

export async function createOperatorContact(input: CreateComexFreightOperatorContactInput): Promise<ComexFreightOperatorContact> {
  const db = getPowerSyncDb()
  const id = randomUUID()
  const now = Date.now()
  await db.execute(`
    INSERT INTO comex_freight_operator_contacts
      (id, operator_id, name, nickname, role, email, phone, sort_order, created_at, updated_at, workspace_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id, input.operator_id, input.name ?? '', input.nickname ?? '',
    input.role ?? '', input.email ?? '', input.phone ?? '', input.sort_order ?? 0, now, now, WORKSPACE_ID
  ])
  return (await db.getOptional<ComexFreightOperatorContact>('SELECT * FROM comex_freight_operator_contacts WHERE id = ?', [id]))!
}

export async function updateOperatorContact(id: string, data: Partial<ComexFreightOperatorContact>): Promise<void> {
  const db = getPowerSyncDb()
  const allowed = ['name', 'nickname', 'role', 'email', 'phone', 'sort_order']
  const sets: string[] = []
  const vals: unknown[] = []
  for (const key of allowed) {
    if (key in data) { sets.push(`${key} = ?`); vals.push((data as Record<string, unknown>)[key]) }
  }
  if (!sets.length) return
  sets.push('updated_at = ?'); vals.push(Date.now())
  vals.push(id)
  await db.execute(`UPDATE comex_freight_operator_contacts SET ${sets.join(', ')} WHERE id = ?`, vals)
}

export async function deleteOperatorContact(id: string): Promise<void> {
  await getPowerSyncDb().execute('DELETE FROM comex_freight_operator_contacts WHERE id = ?', [id])
}

// ─── Tributos del despacho ────────────────────────────────────────────────────

export async function listTributos(importId: string): Promise<ComexImportTributo[]> {
  return getPowerSyncDb().getAll<ComexImportTributo>('SELECT * FROM comex_import_tributos WHERE import_id = ? ORDER BY sort_order ASC, created_at ASC', [importId])
}

export async function createTributo(input: CreateComexImportTributoInput): Promise<ComexImportTributo> {
  const db = getPowerSyncDb()
  const id = randomUUID()
  const now = Date.now()
  await db.execute(`
    INSERT INTO comex_import_tributos (id, import_id, codigo, concepto, porcentaje, importe_usd, sort_order, created_at, updated_at, workspace_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, input.import_id, input.codigo ?? '', input.concepto ?? '',
    input.porcentaje ?? null, input.importe_usd ?? 0, input.sort_order ?? 0, now, now, WORKSPACE_ID])
  return (await db.getOptional<ComexImportTributo>('SELECT * FROM comex_import_tributos WHERE id = ?', [id]))!
}

export async function updateTributo(id: string, data: Partial<ComexImportTributo>): Promise<void> {
  const db = getPowerSyncDb()
  const allowed = ['codigo', 'concepto', 'porcentaje', 'importe_usd', 'sort_order']
  const sets: string[] = []
  const vals: unknown[] = []
  for (const key of allowed) {
    if (key in data) { sets.push(`${key} = ?`); vals.push((data as Record<string, unknown>)[key]) }
  }
  if (!sets.length) return
  sets.push('updated_at = ?'); vals.push(Date.now())
  vals.push(id)
  await db.execute(`UPDATE comex_import_tributos SET ${sets.join(', ')} WHERE id = ?`, vals)
}

export async function deleteTributo(id: string): Promise<void> {
  await getPowerSyncDb().execute('DELETE FROM comex_import_tributos WHERE id = ?', [id])
}

/** Reemplaza todos los tributos de una importación de una sola vez (usado por IA) */
export async function upsertTributos(importId: string, tributos: Omit<CreateComexImportTributoInput, 'import_id'>[]): Promise<ComexImportTributo[]> {
  const db = getPowerSyncDb()
  const now = Date.now()
  await db.writeTransaction(async (tx) => {
    await tx.execute('DELETE FROM comex_import_tributos WHERE import_id = ?', [importId])
    for (let i = 0; i < tributos.length; i++) {
      const t = tributos[i]
      const id = randomUUID()
      await tx.execute(`
        INSERT INTO comex_import_tributos (id, import_id, codigo, concepto, porcentaje, importe_usd, sort_order, created_at, updated_at, workspace_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [id, importId, t.codigo ?? '', t.concepto ?? '', t.porcentaje ?? null, t.importe_usd ?? 0, i, now, now, WORKSPACE_ID])
    }
  })
  return listTributos(importId)
}

// ─── Extra costs ─────────────────────────────────────────────────────────────

/** Crea los 3 costos fijos por defecto al crear una importación */
export async function createDefaultExtraCosts(importId: string): Promise<void> {
  const defaults: Array<{ categoria: string; concepto: string; sort_order: number }> = [
    { categoria: 'flete_internacional', concepto: 'Flete internacional', sort_order: 0 },
    { categoria: 'flete_local',         concepto: 'Flete local',         sort_order: 1 },
    { categoria: 'despachante',         concepto: 'Despachante',         sort_order: 2 },
    { categoria: 'deposito_fiscal',     concepto: 'Depósito fiscal',     sort_order: 3 }
  ]
  const db = getPowerSyncDb()
  const now = Date.now()
  for (const d of defaults) {
    const id = randomUUID()
    await db.execute(`
      INSERT INTO comex_import_extra_costs
        (id, import_id, categoria, concepto, proveedor, nro_factura, fecha_factura,
         importe, moneda, stored_name, original_name, drive_file_id, drive_folder_id,
         drive_status, sort_order, created_at, updated_at, workspace_id)
      VALUES (?, ?, ?, ?, '', '', NULL, 0, 'ARS', NULL, NULL, NULL, NULL, 'none', ?, ?, ?, ?)
    `, [id, importId, d.categoria, d.concepto, d.sort_order, now, now, WORKSPACE_ID])
  }
}

export async function listExtraCosts(importId: string): Promise<ComexImportExtraCost[]> {
  return getPowerSyncDb().getAll<ComexImportExtraCost>('SELECT * FROM comex_import_extra_costs WHERE import_id = ? ORDER BY sort_order ASC, created_at ASC', [importId])
}

export async function getExtraCost(id: string): Promise<ComexImportExtraCost | null> {
  return (await getPowerSyncDb().getOptional<ComexImportExtraCost>('SELECT * FROM comex_import_extra_costs WHERE id = ?', [id])) ?? null
}

export async function createExtraCost(input: CreateComexImportExtraCostInput): Promise<ComexImportExtraCost> {
  const db = getPowerSyncDb()
  const id = randomUUID()
  const now = Date.now()
  await db.execute(`
    INSERT INTO comex_import_extra_costs
      (id, import_id, categoria, concepto, proveedor, nro_factura, fecha_factura,
       importe, moneda, stored_name, original_name, drive_file_id, drive_folder_id,
       drive_status, sort_order, created_at, updated_at, workspace_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id, input.import_id, input.categoria ?? 'otro', input.concepto ?? '',
    input.proveedor ?? '', input.nro_factura ?? '', input.fecha_factura ?? null,
    input.importe ?? 0, input.moneda ?? 'ARS',
    null, null, null, null, 'none', input.sort_order ?? 0, now, now, WORKSPACE_ID
  ])
  return (await db.getOptional<ComexImportExtraCost>('SELECT * FROM comex_import_extra_costs WHERE id = ?', [id]))!
}

export async function updateExtraCost(id: string, data: Partial<ComexImportExtraCost>): Promise<void> {
  const db = getPowerSyncDb()
  const allowed = [
    'categoria', 'concepto', 'proveedor', 'nro_factura', 'fecha_factura',
    'importe', 'moneda',
    'cae', 'referencia_despacho', 'importe_iva', 'importe_total', 'items_json',
    'tipo_cambio', 'bl_referencia', 'importe_ars',
    'percepciones', 'percepcion_caba', 'percepcion_bsas',
    'fecha_ingreso', 'fecha_egreso', 'nro_contenedor', 'canal_deposito',
    'stored_name', 'original_name',
    'drive_file_id', 'drive_folder_id', 'drive_status', 'sort_order'
  ]
  const sets: string[] = []
  const vals: unknown[] = []
  for (const key of allowed) {
    if (key in data) { sets.push(`${key} = ?`); vals.push((data as Record<string, unknown>)[key]) }
  }
  if (!sets.length) return
  sets.push('updated_at = ?'); vals.push(Date.now())
  vals.push(id)
  await db.execute(`UPDATE comex_import_extra_costs SET ${sets.join(', ')} WHERE id = ?`, vals)
}

export async function deleteExtraCost(id: string): Promise<void> {
  await getPowerSyncDb().execute('DELETE FROM comex_import_extra_costs WHERE id = ?', [id])
}

// ─── Proformas ────────────────────────────────────────────────────────────────

export async function listProformas(importId: string, tipo: 'proforma' | 'factura' = 'proforma'): Promise<ComexProforma[]> {
  return getPowerSyncDb().getAll<ComexProforma>('SELECT * FROM comex_proformas WHERE import_id = ? AND tipo = ? ORDER BY numero ASC, created_at ASC', [importId, tipo])
}

export async function getProforma(id: string): Promise<ComexProforma | null> {
  return (await getPowerSyncDb().getOptional<ComexProforma>('SELECT * FROM comex_proformas WHERE id = ?', [id])) ?? null
}

export async function createProforma(input: CreateComexProformaInput): Promise<ComexProforma> {
  const db  = getPowerSyncDb()
  const id  = randomUUID()
  const now = Date.now()
  const tipo   = input.tipo ?? 'proforma'
  // Auto-número por tipo
  const maxRow = await db.getOptional<{ m: number | null }>('SELECT MAX(numero) as m FROM comex_proformas WHERE import_id = ? AND tipo = ?', [input.import_id, tipo])
  const numero = (maxRow?.m ?? 0) + 1
  await db.execute(`
    INSERT INTO comex_proformas
      (id, import_id, tipo, numero, fecha_proforma, importe, moneda, nro_proforma, descripcion,
       incluir_en_total, stored_name, original_name, drive_file_id, drive_folder_id, drive_status, created_at, updated_at, workspace_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id, input.import_id, tipo, numero,
    input.fecha_proforma ?? null, input.importe ?? null,
    input.moneda ?? 'USD', input.nro_proforma ?? '', input.descripcion ?? '',
    input.incluir_en_total ?? 1,
    null, null, null, null, 'none', now, now, WORKSPACE_ID
  ])
  return (await db.getOptional<ComexProforma>('SELECT * FROM comex_proformas WHERE id = ?', [id]))!
}

export async function updateProforma(id: string, data: Partial<ComexProforma>): Promise<void> {
  const db = getPowerSyncDb()
  const allowed = [
    'fecha_proforma', 'importe', 'moneda', 'nro_proforma', 'descripcion',
    'incluir_en_total', 'stored_name', 'original_name',
    'drive_file_id', 'drive_folder_id', 'drive_status'
  ]
  const sets: string[] = []
  const vals: unknown[] = []
  for (const key of allowed) {
    if (key in data) { sets.push(`${key} = ?`); vals.push((data as Record<string, unknown>)[key]) }
  }
  if (!sets.length) return
  sets.push('updated_at = ?'); vals.push(Date.now())
  vals.push(id)
  await db.execute(`UPDATE comex_proformas SET ${sets.join(', ')} WHERE id = ?`, vals)
}

export async function deleteProforma(id: string): Promise<void> {
  await getPowerSyncDb().execute('DELETE FROM comex_proformas WHERE id = ?', [id])
}

// ─── INAL Certificates ────────────────────────────────────────────────────────

export async function listInalCerts(importId: string): Promise<ComexInalCert[]> {
  return getPowerSyncDb().getAll<ComexInalCert>('SELECT * FROM comex_inal_certs WHERE import_id = ? ORDER BY created_at ASC', [importId])
}

export async function createInalCert(
  importId: string,
  originalName: string,
  opts: { local_stored_name?: string; size_bytes?: number; mime_type?: string } = {}
): Promise<ComexInalCert> {
  const db = getPowerSyncDb()
  const id = randomUUID()
  const now = Date.now()
  await db.execute(`
    INSERT INTO comex_inal_certs
      (id, import_id, original_name, local_stored_name, size_bytes, mime_type, drive_file_id, drive_status, created_at, updated_at, workspace_id)
    VALUES (?, ?, ?, ?, ?, ?, NULL, 'none', ?, ?, ?)
  `, [id, importId, originalName, opts.local_stored_name ?? null, opts.size_bytes ?? null, opts.mime_type ?? null, now, now, WORKSPACE_ID])
  return (await db.getOptional<ComexInalCert>('SELECT * FROM comex_inal_certs WHERE id = ?', [id]))!
}

export async function updateInalCert(id: string, data: Partial<ComexInalCert>): Promise<void> {
  const db = getPowerSyncDb()
  const allowed = ['drive_file_id', 'drive_status', 'local_stored_name', 'size_bytes', 'mime_type']
  const sets: string[] = []
  const vals: unknown[] = []
  for (const key of allowed) {
    if (key in data) { sets.push(`${key} = ?`); vals.push((data as Record<string, unknown>)[key]) }
  }
  if (!sets.length) return
  sets.push('updated_at = ?'); vals.push(Date.now())
  vals.push(id)
  await db.execute(`UPDATE comex_inal_certs SET ${sets.join(', ')} WHERE id = ?`, vals)
}

export async function deleteInalCert(id: string): Promise<void> {
  await getPowerSyncDb().execute('DELETE FROM comex_inal_certs WHERE id = ?', [id])
}

export async function getInalCert(id: string): Promise<ComexInalCert | null> {
  return (await getPowerSyncDb().getOptional<ComexInalCert>('SELECT * FROM comex_inal_certs WHERE id = ?', [id])) ?? null
}

// ─── Gestores INAL ────────────────────────────────────────────────────────────

import type { ComexGestor, ComexGestorContact, CreateComexGestorInput, CreateComexGestorContactInput, ComexDespachante, CreateComexDespachanteInput } from '@shared/types'

export async function listGestores(): Promise<ComexGestor[]> {
  const db = getPowerSyncDb()
  const gestores = await db.getAll<ComexGestor>('SELECT * FROM comex_gestores ORDER BY name ASC')
  for (const g of gestores) {
    g.contacts = await db.getAll<ComexGestorContact>('SELECT * FROM comex_gestor_contacts WHERE gestor_id = ? ORDER BY sort_order ASC, created_at ASC', [g.id])
  }
  return gestores
}

export async function getGestor(id: string): Promise<ComexGestor | null> {
  const db = getPowerSyncDb()
  const g = (await db.getOptional<ComexGestor>('SELECT * FROM comex_gestores WHERE id = ?', [id])) ?? null
  if (g) g.contacts = await db.getAll<ComexGestorContact>('SELECT * FROM comex_gestor_contacts WHERE gestor_id = ? ORDER BY sort_order ASC', [id])
  return g
}

export async function createGestor(input: CreateComexGestorInput): Promise<ComexGestor> {
  const db = getPowerSyncDb()
  const id = randomUUID(), now = Date.now()
  await db.execute(
    `INSERT INTO comex_gestores (id,name,estudio,cuit,email,phone,phone_empresa,whatsapp,website,direccion,especialidades,notas,created_at,updated_at,workspace_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, input.name, input.estudio??'', input.cuit??'', input.email??'', input.phone??'', (input as Partial<ComexGestor>).phone_empresa??'', input.whatsapp??'', (input as Partial<ComexGestor>).website??'', (input as Partial<ComexGestor>).direccion??'', input.especialidades??'', input.notas??'', now, now, WORKSPACE_ID]
  )
  return (await getGestor(id))!
}

export async function updateGestor(id: string, data: Partial<ComexGestor>): Promise<ComexGestor | null> {
  const db = getPowerSyncDb()
  const allowed = ['name','estudio','cuit','email','phone','phone_empresa','whatsapp','website','direccion','especialidades','notas','logo_stored_name','logo_data']
  const sets = ['updated_at = ?'], vals: unknown[] = [Date.now()]
  for (const k of allowed) { if (k in data) { sets.push(`${k} = ?`); vals.push((data as Record<string,unknown>)[k]) } }
  vals.push(id)
  await db.execute(`UPDATE comex_gestores SET ${sets.join(', ')} WHERE id = ?`, vals)
  return getGestor(id)
}

export async function deleteGestor(id: string): Promise<void> {
  await getPowerSyncDb().execute('DELETE FROM comex_gestores WHERE id = ?', [id])
}

export async function createGestorContact(input: CreateComexGestorContactInput): Promise<ComexGestorContact> {
  const db = getPowerSyncDb(), id = randomUUID(), now = Date.now()
  await db.execute(
    `INSERT INTO comex_gestor_contacts (id,gestor_id,name,role,email,phone,sort_order,created_at,updated_at,workspace_id) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [id, input.gestor_id, input.name??'', input.role??'', input.email??'', input.phone??'', input.sort_order??0, now, now, WORKSPACE_ID]
  )
  return (await db.getOptional<ComexGestorContact>('SELECT * FROM comex_gestor_contacts WHERE id = ?', [id]))!
}

export async function updateGestorContact(id: string, data: Partial<ComexGestorContact>): Promise<void> {
  const db = getPowerSyncDb()
  const allowed = ['name','role','email','phone','sort_order']
  const sets: string[] = [], vals: unknown[] = []
  for (const k of allowed) { if (k in data) { sets.push(`${k} = ?`); vals.push((data as Record<string,unknown>)[k]) } }
  if (!sets.length) return
  sets.push('updated_at = ?'); vals.push(Date.now())
  vals.push(id)
  await db.execute(`UPDATE comex_gestor_contacts SET ${sets.join(', ')} WHERE id = ?`, vals)
}

export async function deleteGestorContact(id: string): Promise<void> {
  await getPowerSyncDb().execute('DELETE FROM comex_gestor_contacts WHERE id = ?', [id])
}

// ─── Despachantes ─────────────────────────────────────────────────────────────

import type { ComexDespachanteContact, CreateComexDespachanteContactInput } from '@shared/types'

export async function listDespachantes(): Promise<ComexDespachante[]> {
  const db = getPowerSyncDb()
  const despachantes = await db.getAll<ComexDespachante>('SELECT * FROM comex_despachantes ORDER BY name ASC')
  for (const d of despachantes) {
    d.contacts = await db.getAll<ComexDespachanteContact>('SELECT * FROM comex_despachante_contacts WHERE despachante_id = ? ORDER BY sort_order ASC, created_at ASC', [d.id])
  }
  return despachantes
}

export async function createDespachante(input: CreateComexDespachanteInput): Promise<ComexDespachante> {
  const db = getPowerSyncDb(), id = randomUUID(), now = Date.now()
  await db.execute(
    `INSERT INTO comex_despachantes (id,name,matricula,empresa,cuit,email,phone,phone_empresa,whatsapp,website,direccion,notas,created_at,updated_at,workspace_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, input.name, input.matricula??'', input.empresa??'', input.cuit??'', input.email??'', input.phone??'', (input as Partial<ComexDespachante>).phone_empresa??'', input.whatsapp??'', (input as Partial<ComexDespachante>).website??'', (input as Partial<ComexDespachante>).direccion??'', input.notas??'', now, now, WORKSPACE_ID]
  )
  return (await db.getOptional<ComexDespachante>('SELECT * FROM comex_despachantes WHERE id = ?', [id]))!
}

export async function updateDespachante(id: string, data: Partial<ComexDespachante>): Promise<ComexDespachante | null> {
  const db = getPowerSyncDb()
  const allowed = ['name','matricula','empresa','cuit','email','phone','phone_empresa','whatsapp','website','direccion','notas','logo_stored_name','logo_data']
  const sets = ['updated_at = ?'], vals: unknown[] = [Date.now()]
  for (const k of allowed) { if (k in data) { sets.push(`${k} = ?`); vals.push((data as Record<string,unknown>)[k]) } }
  vals.push(id)
  await db.execute(`UPDATE comex_despachantes SET ${sets.join(', ')} WHERE id = ?`, vals)
  return (await db.getOptional<ComexDespachante>('SELECT * FROM comex_despachantes WHERE id = ?', [id])) ?? null
}

export async function deleteDespachante(id: string): Promise<void> {
  await getPowerSyncDb().execute('DELETE FROM comex_despachantes WHERE id = ?', [id])
}

export async function createDespachanteContact(input: CreateComexDespachanteContactInput): Promise<ComexDespachanteContact> {
  const db = getPowerSyncDb(), id = randomUUID(), now = Date.now()
  await db.execute(
    `INSERT INTO comex_despachante_contacts (id,despachante_id,name,role,email,phone,sort_order,created_at,updated_at,workspace_id) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [id, input.despachante_id, input.name??'', input.role??'', input.email??'', input.phone??'', input.sort_order??0, now, now, WORKSPACE_ID]
  )
  return (await db.getOptional<ComexDespachanteContact>('SELECT * FROM comex_despachante_contacts WHERE id = ?', [id]))!
}

export async function updateDespachanteContact(id: string, data: Partial<ComexDespachanteContact>): Promise<void> {
  const db = getPowerSyncDb()
  const allowed = ['name','role','email','phone','sort_order']
  const sets: string[] = [], vals: unknown[] = []
  for (const k of allowed) { if (k in data) { sets.push(`${k} = ?`); vals.push((data as Record<string,unknown>)[k]) } }
  if (!sets.length) return
  sets.push('updated_at = ?'); vals.push(Date.now())
  vals.push(id)
  await db.execute(`UPDATE comex_despachante_contacts SET ${sets.join(', ')} WHERE id = ?`, vals)
}

export async function deleteDespachanteContact(id: string): Promise<void> {
  await getPowerSyncDb().execute('DELETE FROM comex_despachante_contacts WHERE id = ?', [id])
}

// ─── Marcas (Programación Pedidos) ─────────────────────────────────────────────

import type { ComexBrand, CreateComexBrandInput } from '@shared/types'

async function hydrateBrand(row: Record<string, unknown> | null): Promise<ComexBrand | null> {
  if (!row) return null
  const brand = row as unknown as ComexBrand
  if (brand.primary_supplier_id) {
    brand.primary_supplier = (await getSupplier(brand.primary_supplier_id)) ?? undefined
  }
  return brand
}

export async function listBrands(): Promise<ComexBrand[]> {
  const db = getPowerSyncDb()
  const rows = await db.getAll<Record<string, unknown>>('SELECT * FROM comex_brands ORDER BY name ASC')
  return Promise.all(rows.map((r) => hydrateBrand(r) as Promise<ComexBrand>))
}

export async function getBrand(id: string): Promise<ComexBrand | null> {
  const db = getPowerSyncDb()
  const row = (await db.getOptional<Record<string, unknown>>('SELECT * FROM comex_brands WHERE id = ?', [id])) ?? null
  return hydrateBrand(row)
}

export async function createBrand(input: CreateComexBrandInput): Promise<ComexBrand> {
  const db = getPowerSyncDb()
  const id = randomUUID()
  const now = Date.now()
  await db.execute(`
    INSERT INTO comex_brands
      (id, name, category, primary_supplier_id, demand_annual, demand_monthly_json,
       current_stock, safety_stock, purchase_frequency_days, notes, created_at, updated_at, workspace_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    input.name,
    input.category ?? '',
    input.primary_supplier_id ?? null,
    input.demand_annual ?? null,
    input.demand_monthly_json ?? '{}',
    input.current_stock ?? null,
    input.safety_stock ?? null,
    input.purchase_frequency_days ?? null,
    input.notes ?? '',
    now, now, WORKSPACE_ID
  ])
  return (await getBrand(id))!
}

export async function updateBrand(id: string, data: Partial<ComexBrand>): Promise<ComexBrand | null> {
  const db = getPowerSyncDb()
  const allowed = [
    'name','category','primary_supplier_id','demand_annual','demand_monthly_json',
    'current_stock','safety_stock','purchase_frequency_days','notes','logo_stored_name','logo_data'
  ]
  const sets = ['updated_at = ?']
  const vals: unknown[] = [Date.now()]
  for (const key of allowed) {
    if (key in data) { sets.push(`${key} = ?`); vals.push((data as Record<string, unknown>)[key]) }
  }
  vals.push(id)
  await db.execute(`UPDATE comex_brands SET ${sets.join(', ')} WHERE id = ?`, vals)
  return getBrand(id)
}

export async function deleteBrand(id: string): Promise<void> {
  await getPowerSyncDb().execute('DELETE FROM comex_brands WHERE id = ?', [id])
}

// ─── Programaciones de pedido (Programación Pedidos) ──────────────────────────

import type {
  ImportOrderPlanning, CreateImportOrderPlanningInput,
  ImportOrderPlanningMilestone,
  ImportOrderPlanningAIReport, CreateImportOrderPlanningAIReportInput
} from '@shared/types'
import { calculatePlanning, buildMilestoneRecords } from '../../services/order-planning.service'

const PLANNING_COLUMNS = [
  'brand_id', 'supplier_id', 'country', 'responsible_user_id',
  'planning_type', 'status', 'risk_status', 'priority',
  'target_coverage_start_date', 'target_coverage_end_date', 'target_commercial_availability_date',
  'recommended_order_date', 'approval_deadline_date', 'estimated_reception_date',
  'demand_annual_estimated', 'demand_monthly_estimated', 'demand_for_period',
  'current_stock', 'safety_stock', 'desired_coverage_months',
  'internal_approval_days', 'supplier_preparation_days', 'production_days', 'inspection_days',
  'shipping_days', 'customs_days', 'local_delivery_days', 'safety_days', 'total_lead_time_days',
  'ai_recommendation_summary', 'ai_risk_explanation', 'notes', 'linked_import_id'
] as const

async function hydratePlanning(row: Record<string, unknown> | null): Promise<ImportOrderPlanning | null> {
  if (!row) return null
  const planning = row as unknown as ImportOrderPlanning
  planning.brand = (await getBrand(planning.brand_id)) ?? undefined
  if (planning.supplier_id) {
    planning.supplier = (await getSupplier(planning.supplier_id)) ?? undefined
  }
  planning.milestones = await listMilestones(planning.id)
  return planning
}

export async function listPlannings(filters?: { brandId?: string; status?: string }): Promise<ImportOrderPlanning[]> {
  const db = getPowerSyncDb()
  let sql = 'SELECT * FROM import_order_plannings'
  const conditions: string[] = []
  const params: unknown[] = []
  if (filters?.brandId) { conditions.push('brand_id = ?'); params.push(filters.brandId) }
  if (filters?.status) { conditions.push('status = ?'); params.push(filters.status) }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ')
  sql += ' ORDER BY target_commercial_availability_date ASC, created_at DESC'
  const rows = await db.getAll<Record<string, unknown>>(sql, params)
  return Promise.all(rows.map((r) => hydratePlanning(r) as Promise<ImportOrderPlanning>))
}

export async function getPlanning(id: string): Promise<ImportOrderPlanning | null> {
  const row = await getPowerSyncDb().getOptional<Record<string, unknown>>('SELECT * FROM import_order_plannings WHERE id = ?', [id])
  return hydratePlanning(row ?? null)
}

export async function createPlanning(input: CreateImportOrderPlanningInput): Promise<ImportOrderPlanning> {
  const db = getPowerSyncDb()
  const id = randomUUID()
  const now = Date.now()

  const brand = await getBrand(input.brand_id)
  const result = calculatePlanning({ ...input, id, created_at: now, updated_at: now } as ImportOrderPlanning, brand)

  const merged: ImportOrderPlanning = {
    ...input,
    id, created_at: now, updated_at: now,
    recommended_order_date: result.recommended_order_date,
    approval_deadline_date: result.approval_deadline_date,
    estimated_reception_date: result.estimated_reception_date,
    total_lead_time_days: result.total_lead_time_days,
    risk_status: result.risk_status,
    demand_for_period: result.demand_for_period,
    desired_coverage_months: result.desired_coverage_months,
  }

  const placeholders = PLANNING_COLUMNS.map(() => '?').join(', ')
  await db.execute(`
    INSERT INTO import_order_plannings (id, ${PLANNING_COLUMNS.join(', ')}, workspace_id, created_at, updated_at)
    VALUES (?, ${placeholders}, ?, ?, ?)
  `, [
    id,
    ...PLANNING_COLUMNS.map((col) => (merged as unknown as Record<string, unknown>)[col] ?? null),
    WORKSPACE_ID, now, now
  ])

  if (result.milestoneDates) {
    const milestoneRecords = buildMilestoneRecords(id, result.milestoneDates)
    for (const m of milestoneRecords) {
      await db.execute(`
        INSERT INTO import_order_planning_milestones
          (id, planning_id, milestone_type, estimated_date, calculated_date, real_date, status, notes, sort_order, workspace_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        randomUUID(), m.planning_id, m.milestone_type,
        m.estimated_date, m.calculated_date, m.real_date,
        m.status, m.notes, m.sort_order, WORKSPACE_ID, now, now
      ])
    }
  }

  return (await getPlanning(id))!
}

export async function updatePlanning(id: string, data: Partial<ImportOrderPlanning>): Promise<ImportOrderPlanning | null> {
  const db = getPowerSyncDb()
  const sets = ['updated_at = ?']
  const vals: unknown[] = [Date.now()]
  for (const key of PLANNING_COLUMNS) {
    if (key in data) { sets.push(`${key} = ?`); vals.push((data as Record<string, unknown>)[key]) }
  }
  vals.push(id)
  await db.execute(`UPDATE import_order_plannings SET ${sets.join(', ')} WHERE id = ?`, vals)
  return recalculatePlanning(id)
}

export async function deletePlanning(id: string): Promise<void> {
  await getPowerSyncDb().execute('DELETE FROM import_order_plannings WHERE id = ?', [id])
}

/** Recalcula fechas, riesgo, demanda y `calculated_date` de los hitos a partir del estado actual. */
export async function recalculatePlanning(id: string): Promise<ImportOrderPlanning | null> {
  const db = getPowerSyncDb()
  const planning = await getPlanning(id)
  if (!planning) return null

  const brand = planning.brand ?? null
  const result = calculatePlanning(planning, brand)

  await db.execute(`
    UPDATE import_order_plannings SET
      recommended_order_date = ?, approval_deadline_date = ?, estimated_reception_date = ?,
      total_lead_time_days = ?, risk_status = ?, demand_for_period = ?, desired_coverage_months = ?,
      updated_at = ?
    WHERE id = ?
  `, [
    result.recommended_order_date, result.approval_deadline_date, result.estimated_reception_date,
    result.total_lead_time_days, result.risk_status, result.demand_for_period, result.desired_coverage_months,
    Date.now(), id
  ])

  if (result.milestoneDates) {
    const now = Date.now()
    for (const [type, date] of Object.entries(result.milestoneDates)) {
      await db.execute(
        'UPDATE import_order_planning_milestones SET calculated_date = ?, updated_at = ? WHERE planning_id = ? AND milestone_type = ?',
        [date, now, id, type]
      )
    }
  }

  return getPlanning(id)
}

// ─── Hitos de programación ─────────────────────────────────────────────────────

export async function listMilestones(planningId: string): Promise<ImportOrderPlanningMilestone[]> {
  return getPowerSyncDb().getAll<ImportOrderPlanningMilestone>(
    'SELECT * FROM import_order_planning_milestones WHERE planning_id = ? ORDER BY sort_order ASC',
    [planningId]
  )
}

export async function updateMilestone(id: string, data: Partial<ImportOrderPlanningMilestone>): Promise<ImportOrderPlanningMilestone | null> {
  const db = getPowerSyncDb()
  const allowed = ['real_date', 'status', 'notes']
  const sets = ['updated_at = ?']
  const vals: unknown[] = [Date.now()]
  for (const key of allowed) {
    if (key in data) { sets.push(`${key} = ?`); vals.push((data as Record<string, unknown>)[key]) }
  }
  vals.push(id)
  await db.execute(`UPDATE import_order_planning_milestones SET ${sets.join(', ')} WHERE id = ?`, vals)
  return db.getOptional<ImportOrderPlanningMilestone>('SELECT * FROM import_order_planning_milestones WHERE id = ?', [id])
}

// ─── Reportes IA de programación ───────────────────────────────────────────────

export async function listPlanningAIReports(filters?: {
  reportType?: string
  brandId?: string
  supplierId?: string
}): Promise<ImportOrderPlanningAIReport[]> {
  let sql = 'SELECT * FROM import_order_planning_ai_reports'
  const conditions: string[] = []
  const params: unknown[] = []
  if (filters?.reportType) { conditions.push('report_type = ?'); params.push(filters.reportType) }
  if (filters?.brandId) { conditions.push('brand_id = ?'); params.push(filters.brandId) }
  if (filters?.supplierId) { conditions.push('supplier_id = ?'); params.push(filters.supplierId) }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ')
  sql += ' ORDER BY created_at DESC'
  return getPowerSyncDb().getAll<ImportOrderPlanningAIReport>(sql, params)
}

export async function getPlanningAIReport(id: string): Promise<ImportOrderPlanningAIReport | null> {
  return (await getPowerSyncDb().getOptional<ImportOrderPlanningAIReport>('SELECT * FROM import_order_planning_ai_reports WHERE id = ?', [id])) ?? null
}

export async function createPlanningAIReport(input: CreateImportOrderPlanningAIReportInput): Promise<ImportOrderPlanningAIReport> {
  const db = getPowerSyncDb()
  const id = randomUUID()
  const now = Date.now()
  await db.execute(`
    INSERT INTO import_order_planning_ai_reports
      (id, report_type, brand_id, supplier_id, period_start_date, period_end_date, summary, findings, recommendations, risks, generated_by, workspace_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id, input.report_type, input.brand_id, input.supplier_id,
    input.period_start_date, input.period_end_date,
    input.summary, input.findings, input.recommendations, input.risks,
    input.generated_by, WORKSPACE_ID, now, now
  ])
  return (await getPlanningAIReport(id))!
}

export async function deletePlanningAIReport(id: string): Promise<void> {
  await getPowerSyncDb().execute('DELETE FROM import_order_planning_ai_reports WHERE id = ?', [id])
}
