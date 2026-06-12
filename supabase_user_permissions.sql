-- Fase 6.2: tabla espejo de user_permissions (permisos por usuario/módulo)
create table if not exists public.user_permissions (
  id text primary key,
  user_id uuid not null,
  module_key text not null,
  submodule_key text,
  level text not null default 'none',
  created_at bigint not null,
  updated_at bigint not null,
  workspace_id text not null
);

create index if not exists idx_user_permissions_user on public.user_permissions(user_id);

alter table public.user_permissions enable row level security;

-- Cada usuario autenticado puede leer únicamente sus propios permisos.
-- Las escrituras (desde la app, vía PowerSync) usan la service_role key,
-- que bypassea RLS, así que no se necesita policy de insert/update aquí.
create policy "Users can read their own permissions"
  on public.user_permissions for select
  using (auth.uid() = user_id);
