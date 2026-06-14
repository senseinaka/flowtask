-- Fase 4.2.0: tablas espejo en Supabase para "importaciones" de Comex
-- (11 tablas: comex_imports y sus tablas relacionadas — items, documentos,
-- cotizaciones logísticas, pagos, aduana, costos, certificados INAL,
-- tributos, costos extra, proformas), reflejando migrations.ts v6-v65 y
-- el AppSchema que se va a agregar a powersync.ts.
--
-- Cómo correr: pegar todo este archivo en el SQL Editor de Supabase
-- (Database > SQL Editor > New query) y ejecutar.
set role pg_database_owner;

-- ════════════════════════════════════════════════════════════════════════
-- Imports (cabecera)
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.comex_imports (
  id                          text primary key,
  title                       text not null,
  supplier_id                 text references public.comex_suppliers(id) on delete set null,
  status                      text not null default 'planning',
  incoterm                    text not null default 'FOB',
  origin_country              text not null default '',
  currency                    text not null default 'USD',
  estimated_value             double precision,
  actual_value                double precision,
  order_date                  bigint,
  payment_date                bigint,
  ship_date                   bigint,
  arrival_date                bigint,
  actual_ship_date            bigint,
  actual_arrival_date         bigint,
  tracking_number             text not null default '',
  customs_agent               text not null default '',
  drive_folder_id             text,
  notes                       text not null default '',
  created_at                  bigint not null,
  updated_at                  bigint not null,
  origin_port                 text not null default '',
  eta_2                       bigint,
  eta_3                       bigint,
  eta_4                       bigint,
  inal_required               integer not null default 0,
  inal_lc_status              text not null default 'pendiente',
  inal_lc_task_scheduled      integer not null default 0,
  inal_lc_cert_folder_id      text,
  inal_lc_task_id             text,
  despacho_folder_id          text,
  despacho_stored_name        text,
  despacho_original_name      text,
  despacho_drive_file_id       text,
  despacho_drive_status        text not null default 'none',
  tc_eur_ars                  double precision,
  cost_pct                    double precision,
  proformas_folder_id          text,
  facturas_folder_id           text,
  freight_operator_id         text references public.comex_freight_operators(id) on delete set null,
  despachante                  text not null default '',
  forwarder_ref_mail           text not null default '',
  bl_number                    text not null default '',
  bl_folder_id                 text,
  bl_stored_name               text,
  bl_original_name             text,
  bl_drive_file_id              text,
  bl_drive_status               text not null default 'none',
  bl_extracted_json             text,
  inal_drive_folder_id          text,
  inal_pl_ok                   integer not null default 0,
  inal_pl_stored_name           text,
  inal_pl_original_name         text,
  inal_pl_drive_file_id          text,
  inal_pl_drive_status           text not null default 'none',
  inal_xls_ok                  integer not null default 0,
  inal_xls_stored_name          text,
  inal_xls_original_name        text,
  inal_xls_drive_file_id         text,
  inal_xls_drive_status          text not null default 'none',
  inal_factura_stored_name       text,
  inal_factura_original_name     text,
  inal_factura_drive_file_id      text,
  inal_factura_drive_status       text not null default 'none',
  inal_bl_stored_name            text,
  inal_bl_original_name          text,
  inal_bl_drive_file_id           text,
  inal_bl_drive_status            text not null default 'none',
  gestor_id                    text references public.comex_gestores(id) on delete set null,
  aviso_arribo_date            bigint,
  traslado_deposito_date       bigint,
  oficializacion_import_date   bigint,
  carga_deposito_date          bigint,
  carga_deposito_time          text,
  pl_folder_id                  text,
  pl_stored_name                 text,
  pl_original_name               text,
  pl_drive_file_id                text,
  pl_drive_status                 text not null default 'none',
  pl_extracted_json               text,
  carga_armada_date            bigint,
  esperando_embarcar_date      bigint,
  workspace_id                 text not null
);

create index if not exists idx_comex_imports_supplier on public.comex_imports(supplier_id);
create index if not exists idx_comex_imports_freight_operator on public.comex_imports(freight_operator_id);
create index if not exists idx_comex_imports_gestor on public.comex_imports(gestor_id);

-- ════════════════════════════════════════════════════════════════════════
-- Items
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.comex_import_items (
  id           text primary key,
  import_id    text not null references public.comex_imports(id) on delete cascade,
  description  text not null,
  hs_code      text not null default '',
  quantity     double precision not null default 0,
  unit         text not null default 'u',
  unit_price   double precision not null default 0,
  currency     text not null default 'USD',
  created_at   bigint not null,
  workspace_id text not null,
  updated_at   bigint not null
);

create index if not exists idx_comex_import_items_import on public.comex_import_items(import_id);

-- ════════════════════════════════════════════════════════════════════════
-- Documentos
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.comex_documents (
  id                text primary key,
  import_id         text not null references public.comex_imports(id) on delete cascade,
  type              text not null default 'other',
  name              text not null,
  drive_file_id     text,
  status            text not null default 'pending',
  notes             text not null default '',
  received_at       bigint,
  created_at        bigint not null,
  local_stored_name text,
  size_bytes        bigint,
  mime_type         text,
  drive_status      text not null default 'none',
  workspace_id      text not null,
  updated_at        bigint not null
);

create index if not exists idx_comex_documents_import on public.comex_documents(import_id);

-- ════════════════════════════════════════════════════════════════════════
-- Cotizaciones logísticas
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.comex_logistics_quotes (
  id                text primary key,
  import_id         text not null references public.comex_imports(id) on delete cascade,
  operator_name     text not null,
  contact           text not null default '',
  quote_amount      double precision,
  currency          text not null default 'USD',
  services_included text not null default '',
  valid_until       bigint,
  status            text not null default 'quoted',
  notes             text not null default '',
  created_at        bigint not null,
  operator_id       text references public.comex_freight_operators(id) on delete set null,
  cargo_type        text not null default 'LCL',
  rfq_sent_at       bigint,
  rfq_email_text    text not null default '',
  workspace_id      text not null,
  updated_at        bigint not null
);

create index if not exists idx_comex_logistics_quotes_import on public.comex_logistics_quotes(import_id);
create index if not exists idx_comex_logistics_quotes_operator on public.comex_logistics_quotes(operator_id);

-- ════════════════════════════════════════════════════════════════════════
-- Pagos
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.comex_payments (
  id            text primary key,
  import_id     text not null references public.comex_imports(id) on delete cascade,
  amount        double precision not null,
  currency      text not null default 'USD',
  exchange_rate double precision,
  payment_date  bigint,
  method        text not null default 'wire',
  bank          text not null default '',
  reference     text not null default '',
  status        text not null default 'pending',
  notes         text not null default '',
  created_at    bigint not null,
  workspace_id  text not null,
  updated_at    bigint not null
);

create index if not exists idx_comex_payments_import on public.comex_payments(import_id);

-- ════════════════════════════════════════════════════════════════════════
-- Aduana
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.comex_import_customs (
  id                       text primary key,
  import_id                text not null unique references public.comex_imports(id) on delete cascade,
  fob_currency             text not null default 'USD',
  fob_invoice              double precision,
  fob_declared             double precision,
  dolar_aduana             double precision,
  dolar_naviera            double precision,
  paridad_usd_eur          double precision,
  despacho_number          text not null default '',
  despachante              text not null default '',
  oficializacion_date      bigint,
  sepaimpo_vencimiento     bigint,
  bl_number                text not null default '',
  naviera_ref              text not null default '',
  carrier                  text not null default '',
  etd                      bigint,
  peso_bruto_kg            double precision,
  volumen_m3               double precision,
  cant_pallets             integer,
  mulc_date                bigint,
  fecha_pago_banco         bigint,
  cierre_banco_date        bigint,
  listas_despachante_date  bigint,
  listas_oscar_andrea_date bigint,
  created_at               bigint not null,
  updated_at               bigint not null,
  canal                    text,
  cant_bultos              integer,
  cant_cartons             integer,
  workspace_id             text not null
);

-- ════════════════════════════════════════════════════════════════════════
-- Costos
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.comex_import_costs (
  id           text primary key,
  import_id    text not null references public.comex_imports(id) on delete cascade,
  category     text not null default 'otros',
  concept      text not null,
  amount_pesos double precision not null default 0,
  amount_usd   double precision,
  sort_order   integer not null default 0,
  created_at   bigint not null,
  workspace_id text not null,
  updated_at   bigint not null
);

create index if not exists idx_comex_import_costs_import on public.comex_import_costs(import_id);

-- ════════════════════════════════════════════════════════════════════════
-- Certificados INAL
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.comex_inal_certs (
  id                text primary key,
  import_id         text not null references public.comex_imports(id) on delete cascade,
  original_name     text not null,
  local_stored_name text,
  size_bytes        bigint,
  mime_type         text,
  drive_file_id     text,
  drive_status      text not null default 'none',
  created_at        bigint not null,
  workspace_id      text not null,
  updated_at        bigint not null
);

create index if not exists idx_comex_inal_certs_import on public.comex_inal_certs(import_id);

-- ════════════════════════════════════════════════════════════════════════
-- Tributos
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.comex_import_tributos (
  id           text primary key,
  import_id    text not null references public.comex_imports(id) on delete cascade,
  codigo       text not null default '',
  concepto     text not null default '',
  porcentaje   double precision,
  importe_usd  double precision not null default 0,
  sort_order   integer not null default 0,
  created_at   bigint not null,
  workspace_id text not null,
  updated_at   bigint not null
);

create index if not exists idx_comex_import_tributos_import on public.comex_import_tributos(import_id);

-- ════════════════════════════════════════════════════════════════════════
-- Costos extra
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.comex_import_extra_costs (
  id                  text primary key,
  import_id           text not null references public.comex_imports(id) on delete cascade,
  categoria           text not null default 'otro',
  concepto            text not null default '',
  proveedor           text not null default '',
  nro_factura         text not null default '',
  fecha_factura       bigint,
  importe             double precision not null default 0,
  moneda              text not null default 'ARS',
  stored_name         text,
  original_name       text,
  drive_file_id       text,
  drive_folder_id     text,
  drive_status        text not null default 'none',
  sort_order          integer not null default 0,
  created_at          bigint not null,
  cae                 text,
  referencia_despacho text,
  importe_iva         double precision,
  importe_total       double precision,
  items_json          text,
  tipo_cambio         double precision,
  bl_referencia       text,
  importe_ars         double precision,
  percepciones        double precision,
  fecha_ingreso       text,
  fecha_egreso        text,
  nro_contenedor      text,
  canal_deposito      text,
  percepcion_caba     double precision,
  percepcion_bsas     double precision,
  workspace_id        text not null,
  updated_at          bigint not null
);

create index if not exists idx_comex_import_extra_costs_import on public.comex_import_extra_costs(import_id);

-- ════════════════════════════════════════════════════════════════════════
-- Proformas
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.comex_proformas (
  id               text primary key,
  import_id        text not null references public.comex_imports(id) on delete cascade,
  numero           integer not null default 1,
  fecha_proforma   text,
  importe          double precision,
  moneda           text not null default 'USD',
  nro_proforma     text not null default '',
  descripcion      text not null default '',
  incluir_en_total integer not null default 1,
  stored_name      text,
  original_name    text,
  drive_file_id    text,
  drive_folder_id  text,
  drive_status     text not null default 'none',
  created_at       bigint not null,
  tipo             text not null default 'proforma',
  workspace_id     text not null,
  updated_at       bigint not null
);

create index if not exists idx_comex_proformas_import on public.comex_proformas(import_id);

-- ════════════════════════════════════════════════════════════════════════
-- Row Level Security
--
-- Mismo patrón que Fase 4.1 (maestros): el upload desde PowerSync usa la
-- service_role key (bypassea RLS). Las policies habilitan a cualquier
-- usuario autenticado a leer las filas de su workspace — un solo
-- workspace_id fijo (d61a4071-1557-4f32-be5e-6443fb336bf5) por ahora.
-- ════════════════════════════════════════════════════════════════════════

do $$
declare
  t text;
  tables text[] := array[
    'comex_imports', 'comex_import_items', 'comex_documents',
    'comex_logistics_quotes', 'comex_payments', 'comex_import_customs',
    'comex_import_costs', 'comex_inal_certs', 'comex_import_tributos',
    'comex_import_extra_costs', 'comex_proformas'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Authenticated users can read workspace rows" on public.%I', t);
    execute format(
      'create policy "Authenticated users can read workspace rows" on public.%I for select to authenticated using (workspace_id = ''d61a4071-1557-4f32-be5e-6443fb336bf5'')',
      t
    );
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- Permisos para service_role (usado por PowerSync para subir cambios)
--
-- Las tablas nuevas se crean bajo pg_database_owner y no heredan los
-- privilegios que service_role ya tiene sobre las tablas existentes. Sin
-- este GRANT, PowerSync recibe 403 "permission denied" al subir cambios.
-- ════════════════════════════════════════════════════════════════════════

do $$
declare
  t text;
  tables text[] := array[
    'comex_imports', 'comex_import_items', 'comex_documents',
    'comex_logistics_quotes', 'comex_payments', 'comex_import_customs',
    'comex_import_costs', 'comex_inal_certs', 'comex_import_tributos',
    'comex_import_extra_costs', 'comex_proformas'
  ];
begin
  foreach t in array tables loop
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;
