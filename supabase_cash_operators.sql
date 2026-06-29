-- Cajas Internas — Operadores de caja (identificar operador + PIN de acciones sensibles)
-- Correr en: Supabase > SQL Editor > New query
--
-- Lista propia de operadores (nombre + PIN numérico de 4 dígitos), independiente
-- de las cuentas de login (Supabase Auth). Sirve para identificar quién opera una
-- caja y para autorizar acciones sensibles pidiendo el PIN. NO es login.
--
-- El PIN nunca se guarda en texto plano: se deriva con scrypt + salt aleatoria por
-- operador y se compara en tiempo constante (timingSafeEqual) en el proceso main.
-- El hash/salt sincronizan (así el PIN vale en todos los dispositivos); aun así un
-- PIN de 4 dígitos es débil por diseño (10.000 combinaciones) — alcance: control
-- interno de operadores, no una credencial de seguridad fuerte.
--
-- Patrón post-migración de seguridad: los uploads suben con el JWT del usuario
-- (rol `authenticated`), NO service_role → policy `authenticated_workspace_all`
-- (FOR ALL) + GRANT a authenticated. Sin UNIQUE secundarios (id uuid).
--
-- IMPORTANTE: NO usar `set role pg_database_owner` acá. Correr como postgres
-- (default del SQL Editor) para heredar el ALTER DEFAULT PRIVILEGES que da SELECT
-- a powersync_repl; el grant explícito de abajo es la red de seguridad.

create table if not exists public.cash_operators (
  id           text primary key,
  workspace_id text not null,
  name         text not null,
  pin_hash     text not null default '',     -- scrypt(pin, salt) en hex — nunca el PIN
  pin_salt     text not null default '',     -- salt aleatoria por operador (hex)
  active       integer not null default 1,
  created_at   text not null default '',
  updated_at   text not null default ''
);

alter table public.cash_operators enable row level security;

drop policy if exists "authenticated_workspace_all" on public.cash_operators;
create policy "authenticated_workspace_all" on public.cash_operators
  for all to authenticated
  using      (workspace_id = 'd61a4071-1557-4f32-be5e-6443fb336bf5')
  with check (workspace_id = 'd61a4071-1557-4f32-be5e-6443fb336bf5');

grant select, insert, update, delete on public.cash_operators to authenticated;

-- Red de seguridad: SELECT explícito para el rol de replicación de PowerSync.
grant select on public.cash_operators to powersync_repl;

create index if not exists cash_operators_workspace_idx
  on public.cash_operators (workspace_id);

-- ════════════════════════════════════════════════════════════════════════
-- PASO 2 (aparte, en el dashboard de PowerSync → Sync Rules):
-- agregar esta línea y desplegar:
--
--   - SELECT * FROM cash_operators WHERE workspace_id = 'd61a4071-1557-4f32-be5e-6443fb336bf5'
--
-- Sin esta línea la tabla no baja a ningún dispositivo (síntoma: los operadores
-- se guardan en Supabase pero no se ven en otros equipos).
-- ════════════════════════════════════════════════════════════════════════
