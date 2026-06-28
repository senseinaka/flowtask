-- Módulo Cajas Internas — tablas Supabase (E1)
-- Correr en: Database > SQL Editor > New query
-- Todas las tablas son workspace-scoped y sincronizan vía PowerSync.
-- Sin UNIQUE secundarios (evita 23505 en la cola de sync).

set role pg_database_owner;

-- ════════════════════════════════════════════════════════════════════════
-- 1. Empresas (seed: Naka Outdoors + Estación Vertical)
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.cash_companies (
  id           text primary key,
  workspace_id text not null,
  name         text not null,
  code         text not null default '',
  active       integer not null default 1,
  created_at   text not null default ''
);

-- ════════════════════════════════════════════════════════════════════════
-- 2. Cajas
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.cashboxes (
  id                   text primary key,
  workspace_id         text not null,
  company_id           text not null,
  name                 text not null,
  description          text not null default '',
  currencies           text not null default '["ARS"]',   -- JSON array
  status               text not null default 'ok',
  -- ok | pending_count | with_difference | blocked | closed
  responsible_user_id  text not null default '',
  requires_count_hours integer,
  active               integer not null default 1,
  created_at           text not null default ''
);

-- ════════════════════════════════════════════════════════════════════════
-- 3. Permisos por usuario/caja
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.cashbox_permissions (
  id             text primary key,
  workspace_id   text not null,
  cashbox_id     text not null,
  user_id        text not null,
  permission_key text not null,
  granted_by     text not null default '',
  created_at     text not null default ''
);

-- ════════════════════════════════════════════════════════════════════════
-- 4. Categorías de ingreso/egreso
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.cash_categories (
  id           text primary key,
  workspace_id text not null,
  company_id   text not null default '',   -- '' = todas las empresas
  name         text not null,
  type         text not null default 'income',   -- income | expense
  active       integer not null default 1,
  created_at   text not null default ''
);

-- ════════════════════════════════════════════════════════════════════════
-- 5. Movimientos (cabecera)
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.cash_movements (
  id                text primary key,
  workspace_id      text not null,
  cashbox_id        text not null,
  type              text not null,
  -- income | expense | transfer | adjustment | bank_deposit | opening | correction
  status            text not null default 'draft',
  -- draft | confirmed | cancelled | pending_approval
  reference_date    text not null default '',
  category_id       text not null default '',
  source_cashbox_id text not null default '',   -- solo para transfer
  dest_cashbox_id   text not null default '',   -- solo para transfer
  notes             text not null default '',
  confirmed_by      text not null default '',
  confirmed_at      text not null default '',
  created_by        text not null default '',
  created_at        text not null default '',
  updated_at        text not null default ''
);

-- ════════════════════════════════════════════════════════════════════════
-- 6. Importes por moneda (1–3 rows por movimiento)
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.cash_movement_amounts (
  id           text primary key,
  workspace_id text not null,
  movement_id  text not null,
  currency     text not null,   -- ARS | USD | EUR
  amount       real not null default 0,
  created_at   text not null default ''
);

-- ════════════════════════════════════════════════════════════════════════
-- 7. Conteos / arqueos
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.cash_counts (
  id           text primary key,
  workspace_id text not null,
  cashbox_id   text not null,
  count_type   text not null default 'quick_count',
  -- quick_count | daily_close | formal_audit
  status       text not null default 'pending',
  -- pending | confirmed | with_difference | cancelled
  counted_by   text not null default '',
  confirmed_by text not null default '',
  notes        text not null default '',
  created_at   text not null default ''
);

-- ════════════════════════════════════════════════════════════════════════
-- 8. Detalle de conteo por denominación
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.cash_count_details (
  id           text primary key,
  workspace_id text not null,
  count_id     text not null,
  currency     text not null,
  denomination real not null default 0,
  quantity     integer not null default 0,
  created_at   text not null default ''
);

-- ════════════════════════════════════════════════════════════════════════
-- 9. Diferencias detectadas
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.cash_differences (
  id               text primary key,
  workspace_id     text not null,
  cashbox_id       text not null,
  count_id         text not null default '',
  currency         text not null,
  system_amount    real not null default 0,
  counted_amount   real not null default 0,
  difference       real not null default 0,
  status           text not null default 'pending',
  -- pending | under_review | resolved | written_off
  resolution_notes text not null default '',
  resolved_by      text not null default '',
  created_at       text not null default ''
);

-- ════════════════════════════════════════════════════════════════════════
-- 10. Audit log
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.cash_audit_logs (
  id           text primary key,
  workspace_id text not null,
  cashbox_id   text not null,
  action       text not null,
  user_id      text not null default '',
  details      text not null default '',
  created_at   text not null default ''
);

-- ════════════════════════════════════════════════════════════════════════
-- RLS: SELECT para authenticated (workspace hardcodeado)
-- ════════════════════════════════════════════════════════════════════════

do $$
declare
  t text;
  tables text[] := array[
    'cash_companies', 'cashboxes', 'cashbox_permissions',
    'cash_categories', 'cash_movements', 'cash_movement_amounts',
    'cash_counts', 'cash_count_details', 'cash_differences', 'cash_audit_logs'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Workspace read" on public.%I', t);
    execute format(
      'create policy "Workspace read" on public.%I for select to authenticated using (workspace_id = ''d61a4071-1557-4f32-be5e-6443fb336bf5'')',
      t
    );
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- GRANT para service_role (PowerSync escribe via service_role)
-- ════════════════════════════════════════════════════════════════════════

do $$
declare
  t text;
  tables text[] := array[
    'cash_companies', 'cashboxes', 'cashbox_permissions',
    'cash_categories', 'cash_movements', 'cash_movement_amounts',
    'cash_counts', 'cash_count_details', 'cash_differences', 'cash_audit_logs'
  ];
begin
  foreach t in array tables loop
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- Seed: Empresas
-- ════════════════════════════════════════════════════════════════════════

insert into public.cash_companies (id, workspace_id, name, code, active, created_at)
values
  ('cashco-naka', 'd61a4071-1557-4f32-be5e-6443fb336bf5', 'Naka Outdoors',    'NAKA', 1, now()::text),
  ('cashco-ev',   'd61a4071-1557-4f32-be5e-6443fb336bf5', 'Estación Vertical', 'EV',   1, now()::text)
on conflict (id) do nothing;

-- ════════════════════════════════════════════════════════════════════════
-- Seed: Cajas iniciales (6 cajas)
-- ════════════════════════════════════════════════════════════════════════

insert into public.cashboxes
  (id, workspace_id, company_id, name, description, currencies, status, active, created_at)
values
  ('cashbx-naka-local',   'd61a4071-1557-4f32-be5e-6443fb336bf5', 'cashco-naka', 'Naka local',     'Caja ventas Naka',        '["ARS","USD","EUR"]', 'ok', 1, now()::text),
  ('cashbx-naka-gonzalo', 'd61a4071-1557-4f32-be5e-6443fb336bf5', 'cashco-naka', 'Caja 1 Gonzalo', 'Caja intermedia Gonzalo', '["ARS"]',             'ok', 1, now()::text),
  ('cashbx-naka-hernan',  'd61a4071-1557-4f32-be5e-6443fb336bf5', 'cashco-naka', 'Caja 2 Hernán',  'Caja pagos Hernán',       '["ARS","USD"]',       'ok', 1, now()::text),
  ('cashbx-ev-cajeros',   'd61a4071-1557-4f32-be5e-6443fb336bf5', 'cashco-ev',   'EV caja cajeros','Cobros diarios EV',       '["ARS"]',             'ok', 1, now()::text),
  ('cashbx-ev-1',         'd61a4071-1557-4f32-be5e-6443fb336bf5', 'cashco-ev',   'EV caja 1',      'Caja intermedia EV',      '["ARS","USD"]',       'ok', 1, now()::text),
  ('cashbx-ev-martin',    'd61a4071-1557-4f32-be5e-6443fb336bf5', 'cashco-ev',   'EV caja 2 Martín','Caja pagos Martín',      '["ARS"]',             'ok', 1, now()::text)
on conflict (id) do nothing;

-- ════════════════════════════════════════════════════════════════════════
-- Seed: Categorías (compartidas, company_id vacío)
-- ════════════════════════════════════════════════════════════════════════

insert into public.cash_categories
  (id, workspace_id, company_id, name, type, active, created_at)
values
  -- Ingresos
  ('cashcat-ventas',       'd61a4071-1557-4f32-be5e-6443fb336bf5', '', 'Ventas en efectivo',   'income',  1, now()::text),
  ('cashcat-cobro-deuda',  'd61a4071-1557-4f32-be5e-6443fb336bf5', '', 'Cobro de deuda',       'income',  1, now()::text),
  ('cashcat-reposicion',   'd61a4071-1557-4f32-be5e-6443fb336bf5', '', 'Reposición de caja',   'income',  1, now()::text),
  ('cashcat-dev-compra',   'd61a4071-1557-4f32-be5e-6443fb336bf5', '', 'Devolución de compra', 'income',  1, now()::text),
  -- Egresos
  ('cashcat-compras',      'd61a4071-1557-4f32-be5e-6443fb336bf5', '', 'Compras en efectivo',  'expense', 1, now()::text),
  ('cashcat-gastos-op',    'd61a4071-1557-4f32-be5e-6443fb336bf5', '', 'Gastos operativos',    'expense', 1, now()::text),
  ('cashcat-pago-prov',    'd61a4071-1557-4f32-be5e-6443fb336bf5', '', 'Pago a proveedor',     'expense', 1, now()::text),
  ('cashcat-retiro',       'd61a4071-1557-4f32-be5e-6443fb336bf5', '', 'Retiro de socio',      'expense', 1, now()::text)
on conflict (id) do nothing;
