import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { getDb, getAttachmentsDir } from './db'
import { getSession } from '../services/auth.service'
import { PowerSyncDatabase } from '@powersync/node'
import {
  Schema,
  Table,
  column,
  UpdateType,
  type AbstractPowerSyncDatabase,
  type PowerSyncBackendConnector,
  type SyncStatus
} from '@powersync/common'
import type { PowerSyncStatusInfo } from '@shared/types'

const WORKSPACE_ID = 'd61a4071-1557-4f32-be5e-6443fb336bf5'

const projects = new Table(
  {
    name: column.text,
    color: column.text,
    created_at: column.integer,
    updated_at: column.integer,
    workspace_id: column.text
  },
  { indexes: { workspace: ['workspace_id'] } }
)

const tasks = new Table(
  {
    project_id: column.text,
    title: column.text,
    description: column.text,
    status: column.text,
    priority: column.integer,
    due_date: column.integer,
    due_time: column.text,
    completed_at: column.integer,
    created_at: column.integer,
    updated_at: column.integer,
    synced_at: column.integer,
    drive_file_id: column.text,
    workspace_id: column.text
  },
  { indexes: { workspace: ['workspace_id'], status: ['status'] } }
)

const task_dependencies = new Table(
  {
    task_id: column.text,
    depends_on_id: column.text,
    created_at: column.integer,
    workspace_id: column.text
  },
  { indexes: { workspace: ['workspace_id'] } }
)

const user_permissions = new Table(
  {
    user_id: column.text,
    module_key: column.text,
    submodule_key: column.text,
    level: column.text,
    created_at: column.integer,
    updated_at: column.integer,
    workspace_id: column.text
  },
  { indexes: { user: ['user_id'] } }
)

// ── Fase 3 (sync multi-dispositivo): Finanzas personales y de empresa ──────
// Mismo shape para finance_* y company_finance_* (14 tablas).

const financeAccountLikeColumns = {
  name: column.text,
  icon: column.text,
  color: column.text,
  is_default: column.integer,
  created_at: column.integer,
  updated_at: column.integer,
  workspace_id: column.text
}

const finance_accounts = new Table(financeAccountLikeColumns, { indexes: { workspace: ['workspace_id'] } })
const finance_categories = new Table(financeAccountLikeColumns, { indexes: { workspace: ['workspace_id'] } })
const finance_payment_methods = new Table(financeAccountLikeColumns, { indexes: { workspace: ['workspace_id'] } })
const company_finance_accounts = new Table(financeAccountLikeColumns, { indexes: { workspace: ['workspace_id'] } })
const company_finance_categories = new Table(financeAccountLikeColumns, { indexes: { workspace: ['workspace_id'] } })
const company_finance_payment_methods = new Table(financeAccountLikeColumns, { indexes: { workspace: ['workspace_id'] } })

const financeConceptColumns = {
  category_id: column.text,
  account_id: column.text,
  name: column.text,
  default_amount: column.real,
  expense_type: column.text,
  payment_method: column.text,
  recurrence: column.text,
  recurrence_month: column.integer,
  tracks_multiple_entries: column.integer,
  is_active: column.integer,
  notes: column.text,
  created_at: column.integer,
  updated_at: column.integer,
  workspace_id: column.text
}

const finance_concepts = new Table(financeConceptColumns, {
  indexes: { workspace: ['workspace_id'], category: ['category_id'], account: ['account_id'] }
})
const company_finance_concepts = new Table(financeConceptColumns, {
  indexes: { workspace: ['workspace_id'], category: ['category_id'], account: ['account_id'] }
})

const financeMovementColumns = {
  concept_id: column.text,
  month: column.integer,
  year: column.integer,
  amount_estimated: column.real,
  amount_actual: column.real,
  status: column.text,
  payment_method: column.text,
  payment_date: column.integer,
  due_date: column.integer,
  notes: column.text,
  created_at: column.integer,
  updated_at: column.integer,
  workspace_id: column.text
}

const finance_movements = new Table(financeMovementColumns, {
  indexes: { workspace: ['workspace_id'], concept: ['concept_id'], period: ['year', 'month'] }
})
const company_finance_movements = new Table(financeMovementColumns, {
  indexes: { workspace: ['workspace_id'], concept: ['concept_id'], period: ['year', 'month'] }
})

const financeMovementEntryColumns = {
  movement_id: column.text,
  amount: column.real,
  entry_date: column.integer,
  note: column.text,
  created_at: column.integer,
  updated_at: column.integer,
  workspace_id: column.text
}

const finance_movement_entries = new Table(financeMovementEntryColumns, {
  indexes: { workspace: ['workspace_id'], movement: ['movement_id'] }
})
const company_finance_movement_entries = new Table(financeMovementEntryColumns, {
  indexes: { workspace: ['workspace_id'], movement: ['movement_id'] }
})

const financeMonthInsightColumns = {
  month: column.integer,
  year: column.integer,
  notes: column.text,
  ai_analysis: column.text,
  ai_generated_at: column.integer,
  created_at: column.integer,
  updated_at: column.integer,
  workspace_id: column.text
}

const finance_month_insights = new Table(financeMonthInsightColumns, {
  indexes: { workspace: ['workspace_id'], period: ['year', 'month'] }
})
const company_finance_month_insights = new Table(financeMonthInsightColumns, {
  indexes: { workspace: ['workspace_id'], period: ['year', 'month'] }
})

// ── Fase 4 (sync multi-dispositivo): Comex, sub-dominio "maestros" ─────────
// Proveedores, operadores logísticos, gestores, despachantes y marcas.

const comex_suppliers = new Table(
  {
    name: column.text,
    country: column.text,
    contact_name: column.text,
    contact_email: column.text,
    contact_phone: column.text,
    website: column.text,
    payment_terms: column.text,
    notes: column.text,
    address: column.text,
    city: column.text,
    zip_code: column.text,
    tax_id: column.text,
    rex_number: column.text,
    wechat: column.text,
    product_categories: column.text,
    incoterms_preferred: column.text,
    port_of_origin: column.text,
    lead_time_days: column.integer,
    pickup_address: column.text,
    brand: column.text,
    logo_stored_name: column.text,
    logo_data: column.text,
    production_days: column.integer,
    preparation_days: column.integer,
    transit_days: column.integer,
    customs_days: column.integer,
    local_delivery_days: column.integer,
    moq: column.integer,
    non_operational_periods_json: column.text,
    reliability_notes: column.text,
    created_at: column.integer,
    updated_at: column.integer,
    workspace_id: column.text
  },
  { indexes: { workspace: ['workspace_id'] } }
)

const comex_supplier_contacts = new Table(
  {
    supplier_id: column.text,
    role: column.text,
    name: column.text,
    position: column.text,
    email: column.text,
    phone: column.text,
    whatsapp: column.text,
    notes: column.text,
    sort_order: column.integer,
    created_at: column.integer,
    updated_at: column.integer,
    workspace_id: column.text
  },
  { indexes: { workspace: ['workspace_id'], supplier: ['supplier_id'] } }
)

const comex_supplier_bank_accounts = new Table(
  {
    supplier_id: column.text,
    bank_name: column.text,
    beneficiary_name: column.text,
    account_number: column.text,
    swift_bic: column.text,
    iban: column.text,
    routing_number: column.text,
    currency: column.text,
    bank_address: column.text,
    notes: column.text,
    created_at: column.integer,
    updated_at: column.integer,
    workspace_id: column.text
  },
  { indexes: { workspace: ['workspace_id'], supplier: ['supplier_id'] } }
)

const comex_freight_operators = new Table(
  {
    name: column.text,
    company_type: column.text,
    contact_name: column.text,
    email: column.text,
    phone: column.text,
    whatsapp: column.text,
    services: column.text,
    notes: column.text,
    logo_stored_name: column.text,
    logo_data: column.text,
    created_at: column.integer,
    updated_at: column.integer,
    workspace_id: column.text
  },
  { indexes: { workspace: ['workspace_id'] } }
)

const comex_freight_operator_contacts = new Table(
  {
    operator_id: column.text,
    name: column.text,
    role: column.text,
    email: column.text,
    phone: column.text,
    nickname: column.text,
    sort_order: column.integer,
    created_at: column.integer,
    updated_at: column.integer,
    workspace_id: column.text
  },
  { indexes: { workspace: ['workspace_id'], operator: ['operator_id'] } }
)

const comex_gestores = new Table(
  {
    name: column.text,
    estudio: column.text,
    cuit: column.text,
    email: column.text,
    phone: column.text,
    whatsapp: column.text,
    especialidades: column.text,
    notas: column.text,
    website: column.text,
    direccion: column.text,
    phone_empresa: column.text,
    logo_stored_name: column.text,
    logo_data: column.text,
    created_at: column.integer,
    updated_at: column.integer,
    workspace_id: column.text
  },
  { indexes: { workspace: ['workspace_id'] } }
)

const comex_gestor_contacts = new Table(
  {
    gestor_id: column.text,
    name: column.text,
    role: column.text,
    email: column.text,
    phone: column.text,
    sort_order: column.integer,
    created_at: column.integer,
    updated_at: column.integer,
    workspace_id: column.text
  },
  { indexes: { workspace: ['workspace_id'], gestor: ['gestor_id'] } }
)

const comex_despachantes = new Table(
  {
    name: column.text,
    matricula: column.text,
    empresa: column.text,
    cuit: column.text,
    email: column.text,
    phone: column.text,
    whatsapp: column.text,
    notas: column.text,
    website: column.text,
    direccion: column.text,
    phone_empresa: column.text,
    logo_stored_name: column.text,
    logo_data: column.text,
    created_at: column.integer,
    updated_at: column.integer,
    workspace_id: column.text
  },
  { indexes: { workspace: ['workspace_id'] } }
)

const comex_despachante_contacts = new Table(
  {
    despachante_id: column.text,
    name: column.text,
    role: column.text,
    email: column.text,
    phone: column.text,
    sort_order: column.integer,
    created_at: column.integer,
    updated_at: column.integer,
    workspace_id: column.text
  },
  { indexes: { workspace: ['workspace_id'], despachante: ['despachante_id'] } }
)

const comex_brands = new Table(
  {
    name: column.text,
    category: column.text,
    primary_supplier_id: column.text,
    demand_annual: column.integer,
    demand_monthly_json: column.text,
    current_stock: column.integer,
    safety_stock: column.integer,
    purchase_frequency_days: column.integer,
    notes: column.text,
    logo_stored_name: column.text,
    logo_data: column.text,
    created_at: column.integer,
    updated_at: column.integer,
    workspace_id: column.text
  },
  { indexes: { workspace: ['workspace_id'], supplier: ['primary_supplier_id'] } }
)

const comex_imports = new Table(
  {
    title: column.text,
    supplier_id: column.text,
    status: column.text,
    incoterm: column.text,
    origin_country: column.text,
    currency: column.text,
    estimated_value: column.real,
    actual_value: column.real,
    order_date: column.integer,
    payment_date: column.integer,
    ship_date: column.integer,
    arrival_date: column.integer,
    actual_ship_date: column.integer,
    actual_arrival_date: column.integer,
    tracking_number: column.text,
    customs_agent: column.text,
    drive_folder_id: column.text,
    notes: column.text,
    created_at: column.integer,
    updated_at: column.integer,
    origin_port: column.text,
    eta_2: column.integer,
    eta_3: column.integer,
    eta_4: column.integer,
    inal_required: column.integer,
    inal_lc_status: column.text,
    inal_lc_task_scheduled: column.integer,
    inal_lc_cert_folder_id: column.text,
    inal_lc_task_id: column.text,
    despacho_folder_id: column.text,
    despacho_stored_name: column.text,
    despacho_original_name: column.text,
    despacho_drive_file_id: column.text,
    despacho_drive_status: column.text,
    tc_eur_ars: column.real,
    cost_pct: column.real,
    proformas_folder_id: column.text,
    facturas_folder_id: column.text,
    freight_operator_id: column.text,
    despachante: column.text,
    forwarder_ref_mail: column.text,
    bl_number: column.text,
    bl_folder_id: column.text,
    bl_stored_name: column.text,
    bl_original_name: column.text,
    bl_drive_file_id: column.text,
    bl_drive_status: column.text,
    bl_extracted_json: column.text,
    inal_drive_folder_id: column.text,
    inal_pl_ok: column.integer,
    inal_pl_stored_name: column.text,
    inal_pl_original_name: column.text,
    inal_pl_drive_file_id: column.text,
    inal_pl_drive_status: column.text,
    inal_xls_ok: column.integer,
    inal_xls_stored_name: column.text,
    inal_xls_original_name: column.text,
    inal_xls_drive_file_id: column.text,
    inal_xls_drive_status: column.text,
    inal_factura_stored_name: column.text,
    inal_factura_original_name: column.text,
    inal_factura_drive_file_id: column.text,
    inal_factura_drive_status: column.text,
    inal_bl_stored_name: column.text,
    inal_bl_original_name: column.text,
    inal_bl_drive_file_id: column.text,
    inal_bl_drive_status: column.text,
    gestor_id: column.text,
    aviso_arribo_date: column.integer,
    traslado_deposito_date: column.integer,
    oficializacion_import_date: column.integer,
    carga_deposito_date: column.integer,
    carga_deposito_time: column.text,
    pl_folder_id: column.text,
    pl_stored_name: column.text,
    pl_original_name: column.text,
    pl_drive_file_id: column.text,
    pl_drive_status: column.text,
    pl_extracted_json: column.text,
    carga_armada_date: column.integer,
    esperando_embarcar_date: column.integer,
    workspace_id: column.text
  },
  {
    indexes: {
      workspace: ['workspace_id'],
      supplier: ['supplier_id'],
      freight_operator: ['freight_operator_id'],
      gestor: ['gestor_id']
    }
  }
)

const comex_import_items = new Table(
  {
    import_id: column.text,
    description: column.text,
    hs_code: column.text,
    quantity: column.real,
    unit: column.text,
    unit_price: column.real,
    currency: column.text,
    created_at: column.integer,
    workspace_id: column.text,
    updated_at: column.integer
  },
  { indexes: { workspace: ['workspace_id'], import: ['import_id'] } }
)

const comex_documents = new Table(
  {
    import_id: column.text,
    type: column.text,
    name: column.text,
    drive_file_id: column.text,
    status: column.text,
    notes: column.text,
    received_at: column.integer,
    created_at: column.integer,
    local_stored_name: column.text,
    size_bytes: column.integer,
    mime_type: column.text,
    drive_status: column.text,
    workspace_id: column.text,
    updated_at: column.integer
  },
  { indexes: { workspace: ['workspace_id'], import: ['import_id'] } }
)

const comex_logistics_quotes = new Table(
  {
    import_id: column.text,
    operator_name: column.text,
    contact: column.text,
    quote_amount: column.real,
    currency: column.text,
    services_included: column.text,
    valid_until: column.integer,
    status: column.text,
    notes: column.text,
    created_at: column.integer,
    operator_id: column.text,
    cargo_type: column.text,
    rfq_sent_at: column.integer,
    rfq_email_text: column.text,
    workspace_id: column.text,
    updated_at: column.integer,
    quote_html: column.text,
    quote_received_at: column.integer,
  },
  { indexes: { workspace: ['workspace_id'], import: ['import_id'], operator: ['operator_id'] } }
)

const comex_quote_files = new Table(
  {
    quote_id: column.text,
    import_id: column.text,
    file_name: column.text,
    file_size: column.integer,
    drive_file_id: column.text,
    drive_folder_id: column.text,
    mime_type: column.text,
    workspace_id: column.text,
    created_at: column.integer,
    updated_at: column.integer,
  },
  { indexes: { workspace: ['workspace_id'], quote: ['quote_id'], import: ['import_id'] } }
)

const comex_payments = new Table(
  {
    import_id: column.text,
    amount: column.real,
    currency: column.text,
    exchange_rate: column.real,
    payment_date: column.integer,
    method: column.text,
    bank: column.text,
    reference: column.text,
    status: column.text,
    notes: column.text,
    created_at: column.integer,
    workspace_id: column.text,
    updated_at: column.integer
  },
  { indexes: { workspace: ['workspace_id'], import: ['import_id'] } }
)

const comex_import_customs = new Table(
  {
    import_id: column.text,
    fob_currency: column.text,
    fob_invoice: column.real,
    fob_declared: column.real,
    dolar_aduana: column.real,
    dolar_naviera: column.real,
    paridad_usd_eur: column.real,
    despacho_number: column.text,
    despachante: column.text,
    oficializacion_date: column.integer,
    sepaimpo_vencimiento: column.integer,
    bl_number: column.text,
    naviera_ref: column.text,
    carrier: column.text,
    etd: column.integer,
    peso_bruto_kg: column.real,
    volumen_m3: column.real,
    cant_pallets: column.integer,
    mulc_date: column.integer,
    fecha_pago_banco: column.integer,
    cierre_banco_date: column.integer,
    listas_despachante_date: column.integer,
    listas_oscar_andrea_date: column.integer,
    created_at: column.integer,
    updated_at: column.integer,
    canal: column.text,
    cant_bultos: column.integer,
    cant_cartons: column.integer,
    workspace_id: column.text
  },
  { indexes: { workspace: ['workspace_id'], import: ['import_id'] } }
)

const comex_import_costs = new Table(
  {
    import_id: column.text,
    category: column.text,
    concept: column.text,
    amount_pesos: column.real,
    amount_usd: column.real,
    sort_order: column.integer,
    created_at: column.integer,
    workspace_id: column.text,
    updated_at: column.integer
  },
  { indexes: { workspace: ['workspace_id'], import: ['import_id'] } }
)

const comex_inal_certs = new Table(
  {
    import_id: column.text,
    original_name: column.text,
    local_stored_name: column.text,
    size_bytes: column.integer,
    mime_type: column.text,
    drive_file_id: column.text,
    drive_status: column.text,
    created_at: column.integer,
    workspace_id: column.text,
    updated_at: column.integer
  },
  { indexes: { workspace: ['workspace_id'], import: ['import_id'] } }
)

const comex_import_tributos = new Table(
  {
    import_id: column.text,
    codigo: column.text,
    concepto: column.text,
    porcentaje: column.real,
    importe_usd: column.real,
    sort_order: column.integer,
    created_at: column.integer,
    workspace_id: column.text,
    updated_at: column.integer
  },
  { indexes: { workspace: ['workspace_id'], import: ['import_id'] } }
)

const comex_import_extra_costs = new Table(
  {
    import_id: column.text,
    categoria: column.text,
    concepto: column.text,
    proveedor: column.text,
    nro_factura: column.text,
    fecha_factura: column.integer,
    importe: column.real,
    moneda: column.text,
    stored_name: column.text,
    original_name: column.text,
    drive_file_id: column.text,
    drive_folder_id: column.text,
    drive_status: column.text,
    sort_order: column.integer,
    created_at: column.integer,
    cae: column.text,
    referencia_despacho: column.text,
    importe_iva: column.real,
    importe_total: column.real,
    items_json: column.text,
    tipo_cambio: column.real,
    bl_referencia: column.text,
    importe_ars: column.real,
    percepciones: column.real,
    fecha_ingreso: column.text,
    fecha_egreso: column.text,
    nro_contenedor: column.text,
    canal_deposito: column.text,
    percepcion_caba: column.real,
    percepcion_bsas: column.real,
    workspace_id: column.text,
    updated_at: column.integer
  },
  { indexes: { workspace: ['workspace_id'], import: ['import_id'] } }
)

const comex_proformas = new Table(
  {
    import_id: column.text,
    numero: column.integer,
    fecha_proforma: column.text,
    importe: column.real,
    moneda: column.text,
    nro_proforma: column.text,
    descripcion: column.text,
    incluir_en_total: column.integer,
    stored_name: column.text,
    original_name: column.text,
    drive_file_id: column.text,
    drive_folder_id: column.text,
    drive_status: column.text,
    created_at: column.integer,
    tipo: column.text,
    workspace_id: column.text,
    updated_at: column.integer
  },
  { indexes: { workspace: ['workspace_id'], import: ['import_id'] } }
)

const import_order_plannings = new Table(
  {
    brand_id: column.text,
    supplier_id: column.text,
    country: column.text,
    responsible_user_id: column.text,
    planning_type: column.text,
    status: column.text,
    risk_status: column.text,
    priority: column.text,
    target_coverage_start_date: column.integer,
    target_coverage_end_date: column.integer,
    target_commercial_availability_date: column.integer,
    recommended_order_date: column.integer,
    approval_deadline_date: column.integer,
    estimated_reception_date: column.integer,
    demand_annual_estimated: column.integer,
    demand_monthly_estimated: column.integer,
    demand_for_period: column.integer,
    current_stock: column.integer,
    safety_stock: column.integer,
    desired_coverage_months: column.real,
    internal_approval_days: column.integer,
    supplier_preparation_days: column.integer,
    production_days: column.integer,
    inspection_days: column.integer,
    shipping_days: column.integer,
    customs_days: column.integer,
    local_delivery_days: column.integer,
    safety_days: column.integer,
    total_lead_time_days: column.integer,
    ai_recommendation_summary: column.text,
    ai_risk_explanation: column.text,
    notes: column.text,
    linked_import_id: column.text,
    created_at: column.integer,
    updated_at: column.integer,
    workspace_id: column.text
  },
  { indexes: { workspace: ['workspace_id'], brand: ['brand_id'], supplier: ['supplier_id'], status: ['status'] } }
)

const import_order_planning_milestones = new Table(
  {
    planning_id: column.text,
    milestone_type: column.text,
    estimated_date: column.integer,
    calculated_date: column.integer,
    real_date: column.integer,
    status: column.text,
    notes: column.text,
    sort_order: column.integer,
    created_at: column.integer,
    updated_at: column.integer,
    workspace_id: column.text
  },
  { indexes: { workspace: ['workspace_id'], planning: ['planning_id'] } }
)

const import_order_planning_ai_reports = new Table(
  {
    report_type: column.text,
    brand_id: column.text,
    supplier_id: column.text,
    period_start_date: column.integer,
    period_end_date: column.integer,
    summary: column.text,
    findings: column.text,
    recommendations: column.text,
    risks: column.text,
    generated_by: column.text,
    created_at: column.integer,
    updated_at: column.integer,
    workspace_id: column.text
  },
  { indexes: { workspace: ['workspace_id'], brand: ['brand_id'] } }
)

const calendar_event_links = new Table(
  {
    owner_user_id: column.text,
    source_module: column.text,
    source_type: column.text,
    source_event_id: column.text,
    google_calendar_id: column.text,
    google_event_id: column.text,
    title: column.text,
    created_at: column.integer,
    updated_at: column.integer,
    workspace_id: column.text
  },
  { indexes: { workspace: ['workspace_id'], source: ['source_module', 'source_event_id'] } }
)

// ── Módulo Presupuestos ───────────────────────────────────────────────────────

const quote_companies = new Table(
  {
    name: column.text,
    industry: column.text,
    website: column.text,
    notes: column.text,
    created_at: column.integer,
    updated_at: column.integer,
    workspace_id: column.text
  },
  { indexes: { workspace: ['workspace_id'] } }
)

const quote_contacts = new Table(
  {
    company_id: column.text,
    name: column.text,
    email: column.text,
    phone: column.text,
    role: column.text,
    created_at: column.integer,
    updated_at: column.integer,
    workspace_id: column.text
  },
  { indexes: { workspace: ['workspace_id'], company: ['company_id'] } }
)

const quotes = new Table(
  {
    title: column.text,
    status: column.text,
    priority: column.text,
    channel: column.text,
    assigned_to: column.text,
    company_id: column.text,
    contact_id: column.text,
    estimated_value: column.real,
    won_value: column.real,
    lost_reason: column.text,
    next_follow_up_at: column.integer,
    sla_due_at: column.integer,
    notes: column.text,
    created_at: column.integer,
    updated_at: column.integer,
    workspace_id: column.text
  },
  {
    indexes: {
      workspace: ['workspace_id'],
      status: ['status'],
      assigned: ['assigned_to'],
      company: ['company_id'],
      follow_up: ['next_follow_up_at']
    }
  }
)

const quote_activities = new Table(
  {
    quote_id: column.text,
    user_id: column.text,
    type: column.text,
    payload: column.text,
    created_at: column.integer,
    workspace_id: column.text
  },
  { indexes: { workspace: ['workspace_id'], quote: ['quote_id'] } }
)

export const AppSchema = new Schema({
  projects,
  tasks,
  task_dependencies,
  user_permissions,
  finance_accounts,
  finance_categories,
  finance_payment_methods,
  finance_concepts,
  finance_movements,
  finance_movement_entries,
  finance_month_insights,
  company_finance_accounts,
  company_finance_categories,
  company_finance_payment_methods,
  company_finance_concepts,
  company_finance_movements,
  company_finance_movement_entries,
  company_finance_month_insights,
  comex_suppliers,
  comex_supplier_contacts,
  comex_supplier_bank_accounts,
  comex_freight_operators,
  comex_freight_operator_contacts,
  comex_gestores,
  comex_gestor_contacts,
  comex_despachantes,
  comex_despachante_contacts,
  comex_brands,
  comex_imports,
  comex_import_items,
  comex_documents,
  comex_logistics_quotes,
  comex_quote_files,
  comex_payments,
  comex_import_customs,
  comex_import_costs,
  comex_inal_certs,
  comex_import_tributos,
  comex_import_extra_costs,
  comex_proformas,
  import_order_plannings,
  import_order_planning_milestones,
  import_order_planning_ai_reports,
  calendar_event_links,
  quote_companies,
  quote_contacts,
  quotes,
  quote_activities
})

/**
 * Lee la configuración de PowerSync/Supabase de .env.local en la raíz del proyecto
 * (en desarrollo) o junto al ejecutable instalado (en producción).
 */
export function readEnvLocal(): Record<string, string> {
  // En desarrollo, app.getAppPath() apunta a la raíz del proyecto (donde
  // vive .env.local). En la versión empaquetada, app.getAppPath() apunta
  // dentro de app.asar (solo lectura), así que buscamos .env.local al lado
  // del ejecutable instalado para poder configurarlo por máquina sin
  // recompilar.
  const baseDir = app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath()
  const envPath = path.join(baseDir, '.env.local')
  const env: Record<string, string> = {}
  if (!fs.existsSync(envPath)) return env

  const content = fs.readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m) env[m[1]] = m[2].trim()
  }
  return env
}

function base64url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Firma un JWT de corta duración (RS256) para autenticar contra PowerSync,
 * usando la clave privada propia (POWERSYNC_JWT_PRIVATE_KEY_B64). La clave
 * pública correspondiente está configurada como JWKS estático en la
 * instancia de PowerSync. Se genera un token nuevo en cada conexión, así que
 * no hay que regenerarlo manualmente cada 12hs.
 */
function signPowerSyncJwt(env: Record<string, string>, endpoint: string, sub: string): string {
  const privateKeyPem = Buffer.from(env.POWERSYNC_JWT_PRIVATE_KEY_B64, 'base64').toString('utf-8')
  const kid = env.POWERSYNC_JWT_KID
  const privateKey = crypto.createPrivateKey(privateKeyPem)

  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT', kid }
  const payload = { sub, aud: endpoint, iat: now, exp: now + 86400 }

  const headerB64 = base64url(Buffer.from(JSON.stringify(header)))
  const payloadB64 = base64url(Buffer.from(JSON.stringify(payload)))
  const signingInput = `${headerB64}.${payloadB64}`
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput), privateKey)

  return `${signingInput}.${base64url(signature)}`
}

class ProductionTokenConnector implements PowerSyncBackendConnector {
  constructor(private endpoint: string) {}

  async fetchCredentials() {
    const env = readEnvLocal()
    const session = await getSession()
    if (!session) throw new Error('[PowerSync] Sin sesión de usuario autenticado')
    const token = signPowerSyncJwt(env, this.endpoint, session.userId)
    return { endpoint: this.endpoint, token }
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction()
    if (!transaction) return

    const env = readEnvLocal()
    const baseUrl = `${env.SUPABASE_URL}/rest/v1`
    const headers = {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    }

    for (const op of transaction.crud) {
      const url = `${baseUrl}/${op.table}?id=eq.${op.id}`
      let res: Response

      switch (op.op) {
        case UpdateType.PUT: {
          res = await fetch(`${baseUrl}/${op.table}`, {
            method: 'POST',
            headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify({ ...op.opData, id: op.id })
          })
          if (!res.ok && res.status === 404) {
            const body = await res.text()
            if (body.includes('PGRST205')) {
              // Table doesn't exist in Supabase yet — skip to unblock the queue.
              console.warn(`[PowerSync] PUT ${op.table}/${op.id}: tabla no existe en Supabase (PGRST205), omitiendo`)
              res = new Response(null, { status: 200 })
            } else {
              throw new Error(`[PowerSync] PUT ${op.table}/${op.id} -> 404 ${body}`)
            }
          }
          break
        }
        case UpdateType.PATCH: {
          let patchData = (op.opData ?? {}) as Record<string, unknown>
          res = await fetch(url, {
            method: 'PATCH',
            headers: { ...headers, Prefer: 'return=minimal' },
            body: JSON.stringify(patchData)
          })
          // PostgREST schema cache may not know newly added columns yet.
          // Loop: strip each unknown column reported by PGRST204 until the request succeeds.
          while (!res.ok && res.status === 400) {
            const body = await res.text()
            const m = body.match(/Could not find the '(\w+)' column/)
            if (!m) throw new Error(`[PowerSync] ${op.op} ${op.table}/${op.id} -> 400 ${body}`)
            patchData = Object.fromEntries(Object.entries(patchData).filter(([k]) => k !== m[1]))
            if (Object.keys(patchData).length === 0) { res = new Response(null, { status: 200 }); break }
            res = await fetch(url, {
              method: 'PATCH',
              headers: { ...headers, Prefer: 'return=minimal' },
              body: JSON.stringify(patchData)
            })
          }
          break
        }
        case UpdateType.DELETE:
          res = await fetch(url, { method: 'DELETE', headers: { ...headers, Prefer: 'return=minimal' } })
          break
      }

      if (!res.ok) {
        throw new Error(`[PowerSync] ${op.op} ${op.table}/${op.id} -> ${res.status} ${await res.text()}`)
      }
    }

    await transaction.complete()
  }
}

/**
 * Motivo por el que la conexión a PowerSync ni siquiera se intentó (config
 * faltante en .env.local, o sin sesión de usuario autenticado). Se expone vía
 * `getPowerSyncStatus()` para que la UI pueda mostrar un diagnóstico claro
 * (p. ej. "Falta .env.local") en lugar de quedarse en "Sin conexión" sin más
 * explicación.
 */
let _configError: string | null = null

/** Texto del último error de subida/descarga de PowerSync, para diagnóstico en la UI. */
let _lastErrorMessage: string | null = null

let _psDb: PowerSyncDatabase | null = null

export function getPowerSyncDb(): PowerSyncDatabase {
  if (_psDb) return _psDb

  const userDataPath = app.getPath('userData')
  const dbDir = path.join(userDataPath, 'flowtask')
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })

  _psDb = new PowerSyncDatabase({
    schema: AppSchema,
    database: {
      dbFilename: 'powersync.db',
      dbLocation: dbDir
    }
  })

  return _psDb
}

/**
 * Fase 1 (sync multi-dispositivo): copia única de los datos existentes de
 * projects/tasks/task_dependencies desde flowtask.db hacia powersync.db, para
 * que PowerSync los suba a Supabase. Es idempotente: si powersync.db ya tiene
 * proyectos o tareas, no hace nada.
 */
async function migrateLegacyTaskData(psDb: PowerSyncDatabase): Promise<void> {
  const counts = await psDb.get<{ projects: number; tasks: number }>(
    `SELECT (SELECT COUNT(*) FROM projects) as projects, (SELECT COUNT(*) FROM tasks) as tasks`
  )
  if (counts.projects > 0 || counts.tasks > 0) return

  const flowDb = getDb()
  const projects = flowDb.prepare('SELECT * FROM projects').all() as Record<string, unknown>[]
  const tasks = flowDb.prepare('SELECT * FROM tasks').all() as Record<string, unknown>[]
  const deps = flowDb.prepare('SELECT * FROM task_dependencies').all() as Record<string, unknown>[]

  if (projects.length === 0 && tasks.length === 0) return

  console.log(
    `[PowerSync] Migrando datos existentes: ${projects.length} proyectos, ${tasks.length} tareas, ${deps.length} dependencias`
  )

  for (const p of projects) {
    await psDb.execute(
      `INSERT OR IGNORE INTO projects (id, name, color, created_at, updated_at, workspace_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [p.id, p.name, p.color, p.created_at, p.updated_at, p.workspace_id]
    )
  }

  for (const t of tasks) {
    await psDb.execute(
      `INSERT OR IGNORE INTO tasks
         (id, project_id, title, description, status, priority, due_date, due_time, completed_at, created_at, updated_at, synced_at, drive_file_id, workspace_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        t.id, t.project_id, t.title, t.description, t.status, t.priority,
        t.due_date, t.due_time, t.completed_at, t.created_at, t.updated_at,
        t.synced_at, t.drive_file_id, t.workspace_id
      ]
    )
  }

  for (const d of deps) {
    await psDb.execute(
      `INSERT OR IGNORE INTO task_dependencies (id, task_id, depends_on_id, created_at, workspace_id)
       VALUES (?, ?, ?, ?, ?)`,
      [d.id, d.task_id, d.depends_on_id, d.created_at, d.workspace_id]
    )
  }

  console.log('[PowerSync] Migración de datos existentes completada')
}

/**
 * Fase 6 (auth + permisos): copia única de los permisos seedeados en
 * flowtask.db hacia powersync.db, para que PowerSync los suba a Supabase.
 * Idempotente: si powersync.db ya tiene filas en user_permissions, no hace
 * nada.
 */
async function migrateUserPermissions(psDb: PowerSyncDatabase): Promise<void> {
  const { count } = await psDb.get<{ count: number }>(
    `SELECT COUNT(*) as count FROM user_permissions`
  )
  if (count > 0) return

  const flowDb = getDb()
  const rows = flowDb.prepare('SELECT * FROM user_permissions').all() as Record<string, unknown>[]
  if (rows.length === 0) return

  console.log(`[PowerSync] Migrando ${rows.length} permisos de usuario existentes`)

  for (const r of rows) {
    await psDb.execute(
      `INSERT OR IGNORE INTO user_permissions (id, user_id, module_key, submodule_key, level, created_at, updated_at, workspace_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [r.id, r.user_id, r.module_key, r.submodule_key, r.level, r.created_at, r.updated_at, r.workspace_id]
    )
  }
}

/**
 * Fase 3 (sync multi-dispositivo): copia única de los datos existentes de las
 * 14 tablas de Finanzas Personales y Finanzas Empresa desde flowtask.db hacia
 * powersync.db. Idempotente por tabla: si una tabla ya tiene filas en
 * powersync.db, se omite (puede haber pasado por una conexión anterior o por
 * sync remoto si ya hay otro dispositivo).
 */
const FINANCE_TABLES = [
  'finance_accounts',
  'finance_categories',
  'finance_payment_methods',
  'finance_concepts',
  'finance_movements',
  'finance_movement_entries',
  'finance_month_insights'
  // company_finance_* se restauran via restoreCompanyFinanceLocalCache (escritura
  // directa a ps_data__) porque el servidor PowerSync no tiene sync-rules para
  // ellas — si se encolaran via ps_crud el servidor respondería con 0 filas y
  // borraría ps_data__ en la reconciliación.
]

async function migrateLegacyFinanceData(psDb: PowerSyncDatabase): Promise<void> {
  await migrateLegacyTableData(psDb, FINANCE_TABLES)
}

/**
 * Fase 4 (sync multi-dispositivo): copia única de los datos existentes de las
 * 10 tablas "maestros" de Comex (proveedores, operadores logísticos,
 * gestores, despachantes, marcas y sus contactos/cuentas) desde flowtask.db
 * hacia powersync.db.
 */
const COMEX_MAESTROS_TABLES = [
  'comex_suppliers',
  'comex_supplier_contacts',
  'comex_supplier_bank_accounts',
  'comex_freight_operators',
  'comex_freight_operator_contacts',
  'comex_gestores',
  'comex_gestor_contacts',
  'comex_despachantes',
  'comex_despachante_contacts',
  'comex_brands'
]

async function migrateLegacyComexMaestrosData(psDb: PowerSyncDatabase): Promise<void> {
  await migrateLegacyTableData(psDb, COMEX_MAESTROS_TABLES)
}

/**
 * Fase 4.2 (sync multi-dispositivo): copia única de los datos existentes de
 * las 11 tablas de "importaciones" de Comex (imports y sus tablas
 * relacionadas: items, documentos, cotizaciones logísticas, pagos, aduana,
 * costos, certificados INAL, tributos, costos extra, proformas) desde
 * flowtask.db hacia powersync.db.
 */
const COMEX_IMPORTS_TABLES = [
  'comex_imports',
  'comex_import_items',
  'comex_documents',
  'comex_logistics_quotes',
  'comex_quote_files',
  'comex_payments',
  'comex_import_customs',
  'comex_import_costs',
  'comex_inal_certs',
  'comex_import_tributos',
  'comex_import_extra_costs',
  'comex_proformas'
]

async function migrateLegacyComexImportsData(psDb: PowerSyncDatabase): Promise<void> {
  await migrateLegacyTableData(psDb, COMEX_IMPORTS_TABLES)
}

/**
 * Fase 4.3 (sync multi-dispositivo): copia única de los datos existentes de
 * las 3 tablas de "Programación de Pedidos" (plannings, hitos y reportes IA)
 * desde flowtask.db hacia powersync.db.
 */
const COMEX_PLANNINGS_TABLES = [
  'import_order_plannings',
  'import_order_planning_milestones',
  'import_order_planning_ai_reports'
]

async function migrateLegacyComexPlanningsData(psDb: PowerSyncDatabase): Promise<void> {
  await migrateLegacyTableData(psDb, COMEX_PLANNINGS_TABLES)
}

/**
 * Restaura los datos de Comex directamente en las tablas ps_data__ de
 * PowerSync, sin pasar por la cola de sincronización (ps_crud).
 *
 * Por qué es necesario: las tablas Comex no están en los sync-rules del
 * servidor PowerSync (solo hay reglas para tasks, finance y user_permissions).
 * Los INSERT vía psDb.execute() siguen el camino normal → ps_crud → upload →
 * Supabase, pero nunca regresan al cliente porque el servidor no los envía de
 * vuelta. Al escribir directamente en ps_data__<tabla> simulamos lo que haría
 * un sync exitoso del servidor; PowerSync no sobrescribirá estas filas porque
 * no tiene sync-rules definidos para Comex y por tanto nunca emite operaciones
 * de borrado para esas tablas.
 *
 * Idempotente: omite las tablas que ya tienen filas en ps_data__.
 */
export async function restoreComexLocalCache(psDb?: PowerSyncDatabase): Promise<void> {
  psDb = psDb ?? getPowerSyncDb()
  const allTables = [...COMEX_MAESTROS_TABLES, ...COMEX_IMPORTS_TABLES, ...COMEX_PLANNINGS_TABLES]
  await migrateLegacyTableData(psDb, allTables)
}

/**
 * Restaura los datos de finanzas empresa directamente en las tablas ps_data__
 * de PowerSync, sin pasar por la cola de sincronización (ps_crud).
 *
 * Por qué es necesario: los sync-rules del servidor PowerSync solo incluyen
 * las tablas de finanzas personales (finance_*). Las tablas company_finance_*
 * se suben correctamente vía ps_crud → Supabase, pero el servidor no las envía
 * de vuelta porque no hay sync-rules definidos para ellas. Al escribir
 * directamente en ps_data__<tabla> simulamos lo que haría un sync exitoso;
 * como el servidor no emite operaciones de borrado para estas tablas, los
 * datos persisten entre sesiones.
 *
 * Idempotente: omite las tablas que ya tienen filas en ps_data__.
 */
export async function restoreCompanyFinanceLocalCache(psDb?: PowerSyncDatabase): Promise<void> {
  psDb = psDb ?? getPowerSyncDb()
  await migrateLegacyTableData(psDb, [
    'company_finance_accounts',
    'company_finance_categories',
    'company_finance_payment_methods',
    'company_finance_concepts',
    'company_finance_movements',
    'company_finance_movement_entries',
    'company_finance_month_insights'
  ])
}

/**
 * Copia única (idempotente por tabla) de los datos existentes de
 * flowtask.db hacia powersync.db, para que PowerSync los suba a Supabase.
 * Si una tabla ya tiene filas en powersync.db, se omite (puede haber pasado
 * por una conexión anterior o por sync remoto si ya hay otro dispositivo).
 */
async function migrateLegacyTableData(psDb: PowerSyncDatabase, tables: string[]): Promise<void> {
  const flowDb = getDb()

  for (const table of tables) {
    const { count } = await psDb.get<{ count: number }>(`SELECT COUNT(*) as count FROM ${table}`)
    if (count > 0) continue

    const rows = flowDb.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[]
    if (rows.length === 0) continue

    console.log(`[PowerSync] Migrando ${rows.length} filas de ${table}`)

    const columns = Object.keys(rows[0])
    const placeholders = columns.map(() => '?').join(', ')
    const sql = `INSERT OR IGNORE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`

    for (const row of rows) {
      await psDb.execute(sql, columns.map((c) => row[c]))
    }
  }
}

/**
 * Fase 4.2.6 (fix recurrente): algunas filas viejas de comex_import_extra_costs
 * tienen el string literal "null" en columnas double precision
 * (percepcion_caba, percepcion_bsas, importe_iva) en lugar de un número, lo
 * que provoca un error 22P02 de Postgres al subir el cambio a Supabase y
 * bloquea toda la cola de sync. Esto corrige el dato de origen en
 * flowtask.db, el espejo local en powersync.db (vía la vista de PowerSync,
 * lo que además encola la operación correcta) y, si quedó una operación
 * pendiente en ps_crud con el valor "null", la corrige in-place para
 * desbloquear la cola.
 */
// Tablas que alguna vez se insertaron sin workspace_id (quedó NULL → Supabase lo rechaza)
const TABLES_MISSING_WORKSPACE_ID = [
  'import_order_plannings',
  'import_order_planning_milestones',
  'import_order_planning_ai_reports',
]

async function fixNullWorkspaceIds(psDb: PowerSyncDatabase): Promise<void> {
  const flowDb = getDb()
  for (const table of TABLES_MISSING_WORKSPACE_ID) {
    try {
      // flowtask.db
      const affected = flowDb
        .prepare(`SELECT id FROM ${table} WHERE workspace_id IS NULL`)
        .all() as { id: string }[]
      for (const { id } of affected) {
        flowDb.prepare(`UPDATE ${table} SET workspace_id = ? WHERE id = ?`).run(WORKSPACE_ID, id)
        await psDb.execute(`UPDATE ${table} SET workspace_id = ? WHERE id = ?`, [WORKSPACE_ID, id])
        console.log(`[PowerSync] Fix workspace_id en ${table}:`, id)
      }
    } catch { /* tabla puede no existir en instancias viejas */ }
  }

  // Corregir también entradas pendientes en ps_crud
  const crudRows = await psDb.getAll<{ id: number; data: string }>('SELECT id, data FROM ps_crud')
  for (const row of crudRows) {
    let parsed: { type?: string; data?: Record<string, unknown> }
    try { parsed = JSON.parse(row.data) } catch { continue }
    if (!TABLES_MISSING_WORKSPACE_ID.includes(parsed.type ?? '')) continue
    if (!parsed.data || parsed.data['workspace_id']) continue
    parsed.data['workspace_id'] = WORKSPACE_ID
    await psDb.execute('UPDATE ps_crud SET data = ? WHERE id = ?', [JSON.stringify(parsed), row.id])
    console.log('[PowerSync] Fix workspace_id en ps_crud para', parsed.type)
  }
}

// Columnas REAL/double en comex_import_extra_costs que pueden tener el string "null"
const EXTRA_COST_DOUBLE_COLS = ['percepcion_caba', 'percepcion_bsas', 'importe_iva', 'importe', 'amount']

async function fixLegacyNullDoubleStrings(psDb: PowerSyncDatabase): Promise<void> {
  const flowDb = getDb()

  // 1. Corregir en flowtask.db y powersync.db todas las filas afectadas (no solo IDs hardcodeados)
  for (const col of EXTRA_COST_DOUBLE_COLS) {
    try {
      const affected = flowDb
        .prepare(`SELECT id FROM comex_import_extra_costs WHERE ${col} = 'null'`)
        .all() as { id: string }[]
      for (const { id } of affected) {
        flowDb.prepare(`UPDATE comex_import_extra_costs SET ${col} = 0 WHERE id = ?`).run(id)
        await psDb.execute(`UPDATE comex_import_extra_costs SET ${col} = 0 WHERE id = ?`, [id])
        console.log(`[PowerSync] Corregido ${col} = "null" → 0 en comex_import_extra_costs`, id)
      }
    } catch { /* columna puede no existir en versiones viejas */ }
  }

  // 2. Corregir ps_crud pendiente para que no intente subir el string "null" a Supabase
  const crudRows = await psDb.getAll<{ id: number; data: string }>('SELECT id, data FROM ps_crud')
  for (const row of crudRows) {
    let parsed: { type?: string; id?: string; data?: Record<string, unknown> }
    try { parsed = JSON.parse(row.data) } catch { continue }
    if (parsed.type !== 'comex_import_extra_costs' || !parsed.data) continue

    let changed = false
    for (const col of EXTRA_COST_DOUBLE_COLS) {
      if (parsed.data[col] === 'null') {
        parsed.data[col] = 0
        changed = true
      }
    }
    if (changed) {
      await psDb.execute('UPDATE ps_crud SET data = ? WHERE id = ?', [JSON.stringify(parsed), row.id])
      console.log('[PowerSync] Corregido ps_crud pendiente para comex_import_extra_costs', parsed.id)
    }
  }
}

const LOGO_TABLES = ['comex_suppliers', 'comex_freight_operators', 'comex_gestores', 'comex_despachantes', 'comex_brands']

function logoFileToDataUrl(storedName: string): string | null {
  const fp = path.join(getAttachmentsDir(), storedName)
  if (!fs.existsSync(fp)) return null
  const ext = path.extname(storedName).slice(1).toLowerCase()
  const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`
  const data = fs.readFileSync(fp)
  return `data:${mime};base64,${data.toString('base64')}`
}

/**
 * Los logos se guardaban solo como archivo local (logo_stored_name), que no
 * viaja entre dispositivos. Para filas existentes con logo_stored_name pero
 * sin logo_data, lee el archivo local y lo guarda como base64 para que
 * sincronice junto con el resto de los datos.
 */
async function backfillLogoData(psDb: PowerSyncDatabase): Promise<void> {
  const flowDb = getDb()
  for (const table of LOGO_TABLES) {
    const rows = await psDb.getAll<{ id: string; logo_stored_name: string }>(
      `SELECT id, logo_stored_name FROM ${table} WHERE logo_stored_name IS NOT NULL AND logo_data IS NULL`
    )
    for (const row of rows) {
      const dataUrl = logoFileToDataUrl(row.logo_stored_name)
      if (!dataUrl) continue
      flowDb.prepare(`UPDATE ${table} SET logo_data = ? WHERE id = ?`).run(dataUrl, row.id)
      await psDb.execute(`UPDATE ${table} SET logo_data = ? WHERE id = ?`, [dataUrl, row.id])
      console.log(`[PowerSync] Backfill logo_data en ${table}:`, row.id)
    }
  }
}

/**
 * Detecta y elimina conceptos duplicados en company_finance_concepts (mismo nombre,
 * IDs distintos). Ocurre cuando los sync-rules tenían un workspace_id incorrecto:
 * restoreCompanyFinanceLocalCache llenaba ps_data__ con IDs de flowtask.db, y al
 * corregir los sync-rules el servidor bajaba además los IDs que habían subido vía
 * ps_crud → dos fuentes, mismo nombre, IDs distintos.
 * Si detecta duplicados, borra TODOS los datos de company_finance desde PowerSync
 * (lo que encola DELETEs hacia Supabase) para que restoreCompanyFinanceLocalCache
 * re-suba todo limpio desde flowtask.db en el mismo arranque.
 */
async function cleanupCompanyFinanceDuplicates(psDb: PowerSyncDatabase): Promise<void> {
  const { dupes } = await psDb.get<{ dupes: number }>(`
    SELECT COUNT(*) as dupes FROM (
      SELECT name FROM company_finance_concepts GROUP BY name HAVING COUNT(*) > 1
    )
  `)
  if (dupes === 0) return

  console.log(`[PowerSync] Detectados ${dupes} conceptos duplicados en company_finance. Limpiando...`)
  const ordered = [
    'company_finance_movement_entries',
    'company_finance_month_insights',
    'company_finance_movements',
    'company_finance_concepts',
    'company_finance_payment_methods',
    'company_finance_categories',
    'company_finance_accounts',
  ]
  for (const t of ordered) {
    await psDb.execute(`DELETE FROM ${t} WHERE 1=1`)
  }
  console.log('[PowerSync] company_finance limpiado. Se re-sube desde flowtask.db.')
}

/**
 * Conecta la instancia de PowerSync al backend, en paralelo a better-sqlite3.
 * Antes de conectar, copia los datos existentes de tasks/projects/task_dependencies
 * (Fase 1), de user_permissions (Fase 6) y de Finanzas/Finanzas Empresa
 * (Fase 3) si todavía no se hizo.
 *
 * Requiere una sesión de Supabase Auth activa (Fase 6.3): sin sesión, no
 * conecta (igual que cuando faltan las env vars). Se vuelve a llamar tras un
 * login exitoso.
 */
export async function connectPowerSync(): Promise<void> {
  const env = readEnvLocal()
  const endpoint = env.POWERSYNC_URL

  if (!endpoint || !env.POWERSYNC_JWT_PRIVATE_KEY_B64 || !env.POWERSYNC_JWT_KID) {
    _configError =
      'Falta configurar .env.local (POWERSYNC_URL, POWERSYNC_JWT_PRIVATE_KEY_B64, POWERSYNC_JWT_KID)'
    console.warn(`[PowerSync] ${_configError}, omitiendo conexión`)
    return
  }

  const session = await getSession()
  if (!session) {
    _configError = 'Sin sesión de usuario autenticado'
    console.warn(`[PowerSync] ${_configError}, omitiendo conexión`)
    return
  }

  _configError = null

  const db = getPowerSyncDb()
  await migrateLegacyTaskData(db)
  await migrateUserPermissions(db)
  await migrateLegacyFinanceData(db)
  await cleanupCompanyFinanceDuplicates(db)
  await restoreCompanyFinanceLocalCache(db)
  await restoreComexLocalCache(db)
  await migrateLegacyComexMaestrosData(db)
  await migrateLegacyComexImportsData(db)
  await migrateLegacyComexPlanningsData(db)
  await fixNullWorkspaceIds(db)
  await fixLegacyNullDoubleStrings(db)
  await backfillLogoData(db)
  for (const table of LOGO_TABLES) {
    const [row] = await db.getAll<{ total: number; with_logo: number }>(
      `SELECT COUNT(*) as total, SUM(CASE WHEN logo_data IS NOT NULL THEN 1 ELSE 0 END) as with_logo FROM ${table}`
    )
    console.log(`[PowerSync] logo_data en ${table}: ${row.with_logo ?? 0}/${row.total}`)
  }
  try {
    const [crud] = await db.getAll<{ n: number }>('SELECT COUNT(*) as n FROM ps_crud')
    console.log('[PowerSync] operaciones pendientes de subir (ps_crud):', crud.n)
  } catch (e) {
    console.log('[PowerSync] no se pudo leer ps_crud:', errorMessage(e))
  }
  await db.connect(new ProductionTokenConnector(endpoint))
  console.log('[PowerSync] Conectado a', endpoint, 'como', session.email)
}

/** Desconecta PowerSync (p. ej. al cerrar sesión). */
export async function disconnectPowerSync(): Promise<void> {
  if (!_psDb) return
  await _psDb.disconnect()
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>
    if (typeof obj.message === 'string') return obj.message
    if (typeof obj.error === 'string') return obj.error
    if (typeof obj.hint === 'string') return `${obj.code ?? ''}: ${obj.message ?? obj.hint}`.trim()
    try { return JSON.stringify(obj) } catch { /* */ }
  }
  return String(err)
}

function serializeStatus(status: SyncStatus): PowerSyncStatusInfo {
  const dataFlow = status.dataFlowStatus
  const error = dataFlow.uploadError ?? dataFlow.downloadError
  if (error) {
    console.error('[PowerSync] uploadError:', dataFlow.uploadError)
    console.error('[PowerSync] downloadError:', dataFlow.downloadError)
    _lastErrorMessage = errorMessage(error)
  }
  return {
    connected: status.connected,
    connecting: status.connecting,
    uploading: !!dataFlow.uploading,
    downloading: !!dataFlow.downloading,
    lastSyncedAt: status.lastSyncedAt ? status.lastSyncedAt.getTime() : null,
    hasError: !!error,
    configError: _configError,
    lastErrorMessage: _lastErrorMessage
  }
}

/**
 * Devuelve el estado actual de sincronización, para exponerlo vía IPC al
 * abrir la app (antes de que llegue el primer evento de `statusChanged`).
 */
export function getPowerSyncStatus(): PowerSyncStatusInfo | null {
  if (!_psDb) {
    return {
      connected: false,
      connecting: false,
      uploading: false,
      downloading: false,
      lastSyncedAt: null,
      hasError: false,
      configError: _configError,
      lastErrorMessage: _lastErrorMessage
    }
  }
  return serializeStatus(_psDb.currentStatus)
}

/**
 * Registra listeners de PowerSync para avisar al renderer (vía `sendToRenderer`)
 * cuando cambia el estado de conexión/sync (`powersync:status`) o cuando se
 * actualizan datos de tasks/projects/task_dependencies por sync remoto o
 * escritura local (`powersync:dataChanged`).
 */
export function registerSyncListeners(sendToRenderer: (channel: string, data: unknown) => void): void {
  const db = getPowerSyncDb()

  db.registerListener({
    statusChanged: (status) => sendToRenderer('powersync:status', serializeStatus(status))
  })

  db.onChangeWithCallback(
    {
      onChange: async () => {
        sendToRenderer('powersync:dataChanged', null)
      },
      onError: (err) => console.error('[PowerSync] Error en listener de cambios:', err)
    },
    { tables: ['projects', 'tasks', 'task_dependencies', ...FINANCE_TABLES, 'company_finance_accounts', 'company_finance_categories', 'company_finance_payment_methods', 'company_finance_concepts', 'company_finance_movements', 'company_finance_movement_entries', 'company_finance_month_insights', ...COMEX_MAESTROS_TABLES, ...COMEX_IMPORTS_TABLES, ...COMEX_PLANNINGS_TABLES, 'calendar_event_links', 'quote_companies', 'quote_contacts', 'quotes', 'quote_activities'], throttleMs: 1000 }
  )
}
