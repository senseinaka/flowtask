-- Cajas Internas — Comprobantes adjuntos (Etapa 2)
-- Correr en: Supabase > SQL Editor > New query
--
-- La METADATA del comprobante vive acá (sincroniza vía PowerSync ↔ Supabase);
-- los BYTES del archivo viven en Google Drive (carpeta "Summit Cajas").
-- `drive_file_id` es la referencia al archivo en Drive.
--
-- Patrón actual post-migración de seguridad: los uploads suben con el JWT del
-- usuario (rol `authenticated`), NO con service_role. Por eso la policy es
-- `authenticated_workspace_all` (FOR ALL) + GRANT a authenticated.
-- Sin UNIQUE secundarios (evita 23505 en la cola de sync) — id determinístico (uuid).
--
-- IMPORTANTE: NO usar `set role pg_database_owner` acá. Si la tabla se crea con
-- otro rol, no hereda el ALTER DEFAULT PRIVILEGES que da SELECT a powersync_repl
-- y no replicaría. Correr como postgres (default del SQL Editor) + el grant
-- explícito de abajo como red de seguridad.

create table if not exists public.cash_attachments (
  id            text primary key,
  workspace_id  text not null,
  owner_type    text not null,            -- 'movement' | 'count'
  owner_id      text not null,
  original_name text not null default '',
  mime_type     text not null default '',
  size_bytes    bigint not null default 0,
  drive_file_id text not null default '',
  created_by    text not null default '',
  created_at    text not null default ''
);

alter table public.cash_attachments enable row level security;

drop policy if exists "authenticated_workspace_all" on public.cash_attachments;
create policy "authenticated_workspace_all" on public.cash_attachments
  for all to authenticated
  using      (workspace_id = 'd61a4071-1557-4f32-be5e-6443fb336bf5')
  with check (workspace_id = 'd61a4071-1557-4f32-be5e-6443fb336bf5');

grant select, insert, update, delete on public.cash_attachments to authenticated;

-- Red de seguridad: SELECT explícito para el rol de replicación de PowerSync.
-- (Redundante si la tabla se creó como postgres por el ALTER DEFAULT PRIVILEGES,
--  pero no molesta y evita el bug histórico de "tabla nueva no sincroniza".)
grant select on public.cash_attachments to powersync_repl;

create index if not exists cash_attachments_owner_idx
  on public.cash_attachments (workspace_id, owner_id);

-- ════════════════════════════════════════════════════════════════════════
-- PASO 2 (aparte, en el dashboard de PowerSync → Sync Rules):
-- agregar esta línea y desplegar:
--
--   - SELECT * FROM cash_attachments WHERE workspace_id = 'd61a4071-1557-4f32-be5e-6443fb336bf5'
--
-- Sin esta línea la tabla no baja a ningún dispositivo (síntoma: "Sin comprobantes"
-- aunque Supabase tenga las filas).
-- ════════════════════════════════════════════════════════════════════════
