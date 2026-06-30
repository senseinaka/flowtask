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

export type ContactType = 'collaborator' | 'family' | 'friend' | 'other' | 'client' | 'provider'

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  collaborator: 'Colaborador',
  family: 'Familiar',
  friend: 'Amigo',
  other: 'Otro',
  client: 'Cliente',
  provider: 'Proveedor'
}

export const CONTACT_TYPE_COLORS: Record<ContactType, string> = {
  collaborator: '#6366f1',
  family: '#10b981',
  friend: '#f59e0b',
  other: '#64748b',
  client: '#3b82f6',
  provider: '#f97316'
}

export interface ContactPhone {
  numero: string
  etiqueta: 'personal' | 'trabajo' | 'otro'
}

export interface ContactEmail {
  direccion: string
  etiqueta: 'personal' | 'trabajo' | 'otro'
}

export interface Contact {
  id: string
  name: string
  phone: string       // legacy — primer teléfono sin formato
  email: string       // legacy — primer email
  notes: string
  type: ContactType
  avatar_color: string
  created_at: number
  updated_at: number
  // campos v97
  company: string
  role: string
  phones: ContactPhone[]
  emails: ContactEmail[]
  tags: string[]
  favorito: number    // 0 | 1
}

export interface CreateContactInput {
  name: string
  phone?: string
  email?: string
  notes?: string
  type?: ContactType
  company?: string
  role?: string
  phones?: ContactPhone[]
  emails?: ContactEmail[]
  tags?: string[]
  favorito?: number
}

export interface AgendaGrupo {
  id: string
  nombre: string
  descripcion: string
  color: string
  created_at: number
  updated_at: number
  member_count?: number
}

export interface CreateAgendaGrupoInput {
  nombre: string
  descripcion?: string
  color?: string
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

export interface PowerSyncStatusInfo {
  connected: boolean
  connecting: boolean
  uploading: boolean
  downloading: boolean
  lastSyncedAt: number | null
  hasError: boolean
  /** Motivo por el que ni siquiera se intentó conectar (config faltante, sin sesión), o null si no aplica. */
  configError: string | null
  /** Texto del último error de subida/descarga, o null si no hubo. */
  lastErrorMessage: string | null
}

export interface UpdateCheckResult {
  status: 'dev' | 'available' | 'not-available' | 'error'
  currentVersion: string
  latestVersion?: string
  message?: string
}

export interface UpdateDownloadProgress {
  percent: number
  transferredBytes: number
  totalBytes: number
  bytesPerSecond: number
}

// ── Fase 6: Autenticación (Supabase Auth) ───────────────────────────────────

export interface AuthSession {
  userId: string
  email: string
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export interface AuthLoginResult {
  ok: boolean
  session?: AuthSession
  error?: string
}

export interface UserPermission {
  id: string
  user_id: string
  module_key: string
  submodule_key: string | null
  level: 'none' | 'read' | 'write'
  created_at: number
  updated_at: number
  workspace_id: string
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
  | 'planning' | 'ordered' | 'paid' | 'production' | 'carga_armada' | 'esperando_embarcar'
  | 'forwarder' | 'cotizacion_pedida' | 'forwarder_seleccionado'
  | 'shipped'  | 'transit' | 'arrived' | 'customs' | 'oficializado' | 'carga_deposito' | 'delivered'

export type DocumentType =
  | 'invoice' | 'packing_list' | 'bill_of_lading' | 'certificate_of_origin'
  | 'customs_declaration' | 'payment_receipt' | 'insurance' | 'other'

export type DocumentStatus     = 'pending' | 'received' | 'approved'
export type DriveDocStatus     = 'none' | 'uploading' | 'synced' | 'error'
export type FreightQuoteStatus = 'requested' | 'quoted' | 'selected' | 'rejected'
export type ComexPaymentStatus = 'pending' | 'completed'
export type PaymentMethod      = 'advance' | 'wire' | 'lc' | 'other'
export type FreightCompanyType = 'agente' | 'naviera' | 'courier' | 'aereo' | 'otro'
export type CargoType          = 'LCL' | 'FCL' | 'aereo' | 'courier'

export const IMPORT_STATUS_LABELS: Record<ImportStatus, string> = {
  planning:              'Planificación',
  ordered:               'Pedido enviado',
  paid:                  'Pago realizado',
  production:            'En producción',
  carga_armada:          'Carga armada',
  esperando_embarcar:    'Esperando embarcar',
  forwarder:             'Forwarder sin cotizar',
  cotizacion_pedida:     'Forwarder cotización pedida',
  forwarder_seleccionado:'Forwarder seleccionado',
  shipped:               'Embarcado',
  transit:      'En tránsito',
  arrived:      'Arribado',
  customs:      'Traslado a depósito fiscal',
  oficializado:    'Oficializado',
  carga_deposito:  'Carga en depósito',
  delivered:       'Entregado'
}

export const IMPORT_STATUS_COLORS: Record<ImportStatus, string> = {
  planning:              '#94a3b8',  // slate
  ordered:               '#60a5fa',  // blue
  paid:                  '#34d399',  // emerald
  production:            '#f59e0b',  // amber
  carga_armada:          '#fb923c',  // orange — misma familia proveedor
  esperando_embarcar:    '#f97316',  // orange oscuro — misma familia proveedor
  forwarder:             '#38bdf8',  // sky — grupo forwarder
  cotizacion_pedida:     '#0ea5e9',  // sky oscuro
  forwarder_seleccionado:'#0284c7',  // sky más oscuro
  shipped:               '#6366f1',  // indigo
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

export const FREIGHT_QUOTE_STATUS_LABELS: Record<FreightQuoteStatus, string> = {
  requested: 'Solicitado',
  quoted:    'Cotizado',
  selected:  'Seleccionado',
  rejected:  'Rechazado'
}

export const FREIGHT_QUOTE_STATUS_COLORS: Record<FreightQuoteStatus, string> = {
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
  logo_data: string | null
  created_at: number
  updated_at: number
}

export type CreateComexFreightOperatorInput = Omit<ComexFreightOperator, 'id' | 'created_at' | 'updated_at' | 'logo_data'>

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
  logo_data:      string | null
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

export type CreateComexGestorInput         = Omit<ComexGestor, 'id' | 'created_at' | 'updated_at' | 'contacts' | 'logo_stored_name' | 'logo_data'>
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
  logo_data:        string | null
  created_at:       number
  updated_at:       number
  // relacional
  contacts?:        ComexDespachanteContact[]
}

export type CreateComexDespachanteInput = Omit<ComexDespachante, 'id' | 'created_at' | 'updated_at' | 'logo_stored_name' | 'logo_data' | 'contacts'>

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

/**
 * Backup local — copia completa (DB + adjuntos) en una carpeta del disco,
 * independiente de si Google Drive está conectado o no. Pensada como red de
 * seguridad adicional: si la carpeta elegida está dentro de OneDrive/Drive
 * File Stream/Dropbox, también queda replicada en la nube "gratis".
 */
export interface LocalBackupStatus {
  timestamp: string     // ISO string
  success:   boolean
  folder?:   string     // ruta absoluta de la carpeta del backup
  sizeMB?:   string
  error?:    string
}

/** Una copia local disponible para restaurar (carpeta con fecha + datos del manifest.json). */
export interface LocalBackupEntry {
  folder:      string   // nombre de la subcarpeta, ej. "2026-06-07_10-30"
  path:        string   // ruta absoluta completa
  timestamp:   string   // ISO string (del manifest)
  dbSizeMB?:   string
  totalSizeMB?: string
}

/** Resultado de restaurar una copia local — si success, la app debe reiniciarse para aplicarla. */
export interface RestoreResult {
  success:      boolean
  error?:       string
  willRestart?: boolean
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

// Datos personales de contacto del usuario (para recibir notificaciones propias)
export interface PersonalContactInfo {
  name:            string
  whatsapp_number: string
  email:           string
  other:           string
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
  // Desglose de lead time (Programación Pedidos)
  production_days: number | null
  preparation_days: number | null
  transit_days: number | null
  customs_days: number | null
  local_delivery_days: number | null
  moq: number | null                       // cantidad mínima de compra
  non_operational_periods_json: string     // JSON: [{ "start": "...", "end": "...", "label": "..." }]
  reliability_notes: string
  // Pickup
  pickup_address: string  // Dirección de retiro de mercadería
  // Marca / Demanda (consolidado desde comex_brands en v79)
  category: string
  demand_annual: number | null
  demand_monthly_json: string             // JSON: { "1": 120, "2": 95, ... }
  current_stock: number | null
  safety_stock: number | null
  purchase_frequency_days: number | null
  // Legacy (mantenidos por compatibilidad)
  contact_name: string
  contact_email: string
  contact_phone: string
  notes: string
  logo_stored_name: string | null
  logo_data: string | null
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
  carga_armada_date:          number | null   // → sub-estado proveedor: carga armada
  esperando_embarcar_date:    number | null   // → sub-estado proveedor: en terminal
  aviso_arribo_date:          number | null   // → auto-avanza a 'arrived'
  traslado_deposito_date:     number | null   // → auto-avanza a 'customs'
  oficializacion_import_date: number | null   // → sugiere 'oficializado'
  carga_deposito_date:        number | null   // → auto-avanza a 'carga_deposito'
  carga_deposito_time:        string | null   // "HH:MM" hora del turno
  despachante:            string          // "Dario Valero" | "Iván Balarino" | ""
  forwarder_ref_mail:     string          // ref. de mail al forwarder
  bl_number:              string          // BL / AWB (puede auto-llenarse del despacho)
  // ── Docs enviados ────────────────────────────────────────────────────────────
  docs_to_despachante:      0 | 1           // Docs enviados al despachante
  docs_to_despachante_date: number | null    // Timestamp del envío (DD/MM año en curso)
  docs_to_compras:          0 | 1           // Docs enviados a compras
  docs_to_compras_date:     number | null    // Timestamp del envío
  // ── Pago ─────────────────────────────────────────────────────────────────────
  payment_terms:     'anticipado' | 'a_plazo' | null
  payment_due_date:  number | null
  payment_notes:     string
  // ── Campos del JOIN (solo en queries de lista) ─────────────────────────────
  _despacho_number?:        string | null
  _canal_despacho?:         string | null
  _supplier_logo?:          string | null   // logo_stored_name del proveedor
  _supplier_logo_data?:     string | null   // logo_data del proveedor
  // Datos de carga del JOIN con customs (para la tarjeta de importación)
  _peso_bruto_kg?:            number | null
  _volumen_m3?:               number | null
  _cant_bultos?:              number | null
  _cant_pallets_customs?:     number | null
  _freight_operator_name?:    string | null
  _oficializacion_date?:      number | null   // fecha oficialización del despacho (del JOIN)
  _despacho_amount?:          number | null   // valor declarado en aduana (fob_declared del JOIN)
  _despacho_currency?:        string | null   // moneda del despacho (fob_currency del JOIN)
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
  operator_id: string | null
  operator_name: string
  contact: string
  cargo_type: CargoType
  quote_amount: number | null
  currency: string
  services_included: string
  valid_until: number | null
  status: FreightQuoteStatus
  rfq_sent_at: number | null
  rfq_email_text: string
  notes: string
  quote_html: string
  quote_received_at: number | null
  created_at: number
}

export interface ComexQuoteFile {
  id: string
  quote_id: string
  import_id: string
  file_name: string
  file_size: number | null
  drive_file_id: string
  drive_folder_id: string | null
  mime_type: string
  workspace_id: string | null
  created_at: number
  updated_at: number
}

export interface ComexImportPlFile {
  id: string
  import_id: string
  workspace_id: string
  stored_name: string | null
  original_name: string | null
  drive_file_id: string | null
  drive_status: DriveDocStatus
  extracted_json: string | null
  sort_order: number
  created_at: number
}

export type ComexMoneda = 'USD' | 'EUR'

export interface ComexCotizacion {
  id: string
  workspace_id: string
  moneda: ComexMoneda
  valor_ars: number
  nota: string | null
  created_at: number
}

export interface BcraRateEntry {
  moneda: ComexMoneda
  fecha: string       // 'YYYY-MM-DD'
  tipo?: 'billete' | 'divisa'
  valor: number
}

export interface BcraCotizacionHoy {
  moneda: ComexMoneda
  fecha: string
  billete_venta: number | null
  divisa_venta:  number | null
}

export type AlarmaDireccion    = 'supera' | 'cae_bajo'
export type AlarmaTipoUmbral   = 'porcentaje' | 'valor'
export type AlarmaTipoCotizacion = 'billete' | 'divisa' | 'cualquiera'

export interface ComexAlarmaCotizacion {
  id:               string
  moneda:           ComexMoneda
  tipo_cotizacion:  AlarmaTipoCotizacion
  tipo_umbral:      AlarmaTipoUmbral
  umbral:           number
  direccion:        AlarmaDireccion
  activa:           number   // 0 | 1
  whatsapp_numero:  string | null
  cooldown_horas:   number
  ultima_alerta_at: number | null
  created_at:       number
}

export type CreateAlarmaCotizacionInput = Omit<ComexAlarmaCotizacion, 'id' | 'ultima_alerta_at' | 'created_at'>

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

// ─── Vencimientos ─────────────────────────────────────────────────────────────

export type ExpiryFrequency =
  | 'once'          // sin renovación
  | 'monthly'       // mensual
  | 'quarterly'     // trimestral
  | 'biannual'      // semestral
  | 'annual'        // anual
  | 'biennial'      // bienal (2 años)
  | 'triennial'     // trienal (3 años)
  | 'quinquennial'  // quinquenal (5 años)
  | 'custom'        // personalizado en días

export type ExpiryUrgency = 'overdue' | 'urgent' | 'soon' | 'upcoming' | 'ok' | 'renewed'

export interface ExpiryCategory {
  id:         string
  name:       string
  icon:       string    // emoji
  color:      string    // hex
  is_default: number    // 0 | 1
  created_at: number
  updated_at: number
}

export interface ExpiryItem {
  id:                   string
  category_id:          string
  category?:            ExpiryCategory
  title:                string
  description:          string
  holder:               string          // titular del documento
  expiry_date:          number          // timestamp ms
  frequency:            ExpiryFrequency
  frequency_custom_days: number | null  // solo para 'custom'
  is_renewed:           number          // 0 | 1
  renewed_date:         number | null
  next_expiry_date:     number | null   // calculado al renovar
  notes:                string
  created_at:           number
  updated_at:           number
}

export interface ExpiryAlert {
  id:               string
  item_id:          string
  days_before:      number
  channel:          'whatsapp' | 'inapp' | 'both'
  whatsapp_number:  string
  last_sent_at:     number | null
  created_at:       number
}

export interface CreateExpiryItemInput {
  category_id:           string
  title:                 string
  description?:          string
  holder?:               string
  expiry_date:           number
  frequency:             ExpiryFrequency
  frequency_custom_days?: number | null
  notes?:                string
}

export interface CreateExpiryAlertInput {
  days_before:      number
  channel:          'whatsapp' | 'inapp' | 'both'
  whatsapp_number?: string
}

export const EXPIRY_FREQUENCY_LABELS: Record<ExpiryFrequency, string> = {
  once:         'Sin renovación',
  monthly:      'Mensual',
  quarterly:    'Trimestral',
  biannual:     'Semestral',
  annual:       'Anual',
  biennial:     'Bienal (2 años)',
  triennial:    'Trienal (3 años)',
  quinquennial: 'Quinquenal (5 años)',
  custom:       'Personalizado',
}

export const EXPIRY_FREQUENCY_DAYS: Record<ExpiryFrequency, number | null> = {
  once:         null,
  monthly:      30,
  quarterly:    91,
  biannual:     182,
  annual:       365,
  biennial:     730,
  triennial:    1095,
  quinquennial: 1825,
  custom:       null,
}

export const EXPIRY_URGENCY_COLORS: Record<ExpiryUrgency, string> = {
  overdue: '#ef4444',  // red
  urgent:  '#f97316',  // orange
  soon:    '#f59e0b',  // amber
  upcoming:'#3b82f6',  // blue
  ok:      '#10b981',  // emerald
  renewed: '#64748b',  // slate
}

export const EXPIRY_URGENCY_LABELS: Record<ExpiryUrgency, string> = {
  overdue: 'Vencido',
  urgent:  'Urgente',
  soon:    'Próximo',
  upcoming:'En radar',
  ok:      'Ok',
  renewed: 'Renovado',
}

export const DEFAULT_EXPIRY_CATEGORIES: Omit<ExpiryCategory, 'id' | 'created_at' | 'updated_at'>[] = [
  { name: 'Documentos personales',  icon: '🪪', color: '#3b82f6', is_default: 1 },
  { name: 'Documentos societarios', icon: '🏢', color: '#8b5cf6', is_default: 1 },
  { name: 'Dominios web',           icon: '🌐', color: '#06b6d4', is_default: 1 },
  { name: 'Seguros',                icon: '🛡️', color: '#10b981', is_default: 1 },
  { name: 'Contratos',              icon: '📋', color: '#f59e0b', is_default: 1 },
  { name: 'Legales / Registros',    icon: '⚖️', color: '#f97316', is_default: 1 },
  { name: 'Membresías',             icon: '🎫', color: '#ec4899', is_default: 1 },
]

// ═══════════════════════════════════════════════════════════════════════════
// Finanzas Personales
// ═══════════════════════════════════════════════════════════════════════════

export type FinanceMovementStatus = 'no_status' | 'pending' | 'paid' | 'overdue'
/**
 * Antes era un union type fijo de 6 valores. Ahora es un id de texto libre que
 * referencia la tabla `finance_payment_methods` — entidad gestionable por el
 * usuario (alta/edición/borrado), igual que categorías o cuentas. Los 6 ids
 * originales ('cash' | 'transfer' | 'debit_auto' | 'debit_card' | 'credit_card'
 * | 'other') se siguen sembrando como métodos "de fábrica" (`is_default=1`,
 * no eliminables) para no requerir migrar los `payment_method` ya guardados.
 */
export type FinancePaymentMethod = string
export type FinanceExpenseType = 'fixed' | 'variable'      // fijo | variable
export type FinanceRecurrence  = 'monthly' | 'biweekly' | 'annual' | 'one_time'

export interface FinanceAccount {
  id:         string
  name:       string
  icon:       string    // emoji
  color:      string    // hex
  is_default: number    // 0 | 1
  created_at: number
  updated_at: number
}

export interface FinanceCategory {
  id:         string
  name:       string
  icon:       string    // emoji
  color:      string    // hex
  is_default: number    // 0 | 1
  created_at: number
  updated_at: number
}

/**
 * Entidad gestionable que respalda los valores de `FinancePaymentMethod`
 * (que ahora es solo un id de texto). Mismo esquema que `FinanceCategory` /
 * `FinanceAccount`: `is_default=1` marca los 6 métodos "de fábrica"
 * sembrados en la migración (no eliminables desde la UI).
 */
export interface FinancePaymentMethodEntity {
  id:         string
  name:       string
  icon:       string    // emoji
  color:      string    // hex
  is_default: number    // 0 | 1
  created_at: number
  updated_at: number
}

export interface FinanceConcept {
  id:             string
  category_id:    string
  category?:      FinanceCategory
  account_id:     string
  account?:       FinanceAccount
  name:           string
  default_amount: number
  expense_type:   FinanceExpenseType
  payment_method: FinancePaymentMethod
  recurrence:     FinanceRecurrence
  recurrence_month: number | null  // 1-12, solo aplica cuando recurrence='annual' (mes del año en que se genera)
  /**
   * Cuando vale 1, el concepto admite "registro de cargas": en vez de un único
   * monto por mes, su movimiento mensual acumula una sub-lista de entradas
   * (ej. "Nafta 1: $5.000 (03/06)", "Nafta 2: $4.500 (18/06)") y `amount_actual`
   * se recalcula automáticamente como la suma — pensado para gastos variables
   * que ocurren más de una vez al mes (combustible, supermercado, salidas...).
   * Reemplaza el viejo workaround de crear "Nafta 1", "Nafta 2" como conceptos
   * separados (Opción C del plan maestro de consolidación).
   */
  tracks_multiple_entries: number   // 0 | 1
  /**
   * Tarifa por hora (jornal) y viático fijo por jornada para conceptos de
   * "personal doméstico" (ej. Sandra). Cuando `hourly_rate > 0`, al registrar
   * una carga se puede tipear la cantidad de horas y el monto se calcula como
   * `horas * hourly_rate + viatic_amount`, autocompletando además la nota.
   * 0 = no aplica (el concepto se carga sólo por monto, como cualquier otro).
   */
  hourly_rate:    number
  viatic_amount:  number
  is_active:      number   // 0 | 1
  notes:          string
  created_at:     number
  updated_at:     number
}

export interface FinanceMovement {
  id:               string
  concept_id:       string
  concept?:         FinanceConcept
  month:            number          // 1-12
  year:             number
  amount_estimated: number
  amount_actual:    number | null
  status:           FinanceMovementStatus
  payment_method:   FinancePaymentMethod
  payment_date:     number | null   // timestamp ms
  due_date:         number | null   // timestamp ms
  notes:            string
  created_at:       number
  updated_at:       number
  /**
   * Lo que se pagó realmente (amount_actual) por este mismo concepto en el mes
   * calendario inmediatamente anterior — null si no hubo movimiento o no se
   * registró un pago. Se computa al vuelo en `listFinanceMovements` (no se
   * persiste). Reemplaza a la columna "Estimado" en la tabla principal: permite
   * comparar de un vistazo lo pagado el mes pasado contra lo de este mes.
   * Puede venir `undefined` en endpoints que no lo calculan (ej. movimientos
   * "próximos" que abarcan varios períodos).
   */
  previous_month_amount?: number | null
  /**
   * Cantidad de cargas individuales registradas (solo relevante si
   * concept.tracks_multiple_entries = 1). Se computa al vuelo junto con la
   * lista de movimientos — null/undefined para conceptos que no llevan registro
   * de cargas. Permite mostrar "3 cargas · $23.500" sin pedir las entradas.
   */
  entries_count?: number | null
}

/** Una "carga" individual dentro del registro de un movimiento — ej. una de las
 *  varias veces que se cargó nafta o se fue al supermercado en el mes. La suma
 *  de sus `amount` recalcula automáticamente `amount_actual` del movimiento
 *  padre (ver `recalcMovementFromEntries` en queries/finance.ts). */
export interface FinanceMovementEntry {
  id:          string
  movement_id: string
  amount:      number
  entry_date:  number | null   // timestamp ms — fecha de la carga (opcional; "—" si no se especifica)
  note:        string
  created_at:  number
  updated_at:  number
}

export interface CreateFinanceMovementEntryInput {
  movement_id: string
  amount:      number
  entry_date?: number | null
  note?:       string
}

export interface UpdateFinanceMovementEntryInput {
  amount?:     number
  entry_date?: number | null
  note?:       string
}

export interface CreateFinanceAccountInput {
  name:  string
  icon?: string
  color?: string
}

export interface CreateFinanceCategoryInput {
  name:  string
  icon?: string
  color?: string
}

export interface CreateFinancePaymentMethodInput {
  name:  string
  icon?: string
  color?: string
}

export interface CreateFinanceConceptInput {
  category_id:     string
  account_id:      string
  name:            string
  default_amount?: number
  expense_type?:   FinanceExpenseType
  payment_method?: FinancePaymentMethod
  recurrence?:     FinanceRecurrence
  recurrence_month?: number | null
  tracks_multiple_entries?: number   // 0 | 1 — ver FinanceConcept.tracks_multiple_entries
  hourly_rate?:    number   // jornal por hora — ver FinanceConcept.hourly_rate
  viatic_amount?:  number   // viático fijo por jornada — ver FinanceConcept.hourly_rate
  notes?:          string
}

export interface CreateFinanceMovementInput {
  concept_id:        string
  month:             number
  year:              number
  amount_estimated?: number
  amount_actual?:    number | null
  status?:           FinanceMovementStatus
  payment_method?:   FinancePaymentMethod
  payment_date?:     number | null
  due_date?:         number | null
  notes?:            string
}

export interface FinanceMonthSummary {
  month:               number
  year:                number
  totalEstimated:      number
  totalActual:         number
  totalPaid:           number
  totalPending:        number
  totalOverdue:        number
  prevMonthTotalActual: number | null
  diffAmount:          number | null   // totalActual - prevMonthTotalActual
  diffPercent:         number | null   // (diffAmount / prevMonthTotalActual) * 100
  upcomingDueCount:    number          // movimientos pendientes con vencimiento en los próx. 7 días
  biggestIncrease:     { conceptName: string; diffAmount: number; diffPercent: number | null } | null
  topCategory:         { categoryName: string; total: number } | null
}

// ── Notas y análisis IA del mes (Dashboard) ───────────────────────────────────
//
// A diferencia de FinanceMonthSummary/breakdown/etc. (todo computado al vuelo),
// esto SÍ se persiste — son anotaciones del usuario explicando variaciones del
// gasto, y el análisis comparativo que genera la IA cuando el usuario pide
// "Guardar" (no es un chat efímero: queda guardado por mes/año y visible al
// volver a entrar). Una fila por (month, year) — UNIQUE en la tabla.
export interface FinanceMonthInsight {
  id:              string
  month:           number
  year:            number
  notes:           string           // comentario libre del usuario sobre el mes
  ai_analysis:     string | null    // último análisis comparativo guardado (o null si nunca se guardó uno)
  ai_generated_at: number | null    // epoch ms de cuándo se guardó ese análisis
  created_at:      number
  updated_at:      number
}

// ── Visualización / análisis (Fase 3) ─────────────────────────────────────────
//
// Igual que FinanceMonthSummary: todo se computa al vuelo a partir de los
// movimientos crudos del período pedido — nada de esto se persiste en la base.

/** Desglose del gasto del mes agrupado por categoría, con sus conceptos principales. */
export interface FinanceCategoryBreakdownItem {
  categoryId:     string | null
  categoryName:   string
  categoryIcon:   string
  categoryColor:  string
  totalEstimated: number
  totalActual:    number
  count:          number          // cantidad de movimientos
  percent:        number          // % del gasto total del mes (sobre totalActual)
  topConcepts:    { conceptId: string; conceptName: string; amount: number }[]
}

/** Punto de la serie histórica: totales de un mes + variación vs. el mes inmediatamente anterior. */
export interface FinanceHistoryEntry {
  month:          number
  year:           number
  totalEstimated: number
  totalActual:    number
  totalPaid:      number
  totalPending:   number
  totalOverdue:   number
  diffPercent:    number | null   // vs. el mes calendario anterior (null si no hay datos para comparar)
  /**
   * Cantidad de movimientos cargados ese mes. Permite distinguir "mes sin
   * movimientos generados todavía" (0 — los totales en $0 no significan nada)
   * de "mes con movimientos pero gasto real $0" (poco común, pero posible).
   * Clave para el estado vacío del Histórico tras un reinicio del módulo.
   */
  movementsCount: number
}

/** Ítem del ranking "Top conceptos": los gastos individuales más altos del mes. */
export interface FinanceRankingConcept {
  conceptId:     string
  conceptName:   string
  categoryName:  string
  categoryIcon:  string
  categoryColor: string
  amount:        number
  percent:       number   // % del gasto total del mes
}

/** Ítem del ranking "Mayores aumentos": conceptos que más subieron vs. el mes anterior. */
export interface FinanceRankingIncrease {
  conceptId:      string
  conceptName:    string
  categoryName:   string
  previousAmount: number
  currentAmount:  number
  diffAmount:     number
  diffPercent:    number | null
}

// ═══════════════════════════════════════════════════════════════════════════
// Finanzas Personales — Fase 5: Importación / Exportación / Seguridad
// ═══════════════════════════════════════════════════════════════════════════

/** Por qué una fila del archivo importado no se puede cargar tal cual (o requiere decisión del usuario). */
export type FinanceImportIssue = 'ok' | 'concept_not_found' | 'invalid_amount' | 'duplicate'

/** Una fila ya parseada del Excel/CSV, enriquecida con el resultado del matching contra conceptos existentes y la detección de duplicados — lista para mostrarse en la previsualización. */
export interface FinanceImportPreviewItem {
  rowIndex:           number
  rawConceptName:     string
  matchedConceptId:   string | null
  matchedConceptName: string | null
  categoryName:       string | null
  amount:             number | null
  status:             FinanceMovementStatus
  paymentDate:        number | null
  notes:              string
  issue:              FinanceImportIssue
  existingMovementId: string | null   // si issue='duplicate': el movimiento ya cargado para ese concepto+período
}

/** Resultado de parsear el archivo: filas listas para preview + metadatos del archivo. */
export interface FinanceImportPreviewResult {
  fileName: string
  month:    number
  year:     number
  items:    FinanceImportPreviewItem[]
}

/** Una fila que el usuario confirmó importar (tras revisar la previsualización). */
export interface FinanceImportConfirmItem {
  rowIndex:        number
  conceptId:       string
  amount:          number
  status:          FinanceMovementStatus
  paymentDate:     number | null
  notes:           string
  /** Si es un duplicado y el usuario eligió sobreescribir, el id del movimiento existente a actualizar. */
  overwriteMovementId: string | null
}

export interface FinanceImportResult {
  imported: number
  updated:  number
  skipped:  number
}

/** Estado de seguridad del módulo (sin exponer nunca el PIN ni su hash). */
export interface FinanceSecurityStatus {
  enabled: boolean
}

export const FINANCE_STATUS_LABELS: Record<FinanceMovementStatus, string> = {
  no_status: 'Sin estado',
  pending:   'Pendiente',
  paid:      'Pagado',
  overdue:   'Vencido',
}

export const FINANCE_STATUS_COLORS: Record<FinanceMovementStatus, string> = {
  no_status: '#64748b',  // slate (neutro)
  pending:   '#f59e0b',  // amber
  paid:      '#10b981',  // emerald
  overdue:   '#ef4444',  // red
}

/**
 * Orden del ciclo al hacer click sobre el estado de un movimiento.
 * - Movimientos NO recurrentes (one_time / variables sin patrón fijo): arrancan
 *   en "Sin estado" porque pueden no llegar a ocurrir — el ciclo completo
 *   refleja eso: Sin estado → Pendiente → Pagado → Sin estado...
 * - Movimientos recurrentes: arrancan en "Pendiente" (se sabe que van a pasar)
 *   y ciclan solo entre Pendiente ⇄ Pagado.
 * "Vencido" NO forma parte de ningún ciclo: es un estado derivado de la fecha
 * de vencimiento (ver getDisplayStatus en useFinance.ts) y un click sobre él
 * salta directo a "Pagado".
 */
export const FINANCE_STATUS_CYCLE_NON_RECURRING: FinanceMovementStatus[] = ['no_status', 'pending', 'paid']
export const FINANCE_STATUS_CYCLE_RECURRING: FinanceMovementStatus[] = ['pending', 'paid']

/**
 * Etiquetas de los 6 métodos "de fábrica" — hoy son solo el `seed` de
 * `finance_payment_methods` y un fallback para ids que no se encuentren en la
 * lista dinámica (p.ej. datos antiguos). La fuente de verdad para mostrar
 * nombres/colores/emojis es la tabla gestionable (ver `useFinancePaymentMethods`
 * y `PaymentMethodsManager`), que permite agregar métodos propios.
 */
export const FINANCE_PAYMENT_METHOD_LABELS: Record<FinancePaymentMethod, string> = {
  cash:        'Efectivo',
  transfer:    'Transferencia',
  debit_auto:  'Débito automático',
  debit_card:  'Tarjeta de débito',
  credit_card: 'Tarjeta de crédito',
  other:       'Otro',
}

export const FINANCE_EXPENSE_TYPE_LABELS: Record<FinanceExpenseType, string> = {
  fixed:    'Fijo',
  variable: 'Variable',
}

export const FINANCE_RECURRENCE_LABELS: Record<FinanceRecurrence, string> = {
  monthly:  'Mensual',
  biweekly: 'Quincenal',
  annual:   'Anual',
  one_time: 'Puntual',
}

export const DEFAULT_FINANCE_ACCOUNTS: Omit<FinanceAccount, 'id' | 'created_at' | 'updated_at'>[] = [
  { name: 'Personal', icon: '👤', color: '#10b981', is_default: 1 },
]

export const DEFAULT_FINANCE_CATEGORIES: Omit<FinanceCategory, 'id' | 'created_at' | 'updated_at'>[] = [
  { name: 'Hogar fijo mensual',  icon: '🏠', color: '#3b82f6', is_default: 1 },
  { name: 'Ciro Jano Maia',      icon: '👨‍👩‍👧‍👦', color: '#ec4899', is_default: 1 },
  { name: 'Personal',            icon: '🙋', color: '#8b5cf6', is_default: 1 },
  { name: 'Salidas',             icon: '🍽️', color: '#f97316', is_default: 1 },
  { name: 'Tarjetas',            icon: '💳', color: '#ef4444', is_default: 1 },
  { name: 'Auto Lancha',         icon: '🚤', color: '#06b6d4', is_default: 1 },
  { name: 'Varios',              icon: '📦', color: '#64748b', is_default: 1 },
  { name: 'Refacciones hogar',   icon: '🔨', color: '#f59e0b', is_default: 1 },
]

// ════════════════════════════════════════════════════════════════════════════
// ── Programación Pedidos (Comex) ──────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════

// ── Marcas ─────────────────────────────────────────────────────────────────────

export interface ComexBrand {
  id: string
  name: string
  category: string
  primary_supplier_id: string | null
  demand_annual: number | null
  demand_monthly_json: string   // JSON: { "1": 120, "2": 95, ... } (mes -> unidades)
  current_stock: number | null
  safety_stock: number | null
  purchase_frequency_days: number | null
  notes: string
  logo_stored_name: string | null
  logo_data: string | null
  created_at: number
  updated_at: number
  // relacional
  primary_supplier?: ComexSupplier
}

export type CreateComexBrandInput = Omit<ComexBrand, 'id' | 'created_at' | 'updated_at' | 'primary_supplier' | 'logo_stored_name' | 'logo_data'>

// ── Programaciones de pedido ──────────────────────────────────────────────────

export const PLANNING_TYPES = ['single', 'recurring', 'annual', 'demand_based'] as const
export type PlanningType = typeof PLANNING_TYPES[number]

export const PLANNING_TYPE_LABELS: Record<PlanningType, string> = {
  single:        'Pedido único',
  recurring:     'Pedidos recurrentes',
  annual:        'Planificación anual',
  demand_based:  'Reposición por demanda',
}

export const PLANNING_STATUSES = [
  'draft', 'analysis', 'ai_recommended', 'pending_approval',
  'approved', 'order_placed', 'rescheduled', 'cancelled', 'completed'
] as const
export type PlanningStatus = typeof PLANNING_STATUSES[number]

export const PLANNING_STATUS_LABELS: Record<PlanningStatus, string> = {
  draft:            'Borrador',
  analysis:         'En análisis',
  ai_recommended:   'Recomendada por IA',
  pending_approval: 'Pendiente de aprobación',
  approved:         'Aprobada',
  order_placed:     'Pedido activado',
  rescheduled:      'Reprogramada',
  cancelled:        'Cancelada',
  completed:        'Completada',
}

export const PLANNING_RISK_STATUSES = ['on_time', 'tight', 'at_risk', 'late'] as const
export type PlanningRiskStatus = typeof PLANNING_RISK_STATUSES[number]

export const PLANNING_RISK_LABELS: Record<PlanningRiskStatus, string> = {
  on_time: 'A tiempo',
  tight:   'Justa',
  at_risk: 'En riesgo',
  late:    'Tarde',
}

export const PLANNING_RISK_COLORS: Record<PlanningRiskStatus, string> = {
  on_time: '#22c55e',
  tight:   '#eab308',
  at_risk: '#f97316',
  late:    '#ef4444',
}

export const PLANNING_PRIORITIES = ['high', 'medium', 'low'] as const
export type PlanningPriority = typeof PLANNING_PRIORITIES[number]

export const PLANNING_PRIORITY_LABELS: Record<PlanningPriority, string> = {
  high:   'Alta',
  medium: 'Media',
  low:    'Baja',
}

export interface ImportOrderPlanning {
  id: string
  brand_id: string
  supplier_id: string | null
  country: string
  responsible_user_id: string
  planning_type: PlanningType
  status: PlanningStatus
  risk_status: PlanningRiskStatus
  priority: PlanningPriority

  target_coverage_start_date: number | null
  target_coverage_end_date: number | null
  target_commercial_availability_date: number | null
  recommended_order_date: number | null
  approval_deadline_date: number | null
  estimated_reception_date: number | null

  demand_annual_estimated: number | null
  demand_monthly_estimated: number | null
  demand_for_period: number | null
  current_stock: number | null
  safety_stock: number | null
  desired_coverage_months: number | null

  internal_approval_days: number
  supplier_preparation_days: number
  production_days: number
  inspection_days: number
  shipping_days: number
  customs_days: number
  local_delivery_days: number
  safety_days: number
  total_lead_time_days: number

  ai_recommendation_summary: string | null
  ai_risk_explanation: string | null
  notes: string
  linked_import_id: string | null

  created_at: number
  updated_at: number

  // relacional
  brand?: ComexBrand
  supplier?: ComexSupplier
  milestones?: ImportOrderPlanningMilestone[]
}

export type CreateImportOrderPlanningInput = Omit<ImportOrderPlanning,
  'id' | 'created_at' | 'updated_at' | 'brand' | 'supplier' | 'milestones'
>

// ── Hitos ──────────────────────────────────────────────────────────────────────

export const PLANNING_MILESTONE_TYPES = [
  'internal_analysis', 'approval', 'supplier_order', 'preparation', 'production',
  'inspection', 'shipping', 'arrival', 'customs', 'reception', 'commercial_availability'
] as const
export type PlanningMilestoneType = typeof PLANNING_MILESTONE_TYPES[number]

export const PLANNING_MILESTONE_LABELS: Record<PlanningMilestoneType, string> = {
  internal_analysis:        'Análisis interno',
  approval:                  'Aprobación',
  supplier_order:            'Pedido al proveedor',
  preparation:               'Preparación',
  production:                'Producción',
  inspection:                'Inspección',
  shipping:                  'Embarque',
  arrival:                   'Arribo',
  customs:                   'Nacionalización',
  reception:                 'Recepción',
  commercial_availability:   'Disponibilidad comercial',
}

export const PLANNING_MILESTONE_STATUSES = ['pending', 'in_progress', 'done', 'delayed'] as const
export type PlanningMilestoneStatus = typeof PLANNING_MILESTONE_STATUSES[number]

export interface ImportOrderPlanningMilestone {
  id: string
  planning_id: string
  milestone_type: PlanningMilestoneType
  estimated_date: number | null
  calculated_date: number | null
  real_date: number | null
  status: PlanningMilestoneStatus
  notes: string
  sort_order: number
  created_at: number
  updated_at: number
}

export type CreateImportOrderPlanningMilestoneInput = Omit<ImportOrderPlanningMilestone, 'id' | 'created_at' | 'updated_at'>

// ── Reportes IA ───────────────────────────────────────────────────────────────

export const PLANNING_AI_REPORT_TYPES = [
  'monthly_orders_to_activate', 'brands_at_risk', 'coverage_by_brand',
  'supplier_delays', 'demand_coverage', 'recommended_orders_by_period', 'critical_alerts'
] as const
export type PlanningAIReportType = typeof PLANNING_AI_REPORT_TYPES[number]

export const PLANNING_AI_REPORT_TYPE_LABELS: Record<PlanningAIReportType, string> = {
  monthly_orders_to_activate:    'Pedidos a activar este mes',
  brands_at_risk:                'Marcas en riesgo',
  coverage_by_brand:              'Cobertura por marca',
  supplier_delays:                'Proveedores con mayor demora',
  demand_coverage:                 'Demanda cubierta vs. pendiente',
  recommended_orders_by_period:   'Pedidos recomendados por período',
  critical_alerts:                 'Alertas críticas',
}

export interface ImportOrderPlanningAIReport {
  id: string
  report_type: PlanningAIReportType
  brand_id: string | null
  supplier_id: string | null
  period_start_date: number | null
  period_end_date: number | null
  summary: string
  findings: string
  recommendations: string
  risks: string
  generated_by: string
  created_at: number
}

export type CreateImportOrderPlanningAIReportInput = Omit<ImportOrderPlanningAIReport, 'id' | 'created_at'>

// ═══════════════════════════════════════════════════════════════════════════
// Calendario / Agenda (Fase 1)
// ═══════════════════════════════════════════════════════════════════════════

/** Fila de la tabla local-only `calendar_events_cache`. */
export interface CalendarEventCache {
  id: string
  google_event_id: string
  google_calendar_id: string
  summary: string
  description: string | null
  location: string | null
  start_at: number
  end_at: number | null
  all_day: number
  status: string | null
  color_id: string | null
  updated_at: number
  fetched_at: number
}

export type CalendarEventSource = 'google' | 'finance' | 'company_finance' | 'comex_planning'

/** Evento unificado: combina cache de Google Calendar con vencimientos/hitos internos. */
export interface UnifiedCalendarEvent {
  id: string
  source: CalendarEventSource
  title: string
  start_at: number
  end_at: number | null
  all_day: boolean
  /** Para 'google': el google_calendar_id. Para otras fuentes: la categoría/módulo. */
  category: string
  /** Ruta interna de Summit para fuentes que no son Google (null para eventos de Google). */
  link: string | null
  description?: string | null
  location?: string | null
}

export interface GoogleCalendarInfo {
  id: string
  summary: string
  description?: string | null
  backgroundColor?: string | null
  primary?: boolean
  accessRole?: string | null
}

export interface CalendarConnectionStatus {
  connected: boolean
  googleEmail: string | null
  enabledCalendarIds: string[]
  lastSyncAt: number | null
}

export interface CalendarWaReminder {
  id: string
  event_id: string
  phone: string
  message: string
  send_at: number
  sent_at: number | null
  success: number | null  // NULL=pendiente, 1=enviado OK, 0=falló
  created_at: number
}

/** Datos de un evento de Google Calendar para crear/editar (Fase 2). */
export interface CalendarEventInput {
  summary: string
  description?: string | null
  location?: string | null
  startAt: number
  endAt: number | null
  allDay: boolean
  reminderMinutes?: number | null
  recurrence?: string[]  // RFC 5545 RRULE strings, ej. ['RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=8']
}

/** Link entre un vencimiento/hito de Summit y un evento de Google Calendar. */
export interface CalendarEventLink {
  id: string
  owner_user_id: string
  source_module: 'finance' | 'company_finance' | 'comex_planning'
  source_type: string
  source_event_id: string
  google_calendar_id: string
  google_event_id: string
  title: string
  created_at: number
  updated_at: number
}

/** Input para vincular un vencimiento/hito a Google Calendar (opt-in). */
export interface LinkEntityInput {
  sourceModule: CalendarEventLink['source_module']
  sourceType: string
  sourceEventId: string
  title: string
  dueAtMs: number
}

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO PRESUPUESTOS
// ─────────────────────────────────────────────────────────────────────────────

export type QuoteStatus =
  | 'new'
  | 'analysis'
  | 'elaborating'
  | 'sent'
  | 'follow_up'
  | 'won'
  | 'lost'
  | 'archived'
  | 'postponed'

export type QuotePriority = 'p1' | 'p2' | 'p3' | 'p4'

export type QuoteChannel = 'email' | 'whatsapp' | 'form' | 'phone' | 'in_person'

export type QuoteActivityType =
  | 'status_change'
  | 'assignment'
  | 'comment'
  | 'value_update'
  | 'follow_up_set'
  | 'lost_reason_set'
  | 'system'

export interface QuoteCompany {
  id: string
  workspace_id: string
  name: string
  industry: string
  website: string
  notes: string
  created_at: number
  updated_at: number
}

export interface QuoteContact {
  id: string
  workspace_id: string
  company_id: string
  name: string
  email: string
  phone: string
  role: string
  created_at: number
  updated_at: number
}

export interface Quote {
  id: string
  workspace_id: string
  title: string
  status: QuoteStatus
  priority: QuotePriority
  channel: QuoteChannel
  assigned_to: string
  company_id: string
  contact_id: string
  estimated_value: number | null
  budgeted_value: number | null
  won_value: number | null
  lost_reason: string
  next_follow_up_at: number | null
  sla_due_at: number | null
  notes: string
  created_at: number
  updated_at: number
}

export interface QuoteActivity {
  id: string
  workspace_id: string
  quote_id: string
  user_id: string
  type: QuoteActivityType
  payload: string
  created_at: number
}

export interface CreateQuoteInput {
  title: string
  priority?: QuotePriority
  channel?: QuoteChannel
  assigned_to?: string
  company_id?: string
  contact_id?: string
  estimated_value?: number | null
  notes?: string
}

export interface UpdateQuoteInput {
  title?: string
  status?: QuoteStatus
  priority?: QuotePriority
  channel?: QuoteChannel
  assigned_to?: string
  company_id?: string
  contact_id?: string
  estimated_value?: number | null
  budgeted_value?: number | null
  won_value?: number | null
  lost_reason?: string
  next_follow_up_at?: number | null
  notes?: string
}

export interface CreateQuoteCompanyInput {
  name: string
  industry?: string
  website?: string
  notes?: string
}

export interface CreateQuoteContactInput {
  company_id: string
  name: string
  email?: string
  phone?: string
  role?: string
}

export interface AddQuoteActivityInput {
  quote_id: string
  user_id: string
  type: QuoteActivityType
  payload: Record<string, unknown>
}

export interface QuoteKPIs {
  total: number
  byStatus: Record<QuoteStatus, number>
  pipelineValue: number
  wonValue: number
  lostCount: number
  avgDaysOpen: number | null
}

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  new: 'Nuevo',
  analysis: 'En Análisis',
  elaborating: 'Elaborando',
  sent: 'Enviado',
  follow_up: 'Seguimiento',
  won: 'Ganado',
  lost: 'Perdido',
  archived: 'Archivado',
  postponed: 'Postergado'
}

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  new: '#64748b',
  analysis: '#3b82f6',
  elaborating: '#8b5cf6',
  sent: '#f59e0b',
  follow_up: '#06b6d4',
  won: '#10b981',
  lost: '#ef4444',
  archived: '#475569',
  postponed: '#94a3b8'
}

export const QUOTE_PRIORITY_LABELS: Record<QuotePriority, string> = {
  p1: 'P1 · Urgente',
  p2: 'P2 · Alta',
  p3: 'P3 · Normal',
  p4: 'P4 · Baja'
}

export const QUOTE_PRIORITY_COLORS: Record<QuotePriority, string> = {
  p1: '#ef4444',
  p2: '#f97316',
  p3: '#3b82f6',
  p4: '#64748b'
}

export const QUOTE_CHANNEL_LABELS: Record<QuoteChannel, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  form: 'Formulario',
  phone: 'Teléfono',
  in_person: 'Presencial'
}

/** SLA en milisegundos por prioridad */
export const QUOTE_SLA_MS: Record<QuotePriority, number> = {
  p1: 24 * 60 * 60 * 1000,
  p2: 72 * 60 * 60 * 1000,
  p3: 7 * 24 * 60 * 60 * 1000,
  p4: 30 * 24 * 60 * 60 * 1000
}

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO CORREO
// ─────────────────────────────────────────────────────────────────────────────

export interface EmailAccount {
  id: string
  workspace_id: string
  email: string
  display_name: string
  imap_host: string
  imap_port: number
  imap_secure: number
  imap_allow_invalid_cert: number
  smtp_host: string
  smtp_port: number
  smtp_secure: number
  username: string
  password: string
  is_active: number
  last_uid_inbox: number
  created_at: number
  updated_at: number
}

export interface EmailAddress {
  name: string
  email: string
}

export interface EmailMessage {
  id: string
  account_id: string
  workspace_id: string
  uid: number
  folder: string
  message_id: string
  in_reply_to: string
  thread_refs: string
  subject: string
  from_address: string
  from_name: string
  to_addresses: string   // JSON: EmailAddress[]
  cc_addresses: string   // JSON: EmailAddress[]
  sent_at: number
  body_text: string
  body_html: string
  has_attachments: number
  is_read: number
  is_starred: number
  ai_category: string
  ai_summary: string
  linked_quote_id: string
  linked_import_id: string
  created_at: number
  updated_at: number
}

export interface EmailAttachment {
  id: string
  message_id: string
  workspace_id: string
  filename: string
  mime_type: string
  size_bytes: number
  local_path: string
  ai_category: string
  created_at: number
}

export interface CreateEmailAccountInput {
  email: string
  display_name?: string
  imap_host: string
  imap_port?: number
  imap_secure?: boolean
  imap_allow_invalid_cert?: boolean
  smtp_host: string
  smtp_port?: number
  smtp_secure?: boolean
  username: string
  password: string
}

export interface SendEmailInput {
  account_id: string
  to: EmailAddress[]
  cc?: EmailAddress[]
  bcc?: EmailAddress[]
  subject: string
  body_text?: string
  body_html?: string
  in_reply_to?: string
  references?: string
  attachments?: { filename: string; path: string }[]
}

export interface EmailListFilters {
  account_id?: string
  folder?: string
  search?: string
  only_unread?: boolean
  only_starred?: boolean
  limit?: number
  offset?: number
}

export type EmailAICategory =
  | 'factura'
  | 'presupuesto'
  | 'comex'
  | 'consulta'
  | 'notificacion'
  | 'newsletter'
  | 'personal'
  | 'otro'

// ── Conciliador Contable ──────────────────────────────────────────────────────

export type ReconPeriodStatus = 'draft' | 'processing' | 'review' | 'closed'

export type ReconImportSource =
  | 'flexxus'
  | 'planilla2'
  | 'cupones_csv'
  | 'cupones_xlsx'
  | 'ml_principal'
  | 'ml_secundaria'
  | 'fondos'
  | 'nave'
  | 'extracto'

export type ReconEstado =
  | 'conciliado'
  | 'dif_menor'
  | 'conciliado_monto'
  | 'diferencia_monto'
  | 'rechazado_ml'
  | 'no_cobrado_ml'
  | 'pendiente'
  | 'requiere_revision'
  | 'manual'
  | 'sin_match_nave'
  | 'sin_match_ml'
  | 'sin_match_trans'

export interface ReconPeriod {
  id: string
  workspace_id: string
  period_month: number
  period_year: number
  status: ReconPeriodStatus
  notes: string
  created_by: string
  closed_by: string
  created_at: number
  closed_at: number | null
}

export interface ReconImport {
  id: string
  period_id: string
  source: ReconImportSource
  filename: string
  row_count: number
  skipped_count: number
  status: 'pending' | 'ok' | 'error' | 'warning'
  error_msg: string
  imported_at: number
  imported_by: string
}

export interface ReconInvoice {
  id: string
  period_id: string
  comprobante: string
  tipo: string
  concepto: string
  total: number
  importe_tarjetas: number
  importe_efectivo: number
  importe_transferencia: number
  importe_cta_cte: number
  importe_otros: number
  source: string
  fecha: string
}

export interface ReconCupon {
  id: string
  period_id: string
  cupon: string
  plan: string
  tarjeta: string
  total: number
  nombre: string
  condicion: string
  fecha_ingreso: string
  cuotas: number
}

export interface ReconMLOp {
  id: string
  period_id: string
  operation_id: string
  status: string
  status_detail: string
  transaction_amount: number
  mp_fee: number
  shipping_cost: number
  counterpart_name: string
  external_reference: string
  reason: string
  date_created: number | null
  date_approved: number | null
  cuenta: string
}

export interface ReconNaveOp {
  id: string
  period_id: string
  operation_id: string
  monto_bruto: number
  status: string
  import_id: string
}

export interface ReconExtractoRow {
  id: string
  period_id: string
  leyenda: string
  descripcion: string
  credito: number
  import_id: string
}

export interface ReconResult {
  id: string
  period_id: string
  invoice_id: string | null
  cupon_id: string | null
  ml_op_id: string | null
  nave_op_id: string | null
  extracto_id: string | null
  result_type: 'nave' | 'ml' | 'trans' | null
  cupon_grupo: string
  estado: ReconEstado
  diferencia: number
  match_score: number
  match_method: string
  no_cobrado_razon: string
  override_by: string
  override_at: number | null
  notes: string
}

export interface ReconResultEnriched extends ReconResult {
  period_month: number
  period_year: number
  comprobante: string | null
  concepto: string | null
  total: number | null
  importe_tarjetas: number | null
  fecha: string | null
  operation_id: string | null
  transaction_amount: number | null
  counterpart_name: string | null
}

export interface ReconResultFilters {
  periodMonth?: number
  periodYear?: number
  estado?: ReconEstado
}

export interface ReconAllKPIs {
  total: number
  conciliado: number
  diferencias: number
  sinML: number
  totalMonto: number
}

export interface ReconImportResult {
  ok: boolean
  inserted?: number
  skipped?: number
  filename?: string
  canceled?: boolean
  error?: string
}

export interface ReconClearResult {
  deleted: number
}

export interface ReconAudit {
  id: string
  period_id: string
  user_id: string
  action: string
  payload: string
  created_at: number
}

export interface CreateReconPeriodInput {
  period_month: number
  period_year: number
  notes?: string
}

export interface ReconKPIs {
  total: number
  byEstado: Partial<Record<ReconEstado, { count: number; monto: number }>>
  totalMonto: number
  conciliadoMonto: number
  pendienteMonto: number
}

export const RECON_STATUS_LABELS: Record<ReconPeriodStatus, string> = {
  draft:      'Borrador',
  processing: 'Procesando',
  review:     'En revisión',
  closed:     'Cerrado'
}

export const RECON_STATUS_COLORS: Record<ReconPeriodStatus, string> = {
  draft:      '#64748b',
  processing: '#3b82f6',
  review:     '#f59e0b',
  closed:     '#10b981'
}

export const RECON_ESTADO_LABELS: Record<ReconEstado, string> = {
  conciliado:        'Conciliado',
  dif_menor:         'Dif. menor',
  conciliado_monto:  'Conc. monto',
  diferencia_monto:  'Dif. monto',
  rechazado_ml:      'Rechazado ML',
  no_cobrado_ml:     'No cobrado ML',
  pendiente:         'Pendiente',
  requiere_revision: 'Requiere revisión',
  manual:            'Manual',
  sin_match_nave:    'Sin match NAVE',
  sin_match_ml:      'Sin match ML',
  sin_match_trans:   'Sin match Trans.',
}

export const RECON_ESTADO_COLORS: Record<ReconEstado, string> = {
  conciliado:        '#10b981',
  dif_menor:         '#f59e0b',
  conciliado_monto:  '#3b82f6',
  diferencia_monto:  '#f97316',
  rechazado_ml:      '#ef4444',
  no_cobrado_ml:     '#94a3b8',
  pendiente:         '#64748b',
  requiere_revision: '#a855f7',
  manual:            '#06b6d4',
  sin_match_nave:    '#6366f1',
  sin_match_ml:      '#6366f1',
  sin_match_trans:   '#6366f1',
}

export const RECON_SOURCE_LABELS: Record<ReconImportSource, string> = {
  flexxus:       'Fondos Vtas Web',
  planilla2:     'Facturas + Clientes',
  cupones_csv:   'Cupones CSV',
  cupones_xlsx:  'Cupones XLSX',
  ml_principal:  'ML Principal',
  ml_secundaria: 'ML Secundaria',
  fondos:        'Fondos / Banco',
  nave:          'NAVE ops',
  extracto:      'Extracto bancario',
}

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO KNOWLEDGE
// ─────────────────────────────────────────────────────────────────────────────

export type KnowledgeContentType = 'text' | 'file' | 'image'
export type KnowledgeDriveStatus = 'none' | 'uploading' | 'synced' | 'error'

export interface KnowledgeEntry {
  id: string
  workspace_id: string
  title: string
  content_type: KnowledgeContentType
  body: string
  topic: string
  tags: string
  source: string
  ai_summary: string
  drive_file_id: string | null
  drive_folder_id: string | null
  drive_status: KnowledgeDriveStatus
  file_name: string | null
  file_size: number | null
  file_mime_type: string | null
  local_path: string | null
  created_by: string
  created_at: number
  updated_at: number
  entry_date: number | null
  parent_id: string | null
  quote_id: string | null
}

export interface KnowledgeSource {
  id: string
  name: string
  icon: string
  color: string
  sort_order: number
}

export interface KnowledgeEntryFile {
  id: string
  entry_id: string
  file_name: string
  file_size: number
  file_mime_type: string
  local_path: string
  drive_file_id: string | null
  drive_folder_id: string | null
  drive_status: KnowledgeDriveStatus
  created_at: number
}

export interface KnowledgeThreadDoc {
  id: string
  entry_id: string
  synthesis: string
  key_data: string        // JSON string[]
  next_steps: string      // JSON string[]
  checks: string          // JSON boolean[] — checkbox state
  generated_at: number
  entry_count: number
}

export interface KnowledgeGlobalSummary {
  id: string
  workspace_id: string
  topic: string
  summary: string
  entry_count: number
  created_at: number
  generated_by: string
}

export interface CreateKnowledgeEntryInput {
  title?: string
  content_type: KnowledgeContentType
  body?: string
  topic?: string
  tags?: string[]
  source?: string
  entry_date?: number
}

export interface UpdateKnowledgeEntryInput {
  title?: string
  body?: string
  topic?: string
  tags?: string[]
  source?: string
  ai_summary?: string
  entry_date?: number | null
}

export interface KnowledgeListFilters {
  search?: string
  topic?: string
  content_type?: KnowledgeContentType
  source?: string
}

export const KNOWLEDGE_CONTENT_TYPE_LABELS: Record<KnowledgeContentType, string> = {
  text:  'Texto',
  file:  'Archivo',
  image: 'Imagen'
}

export const KNOWLEDGE_CONTENT_TYPE_COLORS: Record<KnowledgeContentType, string> = {
  text:  '#f59e0b',
  file:  '#3b82f6',
  image: '#8b5cf6'
}

export interface UserProfile {
  id: string
  workspace_id: string
  email: string
  display_name: string
  last_seen_at: number
}

// ── PDF Reader ────────────────────────────────────────────────────────────────

export interface PdfTextItem {
  str: string
  x: number
  y: number
  width: number
  height: number
}

export interface PdfPageResult {
  pageNum: number
  width: number
  height: number
  items: PdfTextItem[]
  confidence: number
  warnings: string[]
}

export interface PdfReadResult {
  filePath: string
  hash: string
  pageCount: number
  pages: PdfPageResult[]
  cachedAt?: number
}

// ── Payroll (RRHH / Sueldos) ──────────────────────────────────────────────────

export interface PayrollEmployee {
  pageNum: number
  apellidoYNombres: string
  documento: string
  cuil: string
  fecha: string
  periodoAbonado: string
  tareaDesempenada: string
  totalNeto: string
  totalNetoRaw: number
  legajo: string
  fechaIngreso: string
  isVacaciones: boolean
  vacacionesDias: number
  isSac: boolean
}

export interface PayrollValidation {
  field: string
  message: string
  severity: 'error' | 'warning'
}

export interface PayrollExtractionResult {
  filePath: string
  hash: string
  employees: PayrollEmployee[]
  validations: PayrollValidation[]
  processedAt: number
}

// ── RRHH (entidades Supabase/PowerSync) ───────────────────────────────────────

// ── Empresa (multiempresa RRHH: Naka Outdoors + Estación Vertical) ────────────
export type RrhhEmpresa = 'naka' | 'ev'
export const RRHH_EMPRESAS: RrhhEmpresa[] = ['naka', 'ev']
export const RRHH_EMPRESA_LABEL: Record<RrhhEmpresa, string> = {
  naka: 'NAKA',
  ev: 'Estación Vertical',
}

export interface RrhhColaborador {
  id: string
  workspace_id: string
  empresa: RrhhEmpresa
  documento: string
  cuil: string
  nombre: string
  tarea_habitual: string
  legajo: string | null
  fecha_ingreso: string | null
  activo: number
  created_at: number
  updated_at: number
  // Campos extendidos de Nómina
  estado_laboral: string | null       // 'activo'|'inactivo'|'licencia'|'suspendido'|'externo'
  fecha_egreso: string | null
  motivo_egreso: string | null
  sector: string | null
  puesto: string | null
  categoria_laboral: string | null
  tipo_contratacion: string | null    // 'relacion_dependencia'|'monotributo'|'eventual'|'otro'
  jornada: string | null              // 'completa'|'parcial'
  modalidad: string | null            // 'presencial'|'remoto'|'hibrido'
  email_personal: string | null
  email_laboral: string | null
  telefono: string | null
  fecha_nacimiento: string | null
  direccion: string | null
  localidad: string | null
  provincia: string | null
  banco: string | null
  cbu: string | null
  drive_legajo_folder_id: string | null
  sueldo_neto_actual: number | null
  sueldo_bruto_actual: number | null
  ultimo_periodo_liquidado: string | null
  observaciones: string | null
  legajo_estado: string | null        // 'completo'|'incompleto'|'pendiente'
  foto_drive_file_id: string | null
  cv_drive_file_id: string | null
  dias_home_office: string | null    // CSV: "lunes,martes,jueves"
  contacto_emergencia_1_nombre: string | null
  contacto_emergencia_1_celular: string | null
  contacto_emergencia_1_vinculo: string | null
  contacto_emergencia_2_nombre: string | null
  contacto_emergencia_2_celular: string | null
  contacto_emergencia_2_vinculo: string | null
}

export type EstadoLaboral = 'activo' | 'inactivo' | 'licencia' | 'suspendido' | 'externo'
export type LegajoEstado  = 'completo' | 'incompleto' | 'pendiente'

export interface RrhhColaboradorConStats extends RrhhColaborador {
  total_periodos: number
  ultimo_total_neto: number | null
  ultimo_vacaciones_neto: number | null
  ultimo_periodo_label: string | null
}

export interface RrhhNominaConfig {
  id: string
  workspace_id: string
  empresa: RrhhEmpresa
  drive_legajos_folder_id: string | null
  ultimo_legajo_numero: number
  created_at: number
  updated_at: number
}

export interface UpsertColaboradorInput {
  id?: string
  documento: string
  cuil?: string
  nombre: string
  tarea_habitual?: string
  legajo?: string | null
  fecha_ingreso?: string | null
  estado_laboral?: string
  fecha_egreso?: string | null
  motivo_egreso?: string | null
  sector?: string | null
  puesto?: string | null
  categoria_laboral?: string | null
  tipo_contratacion?: string | null
  jornada?: string | null
  modalidad?: string | null
  email_personal?: string | null
  email_laboral?: string | null
  telefono?: string | null
  fecha_nacimiento?: string | null
  direccion?: string | null
  localidad?: string | null
  provincia?: string | null
  banco?: string | null
  cbu?: string | null
  sueldo_neto_actual?: number | null
  sueldo_bruto_actual?: number | null
  observaciones?: string | null
  legajo_estado?: string | null
  dias_home_office?: string | null
  contacto_emergencia_1_nombre?: string | null
  contacto_emergencia_1_celular?: string | null
  contacto_emergencia_1_vinculo?: string | null
  contacto_emergencia_2_nombre?: string | null
  contacto_emergencia_2_celular?: string | null
  contacto_emergencia_2_vinculo?: string | null
}

export interface GenerarDesdeUltimoEntry {
  colaborador_id: string | null
  nombre: string
  documento: string
  cuil: string
  tarea: string
  total_neto: number
  vacaciones_neto: number | null
  legajo: string | null
  fecha_ingreso: string | null
  esNuevo: boolean
  esModificado: boolean
}

export interface GenerarDesdeUltimoResult {
  periodoLabel: string
  entries: GenerarDesdeUltimoEntry[]
}

export interface ConfirmarGenerarInput {
  entries: GenerarDesdeUltimoEntry[]
}

export type RrhhListaTipo = 'sector' | 'puesto' | 'categoria' | 'banco'

export interface RrhhLista {
  id: string
  workspace_id: string
  tipo: RrhhListaTipo
  valor: string
  orden: number
  activo: number
  created_at: number
  updated_at: number
}

export interface UpsertListaInput {
  id?: string
  tipo: RrhhListaTipo
  valor: string
  orden?: number
}

export interface ImportParsedRow {
  rowIndex: number
  nombre: string
  documento: string
  cuil: string
  fecha_nacimiento: string
  telefono: string
  email_personal: string
  direccion: string
  localidad: string
  provincia: string
  contacto_emergencia_1_nombre: string
  contacto_emergencia_1_celular: string
  contacto_emergencia_1_vinculo: string
  contacto_emergencia_2_nombre: string
  contacto_emergencia_2_celular: string
  contacto_emergencia_2_vinculo: string
  legajo: string
  fecha_ingreso: string
  tarea_habitual: string
  sector: string
  puesto: string
  categoria_laboral: string
  estado_laboral: string
  tipo_contratacion: string
  jornada: string
  modalidad: string
  dias_home_office: string
  email_laboral: string
  banco: string
  cbu: string
  observaciones: string
  status: 'create' | 'update' | 'error'
  errors: string[]
  existingId: string | null
  existingLegajo: string | null
  legajoConflict: boolean
  changedFields: string[]
}

export interface ImportParseResult {
  rows: ImportParsedRow[]
  stats: {
    total: number
    toCreate: number
    toUpdate: number
    withErrors: number
    legajoConflicts: number
  }
}

export interface LegajoDecision {
  rowIndex: number
  existingId: string
  nombre: string
  existingLegajo: string
  planillaLegajo: string
  keep: boolean
}

export interface ConfirmImportInput {
  rows: ImportParsedRow[]
  legajoDecisions: LegajoDecision[]
}

export interface RrhhPeriodo {
  id: string
  workspace_id: string
  empresa: RrhhEmpresa
  anio: number
  mes: number
  label: string
  total_neto: number
  cantidad_colaboradores: number
  pdf_nombre: string
  pdf_drive_file_id: string | null
  pdf_drive_folder_id: string | null
  fecha_pago: string
  estado: 'borrador' | 'confirmado'
  total_vacaciones: number | null
  pdf_vacaciones_nombre: string | null
  pdf_vacaciones_drive_file_id: string | null
  total_sac: number | null
  pdf_sac_nombre: string | null
  pdf_sac_drive_file_id: string | null
  created_at: number
  updated_at: number
}

export interface RrhhSueldo {
  id: string
  workspace_id: string
  empresa: RrhhEmpresa
  periodo_id: string
  colaborador_id: string
  total_neto: number
  tarea: string
  periodo_abonado: string
  notas: string | null
  vacaciones_neto: number | null
  vacaciones_dias: number | null
  sac_neto: number | null
  created_at: number
  updated_at: number
}

export interface RrhhSueldoConColaborador extends RrhhSueldo {
  colaborador: RrhhColaborador
  delta_importe: number | null
  delta_pct: number | null
  es_nuevo: boolean
}

export interface RrhhPeriodoConStats extends RrhhPeriodo {
  delta_total: number | null
  delta_pct: number | null
}

export interface RrhhSmartAlert {
  type: 'nuevo' | 'ausente' | 'aumento' | 'baja'
  nombre: string
  importe?: number
  delta?: number
  delta_pct?: number
}

export interface SavePayrollResult {
  periodo: RrhhPeriodo
  colaboradoresNuevos: number
  colaboradoresActualizados: number
  alerts: RrhhSmartAlert[]
}

export interface RrhhHistorialEntry {
  periodo: RrhhPeriodo
  sueldo: RrhhSueldo
  delta_importe: number | null
  delta_pct: number | null
}

export interface SaveVacacionesResult {
  periodo: RrhhPeriodo
  colaboradoresActualizados: number
  colaboradoresNuevos: number
  colaboradoresSinMatch: string[]
}

export interface SaveSacResult {
  periodo: RrhhPeriodo
  colaboradoresActualizados: number
  colaboradoresNuevos: number
  colaboradoresSinMatch: string[]
}

// ─── Mercado Pago ─────────────────────────────────────────────────────────────

export type MpEnvironment = 'production' | 'sandbox'
export type MpAuthType = 'access_token' | 'oauth'
export type MpConnectionStatus = 'active' | 'error' | 'disconnected'
export type MpJobStatus =
  | 'pending'
  | 'requested'
  | 'ready_to_download'
  | 'downloading'
  | 'processing'
  | 'completed'
  | 'failed'
export type MpReconciliationStatus =
  | 'pending'
  | 'suggested'
  | 'confirmed'
  | 'rejected'
  | 'ignored'
  | 'needs_review'

export interface MpConnection {
  id: string
  workspace_id: string
  name: string
  account_label: string
  mercadopago_user_id: string
  environment: MpEnvironment
  auth_type: MpAuthType
  status: MpConnectionStatus
  last_sync_at: number | null
  created_by: string
  created_at: number
  updated_at: number
}

export interface MpConnectionWithCreds extends MpConnection {
  has_token: boolean
}

export interface MpReportJob {
  id: string
  workspace_id: string
  connection_id: string
  report_type: string
  date_from: string
  date_to: string
  status: MpJobStatus
  file_name: string | null
  created_from: string
  requested_by: string
  requested_at: number | null
  downloaded_at: number | null
  processed_at: number | null
  error_message: string | null
  created_at: number
  updated_at: number
}

export interface MpReportFile {
  id: string
  workspace_id: string
  connection_id: string
  job_id: string
  file_name: string
  file_hash: string
  raw_file_path: string
  total_rows: number
  imported_rows: number
  duplicated_rows: number
  error_rows: number
  created_at: number
  updated_at: number
}

export interface MpTransaction {
  id: string
  workspace_id: string
  connection_id: string
  report_file_id: string
  source_id: string
  external_reference: string
  transaction_date: string
  transaction_type: string
  transaction_amount: number
  transaction_currency: string
  settlement_net_amount: number
  settlement_date: string
  fee_amount: number
  taxes_amount: number
  payment_method: string
  payment_method_type: string
  installments: number
  description: string
  money_release_date: string
  payer_name: string
  payer_id_type: string
  payer_id_number: string
  order_id: string
  store_id: string
  store_name: string
  pos_id: string
  pos_name: string
  shipping_id: string
  last_four_digits: string
  authorization_code: string
  application_id: string
  raw_row_json: string
  raw_hash: string
  reconciliation_status: MpReconciliationStatus
  created_at: number
  updated_at: number
}

export interface MpReportConfig {
  file_name_prefix: string
  columns: string[]
  display_timezone: string
  header_language: string
  separator: string
  include_withdraw: boolean
  show_fee_prevision: boolean
  show_chargeback_cancel: boolean
  refund_detailed: boolean
  coupon_detailed: boolean
  shipping_detail: boolean
  frequency: { hour: number; type: string }
}

export interface CreateMpConnectionInput {
  name: string
  account_label: string
  access_token: string
  environment: MpEnvironment
}

export interface MpTransactionFilters {
  connection_id?: string
  transaction_type?: string
  reconciliation_status?: MpReconciliationStatus
  date_from?: string
  date_to?: string
  external_reference?: string
  search?: string
  limit?: number
  offset?: number
}

export interface MpSyncResult {
  job_id: string
  status: MpJobStatus
  file_name: string | null
  imported: number
  duplicated: number
  errors: number
  error_message: string | null
}

export interface MpTestConnectionResult {
  ok: boolean
  user_id?: string
  email?: string
  error?: string
}

// ─── Servicios contables (abonos, suscripciones, pólizas) ──────────────────────

export type ServiceCategory =
  | 'software'        // Software y SaaS
  | 'seguro'          // Seguro
  | 'dominio_hosting' // Dominio o hosting
  | 'profesional'     // Servicio profesional
  | 'bancario'        // Servicio bancario
  | 'administrativo'  // Servicio administrativo
  | 'mantenimiento'   // Mantenimiento
  | 'suscripcion'     // Suscripción
  | 'otro'            // Otro

export type ServiceStatus = 'activo' | 'pausado' | 'cancelado'

export type BillingFrequency =
  | 'mensual' | 'bimestral' | 'trimestral' | 'semestral' | 'anual' | 'pago_unico' | 'otro'

export type ServicePaymentMethod =
  | 'tarjeta_credito' | 'transferencia' | 'debito_automatico' | 'mercadopago'
  | 'paypal' | 'banco' | 'efectivo' | 'otro' | ''

export interface AccountingService {
  id: string
  workspace_id: string
  name: string
  category: string
  provider: string
  description: string
  area: string
  internal_owner: string
  status: ServiceStatus
  amount: number
  currency: string
  billing_frequency: BillingFrequency
  payment_method: string
  auto_renewal: number       // 0 | 1 (PowerSync integer boolean)
  requires_approval: number  // 0 | 1
  start_date: string
  last_payment_date: string
  next_due_date: string
  next_renewal_date: string
  decision_deadline_date: string
  contact_name: string
  contact_email: string
  contact_phone: string
  manager_name: string
  manager_email: string
  manager_phone: string
  document_url: string
  provider_portal_url: string
  notes: string
  // Seguros (inline, sólo relevantes si category === 'seguro')
  insurance_company: string
  policy_number: string
  coverage_type: string
  insured_asset: string
  insured_amount: number
  coverage_start_date: string
  coverage_end_date: string
  broker_name: string
  broker_contact: string
  deleted_at: number | null
  created_at: number
  updated_at: number
}

export type CreateAccountingServiceInput = Omit<
  AccountingService, 'id' | 'workspace_id' | 'deleted_at' | 'created_at' | 'updated_at'
>

export interface AccountingServicePayment {
  id: string
  workspace_id: string
  service_id: string
  payment_date: string
  amount: number
  currency: string
  period_from: string
  period_to: string
  payment_method: string
  receipt_url: string
  notes: string
  created_by: string
  created_at: number
  updated_at: number
}

export interface RegisterServicePaymentInput {
  service_id: string
  payment_date: string
  amount: number
  currency: string
  period_from: string
  period_to: string
  payment_method: string
  receipt_url: string
  notes: string
  next_due_date?: string      // si se indica, actualiza el próximo vencimiento del servicio
  next_renewal_date?: string  // si se indica, actualiza la próxima renovación
}

export interface AccountingServiceFilters {
  category?: string
  status?: ServiceStatus
  currency?: string
  billing_frequency?: BillingFrequency
  auto_renewal?: boolean
  internal_owner?: string
  search?: string
}

// ─── Cajas Internas ───────────────────────────────────────────────────────────

export type CashCurrency     = 'ARS' | 'USD' | 'EUR'
export type CashboxStatus    = 'ok' | 'pending_count' | 'with_difference' | 'blocked' | 'closed'
export type MovementType     = 'income' | 'expense' | 'transfer' | 'adjustment' | 'bank_deposit' | 'opening' | 'correction'
export type MovementStatus   = 'draft' | 'confirmed' | 'cancelled' | 'pending_approval'
export type CountType        = 'quick_count' | 'daily_close' | 'formal_audit'
export type CountStatus      = 'pending' | 'confirmed' | 'with_difference' | 'cancelled'
export type DifferenceStatus = 'pending' | 'under_review' | 'resolved' | 'written_off'

export const CASHBOX_STATUS_LABELS: Record<CashboxStatus, string> = {
  ok:               'OK',
  pending_count:    'Conteo pendiente',
  with_difference:  'Con diferencia',
  blocked:          'Bloqueada',
  closed:           'Cerrada',
}

export const CASHBOX_STATUS_COLORS: Record<CashboxStatus, string> = {
  ok:              '#10b981',
  pending_count:   '#f59e0b',
  with_difference: '#ef4444',
  blocked:         '#6366f1',
  closed:          '#64748b',
}

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  income:       'Ingreso',
  expense:      'Egreso',
  transfer:     'Transferencia',
  adjustment:   'Ajuste',
  bank_deposit: 'Depósito bancario',
  opening:      'Apertura',
  correction:   'Corrección',
}

export const CASH_DENOMINATIONS: Record<CashCurrency, number[]> = {
  ARS: [20000, 10000, 2000, 1000, 500, 200, 100, 50],
  USD: [100, 50, 20, 10, 5, 1],
  EUR: [500, 200, 100, 50, 20, 10, 5],
}

export interface CashCompany {
  id: string
  workspace_id: string
  name: string
  code: string
  active: number
  sort_order: number
  created_at: string
}

export interface Cashbox {
  id: string
  workspace_id: string
  company_id: string
  name: string
  description: string
  currencies: string        // JSON: '["ARS","USD"]'
  status: CashboxStatus
  responsible_user_id: string
  requires_count_hours: number | null
  active: number
  sort_order: number
  created_at: string
}

export interface CashboxPermission {
  id: string
  workspace_id: string
  cashbox_id: string
  user_id: string
  permission_key: string
  granted_by: string
  created_at: string
}

export interface CashCategory {
  id: string
  workspace_id: string
  company_id: string
  name: string
  type: 'income' | 'expense'
  active: number
  created_at: string
}

export interface CashMovement {
  id: string
  workspace_id: string
  cashbox_id: string
  type: MovementType
  status: MovementStatus
  reference_date: string
  category_id: string
  source_cashbox_id: string
  dest_cashbox_id: string
  notes: string
  confirmed_by: string
  confirmed_at: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface CashMovementAmount {
  id: string
  workspace_id: string
  movement_id: string
  currency: CashCurrency
  amount: number
  created_at: string
}

// Desglose de billetes (opcional) que compone el importe de un movimiento.
// Doble chequeo de control: espejo de CashCountDetail pero por movimiento.
export interface CashMovementBreakdown {
  id: string
  workspace_id: string
  movement_id: string
  currency: CashCurrency
  denomination: number
  quantity: number
  created_at: string
}

// Operador de caja (lista propia, independiente del login). El renderer nunca ve
// el hash/salt del PIN: sólo `has_pin` indica si tiene PIN configurado.
export interface CashOperator {
  id: string
  workspace_id: string
  name: string
  active: number
  has_pin: boolean
  created_at: string
  updated_at: string
}

export interface CashCount {
  id: string
  workspace_id: string
  cashbox_id: string
  count_type: CountType
  status: CountStatus
  counted_by: string
  confirmed_by: string
  notes: string
  created_at: string
}

export interface CashCountDetail {
  id: string
  workspace_id: string
  count_id: string
  currency: CashCurrency
  denomination: number
  quantity: number
  created_at: string
}

export interface CashDifference {
  id: string
  workspace_id: string
  cashbox_id: string
  count_id: string
  currency: CashCurrency
  system_amount: number
  counted_amount: number
  difference: number
  status: DifferenceStatus
  resolution_notes: string
  resolved_by: string
  created_at: string
}

// Diferencia pendiente enriquecida para el banner de alertas (workspace-wide)
export interface PendingDifferenceItem extends CashDifference {
  cashbox_name: string
  company_name: string
}

export interface CashAuditLog {
  id: string
  workspace_id: string
  cashbox_id: string
  action: string
  user_id: string
  details: string
  created_at: string
}

// Tipo enriquecido: caja con saldo calculado
export interface CashboxWithBalance extends Cashbox {
  balances: Partial<Record<CashCurrency, number>>
  last_count_at?: string
  company?: CashCompany
}

export interface CashMovementWithAmounts extends CashMovement {
  amounts: CashMovementAmount[]
  category?: CashCategory
  source_cashbox?: Cashbox
  dest_cashbox?: Cashbox
}

// Fila enriquecida para el historial de movimientos (categoría + montos + nº de comprobantes)
export interface CashMovementListItem {
  id: string
  cashbox_id: string
  type: MovementType
  status: MovementStatus
  reference_date: string
  category_id: string
  category_name: string | null
  notes: string
  created_by: string
  created_at: string
  amounts_json: string      // JSON array de { currency, amount }
  attachment_count: number
}

// ── Adjuntos de Cajas (comprobantes) — metadata en PowerSync, bytes en Google Drive ──
export type CashAttachmentOwnerType = 'movement' | 'count'

export interface CashAttachment {
  id: string
  workspace_id: string
  owner_type: CashAttachmentOwnerType
  owner_id: string
  original_name: string
  mime_type: string
  size_bytes: number
  drive_file_id: string
  created_by: string
  created_at: string
}
