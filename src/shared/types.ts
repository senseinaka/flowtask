export type Priority = 1 | 2 | 3 | 4 | 5
export type TaskStatus = 'pending' | 'in_progress' | 'blocked' | 'done'

export interface Project {
  id: string
  name: string
  color: string
  created_at: number
  updated_at: number
}

export interface Task {
  id: string
  project_id: string | null
  title: string
  description: string
  status: TaskStatus
  priority: Priority
  due_date: number | null
  due_time: string | null
  completed_at: number | null
  created_at: number
  updated_at: number
  synced_at: number | null
  drive_file_id: string | null
  project?: Project
  dependencies?: Task[]
  blockedBy?: Task[]
}

export interface Attachment {
  id: string
  task_id: string
  original_name: string
  stored_name: string
  mime_type: string
  size_bytes: number
  drive_file_id: string | null
  synced_at: number | null
  created_at: number
}

export interface Reminder {
  id: string
  task_id: string
  remind_at: number
  phone_number: string
  message: string
  sent: 0 | 1 | 2
  sent_at: number | null
  created_at: number
}

export interface TaskFilters {
  status?: TaskStatus[]
  priority?: Priority[]
  project_id?: string
  search?: string
  due_before?: number
}

export interface CreateTaskInput {
  title: string
  description?: string
  priority?: Priority
  status?: TaskStatus
  due_date?: number | null
  due_time?: string | null
  project_id?: string | null
}

export interface CreateReminderInput {
  task_id: string
  remind_at: number
  phone_number: string
  message: string
}

export type MessageRecurrence = 'none' | 'daily' | 'weekly' | 'monthly'
export type MessageStatus = 'pending' | 'sent' | 'failed' | 'partial'

export const RECURRENCE_LABELS: Record<MessageRecurrence, string> = {
  none: 'Una sola vez',
  daily: 'Diario',
  weekly: 'Semanal',
  monthly: 'Mensual'
}

export interface MessageTemplate {
  id: string
  name: string
  body: string
  created_at: number
  updated_at: number
}

export interface ScheduledMessage {
  id: string
  contact_ids: string[]   // parsed from JSON in DB
  template_id: string | null
  message: string
  send_at: number
  recurrence: MessageRecurrence
  status: MessageStatus
  sent_at: number | null
  error: string | null
  created_at: number
  updated_at: number
  contacts?: Contact[]    // hydrated
}

export interface CreateScheduledMessageInput {
  contact_ids: string[]
  template_id?: string | null
  message: string
  send_at: number
  recurrence?: MessageRecurrence
}

export type DelegatedStatus = 'pending' | 'in_progress' | 'done' | 'cancelled'

export interface DelegatedTask {
  id: string
  contact_id: string
  title: string
  description: string
  status: DelegatedStatus
  priority: Priority
  due_date: number | null
  completed_at: number | null
  created_at: number
  updated_at: number
  contact?: Contact
}

export interface CreateDelegatedTaskInput {
  contact_id: string
  title: string
  description?: string
  priority?: Priority
  due_date?: number | null
}

export const DELEGATED_STATUS_LABELS: Record<DelegatedStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  done: 'Hecho',
  cancelled: 'Cancelado'
}

export type ContactType = 'collaborator' | 'family' | 'friend' | 'other'

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  collaborator: 'Colaborador',
  family: 'Familiar',
  friend: 'Amigo',
  other: 'Otro'
}

export const CONTACT_TYPE_COLORS: Record<ContactType, string> = {
  collaborator: '#6366f1',
  family: '#10b981',
  friend: '#f59e0b',
  other: '#64748b'
}

export interface Contact {
  id: string
  name: string
  phone: string
  email: string
  notes: string
  type: ContactType
  avatar_color: string
  created_at: number
  updated_at: number
}

export interface CreateContactInput {
  name: string
  phone: string
  email?: string
  notes?: string
  type?: ContactType
}

// ─── WhatsApp Questions ───────────────────────────────────────────────────────

export type QuestionAction = 'set_status' | 'save_only' | 'none'
export type QuestionStatus = 'pending' | 'answered' | 'expired'

export interface QuestionOption {
  label: string
  action: QuestionAction
  action_value: string | null   // TaskStatus | DelegatedStatus | null
}

export interface TaskQuestion {
  id: string
  task_id: string
  task_type: TaskType            // 'personal' | 'delegated'
  phone: string
  question: string
  options: QuestionOption[]     // parsed from JSON
  ref_code: string              // 4-char code e.g. "AB3X"
  status: QuestionStatus
  answer: string | null
  action_taken: string | null
  answered_at: number | null
  expires_at: number
  created_at: number
}

export interface CreateTaskQuestionInput {
  task_id: string
  task_type?: TaskType           // default 'personal'
  phone: string
  question: string
  options: QuestionOption[]
  expires_in_hours?: number     // default 48
}

export const QUESTION_ACTION_LABELS: Record<QuestionAction, string> = {
  set_status: 'Cambiar estado a...',
  save_only:  'Solo registrar respuesta',
  none:       'Sin acción'
}

export const QUESTION_TEMPLATES: Array<{
  label: string
  question: string
  options: QuestionOption[]
}> = [
  {
    label: '¿Terminaste la tarea?',
    question: '¿Has terminado la tarea?',
    options: [
      { label: 'Sí, terminé ✅',             action: 'set_status', action_value: 'done'        },
      { label: 'No todavía ❌',               action: 'none',       action_value: null          },
      { label: 'Estoy trabajando en ello 🔄', action: 'set_status', action_value: 'in_progress' }
    ]
  },
  {
    label: '¿Cómo va el avance?',
    question: '¿Cómo va el avance de la tarea?',
    options: [
      { label: 'Recién empecé 🟡',        action: 'set_status', action_value: 'in_progress' },
      { label: 'A mitad de camino 🔄',    action: 'save_only',  action_value: null          },
      { label: 'Casi lista 🟢',           action: 'save_only',  action_value: null          },
      { label: 'Lista ✅',                action: 'set_status', action_value: 'done'        }
    ]
  },
  {
    label: '¿Hay algún bloqueo?',
    question: '¿Hay algo que te impida continuar?',
    options: [
      { label: 'Sí, estoy bloqueado ⛔', action: 'set_status', action_value: 'blocked' },
      { label: 'No, todo bien ✅',        action: 'none',       action_value: null      }
    ]
  },
  {
    label: '¿Cuándo entregás?',
    question: '¿Cuándo podés entregar esta tarea?',
    options: [
      { label: 'Hoy mismo 📅',               action: 'save_only', action_value: null },
      { label: 'Esta semana 📆',             action: 'save_only', action_value: null },
      { label: 'La semana que viene 🗓️',    action: 'save_only', action_value: null },
      { label: 'Necesito más tiempo ⏳',     action: 'save_only', action_value: null }
    ]
  }
]

// ─── Task Status Log ──────────────────────────────────────────────────────────

export type TaskType = 'personal' | 'delegated'

export interface TaskStatusLogEntry {
  id: string
  task_id: string
  task_type: TaskType
  from_status: string | null   // null on creation
  to_status: string
  changed_at: number
  note: string
}

// ─────────────────────────────────────────────────────────────────────────────

export interface SyncResult {
  success: boolean
  timestamp: number
  error?: string
  filesUploaded?: number
}

export interface SyncStatus {
  lastSync: number | null
  isAuthenticated: boolean
  isSyncing: boolean
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  1: 'Crítico',
  2: 'Alto',
  3: 'Medio',
  4: 'Bajo',
  5: 'Algún día'
}

export const PRIORITY_COLORS: Record<Priority, string> = {
  1: '#ef4444',
  2: '#f97316',
  3: '#eab308',
  4: '#3b82f6',
  5: '#9ca3af'
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  blocked: 'Bloqueado',
  done: 'Hecho'
}

// ─── Comex (Comercio Exterior) ────────────────────────────────────────────────

export type ImportStatus =
  | 'planning' | 'ordered' | 'paid' | 'production'
  | 'shipped'  | 'transit' | 'arrived' | 'customs' | 'oficializado' | 'carga_deposito' | 'delivered'

export type DocumentType =
  | 'invoice' | 'packing_list' | 'bill_of_lading' | 'certificate_of_origin'
  | 'customs_declaration' | 'payment_receipt' | 'insurance' | 'other'

export type DocumentStatus     = 'pending' | 'received' | 'approved'
export type DriveDocStatus     = 'none' | 'uploading' | 'synced' | 'error'
export type QuoteStatus        = 'requested' | 'quoted' | 'selected' | 'rejected'
export type ComexPaymentStatus = 'pending' | 'completed'
export type PaymentMethod      = 'advance' | 'wire' | 'lc' | 'other'
export type FreightCompanyType = 'agente' | 'naviera' | 'courier' | 'aereo' | 'otro'
export type CargoType          = 'LCL' | 'FCL' | 'aereo' | 'courier'

export const IMPORT_STATUS_LABELS: Record<ImportStatus, string> = {
  planning:     'Planificación',
  ordered:      'Pedido enviado',
  paid:         'Pago realizado',
  production:   'En producción',
  shipped:      'Embarcado',
  transit:      'En tránsito',
  arrived:      'Arribado',
  customs:      'Traslado a depósito fiscal',
  oficializado:    'Oficializado',
  carga_deposito:  'Carga en depósito',
  delivered:       'Entregado'
}

export const IMPORT_STATUS_COLORS: Record<ImportStatus, string> = {
  planning:     '#94a3b8',  // slate
  ordered:      '#60a5fa',  // blue
  paid:         '#34d399',  // emerald
  production:   '#f59e0b',  // amber
  shipped:      '#6366f1',  // indigo
  transit:      '#8b5cf6',  // violet
  arrived:      '#06b6d4',  // cyan
  customs:      '#f97316',  // orange — Traslado a depósito
  oficializado:   '#ec4899',  // pink
  carga_deposito: '#2dd4bf',  // teal — última milla
  delivered:      '#10b981'   // green
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  invoice:              'Factura comercial',
  packing_list:         'Packing list',
  bill_of_lading:       'Bill of Lading / AWB',
  certificate_of_origin:'Certificado de origen',
  customs_declaration:  'Declaración aduanera (DI)',
  payment_receipt:      'Comprobante de pago',
  insurance:            'Póliza de seguro',
  other:                'Otro'
}

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  pending:  'Pendiente',
  received: 'Recibido',
  approved: 'Aprobado'
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  advance: 'Adelanto',
  wire:    'Transferencia bancaria',
  lc:      'Carta de crédito',
  other:   'Otro'
}

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  requested: 'Solicitado',
  quoted:    'Cotizado',
  selected:  'Seleccionado',
  rejected:  'Rechazado'
}

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  requested: '#60a5fa',
  quoted:    '#f59e0b',
  selected:  '#10b981',
  rejected:  '#ef4444'
}

export const FREIGHT_COMPANY_TYPE_LABELS: Record<FreightCompanyType, string> = {
  agente:  'Agente de carga',
  naviera: 'Naviera',
  courier: 'Courier',
  aereo:   'Carga aérea',
  otro:    'Otro'
}

export const CARGO_TYPE_LABELS: Record<CargoType, string> = {
  LCL:     'LCL (carga suelta)',
  FCL:     'FCL (contenedor completo)',
  aereo:   'Aéreo',
  courier: 'Courier'
}

// ── Freight Operators ─────────────────────────────────────────────────────────

export interface ComexFreightOperator {
  id: string
  name: string
  company_type: FreightCompanyType
  contact_name: string
  email: string
  phone: string
  whatsapp: string
  services: string      // free-text: "LCL, FCL, aéreo"
  notes: string
  logo_stored_name: string | null
  created_at: number
  updated_at: number
}

export type CreateComexFreightOperatorInput = Omit<ComexFreightOperator, 'id' | 'created_at' | 'updated_at'>

export interface ComexFreightOperatorContact {
  id: string
  operator_id: string
  name: string
  nickname: string      // nombre corto para saludo en mails/mensajes
  role: string          // e.g. "Cotizaciones LCL", "Operaciones", "Comercial"
  email: string
  phone: string         // WhatsApp / teléfono
  sort_order: number
  created_at: number
}

export type CreateComexFreightOperatorContactInput = Omit<ComexFreightOperatorContact, 'id' | 'created_at'>

// ── Gestores INAL ─────────────────────────────────────────────────────────────

export interface ComexGestor {
  id:             string
  name:           string   // nombre completo
  estudio:        string   // razón social del estudio/empresa
  cuit:           string
  email:          string
  phone:          string   // teléfono personal / WhatsApp
  phone_empresa:  string   // teléfono de la empresa
  whatsapp:       string
  website:        string
  direccion:      string
  especialidades: string   // "INAL, ANMAT, Cosméticos" (comma-separated)
  notas:          string
  logo_stored_name: string | null
  created_at:     number
  updated_at:     number
  // relacional
  contacts?:      ComexGestorContact[]
}

export interface ComexGestorContact {
  id:         string
  gestor_id:  string
  name:       string
  role:       string
  email:      string
  phone:      string
  sort_order: number
  created_at: number
}

export type CreateComexGestorInput         = Omit<ComexGestor, 'id' | 'created_at' | 'updated_at' | 'contacts' | 'logo_stored_name'>
export type CreateComexGestorContactInput  = Omit<ComexGestorContact, 'id' | 'created_at'>

// ── Despachantes ──────────────────────────────────────────────────────────────

export interface ComexDespachanteContact {
  id:             string
  despachante_id: string
  name:           string
  role:           string
  email:          string
  phone:          string
  sort_order:     number
  created_at:     number
}

export type CreateComexDespachanteContactInput = Omit<ComexDespachanteContact, 'id' | 'created_at'>

export interface ComexDespachante {
  id:               string
  name:             string
  matricula:        string   // matrícula profesional
  empresa:          string   // empresa/estudio donde trabaja
  cuit:             string
  email:            string
  phone:            string   // teléfono personal / WhatsApp
  phone_empresa:    string   // teléfono de la empresa
  whatsapp:         string
  website:          string
  direccion:        string
  notas:            string
  logo_stored_name: string | null
  created_at:       number
  updated_at:       number
  // relacional
  contacts?:        ComexDespachanteContact[]
}

export type CreateComexDespachanteInput = Omit<ComexDespachante, 'id' | 'created_at' | 'updated_at' | 'logo_stored_name' | 'contacts'>

// ── Costos extras de importación ─────────────────────────────────────────────

export const EXTRA_COST_CATEGORIES = [
  'despachante', 'deposito_fiscal',
  'flete_internacional', 'flete_local',
  'libre_circulacion', 'gastos_bancarios', 'otro'
] as const
export type ExtraCostCategory = typeof EXTRA_COST_CATEGORIES[number]

export const EXTRA_COST_CATEGORY_LABELS: Record<ExtraCostCategory, string> = {
  despachante:         'Despachante',
  deposito_fiscal:     'Depósito fiscal',
  flete_internacional: 'Flete internacional',
  flete_local:         'Flete local',
  libre_circulacion:   'Libre circulación',
  gastos_bancarios:    'Gastos bancarios',
  otro:                'Otro'
}

export interface ComexImportExtraCost {
  id:                  string
  import_id:           string
  categoria:           ExtraCostCategory
  concepto:            string
  proveedor:           string
  nro_factura:         string
  fecha_factura:       number | null
  importe:             number         // neto gravado (sin IVA) — el costo real
  moneda:              'ARS' | 'USD'
  // Datos adicionales extraídos de la factura
  cae:                 string | null
  referencia_despacho: string | null  // N° despacho que figura en la factura
  importe_iva:         number | null
  importe_total:       number | null
  items_json:          string | null  // JSON stringificado de Array<{concepto,importe}>
  // Campos de flete
  tipo_cambio:         number | null  // TC consignado en la factura (ARS/moneda)
  bl_referencia:       string | null  // BL/AWB de la factura de flete
  importe_ars:         number | null  // Total ARS según la factura
  // Campos de depósito fiscal
  percepciones:        number | null  // Total percepciones IIBB (caba + bsas + otras)
  percepcion_caba:     number | null  // Percepción IIBB Ciudad de Buenos Aires
  percepcion_bsas:     number | null  // Percepción IIBB Provincia de Buenos Aires
  fecha_ingreso:       string | null  // Fecha de ingreso al depósito (YYYY-MM-DD)
  fecha_egreso:        string | null  // Fecha de egreso del depósito (YYYY-MM-DD)
  nro_contenedor:      string | null  // Número de contenedor (MSDU8859271)
  canal_deposito:      string | null  // Canal aduanero (ej: "R - Rojo")
  // Archivo adjunto
  stored_name:         string | null
  original_name:       string | null
  drive_file_id:       string | null
  drive_folder_id:     string | null
  drive_status:        DriveDocStatus
  sort_order:          number
  created_at:          number
}

export type CreateComexImportExtraCostInput = Omit<ComexImportExtraCost, 'id' | 'created_at'>

// Resultado de extracción de factura local argentina (incluye facturas de despachantes)
export interface ExtractedFacturaLocal {
  proveedor:            string | null
  cuit_emisor:          string | null
  tipo_factura:         string | null   // A, B, C, M
  nro_factura:          string | null   // "00004-00003485"
  fecha:                string | null   // YYYY-MM-DD
  cae:                  string | null   // CAE N° (autorización electrónica)
  referencia_despacho:  string | null   // N° despacho mencionado en los ítems
  concepto:             string | null   // descripción general (si es una sola línea)
  importe_neto:         number | null   // Importe Neto Gravado SIN IVA — el costo real
  iva:                  number | null   // IVA total (recuperable)
  importe_total:        number | null   // Total factura con IVA
  moneda:               string | null
  items: Array<{
    concepto: string
    importe:  number
  }> | null
  // Ítems de transporte terrestre separados (Flete interno, Peaje, etc.)
  // Se copian al "Flete local" y NO se incluyen en el costo del despachante
  flete_local_items?: Array<{
    concepto:       string
    importe_neto:   number
    iva_porcentaje?: number | null
  }> | null
  // Campos de flete
  bl_referencia:          string | null   // BL/AWB de "Referencia Comercial"
  tipo_cambio_consignado: number | null   // TC de la línea de pie de la factura
  importe_ars:            number | null   // Total ARS del pie de la factura
  // Campos de depósito fiscal
  percepciones:           number | null   // Total percepciones IIBB (suma)
  percepcion_caba:        number | null   // Percepción IIBB Ciudad de Buenos Aires
  percepcion_bsas:        number | null   // Percepción IIBB Provincia de Buenos Aires
  fecha_ingreso:          string | null   // YYYY-MM-DD — fecha de ingreso al depósito
  fecha_egreso:           string | null   // YYYY-MM-DD — fecha de egreso del depósito
  nro_contenedor:         string | null   // Número de contenedor (ej: MSDU8859271)
  canal_deposito:         string | null   // Canal (ej: "R - Rojo")
  // Datos de carga — extraídos de la línea "AMPARADA POR X CON Y BULTOS Z Kg. W M3."
  cant_bultos_deposito:   number | null   // Cantidad de bultos/cajas
  peso_bruto_kg_deposito: number | null   // Peso bruto en kg
  volumen_m3_deposito:    number | null   // Volumen en m³
}

// ── Tributos del despacho ─────────────────────────────────────────────────────

export interface ComexImportTributo {
  id:          string
  import_id:   string
  codigo:      string
  concepto:    string
  porcentaje:  number | null
  importe_usd: number
  sort_order:  number
  created_at:  number
}

export type CreateComexImportTributoInput = Omit<ComexImportTributo, 'id' | 'created_at'>

export const INCOTERMS = ['EXW','FCA','FOB','CFR','CIF','CPT','CIP','DAP','DPU','DDP'] as const
export type Incoterm = typeof INCOTERMS[number]

// ── Proformas ─────────────────────────────────────────────────────────────────

export interface ComexProforma {
  id:               string
  import_id:        string
  tipo:             'proforma' | 'factura'  // distingue proformas de facturas comerciales
  numero:           number
  fecha_proforma:   string | null   // YYYY-MM-DD
  importe:          number | null
  moneda:           string          // USD, EUR, CNY, etc.
  nro_proforma:     string
  descripcion:      string
  incluir_en_total: 0 | 1           // checkbox
  stored_name:      string | null
  original_name:    string | null
  drive_file_id:    string | null
  drive_folder_id:  string | null
  drive_status:     DriveDocStatus
  created_at:       number
}

export type CreateComexProformaInput = Omit<ComexProforma, 'id' | 'created_at'>

export interface ExtractedProforma {
  importe_total: number | null
  moneda:        string | null
  fecha:         string | null   // YYYY-MM-DD
  nro_proforma:  string | null
  proveedor:     string | null
  descripcion:   string | null
}

// ── Chat IA ───────────────────────────────────────────────────────────────────

export interface AIChatMessage {
  id:         string
  session_id: string
  role:       'user' | 'assistant'
  content:    string
  created_at: number
}

// ── Backup ────────────────────────────────────────────────────────────────────

export interface BackupStatus {
  timestamp:    string     // ISO string
  success:      boolean
  driveFolder?: string    // nombre de la carpeta en Drive
  error?:       string
}

// ── IA / Claude ───────────────────────────────────────────────────────────────

export const CLAUDE_MODELS = [
  { id: 'claude-haiku-4-5',   label: 'Haiku 4.5  — rápido y económico' },
  { id: 'claude-sonnet-4-5',  label: 'Sonnet 4.5 — balanceado (recomendado)' },
  { id: 'claude-opus-4-5',    label: 'Opus 4.5   — máxima capacidad' },
] as const

export type ClaudeModelId = typeof CLAUDE_MODELS[number]['id']

// Tipos de operación — cada uno puede usar un modelo distinto
export const AI_OPERATIONS = [
  'extract_despacho',
  'extract_pl',
  'extract_bl',
  'extract_factura',
  'extract_factura_local',
  'extract_factura_flete',
  'extract_factura_deposito',
  'extract_proforma',
  'extract_general',
  'dashboard_chat',
] as const
export type AIOperation = typeof AI_OPERATIONS[number]

export const AI_OPERATION_LABELS: Record<AIOperation, string> = {
  extract_despacho:        'Extraer despacho de aduana',
  extract_pl:              'Extraer Packing List',
  extract_bl:              'Extraer BL / Bill of Lading',
  extract_factura:         'Extraer factura comercial (exterior)',
  extract_factura_local:   'Extraer factura local argentina',
  extract_factura_flete:   'Extraer factura de flete / agente de carga',
  extract_factura_deposito:'Extraer factura de depósito fiscal',
  extract_proforma:        'Extraer proforma / cotización',
  extract_general:         'Analizar documento (general)',
  dashboard_chat:          'Chat del dashboard',
}

export const AI_OPERATION_DEFAULT_MODELS: Record<AIOperation, ClaudeModelId> = {
  extract_despacho:        'claude-sonnet-4-5',
  extract_pl:              'claude-haiku-4-5',
  extract_bl:              'claude-sonnet-4-5',
  extract_factura:         'claude-haiku-4-5',
  extract_factura_local:   'claude-haiku-4-5',
  extract_factura_flete:   'claude-haiku-4-5',
  extract_factura_deposito:'claude-haiku-4-5',
  extract_proforma:        'claude-haiku-4-5',
  extract_general:         'claude-haiku-4-5',
  dashboard_chat:          'claude-sonnet-4-5',
}

export interface AIConfig {
  apiKey: string
  models: Record<AIOperation, ClaudeModelId>
}

// Tributo individual del despacho
export interface DespachoTributo {
  codigo:      string         // "010", "415", etc.
  concepto:    string         // "DERECHOS IMPORTACION", "I.V.A.", etc.
  porcentaje:  number | null  // % aplicado, null si no tiene
  importe_usd: number         // valor en USD (columna TOTAL del despacho)
}

// Resultado de extracción de despacho (Hoja 1 — OM-1993 SIM/MARIA)
export interface ExtractedDespacho {
  // Identificación
  numero_despacho:       string | null   // "26 001 IC04 101630 G"
  fecha_oficializacion:  string | null   // YYYY-MM-DD
  fecha_arribo:          string | null   // YYYY-MM-DD
  canal:                 string | null   // "ROJO 0005", "VERDE 0001", etc.
  // Partes
  despachante:           string | null
  importador:            string | null
  vendedor:              string | null
  agente_transporte:     string | null  // Agente de Transporte Aduanero (ej: SOUTH CARGO S.A.)
  // Transporte
  bl_numero:             string | null
  buque:                 string | null
  origen_pais:           string | null
  // Valores
  incoterm:              string | null
  fob_total:             number | null   // en divisa indicada por fob_divisa
  fob_divisa:            string | null   // "DOL", "EURO", etc.
  cotizacion_dolar:      number | null   // tipo de cambio "Cotiz" de Info Complementaria
  peso_bruto_kg:         number | null
  total_bultos:          number | null
  nro_factura:           string | null
  // Tributos — sección más importante para cálculo de costos
  tributos:              DespachoTributo[]
  total_tributos_usd:    number | null   // suma de todos los tributos en USD
}

// Resultado de extracción de Packing List
export interface ExtractedPL {
  peso_bruto_kg:    number | null   // Gross weight en kg
  volumen_m3:       number | null   // Volumen en CBM = m³
  cant_pallets:     number | null   // Número de pallets
  cant_cartons:     number | null   // Número de cajas / cartones
  nro_contenedor:   string | null   // Container number (si figura)
  descripcion_carga:string | null   // Descripción corta de la mercadería
}

// Resultado de extracción de BL / Bill of Lading
export interface ExtractedBL {
  bl_number:        string | null   // Número de BL (ej: "60-2604-0248")
  fecha_emision:    string | null   // Fecha de emisión YYYY-MM-DD
  buque:            string | null   // Ocean vessel / nombre del barco
  puerto_embarque:  string | null   // Port of loading
  puerto_descarga:  string | null   // Port of discharge
  consignor:        string | null   // Exportador/consignante
  cant_pallets:     number | null   // Número de pallets
  cant_cartons:     number | null   // Número de cajas / cartones (CTNS, CARTONS)
  peso_bruto_kg:    number | null   // Gross weight en kg
  volumen_m3:       number | null   // Measurement en CBM = m³
  nro_contenedor:   string | null   // Container number (4L+7D, ej: "BMOU5177325")
  descripcion_carga:string | null   // Description of goods
}

// Resultado de extracción de factura
export interface ExtractedFactura {
  supplier_name:   string | null
  invoice_number:  string | null
  invoice_date:    string | null   // YYYY-MM-DD
  currency:        string | null
  incoterm:        string | null
  port_of_origin:  string | null
  items: Array<{
    description:  string
    hs_code:      string | null
    quantity:     number
    unit:         string
    unit_price:   number
    total:        number
  }>
  subtotal:       number | null
  freight:        number | null
  total:          number | null
  payment_terms:  string | null
}

// Resultado genérico de análisis
export interface AIAnalysisResult {
  operation:  AIOperation
  model:      ClaudeModelId
  content:    string        // respuesta en texto libre
  structured: unknown       // datos estructurados (depende de la operación)
  tokens_used: number
}

export interface ComexSupplier {
  id: string
  name: string
  // Dirección fiscal
  address: string
  city: string
  country: string
  zip_code: string
  // Identificación
  tax_id: string          // VAT / CUIT / Tax ID local
  rex_number: string      // Registered Exporter Number (REX)
  // Operativo
  brand: string           // Marca comercial (ej. "Naturehike")
  website: string
  wechat: string
  product_categories: string
  payment_terms: string
  incoterms_preferred: string
  port_of_origin: string  // Puertos de embarque (pipe-separated, ej. "Ningbo|Shanghai")
  lead_time_days: number | null
  // Pickup
  pickup_address: string  // Dirección de retiro de mercadería
  // Legacy (mantenidos por compatibilidad)
  contact_name: string
  contact_email: string
  contact_phone: string
  notes: string
  logo_stored_name: string | null
  created_at: number
  updated_at: number
}

// ── Supplier Contacts ─────────────────────────────────────────────────────────

export const CONTACT_ROLES = ['commercial', 'quality', 'logistics', 'accounting', 'other'] as const
export type ContactRole = typeof CONTACT_ROLES[number]

export const CONTACT_ROLE_LABELS: Record<ContactRole, string> = {
  commercial:  'Comercial',
  quality:     'Calidad / Garantías',
  logistics:   'Logística',
  accounting:  'Contabilidad / Finanzas',
  other:       'Otro'
}

export const CONTACT_ROLE_COLORS: Record<ContactRole, string> = {
  commercial:  '#60a5fa',
  quality:     '#34d399',
  logistics:   '#a78bfa',
  accounting:  '#f59e0b',
  other:       '#94a3b8'
}

export interface ComexSupplierContact {
  id: string
  supplier_id: string
  role: ContactRole
  name: string
  position: string      // Cargo en la empresa
  email: string
  phone: string
  whatsapp: string
  notes: string
  sort_order: number
  created_at: number
}

export type CreateComexSupplierContactInput = Omit<ComexSupplierContact, 'id' | 'created_at'>

// ── Supplier Bank Accounts ────────────────────────────────────────────────────

export interface ComexSupplierBankAccount {
  id: string
  supplier_id: string
  bank_name: string
  beneficiary_name: string
  account_number: string
  swift_bic: string
  iban: string
  routing_number: string
  currency: string
  bank_address: string
  notes: string
  created_at: number
}

export type CreateComexSupplierBankAccountInput = Omit<ComexSupplierBankAccount, 'id' | 'created_at'>

export interface ComexImport {
  id: string
  title: string
  supplier_id: string | null
  supplier?: ComexSupplier
  status: ImportStatus
  incoterm: string
  origin_country: string
  origin_port: string      // Puerto de embarque seleccionado (uno de los del proveedor)
  currency: string
  estimated_value: number | null
  actual_value: number | null
  order_date: number | null
  payment_date: number | null
  ship_date: number | null
  arrival_date: number | null   // ETA 1
  eta_2: number | null          // ETA 2
  eta_3: number | null          // ETA 3
  eta_4: number | null          // ETA 4
  actual_ship_date: number | null
  actual_arrival_date: number | null
  tracking_number: string
  customs_agent: string
  drive_folder_id: string | null
  notes: string
  // ── INAL / ANMAT ─────────────────────────────────────────────────────────────
  inal_required: 0 | 1           // ¿Lleva INAL?
  inal_lc_status: InalLCStatus   // Estado Libre Circulación
  inal_lc_task_scheduled: 0 | 1  // ¿Se programó la tarea de tramitación?
  inal_lc_task_id: string | null // ID de la tarea creada en el sistema
  inal_lc_cert_folder_id: string | null  // ID carpeta Drive "Certificados INAL"
  // ── Carpeta INAL en Drive + documentos complementarios ────────────────────
  inal_drive_folder_id:   string | null
  inal_pl_ok:             0 | 1   // ¿Packing List lista para enviar?
  inal_pl_stored_name:    string | null
  inal_pl_original_name:  string | null
  inal_pl_drive_file_id:  string | null
  inal_pl_drive_status:   DriveDocStatus
  inal_xls_ok:            0 | 1   // ¿Xls resumen INAL listo?
  inal_xls_stored_name:   string | null
  inal_xls_original_name: string | null
  inal_xls_drive_file_id: string | null
  inal_xls_drive_status:  DriveDocStatus
  // Copia de Factura comercial específica para carpeta INAL
  inal_factura_stored_name:   string | null
  inal_factura_original_name: string | null
  inal_factura_drive_file_id: string | null
  inal_factura_drive_status:  DriveDocStatus
  // Copia de BL específica para carpeta INAL
  inal_bl_stored_name:    string | null
  inal_bl_original_name:  string | null
  inal_bl_drive_file_id:  string | null
  inal_bl_drive_status:   DriveDocStatus
  // ── Proformas + Facturas ─────────────────────────────────────────────────────
  proformas_folder_id:    string | null  // subcarpeta "Proformas" en Drive
  facturas_folder_id:     string | null  // subcarpeta "Facturas comerciales" en Drive
  // ── Tipo de cambio EUR/ARS (para conversión de valor factura) ────────────────
  tc_eur_ars:             number | null  // EUR/ARS cotización BNA a fecha de oficialización
  // ── KPI calculado ──────────────────────────────────────────────────────────
  cost_pct:               number | null  // % costo importación sobre valor factura (auto-guardado)
  // ── Campos operativos (forwarder, despachante, BL) ──────────────────────────
  freight_operator_id:    string | null   // FK a comex_freight_operators
  gestor_id:              string | null   // FK a comex_gestores
  // ── Fechas de llegada y proceso final ────────────────────────────────────
  aviso_arribo_date:          number | null   // → auto-avanza a 'arrived'
  traslado_deposito_date:     number | null   // → auto-avanza a 'customs'
  oficializacion_import_date: number | null   // → sugiere 'oficializado'
  carga_deposito_date:        number | null   // → auto-avanza a 'carga_deposito'
  carga_deposito_time:        string | null   // "HH:MM" hora del turno
  despachante:            string          // "Dario Valero" | "Iván Balarino" | ""
  forwarder_ref_mail:     string          // ref. de mail al forwarder
  bl_number:              string          // BL / AWB (puede auto-llenarse del despacho)
  // ── Campos del JOIN (solo en queries de lista) ─────────────────────────────
  _despacho_number?:        string | null
  _canal_despacho?:         string | null
  _supplier_logo?:          string | null   // logo_stored_name del proveedor
  // Datos de carga del JOIN con customs (para la tarjeta de importación)
  _peso_bruto_kg?:            number | null
  _volumen_m3?:               number | null
  _cant_bultos?:              number | null
  _cant_pallets_customs?:     number | null
  _freight_operator_name?:    string | null
  _oficializacion_date?:      number | null   // fecha oficialización del despacho (del JOIN)
  _tributos_count?:           number
  _extras_count?:             number
  // ── PL - Packing List ────────────────────────────────────────────────────────
  pl_folder_id:           string | null
  pl_stored_name:         string | null
  pl_original_name:       string | null
  pl_drive_file_id:       string | null
  pl_drive_status:        DriveDocStatus
  pl_extracted_json:      string | null
  // ── BL - Bill of Lading ──────────────────────────────────────────────────────
  bl_extracted_json:      string | null  // JSON con todos los datos extraídos por IA
  bl_folder_id:           string | null  // subcarpeta "BL - Bill of Lading" en Drive
  bl_stored_name:         string | null  // nombre del archivo local
  bl_original_name:       string | null  // nombre original del PDF
  bl_drive_file_id:       string | null  // ID del archivo en Drive
  bl_drive_status:        DriveDocStatus // none | uploading | synced | error
  // ── Despacho de aduana ───────────────────────────────────────────────────────
  despacho_folder_id:     string | null  // subcarpeta "Despacho" en Drive
  despacho_stored_name:   string | null  // nombre del archivo local
  despacho_original_name: string | null  // nombre original del PDF
  despacho_drive_file_id: string | null  // ID del archivo en Drive
  despacho_drive_status:  DriveDocStatus // none | uploading | synced | error
  created_at: number
  updated_at: number
}

export type InalLCStatus = 'pendiente' | 'mail_enviado' | 'en_tramite' | 'finalizado'

export interface ComexInalCert {
  id: string
  import_id: string
  original_name: string
  local_stored_name: string | null
  size_bytes: number | null
  mime_type: string | null
  drive_file_id: string | null
  drive_status: DriveDocStatus
  created_at: number
}

export interface ComexImportItem {
  id: string
  import_id: string
  description: string
  hs_code: string
  quantity: number
  unit: string
  unit_price: number
  currency: string
  created_at: number
}

export interface ComexDocument {
  id: string
  import_id: string
  type: DocumentType
  name: string
  drive_file_id: string | null
  status: DocumentStatus
  notes: string
  received_at: number | null
  created_at: number
  // File attachment fields (migration v13)
  local_stored_name: string | null
  size_bytes: number | null
  mime_type: string | null
  drive_status: DriveDocStatus
}

export interface ComexLogisticsQuote {
  id: string
  import_id: string
  operator_id: string | null    // FK → comex_freight_operators
  operator_name: string
  contact: string
  cargo_type: CargoType         // LCL / FCL / aereo / courier
  quote_amount: number | null
  currency: string
  services_included: string
  valid_until: number | null
  status: QuoteStatus
  rfq_sent_at: number | null    // when the RFQ email was sent
  rfq_email_text: string        // copy of the email body sent
  notes: string
  created_at: number
}

export interface ComexPayment {
  id: string
  import_id: string
  amount: number
  currency: string
  exchange_rate: number | null
  payment_date: number | null
  method: PaymentMethod
  bank: string
  reference: string
  status: ComexPaymentStatus
  notes: string
  created_at: number
}

export type CreateComexSupplierInput = Omit<ComexSupplier, 'id' | 'created_at' | 'updated_at'>
export type CreateComexImportInput   = Omit<ComexImport, 'id' | 'created_at' | 'updated_at' | 'supplier'>
export type CreateComexItemInput     = Omit<ComexImportItem, 'id' | 'created_at'>
export type CreateComexDocumentInput = Omit<ComexDocument, 'id' | 'created_at' | 'local_stored_name' | 'size_bytes' | 'mime_type' | 'drive_status'> & {
  local_stored_name?: string | null
  size_bytes?: number | null
  mime_type?: string | null
  drive_status?: DriveDocStatus
}
export type CreateComexQuoteInput    = Omit<ComexLogisticsQuote, 'id' | 'created_at'>
export type CreateComexPaymentInput  = Omit<ComexPayment, 'id' | 'created_at'>

// ─── Comex Customs & Costs ────────────────────────────────────────────────────

export const DESPACHANTES = [
  'Barrionuevo y Asociados 1',
  'Barrionuevo y Asociados 2',
  'Ivan',
  'DHL',
  'Otro'
] as const

export const CARRIERS = ['Southcargo', 'KingShip', 'DHL', 'Overseas', 'Otro'] as const

export type CostCategory = 'flete' | 'derechos' | 'gastos_despacho' | 'iva' | 'iibb' | 'ganancias' | 'otros'

export const COST_CATEGORY_LABELS: Record<CostCategory, string> = {
  flete:           'Flete',
  derechos:        'Derechos / Aranceles',
  gastos_despacho: 'Gastos de despacho',
  iva:             'IVA',
  iibb:            'IIBB',
  ganancias:       'Ganancias',
  otros:           'Otros gastos'
}

export const COST_CATEGORY_COLORS: Record<CostCategory, string> = {
  flete:           '#60a5fa',
  derechos:        '#f59e0b',
  gastos_despacho: '#a78bfa',
  iva:             '#34d399',
  iibb:            '#fb7185',
  ganancias:       '#f97316',
  otros:           '#94a3b8'
}

export const PREDEFINED_COSTS: Array<{ concept: string; category: CostCategory }> = [
  { concept: 'Flete EXW a FOB',                  category: 'flete' },
  { concept: 'Flete internacional',               category: 'flete' },
  { concept: 'Acarreo (flete local)',             category: 'flete' },
  { concept: 'Derechos de importación',           category: 'derechos' },
  { concept: 'Estadística',                       category: 'derechos' },
  { concept: 'Tasa estadística máxima',           category: 'derechos' },
  { concept: 'Arancel fijo SIM',                  category: 'derechos' },
  { concept: 'Gastos despacho',                   category: 'gastos_despacho' },
  { concept: 'Honorarios despachante',            category: 'gastos_despacho' },
  { concept: 'PSAD Guarda digital',               category: 'gastos_despacho' },
  { concept: 'Gestión de estampillas',            category: 'gastos_despacho' },
  { concept: 'Constitución garantía',             category: 'gastos_despacho' },
  { concept: 'Adicionales aduana',                category: 'gastos_despacho' },
  { concept: 'Terminal puerto verificación',      category: 'gastos_despacho' },
  { concept: 'Terminal puerto desconsolidación',  category: 'gastos_despacho' },
  { concept: 'Depósito fiscal / Almacenaje',      category: 'gastos_despacho' },
  { concept: 'Senasa',                            category: 'gastos_despacho' },
  { concept: 'Certificados INAL',                 category: 'gastos_despacho' },
  { concept: 'Multa',                             category: 'gastos_despacho' },
  { concept: 'Afectación de despacho SEPAIMPO',   category: 'gastos_despacho' },
  { concept: 'IVA despacho (21%)',                category: 'iva' },
  { concept: 'IVA adicional despacho',            category: 'iva' },
  { concept: 'IVA percepción (3%)',               category: 'iva' },
  { concept: 'IVA naviera',                       category: 'iva' },
  { concept: 'IVA almacenaje',                    category: 'iva' },
  { concept: 'IVA despachante',                   category: 'iva' },
  { concept: 'IVA acarreo (flete local)',         category: 'iva' },
  { concept: 'IVA terminal puerto',               category: 'iva' },
  { concept: 'IIBB aduana',                       category: 'iibb' },
  { concept: 'IIBB naviera CABA',                 category: 'iibb' },
  { concept: 'IIBB naviera BS As',                category: 'iibb' },
  { concept: 'IIBB almacenaje',                   category: 'iibb' },
  { concept: 'IIBB terminal puerto',              category: 'iibb' },
  { concept: 'Ganancias aduana',                  category: 'ganancias' },
]

/** Customs declaration data — 1:1 with a ComexImport */
export interface ComexCustoms {
  id: string
  import_id: string
  // Valores financieros
  fob_currency: string          // 'USD' | 'EUR'
  fob_invoice: number | null    // Valor de la factura (en moneda original)
  fob_declared: number | null   // Valor declarado en aduana
  dolar_aduana: number | null   // Tipo de cambio aduana
  dolar_naviera: number | null
  paridad_usd_eur: number | null
  // Despacho
  despacho_number: string
  despachante: string
  oficializacion_date: number | null
  sepaimpo_vencimiento: number | null
  // Shipping
  bl_number: string
  naviera_ref: string
  carrier: string
  canal: string | null  // Canal aduanero (ROJO, VERDE, NARANJA) — del despacho
  etd: number | null
  // Carga
  peso_bruto_kg: number | null
  volumen_m3: number | null
  cant_pallets: number | null
  cant_cartons: number | null   // Cantidad de cajas/cartones (del BL)
  cant_bultos: number | null    // Total Bultos del formulario OM-1993
  // Bancario
  mulc_date: number | null
  fecha_pago_banco: number | null
  cierre_banco_date: number | null
  // Notificaciones
  listas_despachante_date: number | null
  listas_oscar_andrea_date: number | null
  created_at: number
  updated_at: number
}

export interface ComexCostItem {
  id: string
  import_id: string
  category: CostCategory
  concept: string
  amount_pesos: number
  amount_usd: number | null
  sort_order: number
  created_at: number
}

export type UpsertComexCustomsInput = Omit<ComexCustoms, 'id' | 'created_at' | 'updated_at'>
export type CreateComexCostInput    = Omit<ComexCostItem, 'id' | 'created_at'>
