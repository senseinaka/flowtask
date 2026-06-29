-- Cajas Internas — Desglose de billetes por movimiento (doble chequeo de control)
-- Correr en: Supabase > SQL Editor > New query
--
-- Guarda con QUÉ billetes y en QUÉ cantidad se compone el importe de un movimiento
-- (ingreso, egreso o transferencia). Es el espejo de cash_count_details pero por
-- movimiento. Solo se llena cuando el operador usa el contador de billetes en el
-- modal de "Nuevo movimiento"; si carga el importe a mano, no se inserta nada.
--
-- En una transferencia (2 movimientos: salida + entrada) se guarda el mismo
-- billetaje en ambos movimientos.
--
-- Patrón post-migración de seguridad: los uploads suben con el JWT del usuario
-- (rol `authenticated`), NO service_role → policy `authenticated_workspace_all`
-- (FOR ALL) + GRANT a authenticated. Sin UNIQUE secundarios (id determinístico uuid).
--
-- IMPORTANTE: NO usar `set role pg_database_owner` acá. Correr como postgres
-- (default del SQL Editor) para heredar el ALTER DEFAULT PRIVILEGES que da SELECT
-- a powersync_repl; el grant explícito de abajo es la red de seguridad.

create table if not exists public.cash_movement_breakdowns (
  id           text primary key,
  workspace_id text not null,
  movement_id  text not null,
  currency     text not null,            -- ARS | USD | EUR
  denomination real not null default 0,
  quantity     integer not null default 0,
  created_at   text not null default ''
);

alter table public.cash_movement_breakdowns enable row level security;

drop policy if exists "authenticated_workspace_all" on public.cash_movement_breakdowns;
create policy "authenticated_workspace_all" on public.cash_movement_breakdowns
  for all to authenticated
  using      (workspace_id = 'd61a4071-1557-4f32-be5e-6443fb336bf5')
  with check (workspace_id = 'd61a4071-1557-4f32-be5e-6443fb336bf5');

grant select, insert, update, delete on public.cash_movement_breakdowns to authenticated;

-- Red de seguridad: SELECT explícito para el rol de replicación de PowerSync.
grant select on public.cash_movement_breakdowns to powersync_repl;

create index if not exists cash_movement_breakdowns_movement_idx
  on public.cash_movement_breakdowns (workspace_id, movement_id);

-- ════════════════════════════════════════════════════════════════════════
-- PASO 2 (aparte, en el dashboard de PowerSync → Sync Rules):
-- agregar esta línea y desplegar:
--
--   - SELECT * FROM cash_movement_breakdowns WHERE workspace_id = 'd61a4071-1557-4f32-be5e-6443fb336bf5'
--
-- Sin esta línea la tabla no baja a ningún dispositivo (síntoma: el desglose
-- se guarda en Supabase pero no se ve en otros equipos).
-- ════════════════════════════════════════════════════════════════════════
