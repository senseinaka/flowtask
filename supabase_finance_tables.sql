-- Fase 3.0: tablas espejo en Supabase para Finanzas Personales y Finanzas Empresa
-- (14 tablas: finance_* y company_finance_*, mismo esquema, reflejando
-- migrations.ts v53-v61 y el AppSchema de powersync.ts)
--
-- Cómo correr: pegar todo este archivo en el SQL Editor de Supabase
-- (Database > SQL Editor > New query) y ejecutar.
--
-- NOTA: en proyectos nuevos de Supabase, el schema "public" es propiedad de
-- pg_database_owner (no de "postgres" directamente). "postgres" es miembro de
-- ese rol pero tiene que activarlo con SET ROLE para tener privilegios de
-- dueño sobre "public" (CREATE TABLE, ALTER, etc.).
set role pg_database_owner;

-- ════════════════════════════════════════════════════════════════════════
-- Tipo de columnas "cuenta/categoría/método de pago" (mismo shape x6)
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.finance_accounts (
  id          text primary key,
  name        text not null,
  icon        text not null default '💰',
  color       text not null default '#10b981',
  is_default  integer not null default 0,
  created_at  bigint not null,
  updated_at  bigint not null,
  workspace_id text not null
);

create table if not exists public.finance_categories (
  id          text primary key,
  name        text not null,
  icon        text not null default '📁',
  color       text not null default '#6366f1',
  is_default  integer not null default 0,
  created_at  bigint not null,
  updated_at  bigint not null,
  workspace_id text not null
);

create table if not exists public.finance_payment_methods (
  id          text primary key,
  name        text not null,
  icon        text not null default '💳',
  color       text not null default '#64748b',
  is_default  integer not null default 0,
  created_at  bigint not null,
  updated_at  bigint not null,
  workspace_id text not null
);

create table if not exists public.company_finance_accounts (
  id          text primary key,
  name        text not null,
  icon        text not null default '💰',
  color       text not null default '#10b981',
  is_default  integer not null default 0,
  created_at  bigint not null,
  updated_at  bigint not null,
  workspace_id text not null
);

create table if not exists public.company_finance_categories (
  id          text primary key,
  name        text not null,
  icon        text not null default '📁',
  color       text not null default '#6366f1',
  is_default  integer not null default 0,
  created_at  bigint not null,
  updated_at  bigint not null,
  workspace_id text not null
);

create table if not exists public.company_finance_payment_methods (
  id          text primary key,
  name        text not null,
  icon        text not null default '💳',
  color       text not null default '#64748b',
  is_default  integer not null default 0,
  created_at  bigint not null,
  updated_at  bigint not null,
  workspace_id text not null
);

-- ════════════════════════════════════════════════════════════════════════
-- Conceptos
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.finance_concepts (
  id                       text primary key,
  category_id              text not null,
  account_id               text not null,
  name                     text not null,
  default_amount          double precision not null default 0,
  expense_type             text not null default 'fixed',
  payment_method           text not null default 'transfer',
  recurrence               text not null default 'monthly',
  recurrence_month         integer,
  tracks_multiple_entries  integer not null default 0,
  is_active                integer not null default 1,
  notes                    text not null default '',
  created_at               bigint not null,
  updated_at               bigint not null,
  workspace_id             text not null
);

create table if not exists public.company_finance_concepts (
  id                       text primary key,
  category_id              text not null,
  account_id               text not null,
  name                     text not null,
  default_amount          double precision not null default 0,
  expense_type             text not null default 'fixed',
  payment_method           text not null default 'transfer',
  recurrence               text not null default 'monthly',
  recurrence_month         integer,
  tracks_multiple_entries  integer not null default 0,
  is_active                integer not null default 1,
  notes                    text not null default '',
  created_at               bigint not null,
  updated_at               bigint not null,
  workspace_id             text not null
);

-- ════════════════════════════════════════════════════════════════════════
-- Movimientos
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.finance_movements (
  id                text primary key,
  concept_id        text not null,
  month             integer not null,
  year              integer not null,
  amount_estimated  double precision not null default 0,
  amount_actual     double precision,
  status            text not null default 'pending',
  payment_method    text not null default 'transfer',
  payment_date      bigint,
  due_date          bigint,
  notes             text not null default '',
  created_at        bigint not null,
  updated_at        bigint not null,
  workspace_id      text not null,
  unique (concept_id, month, year)
);

create index if not exists idx_finance_movements_period on public.finance_movements(year, month);

create table if not exists public.company_finance_movements (
  id                text primary key,
  concept_id        text not null,
  month             integer not null,
  year              integer not null,
  amount_estimated  double precision not null default 0,
  amount_actual     double precision,
  status            text not null default 'pending',
  payment_method    text not null default 'transfer',
  payment_date      bigint,
  due_date          bigint,
  notes             text not null default '',
  created_at        bigint not null,
  updated_at        bigint not null,
  workspace_id      text not null,
  unique (concept_id, month, year)
);

create index if not exists idx_company_finance_movements_period on public.company_finance_movements(year, month);

-- ════════════════════════════════════════════════════════════════════════
-- Registro de cargas (movement entries)
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.finance_movement_entries (
  id           text primary key,
  movement_id  text not null,
  amount       double precision not null,
  entry_date   bigint,
  note         text not null default '',
  created_at   bigint not null,
  updated_at   bigint not null,
  workspace_id text not null
);

create index if not exists idx_finance_movement_entries_movement on public.finance_movement_entries(movement_id);

create table if not exists public.company_finance_movement_entries (
  id           text primary key,
  movement_id  text not null,
  amount       double precision not null,
  entry_date   bigint,
  note         text not null default '',
  created_at   bigint not null,
  updated_at   bigint not null,
  workspace_id text not null
);

create index if not exists idx_company_finance_movement_entries_movement on public.company_finance_movement_entries(movement_id);

-- ════════════════════════════════════════════════════════════════════════
-- Notas / análisis IA del mes
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.finance_month_insights (
  id              text primary key,
  month           integer not null,
  year            integer not null,
  notes           text not null default '',
  ai_analysis     text,
  ai_generated_at bigint,
  created_at      bigint not null,
  updated_at      bigint not null,
  workspace_id    text not null,
  unique (month, year)
);

create table if not exists public.company_finance_month_insights (
  id              text primary key,
  month           integer not null,
  year            integer not null,
  notes           text not null default '',
  ai_analysis     text,
  ai_generated_at bigint,
  created_at      bigint not null,
  updated_at      bigint not null,
  workspace_id    text not null,
  unique (month, year)
);

-- ════════════════════════════════════════════════════════════════════════
-- Row Level Security
--
-- Mismo patrón que projects/tasks/user_permissions: el upload desde PowerSync
-- usa la service_role key (bypassea RLS). Las policies de abajo habilitan a
-- cualquier usuario autenticado a leer/escribir las filas de su workspace —
-- por ahora hay un solo workspace_id fijo (d61a4071-1557-4f32-be5e-6443fb336bf5)
-- compartido por todos los usuarios de la app.
-- ════════════════════════════════════════════════════════════════════════

do $$
declare
  t text;
  tables text[] := array[
    'finance_accounts', 'finance_categories', 'finance_payment_methods',
    'finance_concepts', 'finance_movements', 'finance_movement_entries', 'finance_month_insights',
    'company_finance_accounts', 'company_finance_categories', 'company_finance_payment_methods',
    'company_finance_concepts', 'company_finance_movements', 'company_finance_movement_entries', 'company_finance_month_insights'
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
