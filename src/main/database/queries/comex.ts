import { randomUUID } from 'crypto'
import { getDb } from '../db'
import type {
  ComexSupplier, ComexImport, ComexImportItem, ComexDocument,
  ComexLogisticsQuote, ComexPayment, ComexCustoms, ComexCostItem,
  ComexSupplierContact, ComexSupplierBankAccount, ComexFreightOperator,
  ComexFreightOperatorContact, ComexImportTributo, CreateComexImportTributoInput,
  ComexImportExtraCost, CreateComexImportExtraCostInput,
  ComexInalCert,
  CreateComexSupplierInput, CreateComexImportInput,
  CreateComexItemInput, CreateComexDocumentInput,
  CreateComexQuoteInput, CreateComexPaymentInput,
  UpsertComexCustomsInput, CreateComexCostInput,
  CreateComexSupplierContactInput, CreateComexSupplierBankAccountInput,
  CreateComexFreightOperatorInput, CreateComexFreightOperatorContactInput
} from '@shared/types'

// ─── Suppliers ────────────────────────────────────────────────────────────────

export function listSuppliers(): ComexSupplier[] {
  return getDb().prepare('SELECT * FROM comex_suppliers ORDER BY name ASC').all() as ComexSupplier[]
}

export function getSupplier(id: string): ComexSupplier | null {
  return getDb().prepare('SELECT * FROM comex_suppliers WHERE id = ?').get(id) as ComexSupplier | null
}

export function createSupplier(input: CreateComexSupplierInput): ComexSupplier {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()
  db.prepare(`
    INSERT INTO comex_suppliers
      (id, name, address, city, country, zip_code, tax_id, rex_number,
       contact_name, contact_email, contact_phone,
       brand, website, wechat, product_categories, payment_terms,
       incoterms_preferred, port_of_origin, lead_time_days,
       pickup_address, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
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
    (input as Partial<ComexSupplier>).pickup_address ?? '',
    input.notes ?? '',
    now, now
  )
  return db.prepare('SELECT * FROM comex_suppliers WHERE id = ?').get(id) as ComexSupplier
}

export function updateSupplier(id: string, data: Partial<ComexSupplier>): ComexSupplier | null {
  const db = getDb()
  const allowed = [
    'name','address','city','country','zip_code','tax_id','rex_number',
    'contact_name','contact_email','contact_phone',
    'brand','website','wechat','product_categories','payment_terms',
    'incoterms_preferred','port_of_origin','lead_time_days',
    'pickup_address','notes','logo_stored_name'
  ]
  const sets = ['updated_at = ?']
  const vals: unknown[] = [Date.now()]
  for (const key of allowed) {
    if (key in data) { sets.push(`${key} = ?`); vals.push((data as Record<string, unknown>)[key]) }
  }
  vals.push(id)
  db.prepare(`UPDATE comex_suppliers SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
  return db.prepare('SELECT * FROM comex_suppliers WHERE id = ?').get(id) as ComexSupplier | null
}

export function deleteSupplier(id: string): void {
  getDb().prepare('DELETE FROM comex_suppliers WHERE id = ?').run(id)
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
      updated_at: row._supplier_updated_at as number
    }
  }
  // Campos del JOIN con customs
  if (row._despacho_number) imp._despacho_number = row._despacho_number as string
  if (row._canal_despacho)  imp._canal_despacho  = row._canal_despacho  as string
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
    c.despacho_number AS _despacho_number,
    c.canal           AS _canal_despacho
  FROM comex_imports i
  LEFT JOIN comex_suppliers s ON s.id = i.supplier_id
  LEFT JOIN comex_import_customs c ON c.import_id = i.id
`

export function listImports(status?: string): ComexImport[] {
  const db = getDb()
  const rows = status
    ? db.prepare(`${IMPORT_SELECT} WHERE i.status = ? ORDER BY i.created_at DESC`).all(status) as Record<string, unknown>[]
    : db.prepare(`${IMPORT_SELECT} ORDER BY i.created_at DESC`).all() as Record<string, unknown>[]
  return rows.map(hydrateImport)
}

export function getImport(id: string): ComexImport | null {
  const row = getDb().prepare(`${IMPORT_SELECT} WHERE i.id = ?`).get(id) as Record<string, unknown> | undefined
  return row ? hydrateImport(row) : null
}

export function createImport(input: CreateComexImportInput): ComexImport {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()
  db.prepare(`
    INSERT INTO comex_imports
      (id, title, supplier_id, status, incoterm, origin_country, origin_port, currency,
       estimated_value, actual_value, order_date, payment_date, ship_date,
       arrival_date, eta_2, eta_3, eta_4,
       actual_ship_date, actual_arrival_date, tracking_number,
       customs_agent, drive_folder_id, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, input.title, input.supplier_id ?? null,
    input.status ?? 'planning', input.incoterm ?? 'FOB',
    input.origin_country ?? '', input.origin_port ?? '', input.currency ?? 'USD',
    input.estimated_value ?? null, input.actual_value ?? null,
    input.order_date ?? null, input.payment_date ?? null,
    input.ship_date ?? null, input.arrival_date ?? null,
    input.eta_2 ?? null, input.eta_3 ?? null, input.eta_4 ?? null,
    input.actual_ship_date ?? null, input.actual_arrival_date ?? null,
    input.tracking_number ?? '', input.customs_agent ?? '',
    input.drive_folder_id ?? null, input.notes ?? '', now, now
  )
  return getImport(id)!
}

export function updateImport(id: string, data: Partial<ComexImport>): ComexImport | null {
  const db = getDb()
  const allowed = [
    'title','supplier_id','status','incoterm','origin_country','origin_port','currency',
    'estimated_value','actual_value','order_date','payment_date','ship_date',
    'arrival_date','eta_2','eta_3','eta_4',
    'actual_ship_date','actual_arrival_date','tracking_number',
    'customs_agent','drive_folder_id','notes',
    'inal_required','inal_lc_status','inal_lc_task_scheduled','inal_lc_task_id','inal_lc_cert_folder_id',
    'tc_eur_usd', 'cost_pct',
    'despacho_folder_id','despacho_stored_name','despacho_original_name',
    'despacho_drive_file_id','despacho_drive_status'
  ]
  const sets = ['updated_at = ?']
  const vals: unknown[] = [Date.now()]
  for (const key of allowed) {
    if (key in data) { sets.push(`${key} = ?`); vals.push((data as Record<string, unknown>)[key]) }
  }
  vals.push(id)
  db.prepare(`UPDATE comex_imports SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
  return getImport(id)
}

export function deleteImport(id: string): void {
  getDb().prepare('DELETE FROM comex_imports WHERE id = ?').run(id)
}

// ─── Import Items ─────────────────────────────────────────────────────────────

export function listItems(importId: string): ComexImportItem[] {
  return getDb().prepare('SELECT * FROM comex_import_items WHERE import_id = ? ORDER BY created_at ASC').all(importId) as ComexImportItem[]
}

export function createItem(input: CreateComexItemInput): ComexImportItem {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()
  db.prepare(`
    INSERT INTO comex_import_items (id, import_id, description, hs_code, quantity, unit, unit_price, currency, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, input.import_id, input.description, input.hs_code ?? '', input.quantity, input.unit ?? 'u', input.unit_price, input.currency ?? 'USD', now)
  return db.prepare('SELECT * FROM comex_import_items WHERE id = ?').get(id) as ComexImportItem
}

export function deleteItem(id: string): void {
  getDb().prepare('DELETE FROM comex_import_items WHERE id = ?').run(id)
}

// ─── Documents ────────────────────────────────────────────────────────────────

export function listDocuments(importId: string): ComexDocument[] {
  return getDb().prepare('SELECT * FROM comex_documents WHERE import_id = ? ORDER BY created_at ASC').all(importId) as ComexDocument[]
}

export function getDocument(id: string): ComexDocument | null {
  return getDb().prepare('SELECT * FROM comex_documents WHERE id = ?').get(id) as ComexDocument | null
}

export function createDocument(input: CreateComexDocumentInput): ComexDocument {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()
  db.prepare(`
    INSERT INTO comex_documents
      (id, import_id, type, name, drive_file_id, status, notes, received_at,
       local_stored_name, size_bytes, mime_type, drive_status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, input.import_id, input.type ?? 'other', input.name,
    input.drive_file_id ?? null,
    input.status ?? 'pending', input.notes ?? '', input.received_at ?? null,
    (input as Partial<ComexDocument>).local_stored_name ?? null,
    (input as Partial<ComexDocument>).size_bytes ?? null,
    (input as Partial<ComexDocument>).mime_type ?? null,
    (input as Partial<ComexDocument>).drive_status ?? 'none',
    now
  )
  return db.prepare('SELECT * FROM comex_documents WHERE id = ?').get(id) as ComexDocument
}

export function updateDocument(id: string, data: Partial<ComexDocument>): void {
  const db = getDb()
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
  vals.push(id)
  db.prepare(`UPDATE comex_documents SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
}

export function deleteDocument(id: string): void {
  getDb().prepare('DELETE FROM comex_documents WHERE id = ?').run(id)
}

// ─── Logistics Quotes ─────────────────────────────────────────────────────────

export function listQuotes(importId: string): ComexLogisticsQuote[] {
  return getDb().prepare('SELECT * FROM comex_logistics_quotes WHERE import_id = ? ORDER BY created_at DESC').all(importId) as ComexLogisticsQuote[]
}

export function createQuote(input: CreateComexQuoteInput): ComexLogisticsQuote {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()
  db.prepare(`
    INSERT INTO comex_logistics_quotes
      (id, import_id, operator_id, operator_name, contact, cargo_type,
       quote_amount, currency, services_included, valid_until, status,
       rfq_sent_at, rfq_email_text, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
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
    now
  )
  return db.prepare('SELECT * FROM comex_logistics_quotes WHERE id = ?').get(id) as ComexLogisticsQuote
}

export function updateQuote(id: string, data: Partial<ComexLogisticsQuote>): void {
  const db = getDb()
  const allowed = [
    'operator_id','operator_name','contact','cargo_type',
    'quote_amount','currency','services_included','valid_until',
    'status','rfq_sent_at','rfq_email_text','notes'
  ]
  const sets: string[] = []
  const vals: unknown[] = []
  for (const key of allowed) {
    if (key in data) { sets.push(`${key} = ?`); vals.push((data as Record<string, unknown>)[key]) }
  }
  if (!sets.length) return
  vals.push(id)
  db.prepare(`UPDATE comex_logistics_quotes SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
}

export function deleteQuote(id: string): void {
  getDb().prepare('DELETE FROM comex_logistics_quotes WHERE id = ?').run(id)
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export function listPayments(importId: string): ComexPayment[] {
  return getDb().prepare('SELECT * FROM comex_payments WHERE import_id = ? ORDER BY created_at ASC').all(importId) as ComexPayment[]
}

export function createPayment(input: CreateComexPaymentInput): ComexPayment {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()
  db.prepare(`
    INSERT INTO comex_payments
      (id, import_id, amount, currency, exchange_rate, payment_date, method, bank, reference, status, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, input.import_id, input.amount, input.currency ?? 'USD',
         input.exchange_rate ?? null, input.payment_date ?? null,
         input.method ?? 'wire', input.bank ?? '', input.reference ?? '',
         input.status ?? 'pending', input.notes ?? '', now)
  return db.prepare('SELECT * FROM comex_payments WHERE id = ?').get(id) as ComexPayment
}

export function updatePayment(id: string, data: Partial<ComexPayment>): void {
  const db = getDb()
  const allowed = ['amount','currency','exchange_rate','payment_date','method','bank','reference','status','notes']
  const sets: string[] = []
  const vals: unknown[] = []
  for (const key of allowed) {
    if (key in data) { sets.push(`${key} = ?`); vals.push((data as Record<string, unknown>)[key]) }
  }
  if (!sets.length) return
  vals.push(id)
  db.prepare(`UPDATE comex_payments SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
}

export function deletePayment(id: string): void {
  getDb().prepare('DELETE FROM comex_payments WHERE id = ?').run(id)
}

// ─── Customs (1:1 per import) ─────────────────────────────────────────────────

export function getCustoms(importId: string): ComexCustoms | null {
  return getDb()
    .prepare('SELECT * FROM comex_import_customs WHERE import_id = ?')
    .get(importId) as ComexCustoms | null
}

export function upsertCustoms(importId: string, data: Partial<UpsertComexCustomsInput>): ComexCustoms {
  const db = getDb()
  const now = Date.now()
  const existing = db
    .prepare('SELECT id FROM comex_import_customs WHERE import_id = ?')
    .get(importId) as { id: string } | undefined

  if (existing) {
    // Update only provided fields
    const allowed = [
      'fob_currency','fob_invoice','fob_declared','dolar_aduana','dolar_naviera',
      'paridad_usd_eur','despacho_number','despachante','oficializacion_date',
      'sepaimpo_vencimiento','bl_number','naviera_ref','carrier','canal','etd',
      'peso_bruto_kg','volumen_m3','cant_pallets','mulc_date','fecha_pago_banco',
      'cierre_banco_date','listas_despachante_date','listas_oscar_andrea_date'
    ]
    const sets = ['updated_at = ?']
    const vals: unknown[] = [now]
    for (const key of allowed) {
      if (key in data) { sets.push(`${key} = ?`); vals.push((data as Record<string, unknown>)[key]) }
    }
    vals.push(existing.id)
    db.prepare(`UPDATE comex_import_customs SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
    return db.prepare('SELECT * FROM comex_import_customs WHERE id = ?').get(existing.id) as ComexCustoms
  } else {
    const id = randomUUID()
    db.prepare(`
      INSERT INTO comex_import_customs (
        id, import_id, fob_currency, fob_invoice, fob_declared,
        dolar_aduana, dolar_naviera, paridad_usd_eur,
        despacho_number, despachante, oficializacion_date, sepaimpo_vencimiento,
        bl_number, naviera_ref, carrier, etd,
        peso_bruto_kg, volumen_m3, cant_pallets,
        mulc_date, fecha_pago_banco, cierre_banco_date,
        listas_despachante_date, listas_oscar_andrea_date,
        created_at, updated_at
      ) VALUES (
        ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
      )
    `).run(
      id, importId,
      data.fob_currency ?? 'USD', data.fob_invoice ?? null, data.fob_declared ?? null,
      data.dolar_aduana ?? null, data.dolar_naviera ?? null, data.paridad_usd_eur ?? null,
      data.despacho_number ?? '', data.despachante ?? '', data.oficializacion_date ?? null,
      data.sepaimpo_vencimiento ?? null, data.bl_number ?? '', data.naviera_ref ?? '',
      data.carrier ?? '', data.etd ?? null, data.peso_bruto_kg ?? null,
      data.volumen_m3 ?? null, data.cant_pallets ?? null,
      data.mulc_date ?? null, data.fecha_pago_banco ?? null, data.cierre_banco_date ?? null,
      data.listas_despachante_date ?? null, data.listas_oscar_andrea_date ?? null,
      now, now
    )
    return db.prepare('SELECT * FROM comex_import_customs WHERE id = ?').get(id) as ComexCustoms
  }
}

// ─── Cost Items ───────────────────────────────────────────────────────────────

export function listCosts(importId: string): ComexCostItem[] {
  return getDb()
    .prepare('SELECT * FROM comex_import_costs WHERE import_id = ? ORDER BY sort_order ASC, created_at ASC')
    .all(importId) as ComexCostItem[]
}

export function createCost(input: CreateComexCostInput): ComexCostItem {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()
  db.prepare(`
    INSERT INTO comex_import_costs (id, import_id, category, concept, amount_pesos, amount_usd, sort_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, input.import_id, input.category ?? 'otros', input.concept,
    input.amount_pesos ?? 0, input.amount_usd ?? null,
    input.sort_order ?? 0, now
  )
  return db.prepare('SELECT * FROM comex_import_costs WHERE id = ?').get(id) as ComexCostItem
}

export function updateCost(id: string, data: Partial<ComexCostItem>): void {
  const db = getDb()
  const allowed = ['category','concept','amount_pesos','amount_usd','sort_order']
  const sets: string[] = []
  const vals: unknown[] = []
  for (const key of allowed) {
    if (key in data) { sets.push(`${key} = ?`); vals.push((data as Record<string, unknown>)[key]) }
  }
  if (!sets.length) return
  vals.push(id)
  db.prepare(`UPDATE comex_import_costs SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
}

export function deleteCost(id: string): void {
  getDb().prepare('DELETE FROM comex_import_costs WHERE id = ?').run(id)
}

// ─── Supplier Contacts ────────────────────────────────────────────────────────

export function listSupplierContacts(supplierId: string): ComexSupplierContact[] {
  return getDb()
    .prepare('SELECT * FROM comex_supplier_contacts WHERE supplier_id = ? ORDER BY sort_order ASC, created_at ASC')
    .all(supplierId) as ComexSupplierContact[]
}

export function createSupplierContact(input: CreateComexSupplierContactInput): ComexSupplierContact {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()
  db.prepare(`
    INSERT INTO comex_supplier_contacts
      (id, supplier_id, role, name, position, email, phone, whatsapp, notes, sort_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, input.supplier_id, input.role ?? 'commercial',
    input.name ?? '', input.position ?? '',
    input.email ?? '', input.phone ?? '', input.whatsapp ?? '',
    input.notes ?? '', input.sort_order ?? 0, now
  )
  return db.prepare('SELECT * FROM comex_supplier_contacts WHERE id = ?').get(id) as ComexSupplierContact
}

export function updateSupplierContact(id: string, data: Partial<ComexSupplierContact>): void {
  const db = getDb()
  const allowed = ['role','name','position','email','phone','whatsapp','notes','sort_order']
  const sets: string[] = []
  const vals: unknown[] = []
  for (const key of allowed) {
    if (key in data) { sets.push(`${key} = ?`); vals.push((data as Record<string,unknown>)[key]) }
  }
  if (!sets.length) return
  vals.push(id)
  db.prepare(`UPDATE comex_supplier_contacts SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
}

export function deleteSupplierContact(id: string): void {
  getDb().prepare('DELETE FROM comex_supplier_contacts WHERE id = ?').run(id)
}

// ─── Supplier Bank Accounts ───────────────────────────────────────────────────

export function listSupplierBankAccounts(supplierId: string): ComexSupplierBankAccount[] {
  return getDb()
    .prepare('SELECT * FROM comex_supplier_bank_accounts WHERE supplier_id = ? ORDER BY created_at ASC')
    .all(supplierId) as ComexSupplierBankAccount[]
}

export function createSupplierBankAccount(input: CreateComexSupplierBankAccountInput): ComexSupplierBankAccount {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()
  db.prepare(`
    INSERT INTO comex_supplier_bank_accounts
      (id, supplier_id, bank_name, beneficiary_name, account_number, swift_bic, iban, routing_number, currency, bank_address, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, input.supplier_id,
    input.bank_name ?? '', input.beneficiary_name ?? '',
    input.account_number ?? '', input.swift_bic ?? '',
    input.iban ?? '', input.routing_number ?? '',
    input.currency ?? 'USD', input.bank_address ?? '',
    input.notes ?? '', now
  )
  return db.prepare('SELECT * FROM comex_supplier_bank_accounts WHERE id = ?').get(id) as ComexSupplierBankAccount
}

export function updateSupplierBankAccount(id: string, data: Partial<ComexSupplierBankAccount>): void {
  const db = getDb()
  const allowed = ['bank_name','beneficiary_name','account_number','swift_bic','iban','routing_number','currency','bank_address','notes']
  const sets: string[] = []
  const vals: unknown[] = []
  for (const key of allowed) {
    if (key in data) { sets.push(`${key} = ?`); vals.push((data as Record<string,unknown>)[key]) }
  }
  if (!sets.length) return
  vals.push(id)
  db.prepare(`UPDATE comex_supplier_bank_accounts SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
}

export function deleteSupplierBankAccount(id: string): void {
  getDb().prepare('DELETE FROM comex_supplier_bank_accounts WHERE id = ?').run(id)
}

// ─── Freight Operators ────────────────────────────────────────────────────────

export function listFreightOperators(): ComexFreightOperator[] {
  return getDb()
    .prepare('SELECT * FROM comex_freight_operators ORDER BY name ASC')
    .all() as ComexFreightOperator[]
}

export function getFreightOperator(id: string): ComexFreightOperator | null {
  return getDb()
    .prepare('SELECT * FROM comex_freight_operators WHERE id = ?')
    .get(id) as ComexFreightOperator | null
}

export function createFreightOperator(input: CreateComexFreightOperatorInput): ComexFreightOperator {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()
  db.prepare(`
    INSERT INTO comex_freight_operators
      (id, name, company_type, contact_name, email, phone, whatsapp, services, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, input.name, input.company_type ?? 'agente',
    input.contact_name ?? '', input.email ?? '',
    input.phone ?? '', input.whatsapp ?? '',
    input.services ?? '', input.notes ?? '',
    now, now
  )
  return db.prepare('SELECT * FROM comex_freight_operators WHERE id = ?').get(id) as ComexFreightOperator
}

export function updateFreightOperator(id: string, data: Partial<ComexFreightOperator>): ComexFreightOperator | null {
  const db = getDb()
  const allowed = ['name','company_type','contact_name','email','phone','whatsapp','services','notes','logo_stored_name']
  const sets = ['updated_at = ?']
  const vals: unknown[] = [Date.now()]
  for (const key of allowed) {
    if (key in data) { sets.push(`${key} = ?`); vals.push((data as Record<string, unknown>)[key]) }
  }
  vals.push(id)
  db.prepare(`UPDATE comex_freight_operators SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
  return db.prepare('SELECT * FROM comex_freight_operators WHERE id = ?').get(id) as ComexFreightOperator | null
}

export function deleteFreightOperator(id: string): void {
  getDb().prepare('DELETE FROM comex_freight_operators WHERE id = ?').run(id)
}

// ─── Freight Operator Contacts ────────────────────────────────────────────────

export function listOperatorContacts(operatorId: string): ComexFreightOperatorContact[] {
  return getDb()
    .prepare('SELECT * FROM comex_freight_operator_contacts WHERE operator_id = ? ORDER BY sort_order ASC, created_at ASC')
    .all(operatorId) as ComexFreightOperatorContact[]
}

export function createOperatorContact(input: CreateComexFreightOperatorContactInput): ComexFreightOperatorContact {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()
  db.prepare(`
    INSERT INTO comex_freight_operator_contacts
      (id, operator_id, name, nickname, role, email, phone, sort_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, input.operator_id, input.name ?? '', input.nickname ?? '',
    input.role ?? '', input.email ?? '', input.phone ?? '', input.sort_order ?? 0, now
  )
  return db.prepare('SELECT * FROM comex_freight_operator_contacts WHERE id = ?').get(id) as ComexFreightOperatorContact
}

export function updateOperatorContact(id: string, data: Partial<ComexFreightOperatorContact>): void {
  const db = getDb()
  const allowed = ['name', 'nickname', 'role', 'email', 'phone', 'sort_order']
  const sets: string[] = []
  const vals: unknown[] = []
  for (const key of allowed) {
    if (key in data) { sets.push(`${key} = ?`); vals.push((data as Record<string, unknown>)[key]) }
  }
  if (!sets.length) return
  vals.push(id)
  db.prepare(`UPDATE comex_freight_operator_contacts SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
}

export function deleteOperatorContact(id: string): void {
  getDb().prepare('DELETE FROM comex_freight_operator_contacts WHERE id = ?').run(id)
}

// ─── Tributos del despacho ────────────────────────────────────────────────────

export function listTributos(importId: string): ComexImportTributo[] {
  return getDb()
    .prepare('SELECT * FROM comex_import_tributos WHERE import_id = ? ORDER BY sort_order ASC, created_at ASC')
    .all(importId) as ComexImportTributo[]
}

export function createTributo(input: CreateComexImportTributoInput): ComexImportTributo {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()
  db.prepare(`
    INSERT INTO comex_import_tributos (id, import_id, codigo, concepto, porcentaje, importe_usd, sort_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, input.import_id, input.codigo ?? '', input.concepto ?? '',
    input.porcentaje ?? null, input.importe_usd ?? 0, input.sort_order ?? 0, now)
  return db.prepare('SELECT * FROM comex_import_tributos WHERE id = ?').get(id) as ComexImportTributo
}

export function updateTributo(id: string, data: Partial<ComexImportTributo>): void {
  const db = getDb()
  const allowed = ['codigo', 'concepto', 'porcentaje', 'importe_usd', 'sort_order']
  const sets: string[] = []
  const vals: unknown[] = []
  for (const key of allowed) {
    if (key in data) { sets.push(`${key} = ?`); vals.push((data as Record<string, unknown>)[key]) }
  }
  if (!sets.length) return
  vals.push(id)
  db.prepare(`UPDATE comex_import_tributos SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
}

export function deleteTributo(id: string): void {
  getDb().prepare('DELETE FROM comex_import_tributos WHERE id = ?').run(id)
}

/** Reemplaza todos los tributos de una importación de una sola vez (usado por IA) */
export function upsertTributos(importId: string, tributos: Omit<CreateComexImportTributoInput, 'import_id'>[]): ComexImportTributo[] {
  const db = getDb()
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM comex_import_tributos WHERE import_id = ?').run(importId)
    const now = Date.now()
    for (let i = 0; i < tributos.length; i++) {
      const t = tributos[i]
      const id = randomUUID()
      db.prepare(`
        INSERT INTO comex_import_tributos (id, import_id, codigo, concepto, porcentaje, importe_usd, sort_order, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, importId, t.codigo ?? '', t.concepto ?? '', t.porcentaje ?? null, t.importe_usd ?? 0, i, now)
    }
  })
  tx()
  return listTributos(importId)
}

// ─── Extra costs ─────────────────────────────────────────────────────────────

/** Crea los 3 costos fijos por defecto al crear una importación */
export function createDefaultExtraCosts(importId: string): void {
  const defaults: Array<{ categoria: string; concepto: string; sort_order: number }> = [
    { categoria: 'flete_internacional', concepto: 'Flete internacional', sort_order: 0 },
    { categoria: 'flete_local',         concepto: 'Flete local',         sort_order: 1 },
    { categoria: 'despachante',         concepto: 'Despachante',         sort_order: 2 },
    { categoria: 'deposito_fiscal',     concepto: 'Depósito fiscal',     sort_order: 3 }
  ]
  const db = getDb()
  const now = Date.now()
  for (const d of defaults) {
    const id = randomUUID()
    db.prepare(`
      INSERT INTO comex_import_extra_costs
        (id, import_id, categoria, concepto, proveedor, nro_factura, fecha_factura,
         importe, moneda, stored_name, original_name, drive_file_id, drive_folder_id,
         drive_status, sort_order, created_at)
      VALUES (?, ?, ?, ?, '', '', NULL, 0, 'ARS', NULL, NULL, NULL, NULL, 'none', ?, ?)
    `).run(id, importId, d.categoria, d.concepto, d.sort_order, now)
  }
}

export function listExtraCosts(importId: string): ComexImportExtraCost[] {
  return getDb()
    .prepare('SELECT * FROM comex_import_extra_costs WHERE import_id = ? ORDER BY sort_order ASC, created_at ASC')
    .all(importId) as ComexImportExtraCost[]
}

export function getExtraCost(id: string): ComexImportExtraCost | null {
  return getDb().prepare('SELECT * FROM comex_import_extra_costs WHERE id = ?').get(id) as ComexImportExtraCost | null
}

export function createExtraCost(input: CreateComexImportExtraCostInput): ComexImportExtraCost {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()
  db.prepare(`
    INSERT INTO comex_import_extra_costs
      (id, import_id, categoria, concepto, proveedor, nro_factura, fecha_factura,
       importe, moneda, stored_name, original_name, drive_file_id, drive_folder_id,
       drive_status, sort_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, input.import_id, input.categoria ?? 'otro', input.concepto ?? '',
    input.proveedor ?? '', input.nro_factura ?? '', input.fecha_factura ?? null,
    input.importe ?? 0, input.moneda ?? 'ARS',
    null, null, null, null, 'none', input.sort_order ?? 0, now
  )
  return db.prepare('SELECT * FROM comex_import_extra_costs WHERE id = ?').get(id) as ComexImportExtraCost
}

export function updateExtraCost(id: string, data: Partial<ComexImportExtraCost>): void {
  const db = getDb()
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
  vals.push(id)
  db.prepare(`UPDATE comex_import_extra_costs SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
}

export function deleteExtraCost(id: string): void {
  getDb().prepare('DELETE FROM comex_import_extra_costs WHERE id = ?').run(id)
}

// ─── INAL Certificates ────────────────────────────────────────────────────────

export function listInalCerts(importId: string): ComexInalCert[] {
  return getDb()
    .prepare('SELECT * FROM comex_inal_certs WHERE import_id = ? ORDER BY created_at ASC')
    .all(importId) as ComexInalCert[]
}

export function createInalCert(
  importId: string,
  originalName: string,
  opts: { local_stored_name?: string; size_bytes?: number; mime_type?: string } = {}
): ComexInalCert {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()
  db.prepare(`
    INSERT INTO comex_inal_certs
      (id, import_id, original_name, local_stored_name, size_bytes, mime_type, drive_file_id, drive_status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, NULL, 'none', ?)
  `).run(id, importId, originalName, opts.local_stored_name ?? null, opts.size_bytes ?? null, opts.mime_type ?? null, now)
  return db.prepare('SELECT * FROM comex_inal_certs WHERE id = ?').get(id) as ComexInalCert
}

export function updateInalCert(id: string, data: Partial<ComexInalCert>): void {
  const db = getDb()
  const allowed = ['drive_file_id', 'drive_status', 'local_stored_name', 'size_bytes', 'mime_type']
  const sets: string[] = []
  const vals: unknown[] = []
  for (const key of allowed) {
    if (key in data) { sets.push(`${key} = ?`); vals.push((data as Record<string, unknown>)[key]) }
  }
  if (!sets.length) return
  vals.push(id)
  db.prepare(`UPDATE comex_inal_certs SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
}

export function deleteInalCert(id: string): void {
  getDb().prepare('DELETE FROM comex_inal_certs WHERE id = ?').run(id)
}

export function getInalCert(id: string): ComexInalCert | null {
  return getDb().prepare('SELECT * FROM comex_inal_certs WHERE id = ?').get(id) as ComexInalCert | null
}
