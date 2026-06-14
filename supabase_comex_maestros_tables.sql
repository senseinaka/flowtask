-- Fase 4.1.0: tablas espejo en Supabase para los "maestros" de Comex
-- (10 tablas: proveedores, operadores logísticos, gestores, despachantes,
-- marcas y sus contactos/cuentas bancarias, reflejando migrations.ts
-- v1-v65 y el AppSchema que se va a agregar a powersync.ts)
--
-- Cómo correr: pegar todo este archivo en el SQL Editor de Supabase
-- (Database > SQL Editor > New query) y ejecutar.
set role pg_database_owner;

-- ════════════════════════════════════════════════════════════════════════
-- Proveedores
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.comex_suppliers (
  id                          text primary key,
  name                        text not null,
  country                     text not null default '',
  contact_name                text not null default '',
  contact_email               text not null default '',
  contact_phone               text not null default '',
  website                     text not null default '',
  payment_terms               text not null default '',
  notes                       text not null default '',
  address                     text not null default '',
  city                        text not null default '',
  zip_code                    text not null default '',
  tax_id                      text not null default '',
  rex_number                  text not null default '',
  wechat                      text not null default '',
  product_categories          text not null default '',
  incoterms_preferred          text not null default '',
  port_of_origin              text not null default '',
  lead_time_days              integer,
  pickup_address              text not null default '',
  brand                       text not null default '',
  logo_stored_name             text,
  production_days             integer,
  preparation_days            integer,
  transit_days                integer,
  customs_days                integer,
  local_delivery_days         integer,
  moq                         integer,
  non_operational_periods_json text not null default '[]',
  reliability_notes           text not null default '',
  created_at                  bigint not null,
  updated_at                  bigint not null,
  workspace_id                text not null
);

create table if not exists public.comex_supplier_contacts (
  id           text primary key,
  supplier_id  text not null,
  role         text not null default 'commercial',
  name         text not null default '',
  position     text not null default '',
  email        text not null default '',
  phone        text not null default '',
  whatsapp     text not null default '',
  notes        text not null default '',
  sort_order   integer not null default 0,
  created_at   bigint not null,
  updated_at   bigint not null,
  workspace_id text not null
);

create index if not exists idx_comex_supplier_contacts_supplier on public.comex_supplier_contacts(supplier_id);

create table if not exists public.comex_supplier_bank_accounts (
  id               text primary key,
  supplier_id      text not null,
  bank_name        text not null default '',
  beneficiary_name text not null default '',
  account_number   text not null default '',
  swift_bic        text not null default '',
  iban             text not null default '',
  routing_number   text not null default '',
  currency         text not null default 'USD',
  bank_address     text not null default '',
  notes            text not null default '',
  created_at       bigint not null,
  updated_at       bigint not null,
  workspace_id     text not null
);

create index if not exists idx_comex_supplier_bank_accounts_supplier on public.comex_supplier_bank_accounts(supplier_id);

-- ════════════════════════════════════════════════════════════════════════
-- Operadores logísticos
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.comex_freight_operators (
  id               text primary key,
  name             text not null,
  company_type     text not null default 'agente',
  contact_name     text not null default '',
  email            text not null default '',
  phone            text not null default '',
  whatsapp         text not null default '',
  services         text not null default '',
  notes            text not null default '',
  logo_stored_name text,
  created_at       bigint not null,
  updated_at       bigint not null,
  workspace_id     text not null
);

create table if not exists public.comex_freight_operator_contacts (
  id           text primary key,
  operator_id  text not null,
  name         text not null default '',
  role         text not null default '',
  email        text not null default '',
  phone        text not null default '',
  nickname     text not null default '',
  sort_order   integer not null default 0,
  created_at   bigint not null,
  updated_at   bigint not null,
  workspace_id text not null
);

create index if not exists idx_comex_freight_operator_contacts_operator on public.comex_freight_operator_contacts(operator_id);

-- ════════════════════════════════════════════════════════════════════════
-- Gestores (INAL)
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.comex_gestores (
  id               text primary key,
  name             text not null,
  estudio          text not null default '',
  cuit             text not null default '',
  email            text not null default '',
  phone            text not null default '',
  whatsapp         text not null default '',
  especialidades   text not null default '',
  notas            text not null default '',
  website          text not null default '',
  direccion        text not null default '',
  phone_empresa    text not null default '',
  logo_stored_name text,
  created_at       bigint not null,
  updated_at       bigint not null,
  workspace_id     text not null
);

create table if not exists public.comex_gestor_contacts (
  id           text primary key,
  gestor_id    text not null,
  name         text not null default '',
  role         text not null default '',
  email        text not null default '',
  phone        text not null default '',
  sort_order   integer not null default 0,
  created_at   bigint not null,
  updated_at   bigint not null,
  workspace_id text not null
);

create index if not exists idx_comex_gestor_contacts_gestor on public.comex_gestor_contacts(gestor_id);

-- ════════════════════════════════════════════════════════════════════════
-- Despachantes de aduana
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.comex_despachantes (
  id               text primary key,
  name             text not null,
  matricula        text not null default '',
  empresa          text not null default '',
  cuit             text not null default '',
  email            text not null default '',
  phone            text not null default '',
  whatsapp         text not null default '',
  notas            text not null default '',
  website          text not null default '',
  direccion        text not null default '',
  phone_empresa    text not null default '',
  logo_stored_name text,
  created_at       bigint not null,
  updated_at       bigint not null,
  workspace_id     text not null
);

create table if not exists public.comex_despachante_contacts (
  id             text primary key,
  despachante_id text not null,
  name           text not null default '',
  role           text not null default '',
  email          text not null default '',
  phone          text not null default '',
  sort_order     integer not null default 0,
  created_at     bigint not null,
  updated_at     bigint not null,
  workspace_id   text not null
);

create index if not exists idx_comex_despachante_contacts_despachante on public.comex_despachante_contacts(despachante_id);

-- ════════════════════════════════════════════════════════════════════════
-- Marcas (Programación de Pedidos)
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.comex_brands (
  id                      text primary key,
  name                    text not null,
  category                text not null default '',
  primary_supplier_id     text,
  demand_annual           integer,
  demand_monthly_json     text not null default '{}',
  current_stock           integer,
  safety_stock            integer,
  purchase_frequency_days integer,
  notes                   text not null default '',
  logo_stored_name        text,
  created_at              bigint not null,
  updated_at              bigint not null,
  workspace_id            text not null
);

create index if not exists idx_comex_brands_supplier on public.comex_brands(primary_supplier_id);

-- ════════════════════════════════════════════════════════════════════════
-- Row Level Security
--
-- Mismo patrón que Fase 3 (finanzas): el upload desde PowerSync usa la
-- service_role key (bypassea RLS). Las policies habilitan a cualquier
-- usuario autenticado a leer las filas de su workspace — un solo
-- workspace_id fijo (d61a4071-1557-4f32-be5e-6443fb336bf5) por ahora.
-- ════════════════════════════════════════════════════════════════════════

do $$
declare
  t text;
  tables text[] := array[
    'comex_suppliers', 'comex_supplier_contacts', 'comex_supplier_bank_accounts',
    'comex_freight_operators', 'comex_freight_operator_contacts',
    'comex_gestores', 'comex_gestor_contacts',
    'comex_despachantes', 'comex_despachante_contacts',
    'comex_brands'
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
-- privilegios que service_role ya tiene sobre las tablas existentes
-- (finance_*, projects, tasks, etc.). Sin este GRANT, PowerSync recibe
-- 403 "permission denied" al subir cambios.
-- ════════════════════════════════════════════════════════════════════════

do $$
declare
  t text;
  tables text[] := array[
    'comex_suppliers', 'comex_supplier_contacts', 'comex_supplier_bank_accounts',
    'comex_freight_operators', 'comex_freight_operator_contacts',
    'comex_gestores', 'comex_gestor_contacts',
    'comex_despachantes', 'comex_despachante_contacts',
    'comex_brands'
  ];
begin
  foreach t in array tables loop
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;
