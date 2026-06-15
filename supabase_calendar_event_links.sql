-- Calendario / Agenda — Fase 2: tabla espejo en Supabase para
-- calendar_event_links, reflejando migrations.ts v68 y el AppSchema agregado
-- a powersync.ts.
--
-- Cómo correr: pegar todo este archivo en el SQL Editor de Supabase
-- (Database > SQL Editor > New query) y ejecutar.
set role pg_database_owner;

create table if not exists public.calendar_event_links (
  id                 text primary key,
  owner_user_id      text not null,
  source_module      text not null,
  source_type        text not null,
  source_event_id    text not null,
  google_calendar_id text not null,
  google_event_id    text not null,
  title              text not null,
  created_at         bigint not null,
  updated_at         bigint not null,
  workspace_id       text not null,
  unique (source_module, source_event_id)
);

create index if not exists idx_calendar_event_links_source
  on public.calendar_event_links(source_module, source_event_id);

-- ════════════════════════════════════════════════════════════════════════
-- Row Level Security
--
-- Mismo patrón que las demás tablas: el upload desde PowerSync usa la
-- service_role key (bypassea RLS). La policy habilita a cualquier usuario
-- autenticado a leer las filas de su workspace.
-- ════════════════════════════════════════════════════════════════════════

alter table public.calendar_event_links enable row level security;

drop policy if exists "Authenticated users can read workspace rows" on public.calendar_event_links;
create policy "Authenticated users can read workspace rows" on public.calendar_event_links
  for select to authenticated using (workspace_id = 'd61a4071-1557-4f32-be5e-6443fb336bf5');

-- ════════════════════════════════════════════════════════════════════════
-- Permisos para service_role (usado por PowerSync para subir cambios)
-- ════════════════════════════════════════════════════════════════════════

grant select, insert, update, delete on public.calendar_event_links to service_role;
